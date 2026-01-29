import frappe
from frappe import _


@frappe.whitelist()
def get_workflow_audit(doctype=None, reference_name=None, limit=100):
	"""
	Get workflow audit trail for a doctype or specific document
	Includes complete workflow state sequence from Workflow definition

	Args:
	    doctype (str): The document type to audit
	    reference_name (str, optional): Specific document name
	    limit (int, optional): Maximum number of actions to return
	"""
	try:
		# Validate inputs
		if not doctype:
			return {"success": False, "message": "DocType is required"}

		# Validate doctype
		if not frappe.db.exists("DocType", doctype):
			return {"success": False, "message": f"DocType '{doctype}' does not exist"}

		# Get active workflow
		workflow = frappe.get_all(
			"Workflow",
			filters={"document_type": doctype, "is_active": 1},
			fields=["name", "workflow_state_field"],
			limit=1,
		)

		if not workflow:
			return {"success": False, "message": f"No active workflow found for DocType '{doctype}'"}

		workflow_name = workflow[0].name

		# Get workflow state sequence based on transition rules
		workflow_states = get_workflow_state_sequence(workflow_name)

		# Get current document workflow state if reference_name provided
		current_doc_state = None
		if reference_name:
			if not frappe.db.exists(doctype, reference_name):
				return {"success": False, "message": f"Document '{reference_name}' does not exist"}

			# Get workflow_state from document
			doc = frappe.get_doc(doctype, reference_name)
			current_doc_state = doc.get(workflow[0].workflow_state_field)

		# Build filters
		filters = {"reference_doctype": doctype}
		if reference_name:
			filters["reference_name"] = reference_name

		dt_meta = frappe.get_meta(doctype)
		field_label_map = {df.fieldname: df.label for df in dt_meta.fields}
		field_meta_map = {df.fieldname: df for df in dt_meta.fields}

		# Fetch workflow actions
		actions = frappe.get_all(
			"SVA Workflow Action",
			filters=filters,
			fields=[
				"name",
				"reference_name",
				"workflow_state_previous",
				"workflow_state_current",
				"workflow_action",
				"user",
				"role",
				"comment",
				"creation",
				"modified",
			],
			order_by="creation desc",
			limit=limit,
		)

		# Enrich with action data (dialog fields)
		if len(actions):
			for action in actions:
				action_data = frappe.get_all(
					"SVA Workflow Action Data Child",
					filters={"parent": action.name},
					fields=["fieldname", "fieldtype", "value"],
					order_by="idx asc",
				)
				approval_assignments = frappe.get_all(
					"Approval Assignment Child",
					filters={"parent": action.name, "parenttype": "SVA Workflow Action"},
					fields=["user", "action", "comment", "assignment_remark", "name"],
					order_by="idx asc",
				)
				# Process each field value
				for item in action_data:
					fieldname = item.get("fieldname")
					fieldtype = item.get("fieldtype")
					value = item.get("value")

					# Get label from field meta
					item["label"] = field_label_map.get(fieldname)

					# Get field meta for this field
					field_meta = field_meta_map.get(fieldname)

					if not field_meta or not value:
						continue

					# Handle Link field
					if fieldtype == "Link" and field_meta.options:
						link_doctype = field_meta.options
						item["reference_doctype"] = link_doctype
						item["value"] = get_link_title(link_doctype, value)

					# Handle Dynamic Link field
					elif fieldtype == "Dynamic Link" and field_meta.options:
						# options field contains the fieldname that stores the doctype
						link_doctype_field = field_meta.options
						# Get the doctype value from the parent document
						if reference_name:
							parent_doc = frappe.get_doc(doctype, reference_name)
							link_doctype = parent_doc.get(link_doctype_field)
							if link_doctype:
								item["reference_doctype"] = link_doctype
								item["value"] = get_link_title(link_doctype, value)

					# Handle Table MultiSelect field
					elif fieldtype == "Table MultiSelect" and field_meta.options:
						link_doctype = field_meta.options
						item["reference_doctype"] = link_doctype
						# Value is comma-separated IDs
						if value:
							ids = [v.strip() for v in value.split(",") if v.strip()]
							titles = [get_link_title(link_doctype, id_val) for id_val in ids]
							item["value"] = ", ".join(titles)

					# Handle Multiselect with link references (if any)
					elif fieldtype == "MultiSelect":
						# Usually stores display values, not IDs
						# But check if options suggest it's a link
						pass

				# Process approval assignments into label/value pairs
				approval_assignment_meta = frappe.get_meta("Approval Assignment Child")
				approval_field_label_map = {df.fieldname: df.label for df in approval_assignment_meta.fields}
				approval_field_meta_map = {df.fieldname: df for df in approval_assignment_meta.fields}

				processed_assignments = []
				for assignment in approval_assignments:
					assignment_fields = []
					# Process each field in the assignment
					for fieldname in ["user", "action", "comment", "assignment_remark"]:
						value = assignment.get(fieldname)
						# if value is None:
						# 	continue

						field_meta = approval_field_meta_map.get(fieldname)
						# if not field_meta:
						# 	continue

						label = approval_field_label_map.get(fieldname, fieldname)
						fieldtype = field_meta.fieldtype

						field_data = {
							"label": label,
							"value": value,
							"fieldname": fieldname,
							"fieldtype": fieldtype,
						}

						# Handle Link field (user field)
						if fieldtype == "Link" and field_meta.options:
							link_doctype = field_meta.options
							field_data["reference_doctype"] = link_doctype
							field_data["value"] = get_link_title(link_doctype, value)

						assignment_fields.append(field_data)

					processed_assignments.append(
						{"name": assignment.get("name"), "fields": assignment_fields}
					)

				action["approval_assignments"] = processed_assignments
				action["action_data"] = action_data

		return {
			"success": True,
			"workflow": workflow_name,
			"workflow_states": workflow_states,
			"current_doc_state": current_doc_state,
			"doctype": doctype,
			"reference_name": reference_name,
			"total_actions": len(actions),
			"actions": actions,
			"type": "action_taken" if len(actions) else "no_action",
		}

	except Exception as e:
		frappe.log_error(f"Workflow Audit Error: {str(e)}", "Workflow Audit API")
		return {"success": False, "message": str(e)}


def get_link_title(doctype, name):
	"""
	Get the title/display name for a linked document

	Args:
	    doctype (str): The DocType
	    name (str): The document name/ID

	Returns:
	    str: The title or name
	"""
	try:
		if not doctype or not name:
			return name

		# Check if document exists
		if not frappe.db.exists(doctype, name):
			return name

		# Get meta for the doctype
		meta = frappe.get_meta(doctype)

		# Try to get title field
		title_field = meta.get_title_field()

		if title_field and title_field != "name":
			title = frappe.db.get_value(doctype, name, title_field)
			return title or name

		return name

	except Exception as e:
		frappe.log_error(f"Get Link Title Error for {doctype} - {name}: {str(e)}", "Link Title Fetch")
		return name


@frappe.whitelist()
def get_workflow_state_sequence(workflow_name):
	"""
	Get the sequence of workflow states based on transition rules
	Returns a list of states in the order they should appear in the workflow

	Args:
	    workflow_name (str): Name of the workflow

	Returns:
	    list: List of workflow states in sequence
	"""
	try:
		# Get workflow document
		workflow_doc = frappe.get_doc("Workflow", workflow_name)

		# Get all states from workflow
		all_states = []
		state_dict = {}

		for state in workflow_doc.states:
			state_info = {
				"state": state.state,
				"doc_status": state.doc_status,
				"is_optional": state.is_optional_state or 0,
			}
			all_states.append(state_info)
			state_dict[state.state] = state_info

		# Build transition graph
		transitions = {}
		for transition in workflow_doc.transitions:
			from_state = transition.state
			to_state = transition.next_state

			if from_state not in transitions:
				transitions[from_state] = []

			transitions[from_state].append(
				{"to_state": to_state, "action": transition.action, "allowed": transition.allowed}
			)

		# Find the initial state (state with doc_status = 0 or first state)
		initial_state = None
		for state in all_states:
			if state["doc_status"] == 0:
				initial_state = state["state"]
				break

		if not initial_state and all_states:
			initial_state = all_states[0]["state"]

		# Build a logical sequence (simplified approach)
		# This creates a sequence based on common workflow patterns
		sequence = []
		visited = set()

		def add_state_sequence(state, depth=0):
			"""Recursively build state sequence"""
			if depth > 20 or state in visited:  # Prevent infinite loops
				return

			if state not in state_dict:
				return

			visited.add(state)
			sequence.append(
				{
					"state": state,
					"doc_status": state_dict[state]["doc_status"],
					"is_optional": state_dict[state]["is_optional"],
				}
			)

			# Get next states from transitions
			if state in transitions:
				for trans in transitions[state]:
					next_state = trans["to_state"]
					if next_state not in visited:
						add_state_sequence(next_state, depth + 1)

		# Start from initial state
		if initial_state:
			add_state_sequence(initial_state)

		# Add any remaining states that weren't visited
		for state in all_states:
			if state["state"] not in visited:
				sequence.append(state)

		return sequence

	except Exception as e:
		frappe.log_error(f"Get Workflow Sequence Error: {str(e)}", "Workflow State Sequence")
		return []
