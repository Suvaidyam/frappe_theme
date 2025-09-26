# your_app/api.py
import json
import frappe

@frappe.whitelist()
def save_field_data_protection(values):
    try:
        if isinstance(values, str):
            values = frappe.parse_json(values)
        if not values.doc_type or not values.fname:
            frappe.throw('Doctype and Fieldname is required.')

        if not frappe.db.exists("SVAProperty Setter",{"doc_type": values.doc_type, "fname": values.fname}):
            doc = frappe.new_doc("SVAProperty Setter")
            doc.update(values)
            doc.insert(ignore_permissions=True)
        else:
            doc = frappe.get_doc("SVAProperty Setter",{"doc_type": values.doc_type, "fname": values.fname})
            doc.update(values)
            doc.flags.ignore_permissions = True
            doc.save()
        return {"ok": True}
    except Exception as e:
        frappe.log_error('Error in save_field_data_protection',frappe.get_traceback())
        return {"ok": False}

@frappe.whitelist()
def get_field_data_protection(doctype, fieldname):
    """Return parsed config or null."""
    try:
        if not doctype or not fieldname:
            frappe.log_error('doctype or fieldname is required for get_field_data_protection')
            return {}
        if not frappe.db.exists("SVAProperty Setter",{"doc_type": doctype, "fname": fieldname}):
            return {}
        else:
            return frappe.db.get_value("SVAProperty Setter",{"doc_type": doctype, "fname": fieldname},"*")
    except Exception as e:
        frappe.log_error('Error in get_field_data_protection',frappe.get_traceback())
        return {}


@frappe.whitelist()
def get_field_validation(doctype, fieldname):
    try:
        if not doctype or not fieldname:
            frappe.log_error('doctype or fieldname is required for get_field_validation')
            return {}
        if not frappe.db.exists("Property Setter",{"doc_type": doctype, "field_name": fieldname, "property": "regex_validation"}):
            return {}
        else:
            return frappe.db.get_value("Property Setter",{"doc_type": doctype, "field_name": fieldname, "property": "regex_validation"},"*")
    except Exception as e:
        frappe.log_error('Error in get_field_validation',frappe.get_traceback())
        return {}

@frappe.whitelist()
def save_field_validation(values):
    try:
        if isinstance(values, str):
            values = frappe.parse_json(values)
        if not values.doc_type or not values.fname:
            frappe.throw('Doctype and Fieldname is required.')
        if not frappe.db.exists("Property Setter",{"doc_type": values.doc_type, "field_name": values.fname, "property": "regex_validation"}):
            doc = frappe.new_doc("Property Setter")
            doc.doc_type = values.doc_type
            doc.field_name = values.fname
            doc.doctype_or_field = "DocField"
            doc.property = "regex_validation"
            doc.value = values.cus_data
            doc.property_type = "Text"
            doc.insert(ignore_permissions=True)
        else:
            doc = frappe.get_doc("Property Setter",{"doc_type": values.doc_type, "field_name": values.fname, "property": "regex_validation"})
            doc.doctype_or_field = "DocField"
            doc.value = values.cus_data
            doc.property_type = "Text"
            doc.flags.ignore_permissions = True
            doc.save()
        return {"ok": True}
    except Exception as e:
        frappe.log_error('Error in save_field_validation',frappe.get_traceback())
        return {"ok": False}