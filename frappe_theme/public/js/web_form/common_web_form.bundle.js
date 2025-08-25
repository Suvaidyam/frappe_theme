frappe.ready(async function() {
    await setup_fetch_from_api(frappe.web_form);
});

const setup_fetch_from_api = async (web_form) => {
    let link_fields = web_form.web_form_fields.filter(f=> f.custom_original_fieldtype === 'Link');
    if (link_fields.length == 0){
        return;
    }
    for (let field of link_fields){
        let dependent_fields = get_dependent_fields(field.fieldname,web_form.web_form_fields); // {'local_fieldname': 'foreign_fieldname'}
        if (Object.keys(dependent_fields).length > 0){
            frappe.web_form.on([field.fieldname], async () => {
                let value = frappe.web_form.get_value(field.fieldname);
                if (value && field.custom_original_options){
                    let response = await frappe.xcall('frappe_theme.apis.public_api.get_values', {
                        doctype: field.custom_original_options,
                        docname: value,
                        fields: Object.values(dependent_fields)
                    });
                    if (response){
                        for (let dependent_field of Object.keys(dependent_fields)){
                            if (response[dependent_fields[dependent_field]]){
                                frappe.web_form.set_value(dependent_field, response[dependent_fields[dependent_field]]);
                                frappe.web_form.set_df_property(dependent_field, 'read_only', 1);
                            }else{
                                frappe.web_form.set_value(dependent_field, '');
                                frappe.web_form.set_df_property(dependent_field, 'read_only', 0);
                            }
                        }
                    }
                }else{
                    for (let dependent_field of Object.keys(dependent_fields)){
                        try {
                            frappe.web_form.set_value(dependent_field, '');
                            frappe.web_form.set_df_property(dependent_field, 'read_only', 0);
                        } catch (error) {
                            console.error('Error setting value for',dependent_field,':',error);
                        }
                    }
                }
            });
        }
    }
}

const get_dependent_fields = (fieldname,fields) => {
    let current_fields = {};
    for (let field of fields){
        if(field.custom_fetch_from){
            let [local_field,foreign_field] = field.custom_fetch_from.split('.');
            if(local_field === fieldname){
                current_fields[field.fieldname] = foreign_field;
            }
        }
    }
    return current_fields // {'local_fieldname': 'foreign_fieldname'};
}