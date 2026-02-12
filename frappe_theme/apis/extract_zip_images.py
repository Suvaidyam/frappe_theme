import os
import uuid
import zipfile

import frappe
from frappe.utils.file_manager import save_file


@frappe.whitelist()
def extract_zip_images(file_url):
	"""
	- Extract zip
	- Accept ONLY images
	- Create File records
	- Return file_url + file_name
	"""

	file_doc = frappe.get_doc("File", {"file_url": file_url})
	zip_path = file_doc.get_full_path()

	if not zipfile.is_zipfile(zip_path):
		frappe.throw("Invalid ZIP file")

	extracted_images = []

	with zipfile.ZipFile(zip_path, "r") as zip_ref:
		for zip_info in zip_ref.infolist():
			# skip folders
			if zip_info.is_dir():
				continue

			filename = zip_info.filename.lower()

			# allow only images
			if not filename.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
				continue

			file_bytes = zip_ref.read(zip_info)

			new_name = f"{uuid.uuid4().hex}_{os.path.basename(filename)}"

			saved_file = save_file(fname=new_name, content=file_bytes, dt=None, dn=None, is_private=1)

			extracted_images.append({"file_url": saved_file.file_url, "file_name": saved_file.file_name})

	return extracted_images
