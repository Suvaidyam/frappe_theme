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
	},
});
