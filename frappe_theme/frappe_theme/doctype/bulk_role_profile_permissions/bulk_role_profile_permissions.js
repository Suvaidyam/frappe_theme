// Copyright (c) 2025, Frappe Theme and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bulk Role Profile Permissions", {
	refresh(frm) {
		frm.disable_save();
		frm._perm_snapshot = null;
		register_buttons(frm);
	},

	doctype_name(frm) {
		frm.clear_table("role_profiles");
		frm.refresh_field("role_profiles");

		if (frm.doc.doctype_name) {
			load_role_profiles(frm);
		}
		// Re-register buttons directly — avoids frm.refresh() race condition
		// where clear_custom_buttons fires but doctype_name isn't readable yet
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
		header
			.find('.col[data-fieldname="role_profile"]')
			.css({ "min-width": "250px", width: "250px" });
		header.find('.col[data-fieldname="role"]').css({ "min-width": "250px", width: "250px" });
	});

	if (
		frm.doc.doctype_name &&
		frm.doc.doctype_name !== "Undefined" &&
		frm.doc.doctype_name !== "Null"
	) {
		// Bulk Actions
		[
			["Select All", () => toggle_all_perms(frm, true)],
			["Deselect All", () => toggle_all_perms(frm, false)],
			["Enable Read", () => apply_bulk(frm, { read: 1 })],
			["Enable Write", () => apply_bulk(frm, { write: 1 })],
			["Enable Read & Write", () => apply_bulk(frm, { read: 1, write: 1 })],
			["Disable Read", () => apply_bulk(frm, { read: 0 })],
			["Disable Write", () => apply_bulk(frm, { write: 0 })],
			["Disable Read & Write", () => apply_bulk(frm, { read: 0, write: 0 })],
		].forEach(([label, action]) => {
			frm.add_custom_button(__(label), action, __("Bulk Actions"));
		});

		// Quick Presets — confirm before overwriting existing data
		[
			["Read Only", "read_only"],
			["Full Access", "full_access"],
			["Report Only", "report_only"],
			["Data Entry", "data_entry"],
		].forEach(([label, key]) => {
			frm.add_custom_button(
				__(label),
				() => {
					apply_preset_with_confirm(frm, key, label);
				},
				__("Quick Presets")
			);
		});

		// Tools
		frm.add_custom_button(__("Copy from DocType"), () => copy_from_doctype(frm), __("Tools"));
		frm.add_custom_button(__("Undo Last Action"), () => undo_last_action(frm), __("Tools"));

		add_apply_button(frm);
	}

	// Ctrl+S → trigger Apply Permissions
	$(document).off("keydown.bulk_role_profile_perms");
	$(document).on("keydown.bulk_role_profile_perms", function (e) {
		if (
			e.ctrlKey &&
			(e.key === "s" || e.key === "S") &&
			cur_frm?.doctype === "Bulk Role Profile Permissions"
		) {
			e.preventDefault();
			frm.custom_btn?.click();
		}
	});
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
}

// ── Load ──────────────────────────────────────────────────────────────────────

function load_role_profiles(frm) {
	frappe.call({
		method: "frappe_theme.frappe_theme.doctype.bulk_role_profile_permissions.bulk_role_profile_permissions.get_role_profiles_with_roles",
		args: { doctype_name: frm.doc.doctype_name || null },
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
					role: item.role,
					permlevel: item.permlevel || 0,
					select: item.select || 0,
					read: item.read || 0,
					write: item.write || 0,
					create: item.create || 0,
					delete: item.delete || 0,
					submit: item.submit || 0,
					cancel: item.cancel || 0,
					amend: item.amend || 0,
					report: item.report || 0,
					export: item.export || 0,
					import: item.import || 0,
					share: item.share || 0,
					print: item.print || 0,
					email: item.email || 0,
				});
			});
			frm.refresh_field("role_profiles");

			const has_existing = r.message.some((item) => item.read || item.write || item.create);
			frappe.show_alert({
				message: has_existing
					? __(`Loaded ${r.message.length} combinations with existing permissions`)
					: __(`Loaded ${r.message.length} combinations (no existing permissions)`),
				indicator: "green",
			});
		},
	});
}

// ── Bulk / Preset operations ──────────────────────────────────────────────────

function toggle_all_perms(frm, enable) {
	save_snapshot(frm);
	frm.doc.role_profiles.forEach((row) => {
		row.read = enable ? 1 : 0;
		row.write = enable ? 1 : 0;
		if (row.permlevel === 0) {
			[
				"select",
				"create",
				"delete",
				"submit",
				"cancel",
				"amend",
				"report",
				"export",
				"import",
				"share",
				"print",
				"email",
			].forEach((f) => (row[f] = enable ? 1 : 0));
		}
	});
	frm.refresh_field("role_profiles");
}

function apply_bulk(frm, perms) {
	save_snapshot(frm);
	frm.doc.role_profiles.forEach((row) => Object.assign(row, perms));
	frm.refresh_field("role_profiles");
}

const PRESETS = {
	read_only: {
		read: 1,
		write: 0,
		create: 0,
		delete: 0,
		submit: 0,
		cancel: 0,
		amend: 0,
		report: 1,
		export: 0,
		share: 0,
		print: 0,
		email: 0,
		select: 1,
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

function apply_preset_with_confirm(frm, preset, label) {
	const run = () => apply_preset(frm, preset, label);
	if (frm.doc.role_profiles?.length) {
		frappe.confirm(__("This will overwrite existing permissions. Continue?"), run);
	} else {
		run();
	}
}

function apply_preset(frm, preset, label) {
	save_snapshot(frm);
	const config = PRESETS[preset];
	frm.doc.role_profiles.forEach((row) => {
		Object.keys(config).forEach((key) => {
			if (row.permlevel === 0 || key === "read" || key === "write") {
				row[key] = config[key];
			}
		});
	});
	frm.refresh_field("role_profiles");
	frappe.show_alert({
		message: __(`"${label || preset}" preset applied`),
		indicator: "green",
	});
}

// ── Copy from DocType ─────────────────────────────────────────────────────────

function copy_from_doctype(frm) {
	if (!frm.doc.role_profiles?.length) {
		frappe.msgprint(__("Load Role Profiles first before copying permissions."));
		return;
	}

	frappe.prompt(
		[
			{
				fieldname: "source_doctype",
				fieldtype: "Link",
				options: "DocType",
				label: __("Copy Permissions From"),
				reqd: 1,
				description: __(
					"Permissions of this DocType will be applied to all matching roles."
				),
			},
		],
		(values) => {
			if (values.source_doctype === frm.doc.doctype_name) {
				frappe.msgprint(__("Source and target DocType cannot be the same."));
				return;
			}

			frappe.call({
				method: "frappe_theme.frappe_theme.doctype.bulk_role_profile_permissions.bulk_role_profile_permissions.get_permissions_for_doctype",
				args: { doctype_name: values.source_doctype },
				freeze: true,
				freeze_message: __("Fetching permissions..."),
				callback(r) {
					const perm_map = r.message;
					if (!perm_map || !Object.keys(perm_map).length) {
						frappe.msgprint(
							__(`No permissions found for "{0}".`, [values.source_doctype])
						);
						return;
					}

					save_snapshot(frm);
					let applied = 0;

					frm.doc.role_profiles.forEach((row) => {
						// Try exact permlevel match first, then fallback to level 0
						const perm =
							perm_map[`${row.role}::${row.permlevel}`] ||
							perm_map[`${row.role}::0`];

						if (!perm) return;

						if (row.permlevel === 0) {
							Object.assign(row, {
								select: perm.select || 0,
								read: perm.read || 0,
								write: perm.write || 0,
								create: perm.create || 0,
								delete: perm.delete || 0,
								submit: perm.submit || 0,
								cancel: perm.cancel || 0,
								amend: perm.amend || 0,
								report: perm.report || 0,
								export: perm.export || 0,
								import: perm.import || 0,
								share: perm.share || 0,
								print: perm.print || 0,
								email: perm.email || 0,
							});
						} else {
							// Higher permlevels: only read/write
							row.read = perm.read || 0;
							row.write = perm.write || 0;
						}
						applied++;
					});

					frm.refresh_field("role_profiles");
					frappe.show_alert({
						message: __(
							`Permissions copied from "${values.source_doctype}" to ${applied} rows.`
						),
						indicator: "green",
					});
				},
			});
		},
		__("Copy Permissions from DocType"),
		__("Copy")
	);
}
