#!/usr/bin/env python3
"""
Frappe MCP Server
-----------------
Manages Frappe DocTypes and documents via REST API.
Exposes MCP tools for DocType management and full CRUD on any DocType.

Authentication flow:
  1. Connect to the MCP server URL.
  2. Call authenticate(api_key, api_secret) — validates credentials against Frappe
     and binds them to your session.
  3. Use any other tool freely within that session.
"""

import contextvars
import json
import os
import sys
import asyncio
from typing import Any

import httpx
import uvicorn
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.types import ASGIApp, Receive, Scope, Send

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ---------------------------------------------------------------------------
# Config  (env vars used only for startup health-check; runtime auth is
# per-session via the authenticate() tool)
# ---------------------------------------------------------------------------

FRAPPE_URL = os.getenv("FRAPPE_URL", "").rstrip("/")
_STARTUP_API_KEY    = os.getenv("FRAPPE_API_KEY", "")
_STARTUP_API_SECRET = os.getenv("FRAPPE_API_SECRET", "")

if not FRAPPE_URL:
    print("ERROR: Missing required environment variable: FRAPPE_URL", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Per-session credential store
# ---------------------------------------------------------------------------

# ContextVar holds the mcp-session-id for the current async request context.
_current_session_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "mcp_session_id", default=""
)

# Maps session-id → (api_key, api_secret)
_session_creds: dict[str, tuple[str, str]] = {}


class _NotAuthenticatedError(Exception):
    """Raised when a tool is called without prior authenticate() call."""
    MESSAGE = (
        "Not authenticated. Please call the authenticate(api_key, api_secret) tool "
        "first to connect with your Frappe credentials."
    )


def _get_session_creds() -> tuple[str, str]:
    """Return creds for the current session.
    Priority: 1) session creds from authenticate()
              2) startup creds from .env
              3) raise _NotAuthenticatedError
    """
    sid = _current_session_id.get()
    if sid and sid in _session_creds:
        return _session_creds[sid]
    # Try any authenticated session (most recent)
    if _session_creds:
        return next(iter(_session_creds.values()))
    # Fall back to startup credentials from .env
    if _STARTUP_API_KEY and _STARTUP_API_SECRET:
        return (_STARTUP_API_KEY, _STARTUP_API_SECRET)
    raise _NotAuthenticatedError(_NotAuthenticatedError.MESSAGE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_auth_headers(api_key: str, api_secret: str) -> dict[str, str]:
    return {
        "Authorization": f"token {api_key}:{api_secret}",
        "Content-Type": "application/json",
    }


def _startup_auth_headers() -> dict[str, str]:
    return _make_auth_headers(_STARTUP_API_KEY, _STARTUP_API_SECRET)


def _fmt_error(response: httpx.Response) -> str:
    """Return a human-readable error message from a Frappe error response."""
    status = response.status_code
    if status in (401, 403):
        return "Authentication failed. Check your API Key and Secret."
    if status == 404:
        return "Document or DocType not found."
    if status == 417:
        try:
            data = response.json()
            raw = data.get("_server_messages", "")
            if raw:
                msgs = json.loads(raw) if isinstance(raw, str) else raw
                parts = []
                for m in msgs:
                    try:
                        parts.append(json.loads(m).get("message", m))
                    except Exception:
                        parts.append(str(m))
                return " | ".join(parts)
            return data.get("message", response.text)
        except Exception:
            return response.text
    try:
        data = response.json()
        return data.get("message", response.text)
    except Exception:
        return response.text


# ---------------------------------------------------------------------------
# Theme DocType definition (auto-created on startup)
# ---------------------------------------------------------------------------

THEME_DOCTYPE_PAYLOAD = {
    "doctype": "DocType",
    "name": "Theme",
    "module": "Custom",
    "custom": 1,
    "fields": [
        {"fieldname": "theme_name",      "fieldtype": "Data",     "label": "Theme Name",      "reqd": 1},
        {"fieldname": "primary_color",   "fieldtype": "Color",    "label": "Primary Color"},
        {"fieldname": "secondary_color", "fieldtype": "Color",    "label": "Secondary Color"},
        {"fieldname": "font_family",     "fieldtype": "Data",     "label": "Font Family"},
        {"fieldname": "is_active",       "fieldtype": "Check",    "label": "Is Active"},
        {"fieldname": "description",     "fieldtype": "Text",     "label": "Description"},
    ],
    "permissions": [
        {"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}
    ],
}


# ---------------------------------------------------------------------------
# Startup checks + transport security
# ---------------------------------------------------------------------------

def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [part.strip() for part in raw.split(",") if part.strip()]


def _transport_security_settings() -> TransportSecuritySettings:
    if not _truthy(os.getenv("MCP_ENABLE_DNS_REBINDING_PROTECTION")):
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_csv_env("MCP_ALLOWED_HOSTS"),
        allowed_origins=_csv_env("MCP_ALLOWED_ORIGINS"),
    )


async def _load_app_tools() -> list[dict]:
    """
    Fetch tool schemas from all installed Frappe apps via the registry endpoint.
    Returns list of tool dicts, each with an '_app' key identifying the source app.
    Requires startup credentials to be set.
    """
    if not (_STARTUP_API_KEY and _STARTUP_API_SECRET):
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{FRAPPE_URL}/api/method/frappe_theme.apis.mcp_registry.get_all_tools",
                headers=_startup_auth_headers(),
            )
        if resp.is_success:
            return resp.json().get("message", [])
    except Exception as e:
        print(f"[frappe-mcp] WARNING: Could not load app tools: {e}", file=sys.stderr)
    return []


def _register_app_tools(tools: list[dict]) -> None:
    """
    Dynamically register app-specific tools as FastMCP tools.
    Each tool proxies to {app}.mcp_tools.handle_tool via Frappe REST API.
    """
    for tool_schema in tools:
        app = tool_schema.get("_app", "unknown")
        tool_name = tool_schema.get("name", "")
        description = tool_schema.get("description", f"Tool from {app}")
        parameters = tool_schema.get("parameters", {})

        if not tool_name:
            continue

        # Prefix tool name with app to avoid collisions across apps
        registered_name = f"{app}__{tool_name}"

        # Build a closure capturing app + tool_name for the proxy function
        def _make_proxy(bound_app: str, bound_tool: str):
            import json as _json
            from typing import Any

            # Build parameter doc string for the docstring
            param_doc = _json_schema_to_doc(parameters)

            async def proxy(params: dict[str, Any] | None = None) -> str:
                try:
                    api_key, api_secret = _get_session_creds()
                except _NotAuthenticatedError as e:
                    return str(e)
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.post(
                            f"{FRAPPE_URL}/api/method/{bound_app}.mcp_tools.handle_tool",
                            headers=_make_auth_headers(api_key, api_secret),
                            json={
                                "tool_name": bound_tool,
                                "arguments": _json.dumps(params or {}),
                            },
                        )
                    if resp.is_success:
                        result = resp.json().get("message", "")
                        if isinstance(result, str):
                            try:
                                result = _json.loads(result)
                            except Exception:
                                pass
                        return _json.dumps(result, indent=2, default=str)
                    return f"Error from {bound_app}: {_fmt_error(resp)}"
                except Exception as exc:
                    return f"Error calling {bound_app}.{bound_tool}: {exc}"

            proxy.__name__ = registered_name
            proxy.__doc__ = (
                f"[{bound_app}] {description}\n\n"
                f"Pass tool arguments as a dict in `params`. Available keys:\n{param_doc}"
            )
            return proxy

        import json as _json

        proxy_fn = _make_proxy(app, tool_name)
        mcp.tool(name=registered_name)(proxy_fn)
        print(f"[frappe-mcp] Registered tool: {registered_name} (from {app})", file=sys.stderr)


def _json_schema_to_doc(schema: dict) -> str:
    """Convert a JSON schema parameters dict to a readable docstring."""
    props = schema.get("properties", {})
    required = schema.get("required", [])
    lines = []
    for name, info in props.items():
        req = " (required)" if name in required else ""
        desc = info.get("description", "")
        lines.append(f"  {name}{req}: {desc}")
    return "\n".join(lines) if lines else "  (no parameters)"


async def _startup_checks() -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        if _STARTUP_API_KEY and _STARTUP_API_SECRET:
            # Full check: validate credentials and auto-create Theme DocType
            resp = await client.get(
                f"{FRAPPE_URL}/api/method/frappe.auth.get_logged_user",
                headers=_startup_auth_headers(),
            )
            if resp.status_code in (401, 403):
                raise RuntimeError("Authentication failed. Verify FRAPPE_API_KEY and FRAPPE_API_SECRET.")
            if not resp.is_success:
                raise RuntimeError(f"Unexpected response from Frappe ({resp.status_code}): {resp.text}")

            logged_user = resp.json().get("message", "unknown")
            print(f"[frappe-mcp] Startup check passed — Frappe reachable, default user: {logged_user}", file=sys.stderr)

            check = await client.get(
                f"{FRAPPE_URL}/api/resource/DocType/Theme",
                headers=_startup_auth_headers(),
            )
            if check.status_code == 404:
                create = await client.post(
                    f"{FRAPPE_URL}/api/resource/DocType",
                    headers=_startup_auth_headers(),
                    json=THEME_DOCTYPE_PAYLOAD,
                    timeout=30,
                )
                if create.is_success:
                    print("[frappe-mcp] Theme DocType created successfully.", file=sys.stderr)
                else:
                    print(f"[frappe-mcp] WARNING: Could not auto-create Theme DocType: {_fmt_error(create)}", file=sys.stderr)
            elif check.is_success:
                print("[frappe-mcp] Theme DocType already exists.", file=sys.stderr)
            else:
                print(f"[frappe-mcp] WARNING: Theme DocType check failed: {_fmt_error(check)}", file=sys.stderr)
        else:
            # No startup credentials — just verify Frappe is reachable
            resp = await client.get(f"{FRAPPE_URL}/api/method/ping")
            if not resp.is_success:
                raise RuntimeError(f"Frappe not reachable at {FRAPPE_URL} ({resp.status_code})")
            print(
                f"[frappe-mcp] Startup check passed — Frappe reachable at {FRAPPE_URL}. "
                "No startup credentials set; users must call authenticate() before using tools.",
                file=sys.stderr,
            )


def _run_startup_checks_or_exit(retries: int = 30, delay: float = 2.0) -> None:
    """Run startup checks, retrying until Frappe is reachable, then load app tools."""
    import time
    for attempt in range(1, retries + 1):
        try:
            asyncio.run(_startup_checks())
            # Discover and register tools from all installed apps
            app_tools = asyncio.run(_load_app_tools())
            if app_tools:
                _register_app_tools(app_tools)
            else:
                print("[frappe-mcp] No app tools discovered (no startup credentials or no mcp_tools.py found).", file=sys.stderr)
            return
        except httpx.ConnectError:
            if attempt == retries:
                print(
                    f"ERROR: Cannot connect to Frappe at {FRAPPE_URL} after {retries} attempts. "
                    "Make sure FRAPPE_URL is correct.",
                    file=sys.stderr,
                )
                sys.exit(1)
            print(f"[frappe-mcp] Waiting for Frappe at {FRAPPE_URL} (attempt {attempt}/{retries})...", file=sys.stderr)
            time.sleep(delay)
        except Exception as e:
            print(f"ERROR: Startup check failed: {e}", file=sys.stderr)
            sys.exit(1)


# ---------------------------------------------------------------------------
# ASGI middleware
#   1. Extracts mcp-session-id → sets _current_session_id ContextVar
#   2. Normalises Accept header (adds application/json + text/event-stream)
#      so clients that only send Accept: text/event-stream (e.g. claude.ai)
#      pass the SDK's strict validation.
# ---------------------------------------------------------------------------

class _RequestMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = list(scope.get("headers", []))

            # 1) Extract session ID
            session_id = next(
                (v.decode() for k, v in headers if k.lower() == b"mcp-session-id"), ""
            )

            # 2) Normalise Accept header
            accept_idx = next(
                (i for i, (k, _) in enumerate(headers) if k.lower() == b"accept"), None
            )
            current = headers[accept_idx][1].decode() if accept_idx is not None else ""
            additions = [
                mt for mt in ("application/json", "text/event-stream") if mt not in current
            ]
            if additions:
                new_accept = (current + ", " + ", ".join(additions)).lstrip(", ")
                if accept_idx is not None:
                    headers[accept_idx] = (b"accept", new_accept.encode())
                else:
                    headers.append((b"accept", new_accept.encode()))
                scope = {**scope, "headers": headers}

            token = _current_session_id.set(session_id)
            try:
                await self.app(scope, receive, send)
            finally:
                _current_session_id.reset(token)
        else:
            await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "Frappe MCP Server",
    stateless_http=False,
    json_response=True,   # JSON avoids Cloudflare SSE buffering on POST responses
    transport_security=_transport_security_settings(),
)


# ---------------------------------------------------------------------------
# Tool: authenticate  (must be called first in every session)
# ---------------------------------------------------------------------------

@mcp.tool()
async def authenticate(api_key: str, api_secret: str) -> str:
    """
    Authenticate with Frappe using your API credentials.
    This must be called once per session before using any other tool.

    To generate credentials in Frappe:
      User menu → My Settings → API Access → Generate Keys

    Args:
        api_key:    Your Frappe API Key
        api_secret: Your Frappe API Secret
    """
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{FRAPPE_URL}/api/method/frappe.auth.get_logged_user",
                headers=_make_auth_headers(api_key, api_secret),
            )
        if resp.status_code in (401, 403):
            return (
                "Authentication failed — invalid API Key or Secret. "
                "Please check your credentials and try again."
            )
        if not resp.is_success:
            return f"Authentication failed ({resp.status_code}): {resp.text}"

        user = resp.json().get("message", "unknown")
        sid = _current_session_id.get()
        if sid:
            _session_creds[sid] = (api_key, api_secret)

        return (
            f"Authenticated successfully as '{user}'. "
            "Your session is ready — you can now use all Frappe tools."
        )
    except httpx.ConnectError:
        return f"Cannot connect to Frappe at {FRAPPE_URL}. Check that the server is running."
    except Exception as e:
        return f"Error during authentication: {e}"


# ---------------------------------------------------------------------------
# Shared HTTP helper — uses per-session credentials
# ---------------------------------------------------------------------------

async def _call(method: str, path: str, **kwargs) -> httpx.Response:
    """Single shared HTTP helper — uses session credentials from authenticate()."""
    timeout = kwargs.pop("timeout", 20)
    api_key, api_secret = _get_session_creds()   # raises _NotAuthenticatedError if not set
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await getattr(client, method)(
            f"{FRAPPE_URL}{path}",
            headers=_make_auth_headers(api_key, api_secret),
            **kwargs,
        )


# ---------------------------------------------------------------------------
# Tools: DocType management
# ---------------------------------------------------------------------------

@mcp.tool()
async def create_doctype(
    name: str,
    module: str,
    fields: list[dict[str, Any]],
    custom: bool = True,
    is_single: bool = False,
    is_child_table: bool = False,
    permissions: list[dict[str, Any]] | None = None,
) -> str:
    """
    Create a Frappe DocType via REST API.

    Args:
        name:           DocType name (e.g. "My Custom Doc")
        module:         Frappe module (e.g. "Custom")
        fields:         List of field dicts with keys: fieldname, fieldtype, label, reqd, etc.
        custom:         Mark as custom DocType (default True)
        is_single:      Single DocType — only one record exists (default False)
        is_child_table: Child table DocType — embedded in parent (default False)
        permissions:    List of permission dicts; defaults to System Manager full access
    """
    try:
        resp = await _call("post", "/api/resource/DocType", json={
            "doctype": "DocType",
            "name": name,
            "module": module,
            "custom": 1 if custom else 0,
            "issingle": 1 if is_single else 0,
            "istable": 1 if is_child_table else 0,
            "fields": fields,
            "permissions": permissions or [
                {"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}
            ],
        }, timeout=30)
        if resp.is_success:
            return f"DocType '{name}' created successfully."
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def get_doctype(name: str) -> str:
    """Fetch the full definition of a DocType by name."""
    try:
        resp = await _call("get", f"/api/resource/DocType/{name}")
        if resp.status_code == 200:
            return json.dumps(resp.json().get("data", resp.json()), indent=2)
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def delete_doctype(name: str) -> str:
    """Delete a DocType by name. This is irreversible."""
    try:
        resp = await _call("delete", f"/api/resource/DocType/{name}")
        if resp.status_code == 202:
            return f"DocType '{name}' deleted successfully."
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


# ---------------------------------------------------------------------------
# Tools: Document CRUD
# ---------------------------------------------------------------------------

@mcp.tool()
async def create_document(doctype: str, data: dict[str, Any]) -> str:
    """
    Create a new document of any DocType.

    Args:
        doctype: Target DocType name (e.g. "Student")
        data:    Dict of field values (e.g. {"first_name": "John", "grade": "A"})
    """
    try:
        resp = await _call("post", f"/api/resource/{doctype}", json={"doctype": doctype, **data})
        if resp.is_success:
            doc = resp.json().get("data", {})
            return f"Document created: {doc.get('name', 'unknown')}\n{json.dumps(doc, indent=2)}"
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def get_document(doctype: str, name: str) -> str:
    """
    Fetch a single document by DocType and document name.

    Args:
        doctype: DocType name (e.g. "Student")
        name:    Document name / ID
    """
    try:
        resp = await _call("get", f"/api/resource/{doctype}/{name}")
        if resp.status_code == 200:
            return json.dumps(resp.json().get("data", resp.json()), indent=2)
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def list_documents(
    doctype: str,
    filters: dict[str, Any] | None = None,
    fields: list[str] | None = None,
    limit: int = 20,
    order_by: str = "modified desc",
) -> str:
    """
    List documents of any DocType with optional filters and field selection.

    Args:
        doctype:   DocType name (e.g. "Student")
        filters:   Dict of filters (e.g. {"grade": "A"})
        fields:    List of fields to return; omit for default fields
        limit:     Max records to return (default 20)
        order_by:  Sort order (default "modified desc")
    """
    try:
        params: dict[str, Any] = {"limit": limit, "order_by": order_by}
        if filters:
            params["filters"] = json.dumps(filters)
        if fields:
            params["fields"] = json.dumps(fields)
        resp = await _call("get", f"/api/resource/{doctype}", params=params)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            return f"Found {len(data)} record(s):\n{json.dumps(data, indent=2)}"
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def update_document(doctype: str, name: str, data: dict[str, Any]) -> str:
    """
    Update fields on an existing document.

    Args:
        doctype: DocType name (e.g. "Student")
        name:    Document name / ID
        data:    Dict of fields to update
    """
    try:
        resp = await _call("put", f"/api/resource/{doctype}/{name}", json=data)
        if resp.status_code == 200:
            doc = resp.json().get("data", {})
            return f"Document '{name}' updated.\n{json.dumps(doc, indent=2)}"
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def delete_document(doctype: str, name: str) -> str:
    """
    Delete a document by DocType and document name.

    Args:
        doctype: DocType name (e.g. "Student")
        name:    Document name / ID
    """
    try:
        resp = await _call("delete", f"/api/resource/{doctype}/{name}")
        if resp.status_code == 202:
            return f"Document '{name}' of type '{doctype}' deleted successfully."
        return f"Error: {_fmt_error(resp)}"
    except _NotAuthenticatedError as e:
        return str(e)
    except Exception as e:
        return f"Error: {e}"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Frappe MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "streamable-http"],
        default="stdio",
        help="Transport mode: 'stdio' for Claude Desktop/CLI, 'streamable-http' for claude.ai web (default: stdio)",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on (default: 8080)")
    parser.add_argument("--stateless-http", action="store_true", help="Use stateless HTTP sessions (default: stateful).")
    parser.add_argument("--json-responses", action="store_true", help="Force JSON responses (default: uses constructor setting).")
    parser.add_argument("--skip-startup-check", action="store_true", help="Skip startup auth/DocType checks against Frappe.")
    args = parser.parse_args()

    if not args.skip_startup_check:
        _run_startup_checks_or_exit()

    web_concurrency = os.getenv("WEB_CONCURRENCY")
    if web_concurrency:
        print(
            f"[frappe-mcp] WARNING: Ignoring WEB_CONCURRENCY={web_concurrency}. "
            "Forcing a single MCP worker process.",
            file=sys.stderr,
        )
        os.environ.pop("WEB_CONCURRENCY", None)

    if args.transport in ("sse", "streamable-http"):
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        if args.transport == "streamable-http":
            mcp.settings.stateless_http = args.stateless_http
            if args.json_responses:
                mcp.settings.json_response = True
            mode = "stateless" if args.stateless_http else "stateful"
            response_mode = "json" if mcp.settings.json_response else "sse"
            print(f"[frappe-mcp] HTTP mode={mode}, response_mode={response_mode}", file=sys.stderr)

        endpoint = "/sse" if args.transport == "sse" else "/mcp"
        print(f"[frappe-mcp] Starting {args.transport} server on {args.host}:{args.port} endpoint={endpoint}", file=sys.stderr)

        if args.transport == "streamable-http":
            starlette_app = mcp.streamable_http_app()
            wrapped_app = _RequestMiddleware(starlette_app)
            uvicorn.run(wrapped_app, host=args.host, port=args.port)
        else:
            mcp.run(transport=args.transport)
    else:
        mcp.run(transport="stdio")
