import frappe


def boot_theme(bootinfo):
	frappe.flags.ignore_permissions = True
	bootinfo.my_theme = frappe.get_cached_doc("My Theme")
	bootinfo.submittable_doctypes = frappe.get_all("DocType", filters={"is_submittable": 1}, pluck="name")
	workspace_confs = frappe.get_all("SVAWorkspace Configuration", pluck="name")
	sva_workspaces = {}
	for wp in workspace_confs:
		sva_workspaces[wp] = frappe.get_cached_doc("SVAWorkspace Configuration", wp).as_dict()
	bootinfo.sva_workspaces = sva_workspaces
