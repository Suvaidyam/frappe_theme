// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on('SVAFixture', {

    // -------------------- Export Button --------------------
    export: function (frm) {
        frappe.confirm(
            'Are you sure you want to export fixtures?',
            () => {
                frappe.call({
                    method: "frappe_theme.api.export_fixture_single_doctype",
                    args: {
                        docname: frm.doc.name
                    },
                    callback: function (r) {
                        if (r.message) {
                            const filename = `${frm.doc.ref_doctype || 'fixture'}_data.json`;
                            const blob = new Blob([r.message], { type: "application/json" });
                            const link = document.createElement("a");
                            link.href = URL.createObjectURL(blob);
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            frappe.msgprint(__('Data exported successfully!'));
                        } else {
                            frappe.msgprint(__('No data found.'));
                        }
                    }
                });
            },
            () => {
                frappe.msgprint("Fixtures export cancelled.");
            }
        );
    },

    // -------------------- Import Button --------------------
    import: function (frm) {
        frappe.confirm(
            'Are you sure you want to import fixtures?',
            () => {
                frappe.prompt(
                    [
                        {
                            fieldtype: "Attach",
                            fieldname: "import_file",
                            label: __("Select Fixture JSON File"),
                            reqd: 1,
                            options: {
                                restrictions: {
                                    allowed_file_types: ['application/json']
                                }
                            }
                        }
                    ],
                    function (data) {
                        const file_url = data.import_file;
                        if (!file_url) {
                            frappe.msgprint(__('No file selected.'));
                            return;
                        }
                        frappe.call({
                            method: "frappe_theme.api.import_fixture_single_doctype",
                            args: {
                                file_url: file_url,
                                fixture_name: frm.doc.name
                            },
                            freeze: true,
                            freeze_message: __("Importing fixtures..."),
                            callback: function (res) {
                                if (res.message.status === "success") {
                                    frappe.msgprint(res.message.message);
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint(__('Failed to import fixtures: ') + res.message.message);
                                }
                            }
                        });
                    },
                    __("Import Options"),
                    __("Import")
                );
            },
            () => {
                frappe.msgprint("Fixtures import cancelled.");
            }
        );
    }

});
