import frappe

@frappe.whitelist()
def get_meta(doctype, filters=None):
    """
    Get filtered meta fields for a given doctype.

    Args:
        doctype (str): Doctype name
        filters (dict): Key-value conditions to filter fields.
                        Supports exact match, list IN/NOT IN, and bool flags.

    Example filters:
        {"fieldtype": ["Link", "Data"], "reqd": 1}
        {"fieldtype": {"NOT IN": ["Section Break", "HTML"]}}
        {"fieldname": {"IN": ["customer", "company"]}, "in_list_view": 1}

    Returns:
        list: Filtered list of fields (DocField objects)
    """

    meta = frappe.get_meta(doctype)
    fields = []

    for f in meta.fields:
        if not f.fieldname:
            continue

        match = True
        if filters:
            for key, condition in filters.items():
                value = getattr(f, key, None)

                if isinstance(condition, dict):
                    if "IN" in condition and value not in condition["IN"]:
                        match = False
                        break
                    if "NOT IN" in condition and value in condition["NOT IN"]:
                        match = False
                        break
                elif isinstance(condition, list):
                    if value not in condition:
                        match = False
                        break
                else:
                    if value != condition:
                        match = False
                        break

        if match:
            fields.append(f)

    return fields
