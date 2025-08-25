import frappe
import openpyxl
from frappe.utils.response import build_response

import frappe

def get_title(doctype, docname, as_title_field=True):
    doc = frappe.db.get_value(doctype, docname, "*", as_dict=True)
    main_doc_meta = frappe.get_meta(doctype)
    # Prepare meta info for main doc
    fields_meta = [
        {
            "fieldname": f.fieldname,
            "label": f.label,
            "fieldtype": f.fieldtype
        }
        for f in main_doc_meta.fields
        if f.fieldname
    ]
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
                child_fields_meta = [
                    {
                        "fieldname": f.fieldname,
                        "label": f.label,
                        "fieldtype": f.fieldtype
                    }
                    for f in child_meta.fields
                    if f.fieldname
                ]
                if child_rows:
                    doc[field.fieldname] = {
                        "data": child_rows,
                        "meta": child_fields_meta
                    }
    return {
        "data": doc,
        "meta": fields_meta
    }

def get_related_tables(doctype, docname , exclude_meta_fields=[]):
    main_data = get_title(doctype, docname, True)

    sva_dt_config = frappe.get_doc("SVADatatable Configuration", doctype)
    related_tables = []

    for child in sva_dt_config.child_doctypes:
        html_field = child.html_field
        table_doctype = None
        filters = {}

        if child.connection_type == "Direct":
            table_doctype = child.link_doctype
            filters = {child.link_fieldname: main_data.get('name')}
        elif child.connection_type == "Indirect":
            table_doctype = child.link_doctype
            filters = {child.foreign_field: main_data.get(child.local_field)}
        elif child.connection_type == "Referenced":
            table_doctype = child.referenced_link_doctype
            filters = {
                child.dn_reference_field: main_data.get('name'),
                child.dt_reference_field: main_data.get('doctype')
            }
        elif child.connection_type == "Unfiltered":
            table_doctype = child.link_doctype
            filters = {}
        elif child.connection_type == "Is Custom Design":
            continue  # Skip custom design tables

        try:
            meta = frappe.get_meta(table_doctype)
            table_data = frappe.get_all(
                table_doctype,
                filters=filters,
                fields=["name"]
            )
            all_docs = []
            for row in table_data:
                doc = get_title(table_doctype, row.name, True)
                all_docs.append(doc)


        except Exception as e:
            frappe.log_error(f"Error fetching data for {table_doctype}: {str(e)}")
            table_data = []

        fields_meta = [
            {
                "fieldname": f.fieldname,
                "label": f.label,
                "fieldtype": f.fieldtype
            }
            for f in meta.fields
            if f.fieldtype not in exclude_meta_fields and f.fieldname
        ]
        if len(all_docs):
            related_tables.append({
                "table_doctype": table_doctype,
                "html_field": html_field,
                "data": all_docs,
                "meta": fields_meta if all_docs else {}
        })

    return main_data, related_tables

@frappe.whitelist()
def export_json(doctype, docname):
    try:
        excluded_fieldtypes = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
        main_data, related_tables = get_related_tables(doctype, docname, excluded_fieldtypes)
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
                "meta": table.get("meta", [])
            })
        return result
    except Exception as e:
        return {"error": str(e)}

@frappe.whitelist()
def export_excel(doctype="Grant", docname="Grant-2391"):
    try:
        excluded_fieldtypes = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
        main_data, related_tables = get_related_tables(doctype, docname, excluded_fieldtypes)

        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        ws_main = wb.create_sheet(title=doctype[:31])
        main_meta = main_data.get("meta", [])
        main_row = main_data.get("data", {})
        main_form_meta = [f for f in main_meta if f["fieldtype"] not in excluded_fieldtypes]
        
        headers = [f["label"] or f["fieldname"] for f in main_form_meta]
        ws_main.append(headers)
        
        main_form_values = []
        for field in main_form_meta:
            fieldname = field["fieldname"]
            value = main_row.get(fieldname, "")
            if hasattr(value, 'strftime'):
                value = value.strftime('%Y-%m-%d %H:%M:%S')
            main_form_values.append(str(value) if value is not None else "")
        ws_main.append(main_form_values)

        for field in main_meta:
            fieldname = field["fieldname"]
            if field["fieldtype"] in ["Table", "Table MultiSelect"]:
                value = main_row.get(fieldname)
                if isinstance(value, dict) and "data" in value and "meta" in value:
                    ws_child = wb.create_sheet(title=fieldname[:31])
                    child_meta = [
                        f for f in value["meta"]
                        if f["fieldtype"] not in excluded_fieldtypes
                    ]
                    child_data = value["data"]
                    
                    child_headers = [f["label"] or f["fieldname"] for f in child_meta]
                    ws_child.append(child_headers)
                    
                    # Write child table data
                    for row in child_data:
                        child_row_values = []
                        for child_field in child_meta:
                            child_value = row.get(child_field["fieldname"], "")
                            # Convert datetime objects to strings for Excel compatibility
                            if hasattr(child_value, 'strftime'):
                                child_value = child_value.strftime('%Y-%m-%d %H:%M:%S')
                            child_row_values.append(str(child_value) if child_value is not None else "")
                        ws_child.append(child_row_values)

        # Related tables: each in its own sheet
        for table in related_tables:
            ws = wb.create_sheet(title=table["table_doctype"][:31])
            meta = [
                f for f in table.get("meta", [])
                if f["fieldtype"] not in excluded_fieldtypes
            ]
            data = table.get("data", [])
            
            # Write headers
            headers = [f["label"] or f["fieldname"] for f in meta]
            ws.append(headers)

            for doc in data:
                row_data = doc.get("data", {})
                row_values = []
                for field in meta:
                    value = row_data.get(field["fieldname"], "")
                    if hasattr(value, 'strftime'):
                        value = value.strftime('%Y-%m-%d %H:%M:%S')
                    row_values.append(str(value) if value is not None else "")
                ws.append(row_values)

        from io import BytesIO
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