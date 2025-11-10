import frappe

@frappe.whitelist()
def get_possible_link_filters(doctype,parent_doctype):
    meta = frappe.get_meta(doctype)
    parent_meta = frappe.get_meta(parent_doctype)
    link_fields = []
    for field in meta.fields:
        if field.fieldtype in ["Link","Table","Table MultiSelect"] and not field.hidden:
            if field.fieldtype == "Link":
                relevant_parent_link_field = next((f for f in parent_meta.fields if f.fieldtype == 'Link' and f.options == field.options and not f.hidden), None)
                foreign_fieldname = field.fieldname
                if relevant_parent_link_field:
                    link_fields.append({
                        "foreign_fieldname": foreign_fieldname,
                        "label": field.label,
                        "local_fieldname": relevant_parent_link_field.fieldname,
                        "type": "One to One",
                        "doctype": doctype,
                        "description": "Parent Single Link"
                    })
                std_child_tables = frappe.get_all("DocField",
                    filters=[
                        ["DocField", "options", "=", field.options],
                        ["DocField", "fieldtype", "=", "Link"],
                        ["DocField", "parent", "in", frappe.get_all("DocType", filters=[["DocType", "istable", "=", 1]], pluck="name")],
                    ],
                    fields=["fieldname AS primary_key", "parent"],
                )
                for child in std_child_tables:
                    relevant_parent_table_field = next((f for f in parent_meta.fields if f.fieldtype in ["Table","Table MultiSelect"] and f.options == child.parent and not f.hidden), None)
                    if relevant_parent_table_field:
                        link_fields.append({
                            "foreign_fieldname": foreign_fieldname,
                            "label": field.label,
                            "primary_key": child.primary_key,
                            "local_fieldname": relevant_parent_table_field.fieldname,
                            "doctype": doctype,
                            "type": "Many to One",
                            "description": "Parent Many, Child Single Link"
                        })
            elif field.fieldtype in ["Table","Table MultiSelect"]:
                relevant_child_table_field = next((f for f in parent_meta.fields if f.fieldtype in ["Table","Table MultiSelect"] and f.options == field.options and not f.hidden), None)
                if relevant_child_table_field:
                    child_table_meta = frappe.get_meta(field.options)
                    first_link_field = next((f for f in child_table_meta.fields if f.fieldtype == "Link" and not f.hidden), None)
                    if first_link_field:
                        link_fields.append({
                            "foreign_fieldname": field.fieldname,
                            "label": field.label,
                            "primary_key": first_link_field.fieldname,
                            "local_fieldname": relevant_child_table_field.fieldname,
                            "doctype": field.options,
                            "type": "Many to Many",
                            "description": "Parent Many Link"
                        })
                else:
                    child_meta = frappe.get_meta(field.options)
                    if child_meta:
                        for child_field in child_meta.fields:
                            if child_field.fieldtype == "Link":
                                relevant_parent_link_field = next((f for f in parent_meta.fields if f.fieldtype == "Link" and f.options == child_field.options and not f.hidden), None)
                                relevant_primary_key_field = next((f for f in child_meta.fields if f.fieldtype == "Link" and f.options == relevant_parent_link_field.options and not f.hidden), None)
                                foreign_fieldname = child_field.fieldname
                                if relevant_parent_link_field and relevant_primary_key_field:
                                    link_fields.append({
                                        "foreign_fieldname": foreign_fieldname,
                                        "label": child_field.label,
                                        "local_fieldname": relevant_parent_link_field.fieldname,
                                        "primary_key": relevant_primary_key_field.fieldname,
                                        "doctype": field.options,
                                        "type": "One to Many",
                                        "description": "Parent Single, Child Many Link"
                                    })

    return link_fields