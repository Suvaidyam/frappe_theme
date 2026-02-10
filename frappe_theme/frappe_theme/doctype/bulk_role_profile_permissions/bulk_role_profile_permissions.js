// Copyright (c) 2025, Frappe Theme and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bulk Role Profile Permissions", {
	refresh(frm) {
		frm.disable_save();
		frm.clear_custom_buttons();

		if (
			frm.doc.doctype_name &&
			frm.doc.doctype_name !== "Undefined" &&
			frm.doc.doctype_name !== "Null"
		) {
			bulkActionForEnable(frm);
			bulkActionForDisable(frm);
			bulkActionForQuickPresets(frm);
			add_apply_button(frm);
		}
	},

	doctype_name(frm) {
		frm.clear_table("role_profiles");
		frm.refresh_field("role_profiles");

		if (frm.doc.doctype_name) {
			load_role_profiles(frm);
			frm.refresh(); // 🔥 important
		}
	},
});

// Bulk Actions fo Enable
function bulkActionForEnable(frm) {
	frm.add_custom_button(
		__("Enable Read"),
		() => set_bulk_perms(frm, { read: 1 }),
		__("Bulk Actions for Enable")
	);
	frm.add_custom_button(
		__("Enable Write"),
		() => set_bulk_perms(frm, { write: 1 }),
		__("Bulk Actions for Enable")
	);
	frm.add_custom_button(
		__("Enable Read & Write"),
		() => set_bulk_perms(frm, { read: 1, write: 1 }),
		__("Bulk Actions for Enable")
	);
	frm.add_custom_button(
		__("Select All"),
		() => toggle_all_perms(frm, true),
		__("Bulk Actions for Enable")
	);
}

// Bulk Actions fo Disabe
function bulkActionForDisable(frm) {
	frm.add_custom_button(
		__("Disabe Read"),
		() => set_bulk_perms(frm, { read: 0 }),
		__("Bulk Actions for Disabe")
	);
	frm.add_custom_button(
		__("Disabe Write"),
		() => set_bulk_perms(frm, { write: 0 }),
		__("Bulk Actions for Disabe")
	);
	frm.add_custom_button(
		__("Disabe Read & Write"),
		() => set_bulk_perms(frm, { read: 0, write: 0 }),
		__("Bulk Actions for Disabe")
	);
	frm.add_custom_button(
		__("Deselect All"),
		() => toggle_all_perms(frm, false),
		__("Bulk Actions for Disabe")
	);
}

// Quick Presets
function bulkActionForQuickPresets(frm) {
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
}

function add_apply_button(frm) {
	if (frm.custom_btn) return;

	frm.custom_btn = frm.add_custom_button(__("Apply Permissions"), () => {
		if (!frm.doc.doctype_name || !frm.doc.role_profiles?.length) {
			frappe.throw(__("Select DocType and load Role Profiles first."));
		}

		frappe.confirm(__("Are you sure you want to apply these permissions?"), () => {
			frappe.call({
				method: "frappe_theme.frappe_theme.doctype.bulk_role_profile_permissions.bulk_role_profile_permissions.apply_bulk_permissions",
				args: { doc: frm.doc },
				freeze: true,
				freeze_message: __("Applying Permissions..."),
				callback(r) {
					if (r.message) {
						frappe.show_alert({
							message: __(
								`Permissions Applied! Created: ${r.message.created}, Updated: ${r.message.updated}`
							),
							indicator: "green",
						});
					}
				},
			});
		});
	});

	frm.custom_btn.addClass("btn-primary");
	frm.custom_btn.addClass("btn-success");
	// frm.custom_btn.css({
	// 	backgroundColor: "#16a34a",
	// 	color: "#ffffff",
	// 	borderColor: "#16a34a",
	// });
}

function load_role_profiles(frm) {
	frappe.call({
		method: "frappe_theme.frappe_theme.doctype.bulk_role_profile_permissions.bulk_role_profile_permissions.get_role_profiles_with_roles",
		args: {
			doctype_name: frm.doc.doctype_name || null,
		},
		callback: function (r) {
			if (r.message && r.message.length > 0) {
				frm.clear_table("role_profiles");

				r.message.forEach((item) => {
					let row = frm.add_child("role_profiles");
					row.role_profile = item.role_profile;
					row.role = item.role;
					row.permlevel = item.permlevel || 0;

					// Load existing permissions or set defaults
					row.select = item.select || 0;
					row.read = item.read || 0;
					row.write = item.write || 0;
					row.create = item.create || 0;
					row.delete = item.delete || 0;
					row.submit = item.submit || 0;
					row.cancel = item.cancel || 0;
					row.amend = item.amend || 0;
					row.report = item.report || 0;
					row.export = item.export || 0;
					row.import = item.import || 0;
					row.share = item.share || 0;
					row.print = item.print || 0;
					row.email = item.email || 0;
				});

				frm.refresh_field("role_profiles");

				let has_existing = r.message.some(
					(item) => item.read || item.write || item.create
				);
				let msg = has_existing
					? __(
							`Loaded ${r.message.length} Role Profile-Role combinations with existing permissions`
					  )
					: __(
							`Loaded ${r.message.length} Role Profile-Role combinations (no existing permissions)`
					  );

				frappe.show_alert({
					message: msg,
					indicator: "green",
				});
			} else {
				frappe.msgprint(__("No Role Profiles found in the system."));
			}
		},
		freeze: true,
		freeze_message: __("Loading Role Profiles..."),
	});
}

function toggle_all_perms(frm, enable) {
	frm.doc.role_profiles.forEach((row) => {
		if (row.permlevel === 0) {
			row.select = enable ? 1 : 0;
			row.create = enable ? 1 : 0;
			row.delete = enable ? 1 : 0;
			row.submit = enable ? 1 : 0;
			row.cancel = enable ? 1 : 0;
			row.amend = enable ? 1 : 0;
			row.report = enable ? 1 : 0;
			row.export = enable ? 1 : 0;
			row.import = enable ? 1 : 0;
			row.share = enable ? 1 : 0;
			row.print = enable ? 1 : 0;
			row.email = enable ? 1 : 0;
		}
		row.read = enable ? 1 : 0;
		row.write = enable ? 1 : 0;
	});
	frm.refresh_field("role_profiles");
}

function set_bulk_perms(frm, perms) {
	frm.doc.role_profiles.forEach((row) => {
		Object.assign(row, perms);
		if (perms.read === 1 || (row.read && row.write)) {
			row.report = 1;
		}
	});
	frm.refresh_field("role_profiles");
}

function apply_preset(frm, preset) {
	const presets = {
		read_only: {
			read: 1,
			write: 0,
			create: 0,
			delete: 0,
			submit: 0,
			cancel: 0,
			amend: 0,
			report: 0,
			export: 0,
			share: 0,
			print: 0,
			email: 0,
			select: 0,
			import: 0,
		},
		full_access: {
			read: 1,
			write: 1,
			create: 1,
			delete: 1,
			submit: 1,
			cancel: 1,
			amend: 1,
			report: 1,
			export: 1,
			share: 1,
			print: 1,
			email: 1,
			select: 1,
			import: 1,
		},
		report_only: {
			read: 1,
			write: 0,
			create: 0,
			delete: 0,
			submit: 0,
			cancel: 0,
			amend: 0,
			report: 1,
			export: 1,
			share: 0,
			print: 1,
			email: 0,
			select: 0,
			import: 0,
		},
		data_entry: {
			read: 1,
			write: 1,
			create: 1,
			delete: 0,
			submit: 0,
			cancel: 0,
			amend: 0,
			report: 1,
			export: 1,
			share: 0,
			print: 1,
			email: 1,
			select: 0,
			import: 0,
		},
	};

	frm.doc.role_profiles.forEach((row) => {
		Object.keys(presets[preset]).forEach((key) => {
			if (row.permlevel === 0 || key === "read" || key === "write") {
				row[key] = presets[preset][key];
			}
		});
		if (preset === "report_only" && row.read && row.write) {
			row.report = 1;
		}
	});
	frm.refresh_field("role_profiles");
	frappe.show_alert({ message: __("Preset applied"), indicator: "green" });
}
