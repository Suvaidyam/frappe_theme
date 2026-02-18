import json
from typing import Union

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.workflow import apply_workflow as original_apply_workflow
from frappe.model.workflow import get_transitions, get_workflow, get_workflow_name, get_workflow_state_field
from frappe.utils import getdate
from frappe.workflow.doctype.workflow.workflow import Workflow


@frappe.whitelist()
def get_custom_transitions(
	doc: Union["Document", str, dict], workflow: "Workflow" = None, raise_exception: bool = False
) -> list[dict]:
	"""
	Override get_transitions to handle custom approval assignments.
	Returns empty list if approval assignments exist (to hide regular workflow actions).
	"""
	doc = frappe.get_doc(frappe.parse_json(doc))
	doc.load_from_db()

	if not workflow:
		workflow_name = get_workflow_name(doc.doctype)
		if not workflow_name:
			return get_transitions(doc, workflow, raise_exception)
		workflow = get_workflow(doc.doctype)

	workflow_state_field = (
		workflow.workflow_state_field if workflow is not None else get_workflow_state_field(workflow_name)
	)
	if not workflow_state_field:
		return get_transitions(doc, workflow, raise_exception)

	current_state = doc.get(workflow_state_field)
	if not current_state:
		return get_transitions(doc, workflow, raise_exception)

	custom_workflow_doc = _get_custom_workflow_doc(doc, current_state)
	if not custom_workflow_doc or not len(custom_workflow_doc.approval_assignments):
		return get_transitions(doc, workflow, raise_exception)

	user = frappe.session.user
	sva_user = frappe.db.get_value("SVA User", {"email": user}, "name")
	user_assignments = [
		row
		for row in (custom_workflow_doc.approval_assignments or [])
		if (row.user == sva_user or user == "Administrator") and row.action == "Pending"
	]
	if user_assignments and len(user_assignments) > 0:
		custom_transitions = make_custom_transitions(custom_workflow_doc)
		return custom_transitions
	else:
		return get_transitions(doc, workflow, raise_exception)


def make_custom_transitions(custom_workflow_doc):
	custom_transitions = []
	custom_transitions.append(
		{
			"state": custom_workflow_doc.workflow_state_current,
			"action": "Approve",
			"next_state": custom_workflow_doc.workflow_state_current,
			"allow_self_approval": 1,
			"send_email_to_creator": 0,
			"allowed": "All",
			"is_custom_transition": 1,
			"is_comment_required": 1,
		}
	)
	custom_transitions.append(
		{
			"state": custom_workflow_doc.workflow_state_current,
			"action": "Reject",
			"next_state": custom_workflow_doc.workflow_state_current,
			"allowed": "All",
			"allow_self_approval": 1,
			"send_email_to_creator": 0,
			"is_custom_transition": 1,
			"is_comment_required": 1,
		}
	)
	return custom_transitions


def _get_workflow_state_info(doc):
	"""Helper function to get workflow and current state info"""
	workflow = get_workflow(doc.doctype)
	if not workflow:
		return None, None, None

	workflow_state_field = get_workflow_state_field(workflow.name)
	current_state = doc.get(workflow_state_field)

	return workflow, workflow_state_field, current_state


def _get_custom_workflow_doc(doc, current_state):
	"""Helper function to get SVA Workflow Action document"""
	custom_workflow_doc_name = frappe.db.get_value(
		"SVA Workflow Action",
		{
			"reference_doctype": doc.doctype,
			"reference_name": doc.name,
			"workflow_state_current": current_state,
		},
		"name",
		order_by="creation desc",
	)

	if not custom_workflow_doc_name:
		return None

	return frappe.get_doc("SVA Workflow Action", custom_workflow_doc_name)


def _get_user_assignment(custom_workflow_doc, user, sva_user):
	"""Helper function to find user's assignment"""
	user_assignment = None

	if user == "Administrator":
		# Administrator can see any pending assignment
		for assignment in custom_workflow_doc.approval_assignments:
			if assignment.action == "Pending":
				user_assignment = assignment
				break
	else:
		# Regular users: find their specific assignment
		for assignment in custom_workflow_doc.approval_assignments:
			if sva_user and assignment.user == sva_user:
				user_assignment = assignment
				break

	return user_assignment


def _get_custom_transition_data(workflow, current_state):
	"""Helper function to get transition data with custom_allow_assignment = 1"""
	return frappe.db.get_value(
		"Workflow Transition",
		{
			"parent": workflow.name,
			"next_state": current_state,
			"custom_allow_assignment": 1,
		},
		[
			"name",
			"action",
			"state",
			"next_state",
			"custom_allow_assignment",
			"custom_positive_state",
			"custom_negative_state",
			"custom_comment",
			"custom_comment_required",
			"allowed",
		],
		as_dict=True,
	)


def _get_next_state(custom_workflow_doc, current_state, transition):
	"""Helper function to get next state based on transition data"""
	if not transition:
		return current_state
	assignments = custom_workflow_doc.approval_assignments
	required_assignments = [a for a in assignments if a.required]

	has_required = bool(required_assignments)

	has_required_rejected = any(a.action == "Rejected" for a in required_assignments)
	has_any_pending = any(a.action == "Pending" for a in assignments)
	has_any_approved = any(a.action == "Approved" for a in assignments)
	has_any_rejected = any(a.action == "Rejected" for a in assignments)

	all_required_approved = (
		all(a.action == "Approved" for a in required_assignments) if required_assignments else False
	)

	all_assignments_rejected = has_any_rejected and not has_any_pending and not has_any_approved

	if all_assignments_rejected:
		return transition.get("custom_negative_state") or current_state

	if has_required:
		if has_required_rejected:
			next_state = transition.get("custom_negative_state") or current_state

		elif has_any_pending:
			next_state = current_state

		elif all_required_approved:
			next_state = transition.get("custom_positive_state") or transition.get("next_state")

		else:
			next_state = current_state

	else:
		if has_any_pending:
			next_state = current_state

		elif has_any_approved:
			next_state = transition.get("custom_positive_state") or transition.get("next_state")

		else:
			next_state = transition.get("custom_negative_state") or current_state

	return next_state


@frappe.whitelist()
def handle_custom_approval_action(doc, action, custom_comment=""):
	"""
	Handle custom approval action (Approve/Reject) for users in approval_assignments.
	"""
	# Parse incoming doc
	doc = frappe.get_doc(frappe.parse_json(doc))
	doc.load_from_db()

	user = frappe.session.user
	sva_user = frappe.db.get_value("SVA User", {"email": user}, "name")

	# Get workflow info
	workflow, workflow_state_field, current_state = _get_workflow_state_info(doc)
	if not workflow:
		frappe.throw(_("No workflow found for this document"))

	# Get custom workflow doc
	custom_workflow_doc = _get_custom_workflow_doc(doc, current_state)
	if not custom_workflow_doc:
		frappe.throw(_("No active workflow action found for this document"))

	# Find the user's assignment
	user_assignment = _get_user_assignment(custom_workflow_doc, user, sva_user)
	if not user_assignment:
		frappe.throw(_("You are not assigned to approve this document"))

	# Check if user has already taken action
	if user_assignment.action in ["Approved", "Rejected"]:
		frappe.throw(_("You have already taken action on this assignment"))

	# Get transition data
	transition_data = _get_custom_transition_data(workflow, current_state)
	if not transition_data:
		frappe.throw(_("No valid transition found for custom approval"))

	transition = transition_data

	# Update the assignment
	valid_actions = {"Approve": "Approved", "Reject": "Rejected"}
	if action not in valid_actions:
		frappe.throw(_("Invalid workflow action: {0}").format(action))
	user_assignment.action = valid_actions[action]
	if custom_comment:
		user_assignment.comment = custom_comment

	next_state = _get_next_state(custom_workflow_doc, current_state, transition)
	# Update the custom workflow doc
	custom_workflow_doc.save(ignore_permissions=True)

	if next_state != current_state:
		frappe.db.set_value(doc.doctype, doc.name, workflow_state_field, next_state, update_modified=False)
		doc.reload()
		# Create workflow action log if all custom approval assignments are approved
		sva_wf_action_data = {
			"workflow_action": action,
			"action_data": [],
			"reference_doctype": doc.doctype,
			"reference_name": doc.name,
			"workflow_state_previous": current_state,
			"workflow_state_current": next_state,
			"role": transition.allowed,
			"user": user,
		}
		sva_wf_action_doc = frappe.new_doc("SVA Workflow Action")
		sva_wf_action_doc.update(sva_wf_action_data)
		sva_wf_action_doc.insert(ignore_permissions=True, ignore_mandatory=True)

	return doc


@frappe.whitelist()
def custom_apply_workflow(doc, action, is_custom_transition=0, is_comment_required=0, custom_comment=""):
	doc = frappe.parse_json(doc)

	if is_custom_transition in (1, "1", True):
		return handle_custom_approval_action(doc, action, custom_comment)

	selected_transition = _get_selected_transition(doc, action)

	required_fields = _get_action_and_required_fields(doc, selected_transition)

	wf_dialog_fields = _validate_dialog_fields(required_fields, doc)

	data_doc, meta = _load_document(doc)

	wf_action_data = _prepare_workflow_action_log(doc, action, selected_transition)

	updated = _apply_dialog_values(
		wf_dialog_fields, data_doc, meta, selected_transition, is_comment_required, wf_action_data
	)

	if updated:
		data_doc.save()

	_insert_workflow_action_log(wf_action_data)

	return original_apply_workflow(
		frappe.as_json(doc),
		action,
	)


def _get_selected_transition(doc, action):
	workflow = get_workflow(doc.doctype)
	transitions = get_transitions(doc, workflow)

	selected_transition = next(
		(t for t in (transitions or []) if t.action == action),
		None,
	)

	if not selected_transition:
		frappe.throw(f"Invalid workflow action: {action}")

	return selected_transition


def _get_action_and_required_fields(doc, selected_transition):
	action_fields = json.loads(selected_transition.custom_selected_fields or "[]")

	if selected_transition.custom_allow_assignment:
		action_fields.append(
			{
				"fieldname": "approval_assignments",
				"label": "Approval Assignments",
				"read_only": False,
				"reqd": True,
				"fetch_if_exists": False,
			}
		)

	if selected_transition.custom_comment:
		action_fields.append(
			{
				"fieldname": "wf_comment",
				"label": "Comment",
				"read_only": False,
				"reqd": True if selected_transition.custom_comment_required else False,
				"fetch_if_exists": False,
			}
		)

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
				"value": selected_transition.action,
			},
			ignore_permissions=True,
		)
		required_fields = [{"fieldname": p["field_name"], "label": p["field_name"]} for p in props]

	return required_fields


def _validate_dialog_fields(required_fields, doc):
	wf_dialog_fields = doc.get("wf_dialog_fields") or {}

	if required_fields:
		missing = [f for f in required_fields if not wf_dialog_fields.get(f["fieldname"])]
		if missing:
			field_list = "".join(f"<li>{f['label']}</li>" for f in missing)
			frappe.throw("Required workflow data is missing or incomplete." f"<br><ul>{field_list}</ul>")

	return wf_dialog_fields


def _load_document(doc):
	data_doc = frappe.get_doc(doc.doctype, doc.name)
	meta = frappe.get_meta(doc.doctype)
	return data_doc, meta


def _prepare_workflow_action_log(doc, action, selected_transition):
	return {
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


def _apply_dialog_values(
	wf_dialog_fields, data_doc, meta, selected_transition, is_comment_required, wf_action_data
):
	comment_fields = [
		"custom_comment",
		"custom_wf_comment",
		"wf_comment",
		"comment",
	]

	updated = False

	for fieldname, raw_value in wf_dialog_fields.items():
		if raw_value is None:
			continue

		if (
			fieldname == "wf_comment"
			and selected_transition.custom_comment
			and is_comment_required in (0, "0", False)
		):
			wf_action_data["comment"] = raw_value

		if fieldname == "approval_assignments" and selected_transition.custom_allow_assignment:
			wf_action_data.setdefault("approval_assignments", [])

			if isinstance(raw_value, dict):
				raw_value = [raw_value]
			elif isinstance(raw_value, str):
				try:
					raw_value = frappe.parse_json(raw_value)
				except Exception:
					raw_value = []

			for row in raw_value:
				if isinstance(row, dict):
					row.pop("__islocal", None)
					row.pop("name", None)
					wf_action_data["approval_assignments"].append(row)

		field = meta.get_field(fieldname)
		if not field:
			continue

		value = raw_value

		if field.fieldtype in ("Table", "Table MultiSelect"):
			if not isinstance(value, list):
				frappe.throw(f"{fieldname} must be a list")

			data_doc.set(fieldname, [])
			for row in value:
				if isinstance(row, dict):
					data_doc.append(fieldname, row)

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

		safe_value = value
		if isinstance(value, (list | dict)):
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

	return updated


def _insert_workflow_action_log(wf_action_data):
	wf_action_doc = frappe.new_doc("SVA Workflow Action")
	wf_action_doc.update(wf_action_data)
	wf_action_doc.insert(ignore_permissions=True)
