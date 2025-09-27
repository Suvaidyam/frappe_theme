frappe.ui.form.on('DocType', {
    refresh: async function (frm) {
        frm.add_custom_button(__('Configure Data Protection'), async () => {

            let fields = await frappe.call({
                method: "frappe_theme.api.get_meta_fields",
                args: {
                    doctype: "SVAProperty Setter"
                },
            });
            let d = new frappe.ui.Dialog({
                title: 'Field Data Protection',
                fields: [
                    {
                        fieldname: 'field',
                        label: "Field",
                        fieldtype: "Autocomplete",
                        options: frm.doc.fields.filter(e => !['Section Break', 'Column Break', 'Tab Break', 'HTML'].includes(e.fieldtype)).map((f) => { return { value: f.fieldname, label: f.label } }),
                        onchange: async function () {
                            let r = await frappe.call({
                                method: "frappe_theme.apis.sva_property_setter.get_field_data_protection",
                                args: {
                                    doctype: frm.docname,
                                    fieldname: d.fields_dict.field.get_value()
                                },
                            });
                            if (r?.message) {
                                Object.keys(r.message).forEach(key => {
                                    if (d.fields_dict[key]) {
                                        d.fields_dict[key].set_value(r.message[key]);
                                    }
                                });
                            }
                        }
                    },
                    ...fields.message
                ],
                primary_action_label: __('Save'),
                primary_action(values) {
                    values.doc_type = frm.docname;
                    values.fname = values.field
                    frappe.call({
                        method: "frappe_theme.apis.sva_property_setter.save_field_data_protection",
                        args: {
                            values: values
                        },
                        callback: function (r) {
                            if (r?.message?.ok) {
                                d.hide();
                                frappe.show_alert({
                                    message: __('Saved'),
                                    indicator: 'green'
                                });
                            }
                        }
                    });
                }
            });
            d.show();
        });
        frm.add_custom_button(__('Add Field Validation'), async () => {
            let d = new frappe.ui.Dialog({
                title: 'Field Validation',
                fields: [
                    {
                        fieldname: 'field',
                        label: "Field",
                        fieldtype: "Autocomplete",
                        options: frm.doc.fields.filter(e => !['Section Break', 'Column Break', 'Tab Break', 'HTML'].includes(e.fieldtype)).map((f) => { return { value: f.fieldname, label: f.label } }),
                        onchange: async function () {
                            let r = await frappe.call({
                                method: "frappe_theme.apis.sva_property_setter.get_field_validation",
                                args: {
                                    doctype: frm.docname,
                                    fieldname: d.fields_dict.field.get_value()
                                },
                            });
                            if (r?.message) {
                                if (r.message?.value) {
                                    let cus_data = JSON.parse(r.message.value);
                                    d.fields_dict.pattern.set_value(cus_data?.regex_pattern);
                                }
                            }
                        },
                        reqd: 1
                    },
                    {
                        fieldname: 'pattern',
                        label: 'Regex Pattern',
                        fieldtype: 'Data',
                        reqd: 1
                    }
                ],
                primary_action_label: __('Save'),
                primary_action(values) {
                    values.doc_type = frm.docname;
                    values.fname = values.field
                    let cus_data = {
                        "regex_pattern": values.pattern
                    }
                    values["cus_data"] = JSON.stringify(cus_data);
                    frappe.call({
                        method: "frappe_theme.apis.sva_property_setter.save_field_validation",
                        args: {
                            values: values
                        },
                        callback: function (r) {
                            if (r?.message?.ok) {
                                d.hide();
                                frappe.show_alert({
                                    message: __('Saved'),
                                    indicator: 'green'
                                });
                            }
                        }
                    });
                }
            });
            d.show();
        });
    }
});
