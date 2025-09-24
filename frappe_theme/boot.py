
def boot_theme(bootinfo):
    try:
        import frappe
        if frappe.db and frappe.session:
            from frappe_theme.utils.data_protection import is_data_protection_active, safe_initialize_data_protection
            from frappe_theme.patches.export_patches import is_export_patches_active, initialize_export_patches
            
            # Initialize core patches if not active
            if not is_data_protection_active():
                safe_initialize_data_protection()
            
            # Initialize export patches if not active
            if not is_export_patches_active():
                initialize_export_patches()
                
    except Exception as e:
        # Don't break boot - just log the error
        try:
            frappe.log_error("Data Protection Boot Warning", str(e))
        except:
            pass  # Even logging might fail during boot

    frappe.flags.ignore_permissions = True
    bootinfo.my_theme = frappe.get_single("My Theme")
    bootinfo.submittable_doctypes = frappe.get_all("DocType", filters={"is_submittable": 1}, pluck="name")
    workspace_confs = frappe.get_all("SVAWorkspace Configuration", pluck="name")
    sva_workspaces = {}
    if len(workspace_confs) > 0:
        for wp in workspace_confs:
            sva_workspaces[wp] = frappe.get_doc("SVAWorkspace Configuration", wp).as_dict()
    bootinfo.sva_workspaces = sva_workspaces