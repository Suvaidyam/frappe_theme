frappe.ui.form.on('*', {
    async validate(frm) {
        const regex_props = await frappe.call('frappe_theme.apis.sva_property_setter.get_regex_validation', {
            doctype: frm.doctype
        });
        for (let prop of regex_props?.message) {
            if (!prop.value) continue;

            let config = (() => { try { return JSON.parse(prop.value); } catch { return prop.value; } })();
            if (!config) continue;
            let fieldname = prop.field_name;
            let regex = new RegExp(config);
            let field_value = frm.doc[fieldname];
            if (frm.fields_dict[fieldname] && field_value) {
                if (!regex.test(field_value)) {
                    field_label = await frappe.meta.get_label(frm.doctype, fieldname);
                    frappe.throw(__("Invalid value entered in '{0}'. Please enter a valid input.", [field_label]));
                }
            }
        }
    }
});
