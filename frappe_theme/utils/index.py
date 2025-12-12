import os
import re
from datetime import datetime

import frappe
from click.exceptions import Exit
from frappe.installer import update_site_config as _update_site_config
from frappe.utils import formatdate, nowdate
from frappe.utils.pdf import get_pdf

@frappe.whitelist()
def get_wf_state_by_closure(doctype, closure_type="Positive"):
    sql = f"""SELECT
            wfs.state,
            wfs.custom_closure
            FROM
            `tabWorkflow` AS wf
            INNER JOIN `tabWorkflow Document State` AS wfs ON wf.name = wfs.parent
            WHERE
            wf.document_type = '{doctype}' AND wf.is_active = 1 AND wfs.custom_closure = '{closure_type}'
        """
    list = frappe.db.sql(sql, as_dict=1)
    if len(list) > 0:
        return list[0].state
    return None

def get_state_closure_by_type(doctype,closure_type="Positive"):
    sql = f"""SELECT
            wfs.state,
            wfs.custom_closure
            FROM
            `tabWorkflow` AS wf
            INNER JOIN `tabWorkflow Document State` AS wfs ON wf.name = wfs.parent
            WHERE
            wf.document_type = '{doctype}' AND wf.is_active = 1 AND wfs.custom_closure = '{closure_type}'
        """
    list = frappe.db.sql(sql, as_dict=1)
    if len(list) > 0:
        return list[0].state
    return None

def get_state_closure(doctype, wf_state):
    sql = f"""SELECT
                wds.state,
                wds.custom_closure
            FROM `tabWorkflow` AS wf
            INNER JOIN `tabWorkflow Document State` AS wds ON wf.name = wds.parent
            WHERE 
                wf.document_type = '{doctype}' AND wds.state='{wf_state}' AND wds.custom_closure IN ('Positive', 'Negative') AND wf.is_active = 1"""
    list = frappe.db.sql(sql, as_dict=1)
    if len(list) > 0:
        return list[0].custom_closure
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


def send_file(bytes_data, filename, filetype="download"):
	frappe.local.response.filename = filename
	frappe.local.response.filecontent = bytes_data
	frappe.local.response.type = filetype


@frappe.whitelist()
def generate_pdf_template(template_path_or_print_format, filename=None, **kwargs):
	"""
	This function generates a PDF document based on a given template path or print format name.
	It uses the Frappe framework to render the template with provided context variables and then
	converts the rendered HTML to a PDF file. The generated PDF is then sent as a downloadable file.
	"""
	try:
		if (
			isinstance(template_path_or_print_format, str)
			and "templates/pages" in template_path_or_print_format
		):
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

		pdf_bytes = get_pdf(template_html)
		send_file(pdf_bytes, f"{base_filename}.pdf")

	except Exception as e:
		frappe.log_error(f"Error generating document: {str(e)}")
		frappe.throw(f"Error generating document: {str(e)}")
