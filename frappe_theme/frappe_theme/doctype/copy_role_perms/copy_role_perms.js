// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Copy Role Perms", {
	refresh(frm) {
		frm.set_value("perms_type", "Get & Update Perms");
		if (!frm.custom_btn) {
			frm.custom_btn = frm.add_custom_button(__("Create Permissions"), function () {
				if (frm.doc.permissions.length === 0 || !frm.doc.role_to) {
					frappe.throw(__("Select 'Role To' and add permissions first."));	
				}
				check_duplicate_perms(frm);
				let btn_label = frm.custom_btn.text().trim();
				let freeze_msg = btn_label === "Create Permissions" ? "Creating Permissions..." : "Updating Permissions...";
				frappe.call({
					method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.copy_all_permissions",
					args: {
						doc: frm.doc,
					},
					callback: function (r) {
						if (r.message) {
							frappe.show_alert({
								message: __(
									`Permissions  Created: ${r.message.message.Created}, Updated: ${r.message.message.Updated}`
								),
								indicator: "green",
							});
						}
					},
					freeze: true,
					freeze_message: freeze_msg,
				});
			});
		}
		frm.trigger("set_button_label");
		
	},
	perms_type: function (frm) {
		frm.set_value("role_from", null);
		frm.trigger("set_button_label");
	},
	role_from: function (frm) {
		frappe.call({
			method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_all_permissions",
			args: {
				role_from: frm.doc.role_from,
			},
			freeze: true,
			freeze_message: __("Getting Permissions..."),
			callback: function (r) {
				if (r.message && r.message.permissions) {
					frm.clear_table("permissions");

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
					frm.refresh_field("permissions");
				}
			},
		});
	},
	set_button_label(frm) {
		if (frm.custom_btn) {
			let label =
				frm.doc.perms_type === "Get & Update Perms"
					? __("Update Permissions")
					: __("Create Permissions");
			frm.custom_btn.html(label);
		}
	},
});

function check_duplicate_perms(frm) {
	if (!frm.doc.permissions?.length) return false;
	const seen = new Set();
	const duplicates = frm.doc.permissions
		.map((row) => {
			const key = `${row.reference_doctype}::${row.permlevel}`;
			if (seen.has(key)) {
				return `Row ${row.idx}: ${row.reference_doctype} (Level ${row.permlevel})`;
			}
			seen.add(key);
		})
		.filter(Boolean);

	if (duplicates.length) {
		frappe.throw({
			title: __("Duplicate Permissions Found"),
			indicator: "red",
			message:
				__("The following permissions are duplicated:") + "<br>" + duplicates.join("<br>"),
		});
	}
}


frappe.ui.form.on("Copy Role Perms Child", {
	permlevel: function (frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);
		if (row.permlevel > 9) {
			row.permlevel = null;	
			frappe.throw(__(`Value of Level cannot exceed 9 in  row ${row.idx}` ));
		}
	},
});
