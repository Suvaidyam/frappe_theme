frappe.ui.form.on('Customize Form', {
    onload(frm) {
        add_customization_buttons(frm);
    },
    refresh(frm) {
        add_customization_buttons(frm);
        add_configure_data_protection_buttons(frm);
    },
    doc_type(frm) {
        add_customization_buttons(frm);
        add_configure_data_protection_buttons(frm);
    }
});

function add_configure_data_protection_buttons(frm) {
    frm.add_custom_button(__('Configure Data Protection & Properties'), async () => {

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
                                doctype: frm.doc.doc_type,
                                fieldname: d.get_value('field')
                            },
                        });
                        if (r?.message) {
                            Object.keys(r.message).forEach(key => {
                                if (d.fields_dict[key]) {
                                    d.fields_dict[key].set_value(r.message[key]);
                                }
                            });
                        }
                        let fieldname = d.get_value('field');
                        if (fieldname) {
                            sva_dt_instance.additional_list_filters = [["Property Setter","field_name","=",fieldname]];
                            sva_dt_instance.reloadTable();
                        }else{
                            sva_dt_instance.additional_list_filters = [];
                            sva_dt_instance.reloadTable();
                        }
                    }
                },
                ...fields.message,
                {
                    "fieldname": "table_break_32fksdk",
                    "fieldtype": "Section Break",
                    "label": ""
                },
                {
                    fieldname: "table",
                    fieldtype: "HTML",
                    options: `<div id="sva_property_setter_table" ></div > `,
                }
            ],
            primary_action_label: __('Save'),
            primary_action(values) {
                values.doc_type = frm.doc.doc_type;
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
        frappe.utils.make_dialog_fullscreen(d);
        await frappe.require('sva_datatable.bundle.js');
        let sva_dt_instance = new frappe.ui.SvaDataTable({
            wrapper: d.body.querySelector('#sva_property_setter_table'),
            doctype: "Property Setter",
            frm: Object.assign(frm,{
                "docname": frm.doc.doc_type,
                "doc":{
                    "name": frm.doc.doc_type,
                    "doc_type": frm.doc.doc_type,
                    "docstatus":0
                },
                "dt_events": {
                    "Property Setter": {
                        "after_render": async function (dt,mode) {
                            dt.form_dialog.set_value('doctype_or_field','DocField');
                            let fn = d.get_value('field');
                            if (fn){
                                dt.form_dialog.set_value('field_name',fn);
                            }else{
                                dt.form_dialog.set_value('field_name','');
                            }
                        }
                    }
                }
            }),
            connection: {
                'connection_type': 'Direct',
                'crud_permissions': '["read","write","create","delete"]',
                'link_doctype': "Property Setter",
                'link_fieldname': 'doc_type',
                'extend_condition': true,
                'extended_condition' : `[["Property Setter","doctype_or_field","=","DocField"],["Property Setter","is_system_generated","=", "0"]]`,
                'listview_settings' : `[{"fieldname":"doc_type","fieldtype":"Link","label":"DocType","width":"2","inline_edit":0},{"fieldname":"field_name","fieldtype":"Data","label":"Field Name","width":"2","inline_edit":0},{"fieldname":"doctype_or_field","fieldtype":"Select","label":"Applied On","width":"2","inline_edit":0},{"fieldname":"property_type","fieldtype":"Data","label":"Property Type","width":"2","inline_edit":0},{"fieldname":"property","fieldtype":"Data","label":"Property","width":"2","inline_edit":0},{"fieldname":"value","fieldtype":"Small Text","label":"Set Value","width":"4","inline_edit":0}]`
            },
            options: {
                serialNumberColumn: true
            }
        });
        sva_dt_instance.setTitle('Property Setter');
        d.show();
    });
}

function add_customization_buttons(frm) {
    frm.add_custom_button(__('Export Customizations'), function () {
        frappe.confirm('Are you sure you want to export customizations?', () => {
            if (!frm.doc.doc_type) {
                frappe.msgprint(__('Please select a DocType first before exporting customizations.'));
                return;
            }
            frappe.prompt(
                [
                    {
                        fieldtype: "Check",
                        fieldname: "with_permissions",
                        label: __("Include Permissions"),
                        default: 0
                    }
                ],
                function (data) {
                    frappe.call({
                        method: "frappe_theme.api.export_customizations",
                        args: {
                            doctype: frm.doc.doc_type,
                            with_permissions: data.with_permissions ? 1 : 0
                        },
                        callback: function (r) {
                            if (r.message) {
                                const filename = `${frm.doc.doc_type}_custom.json`;
                                const blob = new Blob([r.message], { type: "application/json" });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                                link.download = filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                frappe.show_alert({
                                    message: __('Customizations exported successfully'),
                                    indicator: 'green'
                                });
                            } else {
                                frappe.msgprint(__('No data found to download.'));
                            }
                        }
                    });
                },
                __("Download Options"),
                __("Export")
            );
        })
    }, __("Customizations"));

    // ---- IMPORT BUTTON ----
    frm.add_custom_button(__('Import Customizations'), function () {
        if (!frm.doc.doc_type) {
            frappe.msgprint(__('Please select a DocType first before importing customizations.'));
            return;
        }

        frappe.prompt(
            [
                {
                    fieldtype: "Attach",
                    fieldname: "import_file",
                    options: {
                        restrictions: {
                            allowed_file_types: ['application/json']
                        }
                    },
                    label: __("Select Customization JSON File"),
                    reqd: 1
                }
            ],
            function (data) {
                frappe.call({
                    method: "frappe_theme.api.import_customizations",
                    args: {
                        file_url: data.import_file,
                        target_doctype: frm.doc.doc_type
                    },
                    freeze: true,
                    freeze_message: __("Importing customizations..."),
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.show_alert({
                                message: __('Customizations imported successfully'),
                                indicator: 'green'
                            });
                            frm.reload_doc(); // Refreshes the form safely without "Reload site?" popup
                        } else {
                            frappe.msgprint(__('Failed to import customizations. Check error logs.'));
                        }
                    }
                });
            },
            __("Import Options"),
            __("Import")
        );
    }, __("Customizations"));
}
