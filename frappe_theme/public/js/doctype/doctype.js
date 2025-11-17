frappe.ui.form.on("DocType", {
	refresh: async function (frm) {
		frm.add_custom_button(__("Configure Data Protection & Properties"), async () => {
			let fields = await frappe.call({
				method: "frappe_theme.api.get_meta_fields",
				args: {
					doctype: "SVAProperty Setter",
				},
			});
			let d = new frappe.ui.Dialog({
				title: "Field Data Protection",
				fields: [
					{
						fieldname: "field",
						label: "Field",
						fieldtype: "Autocomplete",
						options: frm.doc.fields
							.filter(
								(e) =>
									![
										"Section Break",
										"Column Break",
										"Tab Break",
										"HTML",
									].includes(e.fieldtype)
							)
							.map((f) => {
								return { value: f.fieldname, label: f.label };
							}),
						onchange: async function () {
							let r = await frappe.call({
								method: "frappe_theme.apis.sva_property_setter.get_field_data_protection",
								args: {
									doctype: frm.docname,
									fieldname: d.get_value("field"),
								},
							});
							if (r?.message) {
								Object.keys(r.message).forEach((key) => {
									if (d.fields_dict[key]) {
										d.fields_dict[key].set_value(r.message[key]);
									}
								});
							}
							let fieldname = d.get_value("field");
							if (fieldname) {
								sva_dt_instance.additional_list_filters = [
									["Property Setter", "field_name", "=", fieldname],
								];
								sva_dt_instance.reloadTable();
							} else {
								sva_dt_instance.additional_list_filters = [];
								sva_dt_instance.reloadTable();
							}
						},
					},
					...fields.message,
					{
						fieldname: "table_break_32fksdk",
						fieldtype: "Section Break",
						label: "",
					},
					{
						fieldname: "table",
						fieldtype: "HTML",
						options: `<div id="sva_property_setter_table" ></div > `,
					},
				],
				primary_action_label: __("Save"),
				primary_action(values) {
					values.doc_type = frm.docname;
					values.fname = values.field;
					frappe.call({
						method: "frappe_theme.apis.sva_property_setter.save_field_data_protection",
						args: {
							values: values,
						},
						callback: function (r) {
							if (r?.message?.ok) {
								d.hide();
								frappe.show_alert({
									message: __("Saved"),
									indicator: "green",
								});
							}
						},
					});
				},
			});
			frappe.utils.make_dialog_fullscreen(d);
			await frappe.require("sva_datatable.bundle.js");
			let sva_dt_instance = new frappe.ui.SvaDataTable({
				wrapper: d.body.querySelector("#sva_property_setter_table"),
				doctype: "Property Setter",
				frm: Object.assign(frm, {
					dt_events: {
						"Property Setter": {
							after_render: async function (dt, mode) {
								dt.form_dialog.set_value("doctype_or_field", "DocField");
								let fn = d.get_value("field");
								if (fn) {
									dt.form_dialog.set_value("field_name", fn);
								} else {
									dt.form_dialog.set_value("field_name", "");
								}
							},
						},
					},
				}),
				connection: {
					connection_type: "Direct",
					crud_permissions: '["read","write","create","delete"]',
					link_doctype: "Property Setter",
					link_fieldname: "doc_type",
					extend_condition: true,
					extended_condition: `[["Property Setter","doctype_or_field","=","DocField"],["Property Setter","is_system_generated","=", "0"]]`,
					listview_settings: `[{"fieldname":"doc_type","fieldtype":"Link","label":"DocType","width":"2","inline_edit":0},{"fieldname":"field_name","fieldtype":"Data","label":"Field Name","width":"2","inline_edit":0},{"fieldname":"doctype_or_field","fieldtype":"Select","label":"Applied On","width":"2","inline_edit":0},{"fieldname":"property_type","fieldtype":"Data","label":"Property Type","width":"2","inline_edit":0},{"fieldname":"property","fieldtype":"Data","label":"Property","width":"2","inline_edit":0},{"fieldname":"value","fieldtype":"Small Text","label":"Set Value","width":"4","inline_edit":0}]`,
				},
				options: {
					serialNumberColumn: true,
					editable: true,
				},
			});
			sva_dt_instance.setTitle("Property Setter");
			d.show();
		});
		// listen to element class '.control-data'; if it is visible the console log the element
		setTimeout(() => {
			let fields = frm.$wrapper.find(".field");
			fields.each(function () {
				let el = this;
				// Click listener (optional)
				el.addEventListener("click", () => {
					// console.log("Field clicked:", el);
					let control = el.querySelector(
						".control.frappe-control.editable[data-fieldname]"
					);

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
									let props = await frappe.db.get_list("Property Setter", {
										filters: {
											doc_type: frm.docname,
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
										} catch (error) {}
									}

									let dialog = new frappe.ui.Dialog({
										title: "Custom Property Setter",
										fields: fields.message.map((field) => {
											return {
												...field,
												default:
													field.fieldname == "fieldtype"
														? fieldtype
														: field.fieldname == "fieldname"
														? fieldname
														: field.default,
											};
										}),
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
													doc_type: frm.docname,
													doctype_or_field: "DocField",
													property: "sva_ft",
													value: new_val,
												};
												let new_doc = await frappe.db.insert(doc);
											}
											dialog.hide();
										},
									});
									dialog.show();
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
	},
});
