import datetime
import random
import re
import string

import frappe
from azure.storage.blob import BlobServiceClient, ContentSettings
from frappe.utils.password import get_decrypted_password


class AzureBlobOperations:
	def __init__(self):
		"""
		Initialize Azure settings from frappe Cloud Assets doctype.
		"""
		self.azure_settings_doc = frappe.get_cached_doc("Cloud Assets", "Cloud Assets")

		# Parse path
		parts = self.azure_settings_doc.path.split("/")
		if len(parts) < 2:
			frappe.throw("Cloud Assets path must be in format 'account.blob.core.windows.net/container_name'")

		endpoint = parts[0]
		self.CONTAINER = parts[1]
		self.folder_name = ""  # optional, can be set manually

		# Extract account_name from endpoint
		self.account_name = endpoint.split(".")[0]
		self.azure_settings_doc.account_name = self.account_name
		# Build client
		if self.azure_settings_doc.env_manager:
			import os

			# access_key = os.getenv("access_key")  # in the case of azure, access_key is not required
			secret_key = os.getenv("secret_key")
		else:
			secret_key = get_decrypted_password("Cloud Assets", "Cloud Assets", "secret_key")
		if not secret_key:
			frappe.throw("Azure Storage account key is missing in Cloud Assets")

		conn_str = (
			f"DefaultEndpointsProtocol=https;"
			f"AccountName={self.account_name};"
			f"AccountKey={secret_key};"
			f"EndpointSuffix=core.windows.net"
		)

		self.BLOB_CLIENT = BlobServiceClient.from_connection_string(conn_str)

	def strip_special_chars(self, file_name):
		"""Strips invalid characters"""
		regex = re.compile("[^0-9a-zA-Z._-]")
		return regex.sub("", file_name)

	def key_generator(self, file_name, parent_doctype, parent_name):
		"""Generate blob path (key)"""
		file_name = file_name.replace(" ", "_")
		file_name = self.strip_special_chars(file_name)
		key = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(8))

		today = datetime.datetime.now()
		year, month, day = today.strftime("%Y"), today.strftime("%m"), today.strftime("%d")

		if self.folder_name:
			final_key = f"{self.folder_name}/{year}/{month}/{day}/{parent_doctype}/{key}_{file_name}"
		else:
			final_key = f"{year}/{month}/{day}/{parent_doctype}/{key}_{file_name}"

		return final_key

	def upload_files_with_key(self, file_path, file_name, is_private, parent_doctype, parent_name):
		"""Upload file to Azure Blob Storage"""
		key = self.key_generator(file_name, parent_doctype, parent_name)

		blob_client = self.BLOB_CLIENT.get_blob_client(container=self.CONTAINER, blob=key)

		# Guess content type
		import mimetypes

		content_type, _ = mimetypes.guess_type(file_path)
		if not content_type:
			content_type = "application/octet-stream"

		with open(file_path, "rb") as data:
			blob_client.upload_blob(
				data, overwrite=True, content_settings=ContentSettings(content_type=content_type)
			)

		# In Azure, "public vs private" is handled at container-level access policies
		return key

	def delete_file(self, key):
		"""Delete blob from Azure"""
		if self.azure_settings_doc.enable and key:
			blob_client = self.BLOB_CLIENT.get_blob_client(container=self.CONTAINER, blob=key)
			blob_client.delete_blob()

	def read_blob(self, key):
		"""Read blob content"""
		blob_client = self.BLOB_CLIENT.get_blob_client(container=self.CONTAINER, blob=key)
		downloader = blob_client.download_blob()
		return downloader.readall()

	def get_url(self, key, file_name=None):
		"""Generate SAS URL for blob"""
		from datetime import datetime, timedelta

		from azure.storage.blob import BlobSasPermissions, generate_blob_sas

		expiry_time = self.azure_settings_doc.signed_url_expiry_time or 120

		sas_token = generate_blob_sas(
			account_name=self.azure_settings_doc.account_name,
			container_name=self.CONTAINER,
			blob_name=key,
			account_key=get_decrypted_password("Cloud Assets", "Cloud Assets", "secret_key"),
			permission=BlobSasPermissions(read=True),
			expiry=datetime.utcnow() + timedelta(seconds=expiry_time),
		)

		url = f"https://{self.azure_settings_doc.account_name}.blob.core.windows.net/{self.CONTAINER}/{key}?{sas_token}"
		return url

	def get_public_url(self, key):
		"""Return direct public URL for blob (container must have public access)."""
		return f"https://{self.account_name}.blob.core.windows.net/{self.CONTAINER}/{key}"
