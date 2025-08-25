import frappe
import openpyxl
from frappe.utils.response import build_response
from io import BytesIO

EXCLUDED_FIELD_TYPES = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]

def get_field_meta(fields, exclude_types=None):
    exclude_types = exclude_types or []
    return [
        {"fieldname": f.fieldname, "label": f.label, "fieldtype": f.fieldtype}
        for f in fields if f.fieldname and f.fieldtype not in exclude_types
    ]

def get_link_title(field, value):
    if not value:
        return value
    related_meta = frappe.get_meta(field.options)
    title_field = related_meta.title_field or "name"
    return frappe.db.get_value(field.options, value, title_field) or value

def get_child_table_data(field, docname, doctype):
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
                row[child_field.fieldname] = get_link_title(child_field, row.get(child_field.fieldname))
    return {
        "data": child_rows,
        "meta": get_field_meta(child_meta.fields)
    } if child_rows else None

def get_title(doctype, docname, as_title_field=True):
    doc = frappe.db.get_value(doctype, docname, "*", as_dict=True)
    main_meta = frappe.get_meta(doctype)
    fields_meta = get_field_meta(main_meta.fields)
    if as_title_field:
        for field in main_meta.fields:
            if field.fieldtype == "Link":
                doc[field.fieldname] = get_link_title(field, doc.get(field.fieldname))
            elif field.fieldtype in ["Table", "Table MultiSelect"]:
                child_data = get_child_table_data(field, docname, doctype)
                if child_data:
                    doc[field.fieldname] = child_data
    return {"data": doc, "meta": fields_meta}

def get_related_tables(doctype, docname, exclude_meta_fields=None):
    exclude_meta_fields = exclude_meta_fields or []
    main_data = get_title(doctype, docname, True)
    sva_dt_config = frappe.get_doc("SVADatatable Configuration", doctype)
    related_tables = []
    for child in sva_dt_config.child_doctypes:
        if child.connection_type == "Is Custom Design":
            continue
        table_doctype = child.link_doctype if child.connection_type != "Referenced" else child.referenced_link_doctype
        filters = {}
        if child.connection_type == "Direct":
            filters = {child.link_fieldname: main_data.get('name')}
        elif child.connection_type == "Indirect":
            filters = {child.foreign_field: main_data.get(child.local_field)}
        elif child.connection_type == "Referenced":
            filters = {
                child.dn_reference_field: main_data.get('name'),
                child.dt_reference_field: main_data.get('doctype')
            }
        try:
            meta = frappe.get_meta(table_doctype)
            table_data = frappe.get_all(table_doctype, filters=filters, fields=["name"])
            all_docs = [get_title(table_doctype, row.name, True) for row in table_data]
            fields_meta = get_field_meta(meta.fields, exclude_meta_fields)
            if all_docs:
                related_tables.append({
                    "table_doctype": table_doctype,
                    "html_field": child.html_field,
                    "data": all_docs,
                    "meta": fields_meta
                })
        except Exception as e:
            frappe.log_error(f"Error fetching data for {table_doctype}: {str(e)}")
    return main_data, related_tables

def format_value(value):
    if hasattr(value, 'strftime'):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    return str(value) if value is not None else ""

@frappe.whitelist()
def export_json(doctype, docname):
    try:
        main_data, related_tables = get_related_tables(doctype, docname, EXCLUDED_FIELD_TYPES)
        result = {
            "main_table": {
                "data": main_data.get("data", {}),
                "meta": main_data.get("meta", [])
            },
            "related_tables": [
                {
                    "table_doctype": table["table_doctype"],
                    "html_field": table["html_field"],
                    "data": [doc.get("data", {}) for doc in table["data"]],
                    "meta": table["meta"]
                }
                for table in related_tables
            ]
        }
        return result
    except Exception as e:
        return {"error": str(e)}

@frappe.whitelist()
def export_excel(doctype="Grant", docname="Grant-2391"):
    try:
        main_data, related_tables = get_related_tables(doctype, docname, EXCLUDED_FIELD_TYPES)
        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        def write_sheet(ws, meta, rows):
            headers = [f["label"] or f["fieldname"] for f in meta]
            ws.append(headers)
            for row in rows:
                ws.append([format_value(row.get(f["fieldname"], "")) for f in meta])

        # Main table
        ws_main = wb.create_sheet(title=doctype[:31])
        main_meta = [f for f in main_data.get("meta", []) if f["fieldtype"] not in EXCLUDED_FIELD_TYPES]
        main_row = main_data.get("data", {})
        write_sheet(ws_main, main_meta, [main_row])

        # Child tables
        for field in main_data.get("meta", []):
            if field["fieldtype"] in ["Table", "Table MultiSelect"]:
                value = main_row.get(field["fieldname"])
                if isinstance(value, dict) and "data" in value and "meta" in value:
                    child_meta = [f for f in value["meta"] if f["fieldtype"] not in EXCLUDED_FIELD_TYPES]
                    ws_child = wb.create_sheet(title=field["fieldname"][:31])
                    write_sheet(ws_child, child_meta, value["data"])

        # Related tables
        for table in related_tables:
            meta = [f for f in table["meta"] if f["fieldtype"] not in EXCLUDED_FIELD_TYPES]
            data = [doc.get("data", {}) for doc in table["data"]]
            ws = wb.create_sheet(title=table["table_doctype"][:31])
            write_sheet(ws, meta, data)

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        frappe.response['filename'] = f"{doctype}_{docname}_export.xlsx"
        frappe.response['filecontent'] = output.read()
        frappe.response['type'] = 'binary'
        frappe.response['doctype'] = None
        return build_response("download")
    except Exception as e:
        frappe.log_error(f"Export Excel Error: {str(e)}")
        return {"error": str(e)}