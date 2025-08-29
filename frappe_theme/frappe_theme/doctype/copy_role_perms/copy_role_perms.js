// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Copy Role Perms", {
	refresh(frm) {
		frm.add_custom_button(__("Copy Permissions"), function () {
			frappe.call({
				// method: "frappe_theme.api.copy_role_perms",
				method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.copy_all_permissions",
				args: {
					doc: frm.doc,
				},
				freeze: true,
				freeze_message: __("Copying Permissions..."),
			});
        });
        
        frm.add_custom_button(__("Get Permissions"), function () {
			frappe.call({
				method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_all_permissions",
				args: {
					role_from: frm.doc.role_from,
					
				},
				freeze: true,
				freeze_message: __("Getting Permissions..."),
				callback: function (r) {
					if (r.message && r.message.permissions) {
						// clear existing child table
						frm.clear_table("permissions");

						// add new rows
						r.message.permissions.forEach((perm) => {
							let row = frm.add_child("permissions");
							row.reference_doctype = perm.parent;
							row.permlevel = perm.permlevel;
							row.select = perm.select;
							row.read = perm.read;
							row.write = perm.write;
							row.create = perm.create;
							row.delete_to = perm.delete;
							row.submit_to = perm.submit;
							row.cancel_to = perm.cancel;
							row.amend = perm.amend;
							row.report = perm.report;
							row.export = perm.export;
							row.import_to = perm.import;
							row.share = perm.share;
							row.print = perm.print;
							row.email = perm.email;
						});

						// refresh UI
						frm.refresh_field("permissions");
						// frappe.msgprint(__("Permissions updated from Role: " + frm.doc.role_from));
					}
				},
			});
		});
	},

	
});
