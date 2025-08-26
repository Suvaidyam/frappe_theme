import frappe
import openpyxl
import json
from frappe.utils.response import build_response
from frappe_theme.api import get_files


def get_title(doctype, docname, as_title_field=True):
    doc = frappe.db.get_value(doctype, docname, "*", as_dict=True)
    main_doc_meta = frappe.get_meta(doctype)

    fields_meta = [f for f in main_doc_meta.fields if f.fieldname]
    if as_title_field:
        for field in main_doc_meta.fields:
            if field.fieldtype == "Link":
                link_val = doc.get(field.fieldname)
                if link_val:
                    related_doc_meta = frappe.get_meta(field.options)
                    title_field = related_doc_meta.title_field or "name"
                    doc[field.fieldname] = frappe.db.get_value(field.options, link_val, title_field) or link_val
            elif field.fieldtype in ["Table", "Table MultiSelect"]:
                child_doctype = field.options
                child_meta = frappe.get_meta(child_doctype)
                child_rows = frappe.get_all(
                    child_doctype,
                    filters={"parent": docname, "parenttype": doctype, "parentfield": field.fieldname},
                    fields="*"
                )
                for row in child_rows:
                    for child_field in child_meta.fields:
                        if child_field.fieldtype == "Link":
                            link_val = row.get(child_field.fieldname)
                            if link_val:
                                related_child_meta = frappe.get_meta(child_field.options)
                                title_field = related_child_meta.title_field or "name"
                                row[child_field.fieldname] = frappe.db.get_value(child_field.options, link_val, title_field) or link_val
                child_fields_meta = [f for f in child_meta.fields if f.fieldname]
                if child_rows:
                    doc[field.fieldname] = {
                        "data": child_rows,
                        "meta": child_fields_meta
                    }
    for field in main_doc_meta.fields:
        if field.fieldtype in ["Attach", "Attach Image"]:
            attach_val = doc.get(field.fieldname)
            if attach_val and not attach_val.startswith("http"):
                base_url = frappe.utils.get_url()
                doc[field.fieldname] = f"{base_url}{attach_val}"
    return {
        "data": doc,
        "meta": fields_meta,
    }

def get_related_tables(doctype, docname , exclude_meta_fields=[] , as_title_field= True):
    main_data = get_title(doctype, docname, as_title_field)

    sva_dt_config = frappe.get_doc("SVADatatable Configuration", doctype)
    related_tables = []

    for child in sva_dt_config.child_doctypes:
        html_field = child.html_field
        table_doctype = None
        filters = {}
        if child.connection_type == "Direct":
            table_doctype = child.link_doctype
            filters = {
                child.link_fieldname: main_data['data'].get('name')
            }
        elif child.connection_type == "Indirect":
            table_doctype = child.link_doctype
            filters = {
                child.foreign_field: main_data['data'].get(child.local_field)
            }
        elif child.connection_type == "Referenced":
            table_doctype = child.referenced_link_doctype
            filters = {
                child.dn_reference_field: main_data['data'].get('name'),
                child.dt_reference_field: doctype
            }
        elif child.connection_type == "Unfiltered":
            table_doctype = child.link_doctype
            filters = {}
        elif child.connection_type == "Is Custom Design":
            if child.template == "Notes":
                table_doctype = "Notes"
                filters = {
                    "reference_doctype": doctype,
                    "related_to": main_data['data'].get('name')
                }
            elif child.template == "Tasks":
                table_doctype = "ToDo"
                filters = {
                    "reference_type": doctype,
                    "reference_name": main_data['data'].get('name')
                }
            elif child.template == "Gallery":
                # This will return file related to doctype and docname
                continue
                data = get_files(doctype, main_data['data'].get('name'))

            elif child.template == "Email":
                table_doctype = "Communication"
                filters = {
                    "reference_doctype": doctype,
                    "reference_name": main_data['data'].get('name')
                }
            elif child.template == "Linked Users":
                continue
            else:
                table_doctype = "Geography Details"
                filters = {
                    "document_type": doctype,
                    "docname": main_data['data'].get('name')
                }

        try:
            meta = frappe.get_meta(table_doctype)
            table_data = frappe.db.get_list(
                table_doctype,
                filters=filters,
                fields=["name"]
            )
            all_docs = []
            for row in table_data:
                doc = get_title(table_doctype, row.name, as_title_field)
                all_docs.append(doc)

            fields_meta = [f for f in meta.fields if f.fieldtype not in exclude_meta_fields and f.fieldname]
            # convert string to JSON in child table
            if child:
                _child = child.as_dict()
                _child.update({
                    "listview_settings": json.loads(child.listview_settings or "[]"),
                    "crud_permissions": json.loads(child.crud_permissions or "[]"),
                    "extended_condition": json.loads(child.extended_condition or "[]")
                })

            if len(all_docs):
                related_tables.append({
                    "table_doctype": table_doctype,
                    "html_field": html_field,
                    "data": all_docs,
                    "sva_dt_meta": _child,
                    "meta": fields_meta if all_docs else {},
            })
        except Exception as e:
            frappe.log_error(f"Error fetching data for {table_doctype}: {str(e)}")
            table_data = []

    return main_data, related_tables

@frappe.whitelist()
def export_json(doctype, docname):
    try:
        excluded_fieldtypes = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
        main_data, related_tables = get_related_tables(doctype, docname, excluded_fieldtypes, True)
        # Structure output as per latest format
        result = {
            "main_table": {
                "data": main_data.get("data", {}),
                "meta": main_data.get("meta", [])
            },
            "related_tables": []
        }
        for table in related_tables:
            result["related_tables"].append({
                "table_doctype": table.get("table_doctype"),
                "html_field": table.get("html_field"),
                "data": [doc.get("data", {}) for doc in table.get("data", [])],
                "meta": table.get("meta", []),
                "sva_dt_meta": table.get("sva_dt_meta", {})
            })
        return result
    except Exception as e:
        return {"error": str(e)}

@frappe.whitelist()
def export_excel(doctype="Grant", docname="Grant-2391"):
    pass