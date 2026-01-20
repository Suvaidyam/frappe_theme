// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Copy Role Perms", {
	refresh(frm) {
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

		// Redirect to Bulk Role Profile Permissions
		frm.add_custom_button(__("Bulk Role Profile Permissions"), () => {
			frappe.set_route("Form", "Bulk Role Profile Permissions");
		});

		// Redirect to Bulk Workspace Permissions
		frm.add_custom_button(__("Bulk Workspace Permissions"), () => {
			frappe.set_route("Form", "Bulk Workspace Permissions");
		});

		// Bulk operations
		frm.add_custom_button(
			__("Select All"),
			() => toggle_all_perms(frm, true),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Deselect All"),
			() => toggle_all_perms(frm, false),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Enable Read"),
			() => set_bulk_perms(frm, { read: 1 }),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Enable Write"),
			() => set_bulk_perms(frm, { write: 1 }),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Enable Read & Write"),
			() => set_bulk_perms(frm, { read: 1, write: 1 }),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Enable Read & Select"),
			() => set_bulk_perms(frm, { read: 1, select: 1 }),
			__("Bulk Actions")
		);

		// Quick Presets
		frm.add_custom_button(
			__("Read Only"),
			() => apply_preset(frm, "read_only"),
			__("Quick Presets")
		);
		frm.add_custom_button(
			__("Full Access"),
			() => apply_preset(frm, "full_access"),
			__("Quick Presets")
		);
		frm.add_custom_button(
			__("Report Only"),
			() => apply_preset(frm, "report_only"),
			__("Quick Presets")
		);
		frm.add_custom_button(
			__("Data Entry"),
			() => apply_preset(frm, "data_entry"),
			__("Quick Presets")
		);

		// Export/Import
		frm.add_custom_button(
			__("Export Permissions"),
			() => export_permissions(frm),
			__("Tools")
		);
		frm.add_custom_button(
			__("Import Permissions"),
			() => import_permissions(frm),
			__("Tools")
		);

		frm.trigger("set_button_label");

		// Main action button
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
			frm.custom_btn.addClass("btn-primary");
		}
	},
	perms_type: function (frm) {
		frm.set_value("role_from", null);
		frm.trigger("set_button_label");

		if (frm.doc.perms_type === "Create Perms") {
			frm.set_df_property("role_to", "label", "Role");
		} else {
			frm.set_df_property("role_to", "label", "Role To");
		}
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
	apps: function (frm) {
		set_all_doctypes_in_permissions(frm);
	},
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
			message: __("The following permissions are duplicated:") + " " + duplicates.join(""),
		});
	}
}

frappe.ui.form.on("Copy Role Perms Child", {
	permlevel: function (frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);
		frappe.meta.get_docfield(cdt, "select", cdn).read_only = 1;
		if (row.permlevel > 9) {
			row.permlevel = null;
			frappe.throw(__(`Value of Level cannot exceed 9 in  row ${row.idx}`));
		}
	},
});

function toggle_all_perms(frm, enable) {
	frm.doc.permissions.forEach((row) => {
		if (row.permlevel === 0) {
			row.select = enable ? 1 : 0;
			row.create = enable ? 1 : 0;
			row.delete_to = enable ? 1 : 0;
			row.submit_to = enable ? 1 : 0;
			row.cancel_to = enable ? 1 : 0;
			row.amend = enable ? 1 : 0;
			row.report = enable ? 1 : 0;
			row.export = enable ? 1 : 0;
			row.import_to = enable ? 1 : 0;
			row.share = enable ? 1 : 0;
			row.print = enable ? 1 : 0;
			row.email = enable ? 1 : 0;
		}
		row.read = enable ? 1 : 0;
		row.write = enable ? 1 : 0;
	});
	frm.refresh_field("permissions");
}

function set_bulk_perms(frm, perms) {
	frm.doc.permissions.forEach((row) => {
		Object.assign(row, perms);
	});
	frm.refresh_field("permissions");
}

function apply_preset(frm, preset) {
	const presets = {
		read_only: {
			read: 1,
			write: 0,
			create: 0,
			delete_to: 0,
			submit_to: 0,
			cancel_to: 0,
			amend: 0,
			report: 0,
			export: 0,
			share: 0,
			print: 0,
			email: 0,
			select: 0,
			import_to: 0,
		},
		full_access: {
			read: 1,
			write: 1,
			create: 1,
			delete_to: 1,
			submit_to: 1,
			cancel_to: 1,
			amend: 1,
			report: 1,
			export: 1,
			share: 1,
			print: 1,
			email: 1,
			select: 1,
			import_to: 1,
		},
		report_only: {
			read: 1,
			write: 0,
			create: 0,
			delete_to: 0,
			submit_to: 0,
			cancel_to: 0,
			amend: 0,
			report: 1,
			export: 1,
			share: 0,
			print: 1,
			email: 0,
			select: 0,
			import_to: 0,
		},
		data_entry: {
			read: 1,
			write: 1,
			create: 1,
			delete_to: 0,
			submit_to: 0,
			cancel_to: 0,
			amend: 0,
			report: 1,
			export: 1,
			share: 0,
			print: 1,
			email: 1,
			select: 0,
			import_to: 0,
		},
	};

	frm.doc.permissions.forEach((row) => {
		Object.keys(presets[preset]).forEach((key) => {
			if (row.permlevel === 0 || key === "read" || key === "write") {
				row[key] = presets[preset][key];
			}
		});
	});
	frm.refresh_field("permissions");
	frappe.show_alert({ message: __("Preset applied"), indicator: "green" });
}

function export_permissions(frm) {
	if (!frm.doc.permissions || !frm.doc.permissions.length) {
		frappe.msgprint(__("No permissions to export"));
		return;
	}
	const data = {
		role: frm.doc.role_to,
		perms_type: frm.doc.perms_type,
		exported_at: frappe.datetime.now_datetime(),
		permissions: frm.doc.permissions,
	};
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `permissions_${frm.doc.role_to}_${frappe.datetime.now_date()}.json`;
	a.click();
	frappe.show_alert({ message: __("Permissions exported"), indicator: "green" });
}

function import_permissions(frm) {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";
	input.onchange = (e) => {
		const file = e.target.files[0];
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const data = JSON.parse(event.target.result);
				if (data.permissions) {
					frm.clear_table("permissions");
					const seen = new Set();
					data.permissions.forEach((perm) => {
						const key = `${perm.reference_doctype}::${perm.permlevel}`;
						if (!seen.has(key)) {
							frm.add_child("permissions", perm);
							seen.add(key);
						}
					});
					frm.refresh_field("permissions");
					frappe.show_alert({ message: __("Permissions imported"), indicator: "green" });
				}
			} catch (err) {
				frappe.msgprint(__("Invalid JSON file"));
			}
		};
		reader.readAsText(file);
	};
	input.click();
}
