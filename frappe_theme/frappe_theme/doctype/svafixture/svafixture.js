// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on('SVAFixture', {
    export: function(frm) {
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
                        doctype: frm.doc.ref_doctype,
                        with_permissions: data.with_permissions ? 1 : 0
                    },
                    callback: function (r) {
                        if (r.message) {
                            const filename = `${frm.doc.ref_doctype}_custom.json`;
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
    },
    import: function(frm) {
        if (!frm.doc.ref_doctype) {
            frappe.msgprint(__('Please select a Reference DocType first before importing customizations.'));
            return;
        }

        frappe.prompt(
            [
                {
                    fieldtype: "Attach",
                    fieldname: "import_file",
                    label: __("Select Customization JSON File"),
                    reqd: 1,
                    options: {
                        restrictions: {
                            allowed_file_types: ['application/json']
                        }
                    }
                }
            ],
            function (data) {
                frappe.call({
                    method: "frappe_theme.api.import_customizations",
                    args: {
                        file_url: data.import_file,
                        target_doctype: frm.doc.ref_doctype
                    },
                    freeze: true,
                    freeze_message: __("Importing customizations..."),
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.msgprint(__('Customizations imported successfully!'));
                            frm.reload_doc(); // Refresh current document without site reload popup
                        } else {
                            frappe.msgprint(__('Failed to import customizations. Check error logs.'));
                        }
                    }
                });
            },
            __("Import Options"),
            __("Import")
        );
    }
});


