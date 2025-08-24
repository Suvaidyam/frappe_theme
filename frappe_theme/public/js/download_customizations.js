frappe.ui.form.on('Customize Form', {
    onload: function (frm) {
        add_export_button(frm);
    },
    refresh: function (frm) {
        add_export_button(frm);

    }
});

function add_export_button(frm) {
        frm.add_custom_button(__('Download Customizations'), function () {
            frappe.msgprint(__('Exporting customizations...'));
            const doctype = cur_frm.doc.doc_type;

            window.location.href = `/api/method/frappe_theme.api.download_customizations?doctype=${encodeURIComponent(doctype)}`;
        });
        frm.custom_buttons_added = true;
}


