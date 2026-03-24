import frappe


def execute():
	"""Ensure custom_approval_stage column exists and backfill from state name where empty."""
	# Add column if it doesn't exist yet (runs before model sync)
	if not frappe.db.has_column("Workflow Document State", "custom_approval_stage"):
		frappe.db.sql(
			"""
			ALTER TABLE `tabWorkflow Document State`
			ADD COLUMN `custom_approval_stage` varchar(140) DEFAULT NULL
		"""
		)

	frappe.db.sql(
		"""
		UPDATE `tabWorkflow Document State`
		SET custom_approval_stage = state
		WHERE custom_approval_stage IS NULL OR custom_approval_stage = ''
	"""
	)
	frappe.db.commit()
