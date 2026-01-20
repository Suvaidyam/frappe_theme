const after_child_dialog_render = async (dialog, _frm, mode = "create") => {
	let parent_doc = _frm.config_dialog.get_values(true, false);
	let parent_doctype = parent_doc?.link_doctype || parent_doc?.referenced_link_doctype;
	if (parent_doctype) {
		if (mode === "create") {
			await dialog.set_value("parent_doctype", parent_doctype);
		}
		child_response_dts = await frappe.db.get_list("DocField", {
			filters: [
				["DocField", "options", "=", parent_doctype],
				["DocField", "parenttype", "=", "DocType"],
			],
			fields: ["parent", "fieldname", "label"],
		});
		let dts = await frappe.call("frappe_theme.dt_api.get_direct_connection_dts", {
			dt: parent_doctype,
		});
		dialog.fields_dict.link_doctype.get_query = () => {
			return {
				filters: dts.message.length
					? { name: ["IN", dts.message], istable: 0, issingle: 0 }
					: { name: "No direct connections found." },
				limit_page_length: 1000,
				limit: 1000,
			};
		};
	} else {
		dialog.fields_dict.link_doctype.get_query = () => {
			return {
				filters: { name: "Parent doctype not specified." },
				limit_page_length: 1000,
				limit: 1000,
			};
		};
	}
};
after_render_control = async function (dialog, _frm) {
	let row = dialog.get_values(true, false);
	let doctype = _frm.docname == "Customize Form" ? _frm.doc.doc_type : _frm.docname;
	let is_single = _frm.docname != "Customize Form" ? _frm.doc.issingle : 0;

	let frm = dialog;
	// =============================== Datatable Configuration Part Starts ===============================
	if (row.connection_type === "Direct") {
		let dts = await frappe.call("frappe_theme.dt_api.get_direct_connection_dts", {
			dt: doctype,
		});
		frm.fields_dict.link_doctype.get_query = () => {
			return {
				filters: { name: ["IN", dts.message] },
				limit_page_length: 1000,
				limit: 1000,
			};
		};
	}
	if (row.connection_type === "Indirect") {
		let res = await frappe.call("frappe_theme.dt_api.get_indirect_connection_local_fields", {
			dt: doctype,
		});
		local_fields = res.message;
		frm.set_df_property("local_field", "options", local_fields);
	}
	if (row.connection_type === "Unfiltered") {
		frm.fields_dict.link_doctype.get_query = () => {
			return {
				filters: {
					issingle: 0,
					istable: 0,
				},
			};
		};
	}
	if (row.connection_type === "Referenced") {
		let dts = await frappe.db.get_list("DocType", {
			filters: [
				["DocField", "fieldtype", "=", "Dynamic Link"],
				["DocType", "istable", "=", 0],
			],
			pluck: "name",
			limit_page_length: 1000,
			limit: 1000,
		});
		let dts_2 = await frappe.db.get_list("Custom Field", {
			filters: [["Custom Field", "fieldtype", "=", "Dynamic Link"]],
			fields: ["dt", "fieldname"],
			limit_page_length: 1000,
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
			frm.fields_dict.referenced_link_doctype.set_data(dt_options);
		}
	}
	if (row.connection_type === "Report" && !is_single) {
		let reports = await frappe.call("frappe_theme.dt_api.link_report_list", {
			doctype: doctype,
		});
		frm.fields_dict.link_report.get_query = () => {
			return {
				filters: { name: ["in", reports.message] },
				limit_page_length: 1000,
				limit: 1000,
			};
		};
	}
	const render_child_form = async (dialog, mode = "create", data = {}) => {
		if (dialog.fields_dict?.child_confs?.df?.fields.length) {
			let rows = dialog.get_value("child_confs") || [];
			let fields = dialog.fields_dict.child_confs.df.fields.map((f) => {
				if (["link_doctype"].includes(f.fieldname)) {
					f.read_only = 0;
				}
				return {
					...f,
					[f.fieldtype == "Button" ? "click" : "onchange"]: child_table_field_changes?.[
						f.fieldname
					]
						? child_table_field_changes[f.fieldname].bind(this, _frm)
						: undefined,
					default: data[f.fieldname] || f.default,
				};
			});
			let child_dialog = new frappe.ui.Dialog({
				title: __("Child Configuration"),
				fields: fields,
				size: "large",
				primary_action_label: __("Save"),
				primary_action: async function () {
					let values = this.get_values();
					if (mode == "create") {
						rows.push(values);
					} else {
						let idx = rows.findIndex((r) => r.name == data.name);
						if (idx !== -1) {
							rows[idx] = values;
						}
					}
					dialog.set_df_property("child_confs", "data", rows);
					child_dialog.hide();
					bind_edit_buttons_event(dialog);
				},
			});
			_frm["child_dialog"] = child_dialog;
			child_dialog.show();
			dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
			child_dialog.on_hide = () => {
				dialog.wrapper.find(".modal-backdrop").remove();
			};
			after_child_dialog_render(_frm["child_dialog"], _frm);
		}
	};
	const bind_edit_buttons_event = (dialog) => {
		let edit_button = dialog.fields_dict?.child_confs?.$wrapper.find(
			'[data-original-title="Edit"]'
		);
		let rows = dialog.get_value("child_confs") || [];
		edit_button.off("click");
		edit_button.on("click", function (e) {
			let $row = $(this).closest(".grid-row");
			let idx = cint($row.attr("data-idx")) - 1;
			let row = rows[idx];
			render_child_form(dialog, "write", row);
		});
	};
	let add_button = dialog.$wrapper.find(".grid-add-row");
	if (add_button.length) {
		add_button.off("click");
		add_button.on("click", function () {
			render_child_form(dialog, "create");
		});
	}
	bind_edit_buttons_event(dialog);
	// ============================ Datatable Configuration Part Ends ============================

	// ++++++++++++++++++++++++++++ Heatmap Configuration Part Starts ++++++++++++++++++++++++++++
	let slected_targets = JSON.parse(row.target_fields || "[]").map((field) => {
		return { label: field.label, value: field.fieldname };
	});
	frm.set_df_property("primary_target", "options", slected_targets);
	// ++++++++++++++++++++++++++++ Heatmap Configuration Part Ends ++++++++++++++++++++++++++++
};
function clear_fields(dialog, field_list) {
	for (let field of field_list) {
		if (field.ft === "Check") {
			dialog?.set_value(field.fn, 0);
			continue;
		} else if (field.ft === "Table") {
			dialog?.set_df_property(field.fn, "data", []);
			continue;
		} else {
			if (field.fn == "crud_permissions") {
				dialog?.set_value(field.fn, JSON.stringify(["read"]));
				continue;
			}
			dialog?.set_value(field.fn, "");
			continue;
		}
	}
}
const field_changes = {
	property_type: async function (frm) {
		let dt_fields_being_affected = [
			{ fn: "hide_table", ft: "Check" },
			{ fn: "template", ft: "Select" },
			{ fn: "link_report", ft: "Link" },
			{ fn: "report_ref_dt", ft: "Link" },
			{ fn: "referenced_link_doctype", ft: "Link" },
			{ fn: "dt_reference_field", ft: "Link" },
			{ fn: "local_field", ft: "Link" },
			{ fn: "link_doctype", ft: "Link" },
			{ fn: "crud_permissions", ft: "Code" },
			{ fn: "list_filters", ft: "Data" },
			{ fn: "title", ft: "Data" },
			{ fn: "disable_edit_depends_on", ft: "Code" },
			{ fn: "disable_delete_depends_on", ft: "Code" },
			{ fn: "endpoint", ft: "Data" },
			{ fn: "report_type", ft: "Data" },
			{ fn: "dn_reference_field", ft: "Data" },
			{ fn: "foreign_field", ft: "Select" },
			{ fn: "link_fieldname", ft: "Data" },
			{ fn: "listview_settings", ft: "Code" },
			{ fn: "action_list", ft: "Code" },
			{ fn: "action_label", ft: "Data" },
			{ fn: "disable_add_depends_on", ft: "Code" },
			{ fn: "disable_workflow_depends_on", ft: "Code" },
			{ fn: "unfiltered", ft: "Check" },
			{ fn: "add_row_button_label", ft: "Data" },
			{ fn: "extend_condition", ft: "Check" },
			{ fn: "extended_condition", ft: "Code" },
			{ fn: "allow_export", ft: "Check" },
			{ fn: "allow_import", ft: "Check" },
			{ fn: "keep_workflow_enabled_form_submission", ft: "Check" },
			{ fn: "redirect_to_main_form", ft: "Check" },
			{ fn: "full_screen_dialog", ft: "Check" },
			{ fn: "disable_workflow", ft: "Check" },
			{ fn: "child_confs", ft: "Table" },
		];

		let heat_map_fields_being_affected = [
			{ fn: "heatmap_report", ft: "Link" },
			{ fn: "target_fields", ft: "Code" },
			{ fn: "primary_target", ft: "Select" },
			{ fn: "block_height", ft: "Int" },
			{ fn: "min_data_color", ft: "Color" },
			{ fn: "max_data_color", ft: "Color" },
		];

		let number_card_fields_being_affected = [
			{ fn: "number_card", ft: "Link" },
			{ fn: "icon", ft: "Icon" },
			{ fn: "icon_color", ft: "Color" },
			{ fn: "background_color", ft: "Color" },
			{ fn: "text_color", ft: "Color" },
			{ fn: "value_color", ft: "Color" },
			{ fn: "border_color", ft: "Color" },
			{ fn: "card_hover_background_color", ft: "Color" },
			{ fn: "card_hover_text_color", ft: "Color" },
			{ fn: "card_hover_value_color", ft: "Color" },
			{ fn: "hover_border_color", ft: "Color" },
		];

		let connecttion_type_map = {
			"DocType (Indirect)": "Indirect",
			"DocType (Direct)": "Direct",
			"DocType (Unfiltered)": "Unfiltered",
			"DocType (Referenced)": "Referenced",
			Report: "Report",
		};
		let property_type = frm?.config_dialog?.get_value("property_type");
		if (!property_type) {
			frm?.config_dialog?.set_value("connection_type", "");
			clear_fields(frm?.config_dialog, dt_fields_being_affected);
			clear_fields(frm?.config_dialog, heat_map_fields_being_affected);
			clear_fields(frm?.config_dialog, number_card_fields_being_affected);
			frm?.config_dialog.set_value("html_block", "");
			frm?.config_dialog.set_value("chart", "");
		}
		if (property_type in connecttion_type_map) {
			frm?.config_dialog?.set_value("connection_type", connecttion_type_map[property_type]);
			clear_fields(frm?.config_dialog, dt_fields_being_affected);
		} else {
			frm?.config_dialog?.set_value("connection_type", "");
		}
	},
	// ============================== Datatable Configuration Part Starts ==============================
	connection_type: async function (frm) {
		await after_render_control(frm.config_dialog, frm);
	},
	local_field: async function (frm) {
		let row = frm.config_dialog.get_values(true, false);
		if (row.local_field) {
			frm.config_dialog.set_value("link_doctype", "");
			let selected_local_field = local_fields.find((d) => d.value === row.local_field);
			if (selected_local_field) {
				frm.config_dialog.fields_dict.link_doctype.get_query = () => {
					return {
						filters: [
							["DocField", "options", "=", selected_local_field.options],
							["DocField", "parenttype", "=", "DocType"],
						],
						limit_page_length: 1000,
						limit: 1000,
					};
				};
			}
		}
	},
	link_doctype: async function (frm) {
		let row = frm.config_dialog.get_values(true, false);
		let doctype = frm.docname == "Customize Form" ? frm.doc.doc_type : frm.docname;
		if (row.connection_type == "Direct") {
			if (row.link_doctype) {
				let fields = await frappe.call(
					"frappe_theme.dt_api.get_direct_connection_fields",
					{ dt: doctype, link_dt: row.link_doctype }
				);
				let field = fields.message[0];
				if (field) {
					frm.config_dialog.set_value("link_fieldname", field.fieldname);
				}
			} else {
				frm.config_dialog.set_value("link_fieldname", "");
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
						frm.config_dialog.set_df_property(
							"foreign_field",
							"options",
							foreign_fields
						);
						frm.config_dialog.set_value("foreign_field", foreign_fields[0].value);
					} else {
						frappe.msgprint(
							__("No Foreign fields found for the selected local field.")
						);
					}
				} else {
					frappe.msgprint(__("Please select a local field."));
				}
			}
		}
	},
	referenced_link_doctype: async function (frm) {
		let row = frm.config_dialog.get_values(true, false);
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
				frm.config_dialog.set_value("dt_reference_field", ref_dt_field);
				frm.config_dialog.set_value("dn_reference_field", ref_dn_field);
			}
		} else {
			frm.config_dialog.set_value("dt_reference_field", "");
			frm.config_dialog.set_value("dn_reference_field", "");
		}
	},
	setup_list_settings: function (frm) {
		set_list_settings(frm.config_dialog);
	},
	setup_crud_permissions: function (frm) {
		set_crud_permissiions(frm.config_dialog);
	},
	setup_action_list: function (frm) {
		let row = frm.config_dialog.get_values(true, false);
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
				frm.config_dialog.set_value("action_list", JSON.stringify(values.action_list));
				dialog.hide();
			},
		});
		dialog.show();
	},
	async setup_list_filters(frm) {
		await set_list_filters(frm.config_dialog);
	},
	// ============================== Datatable Configuration Part Ends ===============================

	// ++++++++++++++++++++++++++++ Heatmap Configuration Part Starts ++++++++++++++++++++++++++++
	target_fields: async function (frm) {
		let row = frm.config_dialog.get_values(true, false);
		let slected_targets = JSON.parse(row.target_fields || "[]").map((field) => {
			return { label: field.label, value: field.fieldname };
		});
		frm.config_dialog.set_df_property("primary_target", "options", slected_targets);
	},
	heatmap_report: async function (frm) {
		const row = frm.config_dialog.get_values(true, false);
		if (row.heatmap_report) {
			let affected_fields = [
				{ fn: "primary_target", ft: "Select" },
				{ fn: "target_fields", ft: "Code" },
				{ fn: "block_height", ft: "Int" },
				{ fn: "min_data_color", ft: "Color" },
				{ fn: "max_data_color", ft: "Color" },
			];
			for (let field of affected_fields) {
				frm.config_dialog.set_value(field.fn, "");
			}
			let res = await frappe.call({
				method: "frappe.desk.query_report.run",
				args: { report_name: row.heatmap_report },
			});
			if (!res.message?.columns) {
				frappe.throw(__("The selected report does not have any columns."));
				return;
			} else {
				// check if tere is at least state or district field
				let has_location_field = res.message?.columns?.some((col) => {
					return ["State", "District"].includes(col.options);
				});
				if (!has_location_field) {
					frappe.throw(
						__(
							"The selected report must have at least one field with State or District as options."
						)
					);
					return;
				} else {
					// check if there is at least one numeric field
					let has_numeric_field = res.message?.columns?.some((col) => {
						return ["Int", "Float", "Currency"].includes(col.fieldtype);
					});
					if (!has_numeric_field) {
						frappe.throw(
							__("The selected report must have at least one numeric field.")
						);
						return;
					}
				}
			}
		}
	},
	setup_target_fields: async function (frm) {
		const row = frm.config_dialog.get_values(true, false);
		if (row.heatmap_report) {
			let res = await frappe.call({
				method: "frappe.desk.query_report.run",
				args: { report_name: row.heatmap_report },
			});
			if (!res.message?.columns) {
				frappe.throw(__("The selected report does not have any columns."));
			} else {
				// check if tere is at least state or district field
				let has_location_field = res.message?.columns?.some((col) => {
					return ["State", "District"].includes(col.options);
				});
				if (!has_location_field) {
					frappe.throw(
						__(
							"The selected report must have at least one field with State or District as options."
						)
					);
				} else {
					// check if there is at least one numeric field
					let has_numeric_field = res.message?.columns?.some((col) => {
						return ["Int", "Float", "Currency"].includes(col.fieldtype);
					});
					if (!has_numeric_field) {
						frappe.throw(
							__("The selected report must have at least one numeric field.")
						);
					}
				}
			}
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

					frm.config_dialog.set_value("target_fields", JSON.stringify(target_fields));
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
	// ++++++++++++++++++++++++++++ Heatmap Configuration Part Ends ++++++++++++++++++++++++++++++
};
var child_response_dts = [];
const child_table_field_changes = {
	link_doctype: async function (frm) {
		let row = frm?.child_dialog?.get_values(true, false);
		if (row.link_doctype) {
			let field = child_response_dts.find((d) => d.parent === row.link_doctype);
			if (field) {
				frm?.child_dialog.set_value("link_fieldname", field.fieldname);
			}
		} else {
			frm?.child_dialog.set_value("link_fieldname", "");
		}
	},
	setup_list_settings: function (frm) {
		set_list_settings(frm.child_dialog);
	},
	setup_crud_permissions: function (frm) {
		set_crud_permissiions(frm.child_dialog);
	},
	setup_list_filters: function (frm) {
		set_list_filters(frm.child_dialog);
	},
};

const set_list_settings = async (dialog) => {
	let row = dialog.get_values(true, false);
	let dtmeta = await frappe.call({
		method: "frappe_theme.dt_api.get_meta_fields",
		args: {
			doctype:
				row.connection_type == "Report"
					? row.link_report
					: ["Direct", "Unfiltered", "Indirect"].includes(
							row?.connection_type || "Direct"
					  )
					? row.link_doctype
					: row.referenced_link_doctype ?? row.link_doctype,
			_type: row?.connection_type || "Direct",
		},
	});
	frappe.require("list_settings.bundle.js").then(() => {
		let d = new frappe.ui.SVAListSettings({
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
				dialog.set_value("listview_settings", JSON.stringify(listview_settings));
				frappe.show_alert({
					message: __("Listview settings updated"),
					indicator: "green",
				});
			},
		});
		dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
		d.dialog.on_hide = () => {
			dialog.wrapper.find(".modal-backdrop").remove();
		};
	});
};
const set_list_filters = async (dialog) => {
	let row = dialog.get_values(true, false);
	let dtmeta = await frappe.call({
		method: "frappe_theme.dt_api.get_meta_fields",
		args: {
			doctype:
				row.connection_type == "Report"
					? row.link_report
					: ["Direct", "Unfiltered", "Indirect"].includes(
							row?.connection_type || "Direct"
					  )
					? row.link_doctype
					: row.referenced_link_doctype ?? row.link_doctype,
			_type: row.connection_type,
		},
	});
	let allowed_fieldtypes = ["Select", "Link", "Data", "Currency", "Int", "Float"];
	let fields = dtmeta?.message?.filter((d) => allowed_fieldtypes.includes(d.fieldtype));
	frappe.require("list_settings.bundle.js").then(() => {
		let d = new frappe.ui.SVAListSettings({
			doctype:
				row.connection_type == "Report"
					? row.link_report
					: ["Direct", "Unfiltered", "Indirect"].includes(
							row?.connection_type || "Direct"
					  )
					? row.link_doctype
					: row.referenced_link_doctype ?? row.link_doctype,
			meta: fields,
			only_list_settings: true,
			connection_type: row?.connection_type || "Direct",
			settings: row,
			dialog_primary_action: async (listview_settings) => {
				dialog.set_value("list_filters", JSON.stringify(listview_settings));
				frappe.show_alert({ message: __("List filters updated"), indicator: "green" });
			},
		});
		dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
		d.dialog.on_hide = () => {
			dialog.wrapper.find(".modal-backdrop").remove();
		};
	});
};
const set_crud_permissiions = (dialog) => {
	let row = dialog.get_values(true, false);
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
			dialog.set_value("crud_permissions", JSON.stringify(prev_permissions));
			permissions_dialog.hide();
		},
	});
	permissions_dialog.show();
	dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
	permissions_dialog.on_hide = () => {
		dialog.wrapper.find(".modal-backdrop").remove();
	};
};

var final_dt_options = [];
var local_fields = [];
var foreign_fields = [];

async function customPropertySetter(frm) {
	setTimeout(() => {
		let fields = frm.$wrapper.find(".field");
		fields.each(function () {
			let el = this;
			// Click listener (optional)
			el.addEventListener("click", () => {
				let control = el.querySelector(".control.frappe-control.editable[data-fieldname]");

				if (control) {
					let fieldname = control.dataset.fieldname;
					let fieldtype = control.dataset.fieldtype;
					let controls = document.querySelector(".control-data");
					if (controls) {
						let oldBtn = controls.querySelector("#custom_property_setter_btn");
						if (!oldBtn) {
							let btn = document.createElement("button");
							btn.innerText = "Custom Property Setter";
							btn.className = "btn btn-sm btn-default btn-block";
							btn.id = "custom_property_setter_btn";
							btn.style.marginBottom = "10px"; // optional
							btn.addEventListener("click", async () => {
								let fields = await frappe.call(
									"frappe_theme.api.get_meta_fields",
									{
										doctype: "Custom Property Setter",
									}
								);
								let doctype =
									frm.docname == "Customize Form"
										? frm.doc.doc_type
										: frm.docname;
								let props = await frappe.db.get_list("Property Setter", {
									filters: {
										doc_type: doctype,
										field_name: fieldname,
										doctype_or_field: "DocField",
										property: "sva_ft",
									},
									fields: ["*"],
								});
								let prop = props?.length > 0 ? props[0] : null;
								if (prop) {
									try {
										let values = JSON.parse(prop.value);
										for (let field of fields.message) {
											if (values[field.fieldname]) {
												field.default =
													values[field.fieldname] || field.default;
											}
										}
									} catch (error) {
										console.log("Exception in Custom Property Setter");
									}
								}
								let dialog_fields = [];
								if (fields.message) {
									dialog_fields = await Promise.all(
										fields.message.map(async (field) => {
											if (field.fieldtype == "Table") {
												let table_fields = await frappe.call(
													"frappe_theme.api.get_meta_fields",
													{
														doctype: field.options,
													}
												);
												let table_data = [];
												if (prop) {
													try {
														let values = JSON.parse(prop.value);
														table_data = values[field.fieldname] || [];
													} catch (error) {
														console.log(
															"Exception in Custom Property Setter for Table Field"
														);
													}
												}
												return {
													...field,
													data: table_data,
													fields: table_fields.message,
												};
											}
											return {
												...field,
												[field.fieldtype == "Button"
													? "click"
													: "onchange"]: field_changes?.[field.fieldname]
													? field_changes[field.fieldname].bind(
															this,
															frm
													  )
													: undefined,
												default:
													field.fieldname == "fieldtype"
														? fieldtype
														: field.fieldname == "fieldname"
														? fieldname
														: field.default,
											};
										})
									);
									let dialog = new frappe.ui.Dialog({
										title: "Custom Property Setter",
										fields: dialog_fields,
										size: frappe.utils.get_dialog_size(dialog_fields),
										primary_action_label: "Save",
										primary_action: async function () {
											let values = dialog.get_values();
											let new_val = JSON.stringify(
												Object.keys(values)
													.filter(
														(key) =>
															!["fieldname", "fieldtype"].includes(
																key
															)
													)
													.reduce((acc, key) => {
														acc[key] = values[key];
														return acc;
													}, {})
											);

											if (prop) {
												await frappe.db.set_value(
													"Property Setter",
													prop.name,
													"value",
													new_val
												);
											} else {
												let doc = {
													doctype: "Property Setter",
													field_name: values.fieldname,
													doc_type: doctype,
													doctype_or_field: "DocField",
													property: "sva_ft",
													value: new_val,
												};
												let new_doc = await frappe.db.insert(doc);
											}
											dialog.hide();
										},
									});
									frm["config_dialog"] = dialog;
									dialog.show();

									await after_render_control(dialog, frm);
								}
							});
							controls.prepend(btn);
						}
					}
				}
			});

			// Mutation observer to detect class change
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (mutation.attributeName === "class") {
						if (el.classList.contains("field selected")) {
							// frm.fields_dict[chart.fieldname];
							// get child of el with class 'control frappe-control editable'
							let controlData = el.querySelectorAll(".frappe-control.editable");

							controlData.forEach(function (control) {
								console.log(control);
							});
						}
					}
				});
			});

			observer.observe(el, {
				attributes: true,
				attributeFilter: ["class"],
			});
		});
	}, 1000);
}
