"""
MCP (Model Context Protocol) server, embedded as a Frappe whitelisted endpoint.

  frappe_theme.apis.mcp.mcp

Single POST endpoint speaking hand-rolled JSON-RPC 2.0 — no official `mcp`
SDK (it's ASGI-only and doesn't mount on Frappe's sync gunicorn workers), no
SSE/streaming (would block sync workers; unnecessary for tool-calling).
Requires standard Frappe session/API-key auth like every other whitelisted
method in this app — NOT allow_guest, since these tools mutate live desk
configuration.

Supported methods: initialize, notifications/initialized, tools/list, tools/call.
Business-logic failures inside tools/call return HTTP 200 with
result.isError=true; only transport-level failures (bad JSON, unknown
method/tool) use the JSON-RPC `error` field.

Tool schemas + implementations live in controllers/mcp_tools.py.

IMPORTANT: MCP clients require the raw JSON-RPC object as the top-level HTTP
response body. Frappe's default whitelisted-method dispatch wraps any
returned value in {"message": <value>} (frappe/handler.py:62), which breaks
that contract. The one documented escape hatch (frappe/handler.py:56 —
`isinstance(data, Response): return data`) is to return a raw
werkzeug.wrappers.Response directly; Frappe then passes it through
unmodified. Every branch below returns via _json_response()/Response for
this reason — never a plain dict.
"""

import json

import frappe
from werkzeug.wrappers import Response

from frappe_theme.controllers import mcp_tools

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "frappe-theme-mcp", "version": "1.0.0"}
TOOLS = mcp_tools.TOOL_REGISTRY


@frappe.whitelist(methods=["POST"])
def mcp():
	try:
		# Frappe's own dispatcher already consumes frappe.request.data to populate
		# frappe.local.form_dict with the parsed JSON body's top-level keys before this
		# whitelisted method runs — frappe.request.data itself is empty by this point.
		# Same gotcha handled in uhis_next_core.api.sync._resolve_env.
		req = dict(frappe.local.form_dict)
	except Exception:
		return _json_response(_rpc_error(None, -32700, "Parse error"))

	if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or "method" not in req:
		return _json_response(
			_rpc_error(req.get("id") if isinstance(req, dict) else None, -32600, "Invalid Request")
		)

	method = req.get("method")
	params = req.get("params") or {}
	req_id = req.get("id")
	is_notification = "id" not in req

	if method == "initialize":
		return _json_response(
			_rpc_result(
				req_id,
				{
					"protocolVersion": PROTOCOL_VERSION,
					"capabilities": {"tools": {"listChanged": False}},
					"serverInfo": SERVER_INFO,
				},
			)
		)

	if method == "notifications/initialized":
		return Response(status=202)

	if method == "tools/list":
		tools = [{"name": name, **spec["schema"]} for name, spec in TOOLS.items()]
		return _json_response(_rpc_result(req_id, {"tools": tools}))

	if method == "tools/call":
		tool_name = params.get("name")
		tool_args = params.get("arguments") or {}
		if not tool_name or tool_name not in TOOLS:
			return _json_response(_rpc_error(req_id, -32602, f"Unknown tool: {tool_name}"))
		return _json_response(_rpc_result(req_id, _call_tool(tool_name, tool_args)))

	if is_notification:
		return Response(status=202)

	return _json_response(_rpc_error(req_id, -32601, "Method not found"))


def _json_response(payload):
	return Response(json.dumps(payload), status=200, mimetype="application/json")


def _call_tool(tool_name, tool_args):
	handler = TOOLS[tool_name]["handler"]
	try:
		payload = handler(**tool_args)
		return {"content": [{"type": "text", "text": json.dumps(payload, default=str)}], "isError": False}
	except (frappe.exceptions.ValidationError, frappe.exceptions.DoesNotExistError) as e:
		return _tool_error(str(e))
	except frappe.exceptions.PermissionError as e:
		return _tool_error(f"Permission denied: {e}")
	except TypeError as e:
		return _tool_error(f"Invalid arguments: {e}")
	except Exception as e:
		frappe.log_error(f"MCP tool '{tool_name}' failed: {e}", "MCP Server")
		return _tool_error("Internal error while executing tool. See error log for details.")


def _tool_error(message):
	return {"content": [{"type": "text", "text": message}], "isError": True}


def _rpc_result(req_id, result):
	return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _rpc_error(req_id, code, message):
	return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}
