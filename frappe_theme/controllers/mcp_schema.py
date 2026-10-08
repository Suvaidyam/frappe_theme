"""
Tool-schema derivation for the embedded MCP server (apis/mcp.py, mcp_tools.py).

Converts a Python function's type hints + Google-style docstring into an MCP
`inputSchema`, so tool definitions don't need a hand-maintained schema dict
living next to (and able to drift from) the function signature.

Modeled on frappe-mcp's (github.com/frappe/mcp) tool_schema.py, with two
differences driven by this app's actual tools:
  - Literal[...] support, so enum-constrained params (connection_type,
    chart_type, ...) get a JSON-schema `enum` list derived from the same
    type alias the function body validates against — one source of truth
    instead of a schema-dict copy plus a runtime tuple.
  - Parameter defaults carry into the schema's `default` key, since several
    tools document a non-None default (e.g. dry_run=False, chart_height=300).

Not taken as a dependency: frappe-mcp itself, since its schema generator
lacks Literal support (every enum param here would still need a manual
override) and its JSON-RPC dispatch leaks raw exception text to the client
(apis/mcp.py's _call_tool deliberately avoids that). This module borrows
only the type->schema idea, not the transport.
"""

import inspect
import re
import types as _types
from typing import Any, Literal, Union, get_args, get_origin, get_type_hints

_PY_TO_JSON_TYPE = {
	int: "integer",
	str: "string",
	float: "number",
	bool: "boolean",
}

_JSON_SAFE_DEFAULT_TYPES = (bool, int, str, float)


def _convert_type(py_type) -> dict:
	if py_type is Any or py_type is inspect.Parameter.empty:
		return {}

	if py_type in _PY_TO_JSON_TYPE:
		return {"type": _PY_TO_JSON_TYPE[py_type]}

	origin = get_origin(py_type)

	if origin is Literal:
		values = get_args(py_type)
		value_type = _PY_TO_JSON_TYPE.get(type(values[0]), "string") if values else "string"
		return {"type": value_type, "enum": list(values)}

	if origin in (Union, _types.UnionType):
		args = [a for a in get_args(py_type) if a is not type(None)]
		if len(args) == 1:
			# Optional[T] -> T. Whether the field is required is driven by the
			# parameter's default, not its type, so there's nothing further to
			# encode here.
			return _convert_type(args[0])
		return {"anyOf": [_convert_type(a) for a in args]}

	if origin is list:
		args = get_args(py_type)
		return {"type": "array", "items": _convert_type(args[0])} if args else {"type": "array"}

	if origin is dict:
		return {"type": "object"}

	if py_type is list:
		return {"type": "array"}
	if py_type is dict:
		return {"type": "object"}

	return {}


_ARGS_HEADER_RE = re.compile(r"\n\s*Args:\n")
_ARG_ENTRY_RE = re.compile(
	r"^\s*(\w+)\s*(?:\([^)]*\))?:\s*(.*?)(?=\n\s*\w+\s*(?:\(.*\))?:|\Z)",
	re.MULTILINE | re.DOTALL,
)


def _parse_docstring(doc: str) -> tuple[str, dict[str, str]]:
	"""Google-style docstring -> (description, {param_name: description})."""
	if not doc:
		return "", {}

	doc = inspect.cleandoc(doc)
	parts = _ARGS_HEADER_RE.split(doc, maxsplit=1)
	if len(parts) == 1:
		return doc.strip(), {}

	description, args_block = parts
	arg_descriptions = {
		name: " ".join(desc.strip().split()) for name, desc in _ARG_ENTRY_RE.findall(args_block)
	}
	return description.strip(), arg_descriptions


def build_tool_schema(fn) -> dict:
	"""{"description": ..., "inputSchema": {...}} derived from fn's signature + docstring."""
	description, arg_descriptions = _parse_docstring(fn.__doc__ or "")

	try:
		type_hints = get_type_hints(fn)
	except (NameError, TypeError):
		type_hints = {}

	properties: dict[str, dict] = {}
	required: list[str] = []

	for name, param in inspect.signature(fn).parameters.items():
		if param.kind not in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY):
			continue

		prop_schema = _convert_type(type_hints.get(name, Any))

		if name in arg_descriptions:
			prop_schema["description"] = arg_descriptions[name]

		has_default = param.default is not inspect.Parameter.empty
		if has_default and param.default is not None and isinstance(param.default, _JSON_SAFE_DEFAULT_TYPES):
			prop_schema["default"] = param.default

		properties[name] = prop_schema

		if not has_default:
			required.append(name)

	input_schema = {"type": "object", "properties": properties}
	if required:
		input_schema["required"] = required

	return {"description": description, "inputSchema": input_schema}


def tool(registry: dict, *, name: str | None = None):
	"""Register fn in `registry` as {name: {"schema": ..., "handler": fn}}.

	Schema is always derived from fn's own signature/docstring — no override
	param, by design: a tool whose schema can't be expressed by its own type
	hints is a sign the signature needs a Literal/dataclass, not an escape
	hatch that lets the schema drift from what the function actually accepts.
	"""

	def decorator(fn):
		registry[name or fn.__name__] = {"schema": build_tool_schema(fn), "handler": fn}
		return fn

	return decorator
