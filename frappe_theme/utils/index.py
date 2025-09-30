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

# @frappe.whitelist()
# def generate_docx_template(template_path_or_print_format, filename=None, **kwargs):
#     """
#     Generate a DOCX template from HTML with excellent layout preservation.
#     """
#     from htmldocx import HtmlToDocx
#     from docx import Document
#     from docx.shared import Inches
#     from bs4 import BeautifulSoup
#     import os
#     from datetime import datetime
    
#     try:
#         # Get HTML template
#         if isinstance(template_path_or_print_format, str) and "templates/pages" in template_path_or_print_format:
#             html_content = frappe.get_template(template_path_or_print_format).render(kwargs)
#         else:
#             if frappe.db.exists("Print Format", template_path_or_print_format):
#                 print_format_template = frappe.get_doc("Print Format", template_path_or_print_format).html
#                 html_content = frappe.render_template(print_format_template, kwargs)
#             else:
#                 frappe.throw(f"Print Format not found: {template_path_or_print_format}")
        
#         # Create document
#         document = Document()
        
#         # Set margins
#         for section in document.sections:
#             section.top_margin = Inches(0.5)
#             section.bottom_margin = Inches(0.5)
#             section.left_margin = Inches(0.75)
#             section.right_margin = Inches(0.75)
        
#         # Convert HTML to DOCX using htmldocx
#         parser = HtmlToDocx()
#         parser.add_html_to_document(html_content, document)
        
#         # Generate filename
#         filename = filename or template_path_or_print_format
#         today = frappe.utils.nowdate()
#         formatted_today = datetime.strptime(today, "%Y-%m-%d").strftime("%d-%m-%Y")
#         out_filename = f"{filename}_{formatted_today}.docx"
#         file_path = os.path.join(frappe.get_site_path("private", "files"), out_filename)
        
#         # Save and send
#         document.save(file_path)
        
#         with open(file_path, "rb") as f:
#             filedata = f.read()
        
#         frappe.local.response.filename = out_filename
#         frappe.local.response.filecontent = filedata
#         frappe.local.response.type = "download"
        
#     except Exception as e:
#         frappe.log_error(f"Error generating DOCX template: {str(e)}")
#         frappe.throw(f"Error generating DOCX template: {str(e)}")


@frappe.whitelist()
def generate_docx_template(template_path_or_print_format, filename=None, **kwargs):
    """
    Generate a DOCX template from HTML with robust error handling.
    """
    try:
        html_content = get_html_content(template_path_or_print_format, kwargs)
        cleaned_html = clean_html_for_docx(html_content)
        try:
            return generate_with_htmldocx(cleaned_html, filename, template_path_or_print_format)
        except Exception as e1:
            frappe.log_error(f"htmldocx failed: {str(e1)}", "DOCX Generation Method 1")
    
    except Exception as e:
        frappe.log_error(f"Fatal error in generate_docx_template: {str(e)}")
        frappe.throw(f"Error generating DOCX template: {str(e)}")


def get_html_content(template_path_or_print_format, kwargs):
    """Extract HTML content from template or print format."""
    try:
        if isinstance(template_path_or_print_format, str) and "templates/pages" in template_path_or_print_format:
            return frappe.get_template(template_path_or_print_format).render(kwargs)
        else:
            if frappe.db.exists("Print Format", template_path_or_print_format):
                print_format_template = frappe.get_doc("Print Format", template_path_or_print_format).html
                return frappe.render_template(print_format_template, kwargs)
            else:
                frappe.throw(f"Print Format not found: {template_path_or_print_format}")
    except Exception as e:
        frappe.log_error(f"Template rendering error: {str(e)}")
        frappe.throw(f"Template path or print format not found: {template_path_or_print_format}")


def clean_html_for_docx(html_content):
    """
    Aggressively clean HTML to make it compatible with DOCX converters.
    Removes problematic elements and simplifies structure.
    """
    from bs4 import BeautifulSoup
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    for tag in soup(['script', 'style', 'link', 'meta', 'head']):
        tag.decompose()
    
    for tag in soup.find_all(True):
        if tag.has_attr('class'):
            classes = tag.get('class', [])
            tag['class'] = [c for c in classes if c in ['bordered-table', 'report-table']]
            if not tag['class']:
                del tag['class']
        
        if tag.has_attr('style'):
            del tag['style']
        
        attrs_to_remove = [attr for attr in tag.attrs if attr.startswith('data-')]
        for attr in attrs_to_remove:
            del tag[attr]
    
    for tag in soup.find_all(['td', 'th']):
        if tag.get_text(strip=True) == '' or tag.get_text(strip=True) == '\xa0':
            tag.string = ' '
    
    for table in soup.find_all('table'):
        if not table.find('tbody'):
            tbody = soup.new_tag('tbody')
            for row in table.find_all('tr'):
                tbody.append(row.extract())
            table.append(tbody)
        
        for section in table.find_all(['thead', 'tfoot']):
            for row in section.find_all('tr'):
                table.tbody.insert(0, row)
            section.decompose()
    
    for div in soup.find_all('div'):
        if not div.find_all(['div', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            div.name = 'p'
    
    cleaned = str(soup)
    
    cleaned = re.sub(r'<!DOCTYPE[^>]*>', '', cleaned)
    cleaned = re.sub(r'<html[^>]*>', '', cleaned)
    cleaned = re.sub(r'</html>', '', cleaned)
    cleaned = re.sub(r'<body[^>]*>', '', cleaned)
    cleaned = re.sub(r'</body>', '', cleaned)
    
    return cleaned


def generate_with_htmldocx(html_content, filename, template_name):
    """Generate DOCX using htmldocx library."""
    from htmldocx import HtmlToDocx
    from docx import Document
    from docx.shared import Inches
    
    document = Document()
    
    for section in document.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
    
    parser = HtmlToDocx()
    
    try:
        parser.add_html_to_document(html_content, document)
    except IndexError as e:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for element in soup.find_all(['table', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol']):
            try:
                parser.add_html_to_document(str(element), document)
            except:
                continue
    
    return save_and_send_docx(document, filename, template_name)

def save_and_send_docx(document, filename, template_name):
    import io
    """Save document and prepare for download."""
    today = frappe.utils.nowdate()
    formatted_today = datetime.strptime(today, "%Y-%m-%d").strftime("%d-%m-%Y")
    out_filename = f"{filename or template_name}_{formatted_today}.docx"
    file_buffer = io.BytesIO()
    document.save(file_buffer)
    file_buffer.seek(0)

    frappe.local.response.filename = out_filename
    frappe.local.response.filecontent = file_buffer.read()
    frappe.local.response.type = "download"
    return out_filename

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
