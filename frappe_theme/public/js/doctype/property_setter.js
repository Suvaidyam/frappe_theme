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
					let values = this.get_values(true, false); // include hidden fields (e.g. vdr_batch_config)
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
	let add_button = dialog.fields_dict?.child_confs?.$wrapper.find(".grid-add-row");
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

		let carousel_fields_being_affected = [{ fn: "carousel", ft: "Table" }];

		let vdr_fields_being_affected = [
			{ fn: "vdr_doctype", ft: "Link" },
			{ fn: "vdr_docs", ft: "Code" },
			{ fn: "vdr_column_configs", ft: "Code" },
			{ fn: "vdr_column_label_field", ft: "Data" },
			{ fn: "vdr_column_bg_color", ft: "Color" },
			{ fn: "vdr_column_text_color", ft: "Color" },
			{ fn: "vdr_title", ft: "Data" },
			{ fn: "vdr_fields_to_show", ft: "Code" },
			{ fn: "vdr_fields_to_hide", ft: "Code" },
			{ fn: "vdr_link_title_fields", ft: "Code" },
			{ fn: "vdr_column_color_rules", ft: "Code" },
			{ fn: "vdr_column_order_rules", ft: "Code" },
			{ fn: "vdr_show_sections", ft: "Check" },
			{ fn: "vdr_section_configs", ft: "Code" },
			{ fn: "vdr_show_unit", ft: "Check" },
			{ fn: "vdr_hide_empty_rows", ft: "Check" },
			{ fn: "vdr_show_legend", ft: "Check" },
			{ fn: "vdr_legend_items", ft: "Code" },
			{ fn: "vdr_max_height", ft: "Int" },
			{ fn: "vdr_column_batch_size", ft: "Int" },
			{ fn: "vdr_column_width", ft: "Int" },
			{ fn: "vdr_label_width", ft: "Int" },
			{ fn: "vdr_table_max_rows", ft: "Int" },
			{ fn: "vdr_link_fieldname", ft: "Data" },
			{ fn: "vdr_foreign_field", ft: "Data" },
			{ fn: "vdr_order_by", ft: "Data" },
			{ fn: "vdr_extra_filters", ft: "Code" },
			{ fn: "vdr_use_custom_script", ft: "Check" },
			{ fn: "vdr_custom_docs_script", ft: "Code" },
			{ fn: "vdr_fields_config", ft: "Code" },
			{ fn: "vdr_batch_config", ft: "Code" },
			{ fn: "vdr_child_add_row_labels", ft: "Code" },
			{ fn: "crud_permissions", ft: "Code" },
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
			clear_fields(frm?.config_dialog, carousel_fields_being_affected);
			clear_fields(frm?.config_dialog, vdr_fields_being_affected);
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
	// ===================================== is Report Checkbox changes ================================
	is_report: function (frm) {
		let is_checked = frm?.config_dialog.get_value("is_report");
		if (is_checked) {
			frm?.config_dialog.set_value("connection_type", "Report");
		} else {
			frm?.config_dialog.set_value("connection_type", "");
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
						{
							dt: row.link_doctype,
							local_field_option: selected_local_field?.options,
						}
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
	setup_vdr_batch_config: function (frm) {
		set_vdr_batch_config(frm.config_dialog);
	},
	setup_vdr_child_add_row_labels: function (frm) {
		set_vdr_child_add_row_labels(frm.config_dialog);
	},
	setup_crud_permissions: function (frm) {
		set_crud_permissiions(frm.config_dialog);
	},
	setup_vdr_column_configs: async function (frm) {
		const row = frm.config_dialog.get_values(true, false);
		if (!row.vdr_doctype) {
			frappe.msgprint({
				message: __("Please set the Source DocType first."),
				indicator: "orange",
			});
			return;
		}
		const dtmeta = await frappe.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			args: { doctype: row.vdr_doctype, _type: "Direct" },
		});
		const SKIP = new Set([
			"Section Break",
			"Column Break",
			"Tab Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Geolocation",
			"Barcode",
			"Table",
		]);
		const field_options = [{ label: __("— document name —"), value: "" }].concat(
			(dtmeta.message || [])
				.filter((f) => !SKIP.has(f.fieldtype))
				.map((f) => ({
					label: `${f.label || f.fieldname} (${f.fieldname})`,
					value: f.fieldname,
				}))
		);
		const dialog = new frappe.ui.Dialog({
			title: __("Setup Column Configs"),
			fields: [
				{
					label: __("Column Label Field"),
					fieldname: "column_label_field",
					fieldtype: "Select",
					options: field_options,
					default: row.vdr_column_label_field || "",
					description: __(
						"Field from the source DocType to use as each column header label. Leave blank to use the document name."
					),
				},
				{ fieldtype: "Column Break" },
				{
					label: __("Column Background Color"),
					fieldname: "column_bg_color",
					fieldtype: "Color",
					default: row.vdr_column_bg_color || "#4472C4",
				},
				{
					label: __("Column Text Color"),
					fieldname: "column_text_color",
					fieldtype: "Color",
					default: row.vdr_column_text_color || "#ffffff",
				},
			],
			primary_action_label: __("Save"),
			primary_action: async (values) => {
				frm.config_dialog.set_value(
					"vdr_column_label_field",
					values.column_label_field || ""
				);
				frm.config_dialog.set_value("vdr_column_bg_color", values.column_bg_color || "");
				frm.config_dialog.set_value(
					"vdr_column_text_color",
					values.column_text_color || ""
				);
				dialog.hide();
			},
		});
		dialog.show();
		frm.config_dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
		dialog.on_hide = () => {
			frm.config_dialog.wrapper.find(".modal-backdrop").remove();
		};
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
				{ fn: "state_name_column", ft: "Data" },
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
				let has_location_field =
					res.message?.columns?.some((col) => {
						return ["State", "District"].includes(col.options);
					}) || row?.state_name_column;
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
				let has_location_field =
					res.message?.columns?.some((col) => {
						return ["State", "District"].includes(col.options);
					}) || row?.state_name_column;
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
	sdg_setup_target_fields: async function (frm) {
		const row = frm.config_dialog.get_values(true, false);
		if (row.sdg_report) {
			let res = await frappe.call({
				method: "frappe.desk.query_report.run",
				args: { report_name: row.sdg_report },
			});
			if (!res.message?.columns) {
				frappe.throw(__("The selected report does not have any columns."));
			} else {
				// check if tere is at least state or district field
				let has_sdg_field =
					res.message?.columns?.some((col) => {
						return ["SDGs"].includes(col.options);
					}) || row?.sdg_name_column;
				if (!has_sdg_field) {
					frappe.throw(
						__(
							"The selected report must have at least one field with SDGs as options or SDG Name Column."
						)
					);
				} else {
					// check if there is at least one numeric field
					let has_numeric_field = res.message?.columns?.some((col) => {
						return ["Int", "Float", "Currency", "Percent"].includes(col.fieldtype);
					});
					if (!has_numeric_field) {
						frappe.throw(
							__("The selected report must have at least one numeric field.")
						);
					}
				}
			}
			let fields = res.message?.columns
				?.filter((col) => ["Int", "Float", "Currency", "Percent"].includes(col.fieldtype))
				?.map((col) => {
					return {
						label: col.label,
						fieldname: col.fieldname,
						fieldtype: col.fieldtype,
					};
				});
			let prev_targets = JSON.parse(row.sdg_target_fields || "[]").map((field) => {
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
					let sdg_target_fields = [];
					fields.forEach((field) => {
						if (values[field.fieldname]) {
							sdg_target_fields.push({
								fieldname: field.fieldname,
								label: field.label,
								fieldtype: field.fieldtype,
							});
						}
					});
					frm.config_dialog.set_value(
						"sdg_target_fields",
						JSON.stringify(sdg_target_fields)
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
	setup_vdr_batch_config: function (frm) {
		set_vdr_batch_config(frm.child_dialog);
	},
	setup_vdr_child_add_row_labels: function (frm) {
		set_vdr_child_add_row_labels(frm.child_dialog);
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

	// VDR: custom field-row picker (not SVAListSettings which is for Datatable columns)
	if (row.property_type === "Vertical Doc Renderer") {
		if (!row.vdr_doctype) {
			frappe.msgprint({
				message: __("Please set the Source DocType first."),
				indicator: "orange",
			});
			return;
		}

		const dtmeta = await frappe.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			args: { doctype: row.vdr_doctype, _type: "Direct" },
		});

		// get_meta_fields without meta_attached returns a flat fields array
		const SKIP_TYPES = new Set([
			"Column Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Geolocation",
			"Barcode",
			"Tab Break",
			"Section Break",
		]);
		const allFields = (dtmeta.message || []).filter(
			(f) => !SKIP_TYPES.has(f.fieldtype) && !f.hidden
		);

		if (!allFields.length) {
			frappe.msgprint({
				message: __("No configurable fields found for the selected DocType."),
				indicator: "orange",
			});
			return;
		}

		// Pre-populate from existing vdr_fields_config
		let existingConfig = [];
		try {
			existingConfig = JSON.parse(row.vdr_fields_config || "[]");
		} catch {
			existingConfig = [];
		}

		let orderedFields;
		if (existingConfig.length) {
			const fieldMap = new Map(allFields.map((f) => [f.fieldname, f]));
			const configSet = new Set(existingConfig);
			orderedFields = [
				...existingConfig
					.map((fn) => fieldMap.get(fn))
					.filter(Boolean)
					.map((f) => ({ f, checked: true })),
				...allFields
					.filter((f) => !configSet.has(f.fieldname))
					.map((f) => ({ f, checked: false })),
			];
		} else {
			orderedFields = allFields.map((f) => ({ f, checked: true }));
		}

		const listHtml = orderedFields
			.map(
				({ f, checked }) => `
			<div class="sva-vdr-ls-item" data-fieldname="${f.fieldname}" style="
				display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:2px;
				background:var(--control-bg,#f8f9fa);border:1px solid var(--border-color,#d1d8dd);
				border-radius:4px;cursor:grab;user-select:none;
			">
				<span class="sva-vdr-ls-handle" style="color:var(--text-muted,#888);font-size:16px;line-height:1;flex-shrink:0;">≡</span>
				<input type="checkbox" class="sva-vdr-ls-check" ${checked ? "checked" : ""}
					style="margin:0;cursor:pointer;width:14px;height:14px;flex-shrink:0;" />
				<span style="font-size:13px;color:var(--text-color,#333);flex:1;">${__(
					f.label || f.fieldname
				)}</span>
				<span style="font-size:11px;color:var(--text-muted,#888);">${f.fieldtype}</span>
			</div>`
			)
			.join("");

		const vdr_ls_dialog = new frappe.ui.Dialog({
			title: __("Configure Field Rows — {0}", [row.vdr_doctype]),
			fields: [
				{
					fieldname: "hint",
					fieldtype: "HTML",
					options: `<p style="color:var(--text-muted,#888);font-size:12px;margin:0 0 10px 0;">
						${__("Drag ≡ to reorder. Uncheck to hide a row.")}
					</p>`,
				},
				{
					fieldname: "field_list",
					fieldtype: "HTML",
					options: `<div class="sva-vdr-ls-list" style="max-height:460px;overflow-y:auto;padding:2px 0;">${listHtml}</div>`,
				},
			],
			primary_action_label: __("Save"),
			primary_action() {
				const listEl = vdr_ls_dialog.$wrapper[0].querySelector(".sva-vdr-ls-list");
				if (!listEl) return;

				const newConfig = [];
				listEl.querySelectorAll(".sva-vdr-ls-item").forEach((item) => {
					const cb = item.querySelector(".sva-vdr-ls-check");
					if (cb && cb.checked) newConfig.push(item.dataset.fieldname);
				});

				if (!newConfig.length) {
					frappe.msgprint({
						message: __("Select at least one field to display."),
						indicator: "red",
					});
					return;
				}

				dialog.set_value("vdr_fields_config", JSON.stringify(newConfig));
				frappe.show_alert({ message: __("Row settings updated"), indicator: "green" });
				vdr_ls_dialog.hide();
			},
			secondary_action_label: __("Select All"),
			secondary_action() {
				const listEl = vdr_ls_dialog.$wrapper[0].querySelector(".sva-vdr-ls-list");
				if (!listEl) return;
				listEl.querySelectorAll(".sva-vdr-ls-check").forEach((cb) => {
					cb.checked = true;
				});
			},
		});

		vdr_ls_dialog.show();
		dialog.wrapper.append(`<div class="modal-backdrop fade show"></div>`);
		vdr_ls_dialog.on_hide = () => {
			dialog.wrapper.find(".modal-backdrop").remove();
		};

		// Frappe HTML fields render synchronously before show() returns — init DnD immediately
		const _vdrListEl = vdr_ls_dialog.$wrapper[0].querySelector(".sva-vdr-ls-list");
		if (_vdrListEl) {
			if (typeof Sortable !== "undefined") {
				new Sortable(_vdrListEl, {
					handle: ".sva-vdr-ls-handle",
					draggable: ".sva-vdr-ls-item",
					animation: 120,
				});
			} else {
				// Native HTML5 DnD fallback when Sortable.js is not available
				let _dragSrc = null;
				_vdrListEl.querySelectorAll(".sva-vdr-ls-item").forEach((item) => {
					item.setAttribute("draggable", "true");
					item.addEventListener("dragstart", (e) => {
						_dragSrc = item;
						e.dataTransfer.effectAllowed = "move";
						item.style.opacity = "0.4";
					});
					item.addEventListener("dragend", () => {
						item.style.opacity = "";
						_vdrListEl
							.querySelectorAll(".sva-vdr-ls-item")
							.forEach((i) => (i.style.outline = ""));
					});
					item.addEventListener("dragover", (e) => {
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
						_vdrListEl
							.querySelectorAll(".sva-vdr-ls-item")
							.forEach((i) => (i.style.outline = ""));
						item.style.outline = "2px solid var(--primary,#2490ef)";
					});
					item.addEventListener("drop", (e) => {
						e.preventDefault();
						item.style.outline = "";
						if (_dragSrc && _dragSrc !== item) {
							const allItems = [..._vdrListEl.querySelectorAll(".sva-vdr-ls-item")];
							if (allItems.indexOf(_dragSrc) < allItems.indexOf(item)) {
								item.after(_dragSrc);
							} else {
								item.before(_dragSrc);
							}
						}
					});
				});
			}
		}

		return;
	}

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
// ─── VDR Batch Config Setup ───────────────────────────────────────────────────

const set_vdr_batch_config = (dialog) => {
	const row = dialog.get_values(true, false);

	// Parse existing config, fall back to sensible defaults
	let cfg = {
		enable_batch_config: false,
		allow_add_more_table: false,
		add_more_button_label: "Add More",
		add_more_doctype: row.vdr_doctype || "",
		grouping_field: "",
		plot_link_field: "",
		default_collapsed_new_table: true,
		batch_title_prefix: "Soil Parameters - Batch",
		allow_delete_batch: false,
		delete_batch_button_label: "Delete Batch",
		copy_fields_only: [],
	};
	try {
		const saved = JSON.parse(row.vdr_batch_config || "{}");
		Object.assign(cfg, saved);
	} catch (e) {
		console.warn("Failed to parse existing batch config, using defaults", e);
	}

	const batchDialog = new frappe.ui.Dialog({
		title: __("Setup Batch Config"),
		fields: [
			{
				fieldname: "hint",
				fieldtype: "HTML",
				options: `<p style="color:var(--text-muted,#888);font-size:12px;margin:0 0 10px 0;">
					${__(
						'Configure the stacked batch feature. When enabled, an "Add More" button appears below the VDR table and creates a new batch of records (one per existing column).'
					)}
				</p>`,
			},
			{
				label: __("Enable Batch Config"),
				fieldname: "enable_batch_config",
				fieldtype: "Check",
				default: cfg.enable_batch_config ? 1 : 0,
				description: __(
					"Group records by Grouping Field and display each batch as a separate collapsible table — without an Add More button"
				),
			},
			{
				label: __("Enable Add More Table"),
				fieldname: "allow_add_more_table",
				fieldtype: "Check",
				default: cfg.allow_add_more_table ? 1 : 0,
			},
			{ fieldtype: "Column Break" },
			{
				label: __("Button Label"),
				fieldname: "add_more_button_label",
				fieldtype: "Data",
				default: cfg.add_more_button_label || "Add More",
				description: __('Text shown on the button (e.g. "Add More")'),
				depends_on: "eval:doc.allow_add_more_table == 1",
			},
			{
				label: __("Setup Copy Fields"),
				fieldname: "btn_copy_fields",
				fieldtype: "Button",
				depends_on: "eval:doc.allow_add_more_table == 1",
				click() {
					_openCopyFieldsPicker(batchDialog, cfg);
				},
			},
			{
				fieldname: "copy_fields_only",
				fieldtype: "Data",
				depends_on: "eval:doc.allow_add_more_table == 1",
				read_only: 1,
				default:
					Array.isArray(cfg.copy_fields_only) && cfg.copy_fields_only.length
						? cfg.copy_fields_only.join(", ")
						: "plot_parent",
			},
			{ fieldtype: "Section Break", label: __("Data Mapping") },
			{
				label: __("Source DocType"),
				fieldname: "add_more_doctype",
				fieldtype: "Link",
				options: "DocType",
				default: cfg.add_more_doctype || row.vdr_doctype || "",
				description: __(
					"DocType where new batch records are created (usually the same as the VDR DocType)"
				),
			},
			{ fieldtype: "Column Break" },
			{
				label: __("Grouping Field"),
				fieldname: "grouping_field",
				fieldtype: "Data",
				default: cfg.grouping_field || "",
				description: __("Int field that identifies the batch number (e.g. batch_no)"),
			},
			{ fieldtype: "Section Break" },
			{
				label: __("Column Link Field"),
				fieldname: "plot_link_field",
				fieldtype: "Data",
				default: cfg.plot_link_field || "",
				description: __(
					"Link field that points to the column source — e.g. the plot or sample name (e.g. plot)"
				),
			},
			{ fieldtype: "Column Break" },
			{
				label: __("Batch Title Prefix"),
				fieldname: "batch_title_prefix",
				fieldtype: "Data",
				default: cfg.batch_title_prefix || "Soil Parameters - Batch",
				description: __(
					'Prefix for auto-generated titles. Result: "Prefix - Batch 2". Use {fieldname} to insert a source-doc field value, e.g. "Seed Treatment - {crop_name}"'
				),
			},

			{ fieldtype: "Section Break", label: __("Display") },
			{
				label: __("New Tables Start Collapsed"),
				fieldname: "default_collapsed_new_table",
				fieldtype: "Check",
				default: cfg.default_collapsed_new_table ? 1 : 0,
				description: __("New batch tables start folded; user expands on demand"),
			},
			{ fieldtype: "Column Break" },
			{
				label: __("Allow Delete Batch"),
				fieldname: "allow_delete_batch",
				fieldtype: "Check",
				default: cfg.allow_delete_batch ? 1 : 0,
				description: __(
					"Show a Delete Batch button on each batch header (requires Delete permission on the DocType)"
				),
			},
			{
				label: __("Delete Button Label"),
				fieldname: "delete_batch_button_label",
				fieldtype: "Data",
				default: cfg.delete_batch_button_label || "Delete Batch",
				description: __('Text shown on the delete button (e.g. "Remove Batch")'),
				depends_on: "eval:doc.allow_delete_batch == 1",
			},
		],
		primary_action_label: __("Save"),
		primary_action(values) {
			// Grouping Field is required whenever either batch mode is active
			if (values.enable_batch_config || values.allow_add_more_table) {
				if (!(values.grouping_field || "").trim()) {
					frappe.msgprint({
						message: __("Grouping Field is required."),
						indicator: "red",
					});
					return;
				}
			}
			// Source DocType and Column Link Field are only needed for Add More
			if (values.allow_add_more_table) {
				if (!values.add_more_doctype) {
					frappe.msgprint({
						message: __("Source DocType is required."),
						indicator: "red",
					});
					return;
				}
				if (!(values.plot_link_field || "").trim()) {
					frappe.msgprint({
						message: __("Column Link Field is required."),
						indicator: "red",
					});
					return;
				}
			}

			const copyFieldsRaw = (values.copy_fields_only || "").trim();
			const copyFieldsParsed = copyFieldsRaw
				? copyFieldsRaw
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
				: [];

			const result = {
				enable_batch_config: !!values.enable_batch_config,
				allow_add_more_table: !!values.allow_add_more_table,
				add_more_button_label: (values.add_more_button_label || "Add More").trim(),
				add_more_doctype: values.add_more_doctype || "",
				grouping_field: (values.grouping_field || "").trim(),
				plot_link_field: (values.plot_link_field || "").trim(),
				default_collapsed_new_table: !!values.default_collapsed_new_table,
				batch_title_prefix: (
					values.batch_title_prefix || "Soil Parameters - Batch"
				).trim(),
				allow_delete_batch: !!values.allow_delete_batch,
				delete_batch_button_label: (
					values.delete_batch_button_label || "Delete Batch"
				).trim(),
				copy_fields_only: copyFieldsParsed,
			};

			dialog.set_value("vdr_batch_config", JSON.stringify(result));
			frappe.show_alert({ message: __("Batch config saved"), indicator: "green" });
			batchDialog.hide();
		},
	});

	batchDialog.show();
	dialog.wrapper.append(`<div class="modal-backdrop fade show sva-batch-bd"></div>`);
	batchDialog.on_hide = () => dialog.wrapper.find(".sva-batch-bd").remove();
};

// ─── VDR Child Table Add Row Labels Setup ─────────────────────────────────────

const set_vdr_child_add_row_labels = (dialog) => {
	const row = dialog.get_values(true, false);
	let existing = {};
	try {
		existing = JSON.parse(row.vdr_child_add_row_labels || "{}");
	} catch {
		existing = {};
	}

	// Build rows from existing config
	let entries = Object.entries(existing).map(([fieldname, label]) => ({ fieldname, label }));

	const buildRowsHtml = (rows) =>
		rows
			.map(
				(r, i) => `
		<div class="sva-carl-row" data-idx="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
			<input class="sva-carl-fieldname form-control form-control-sm" placeholder="${__(
				"Table fieldname"
			)}"
				value="${frappe.utils.escape_html(r.fieldname)}" style="flex:1;" />
			<input class="sva-carl-label form-control form-control-sm" placeholder="${__("Button label")}"
				value="${frappe.utils.escape_html(r.label)}" style="flex:1;" />
			<button class="btn btn-xs btn-danger sva-carl-del" data-idx="${i}">✕</button>
		</div>`
			)
			.join("");

	const subDialog = new frappe.ui.Dialog({
		title: __("Setup Child Table Add Row Labels"),
		fields: [
			{
				fieldname: "rows_html",
				fieldtype: "HTML",
				options: `<div id="sva-carl-list" style="margin-bottom:8px;">${buildRowsHtml(
					entries
				)}</div>
					<button class="btn btn-xs btn-primary sva-carl-add">+ ${__("Add Entry")}</button>`,
			},
		],
		primary_action_label: __("Save"),
		primary_action() {
			const result = {};
			subDialog.$wrapper[0].querySelectorAll(".sva-carl-row").forEach((rowEl) => {
				const fn = rowEl.querySelector(".sva-carl-fieldname")?.value?.trim();
				const lbl = rowEl.querySelector(".sva-carl-label")?.value?.trim();
				if (fn && lbl) result[fn] = lbl;
			});
			dialog.set_value("vdr_child_add_row_labels", JSON.stringify(result));
			subDialog.hide();
		},
	});

	subDialog.show();

	const list = subDialog.$wrapper[0].querySelector("#sva-carl-list");

	// Add row
	subDialog.$wrapper[0].querySelector(".sva-carl-add").addEventListener("click", () => {
		const div = document.createElement("div");
		div.className = "sva-carl-row";
		div.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:6px;";
		div.innerHTML = `
			<input class="sva-carl-fieldname form-control form-control-sm" placeholder="${__(
				"Table fieldname"
			)}" style="flex:1;" />
			<input class="sva-carl-label form-control form-control-sm" placeholder="${__(
				"Button label"
			)}" style="flex:1;" />
			<button class="btn btn-xs btn-danger sva-carl-del">✕</button>`;
		list.appendChild(div);
		div.querySelector(".sva-carl-del").addEventListener("click", () => div.remove());
	});

	// Delete existing rows
	list.querySelectorAll(".sva-carl-del").forEach((btn) => {
		btn.addEventListener("click", () => btn.closest(".sva-carl-row").remove());
	});

	dialog.wrapper.append(`<div class="modal-backdrop fade show sva-carl-bd"></div>`);
	subDialog.on_hide = () => dialog.wrapper.find(".sva-carl-bd").remove();
};

// ─── Copy Fields Picker ───────────────────────────────────────────────────────
async function _openCopyFieldsPicker(batchDialog, cfg) {
	const vals = batchDialog.get_values(true, false);
	const doctype = vals.add_more_doctype || "";
	if (!doctype) {
		frappe.show_alert({ message: __("Set Source DocType first"), indicator: "orange" });
		return;
	}

	const SKIP_TYPES = new Set([
		"Section Break",
		"Column Break",
		"Tab Break",
		"HTML",
		"Button",
		"Fold",
		"Image",
		"Signature",
		"Barcode",
		"Heading",
	]);
	const SYSTEM_FIELDS = new Set([
		"name",
		"creation",
		"modified",
		"modified_by",
		"owner",
		"docstatus",
		"idx",
		"parent",
		"parentfield",
		"parenttype",
		"amended_from",
	]);

	await new Promise((r) => frappe.model.with_doctype(doctype, r));
	const meta = frappe.get_meta(doctype);
	const fields = (meta?.fields || []).filter(
		(f) => !SKIP_TYPES.has(f.fieldtype) && f.fieldname && !SYSTEM_FIELDS.has(f.fieldname)
	);

	const currentRaw = (vals.copy_fields_only || "plot_parent").trim();
	const currentSet = new Set(
		currentRaw
			? currentRaw
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: []
	);

	// Build checkbox list HTML
	const rows = fields
		.map((f) => {
			const checked = currentSet.has(f.fieldname) ? "checked" : "";
			return `<label style="display:flex;align-items:center;justify-content:space-between;
				padding:7px 12px;border-bottom:1px solid var(--border-color,#e8e8e8);
				cursor:pointer;gap:8px;">
			<span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
				<input type="checkbox" data-fieldname="${f.fieldname}" ${checked}
					style="width:15px;height:15px;flex-shrink:0;cursor:pointer;">
				<span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;
					white-space:nowrap;">${frappe.utils.escape_html(f.label || f.fieldname)}</span>
			</span>
			<span style="font-size:11px;color:var(--text-muted,#888);white-space:nowrap;
				flex-shrink:0;">${frappe.utils.escape_html(f.fieldtype)}</span>
		</label>`;
		})
		.join("");

	const listHtml = `
		<div style="max-height:380px;overflow-y:auto;border:1px solid var(--border-color,#e8e8e8);
			border-radius:4px;margin-bottom:4px;">
			${rows || `<p style="padding:16px;color:var(--text-muted,#888);">${__("No fields found")}</p>`}
		</div>`;

	const picker = new frappe.ui.Dialog({
		title: __("Select Fields to Copy"),
		fields: [{ fieldname: "list_html", fieldtype: "HTML", options: listHtml }],
		primary_action_label: __("Save Settings"),
		secondary_action_label: __("Reset to Default"),
		secondary_action() {
			picker.$wrapper.find("input[type=checkbox]").prop("checked", false);
			const defField = picker.$wrapper.find(`input[data-fieldname="plot_parent"]`);
			if (defField.length) defField.prop("checked", true);
		},
		primary_action() {
			const selected = [];
			picker.$wrapper.find("input[type=checkbox]:checked").each(function () {
				selected.push($(this).data("fieldname"));
			});
			batchDialog.set_value("copy_fields_only", selected.join(", "));
			frappe.show_alert({ message: __("Copy fields updated"), indicator: "green" });
			picker.hide();
		},
	});
	picker.show();
}

// ─── List Filters ─────────────────────────────────────────────────────────────
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
										console.error("Exception in Custom Property Setter");
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
														console.error(
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
											let values = dialog.get_values(true, false); // include hidden fields (e.g. vdr_batch_config)
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
