import json
import frappe
# from frappe.model.document import Document
from frappe.model.document import Document
# from frappe_theme.frappe_theme.doctype.copy_role_perms.copy_role_perms import CopyRolePerms

import frappe
from frappe.utils.data import cint

@frappe.whitelist()
def copy_all_permissions(doc):
    doc = frappe.parse_json(doc) if isinstance(doc, str) else doc
    
    for perm in doc.get("permissions", []):
        role = doc.get("role_to")
        target_doctype = perm.get("reference_doctype")

        exists = is_exists_perms(role, target_doctype)

        existing_name = frappe.db.get_value(
            "Custom DocPerm",
            {"role": role, "parent": target_doctype},
            "name"
        )
        print("Existing Name: ", existing_name,exists)

        if exists :
        # ✅ Update existing record
            src = frappe.get_doc("Custom DocPerm", existing_name)

            # Update fields from perm
            src.update(perm)

            # Explicit fields
            # src.set("create", cint(perm.get("create", 0)))
            # src.set("delete", cint(perm.get("delete_to", 0)))
            # src.set("cancel", cint(perm.get("cancel_to", 0)))
            # src.set("submit", cint(perm.get("submit_to", 0)))
            # src.set("import", cint(perm.get("import_to", 0)))

            apply_common_permissions(src, perm)

            # Save update
            src.save(ignore_permissions=True)

        else:
            print("???????????????????????gggggggggggggggggususuuuuuuuuuuu????????????????????????????????????????????")
            # ✅ Create new record
            src = frappe.new_doc("Custom DocPerm")
            src.role = role
            src.parent = target_doctype
            src.update(perm)

            src.set("delete", cint(perm.get("delete_to", 0)))
            src.set("cancel", cint(perm.get("cancel_to", 0)))
            src.set("submit", cint(perm.get("submit_to", 0)))
            src.set("import", cint(perm.get("import_to", 0)))

            apply_common_permissions(src, perm)
            src.insert(ignore_permissions=True, ignore_mandatory=True)

    frappe.db.commit()
    return {"status": "success", "role_to": doc.get("role_to")}



  
def is_exists_perms(role, doctype):
    existing_perms = frappe.db.exists("Custom DocPerm", {
        "role": role,
        "parent": doctype
    })
    return bool(existing_perms)



@frappe.whitelist()
def get_all_permissions(role_from):
    # fields = ['name', 'parent', 'permlevel']
    all_fields = ['name', 'parent', 'permlevel','select', 'read', 'write', 'create', 'delete', 'submit', 'cancel',
                  'amend', 'report', 'export', 'import', 'share', 'print', 'email']
    perms_from = frappe.get_all('Custom DocPerm', {'role': role_from}, all_fields, ignore_permissions=True)
    


    print("Getting all permissions====================================================================================================================")
    # Logic to get all permissions for the document
    return {"permissions": perms_from}

def get_common_permissions(src, doc):
    fields_map = {
        'select': 'select', 'read': 'read', 'write': 'write', 'create': 'create',
        'delete_to': 'delete', 'submit_to': 'submit', 'cancel_to': 'cancel',
        'amend': 'amend', 'report': 'report', 'export': 'export', 'import_to': 'import',
        'share': 'share', 'print': 'print', 'email': 'email'
    }
    return {
        tgt: int(doc.get(src_field, 0))
        for src_field, tgt in fields_map.items()
        if int(doc.get(src_field, 0)) == int(getattr(src, tgt, 0))
    }


def apply_common_permissions(doc, perms):
    all_fields = ['select', 'read', 'write', 'create', 
                  'amend', 'report', 'export',  'share', 'print', 'email']
    for field in all_fields:
        setattr(doc, field, perms.get(field, 0))






class CopyRolePerms(Document):
    
    def before_save(self):
        print("Before save method called====================================================================================================================")
