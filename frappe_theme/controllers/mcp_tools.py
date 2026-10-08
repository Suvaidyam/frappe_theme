"""
MCP tool implementations for frappe_theme's own features (SVADatatable
Configuration) plus Frappe core Report/Dashboard Chart creation.

Transport (JSON-RPC dispatch) lives in apis/mcp.py — this module only
contains the tool schemas and business logic. Schemas are derived from each
function's type hints + docstring by mcp_schema.tool() — see that module's
docstring for why (and why not frappe-mcp's own generator, or frappe-mcp
itself).
"""

import json
from typing import Literal, get_args

import frappe
from frappe.desk.doctype.dashboard_chart.dashboard_chart import (
	create_dashboard_chart as _core_create_dashboard_chart,
)
from frappe.desk.reportview import save_report as _core_save_report

from frappe_theme.apis.meta import get_possible_link_filters
from frappe_theme.controllers.mcp_schema import tool

TOOL_REGISTRY: dict = {}

# Single source of truth for each enum-constrained param: the type alias
# drives both the generated JSON-schema `enum` list and the function body's
# own runtime validation (via get_args below), instead of the two drifting
# independently.
ConnectionType = Literal["Direct", "Indirect", "Referenced", "Unfiltered", "Is Custom Design", "Report"]
CustomDesignTemplate = Literal[
	"Tasks",
	"Email",
	"Timeline",
	"Gallery",
	"Notes",
	"Linked Users",
	"Approval Request",
	"HTML View From API",
]
ChartType = Literal["Count", "Sum", "Average", "Group By", "Custom", "Report"]
ChartKind = Literal["Line", "Bar", "Percentage", "Pie", "Donut", "Heatmap"]
ReportType = Literal["Report Builder", "Query Report", "Script Report"]


def _bool(v, default=False):
	return default if v is None else bool(v)


def _require_doctype(doctype):
	if not doctype or not frappe.db.exists("DocType", doctype):
		frappe.throw(f"DocType '{doctype}' does not exist.", frappe.DoesNotExistError)


def _require_fieldname(doctype, fieldname, fieldtypes=None):
	field = frappe.get_meta(doctype).get_field(fieldname)
	if not field:
		frappe.throw(f"Field '{fieldname}' does not exist on DocType '{doctype}'.", frappe.ValidationError)
	if fieldtypes and field.fieldtype not in fieldtypes:
		frappe.throw(
			f"Field '{fieldname}' on '{doctype}' is '{field.fieldtype}', expected one of {fieldtypes}.",
			frappe.ValidationError,
		)
	return field


@tool(TOOL_REGISTRY)
def list_html_fields(doctype: str):
	"""Discovery tool. Given a DocType, returns its HTML fields (candidates for
	html_field) and Link/Table fields (candidates for get_possible_connections),
	plus whether an SVADatatable Configuration already exists for it.

	Args:
	        doctype: DocType to inspect.
	"""
	_require_doctype(doctype)
	meta = frappe.get_meta(doctype)
	return {
		"doctype": doctype,
		"html_fields": [
			{"fieldname": f.fieldname, "label": f.label} for f in meta.fields if f.fieldtype == "HTML"
		],
		"linkable_fields": [
			{"fieldname": f.fieldname, "label": f.label, "fieldtype": f.fieldtype, "options": f.options}
			for f in meta.fields
			if f.fieldtype in ("Link", "Table", "Table MultiSelect")
		],
		"existing_svadatatable_configuration": frappe.db.exists(
			"SVADatatable Configuration", {"parent_doctype": doctype}
		)
		or None,
	}


@tool(TOOL_REGISTRY)
def get_possible_connections(doctype: str, parent_doctype: str):
	"""Discovery tool. Thin wrapper around frappe_theme.apis.meta.get_possible_link_filters
	— given a child doctype and parent doctype, returns valid relationship shapes
	with the exact local_fieldname/foreign_fieldname to use for Direct/Indirect
	connections.

	Args:
	        doctype: Child DocType.
	        parent_doctype: Parent DocType to connect it to.
	"""
	return {"connections": get_possible_link_filters(doctype, parent_doctype)}


@tool(TOOL_REGISTRY)
def configure_svadatatable(
	parent_doctype: str,
	html_field: str,
	connection_type: ConnectionType,
	link_doctype: str | None = None,
	link_fieldname: str | None = None,
	local_field: str | None = None,
	foreign_field: str | None = None,
	referenced_link_doctype: str | None = None,
	dt_reference_field: str | None = None,
	dn_reference_field: str | None = None,
	link_report: str | None = None,
	unfiltered: bool | None = None,
	template: CustomDesignTemplate | None = None,
	endpoint: str | None = None,
	title: str | None = None,
	action_label: str | None = None,
	add_row_button_label: str | None = None,
	crud_permissions: list[str] | None = None,
	hide_table: bool | None = None,
	allow_export: bool | None = None,
	allow_import: bool | None = None,
	add_total_row: bool | None = None,
	redirect_to_main_form: bool | None = None,
	dry_run: bool = False,
):
	"""Create (if missing) the SVADatatable Configuration for parent_doctype and
	add/update a child-table row on an HTML field of its form. dry_run=true
	validates without writing.

	Args:
	        parent_doctype: DocType the table gets embedded into.
	        html_field: Fieldname of an HTML field on parent_doctype's form.
	        link_doctype: Required for Direct/Unfiltered/Indirect.
	        link_fieldname: Optional for Direct; auto-detected if omitted.
	        local_field: Required for Indirect.
	        foreign_field: Required for Indirect.
	        link_report: Required for Report.
	        endpoint: Required if template is 'HTML View From API'.
	        crud_permissions: Default ['read'].
	"""
	dry_run = _bool(dry_run)
	_require_doctype(parent_doctype)
	_require_fieldname(parent_doctype, html_field, fieldtypes=["HTML"])

	if connection_type not in get_args(ConnectionType):
		frappe.throw(f"Invalid connection_type '{connection_type}'.", frappe.ValidationError)

	child_row = {"html_field": html_field, "connection_type": connection_type}

	if connection_type in ("Direct", "Unfiltered", "Indirect"):
		_require_doctype(link_doctype)
		child_row["link_doctype"] = link_doctype
		if connection_type == "Direct":
			if link_fieldname:
				_require_fieldname(link_doctype, link_fieldname, fieldtypes=["Link"])
			else:
				meta = frappe.get_meta(link_doctype)
				match = next(
					(f for f in meta.fields if f.fieldtype == "Link" and f.options == parent_doctype), None
				)
				if not match:
					frappe.throw(
						f"Could not auto-detect a Link field on '{link_doctype}' pointing to "
						f"'{parent_doctype}'. Pass link_fieldname explicitly.",
						frappe.ValidationError,
					)
				link_fieldname = match.fieldname
			child_row["link_fieldname"] = link_fieldname
		if connection_type == "Indirect":
			if not local_field or not foreign_field:
				frappe.throw(
					"local_field and foreign_field are required for Indirect connections.",
					frappe.ValidationError,
				)
			_require_fieldname(parent_doctype, local_field, fieldtypes=["Link"])
			_require_fieldname(link_doctype, foreign_field)
			child_row.update({"local_field": local_field, "foreign_field": foreign_field})
	elif connection_type == "Referenced":
		if not (referenced_link_doctype and dt_reference_field and dn_reference_field):
			frappe.throw(
				"referenced_link_doctype, dt_reference_field, and dn_reference_field are all "
				"required for Referenced connections.",
				frappe.ValidationError,
			)
		_require_doctype(referenced_link_doctype)
		_require_fieldname(referenced_link_doctype, dt_reference_field)
		_require_fieldname(referenced_link_doctype, dn_reference_field)
		child_row.update(
			{
				"referenced_link_doctype": referenced_link_doctype,
				"dt_reference_field": dt_reference_field,
				"dn_reference_field": dn_reference_field,
			}
		)
	elif connection_type == "Report":
		if not link_report:
			frappe.throw("link_report is required for Report connections.", frappe.ValidationError)
		if not frappe.db.exists("Report", link_report):
			frappe.throw(f"Report '{link_report}' does not exist.", frappe.DoesNotExistError)
		child_row["link_report"] = link_report
		if unfiltered is not None:
			child_row["unfiltered"] = int(_bool(unfiltered))
	elif connection_type == "Is Custom Design":
		valid_templates = get_args(CustomDesignTemplate)
		if template not in valid_templates:
			frappe.throw(
				f"template must be one of {valid_templates} for Is Custom Design.", frappe.ValidationError
			)
		child_row["template"] = template
		if template == "HTML View From API":
			if not endpoint:
				frappe.throw(
					"endpoint is required when template is 'HTML View From API'.", frappe.ValidationError
				)
			child_row["endpoint"] = endpoint

	for key, val in {
		"title": title,
		"action_label": action_label,
		"add_row_button_label": add_row_button_label,
		"hide_table": hide_table,
		"allow_export": allow_export,
		"allow_import": allow_import,
		"add_total_row": add_total_row,
		"redirect_to_main_form": redirect_to_main_form,
	}.items():
		if val is not None:
			child_row[key] = int(val) if isinstance(val, bool) else val
	if crud_permissions is not None:
		child_row["crud_permissions"] = (
			crud_permissions if isinstance(crud_permissions, str) else json.dumps(crud_permissions)
		)

	existing_name = frappe.db.exists("SVADatatable Configuration", {"parent_doctype": parent_doctype})
	will_create_parent = not existing_name

	# Idempotency: a repeat call with the same (html_field, connection_type) updates the
	# existing row in place instead of appending a duplicate — matters because an MCP
	# client/agent may retry a call after a timeout or user re-request.
	doc = None
	existing_row_idx = None
	if existing_name:
		doc = frappe.get_doc("SVADatatable Configuration", existing_name)
		for i, row in enumerate(doc.get("child_doctypes") or []):
			if row.html_field == html_field and row.connection_type == connection_type:
				existing_row_idx = i
				break

	if dry_run:
		return {
			"dry_run": True,
			"would_create_parent_record": will_create_parent,
			"parent_doctype": parent_doctype,
			"svadatatable_configuration": existing_name or f"(new) {parent_doctype}",
			"would_update_existing_row": existing_row_idx is not None,
			"child_row": child_row,
		}

	if doc is None:
		doc = frappe.new_doc("SVADatatable Configuration")
		doc.parent_doctype = parent_doctype

	if existing_row_idx is not None:
		doc.child_doctypes[existing_row_idx].update(child_row)
	else:
		doc.append("child_doctypes", child_row)

	# Arbitrary MCP caller may lack System Manager — matches this app's own privileged-
	# whitelisted-method pattern (e.g. DTConf.setup_user_list_settings).
	doc.save(ignore_permissions=True)

	return {
		"dry_run": False,
		"svadatatable_configuration": doc.name,
		"created_parent_record": will_create_parent,
		"updated_existing_row": existing_row_idx is not None,
		"child_row": child_row,
	}


@tool(TOOL_REGISTRY)
def create_dashboard_chart(
	chart_name: str,
	chart_type: ChartType,
	type: ChartKind,
	document_type: str | None = None,
	based_on: str | None = None,
	value_based_on: str | None = None,
	timespan: str | None = None,
	time_interval: str | None = None,
	timeseries: bool | None = None,
	filters_json: str | None = None,
	group_by_based_on: str | None = None,
	group_by_type: str | None = None,
	aggregate_function_based_on: str | None = None,
	report_name: str | None = None,
	is_public: bool | None = None,
	color: str | None = None,
	dry_run: bool = False,
):
	"""Create a standalone Dashboard Chart via Frappe core's create_dashboard_chart.
	dry_run=true validates without writing.

	Args:
	        document_type: Required unless chart_type is Report.
	        report_name: Required when chart_type is Report.
	"""
	dry_run = _bool(dry_run)
	args = {"chart_name": chart_name, "chart_type": chart_type, "type": type}

	if chart_type == "Report":
		if not report_name:
			frappe.throw("report_name is required when chart_type is 'Report'.", frappe.ValidationError)
		if not frappe.db.exists("Report", report_name):
			frappe.throw(f"Report '{report_name}' does not exist.", frappe.DoesNotExistError)
		args["report_name"] = report_name
	else:
		if not document_type:
			frappe.throw("document_type is required unless chart_type is 'Report'.", frappe.ValidationError)
		_require_doctype(document_type)
		args["document_type"] = document_type
		if based_on:
			_require_fieldname(document_type, based_on)
			args["based_on"] = based_on
		if value_based_on:
			_require_fieldname(document_type, value_based_on)
			args["value_based_on"] = value_based_on
		if chart_type == "Group By" and group_by_based_on:
			_require_fieldname(document_type, group_by_based_on)
			args["group_by_based_on"] = group_by_based_on
			if group_by_type:
				args["group_by_type"] = group_by_type
			if aggregate_function_based_on:
				_require_fieldname(document_type, aggregate_function_based_on)
				args["aggregate_function_based_on"] = aggregate_function_based_on

	for key, val in {
		"timespan": timespan,
		"time_interval": time_interval,
		"timeseries": timeseries,
		"filters_json": filters_json,
		"is_public": is_public,
		"color": color,
	}.items():
		if val is not None:
			args[key] = val

	if dry_run:
		note = {}
		if frappe.db.exists("Dashboard Chart", chart_name):
			note[
				"note"
			] = f"'{chart_name}' already exists; core create_dashboard_chart will append a numeric suffix."
		return {"dry_run": True, "would_insert": "Dashboard Chart", "payload": args, **note}

	doc = _core_create_dashboard_chart(json.dumps(args))
	return {"dry_run": False, "name": doc.name}


@tool(TOOL_REGISTRY)
def create_report(
	report_name: str,
	ref_doctype: str,
	report_type: ReportType,
	module: str | None = None,
	query: str | None = None,
	report_script: str | None = None,
	report_settings: dict | str | None = None,
	dry_run: bool = False,
):
	"""Create a Frappe Report. Report Builder delegates to core save_report;
	Query/Script Report creates the doc directly and requires the caller to
	have the 'Script Manager' role (Frappe core enforces this — dry_run
	surfaces it before the real write fails). dry_run=true validates without
	writing.

	Args:
	        report_settings: Required for Report Builder. Keys: filters, fields
	                ([[fieldname,doctype],...]), order_by, add_totals_row,
	                page_length, column_widths, group_by, chart_args.
	"""
	dry_run = _bool(dry_run)
	_require_doctype(ref_doctype)
	if report_type not in get_args(ReportType):
		frappe.throw(f"Invalid report_type '{report_type}'.", frappe.ValidationError)
	if frappe.db.exists("Report", report_name):
		frappe.throw(f"Report '{report_name}' already exists.", frappe.ValidationError)

	if report_type == "Report Builder":
		if not report_settings:
			frappe.throw(
				"report_settings is required for report_type 'Report Builder'.", frappe.ValidationError
			)
		if not frappe.has_permission("Report", "create"):
			frappe.throw("Missing 'create' permission on Report.", frappe.PermissionError)
		if not frappe.has_permission(ref_doctype, "read"):
			frappe.throw(f"Missing 'read' permission on '{ref_doctype}'.", frappe.PermissionError)
		settings_json = report_settings if isinstance(report_settings, str) else json.dumps(report_settings)
		if dry_run:
			return {
				"dry_run": True,
				"would_call": "frappe.desk.reportview.save_report",
				"payload": {"name": report_name, "doctype": ref_doctype, "report_settings": settings_json},
			}
		name = _core_save_report(report_name, ref_doctype, settings_json)
		return {"dry_run": False, "name": name}

	# Query/Script Report — no bespoke core API; Frappe core's Report.validate() requires
	# the "Script Manager" role for these — surface that in dry_run rather than letting the
	# real save fail.
	if "Script Manager" not in frappe.get_roles():
		frappe.throw(
			"Creating a Query Report or Script Report requires the 'Script Manager' role "
			"(enforced by Frappe core's Report.validate()).",
			frappe.PermissionError,
		)
	if report_type == "Query Report" and not query:
		frappe.throw("query is required for report_type 'Query Report'.", frappe.ValidationError)
	if report_type == "Script Report" and not report_script:
		frappe.throw("report_script is required for report_type 'Script Report'.", frappe.ValidationError)

	doc_dict = {
		"doctype": "Report",
		"report_name": report_name,
		"report_type": report_type,
		"ref_doctype": ref_doctype,
		"module": module or frappe.db.get_value("DocType", ref_doctype, "module"),
	}
	doc_dict["query" if report_type == "Query Report" else "report_script"] = (
		query if report_type == "Query Report" else report_script
	)

	if dry_run:
		return {"dry_run": True, "would_insert": "Report", "payload": doc_dict}

	doc = frappe.get_doc(doc_dict)
	doc.insert(ignore_permissions=True)
	return {"dry_run": False, "name": doc.name}


@tool(TOOL_REGISTRY)
def add_chart_to_svadatatable(
	parent_doctype: str,
	html_field: str,
	dashboard_chart: str,
	chart_label: str | None = None,
	background_color: str | None = None,
	text_color: str | None = None,
	border_color: str | None = None,
	chart_height: int | None = None,
	show_legend: bool | None = None,
	sequence: int | None = None,
	is_visible: bool | None = None,
	dry_run: bool = False,
):
	"""Append a Dashboard Chart Child row to an existing SVADatatable Configuration's
	charts table. Fails (DoesNotExistError) if no SVADatatable Configuration exists
	yet for parent_doctype — run configure_svadatatable first. dry_run=true
	validates without writing.
	"""
	dry_run = _bool(dry_run)
	_require_doctype(parent_doctype)
	_require_fieldname(parent_doctype, html_field, fieldtypes=["HTML"])
	if not frappe.db.exists("Dashboard Chart", dashboard_chart):
		frappe.throw(f"Dashboard Chart '{dashboard_chart}' does not exist.", frappe.DoesNotExistError)

	existing_name = frappe.db.exists("SVADatatable Configuration", {"parent_doctype": parent_doctype})
	if not existing_name:
		frappe.throw(
			f"No SVADatatable Configuration exists for '{parent_doctype}' yet. "
			f"Run configure_svadatatable first.",
			frappe.DoesNotExistError,
		)

	chart_row = {"html_field": html_field, "dashboard_chart": dashboard_chart}
	for key, val in {
		"chart_label": chart_label,
		"background_color": background_color,
		"text_color": text_color,
		"border_color": border_color,
		"chart_height": chart_height,
		"sequence": sequence,
	}.items():
		if val is not None:
			chart_row[key] = val
	if show_legend is not None:
		chart_row["show_legend"] = int(_bool(show_legend))
	if is_visible is not None:
		chart_row["is_visible"] = int(_bool(is_visible))

	doc = frappe.get_doc("SVADatatable Configuration", existing_name)
	# Idempotency, same rationale as configure_svadatatable: same (html_field, dashboard_chart)
	# updates in place.
	existing_row_idx = next(
		(
			i
			for i, row in enumerate(doc.get("charts") or [])
			if row.html_field == html_field and row.dashboard_chart == dashboard_chart
		),
		None,
	)

	if dry_run:
		return {
			"dry_run": True,
			"svadatatable_configuration": existing_name,
			"would_update_existing_row": existing_row_idx is not None,
			"chart_row": chart_row,
		}

	if existing_row_idx is not None:
		doc.charts[existing_row_idx].update(chart_row)
	else:
		doc.append("charts", chart_row)
	doc.save(ignore_permissions=True)
	return {
		"dry_run": False,
		"svadatatable_configuration": doc.name,
		"updated_existing_row": existing_row_idx is not None,
		"chart_row": chart_row,
	}
