// Copyright (c) 2024, Suvaidyam and contributors
// For license information, please see license.txt
const filter_html_fields = (frm) => {
	let filter_html_fields = [];
	if (frm.doc.child_doctypes.length > 0) {
		filter_html_fields = frm.doc.child_doctypes
			.filter((d) => d && d.html_field)
			.map((d) => d.html_field);
	}
	if (frm.doc.number_cards.length > 0) {
		filter_html_fields = filter_html_fields.concat(
			frm.doc.number_cards.filter((d) => d && d.html_field).map((d) => d.html_field)
		);
	}
	if (frm.doc.charts.length > 0) {
		filter_html_fields = filter_html_fields.concat(
			frm.doc.charts.filter((d) => d && d.html_field).map((d) => d.html_field)
		);
	}
	return filter_html_fields;
};
frappe.ui.form.on("SVADatatable Configuration", {
	refresh: function (frm) {
		frm.set_query("parent_doctype", function () {
			return {
				filters: {
					istable: 0, // assuming you have a field named 'territory' on the form
				},
			};
		});
	},
	update_sequences: function (frm) {
		if (frm.doc.mapper_type === "Number Card" || frm.doc.mapper_type === "Both") {
			frm.trigger("update_card_sequence");
		}
		if (frm.doc.mapper_type === "Dashboard Chart" || frm.doc.mapper_type === "Both") {
			frm.trigger("update_chart_sequence");
		}
	},

	update_card_sequence: function (frm) {
		if (frm.doc.cards && frm.doc.cards.length) {
			frm.doc.cards.forEach((card, idx) => {
				frappe.model.set_value(card.doctype, card.name, "sequence", idx + 1);
				if (card.number_card && !card.card_label) {
					update_card_label(frm, card);
				}
			});
			frm.refresh_field("cards");
		}
	},

	update_chart_sequence: function (frm) {
		if (frm.doc.charts && frm.doc.charts.length) {
			frm.doc.charts.forEach((chart, idx) => {
				frappe.model.set_value(chart.doctype, chart.name, "sequence", idx + 1);
				if (chart.dashboard_chart && !chart.chart_label) {
					update_chart_label(frm, chart);
				}
			});
			frm.refresh_field("charts");
		}
	},

	validate: function (frm) {
		frm.trigger("update_sequences");
	},
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
	frappe.require("list_settings.bundle.js").then(() => {
		new frappe.ui.SVAListSettings({
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
				frappe.show_alert({
					message: __("Listview settings updated"),
					indicator: "green",
				});
			},
		});
	});
};
const set_list_filters = async (frm, cdt, cdn) => {
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
	let allowed_fieldtypes = ["Select", "Link", "Data", "Currency", "Int", "Float"];
	let fields = dtmeta?.message?.filter((d) => allowed_fieldtypes.includes(d.fieldtype));
	frappe.require("list_settings.bundle.js").then(() => {
		new frappe.ui.SVAListSettings({
			doctype:
				row.connection_type == "Report"
					? row.link_report
					: ["Direct", "Unfiltered", "Indirect"].includes(row.connection_type)
					? row.link_doctype
					: row.referenced_link_doctype ?? row.link_doctype,
			meta: fields,
			only_list_settings: true,
			connection_type: row.connection_type,
			settings: row,
			dialog_primary_action: async (listview_settings) => {
				frappe.model.set_value(
					cdt,
					cdn,
					"list_filters",
					JSON.stringify(listview_settings)
				);
				frappe.show_alert({ message: __("List filters updated"), indicator: "green" });
			},
		});
	});
};
const set_crud_permissiions = (frm, cdt, cdn) => {
	let row = locals[cdt][cdn];
	let prev_permissions;
	if (row.connection_type === "Indirect") {
		prev_permissions = JSON.parse(row.crud_permissions ?? '["read"]');
	} else {
		prev_permissions = JSON.parse(
			row.crud_permissions ?? '["read", "write", "create", "delete"]'
		);
	}
	let perms;
	if (row.connection_type === "Indirect") {
		perms = ["read"];
	} else {
		perms = ["read", "write", "create", "delete"];
	}
	let fields = perms.map((p) => {
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
var final_dt_options = [];
var local_fields = [];
var foreign_fields = [];
frappe.ui.form.on("SVADatatable Configuration Child", {
	async form_render(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.connection_type === "Direct") {
			let dts = await frappe.call("frappe_theme.dt_api.get_direct_connection_dts", {
				dt: frm.doc.parent_doctype,
			});
			frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
				return {
					filters: { name: ["IN", dts.message] },
					limit_page_length: 100,
				};
			};
		}
		if (row.connection_type === "Indirect") {
			let res = await frappe.call(
				"frappe_theme.dt_api.get_indirect_connection_local_fields",
				{ dt: frm.doc.parent_doctype }
			);
			local_fields = res.message;
			frm.cur_grid.set_field_property("local_field", "options", local_fields);
		}
		if (row.connection_type === "Unfiltered") {
			frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
				return {
					filters: {
						issingle: 0,
						istable: 0,
					},
				};
			};
		}
		if (row.connection_type === "Referenced") {
			// let modules = await frappe.db.get_list('Module Def', { filters: { 'app_name': ['!=', "frappe"] }, pluck: 'name' });
			let dts = await frappe.db.get_list("DocType", {
				filters: [
					// ['DocType', 'module', 'IN', modules],
					["DocField", "options", "=", "DocType"],
					["DocType", "istable", "=", 0],
				],
				pluck: "name",
				limit: 1000,
			});
			let dts_2 = await frappe.db.get_list("Custom Field", {
				filters: [["Custom Field", "options", "=", "DocType"]],
				fields: ["dt", "fieldname"],
				limit: 1000,
			});
			let dt_options = [];
			if (dts.length) {
				dt_options = dts;
				final_dt_options = dts.map((d) => {
					return { dt: d, parent: "DocType" };
				});
			}
			if (dts_2.length) {
				dt_options = dt_options.concat(dts_2?.map((d) => d.dt));
				final_dt_options = final_dt_options.concat(
					dts_2.map((d) => {
						return { dt: d.dt, fieldname: d.fieldname, parent: "Custom Field" };
					})
				);
			}
			if (dt_options.length) {
				frm.cur_grid.grid_form.fields_dict.referenced_link_doctype.set_data(dt_options);
			}
		}
		if (row.connection_type === "Report") {
			let reports = await frappe.call("frappe_theme.dt_api.link_report_list", {
				doctype: frm.doc.parent_doctype,
			});
			frm.cur_grid.grid_form.fields_dict.link_report.get_query = () => {
				return {
					filters: { name: ["in", reports.message] },
					limit_page_length: 10000,
				};
			};
		}
		let html_fields = await frappe.db.get_list("DocField", {
			filters: { parent: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		let html_fields_2 = await frappe.db.get_list("Custom Field", {
			filters: { dt: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		if (html_fields_2.length) {
			html_fields = html_fields.concat(html_fields_2);
		}
		let filter_fields = filter_html_fields(frm);
		let options = html_fields.map(function (d) {
			return d.fieldname;
		});
		if (filter_fields.length > 0 && frm.doc?.__unsaved == 1) {
			options = options.filter((d) => !filter_fields.includes(d));
		} else {
			filter_fields = filter_fields.filter((d) => d !== row.html_field);
			options = options.filter((d) => !filter_fields.includes(d));
		}
		frm?.cur_grid?.set_field_property("html_field", "options", options);
	},
	connection_type: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.connection_type === "Direct") {
			frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
				return {
					filters: [
						["DocField", "options", "=", frm.doc.parent_doctype],
						["DocField", "parenttype", "=", "DocType"],
					],
					limit_page_length: 100,
				};
			};
		}
		if (row.connection_type === "Indirect") {
			let res = await frappe.call(
				"frappe_theme.dt_api.get_indirect_connection_local_fields",
				{ dt: frm.doc.parent_doctype }
			);
			local_fields = res.message;
			frm.cur_grid.set_field_property("local_field", "options", local_fields);
		}
		if (row.connection_type === "Referenced") {
			// let modules = await frappe.db.get_list('Module Def', { filters: { 'app_name': ['!=', "frappe"] }, pluck: 'name' });
			let dts = await frappe.db.get_list("DocType", {
				filters: [
					// ['DocType', 'module', 'IN', modules],
					["DocField", "options", "=", "DocType"],
					["DocType", "istable", "=", 0],
				],
				pluck: "name",
				limit: 1000,
			});
			let dts_2 = await frappe.db.get_list("Custom Field", {
				filters: [["Custom Field", "options", "=", "DocType"]],
				fields: ["dt", "fieldname"],
				limit: 1000,
			});
			let dt_options = [];
			if (dts.length) {
				dt_options = dts;
				final_dt_options = dts.map((d) => {
					return { dt: d, parent: "DocType" };
				});
			}
			if (dts_2.length) {
				dt_options = dt_options.concat(dts_2?.map((d) => d.dt));
				final_dt_options = final_dt_options.concat(
					dts_2.map((d) => {
						return { dt: d.dt, fieldname: d.fieldname, parent: "Custom Field" };
					})
				);
			}
			if (dt_options.length) {
				frm.cur_grid.grid_form.fields_dict.referenced_link_doctype.set_data(dt_options);
			}
		}
		if (row.connection_type === "Unfiltered") {
			frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
				return {
					filters: [
						["DocType", "issingle", "=", 0],
						["DocType", "istable", "=", 0],
					],
					limit_page_length: 100,
				};
			};
		}
		if (row.connection_type === "Report") {
			let reports = await frappe.call("frappe_theme.dt_api.link_report_list", {
				doctype: frm.doc.parent_doctype,
			});
			frm.cur_grid.grid_form.fields_dict.link_report.get_query = () => {
				return {
					filters: { name: ["in", reports.message] },
					limit_page_length: 10000,
				};
			};
		}
	},
	local_field: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.local_field) {
			frappe.model.set_value(cdt, cdn, "link_doctype", "");
			let selected_local_field = local_fields.find((d) => d.value === row.local_field);
			if (selected_local_field) {
				frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
					return {
						filters: [
							["DocField", "options", "=", selected_local_field.options],
							["DocField", "parenttype", "=", "DocType"],
						],
						limit_page_length: 100,
					};
				};
			}
		}
	},
	link_doctype: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.connection_type == "Direct") {
			if (row.link_doctype) {
				let fields = await frappe.call(
					"frappe_theme.dt_api.get_direct_connection_fields",
					{ dt: frm.doc.parent_doctype, link_dt: row.link_doctype }
				);
				let field = fields.message[0];
				if (field) {
					frappe.model.set_value(cdt, cdn, "link_fieldname", field.fieldname);
				}
			} else {
				frappe.model.set_value(cdt, cdn, "link_fieldname", "");
			}
		}
		if (row.connection_type == "Indirect") {
			if (row.link_doctype) {
				let selected_local_field = local_fields.find((d) => d.value === row.local_field);
				if (selected_local_field) {
					let res = await frappe.call(
						"frappe_theme.dt_api.get_indirect_connection_foreign_fields",
						{ dt: row.link_doctype, local_field_option: selected_local_field?.options }
					);
					foreign_fields = res.message;
					if (foreign_fields.length) {
						frm.cur_grid.set_field_property(
							"foreign_field",
							"options",
							foreign_fields
						);
						frappe.model.set_value(cdt, cdn, "foreign_field", foreign_fields[0].value);
					} else {
						frappe.msgprint(
							__("No Foreign fields found for the selected local field")
						);
					}
				} else {
					frappe.msgprint(__("Please select a local field"));
				}
			}
		}
	},
	referenced_link_doctype: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.referenced_link_doctype) {
			let dt = final_dt_options.find((d) => d.dt === row.referenced_link_doctype);
			let ref_dt_field = "";
			let ref_dn_field = "";
			if (dt.parent === "Custom Field") {
				ref_dt_field = dt.fieldname;
				let ref_dn_fields = await frappe.db.get_list("Custom Field", {
					filters: {
						dt: row.referenced_link_doctype,
						fieldtype: "Dynamic Link",
						options: ref_dt_field,
					},
					fields: ["fieldname"],
				});
				if (ref_dn_fields.length) {
					ref_dn_field = ref_dn_fields[0].fieldname;
				}
			} else {
				let ref_dt_fields = await frappe.db.get_list("DocField", {
					filters: {
						parent: row.referenced_link_doctype,
						fieldtype: "Link",
						options: "DocType",
					},
					fields: ["fieldname"],
				});
				if (ref_dt_fields.length) {
					ref_dt_field = ref_dt_fields[0].fieldname;
				}
				let ref_dn_fields = await frappe.db.get_list("DocField", {
					filters: {
						parent: row.referenced_link_doctype,
						fieldtype: "Dynamic Link",
						options: ref_dt_field,
					},
					fields: ["fieldname"],
				});
				if (ref_dn_fields.length) {
					ref_dn_field = ref_dn_fields[0].fieldname;
				}
			}
			if (ref_dt_field && ref_dn_field) {
				frappe.model.set_value(cdt, cdn, "dt_reference_field", ref_dt_field);
				frappe.model.set_value(cdt, cdn, "dn_reference_field", ref_dn_field);
			}
		} else {
			frappe.model.set_value(cdt, cdn, "dt_reference_field", "");
			frappe.model.set_value(cdt, cdn, "dn_reference_field", "");
		}
	},
	async setup_list_settings(frm, cdt, cdn) {
		await set_list_settings(frm, cdt, cdn);
	},
	async setup_crud_permissions(frm, cdt, cdn) {
		set_crud_permissiions(frm, cdt, cdn);
	},
	async setup_action_list(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let action_list = JSON.parse(row.action_list || "[]");
		let dialog = new frappe.ui.Dialog({
			title: __("Action List"),
			fields: [
				{
					label: __("Action List"),
					fieldname: "action_list",
					fieldtype: "Table",
					options: "Action",
					data: action_list,
					fields: [
						{
							label: __("Label"),
							fieldname: "label",
							fieldtype: "Data",
							in_list_view: 1,
							reqd: 1,
						},
						{
							label: __("Hidden"),
							fieldname: "hidden",
							fieldtype: "Check",
							in_list_view: 1,
							default: 0,
						},
						{
							label: __("Action"),
							fieldname: "action",
							fieldtype: "Code",
							in_list_view: 1,
							reqd: 1,
						},
					],
				},
			],
			primary_action_label: __("Save"),
			primary_action: async (values) => {
				frappe.model.set_value(
					cdt,
					cdn,
					"action_list",
					JSON.stringify(values.action_list)
				);
				dialog.hide();
			},
		});
		dialog.show();
	},
	async setup_list_filters(frm, cdt, cdn) {
		await set_list_filters(frm, cdt, cdn);
	},
});

var child_response_dts = [];
frappe.ui.form.on("SVADatatable Child Conf", {
	async form_render(frm, cdt, cdn) {
		frm.cur_grid.grid_form.fields_dict.parent_doctype.get_query = () => {
			return {
				filters: {
					name: [
						"in",
						frm.doc.child_doctypes.length
							? frm.doc.child_doctypes?.map((i) => {
									return i.link_doctype;
							  })
							: [],
					],
				},
			};
		};
		// let html_fields = await frappe.db.get_list('DocField', { filters: { 'parent': frm.doc.parent_doctype, 'fieldtype': 'HTML' }, fields: ['fieldname'] });
		// let options = html_fields.map(function (d) { return d.fieldname });
		// frm?.cur_grid?.set_field_property('html_field', 'options', options);
	},
	parent_doctype: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		child_response_dts = await frappe.db.get_list("DocField", {
			filters: [
				["DocField", "options", "=", row.parent_doctype],
				["DocField", "parenttype", "=", "DocType"],
			],
			fields: ["parent", "fieldname", "label"],
		});
		frm.cur_grid.grid_form.fields_dict.link_doctype.get_query = () => {
			return {
				filters: {
					name: ["in", response_dts ? child_response_dts.map((d) => d.parent) : []],
				},
			};
		};
	},
	link_doctype: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.link_doctype) {
			let field = child_response_dts.find((d) => d.parent === row.link_doctype);
			if (field) {
				frappe.model.set_value(cdt, cdn, "link_fieldname", field.fieldname);
			}
		} else {
			frappe.model.set_value(cdt, cdn, "link_fieldname", "");
		}
	},
	async setup_list_settings(frm, cdt, cdn) {
		await set_list_settings(frm, cdt, cdn);
	},
	async setup_crud_permissions(frm, cdt, cdn) {
		set_crud_permissiions(frm, cdt, cdn);
	},
	async setup_list_filters(frm, cdt, cdn) {
		await set_list_filters(frm, cdt, cdn);
	},
});
frappe.ui.form.on("SVADatatable Action Conf", {
	async form_render(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.table_type == "Data Table") {
			let dts = [
				...frm.doc.child_doctypes
					.filter((row) => row.connection_type != "Is Custom Design")
					.map((i) => {
						return i.link_doctype || i.referenced_link_doctype;
					}),
				...frm.doc.child_confs.map((i) => {
					return i.link_doctype;
				}),
			];
			frm.cur_grid.get_field("ref_doctype").get_query = () => {
				return {
					filters: { name: ["in", dts] },
				};
			};
		}
	},
	async table_type(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.table_type == "Data Table") {
			let dts = [
				...frm.doc.child_doctypes
					.filter((row) => row.connection_type != "Is Custom Design")
					.map((i) => {
						return i.link_doctype || i.referenced_link_doctype;
					}),
				...frm.doc.child_confs.map((i) => {
					return i.link_doctype;
				}),
			];
			frm.cur_grid.get_field("ref_doctype").get_query = () => {
				return {
					filters: { name: ["in", dts] },
				};
			};
		}
	},
	async setup_workflow_stages(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let res = await frappe.call("frappe_theme.dt_api.get_workflow_with_dt", {
			dt: row.ref_doctype,
		});
		if (res.message) {
			let workflow_states = res.message.states.map((i) => {
				return i.state;
			});
			let prev_stages = JSON.parse(row.workflow_states ?? "[]");
			let fields = workflow_states.map((p) => {
				return {
					label: p,
					fieldname: p,
					fieldtype: "Check",
					default: prev_stages.includes(p),
					onchange: function () {
						const fieldname = this.df.fieldname;
						const value = this.get_value();
						if (value) {
							if (!prev_stages.includes(fieldname)) {
								prev_stages.push(fieldname);
							}
						} else {
							prev_stages = prev_stages.filter((f) => f !== fieldname);
						}
					},
				};
			});
			let workflow_dialog = new frappe.ui.Dialog({
				title: __("Workflow States"),
				fields: fields,
				primary_action_label: __("Save"),
				primary_action: async (values) => {
					frappe.model.set_value(
						cdt,
						cdn,
						"workflow_states",
						JSON.stringify(prev_stages)
					);
					workflow_dialog.hide();
				},
			});
			workflow_dialog.show();
		}
	},
	async setup_targets(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let targets = [
			...frm.doc.child_doctypes.filter((row) => row.connection_type != "Is Custom Design"),
			...frm.doc.number_cards,
			...frm.doc.charts,
		];
		let prev_targets = JSON.parse(row.targets ?? "[]").map((i) => i.name);
		let target_option_fields = [
			{ label: "Data Table", fieldname: "data_table_saction", fieldtype: "Section Break" },
			...frm.doc.child_doctypes
				?.filter(
					(_row) =>
						_row.connection_type != "Is Custom Design" &&
						![row.ref_doctype]?.includes(
							_row.link_doctype || _row.referenced_link_doctype
						)
				)
				?.map((i) => {
					return {
						fieldname: i.link_doctype || i.referenced_link_doctype,
						label: i.link_doctype || i.referenced_link_doctype,
						fieldtype: "Check",
						default: prev_targets?.includes(
							i.link_doctype || i.referenced_link_doctype
						),
						onchange: function () {
							const fieldname = this.df.fieldname;
							const value = this.get_value();
							if (value) {
								if (!prev_targets?.includes(fieldname)) {
									prev_targets?.push(fieldname);
								}
							} else {
								prev_targets = prev_targets?.filter((f) => f !== fieldname);
							}
						},
					};
				}),
			{
				label: "Number Cards",
				fieldname: "number_card_saction",
				fieldtype: "Section Break",
			},
			...frm.doc.number_cards?.map((i) => {
				return {
					fieldname: i.number_card,
					label: i.number_card,
					fieldtype: "Check",
					default: prev_targets.includes(i.number_card),
					onchange: function () {
						const fieldname = this.df.fieldname;
						const value = this.get_value();
						if (value) {
							if (!prev_targets?.includes(fieldname)) {
								prev_targets?.push(fieldname);
							}
						} else {
							prev_targets = prev_targets?.filter((f) => f !== fieldname);
						}
					},
				};
			}),
			{ label: "Charts", fieldname: "chart_saction", fieldtype: "Section Break" },
			...frm.doc.charts?.map((i) => {
				return {
					fieldname: i.dashboard_chart,
					label: i.dashboard_chart,
					fieldtype: "Check",
					default: prev_targets?.includes(i.dashboard_chart),
					onchange: function () {
						const fieldname = this.df.fieldname;
						const value = this.get_value();
						if (value) {
							if (!prev_targets?.includes(fieldname)) {
								prev_targets?.push(fieldname);
							}
						} else {
							prev_targets = prev_targets?.filter((f) => f !== fieldname);
						}
					},
				};
			}),
		];
		let target_dialog = new frappe.ui.Dialog({
			title: __("Targets"),
			fields: target_option_fields,
			primary_action_label: __("Save"),
			primary_action: async () => {
				let type_mapper = {
					child_doctypes: "Data Table",
					number_cards: "Number Card",
					charts: "Chart",
				};
				let selected_targets = targets
					?.filter((row) =>
						prev_targets?.includes(
							row.link_doctype ||
								row.referenced_link_doctype ||
								row.number_card ||
								row.dashboard_chart
						)
					)
					?.map((i) => {
						return {
							type: type_mapper[i.parentfield],
							name:
								i.link_doctype ||
								i.referenced_link_doctype ||
								i.number_card ||
								i.dashboard_chart,
						};
					});
				frappe.model.set_value(cdt, cdn, "targets", JSON.stringify(selected_targets));
				target_dialog.hide();
			},
		});
		target_dialog.show();
	},
});

frappe.ui.form.on("Number Card Child", {
	async form_render(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let html_fields = await frappe.db.get_list("DocField", {
			filters: { parent: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		let html_fields_2 = await frappe.db.get_list("Custom Field", {
			filters: { dt: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		if (html_fields_2.length) {
			html_fields = html_fields.concat(html_fields_2);
		}
		let filter_fields = filter_html_fields(frm);
		let options = html_fields.map(function (d) {
			return d.fieldname;
		});
		if (filter_fields.length > 0 && frm.doc?.__unsaved == 1) {
			options = options.filter((d) => !filter_fields.includes(d));
		} else {
			filter_fields = filter_fields.filter((d) => d !== row.html_field);
			options = options.filter((d) => !filter_fields.includes(d));
		}
		frm?.cur_grid?.set_field_property("html_field", "options", options);

		//
		if (row.fetch_from == "DocField") {
			let number_fields = await frappe.db.get_list("DocField", {
				filters: {
					parent: frm.doc.parent_doctype,
					fieldtype: ["IN", ["Int", "Float", "Currency"]],
				},
				fields: ["fieldname"],
				limit: 1000,
			});
			let number_fields_2 = await frappe.db.get_list("Custom Field", {
				filters: {
					dt: frm.doc.parent_doctype,
					fieldtype: ["IN", ["Int", "Float", "Currency"]],
				},
				fields: ["fieldname"],
				limit: 1000,
			});
			if (number_fields_2.length) {
				number_fields = number_fields.concat(number_fields_2);
			}
			let options = number_fields.map(function (d) {
				return d.fieldname;
			});
			frm?.cur_grid?.set_field_property("field", "options", options);
		}
	},
	fetch_from: async function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.fetch_from == "DocField") {
			let number_fields = await frappe.db.get_list("DocField", {
				filters: {
					parent: frm.doc.parent_doctype,
					fieldtype: ["IN", ["Int", "Float", "Currency"]],
				},
				fields: ["fieldname"],
				limit: 1000,
			});
			let number_fields_2 = await frappe.db.get_list("Custom Field", {
				filters: {
					dt: frm.doc.parent_doctype,
					fieldtype: ["IN", ["Int", "Float", "Currency"]],
				},
				fields: ["fieldname"],
				limit: 1000,
			});
			if (number_fields_2.length) {
				number_fields = number_fields.concat(number_fields_2);
			}
			let options = number_fields.map(function (d) {
				return d.fieldname;
			});
			frm?.cur_grid?.set_field_property("field", "options", options);
		}
	},
	cards_add: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		row.sequence = (frm.doc.cards || []).length;
		row.is_visible = 1;
		frm.refresh_field("cards");
	},

	cards_move: function (frm) {
		frm.trigger("update_card_sequence");
	},

	cards_remove: function (frm) {
		frm.trigger("update_card_sequence");
	},

	number_card: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (!row.number_card) return;
		update_card_label(frm, row);
	},
});

// Dashboard Chart Child table handling
frappe.ui.form.on("Dashboard Chart Child", {
	async form_render(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let html_fields = await frappe.db.get_list("DocField", {
			filters: { parent: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		let html_fields_2 = await frappe.db.get_list("Custom Field", {
			filters: { dt: frm.doc.parent_doctype, fieldtype: "HTML" },
			fields: ["fieldname"],
			limit: 100,
		});
		if (html_fields_2.length) {
			html_fields = html_fields.concat(html_fields_2);
		}
		let filter_fields = filter_html_fields(frm);
		let options = html_fields.map(function (d) {
			return d.fieldname;
		});
		if (filter_fields.length > 0 && frm.doc?.__unsaved == 1) {
			options = options.filter((d) => !filter_fields.includes(d));
		} else {
			filter_fields = filter_fields.filter((d) => d !== row.html_field);
			options = options.filter((d) => !filter_fields.includes(d));
		}
		frm?.cur_grid?.set_field_property("html_field", "options", options);
	},
	charts_add: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		row.sequence = (frm.doc.charts || []).length;
		row.is_visible = 1;
		row.chart_height = 300;
		row.show_legend = 1;
		frm.refresh_field("charts");
	},

	charts_move: function (frm) {
		frm.trigger("update_chart_sequence");
	},

	charts_remove: function (frm) {
		frm.trigger("update_chart_sequence");
	},

	dashboard_chart: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (!row.dashboard_chart) return;
		update_chart_label(frm, row);
	},
});

// Helper functions
function update_card_label(frm, row) {
	frappe.db.get_value("Number Card", row.number_card, ["label"]).then((r) => {
		if (r.message) {
			frappe.model.set_value(row.doctype, row.name, {
				card_label: r.message.label,
			});
		}
	});
}

function update_chart_label(frm, row) {
	frappe.db.get_value("Dashboard Chart", row.dashboard_chart, ["chart_name"]).then((r) => {
		if (r.message) {
			frappe.model.set_value(row.doctype, row.name, {
				chart_label: r.message.chart_name,
			});
		}
	});
}
