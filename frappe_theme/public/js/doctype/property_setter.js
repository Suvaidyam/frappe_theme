after_render_control = async function (dialog, _frm) {
	let row = dialog.get_values(true, false);
	let doctype = _frm.docname == "Customize Form" ? _frm.doc.doc_type : _frm.docname;
	let frm = dialog;
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
	if (row.connection_type === "Report") {
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
};
const field_changes = {
	property_type: async function (frm) {
		let connecttion_type_map = {
			"DocType (Indirect)": "Indirect",
			"DocType (Direct)": "Direct",
			"DocType (Unfiltered)": "Unfiltered",
			"DocType (Referenced)": "Referenced",
			Report: "Report",
		};
		let property_type = frm?.config_dialog?.get_value("property_type");
		if (property_type in connecttion_type_map) {
			frm?.config_dialog?.set_value("connection_type", connecttion_type_map[property_type]);
		} else {
			frm?.config_dialog?.set_value("connection_type", "");
		}
	},
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
		if (row.connection_type == "Direct") {
			if (row.link_doctype) {
				let fields = await frappe.call(
					"frappe_theme.dt_api.get_direct_connection_fields",
					{ dt: frm.doc.parent_doctype, link_dt: row.link_doctype }
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
		set_list_settings(frm);
	},
	setup_crud_permissions: function (frm) {
		set_crud_permissiions(frm);
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
	async setup_list_filters(frm, cdt, cdn) {
		await set_list_filters(frm, cdt, cdn);
	},
};
const child_table_field_changes = {
	setup_list_settings: function (frm, cdt, cdn) {
		set_list_settings(frm, cdt, cdn);
	},
	setup_crud_permissions: function (frm, cdt, cdn) {
		set_crud_permissiions(frm, cdt, cdn);
	},
	setup_list_filters: function (frm, cdt, cdn) {
		set_list_filters(frm, cdt, cdn);
	},
};

const set_list_settings = async (frm) => {
	let row = frm.config_dialog.get_values(true, false);
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
				frm.config_dialog.set_value(
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
const set_list_filters = async (frm) => {
	let row = frm.config_dialog.get_values(true, false);
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
				frm.config_dialog.set_value("list_filters", JSON.stringify(listview_settings));
				frappe.show_alert({ message: __("List filters updated"), indicator: "green" });
			},
		});
	});
};
const set_crud_permissiions = (frm) => {
	let row = frm.config_dialog.get_values(true, false);
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
			frm.config_dialog.set_value("crud_permissions", JSON.stringify(prev_permissions));
			permissions_dialog.hide();
		},
	});
	permissions_dialog.show();
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
				console.log("Field clicked:", el);
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
										for (field of fields.message) {
											if (values[field.fieldname]) {
												field.default = values[field.fieldname];
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
														table_data = JSON.parse(
															values[field.fieldname] || "[]"
														);
													} catch (error) {
														console.log(
															"Exception in Custom Property Setter for Table Field"
														);
													}
												}
												let dialog_table_fields = [];
												dialog_table_fields = table_fields.message.map(
													(tf) => {
														return {
															...tf,
															[tf.fieldtype == "Button"
																? "click"
																: "onchange"]: child_table_field_changes?.[
																tf.fieldname
															]
																? child_table_field_changes[
																		tf.fieldname
																  ].bind(this, frm)
																: undefined,
															default: tf.default,
														};
													}
												);
												return {
													...field,
													data: table_data,
													fields: dialog_table_fields,
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
