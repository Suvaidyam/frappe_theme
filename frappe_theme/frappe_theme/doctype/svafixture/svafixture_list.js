frappe.listview_settings['SVAFixture'] = {
    onload(listview) {
        listview.page.add_menu_item(__('Fixtures'), function () { }, false, '', 'btn-customizations');

        // ---- Export fixtures ----
        listview.page.add_inner_button(__('Export fixtures'), function () {
            frappe.confirm('Are you sure you want to export fixtures?', () => { 
                frappe.call({
                    method: 'frappe_theme.api.export_fixtures_runtime',
                    args: { doctype: listview.doctype },
                    callback: function (r) {
                        if (r.message) {
                            const filename = `${listview.doctype}_custom.json`;
                            const blob = new Blob([r.message], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            frappe.show_alert({ message: __('fixtures downloaded successfully!'), indicator: 'green' });
                        } else {
                            frappe.msgprint(__('No data found to download.'));
                        }
                    }
                });
            },() => {
                frappe.msgprint("Fixtures export cancelled")
            },
        )
        }, 'Fixtures');

        // ---- IMPORT fixtures ----
        listview.page.add_inner_button(__('Import fixtures'), function () {
            frappe.confirm('Are you sure you want to import fixtures?', () => {
                frappe.prompt(
                    [
                        {
                            fieldtype: "Attach",
                            fieldname: "import_file",
                            label: __("Select JSON File"),
                            reqd: 1,
                            options: 'application/json'
                        }
                    ],
                    function (data) {
                        frappe.call({
                            method: 'frappe_theme.api.import_fixtures_runtime',
                            args: { file_url: data.import_file }, // Directly send file_url
                            freeze: true,
                            freeze_message: __("Importing fixtures..."),
                            callback: function (r) {
                                if (r.message && r.message.status === "success") {
                                    frappe.show_alert({ message: r.message.message, indicator: 'green' });
                                    listview.refresh();
                                } else {
                                    frappe.msgprint(__('Error importing fixtures: ') + (r.message?.message || 'Unknown error'));
                                }
                            }
                        });
                    },
                    __('Import fixtures'),
                    __('Import')
                );
            }, () => {
                frappe.msgprint("Fixtures import cancelled.");
            },
            )
        }, 'Fixtures');

    }
};
