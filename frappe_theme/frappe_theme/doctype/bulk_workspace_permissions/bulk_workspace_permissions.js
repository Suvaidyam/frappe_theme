// Copyright (c) 2025, Frappe Theme and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bulk Workspace Permissions", {
	refresh(frm) {
		frm.disable_save();
		frm._perm_snapshot = null;

		// Hide toggle button
		const toggleBtn = document.querySelector(".btn.btn-default.icon-btn");
		if (toggleBtn) toggleBtn.style.display = "none";

		// Hide extra custom-action children
		frappe.after_ajax(() => {
			let parent = frm.page.wrapper.querySelector(".custom-actions");
			if (parent && parent.children.length > 2) {
				parent.children[1].style.display = "none";
				parent.children[2].style.display = "none";
			}
		});

		register_buttons(frm);
	},

	workspace(frm) {
		frm.clear_table("role_profiles");
		frm.refresh_field("role_profiles");

		if (frm.doc.workspace) {
			load_role_profiles(frm);
		}
		// Re-register buttons directly — avoids frm.refresh() race condition
		register_buttons(frm);
	},
});

function register_buttons(frm) {
	frm.clear_custom_buttons();
	frm.custom_btn = null;

	// Navigation
	frm.add_custom_button(__("Copy Role Perms"), () => {
		frappe.set_route("Form", "Copy Role Perms");
	});

	// Force Link columns to be wider
	frappe.after_ajax(() => {
		const header = frm.fields_dict.role_profiles?.grid?.header_row;
		if (!header) return;
		header.find('.col[data-fieldname="role_profile"]').css({ "min-width": "250px", "width": "250px" });
		header.find('.col[data-fieldname="role"]').css({ "min-width": "250px", "width": "250px" });
	});

	if (frm.doc.workspace) {
		// Bulk Actions
		[
			["Grant All",  () => toggle_all_perms(frm, true)],
			["Revoke All", () => toggle_all_perms(frm, false)],
		].forEach(([label, action]) => {
			frm.add_custom_button(__(label), action, __("Bulk Actions"));
		});

		// Tools
		frm.add_custom_button(__("Undo Last Action"), () => undo_last_action(frm), __("Tools"));

		add_apply_button(frm);
	}
}

// ── Undo ─────────────────────────────────────────────────────────────────────

function save_snapshot(frm) {
	frm._perm_snapshot = frm.doc.role_profiles.map((row) => ({ ...row }));
}

function undo_last_action(frm) {
	if (!frm._perm_snapshot) {
		frappe.show_alert({ message: __("Nothing to undo"), indicator: "orange" });
		return;
	}
	frm.clear_table("role_profiles");
	frm._perm_snapshot.forEach((snap) => frm.add_child("role_profiles", snap));
	frm.refresh_field("role_profiles");
	frm._perm_snapshot = null;
	frappe.show_alert({ message: __("Last action undone"), indicator: "blue" });
}

// ── Apply button ──────────────────────────────────────────────────────────────

function add_apply_button(frm) {
	frm.custom_btn = frm.add_custom_button(__("Apply Permissions"), () => {
		if (!frm.doc.workspace || !frm.doc.role_profiles?.length) {
			frappe.throw(__("Select Workspace and load Role Profiles first."));
		}
		frappe.confirm(
			__("Are you sure you want to apply these permissions to all selected roles?"),
			() => {
				frappe.call({
					method: "frappe_theme.frappe_theme.doctype.bulk_workspace_permissions.bulk_workspace_permissions.apply_bulk_workspace_permissions",
					args: { doc: frm.doc },
					freeze: true,
					freeze_message: __("Applying Permissions..."),
					callback(r) {
						if (r.message) {
							frappe.show_alert({
								message: __(
									`Permissions Applied Successfully! Updated: ${r.message.updated}`
								),
								indicator: "green",
							});
						}
					},
				});
			}
		);
	});
	frm.custom_btn.addClass("btn-primary");
}

// ── Load ──────────────────────────────────────────────────────────────────────

function load_role_profiles(frm) {
	frappe.call({
		method: "frappe_theme.frappe_theme.doctype.bulk_workspace_permissions.bulk_workspace_permissions.get_role_profiles_with_workspace_access",
		args: { workspace: frm.doc.workspace || null },
		freeze: true,
		freeze_message: __("Loading Role Profiles..."),
		callback(r) {
			if (!r.message?.length) {
				frappe.msgprint(__("No Role Profiles found in the system."));
				return;
			}
			frm.clear_table("role_profiles");
			r.message.forEach((item) => {
				let row = frm.add_child("role_profiles");
				Object.assign(row, {
					role_profile: item.role_profile,
					role:         item.role,
					has_access:   item.has_access || 0,
				});
			});
			frm.refresh_field("role_profiles");

			const has_existing = r.message.some((item) => item.has_access);
			frappe.show_alert({
				message: has_existing
					? __(`Loaded ${r.message.length} combinations (showing current access)`)
					: __(`Loaded ${r.message.length} combinations (no access currently)`),
				indicator: "green",
			});
		},
	});
}

// ── Bulk operations ───────────────────────────────────────────────────────────

function toggle_all_perms(frm, enable) {
	save_snapshot(frm);
	frm.doc.role_profiles.forEach((row) => {
		row.has_access = enable ? 1 : 0;
	});
	frm.refresh_field("role_profiles");
}
