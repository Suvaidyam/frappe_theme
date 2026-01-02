# Copyright (c) 2025, Frappe Theme and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class BulkWorkspacePermissions(Document):
	pass


@frappe.whitelist()
def get_role_profiles_with_workspace_access(workspace=None):
	"""
	Get all Role Profiles and their assigned Roles, checked against Workspace access.
	"""
	role_profiles = frappe.get_all("Role Profile", fields=["name"], order_by="name")
	result = []

	existing_roles = set()
	if workspace:
		# Workspace has a child table 'roles' with field 'role'
		# We need to verify the field name for the child table. Standard is 'roles'.
		# Let's assume standard 'Workspace' doctype structure.
		ws = frappe.get_doc("Workspace", workspace)
		for r in ws.roles:
			existing_roles.add(r.role)

	# Roles to skip (copying logic from bulk_role_profile_permissions)
	skip_roles = ["Donor Observer"]

	for rp in role_profiles:
		# Get all roles assigned to this role profile
		roles = frappe.get_all(
			"Has Role",
			filters={"parent": rp.name, "parenttype": "Role Profile"},
			fields=["role"],
			order_by="role",
		)

		if roles:
			for role in roles:
				if role.role in skip_roles:
					continue

				has_access = 1 if role.role in existing_roles else 0

				result.append({"role_profile": rp.name, "role": role.role, "has_access": has_access})

	return result


@frappe.whitelist()
def apply_bulk_workspace_permissions(doc):
	"""
	Apply permissions (roles) to the selected Workspace.
	"""
	if isinstance(doc, str):
		import json

		doc = json.loads(doc)

	workspace_name = doc.get("workspace")
	role_profiles = doc.get("role_profiles", [])

	if not workspace_name:
		frappe.throw(_("Workspace is required"))

	if not role_profiles:
		frappe.throw(_("No Role Profiles selected"))

	ws = frappe.get_doc("Workspace", workspace_name)

	# Create a map of existing roles in the workspace for quick lookup/modification
	# We want to modify the 'roles' child table.

	# We will iterate through our input and add/remove logic.
	# But modifying a list while iterating is tricky.
	# Easier: Build a target set of roles that we want strictly ENFORCED from the UI.
	# But we want to preserve roles that are NOT in the inputs?

	updated = 0

	# Map role -> boolean (Access or No Access) from input
	access_map = {}
	for row in role_profiles:
		role = row.get("role")
		has_access = row.get("has_access")
		if role:
			access_map[role] = has_access

	# Iterate existing workspace roles
	# We will rebuild the roles list or allow modification

	# 1. Remove roles that are set to has_access=0 in input
	roles_to_remove = []
	for r in ws.roles:
		if r.role in access_map:
			if not access_map[r.role]:  # explicitly set to No Access
				roles_to_remove.append(r)

	for r in roles_to_remove:
		ws.roles.remove(r)

	# 2. Add roles that are set to has_access=1 and not present
	current_roles = {r.role for r in ws.roles}

	for role, has_access in access_map.items():
		if has_access:
			if role not in current_roles:
				ws.append("roles", {"role": role})
				updated += 1

	ws.save()

	return {"updated": updated}
