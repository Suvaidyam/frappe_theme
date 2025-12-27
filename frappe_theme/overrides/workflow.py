import json

import frappe
from frappe.model.workflow import apply_workflow as original_apply_workflow
from frappe.model.workflow import get_transitions, get_workflow
from frappe.utils import getdate


@frappe.whitelist()
def custom_apply_workflow(doc, action):
	# -------------------------------
	# Parse incoming doc
	# -------------------------------
	doc = frappe.parse_json(doc)

	# -------------------------------
	# Get workflow + transition
	# -------------------------------
	workflow = get_workflow(doc.doctype)
	transitions = get_transitions(doc, workflow)
	selected_transition = next(
		(t for t in (transitions or []) if t.action == action),
		None,
	)

	if not selected_transition:
		frappe.throw(f"Invalid workflow action: {action}")

	# -------------------------------
	# Resolve required fields
	# -------------------------------
	action_fields = json.loads(selected_transition.custom_selected_fields or "[]")

	if action_fields:
		required_fields = [
			{"fieldname": f["fieldname"], "label": f.get("label", f["fieldname"])}
			for f in action_fields
			if f.get("reqd", 0)
		]
	else:
		props = frappe.get_all(
			"Property Setter",
			fields=["field_name"],
			filters={
				"doc_type": doc.doctype,
				"property": "wf_state_field",
				"value": action,
			},
			ignore_permissions=True,
		)
		required_fields = [{"fieldname": p["field_name"], "label": p["field_name"]} for p in props]

	# -------------------------------
	# Validate dialog fields
	# -------------------------------
	wf_dialog_fields = doc.get("wf_dialog_fields") or {}

	if required_fields:
		missing = [f for f in required_fields if not wf_dialog_fields.get(f["fieldname"])]
		if missing:
			field_list = "".join(f"<li>{f['label']}</li>" for f in missing)
			frappe.throw(f"Required workflow data is missing or incomplete." f"<br><ul>{field_list}</ul>")

	# -------------------------------
	# Load actual document
	# -------------------------------
	data_doc = frappe.get_doc(doc.doctype, doc.name)
	meta = frappe.get_meta(doc.doctype)

	comment_fields = [
		"custom_comment",
		"custom_wf_comment",
		"wf_comment",
		"comment",
	]

	updated = False

	# -------------------------------
	# Prepare workflow action log
	# -------------------------------
	wf_action_data = {
		"workflow_action": action,
		"comment": "",
		"action_data": [],
		"reference_doctype": doc.doctype,
		"reference_name": doc.name,
		"workflow_state_previous": selected_transition.state,
		"workflow_state_current": selected_transition.next_state,
		"role": selected_transition.allowed,
		"user": frappe.session.user,
	}

	# -------------------------------
	# Apply dialog values
	# -------------------------------
	for fieldname, raw_value in wf_dialog_fields.items():
		if raw_value is None:
			continue

		field = meta.get_field(fieldname)
		if not field:
			continue

		value = raw_value

		# ---------- CHILD TABLE ----------
		if field.fieldtype in ("Table", "Table MultiSelect"):
			if not isinstance(value, list):
				frappe.throw(f"{fieldname} must be a list")

			data_doc.set(fieldname, [])
			for row in value:
				if isinstance(row, dict):
					data_doc.append(fieldname, row)

		# ---------- NORMAL FIELDS ----------
		else:
			if field.fieldtype == "Date":
				value = getdate(value)

			elif field.fieldtype == "Check":
				value = 1 if str(value) in ("1", "true", "True") else 0

			elif field.fieldtype in ("Int", "Float", "Currency", "Percent"):
				try:
					value = (
						float(value) if field.fieldtype in ("Float", "Currency", "Percent") else int(value)
					)
				except ValueError:
					frappe.throw(f"Invalid value for field {fieldname}")

			data_doc.set(fieldname, value)

		# ---------- LOG ACTION DATA (SAFE) ----------
		safe_value = value
		if isinstance(value, list | dict):
			safe_value = json.dumps(value)

		if fieldname in comment_fields:
			wf_action_data["comment"] = safe_value
		else:
			wf_action_data["action_data"].append(
				{
					"fieldname": fieldname,
					"fieldtype": field.fieldtype,
					"value": safe_value,
				}
			)

		updated = True

	# -------------------------------
	# Save document
	# -------------------------------
	if updated:
		data_doc.save()
	wf_action_doc = frappe.new_doc("SVA Workflow Action")
	wf_action_doc.update(wf_action_data)
	wf_action_doc.insert(ignore_permissions=True)

	# -------------------------------
	# Insert workflow action log
	# -------------------------------
	wf_action_doc = frappe.new_doc("SVA Workflow Action")
	wf_action_doc.update(wf_action_data)
	wf_action_doc.insert(ignore_permissions=True)

	# -------------------------------
	# Apply actual workflow
	# -------------------------------
	return original_apply_workflow(
		frappe.as_json(doc),
		action,
	)
