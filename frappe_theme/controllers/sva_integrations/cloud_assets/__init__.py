import os
import re

import frappe

from frappe_theme.controllers.sva_integrations.cloud_assets.azure_blob import AzureBlobOperations
from frappe_theme.controllers.sva_integrations.cloud_assets.s3_bucket import S3Operations


def get_storage_client():
	"""
	Returns the correct storage client (AWS or Azure Blob)
	based on the Cloud Assets configuration.
	"""
	cloud_assets = frappe.get_cached_doc("Cloud Assets", "Cloud Assets").as_dict()

	if not cloud_assets.enable:
		return None, cloud_assets

	if cloud_assets.provider == "AWS":
		return S3Operations(), cloud_assets
	elif cloud_assets.provider == "Azure":
		return AzureBlobOperations(), cloud_assets
	else:
		return None, cloud_assets


def get_cloud_upload_exclusions(exclusion_list: str | dict) -> list:
	"""Function to get the cloud upload exclusions list."""
	if not exclusion_list:
		return []

	if isinstance(exclusion_list, str):
		import json

		exclusion_list = json.loads(exclusion_list)

	return [d.get("include_doctype") for d in exclusion_list if d.get("include_doctype")]


def file_upload_to_cloud(doc, method):
	"""
	Upload files to the configured cloud provider (S3 / Azure).
	"""
	storage, cloud_assets = get_storage_client()
	if not storage:
		return

	path = doc.file_url
	site_path = frappe.utils.get_site_path()
	parent_doctype = doc.attached_to_doctype or "File"
	parent_name = doc.attached_to_name

	if parent_doctype not in get_cloud_upload_exclusions(cloud_assets.cloud_asset_exclusion):
		if not doc.is_private:
			file_path = site_path + "/public" + path
		else:
			file_path = site_path + path

		# Upload
		key = storage.upload_files_with_key(
			file_path, doc.file_name, doc.is_private, parent_doctype, parent_name
		)

		# Generate file URL
		if doc.is_private:
			method = "frappe_theme.controllers.sva_integrations.cloud_assets.generate_file"
			file_url = f"""/api/method/{method}?key={key}&file_name={doc.file_name}"""
		else:
			file_url = storage.get_url(key)

		# Remove local file
		os.remove(file_path)

		# Update File doc
		frappe.db.sql(
			"""UPDATE `tabFile` SET file_url=%s, folder=%s,
			old_parent=%s, content_hash=%s WHERE name=%s""",
			(file_url, "Home/Attachments", "Home/Attachments", key, doc.name),
		)

		doc.file_url = file_url

		# If parent doc has image field, update it
		if parent_doctype and frappe.get_meta(parent_doctype).get("image_field"):
			frappe.db.set_value(
				parent_doctype, parent_name, frappe.get_meta(parent_doctype).get("image_field"), file_url
			)

		frappe.db.commit()


@frappe.whitelist()
def generate_file(key=None, file_name=None):
	"""
	Function to stream file from cloud (S3 / Azure).
	"""
	if key:
		storage, _ = get_storage_client()
		signed_url = storage.get_url(key, file_name)
		frappe.local.response["type"] = "redirect"
		frappe.local.response["location"] = signed_url
	else:
		frappe.local.response["body"] = "Key not found."
	return


def upload_existing_files_cloud(name):
	"""
	Upload all existing files to the configured cloud.
	"""
	doc = frappe.get_doc("File", name)
	storage, _ = get_storage_client()

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

	key = storage.upload_files_with_key(file_path, doc.file_name, doc.is_private, parent_doctype, parent_name)

	if doc.is_private:
		method = "frappe_theme.controllers.sva_integrations.cloud_assets.generate_file"
		file_url = f"""/api/method/{method}?key={key}"""
	else:
		file_url = storage.get_public_url(key)

	# Remove local file
	os.remove(file_path)

	frappe.db.sql(
		"""UPDATE `tabFile` SET file_url=%s, folder=%s,
		old_parent=%s, content_hash=%s WHERE name=%s""",
		(file_url, "Home/Attachments", "Home/Attachments", key, doc.name),
	)
	frappe.db.commit()


def s3_file_regex_match(file_url):
	"""Match cloud file regex (for migration checks)."""
	return re.match(
		r"^(https:|/api/method/frappe_theme.controllers.sva_integrations.cloud_assets.generate_file)",
		file_url,
	)


@frappe.whitelist()
def migrate_existing_files():
	"""
	Migrate existing files to the configured cloud.
	"""
	files_list = frappe.get_all("File", fields=["name", "file_url"])
	for file in files_list:
		if file["file_url"]:
			if not s3_file_regex_match(file["file_url"]):
				upload_existing_files_cloud(file["name"])
	return True


def delete_from_cloud(doc, method):
	"""Delete file from cloud."""
	if getattr(doc, "custom_skip_s3_upload", 0):
		frappe.logger().info(f"Skipping cloud remove for {doc.name} due to skip_s3_upload flag.")
		return

	storage, _ = get_storage_client()
	storage.delete_file(doc.content_hash)
