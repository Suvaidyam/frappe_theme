import frappe
from frappe_theme.apis.export_json import get_related_tables
from frappe_theme.utils import generate_pdf_template


@frappe.whitelist()
def export_pdf(doctype, docname):
    try:
        main_data, related_tables = get_related_tables(doctype, docname)
        generate_pdf_template('frappe_theme/templates/pages/doc_template.html','Application Testing',doc = main_data, related_tables = related_tables)
    except Exception as e:
        return {"error": str(e)}