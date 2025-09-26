frappe.ui.form.on('*', {
    async validate(frm) {
        const regex_props = await frappe.db.get_list('Property Setter', {
            filters: {
                doc_type: frm.doctype,
                property: 'regex_validation'
            },
            fields: ['field_name', 'value']
        });

        for (let prop of regex_props) {
            if (!prop.value) continue;

            let config = JSON.parse(prop.value);
            if (!config.regex_pattern) continue;
            let fieldname = prop.field_name;
            let regex = new RegExp(config.regex_pattern);
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
