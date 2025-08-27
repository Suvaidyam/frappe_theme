frappe.listview_settings['SVAFixture'] = {
    onload(listview) {
        listview.page.add_menu_item(__('Fixtures'), function () {}, false, '', 'btn-customizations');

        // ---- Export fixtures ----
        listview.page.add_inner_button(__('Export fixtures'), function () {
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
        }, 'Fixtures');

        // ---- IMPORT fixtures ----
        listview.page.add_inner_button(__('Import fixtures'), function () {
            frappe.prompt(
                [
                    {
                        fieldtype: "Attach",
                        fieldname: "import_file",
                        label: __("Select JSON File"),
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
                        method: 'frappe_theme.api.import_fixtures_runtime',
                        args: {
                            doctype: listview.doctype,
                            import_file: data.import_file
                        },
                        freeze: true,
                        freeze_message: __("Importing fixtures..."),
                        callback: function (r) {
                            frappe.show_alert({ message: __('fixtures imported successfully!'), indicator: 'green' });
                            listview.refresh();
                        }
                    });
                },
                __('Import fixtures'),
                __('Import')
            );
        }, 'Fixtures');
    }
};
