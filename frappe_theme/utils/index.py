import frappe
from frappe.utils.pdf import get_pdf
from datetime import datetime
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

# @frappe.whitelist()
# def generate_docx_template(print_format, filename=None, **kwargs):
#     import pypandoc
#     import shutil
#     import os
#     """
#     Generate a docx template from a print format.
#     """
#     try:
#         if not shutil.which("pandoc"):
#             frappe.throw("Pandoc is not installed. Please run `sudo apt install pandoc`")
#         if not frappe.db.exists("Print Format", print_format):
#             frappe.throw(f"Print Format '{print_format}' does not exist")

#         filename = filename or print_format
#         print_format_template = frappe.get_doc("Print Format", print_format).html
#         mou_template = frappe.render_template(print_format_template, kwargs)
#         today = frappe.utils.nowdate()
#         formated_today = datetime.strptime(today, "%Y-%m-%d").strftime("%d-%m-%Y")
#         out_filename = f"{filename}_{formated_today}.docx"
#         file_path = os.path.join(frappe.get_site_path("private", "files"), f"{out_filename}")
#         pypandoc.convert_text(mou_template, 'docx', format='html', outputfile=file_path, extra_args=['--standalone'])
#         with open(file_path, "rb") as f:
#             filedata = f.read()
#         frappe.local.response.filename = out_filename
#         frappe.local.response.filecontent = filedata
#         frappe.local.response.type = "download"
#     except Exception as e:
#         frappe.log_error(f"Error generating docx template: {str(e)}")
#         frappe.throw(f"Error generating docx template: {str(e)}")


@frappe.whitelist()
def generate_pdf_template(template_path_or_print_format,filename=None,**kwargs):
    """
    Generate a PDF template from a Template page or print format.
    """
    try:
        try:
            if isinstance(template_path_or_print_format, str) and "templates/pages" in template_path_or_print_format:
                mou_template = frappe.get_template(template_path_or_print_format).render(kwargs)
            else:
                if frappe.db.exists("Print Format", template_path_or_print_format):
                    print_format_template = frappe.get_doc("Print Format", template_path_or_print_format).html
                    mou_template = frappe.render_template(print_format_template, kwargs)
                else:
                    frappe.log_error(f"Print Format not found: {template_path_or_print_format}")
                    frappe.throw(f"Print Format not found: {template_path_or_print_format}")
        except Exception:
            frappe.log_error(f"Template path or print format not found: {template_path_or_print_format}")
            frappe.throw(f"Template path or print format not found: {template_path_or_print_format}")
        try:
            pdf = get_pdf(mou_template)
        except Exception as e:
            frappe.log_error(f"Error in converting to PDF: {str(e)}")
            frappe.throw(f"Error in converting to PDF: {str(e)}")
        today = frappe.utils.nowdate()
        formated_today = datetime.strptime(today, "%Y-%m-%d").strftime("%d-%m-%Y")
        if filename:
            _filename = f"{filename}_{formated_today}.pdf"
        else:
            _filename = f"{template_path_or_print_format}_{formated_today}.pdf"
        frappe.local.response.filename = _filename
        frappe.local.response.filecontent = pdf
        frappe.local.response.type = "download"
    except Exception as e:
        frappe.log_error(f"Error generating PDF template: {str(e)}")
        frappe.throw(f"Error generating PDF template: {str(e)}")
