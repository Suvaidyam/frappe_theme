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

				action["action_data"] = action_data
				action["dialog_values"] = {
					item["fieldname"]: {"value": item["value"], "fieldtype": item["fieldtype"]}
					for item in action_data
				}

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
