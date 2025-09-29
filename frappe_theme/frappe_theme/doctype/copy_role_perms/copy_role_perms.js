// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Copy Role Perms", {
	refresh(frm) {
<<<<<<< HEAD
		frm.set_value("perms_type", "Get & Update Perms");
		if (!frm.custom_btn) {
			frm.custom_btn = frm.add_custom_button(__("Create Permissions"), function () {
				if (frm.doc.permissions.length === 0 || !frm.doc.role_to) {
					frappe.throw(__("Select 'Role To' and add permissions first."));	
				}
				check_duplicate_perms(frm);
				let btn_label = frm.custom_btn.text().trim();
				let freeze_msg = btn_label === "Create Permissions" ? "Creating Permissions..." : "Updating Permissions...";
=======
		 const toggleBtn = document.querySelector(".btn.btn-default.icon-btn");
			if (toggleBtn) {
				toggleBtn.style.display = "none";
			}
		set_app_select_options(frm);
		frm.disable_save();
		frappe.after_ajax(() => {
			let parent = frm.page.wrapper.querySelector(".custom-actions");
			if (parent && parent.children.length > 2) {
				parent.children[1].style.display = "none";
				parent.children[2].style.display = "none";
			}
		});

		frm.set_value("perms_type", "Get & Update Perms");
		if (!frm.custom_btn) {
			frm.custom_btn = frm.add_custom_button(__("Create Permissions"), function () {
				if (!frm.doc.role_to || !frm.doc.permissions || frm.doc.permissions.length === 0) {
					let msg = frm.doc.perms_type === "Create Perms" ? "Role" : "Role To";
					frappe.throw(__("Select '{0}' and add permissions first.", [msg]));
				}
				check_duplicate_perms(frm);
				let btn_label = frm.custom_btn.text().trim();
				let freeze_msg =
					btn_label === "Create Permissions"
						? "Creating Permissions..."
						: "Updating Permissions...";
>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441
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
<<<<<<< HEAD
		
=======
>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441
	},
	perms_type: function (frm) {
		frm.set_value("role_from", null);
		frm.trigger("set_button_label");
<<<<<<< HEAD
=======

		if (frm.doc.perms_type === "Create Perms") {
			frm.set_df_property("role_to", "label", "Role");
		} else {
			frm.set_df_property("role_to", "label", "Role To");
		}
>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441
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
<<<<<<< HEAD
});

=======
	apps: function (frm) {
		set_all_doctypes_in_permissions(frm);
	}
});

function set_app_select_options(frm) {
	frappe.call({
		method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_app_list",
		callback: function (r) {
			if (r.message) {
				frm.set_df_property("apps", "options", r.message);
			}
		},
	});
	
}

function set_all_doctypes_in_permissions(frm) {
	frappe.call({
		method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_all_doctypes",
		args: { app: frm.doc.apps },
		callback: function (r) {
			if (!r.message) return;
			frm.clear_table("permissions");
			r.message.forEach((doc) => {
				frm.add_child(
					"permissions",
					Object.assign(
						{
							reference_doctype: doc.name,
						},
						{
							permlevel: 0,
							select: 0,
							read: 1,
							write: 1,
							create: 0,
							delete_to: 0,
							submit_to: 0,
							cancel_to: 0,
							amend: 0,
							report: 1,
							export: 1,
							import_to: 0,
							share: 0,
							print: 0,
							email: 1,
						}
					)
				);
			});

			frm.refresh_field("permissions");
		},
	});
}


>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441
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
<<<<<<< HEAD
}

=======
	

}
>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441

frappe.ui.form.on("Copy Role Perms Child", {
	permlevel: function (frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);
<<<<<<< HEAD
		if (row.permlevel > 9) {
			row.permlevel = null;	
			frappe.throw(__(`Value of Level cannot exceed 9 in  row ${row.idx}` ));
		}
	},
});
=======
		frappe.meta.get_docfield(cdt, "select", cdn).read_only = 1;
		if (row.permlevel > 9) {
			row.permlevel = null;
			frappe.throw(__(`Value of Level cannot exceed 9 in  row ${row.idx}`));
		}
	},
	
});




>>>>>>> 1d410952714d4b288d7b1cd8cfc49645b4f70441
