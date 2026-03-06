# import frappe
# import os

# @frappe.whitelist()
# def download_file(file_path):
#     base_url = frappe.utils.get_url()
#     file_path = f"{base_url}/{file_path.lstrip('/')}"
#     # file_path = frappe.get_site_path(file_path)
    
#     print(file_path,'=========================file_path===========================')
#     if not os.path.exists(file_path):
#         frappe.throw("File not found")
#     with open(file_path, "rb") as f:
#         file_content = f.read()
        
#     frappe.local.response.filename = os.path.basename(file_path)
#     frappe.local.response.filecontent = file_content
#     frappe.local.response.type = "download"
    
import frappe
from frappe.utils.file_manager import get_file
from io import BytesIO
import os
@frappe.whitelist()
def download_file(file_path):
    file_data = get_file(file_path)
    file_name = os.path.basename(file_data[0])
    file_content = file_data[1]
    file_stream = BytesIO(file_content)
    frappe.local.response.filename = file_name
    frappe.local.response.filecontent = file_stream.getvalue()
    frappe.local.response.type = "download"
