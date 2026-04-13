"""
MCP Tool Registry
-----------------
Discovers MCP tools from all installed Frappe apps.

Any app that creates `{app}/mcp_tools.py` with:
  • MCP_TOOLS  list
  • handle_tool(tool_name, arguments) whitelisted function

...will have its tools automatically aggregated into the frappe_theme MCP server.
"""

import importlib
import frappe


@frappe.whitelist()
def get_all_tools() -> list:
    """
    Scan all installed Frappe apps for mcp_tools.py and return their tool schemas.
    Each entry includes an 'app' key so the MCP server knows where to dispatch.
    """
    all_tools = []
    for app in frappe.get_installed_apps():
        if app == "frappe":          # skip core frappe
            continue
        try:
            module = importlib.import_module(f"{app}.mcp_tools")
            tools = getattr(module, "MCP_TOOLS", [])
            for tool in tools:
                all_tools.append({**tool, "_app": app})
        except ImportError:
            pass
        except Exception as e:
            frappe.log_error(f"MCP registry error loading {app}.mcp_tools: {e}")

    return all_tools
