frappe.ui.form.on("Web Form", {
	add_get_fields_button(frm) {
		frm.add_custom_button(__("Custom Get Fields"), () => {
			let webform_fieldtypes = frappe.meta
				.get_field("Web Form Field", "fieldtype")
				.options.split("\n");

			let added_fields = (frm.doc.web_form_fields || []).map((d) => d.fieldname);

			get_fields_for_doctype(frm.doc.doc_type).then((fields) => {
				for (let df of fields) {
					let fieldtype = df.fieldtype;
					if (fieldtype == "Tab Break") {
						fieldtype = "Page Break";
					}
					if (
						webform_fieldtypes.includes(fieldtype) &&
						!added_fields.includes(df.fieldname) &&
						!df.hidden
					) {
						frm.add_child("web_form_fields", {
							fieldname: df.fieldname,
							label: df.label,
							fieldtype: fieldtype,
							options: df.options,
							reqd: df.reqd,
							default: df.default,
							read_only: df.read_only,
							precision: df.precision,
							depends_on: df.depends_on,
							mandatory_depends_on: df.mandatory_depends_on,
							read_only_depends_on: df.read_only_depends_on,
							custom_fetch_from: df.fetch_from,
							custom_original_fieldtype: df.fieldtype,
							custom_original_options: df.fieldtype === "Link" ? df.options : "",
						});
					}
				}
				frm.refresh_field("web_form_fields");
				frm.scroll_to_field("web_form_fields");
			});
		});
	},
});
