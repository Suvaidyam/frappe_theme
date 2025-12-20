import json

import frappe
from frappe.model.workflow import apply_workflow as original_apply_workflow
from frappe.model.workflow import get_transitions, get_workflow
from frappe.utils import getdate


@frappe.whitelist()
def custom_apply_workflow(doc, action):
	doc = frappe.parse_json(doc)
	# Get relevant workflow-related fields from Property Setter
	workflow = get_workflow(doc.doctype)
	transitions = get_transitions(doc, workflow)
	selected_transition = next(
		(transition for transition in (transitions or []) if transition.action == action), None
	)
	action_fields = (
		json.loads(selected_transition.custom_selected_fields or "[]") if selected_transition else []
	)
	required_fields = []
	if len(action_fields):
		required_fields = [
			{"fieldname": field["fieldname"], "label": field["label"]}
			for field in action_fields
			if field.get("reqd", 0)
		]
	else:
		props = frappe.get_all(
			"Property Setter",
			fields=["field_name"],
			filters={"doc_type": doc.doctype, "property": "wf_state_field", "value": action},
			ignore_permissions=True,
		)
		if len(props):
			required_fields = [
				{"fieldname": prop["field_name"], "label": prop["field_name"]} for prop in props
			]

	wf_dialog_fields = doc.get("wf_dialog_fields") or {}
	# Check if all required fields have values
	if len(required_fields):
		missing_fields = [f for f in required_fields if not wf_dialog_fields.get(f["fieldname"])]
		if missing_fields:
			field_list = "".join([f"<li>{f['label']}</li>" for f in missing_fields])
			frappe.throw(
				f"Required workflow data is missing or incomplete. Missing fields: <br><ul>{field_list}</ul>"
			)
	# if len(required_fields):
	#     if not all(wf_dialog_fields.get(f) for f in required_fields):
	#        frappe.throw("Required workflow data is missing or incomplete.")
	# Load the actual doc and update fields
	data_doc = frappe.get_doc(doc.doctype, doc.name)
	meta = frappe.get_meta(doc.doctype)
	updated = False
	comment_fields = ["custom_comment", "custom_wf_comment", "wf_comment", "comment"]
	wf_action_data = {
		"workflow_action": action,
		"comment": "",
		"action_data": [],
		"reference_doctype": doc.doctype,
		"reference_name": doc.get("name"),
		"workflow_state_previous": selected_transition.get("state"),
		"workflow_state_current": selected_transition.get("next_state"),
		"role": selected_transition.get("allowed"),
		"user": frappe.session.user,
	}
	for fieldname, value in wf_dialog_fields.items():
		if value is None:
			continue

		field = meta.get_field(fieldname)
		if not field:
			continue  # Skip unknown/invalid fields

		# Type-specific conversion
		if field.fieldtype == "Date":
			value = getdate(value)
		elif field.fieldtype == "Check":
			value = 1 if str(value) in ("1", "true", "True") else 0
		elif field.fieldtype in ("Int", "Float", "Currency", "Percent"):
			try:
				value = float(value) if field.fieldtype in ("Float", "Currency", "Percent") else int(value)
			except ValueError:
				frappe.throw(f"Invalid value for field {fieldname}")

		data_doc.set(fieldname, value)
		if fieldname not in comment_fields:
			wf_action_data["action_data"].append(
				{"fieldname": fieldname, "fieldtype": field.fieldtype, "value": value}
			)
		if fieldname in comment_fields:
			wf_action_data["comment"] = value
		updated = True
	if updated:
		data_doc.save()
	wf_action_doc = frappe.new_doc("SVA Workflow Action")
	wf_action_doc.update(wf_action_data)
	wf_action_doc.insert(ignore_permissions=True)

	return original_apply_workflow(frappe.as_json(doc), action)
