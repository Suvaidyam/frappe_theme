frappe.ui.form.on('Customize Form', {
    onload(frm) {
        add_customization_buttons(frm);
    },
    refresh(frm) {
        add_customization_buttons(frm);
    },
    doc_type(frm) {
        add_customization_buttons(frm);
    }
});

function add_customization_buttons(frm) {
    frm.add_custom_button(__('Download Customizations'), function () {
        frappe.confirm('Are you sure you want to download customizations?', () => {
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
                        method: "frappe_theme.api.download_customizations",
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
                                frappe.msgprint(__('Customizations downloaded successfully!'));
                            } else {
                                frappe.msgprint(__('No data found to download.'));
                            }
                        }
                    });
                },
                __("Download Options"),
                __("Download")
            );
        }, () => { frappe.msgprint("Customizations download cancelled") })
    }, __("Customizations"));

    // ---- IMPORT BUTTON ----
    frm.add_custom_button(__('Import Customizations'), function () {
        frappe.confirm('Are you sure you want to import customizations?', () => {
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
                                frappe.msgprint(__('Customizations imported successfully!'));
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
        }, () => { frappe.msgprint("Customizations import cancelled") })
    }, __("Customizations"));
}
