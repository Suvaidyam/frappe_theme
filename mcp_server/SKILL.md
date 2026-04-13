---
name: frappe-mcp
description: Set up, run, debug, or extend the Frappe MCP server — a Python MCP server that manages Frappe DocTypes and documents via REST API, running inside a Docker container. Use when configuring Claude Desktop to connect to the Frappe site, adding new MCP tools, troubleshooting auth/connection issues, or modifying server.py.
---

# Frappe MCP Server — Full Context & Development Guide

A Python MCP (Model Context Protocol) server that exposes Frappe DocType management and full document CRUD as MCP tools. Runs inside a Docker container; Claude Desktop connects via `docker exec`.

## Environment

| Detail | Value |
|--------|-------|
| Site name | `mcp.localhost` |
| Web server port | `8001` (internal to container) |
| FRAPPE_URL | `http://mcp.localhost:8001` |
| Container ID | `063d0f71bef7` |
| Python | 3.11.2 (`/usr/bin/python3`) |
| Bench root | `/workspace/development/abf` |
| App path | `/workspace/development/abf/apps/frappe_theme` |
| MCP server path | `/workspace/development/abf/apps/frappe_theme/mcp_server/` |

## File Structure

```
frappe_theme/
└── mcp_server/
    ├── server.py          ← FastMCP server — all tools + lifespan startup logic
    ├── requirements.txt   ← mcp>=1.0.0, httpx>=0.27.0, python-dotenv>=1.0.0
    ├── .env.example       ← Template: FRAPPE_URL, FRAPPE_API_KEY, FRAPPE_API_SECRET
    ├── .env               ← Actual credentials (git-ignored, created by user)
    ├── .venv/             ← Python virtualenv (created during setup)
    ├── SKILL.md           ← This file
    └── README.md          ← Setup + Claude Desktop connection guide
```

## Architecture

Uses `FastMCP` from the `mcp` Python SDK with a `lifespan` context manager:

```python
from mcp.server.fastmcp import FastMCP
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastMCP):
    # 1. Validate auth — exit(1) if fails
    # 2. Auto-create Theme DocType if it doesn't exist
    yield  # server is running

mcp = FastMCP("Frappe MCP Server", lifespan=lifespan)

@mcp.tool()
async def my_tool(...) -> str:
    ...
```

All HTTP calls use `httpx.AsyncClient`. Auth header: `Authorization: token {API_KEY}:{API_SECRET}`.

## Startup Behaviour

On every server start, `lifespan()` does two things:

1. **Validates credentials** via `GET /api/method/frappe.auth.get_logged_user`
   - Prints `[frappe-mcp] Authenticated as: Administrator` on success
   - Calls `sys.exit(1)` with a clear error on 401/403 or connection failure

2. **Auto-creates `Theme` DocType** if `GET /api/resource/DocType/Theme` returns 404
   - Fields: `theme_name` (Data, Mandatory), `primary_color` (Color), `secondary_color` (Color), `font_family` (Data), `is_active` (Check), `description` (Text)
   - Module: `frappe_theme`, `custom: 1`
   - Default permission: System Manager full access

## Available MCP Tools

### DocType Management

| Tool | Method | Endpoint |
|------|--------|----------|
| `create_doctype` | POST | `/api/resource/DocType` |
| `get_doctype` | GET | `/api/resource/DocType/{name}` |
| `delete_doctype` | DELETE | `/api/resource/DocType/{name}` |

`create_doctype` parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | str | required | DocType name |
| `module` | str | required | Frappe module (e.g. `"frappe_theme"`, `"Custom"`) |
| `fields` | list[dict] | required | Field defs: `fieldname`, `fieldtype`, `label`, `reqd`, etc. |
| `custom` | bool | `True` | Mark as custom DocType |
| `is_single` | bool | `False` | Single instance DocType |
| `is_child_table` | bool | `False` | Child table DocType |
| `permissions` | list[dict] | None | Defaults to System Manager full access |

### Document CRUD (any DocType)

| Tool | Method | Endpoint |
|------|--------|----------|
| `create_document` | POST | `/api/resource/{doctype}` |
| `get_document` | GET | `/api/resource/{doctype}/{name}` |
| `list_documents` | GET | `/api/resource/{doctype}?filters=...` |
| `update_document` | PUT | `/api/resource/{doctype}/{name}` |
| `delete_document` | DELETE | `/api/resource/{doctype}/{name}` |

`list_documents` supports: `filters` (dict), `fields` (list[str]), `limit` (int, default 20), `order_by` (str, default `"modified desc"`).

## Error Handling

All tools return readable strings, never raw stack traces:

| HTTP Status | Returned message |
|-------------|-----------------|
| 401 / 403 | `"Authentication failed. Check your API Key and Secret."` |
| 404 | `"Document or DocType not found."` |
| 417 | Frappe's validation message, parsed from `_server_messages` JSON |
| Other | `response.json().get("message")` or raw text |

The `_fmt_error(response)` helper in `server.py` handles all cases.

## Claude Desktop Connection

Claude Desktop (on the host machine) spawns the MCP server via `docker exec`.  
The server runs **inside** the container so `http://mcp.localhost:8001` resolves correctly.

### Config file locations

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Exact config to paste

```json
{
  "mcpServers": {
    "frappe": {
      "command": "docker",
      "args": [
        "exec", "-i", "063d0f71bef7",
        "/workspace/development/abf/apps/frappe_theme/mcp_server/.venv/bin/python",
        "/workspace/development/abf/apps/frappe_theme/mcp_server/server.py"
      ],
      "env": {
        "FRAPPE_URL": "http://mcp.localhost:8001",
        "FRAPPE_API_KEY": "your_api_key_here",
        "FRAPPE_API_SECRET": "your_api_secret_here"
      }
    }
  }
}
```

**Critical flags:**
- `-i` not `-it` — TTY (`-t`) breaks stdio-based MCP communication
- Container ID `063d0f71bef7` can be replaced with the container name (`docker ps --format "{{.Names}}"`) — names survive restarts, IDs don't
- After editing the config, **fully quit** Claude Desktop (not just close the window) and reopen

## Setup Steps (from scratch)

### 1 — Generate Frappe API Key
Open the site in browser → **Settings → Users → Administrator → API Access → Generate Keys**  
Copy both key and secret (secret is shown only once).

### 2 — Install dependencies (run on host)
```bash
docker exec -it 063d0f71bef7 bash -c "
  cd /workspace/development/abf/apps/frappe_theme/mcp_server &&
  python3 -m venv .venv &&
  .venv/bin/pip install -r requirements.txt
"
```

### 3 — Test the server before connecting Claude Desktop (run on host)
```bash
docker exec -i 063d0f71bef7 \
  /workspace/development/abf/apps/frappe_theme/mcp_server/.venv/bin/python \
  /workspace/development/abf/apps/frappe_theme/mcp_server/server.py
```

Expected output:
```
[frappe-mcp] Authenticated as: Administrator
[frappe-mcp] Theme DocType already exists.
```

### 4 — Add Claude Desktop config and restart

## Adding a New Tool

1. Open `server.py`
2. Add a new `@mcp.tool()` decorated `async` function
3. Use `httpx.AsyncClient` for HTTP, `_auth_headers()` for auth, `_fmt_error()` for errors
4. Return a plain string

```python
@mcp.tool()
async def my_new_tool(param: str) -> str:
    """Docstring shown to Claude as the tool description."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{FRAPPE_URL}/api/resource/MyDocType/{param}",
            headers=_auth_headers(),
        )
    if resp.status_code == 200:
        return json.dumps(resp.json().get("data", {}), indent=2)
    return f"Error: {_fmt_error(resp)}"
```

No registration needed — `FastMCP` auto-discovers all `@mcp.tool()` functions.

## Common Issues

| Symptom | Fix |
|---------|-----|
| Tools don't appear in Claude Desktop | Check JSON syntax (no trailing commas); fully quit and reopen Claude Desktop |
| "Cannot connect to Frappe" | Confirm `bench start` is running; confirm URL is `http://mcp.localhost:8001` |
| "Authentication failed" | Regenerate API keys in Frappe; update `env` block in Claude Desktop config |
| Server hangs on startup | Re-run `pip install -r requirements.txt` inside container |
| Container ID changed after restart | Use container **name** instead of ID in the config args |

## Frappe REST API Quick Reference

| Operation | Method | URL |
|-----------|--------|-----|
| Auth check | GET | `/api/method/frappe.auth.get_logged_user` |
| Create DocType | POST | `/api/resource/DocType` |
| Get DocType | GET | `/api/resource/DocType/{name}` |
| Delete DocType | DELETE | `/api/resource/DocType/{name}` |
| List docs | GET | `/api/resource/{DocType}` |
| Create doc | POST | `/api/resource/{DocType}` |
| Get doc | GET | `/api/resource/{DocType}/{name}` |
| Update doc | PUT | `/api/resource/{DocType}/{name}` |
| Delete doc | DELETE | `/api/resource/{DocType}/{name}` |

All requests require `Authorization: token {API_KEY}:{API_SECRET}` header.  
Successful creates/updates → HTTP 200/201 with `{"data": {...}}`.  
Successful deletes → HTTP 202.
