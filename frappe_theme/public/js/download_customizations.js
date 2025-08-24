frappe.ui.form.on('Customize Form', {
    onload(frm) {
        add_customization_buttons(frm);
    },
    refresh(frm) {
        add_customization_buttons(frm);
    }
});

function add_customization_buttons(frm) {
    if (frm.custom_buttons_added) return;

    // ---- DOWNLOAD BUTTON ----
    frm.add_custom_button(__('Download Customizations'), function () {
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
                const doctype = frm.doc.doc_type;
                window.location.href = `/api/method/frappe_theme.api.download_customizations?doctype=${encodeURIComponent(doctype)}&with_permissions=${data.with_permissions ? 1 : 0}`;
            },
            __("Download Options"),
            __("Download")
        );
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
                            frappe.msgprint(__('Customizations imported successfully! Reloading...'));
                            location.reload();
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

    frm.custom_buttons_added = true;
}
