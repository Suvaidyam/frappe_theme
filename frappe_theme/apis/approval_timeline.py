import frappe
from frappe import _


@frappe.whitelist()
def get_workflow_audit(doctype=None, reference_name=None , limit=100):
    # return 'called '
    """
    Get workflow audit trail for a doctype or specific document
    
    Args:
        doctype (str): The document type to audit
        reference_name (str, optional): Specific document name
        limit (int, optional): Maximum number of actions to return
    """
    try:
        
        # Validate doctype
        if not frappe.db.exists("DocType", doctype):
            return {
                "success": False,
                "message": f"DocType '{doctype}' does not exist"
            }
        
        # Get active workflow
        workflow = frappe.get_all(
            "Workflow",
            filters={
                "document_type": doctype,
                "is_active": 1
            },
            fields=["name"],
            limit=1
        )
        
        if not workflow:
            return {
                "success": False,
                "message": f"No active workflow found for DocType '{doctype}'"
            }
        
        # Build filters
        filters = {"reference_doctype": doctype}
        if reference_name:
            if not frappe.db.exists(doctype, reference_name):
                return {
                    "success": False,
                    "message": f"Document '{reference_name}' does not exist"
                }
            filters["reference_name"] = reference_name
        
        # Fetch workflow actions
        actions = frappe.get_all(
            "SVA Workflow Action",
            filters=filters,
            fields=[
                "name",
                "reference_name",
                "workflow_state_previous",
                "workflow_state_current",
                "workflow_action",
                "user",
                "role",
                "comment",
                "creation",
                "modified"
            ],
            order_by="creation desc",
            limit=limit
        )
        
        # Enrich with action data (dialog fields)
        for action in actions:
            action_data = frappe.get_all(
                "SVA Workflow Action Data Child",
                filters={"parent": action.name},
                fields=["fieldname", "fieldtype", "value"],
                order_by="idx asc"
            )
            
            action["action_data"] = action_data
            
            # Convert to more readable format
            action["dialog_values"] = {
                item["fieldname"]: {
                    "value": item["value"],
                    "fieldtype": item["fieldtype"]
                }
                for item in action_data
            }
        
        return {
            "success": True,
            "workflow": workflow[0].name,
            "total_actions": len(actions),
            "actions": actions
        }
        
    except Exception as e:
        frappe.log_error(f"Workflow Audit Error: {str(e)}", "Workflow Audit API")
        return {
            "success": False,
            "message": str(e)
        }