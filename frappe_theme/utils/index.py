from click.exceptions import Exit
import frappe
from frappe.utils.pdf import get_pdf
from datetime import datetime
import os
import re
from frappe.installer import update_site_config as _update_site_config

@frappe.whitelist()
def get_wf_state_by_closure(doctype, closure_type="Positive"):
    sql = """SELECT
            wfs.state,
            wfs.custom_closure
            FROM
            `tabWorkflow` AS wf
            INNER JOIN `tabWorkflow Document State` AS wfs ON wf.name = wfs.parent
            WHERE
            wf.document_type = %s AND wf.is_active = 1 AND wfs.custom_closure = %s
        """
    list = frappe.db.sql(sql, (doctype, closure_type), as_dict=1)
    if len(list) > 0:
        return list[0].state
    return None

@frappe.whitelist()
def update_site_config(key, value):
    """
    Update a key in the site config with the given value.
    """
    if frappe.session.user != "Administrator":
        frappe.throw("You are not authorized to perform this action.", frappe.PermissionError)

    try:
        _update_site_config(key, value)
        return frappe.get_site_config().get(key, None)
    except Exception as e:
        frappe.throw(f"Failed to update site config: {str(e)}", frappe.ValidationError)


from io import BytesIO
import tempfile
from pdf2docx import Converter
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from frappe.utils.pdf import get_pdf
from frappe.utils import nowdate, formatdate

def pdf_bytes_to_docx_bytes(pdf_bytes: bytes) -> bytes:
    # Convert PDF → DOCX using temp files
    with tempfile.NamedTemporaryFile(suffix=".pdf") as temp_pdf:
        temp_pdf.write(pdf_bytes)
        temp_pdf.flush()

        with tempfile.NamedTemporaryFile(suffix=".docx") as temp_docx:
            cv = Converter(temp_pdf.name)
            cv.convert(temp_docx.name)
            cv.close()

            temp_docx.seek(0)
            docx_bytes = temp_docx.read()

    # Post-process DOCX: add table borders
    docx_stream = BytesIO(docx_bytes)
    doc = Document(docx_stream)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                tc = cell._tc
                tcPr = tc.get_or_add_tcPr()
                tcBorders = tcPr.first_child_found_in("w:tcBorders")
                if tcBorders is None:
                    tcBorders = OxmlElement('w:tcBorders')
                    tcPr.append(tcBorders)
                for border_name in ['top', 'left', 'bottom', 'right']:
                    border = OxmlElement(f'w:{border_name}')
                    border.set(qn('w:val'), 'single')   # solid border
                    border.set(qn('w:sz'), '4')         # thickness
                    border.set(qn('w:space'), '0')
                    border.set(qn('w:color'), '000000')
                    tcBorders.append(border)

    # Return updated DOCX bytes
    new_stream = BytesIO()
    doc.save(new_stream)
    new_stream.seek(0)
    return new_stream.read()

def send_file(bytes_data, filename, filetype="download"):
    frappe.local.response.filename = filename
    frappe.local.response.filecontent = bytes_data
    frappe.local.response.type = filetype

@frappe.whitelist()
def generate_pdf_template(template_path_or_print_format, filename=None, **kwargs):
    """
    Generates PDF by default, DOCX if kwargs['type'] == 'docx'
    """
    try:
        # Render template
        if isinstance(template_path_or_print_format, str) and "templates/pages" in template_path_or_print_format:
            template_html = frappe.get_template(template_path_or_print_format).render(kwargs)
        else:
            if frappe.db.exists("Print Format", template_path_or_print_format):
                print_format_template = frappe.get_doc("Print Format", template_path_or_print_format).html
                template_html = frappe.render_template(print_format_template, kwargs)
            else:
                frappe.throw(f"Print Format not found: {template_path_or_print_format}")

        # Generate filename with date
        today = nowdate()
        formatted_today = formatdate(today, "dd-MM-yyyy")
        base_filename = (filename or template_path_or_print_format) + f"_{formatted_today}"

        # Conditional PDF or DOCX
        if kwargs.get("type") == "docx":
            pdf_bytes = get_pdf(template_html)
            docx_bytes = pdf_bytes_to_docx_bytes(pdf_bytes)
            send_file(docx_bytes, f"{base_filename}.docx")
        else:
            pdf_bytes = get_pdf(template_html)
            send_file(pdf_bytes, f"{base_filename}.pdf")

    except Exception as e:
        frappe.log_error(f"Error generating document: {str(e)}")
        frappe.throw(f"Error generating document: {str(e)}")
