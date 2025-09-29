import os
import re

import frappe
from frappe import _

from frappe_theme.controllers.sva_integrations.cloud_assets.s3_bucket import S3Operations


def get_cloud_upload_exclusions(exclusion_list: str | dict) -> list:
	"""
	Function to get the cloud upload exclusions list.
	"""
	if not exclusion_list:
		return []

	if isinstance(exclusion_list, str):
		import json

		exclusion_list = json.loads(exclusion_list)
	return [d.get("include_doctype") for d in exclusion_list if d.get("include_doctype")]


@frappe.whitelist()
def file_upload_to_s3(doc, method):
	"""
	check and upload files to s3. the path check and
	"""
	cloud_assets = frappe.get_single("Cloud Assets").as_dict()
	if not cloud_assets.enable:
		return

	s3_upload = S3Operations()
	path = doc.file_url
	site_path = frappe.utils.get_site_path()
	parent_doctype = doc.attached_to_doctype or "File"
	parent_name = doc.attached_to_name
	if parent_doctype not in get_cloud_upload_exclusions(cloud_assets.cloud_asset_exclusion):
		if not doc.is_private:
			file_path = site_path + "/public" + path
		else:
			file_path = site_path + path
		key = s3_upload.upload_files_to_s3_with_key(
			file_path, doc.file_name, doc.is_private, parent_doctype, parent_name
		)

		if doc.is_private:
			method = "frappe_theme.controllers.sva_integrations.cloud_assets.generate_file"
			file_url = f"""/api/method/{method}?key={key}&file_name={doc.file_name}"""
		else:
			file_url = f"{s3_upload.S3_CLIENT.meta.endpoint_url}/{s3_upload.BUCKET}/{key}"
		os.remove(file_path)
		frappe.db.sql(
			"""UPDATE `tabFile` SET file_url=%s, folder=%s,
            old_parent=%s, content_hash=%s WHERE name=%s""",
			(file_url, "Home/Attachments", "Home/Attachments", key, doc.name),
		)

		doc.file_url = file_url

		if parent_doctype and frappe.get_meta(parent_doctype).get("image_field"):
			frappe.db.set_value(
				parent_doctype, parent_name, frappe.get_meta(parent_doctype).get("image_field"), file_url
			)

		frappe.db.commit()


@frappe.whitelist()
def generate_file(key=None, file_name=None):
	"""
	Function to stream file from s3.
	"""
	if key:
		s3_upload = S3Operations()
		signed_url = s3_upload.get_url(key, file_name)
		frappe.local.response["type"] = "redirect"
		frappe.local.response["location"] = signed_url
	else:
		frappe.local.response["body"] = "Key not found."
	return


def upload_existing_files_s3(name):
	"""
	Function to upload all existing files.
	"""
	file_doc_name = frappe.db.get_value("File", {"name": name})
	if file_doc_name:
		doc = frappe.get_doc("File", name)
		s3_upload = S3Operations()
		path = doc.file_url
		site_path = frappe.utils.get_site_path()
		parent_doctype = doc.attached_to_doctype
		parent_name = doc.attached_to_name
		if not doc.is_private:
			file_path = site_path + "/public" + path
		else:
			file_path = site_path + path

		# File exists?
		if not os.path.exists(file_path):
			return

		key = s3_upload.upload_files_to_s3_with_key(
			file_path, doc.file_name, doc.is_private, parent_doctype, parent_name
		)

		if doc.is_private:
			method = "frappe_theme.controllers.sva_integrations.cloud_assets.generate_file"
			file_url = f"""/api/method/{method}?key={key}"""
		else:
			file_url = f"{s3_upload.S3_CLIENT.meta.endpoint_url}/{s3_upload.BUCKET}/{key}"

		# Remove file from local.
		os.remove(file_path)

		frappe.db.sql(
			"""UPDATE `tabFile` SET file_url=%s, folder=%s,
            old_parent=%s, content_hash=%s WHERE name=%s""",
			(file_url, "Home/Attachments", "Home/Attachments", key, doc.name),
		)
		frappe.db.commit()


def s3_file_regex_match(file_url):
	"""
	Match the public file regex match.
	"""
	return re.match(
		r"^(https:|/api/method/frappe_theme.controllers.sva_integrations.cloud_assets.generate_file)",
		file_url,
	)


# this is for mograting existing files to s3
@frappe.whitelist()
def migrate_existing_files():
	"""
	Function to migrate the existing files to s3.
	"""

	files_list = frappe.get_all("File", fields=["name", "file_url"])
	for file in files_list:
		if file["file_url"]:
			if not s3_file_regex_match(file["file_url"]):
				upload_existing_files_s3(file["name"])
	return True


# this is on_trash methods of the file
def delete_from_cloud(doc, method):
	"""Delete file from s3"""
	if getattr(doc, "custom_skip_s3_upload", 0):
		frappe.logger().info(f"Skipping S3 remove for {doc.name} due to skip_s3_upload flag.")
		return
	s3 = S3Operations()
	s3.delete_from_s3(doc.content_hash)
