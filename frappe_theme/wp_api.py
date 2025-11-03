import frappe


@frappe.whitelist()
def get_html_blocks(workspace):
	frappe.flags.ignore_permissions = True
	workspace_doc = frappe.get_doc("Workspace", workspace)
	return [block.get("custom_block_name") for block in workspace_doc.get("custom_blocks", [])]
