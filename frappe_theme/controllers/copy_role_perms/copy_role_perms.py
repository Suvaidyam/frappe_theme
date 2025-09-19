
import frappe
from frappe.model.document import Document
from frappe.utils import cint


@frappe.whitelist()
def copy_all_permissions(doc):
    create_perms=0
    update_perms=0

    doc = frappe.parse_json(doc) if isinstance(doc, str) else doc
    role = doc.get("role_to")

    for perm in doc.get("permissions", []):
        target_doctype = perm.get("reference_doctype")
        permlevel = perm.get("permlevel", 0)
        
        existing_perms = frappe.db.exists("Custom DocPerm", {
            "permlevel": permlevel,
            "role": role,
            "parent": target_doctype
        })

        if existing_perms:
            update_perms += 1
            existing_name = frappe.db.get_value(
            "Custom DocPerm",
            {"role": role, "parent": target_doctype, "permlevel": permlevel},
            "name"
            )
            src = frappe.get_doc("Custom DocPerm", existing_name)

            perm["cancel"] = cint(perm.get("cancel_to", 0))
            perm["submit"] = cint(perm.get("submit_to", 0))
            perm["delete"] = cint(perm.get("delete_to", 0))
            perm["import"] = cint(perm.get("import_to", 0))
            perm["parent"] = perm.get("reference_doctype")
            
            common = get_common_permissions_from_list("Custom DocPerm", perm)

            for key in common:
                src.set(key, perm[key])
            src.save(ignore_permissions=True)

        else:
            create_perms += 1
            src = frappe.new_doc("Custom DocPerm")
            src.role = role
            src.parent = target_doctype
            src.permlevel = permlevel
            src.set("delete", cint(perm.get("delete_to", 0)))
            src.set("cancel", cint(perm.get("cancel_to", 0)))
            src.set("submit", cint(perm.get("submit_to", 0)))
            src.set("import", cint(perm.get("import_to", 0)))
            perm["parent"] = perm.get("reference_doctype")

            apply_common_permissions(src, perm)
            src.insert(ignore_permissions=True, ignore_mandatory=True)

    frappe.db.commit()
    
    return {"status": "success", "role_to": role, "message":{"Created": create_perms, "Updated": update_perms}}


@frappe.whitelist()
def get_all_permissions(role_from):
    all_fields = ['name', 'parent', 'permlevel','select', 'read', 'write', 'create', 'delete', 'submit', 'cancel',
                  'amend', 'report', 'export', 'import', 'share', 'print', 'email']
    perms_from = frappe.get_all('Custom DocPerm', {'role': role_from}, all_fields, ignore_permissions=True)
    
    return {"permissions": perms_from}

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
    all_fields = ['select', 'read', 'write', 'create', 
                  'amend', 'report', 'export',  'share', 'print', 'email']
    for field in all_fields:
        setattr(doc, field, perms.get(field, 0))


class CopyRolePerms(Document):
    
    def before_save(self):
        pass