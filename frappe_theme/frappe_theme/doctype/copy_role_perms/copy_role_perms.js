// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Copy Role Perms", {
	refresh(frm) {
		const toggleBtn = document.querySelector(".btn.btn-default.icon-btn");
		if (toggleBtn) toggleBtn.style.display = "none";

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
		frm._perm_snapshot = null;
		frm.custom_btn = null; // reset stale ref so button is always re-added

		// Force Reference Doctype column to be wider
		frappe.after_ajax(() => {
			frm.fields_dict.permissions?.grid?.header_row?.find(
				'.col[data-fieldname="reference_doctype"]'
			).css({ "min-width": "220px", "width": "220px" });
		});

		// Navigation
		frm.add_custom_button(__("Bulk Role Profile Permissions"), () => {
			frappe.set_route("Form", "Bulk Role Profile Permissions");
		});
		frm.add_custom_button(__("Bulk Workspace Permissions"), () => {
			frappe.set_route("Form", "Bulk Workspace Permissions");
		});

		// Bulk Actions
		[
			["Select All",         () => toggle_all_perms(frm, true)],
			["Deselect All",       () => toggle_all_perms(frm, false)],
			["Enable Read",        () => apply_bulk(frm, { read: 1 })],
			["Enable Write",       () => apply_bulk(frm, { write: 1 })],
			["Enable Read & Write",  () => apply_bulk(frm, { read: 1, write: 1 })],
			["Enable Read & Select", () => apply_bulk(frm, { read: 1, select: 1 })],
		].forEach(([label, action]) => {
			frm.add_custom_button(__(label), action, __("Bulk Actions"));
		});

		// Quick Presets — confirm before overwriting existing data
		[
			["Read Only",   "read_only"],
			["Full Access", "full_access"],
			["Report Only", "report_only"],
			["Data Entry",  "data_entry"],
		].forEach(([label, key]) => {
			frm.add_custom_button(__(label), () => {
				apply_preset_with_confirm(frm, key, label);
			}, __("Quick Presets"));
		});

		// Tools
		frm.add_custom_button(__("Export Permissions"), () => export_permissions(frm), __("Tools"));
		frm.add_custom_button(__("Import Permissions"), () => import_permissions(frm), __("Tools"));
		frm.add_custom_button(__("Undo Last Action"),   () => undo_last_action(frm),   __("Tools"));

		frm.trigger("set_button_label");

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
					args: { doc: frm.doc },
					callback(r) {
						if (r.message) {
							frappe.show_alert({
								message: __(
									`Permissions Created: ${r.message.message.Created}, Updated: ${r.message.message.Updated}`
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

	perms_type(frm) {
		frm.set_value("role_from", null);
		frm.trigger("set_button_label");
		frm.set_df_property(
			"role_to",
			"label",
			frm.doc.perms_type === "Create Perms" ? "Role" : "Role To"
		);
	},

	role_from(frm) {
		frappe.call({
			method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_all_permissions",
			args: { role_from: frm.doc.role_from },
			freeze: true,
			freeze_message: __("Getting Permissions..."),
			callback(r) {
				if (!r.message?.permissions) return;
				frm.clear_table("permissions");
				r.message.permissions.forEach((perm) => {
					let row = frm.add_child("permissions");
					Object.assign(row, {
						reference_doctype: perm.parent,
						permlevel:  perm.permlevel,
						select:     perm.select,
						read:       perm.read,
						write:      perm.write,
						create:     perm.create,
						delete_to:  perm.delete,
						submit_to:  perm.submit,
						cancel_to:  perm.cancel,
						amend:      perm.amend,
						report:     perm.report,
						export:     perm.export,
						import_to:  perm.import,
						share:      perm.share,
						print:      perm.print,
						email:      perm.email,
					});
				});
				frm.refresh_field("permissions");
			},
		});
	},

	set_button_label(frm) {
		if (frm.custom_btn) {
			frm.custom_btn.html(
				frm.doc.perms_type === "Get & Update Perms"
					? __("Update Permissions")
					: __("Create Permissions")
			);
		}
	},

	apps(frm) {
		set_all_doctypes_in_permissions(frm);
	},
});

// ── Undo ─────────────────────────────────────────────────────────────────────

function save_snapshot(frm) {
	frm._perm_snapshot = frm.doc.permissions.map((row) => ({ ...row }));
}

function undo_last_action(frm) {
	if (!frm._perm_snapshot) {
		frappe.show_alert({ message: __("Nothing to undo"), indicator: "orange" });
		return;
	}
	frm.clear_table("permissions");
	frm._perm_snapshot.forEach((snap) => frm.add_child("permissions", snap));
	frm.refresh_field("permissions");
	frm._perm_snapshot = null;
	frappe.show_alert({ message: __("Last action undone"), indicator: "blue" });
}

// ── App / DocType helpers ─────────────────────────────────────────────────────

function set_app_select_options(frm) {
	frappe.call({
		method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_app_list",
		callback(r) {
			if (r.message) frm.set_df_property("apps", "options", r.message);
		},
	});
}

function set_all_doctypes_in_permissions(frm) {
	frappe.call({
		method: "frappe_theme.controllers.copy_role_perms.copy_role_perms.get_all_doctypes",
		args: { app: frm.doc.apps },
		callback(r) {
			if (!r.message) return;
			frm.clear_table("permissions");
			r.message.forEach((doc) => {
				frm.add_child("permissions", {
					reference_doctype: doc.name,
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
				});
			});
			frm.refresh_field("permissions");
		},
	});
}

// ── Duplicate check ───────────────────────────────────────────────────────────

function check_duplicate_perms(frm) {
	if (!frm.doc.permissions?.length) return;
	const seen = new Set();
	const duplicates = frm.doc.permissions
		.map((row) => {
			const key = `${row.reference_doctype}::${row.permlevel}`;
			if (seen.has(key))
				return `Row ${row.idx}: ${row.reference_doctype} (Level ${row.permlevel})`;
			seen.add(key);
		})
		.filter(Boolean);

	if (duplicates.length) {
		frappe.throw({
			title: __("Duplicate Permissions Found"),
			indicator: "red",
			message: __("The following permissions are duplicated:") + "<br>" + duplicates.join("<br>"),
		});
	}
}

// ── Child table events ────────────────────────────────────────────────────────

frappe.ui.form.on("Copy Role Perms Child", {
	permlevel(frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);
		frappe.meta.get_docfield(cdt, "select", cdn).read_only = 1;
		if (row.permlevel > 9) {
			row.permlevel = null;
			frappe.throw(__(`Value of Level cannot exceed 9 in row ${row.idx}`));
		}
		warn_if_duplicate(frm, row);
	},

	reference_doctype(frm, cdt, cdn) {
		warn_if_duplicate(frm, frappe.get_doc(cdt, cdn));
	},
});

function warn_if_duplicate(frm, current_row) {
	if (!frm?.doc?.permissions || !current_row?.reference_doctype) return;
	const is_dup = frm.doc.permissions.some(
		(row) =>
			row.name !== current_row.name &&
			row.reference_doctype === current_row.reference_doctype &&
			row.permlevel === current_row.permlevel
	);
	if (is_dup) {
		frappe.show_alert({
			message: __(
				`Duplicate: "${current_row.reference_doctype}" at Level ${current_row.permlevel} already exists.`
			),
			indicator: "red",
		});
	}
}

// ── Bulk / Preset operations ──────────────────────────────────────────────────

function toggle_all_perms(frm, enable) {
	save_snapshot(frm);
	frm.doc.permissions.forEach((row) => {
		row.read  = enable ? 1 : 0;
		row.write = enable ? 1 : 0;
		if (row.permlevel === 0) {
			["select", "create", "delete_to", "submit_to", "cancel_to",
			 "amend", "report", "export", "import_to", "share", "print", "email",
			].forEach((f) => (row[f] = enable ? 1 : 0));
		}
	});
	frm.refresh_field("permissions");
}

function apply_bulk(frm, perms) {
	save_snapshot(frm);
	frm.doc.permissions.forEach((row) => Object.assign(row, perms));
	frm.refresh_field("permissions");
}

// Backwards-compatible alias
const set_bulk_perms = apply_bulk;

const PRESETS = {
	read_only: {
		read: 1, write: 0, create: 0, delete_to: 0, submit_to: 0,
		cancel_to: 0, amend: 0, report: 1, export: 0, share: 0,
		print: 0, email: 0, select: 1, import_to: 0,
	},
	full_access: {
		read: 1, write: 1, create: 1, delete_to: 1, submit_to: 1,
		cancel_to: 1, amend: 1, report: 1, export: 1, share: 1,
		print: 1, email: 1, select: 1, import_to: 1,
	},
	report_only: {
		read: 1, write: 0, create: 0, delete_to: 0, submit_to: 0,
		cancel_to: 0, amend: 0, report: 1, export: 1, share: 0,
		print: 1, email: 0, select: 0, import_to: 0,
	},
	data_entry: {
		read: 1, write: 1, create: 1, delete_to: 0, submit_to: 0,
		cancel_to: 0, amend: 0, report: 1, export: 1, share: 0,
		print: 1, email: 1, select: 0, import_to: 0,
	},
};

function apply_preset_with_confirm(frm, preset, label) {
	const run = () => apply_preset(frm, preset, label);
	if (frm.doc.permissions?.length) {
		frappe.confirm(__("This will overwrite existing permissions. Continue?"), run);
	} else {
		run();
	}
}

function apply_preset(frm, preset, label) {
	save_snapshot(frm);
	const config = PRESETS[preset];
	frm.doc.permissions.forEach((row) => {
		Object.keys(config).forEach((key) => {
			if (row.permlevel === 0 || key === "read" || key === "write") {
				row[key] = config[key];
			}
		});
	});
	frm.refresh_field("permissions");
	frappe.show_alert({
		message: __(`"${label || preset}" preset applied`),
		indicator: "green",
	});
}

// ── Export / Import ───────────────────────────────────────────────────────────

function export_permissions(frm) {
	if (!frm.doc.permissions?.length) {
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
	URL.revokeObjectURL(url);
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
					save_snapshot(frm);
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
