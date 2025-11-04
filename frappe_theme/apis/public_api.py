import json

import frappe


@frappe.whitelist(allow_guest=True)
def get_values(doctype, docname, fields):
	if not frappe.db.exists(doctype, docname):
		return {}

	if isinstance(fields, str):
		fields = json.loads(fields)

	if isinstance(fields, list):
		fields = ",".join(fields)

	return frappe.db.get_value(doctype, docname, fields, as_dict=True)
