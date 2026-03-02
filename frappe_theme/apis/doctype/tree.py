# app/utils/doctype_tree.py

# app/utils/doctype_tree.py

import frappe
from frappe import _

def get_doctype_tree(root_doctype, max_level=5, lang=None):
    """
    Recursively fetch linked doctypes up to max_level.
    Includes translated labels.
    Avoid circular references.
    """

    visited = set()

    # Set language context if provided
    if lang:
        frappe.local.lang = lang

    def get_linked_children(parent_doctype):
        """
        Find DocTypes that LINK to this doctype
        """
        return frappe.db.sql("""
            SELECT DISTINCT
                df.parent AS doctype,
                df.fieldname,
                df.label
            FROM
                `tabDocField` df
            WHERE
                df.fieldtype = 'Link'
                AND df.options = %s
                AND df.parenttype = 'DocType'
        """, parent_doctype, as_dict=True)

    def build_tree(doctype, level):
        if level > max_level:
            return {
                "name": doctype,
                "label": _(doctype),
                "level_limit_reached": True,
                "children": []
            }

        if doctype in visited:
            return {
                "name": doctype,
                "label": _(doctype),
                "circular": True,
                "children": []
            }

        visited.add(doctype)

        meta = frappe.get_meta(doctype)

        node = {
            "name": doctype,
            "label": _(meta.name),
            "module": meta.module,
            "level": level,
            "children": []
        }

        linked_doctypes = get_linked_children(doctype)

        for link in linked_doctypes:
            child_doctype = link["doctype"]
            fieldname = link["fieldname"]
            field_label = _(link["label"] or fieldname)

            child_tree = build_tree(child_doctype, level + 1)

            node["children"].append({
                "via_field": fieldname,
                "via_label": field_label,
                "child_doctype": child_doctype,
                "tree": child_tree
            })

        return node

    return build_tree(root_doctype, 1)
@frappe.whitelist()
def get_dt_tree(doctype, max_level=5):
    try:
        return get_doctype_tree(doctype, max_level)
    except Exception as e:
        frappe.log_error(f"Error getting doctype tree: {e}", "doctype_tree")
        return {"error": str(e)}
