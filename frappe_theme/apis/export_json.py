import frappe
import openpyxl
from frappe.utils.response import build_response

def get_related_tables(doctype, docname):
    doc = frappe.get_doc(doctype, docname)
    main_data = doc.as_dict()
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
        else:
            continue  # Skip unused types

        try:
            table_data = frappe.get_all(
                table_doctype,
                filters=filters,
                fields=["*"]
            )
        except Exception as e:
            table_data = []

        meta = frappe.get_meta(table_doctype)
        # Exclude non-relevant fieldtypes
        excluded_fieldtypes = {"Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"}
        fields_meta = [
            {
                "fieldname": f.fieldname,
                "label": f.label,
                "fieldtype": f.fieldtype
            }
            for f in meta.fields
            if f.fieldtype not in excluded_fieldtypes and f.fieldname  # Only include fields with a fieldname
        ]

        related_tables.append({
            "table_doctype": table_doctype,
            "html_field": html_field,
            "data": table_data,
            "meta": fields_meta if table_data else {}
        })

    return main_data, related_tables

@frappe.whitelist()
def export_json(doctype, docname):
    try:
        main_data, related_tables = get_related_tables(doctype, docname)
        return {
            "main_data": main_data,
            "related_tables": related_tables
        }
    except Exception as e:
        return {"error": str(e)}

@frappe.whitelist()
def export_excel(doctype, docname):
    try:
        main_data, related_tables = get_related_tables(doctype, docname)

        # Create Excel workbook
        wb = openpyxl.Workbook()
        wb.remove(wb.active)  # Remove default sheet

        for table in related_tables:
            ws = wb.create_sheet(title=table["table_doctype"][:31])  # Excel sheet name max 31 chars
            data = table["data"]
            meta = table["meta"]

            # Write headers
            if isinstance(meta, list) and meta:
                headers = [f["label"] or f["fieldname"] for f in meta]
                ws.append(headers)
                # Write data rows
                for row in data:
                    ws.append([row.get(f["fieldname"], "") for f in meta])
            else:
                ws.append(["No Data"])

        # Save to bytes
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
        return {"error": str(e)}


