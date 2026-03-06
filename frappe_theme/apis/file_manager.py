import os
from io import BytesIO

import frappe
from frappe.utils.file_manager import get_file


@frappe.whitelist()
def download_file(file_path):
	file_data = get_file(file_path)
	file_name = os.path.basename(file_data[0])
	file_content = file_data[1]
	file_stream = BytesIO(file_content)
	frappe.local.response.filename = file_name
	frappe.local.response.filecontent = file_stream.getvalue()
	frappe.local.response.type = "download"
