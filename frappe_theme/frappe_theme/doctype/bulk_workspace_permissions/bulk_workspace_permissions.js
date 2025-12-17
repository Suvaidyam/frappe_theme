// Copyright (c) 2025, Frappe Theme and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bulk Workspace Permissions", {
	refresh(frm) {
		// Hide toggle button
		const toggleBtn = document.querySelector(".btn.btn-default.icon-btn");
		if (toggleBtn) {
			toggleBtn.style.display = "none";
		}

		frm.disable_save();

		// Hide custom actions
		frappe.after_ajax(() => {
			let parent = frm.page.wrapper.querySelector(".custom-actions");
			if (parent && parent.children.length > 2) {
				parent.children[1].style.display = "none";
				parent.children[2].style.display = "none";
			}
		});

		// Bulk Actions
		frm.add_custom_button(
			__("Grant All"),
			() => toggle_all_perms(frm, true),
			__("Bulk Actions")
		);
		frm.add_custom_button(
			__("Revoke All"),
			() => toggle_all_perms(frm, false),
			__("Bulk Actions")
		);

		// Main action button - Apply Permissions
		if (!frm.custom_btn) {
			frm.custom_btn = frm.add_custom_button(__("Apply Permissions"), function () {
				if (
					!frm.doc.workspace ||
					!frm.doc.role_profiles ||
					frm.doc.role_profiles.length === 0
				) {
					frappe.throw(__("Select Workspace and load Role Profiles first."));
				}

				frappe.confirm(
					__("Are you sure you want to apply these permissions to all selected roles?"),
					() => {
						frappe.call({
							method: "frappe_theme.frappe_theme.doctype.bulk_workspace_permissions.bulk_workspace_permissions.apply_bulk_workspace_permissions",
							args: {
								doc: frm.doc,
							},
							callback: function (r) {
								if (r.message) {
									frappe.show_alert({
										message: __(
											`Permissions Applied Successfully! Updated: ${r.message.updated}`
										),
										indicator: "green",
									});
								}
							},
							freeze: true,
							freeze_message: __("Applying Permissions..."),
						});
					}
				);
			});
			frm.custom_btn.addClass("btn-primary");
		}
	},

	workspace: function (frm) {
		// Clear table when workspace changes
		frm.clear_table("role_profiles");
		frm.refresh_field("role_profiles");

		// Auto-load role profiles if workspace is selected
		if (frm.doc.workspace) {
			load_role_profiles(frm);
		}
	},
});

function load_role_profiles(frm) {
	frappe.call({
		method: "frappe_theme.frappe_theme.doctype.bulk_workspace_permissions.bulk_workspace_permissions.get_role_profiles_with_workspace_access",
		args: {
			workspace: frm.doc.workspace || null,
		},
		callback: function (r) {
			if (r.message && r.message.length > 0) {
				frm.clear_table("role_profiles");

				r.message.forEach((item) => {
					let row = frm.add_child("role_profiles");
					row.role_profile = item.role_profile;
					row.role = item.role;
					row.has_access = item.has_access || 0;
				});

				frm.refresh_field("role_profiles");

				let has_existing = r.message.some((item) => item.has_access);
				let msg = has_existing
					? __(
							`Loaded ${r.message.length} Role Profile-Role combinations (showing current access)`
					  )
					: __(
							`Loaded ${r.message.length} Role Profile-Role combinations (no access currently)`
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
		row.has_access = enable ? 1 : 0;
	});
	frm.refresh_field("role_profiles");
}
