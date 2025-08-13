import frappe
from frappe.installer import update_site_config as _update_site_config

@frappe.whitelist()
def get_wf_state_by_closure(doctype, closure_type="Positive"):
    sql = """SELECT
            wfs.state,
            wfs.custom_closure
            FROM
            `tabWorkflow` AS wf
            INNER JOIN `tabWorkflow Document State` AS wfs ON wf.name = wfs.parent
            WHERE
            wf.document_type = %s AND wf.is_active = 1 AND wfs.custom_closure = %s
        """
    list = frappe.db.sql(sql, (doctype, closure_type), as_dict=1)
    if len(list) > 0:
        return list[0].state
    return None

@frappe.whitelist()
def update_site_config(key, value):
    """
    Update a key in the site config with the given value.
    """
    if frappe.session.user != "Administrator":
        frappe.throw("You are not authorized to perform this action.", frappe.PermissionError)
        
    _update_site_config(key, value)
    return frappe.get_site_config().get(key, None)