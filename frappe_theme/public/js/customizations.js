async function add_customization_buttons(frm) {
    // ---------------- Export Button ----------------
    frm.add_custom_button(__('Export Customizations'), function () {
        let d = new frappe.ui.Dialog({
            title: __('Export Customizations'),
            fields: [
                {
                    fieldtype: "Table",
                    fieldname: "export_table",
                    label: "Select Doctypes to Export",
                    cannot_add_rows: false,
                    in_place_edit: true,
                    fields: [
                        {
                            fieldtype: "Link",
                            fieldname: "doctype_name",
                            label: "Doctype",
                            options: "DocType",
                            in_list_view: 1,
                            reqd: 1
                        }
                    ]
                },
                {
                    fieldtype: "Check",
                    fieldname: "with_permissions",
                    label: __("Export custom Permissions"),
                    description: __("Exported permissions will be force-synced on every migrate overriding any other customization."),
                    default: 0
                }
            ],
            primary_action_label: __("Export"),
            primary_action(values) {
                if (!values.export_table || values.export_table.length === 0) {
                    frappe.msgprint(__("Please select at least one DocType to export."));
                    return;
                }

                frappe.call({
                    method: "frappe_theme.api.export_multiple_customizations",
                    args: {
                        doctypes: values.export_table,
                        with_permissions: values.with_permissions ? 1 : 0
                    },
                    callback: function (r) {
                        if (r.message) {
                            let blob = new Blob([r.message], { type: "application/json" });
                            let link = document.createElement("a");
                            link.href = window.URL.createObjectURL(blob);
                            link.download = "customizations.json";
                            link.click();
                            frappe.show_alert({
                                message: __('Customizations exported successfully!'),
                                indicator: 'green'
                            });
                        } else {
                            frappe.msgprint(__('No data found to download.'));
                        }
                    }
                });
                d.hide();
            }
        });

        // Restrict duplicate selection of doctypes
        d.fields_dict.export_table.grid.get_field("doctype_name").get_query = function (doc, cdt, cdn) {
            let selected = (d.get_value("export_table") || []).map(row => row.doctype_name).filter(Boolean);
            return {
                filters: [
                    ["DocType", "name", "not in", selected]
                ]
            };
        };

        d.show();
    }, __("Customizations"));



    // ---------------- Import Button ----------------
    frm.add_custom_button(__('Import Customizations'), function () {
        let d = new frappe.ui.Dialog({
            title: __('Import Customizations'),
            fields: [
                {
                    fieldtype: "Attach",
                    fieldname: "import_file",
                    label: "Select JSON File",
                    reqd: 1,
                    options: "application/json"
                }
            ],
            primary_action_label: __("Import"),
            primary_action(values) {
                frappe.call({
                    method: "frappe_theme.api.import_multiple_customizations",
                    args: {
                        file_url: values.import_file
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: __('Customizations imported successfully'),
                                indicator: 'green'
                            });

                            // If import_file field exists in the form, set its value to the uploaded file
                            if (frm.fields_dict.import_file) {
                                frappe.db.set_value(frm.doctype, frm.docname, "import_file", values.import_file).then(() => {
                                    frm.reload_doc();
                                });
                            }
                        }
                    }
                });
                d.hide();
            }
        });

        d.show();
    }, __("Customizations"));
}
