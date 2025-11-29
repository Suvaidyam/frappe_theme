import frappe
from frappe.model.document import Document
from frappe.utils import cint, now


@frappe.whitelist()
def copy_all_permissions(doc):
	create_perms = 0
	update_perms = 0

	doc = frappe.parse_json(doc) if isinstance(doc, str) else doc
	role = doc.get("role_to")

	for perm in doc.get("permissions", []):
		target_doctype = perm.get("reference_doctype")
		permlevel = perm.get("permlevel", 0)

		existing_perms = frappe.db.exists(
			"Custom DocPerm", {"permlevel": permlevel, "role": role, "parent": target_doctype}
		)

		if existing_perms:
			update_perms += 1
			existing_name = frappe.db.get_value(
				"Custom DocPerm", {"role": role, "parent": target_doctype, "permlevel": permlevel}, "name"
			)
			src = frappe.get_doc("Custom DocPerm", existing_name)
			old_perms = get_perm_dict(src)

			if permlevel > 0:
				src.read = cint(perm.get("read", 0))
				src.write = cint(perm.get("write", 0))
			else:
				perm["cancel"] = cint(perm.get("cancel_to", 0))
				perm["submit"] = cint(perm.get("submit_to", 0))
				perm["delete"] = cint(perm.get("delete_to", 0))
				perm["import"] = cint(perm.get("import_to", 0))
				perm["parent"] = perm.get("reference_doctype")

				common = get_common_permissions_from_list("Custom DocPerm", perm)
				for key in common:
					src.set(key, perm[key])
			src.save(ignore_permissions=True)
			log_permission_change(role, target_doctype, permlevel, "update", old_perms, get_perm_dict(src))
		else:
			create_perms += 1
			src = frappe.new_doc("Custom DocPerm")
			src.role = role
			src.parent = target_doctype
			src.permlevel = permlevel

			if permlevel > 0:
				src.read = cint(perm.get("read", 0))
				src.write = cint(perm.get("write", 0))
			else:
				src.set("delete", cint(perm.get("delete_to", 0)))
				src.set("cancel", cint(perm.get("cancel_to", 0)))
				src.set("submit", cint(perm.get("submit_to", 0)))
				src.set("import", cint(perm.get("import_to", 0)))
				perm["parent"] = perm.get("reference_doctype")
				apply_common_permissions(src, perm)
			src.insert(ignore_permissions=True, ignore_mandatory=True)
			log_permission_change(role, target_doctype, permlevel, "create", {}, get_perm_dict(src))

	frappe.db.commit()

	return {
		"status": "success",
		"role_to": role,
		"message": {"Created": create_perms, "Updated": update_perms},
	}


@frappe.whitelist()
def get_all_permissions(role_from):
	all_fields = [
		"name", "parent", "permlevel", "select", "read", "write", "create",
		"delete", "submit", "cancel", "amend", "report", "export",
		"import", "share", "print", "email",
	]
	perms_from = frappe.get_all("Custom DocPerm", {"role": role_from}, all_fields, ignore_permissions=True)
	return {"permissions": perms_from}


@frappe.whitelist()
def compare_role_permissions(role1, role2, show_only_diff=False):
	show_only_diff = cint(show_only_diff)
	all_fields = ["parent", "permlevel", "select", "read", "write", "create",
		"delete", "submit", "cancel", "amend", "report", "export",
		"import", "share", "print", "email"]
	
	perms1 = {f"{p.parent}::{p.permlevel}": p for p in frappe.get_all(
		"Custom DocPerm", {"role": role1}, all_fields, ignore_permissions=True)}
	perms2 = {f"{p.parent}::{p.permlevel}": p for p in frappe.get_all(
		"Custom DocPerm", {"role": role2}, all_fields, ignore_permissions=True)}
	
	result = []
	all_keys = set(perms1.keys()) | set(perms2.keys())
	
	for key in all_keys:
		p1 = perms1.get(key, {})
		p2 = perms2.get(key, {})
		
		has_diff = any(p1.get(f) != p2.get(f) for f in all_fields[2:])
		
		if not show_only_diff or has_diff:
			perm = p1 if p1 else p2
			result.append({
				"reference_doctype": perm.get("parent"),
				"permlevel": perm.get("permlevel", 0),
				"has_difference": 1 if has_diff else 0,
				"select": p1.get("select", 0) if p1 else 0,
				"read": p1.get("read", 0) if p1 else 0,
				"write": p1.get("write", 0) if p1 else 0,
				"create": p1.get("create", 0) if p1 else 0,
				"delete_to": p1.get("delete", 0) if p1 else 0,
				"submit_to": p1.get("submit", 0) if p1 else 0,
				"cancel_to": p1.get("cancel", 0) if p1 else 0,
				"amend": p1.get("amend", 0) if p1 else 0,
				"report": p1.get("report", 0) if p1 else 0,
				"export": p1.get("export", 0) if p1 else 0,
				"import_to": p1.get("import", 0) if p1 else 0,
				"share": p1.get("share", 0) if p1 else 0,
				"print": p1.get("print", 0) if p1 else 0,
				"email": p1.get("email", 0) if p1 else 0,
			})
	
	return result


def get_perm_dict(doc):
	return {f: doc.get(f) for f in ["select", "read", "write", "create", "delete",
		"submit", "cancel", "amend", "report", "export", "import", "share", "print", "email"]}


def log_permission_change(role, doctype, permlevel, action, old_perms, new_perms):
	try:
		frappe.get_doc({
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": "Role",
			"reference_name": role,
			"content": f"Permission {action} for {doctype} (Level {permlevel})"
		}).insert(ignore_permissions=True)
	except:
		pass


def get_common_permissions_from_list(doctype, perms):
	fields = frappe.get_meta(doctype).fields
	fieldnames = [f.fieldname for f in fields if f.fieldname]
	"""
    Compare a list of fields with perms dict,
    return only fields that are common with their values.
    """
	common = {}
	for field in fieldnames:
		if field in perms:  # field exists in perms
			common[field] = perms[field]
	return common


def apply_common_permissions(doc, perms):
	all_fields = ["select", "read", "write", "create", "amend", "report", "export", "share", "print", "email"]
	for field in all_fields:
		setattr(doc, field, perms.get(field, 0))


@frappe.whitelist()
def get_app_list():
	return frappe.get_installed_apps()


@frappe.whitelist()
def get_all_doctypes(app):
	module = frappe.db.get_value("Module Def", {"app_name": app}, "name")
	return frappe.get_all("DocType", filters={"module": module}, fields=["name"])


class CopyRolePerms(Document):
	def before_save(self):
		pass
