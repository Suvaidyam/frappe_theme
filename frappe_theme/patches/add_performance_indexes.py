import frappe


def execute():
	"""Add missing DB indexes for hot-path queries. Idempotent — checks before altering."""
	for table, index_name, ddl in [
		# tabUser Permission — apply_permissions_for_non_standard_user_type fires on every
		# doc_events["*"]["on_update"] and queries WHERE allow=? AND for_value=? with no index
		# on either column. Causes full table scans across ~16k Cadre/Field Cadre user rows.
		(
			"tabUser Permission",
			"allow",
			"ALTER TABLE `tabUser Permission` ADD INDEX `allow` (`allow`(140))",
		),
		(
			"tabUser Permission",
			"for_value",
			"ALTER TABLE `tabUser Permission` ADD INDEX `for_value` (`for_value`(140))",
		),
		# tabWorkspace — get_workspace_sidebar_items filters WHERE module NOT IN [...] on every
		# desk page load. restrict_to_domain is indexed; module is not.
		(
			"tabWorkspace",
			"module",
			"ALTER TABLE `tabWorkspace` ADD INDEX `module` (`module`(140))",
		),
		# tabEmployee — frappe.db.get_value("Employee", {"user_id": session.user}) fires on
		# every attendance calendar load with no index on user_id.
		(
			"tabEmployee",
			"user_id",
			"ALTER TABLE `tabEmployee` ADD INDEX `user_id` (`user_id`(140))",
		),
	]:
		existing = frappe.db.sql(
			"SHOW INDEX FROM `%s` WHERE Key_name = %%s" % table, index_name
		)
		if not existing:
			frappe.db.sql_ddl(ddl)

	frappe.db.commit()
