// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("SVAWorkspace Configuration", {
	refresh(frm) {},
});
const set_list_settings = async (frm, cdt, cdn) => {
	let row = locals[cdt][cdn];
	let dtmeta = await frappe.call({
		method: "frappe_theme.dt_api.get_meta_fields",
		args: {
			doctype:
				row.connection_type == "Report"
					? row.link_report
					: ["Direct", "Unfiltered", "Indirect"].includes(row.connection_type)
					? row.link_doctype
					: row.referenced_link_doctype ?? row.link_doctype,
			_type: row.connection_type,
		},
	});
	new ListSettings({
		doctype:
			row.connection_type == "Report"
				? row.link_report
				: ["Direct", "Unfiltered", "Indirect"].includes(row.connection_type)
				? row.link_doctype
				: row.referenced_link_doctype ?? row.link_doctype,
		meta: dtmeta.message,
		connection_type: row.connection_type,
		settings: row,
		dialog_primary_action: async (listview_settings) => {
			frappe.model.set_value(
				cdt,
				cdn,
				"listview_settings",
				JSON.stringify(listview_settings)
			);
			frappe.show_alert({ message: __("Listview settings updated"), indicator: "green" });
		},
	});
};
const set_crud_permissiions = (frm, cdt, cdn) => {
	let row = locals[cdt][cdn];
	let prev_permissions = JSON.parse(
		row.crud_permissions ?? '["read", "write", "create", "delete"]'
	);
	let fields = ["read", "write", "create", "delete"].map((p) => {
		return {
			label: p[0].toUpperCase() + p.slice(1),
			fieldname: p,
			fieldtype: "Check",
			default: prev_permissions.includes(p) || p === "read",
			read_only: p === "read",
			onchange: function () {
				const fieldname = this.df.fieldname;
				const value = this.get_value();
				if (value) {
					if (!prev_permissions.includes(fieldname)) {
						prev_permissions.push(fieldname);
					}
				} else {
					prev_permissions = prev_permissions.filter((f) => f !== fieldname);
				}
			},
		};
	});
	let permissions_dialog = new frappe.ui.Dialog({
		title: __("CRUD Permissions"),
		fields: fields,
		primary_action_label: __("Save"),
		primary_action: async () => {
			frappe.model.set_value(cdt, cdn, "crud_permissions", JSON.stringify(prev_permissions));
			permissions_dialog.hide();
		},
	});
	permissions_dialog.show();
};

frappe.ui.form.on("SVAWorkspace DT Child", {
	async setup_list_settings(frm, cdt, cdn) {
		await set_list_settings(frm, cdt, cdn);
	},
	async setup_crud_permissions(frm, cdt, cdn) {
		set_crud_permissiions(frm, cdt, cdn);
	},
	form_render: async (frm, cdt, cdn) => {
		let workspace = frm.doc.workspace;
		let row = locals[cdt][cdn];
		if (workspace) {
			let res = await frappe.call("frappe_theme.wp_api.get_html_blocks", {
				workspace: workspace,
			});
			frm.cur_grid.grid_form.fields_dict.custom_html_block.get_query = () => {
				return {
					filters: { name: ["IN", res.message] },
					limit_page_length: 100,
				};
			};
		}
		if (row.connection_type === "Report") {
			frm.cur_grid.grid_form.fields_dict.link_report.get_query = () => {
				return {
					filters: { report_type: ["=", "Query Report"] },
					limit_page_length: 10000,
				};
			};
			// let reports = await frappe.call('frappe_theme.dt_api.link_report_list', { doctype: frm.doc.parent_doctype });
		}
	},
});
frappe.ui.form.on("SVAWorkspace Heatmap Child", {
	form_render: async function (frm, cdt, cdn) {
		let workspace = frm.doc.workspace;
		if (workspace) {
			let res = await frappe.call("frappe_theme.wp_api.get_html_blocks", {
				workspace: workspace,
			});
			frm.cur_grid.grid_form.fields_dict.custom_block.get_query = () => {
				return {
					filters: { name: ["IN", res.message] },
					limit_page_length: 100,
				};
			};
		}
		let row = locals[cdt][cdn];
		let slected_targets = JSON.parse(row.target_fields || "[]").map((field) => {
			return { label: field.label, value: field.fieldname };
		});
		frm.cur_grid.set_field_property("primary_target", "options", slected_targets);
	},
	target_fields: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let slected_targets = JSON.parse(row.target_fields || "[]").map((field) => {
			return { label: field.label, value: field.fieldname };
		});
		console.log(slected_targets, "slected_targts");
	},
	setup_target_fields: async function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.report) {
			let res = await frappe.call({
				method: "frappe.desk.query_report.run",
				args: { report_name: row.report },
			});
			let fields = res.message?.columns
				?.filter((col) => ["Int", "Float", "Currency"].includes(col.fieldtype))
				?.map((col) => {
					return {
						label: col.label,
						fieldname: col.fieldname,
						fieldtype: col.fieldtype,
					};
				});
			let prev_targets = JSON.parse(row.target_fields || "[]").map((field) => {
				return field.fieldname;
			});
			let dialog = new frappe.ui.Dialog({
				title: __("Select Target Fields"),
				fields: fields.map((field) => {
					return {
						label: field.label,
						fieldname: field.fieldname,
						default: prev_targets.includes(field.fieldname),
						fieldtype: "Check",
					};
				}),
				primary_action_label: "Submit",
				primary_action(values) {
					let target_fields = [];
					fields.forEach((field) => {
						if (values[field.fieldname]) {
							target_fields.push({
								fieldname: field.fieldname,
								label: field.label,
								fieldtype: field.fieldtype,
							});
						}
					});

					frappe.model.set_value(
						cdt,
						cdn,
						"target_fields",
						JSON.stringify(target_fields)
					);
					dialog.clear();
					dialog.hide();
				},
				secondary_action_label: "Cancel",
				secondary_action() {
					dialog.clear();
					dialog.hide();
				},
			}).show();
		} else {
			frappe.show_alert({
				message: __("Please select a report"),
				indicator: "red",
			});
		}
	},
});
