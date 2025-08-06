import frappe

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