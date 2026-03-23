import frappe


def execute():
	"""Set custom_approval_stage to state name for all existing Workflow Document States where it is empty."""
	frappe.db.sql("""
		UPDATE `tabWorkflow Document State`
		SET custom_approval_stage = state
		WHERE custom_approval_stage IS NULL OR custom_approval_stage = ''
	""")
	frappe.db.commit()
