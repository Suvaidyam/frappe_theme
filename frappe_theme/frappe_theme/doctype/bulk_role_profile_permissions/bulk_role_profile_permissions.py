# Copyright (c) 2025, Frappe Theme and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class BulkRoleProfilePermissions(Document):
	pass


@frappe.whitelist()
def get_role_profiles_with_roles(doctype_name=None):
	"""
	Get all Role Profiles and their assigned Roles
	If doctype_name is provided, also fetch existing permissions for that DocType
	Returns a list of dictionaries with role_profile, role, and existing permissions
	"""
	role_profiles = frappe.get_all("Role Profile", fields=["name"], order_by="name")

	result = []

	# Get existing permissions for the doctype if provided
	existing_perms = {}
	if doctype_name:
		# Check Custom DocPerm first
		custom_perms = frappe.get_all(
			"Custom DocPerm",
			filters={"parent": doctype_name},
			fields=[
				"role",
				"permlevel",
				"select",
				"read",
				"write",
				"create",
				"delete",
				"submit",
				"cancel",
				"amend",
				"report",
				"export",
				"import",
				"share",
				"print",
				"email",
			],
		)

		for perm in custom_perms:
			key = f"{perm.role}::{perm.permlevel}"
			existing_perms[key] = perm

		# If no custom perms, check standard DocPerm
		if not existing_perms:
			standard_perms = frappe.get_all(
				"DocPerm",
				filters={"parent": doctype_name},
				fields=[
					"role",
					"permlevel",
					"select",
					"read",
					"write",
					"create",
					"delete",
					"submit",
					"cancel",
					"amend",
					"report",
					"export",
					"import",
					"share",
					"print",
					"email",
				],
			)

			for perm in standard_perms:
				key = f"{perm.role}::{perm.permlevel}"
				existing_perms[key] = perm

	# Roles to skip
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
				# Skip specific roles
				if role.role in skip_roles:
					continue

				# Check if this role has existing permissions
				perm_key = f"{role.role}::0"  # Default to permlevel 0
				existing_perm = existing_perms.get(perm_key, {})

				result.append(
					{
						"role_profile": rp.name,
						"role": role.role,
						"permlevel": existing_perm.get("permlevel", 0),
						"select": existing_perm.get("select", 0),
						"read": existing_perm.get("read", 0),
						"write": existing_perm.get("write", 0),
						"create": existing_perm.get("create", 0),
						"delete": existing_perm.get("delete", 0),
						"submit": existing_perm.get("submit", 0),
						"cancel": existing_perm.get("cancel", 0),
						"amend": existing_perm.get("amend", 0),
						"report": existing_perm.get("report", 0),
						"export": existing_perm.get("export", 0),
						"import": existing_perm.get("import", 0),
						"share": existing_perm.get("share", 0),
						"print": existing_perm.get("print", 0),
						"email": existing_perm.get("email", 0),
					}
				)

	return result


@frappe.whitelist()
def apply_bulk_permissions(doc):
	"""
	Apply permissions to the selected DocType for all role profiles and roles
	"""
	if isinstance(doc, str):
		import json

		doc = json.loads(doc)

	doctype_name = doc.get("doctype_name")
	role_profiles = doc.get("role_profiles", [])

	if not doctype_name:
		frappe.throw(_("DocType is required"))

	if not role_profiles:
		frappe.throw(_("No Role Profiles selected"))

	created = 0
	updated = 0

	for row in role_profiles:
		role = row.get("role")
		permlevel = row.get("permlevel", 0)

		if not role:
			continue

		# Check if permission already exists
		existing_perm = frappe.db.get_value(
			"Custom DocPerm", {"parent": doctype_name, "role": role, "permlevel": permlevel}, "name"
		)

		if existing_perm:
			# Update existing permission
			perm_doc = frappe.get_doc("Custom DocPerm", existing_perm)
			update_permission_fields(perm_doc, row)
			perm_doc.save(ignore_permissions=True)
			updated += 1
		else:
			# Create new permission
			perm_doc = frappe.new_doc("Custom DocPerm")
			perm_doc.parent = doctype_name
			perm_doc.parenttype = "DocType"
			perm_doc.parentfield = "permissions"
			perm_doc.role = role
			perm_doc.permlevel = permlevel
			update_permission_fields(perm_doc, row)
			perm_doc.insert(ignore_permissions=True)
			created += 1

	# Clear cache
	frappe.clear_cache(doctype=doctype_name)

	return {"created": created, "updated": updated}


def update_permission_fields(perm_doc, row):
	"""
	Update permission document with values from row
	"""
	# Only set permlevel 0 permissions if permlevel is 0
	if row.get("permlevel", 0) == 0:
		perm_doc.select = row.get("select", 0)
		perm_doc.create = row.get("create", 0)
		perm_doc.delete = row.get("delete", 0)
		perm_doc.submit = row.get("submit", 0)
		perm_doc.cancel = row.get("cancel", 0)
		perm_doc.amend = row.get("amend", 0)
		perm_doc.report = row.get("report", 0)
		perm_doc.export = row.get("export", 0)
		perm_doc.set_user_permissions = row.get("import", 0)  # import maps to set_user_permissions
		perm_doc.share = row.get("share", 0)
		perm_doc.print = row.get("print", 0)
		perm_doc.email = row.get("email", 0)

	# These are available at all permission levels
	perm_doc.read = row.get("read", 0)
	perm_doc.write = row.get("write", 0)
