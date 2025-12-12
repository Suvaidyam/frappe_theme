# Copyright (c) 2025, Suvaidyam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe_theme.utils import get_state_closure_by_type


def execute(filters: dict | None = None):
	"""Return columns and data for the report.

	This is the main entry point for the report. It accepts the filters as a
	dictionary and should return columns and data. It is called by the framework
	every time the report is refreshed or a filter is updated.
	"""
	columns = get_columns()
	data = get_data()

	return columns, data


def get_columns() -> list[dict]:
	return [
		{
			"label": _("Module"),
			"fieldname": "module",
			"fieldtype": "Link",
			"options": "DocType",
			"width": 200
      	},
		{
			"label": _("Total Requests"),
			"fieldname": "total_requests",
			"fieldtype": "Int",
			"width": 200
		},
		{
			"label": _("Approved Requests"),
			"fieldname": "approved_requests",
			"fieldtype": "Int",
			"width": 200
		},
		{
			"label": _("Pending Requests"),
			"fieldname": "pending_on_me_requests",
			"fieldtype": "Int",
			"width": 200
		},
		{
			"label": _("Rejected Requests"),
			"fieldname": "rejected_requests",
			"fieldtype": "Int",
			"width": 200
		},
	]


def get_data() -> list[list]:
	wf_list = frappe.get_all("Workflow", filters={"is_active": 1}, fields=["document_type", "workflow_state_field", "workflow_name"])
	data = []
	for wf in wf_list:
		positive_closure = get_state_closure_by_type(wf.document_type)
		negative_closure = get_state_closure_by_type(wf.document_type, "Negative")
		total_count = frappe.db.count(wf.document_type)
		approved_count = frappe.db.count(wf.document_type, {wf.workflow_state_field: positive_closure}) if positive_closure else 0
		rejected_count = frappe.db.count(wf.document_type, {wf.workflow_state_field: negative_closure}) if negative_closure else 0
		pending_on_me_count = frappe.db.count(
			wf.document_type,
			{
				wf.workflow_state_field: ["not in", [positive_closure, negative_closure]],
			},
		)
		data.append({
			"module": wf.document_type,
			"total_requests": total_count,
			"approved_requests": approved_count,
			"pending_on_me_requests": pending_on_me_count,
			"rejected_requests": rejected_count,
		})
	return data