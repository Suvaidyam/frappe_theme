import frappe


@frappe.whitelist()
def save_field_data_protection(values):
	"""Save field data protection"""
	try:
		if isinstance(values, str):
			values = frappe.parse_json(values)
		if not values["doc_type"] or not values["fname"]:
			frappe.throw("Doctype and Fieldname is required.")

		if not frappe.db.exists(
			"SVAProperty Setter", {"doc_type": values["doc_type"], "fname": values["fname"]}
		):
			sva_prop = frappe.new_doc("SVAProperty Setter")
			sva_prop.update(values)
			sva_prop.insert(ignore_permissions=True)
		else:
			sva_prop = frappe.get_doc(
				"SVAProperty Setter", {"doc_type": values["doc_type"], "fname": values["fname"]}
			)
			sva_prop.update(values)
			sva_prop.flags.ignore_permissions = True
			sva_prop.save()
		return {"ok": True}
	except Exception:
		frappe.log_error("Error in save_field_data_protection", frappe.get_traceback())
		return {"ok": False}


@frappe.whitelist()
def get_field_data_protection(doctype, fieldname):
	"""Get field data protection"""
	try:
		if not doctype or not fieldname:
			frappe.log_error("doctype or fieldname is required for get_field_data_protection")
			return {}
		if not frappe.db.exists("SVAProperty Setter", {"doc_type": doctype, "fname": fieldname}):
			return {}
		else:
			return frappe.db.get_value("SVAProperty Setter", {"doc_type": doctype, "fname": fieldname}, "*")
	except Exception:
		frappe.log_error("Error in get_field_data_protection", frappe.get_traceback())
		return {}


@frappe.whitelist()
def get_regex_validation(doctype):
	"""Get regex validation"""
	try:
		if not doctype:
			frappe.log_error("doctype is required for get_regex_validation")
			return []
		ps = frappe.get_all(
			"Property Setter",
			{"doc_type": doctype, "property": "regex_validation"},
			["field_name", "value"],
			ignore_permissions=True,
		)
		return ps
	except Exception:
		frappe.log_error("Error in get_regex_validation", frappe.get_traceback())
		return []
