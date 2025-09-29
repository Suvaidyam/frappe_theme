import datetime
import random
import re
import string

import boto3
import frappe
import magic
from botocore.client import Config
from botocore.exceptions import ClientError
from frappe.utils.password import get_decrypted_password


class S3Operations:
	def __init__(self):
		"""
		Function to initialise the aws settings from frappe Cloud Assets
		doctype.
		"""
		self.s3_settings_doc = frappe.get_doc(
			"Cloud Assets",
			"Cloud Assets",
		)
		self.s3_settings_doc.bucket_name = self.s3_settings_doc.path.split("/")[0]
		self.s3_settings_doc.folder_name = self.s3_settings_doc.path.split("/")[1]
		self.s3_settings_doc.signed_url_expiry_time = 300

		if self.s3_settings_doc.access_key and self.s3_settings_doc.secret_key:
			self.S3_CLIENT = boto3.client(
				"s3",
				aws_access_key_id=self.s3_settings_doc.access_key,
				aws_secret_access_key=get_decrypted_password("Cloud Assets", "Cloud Assets", "secret_key"),
				region_name=self.s3_settings_doc.region_name,
				config=Config(signature_version="s3v4"),
			)
		else:
			self.S3_CLIENT = boto3.client(
				"s3", region_name=self.s3_settings_doc.region_name, config=Config(signature_version="s3v4")
			)
		self.BUCKET = self.s3_settings_doc.bucket_name
		self.folder_name = self.s3_settings_doc.folder_name

	def strip_special_chars(self, file_name):
		"""
		Strips file charachters which doesnt match the regex.
		"""
		regex = re.compile("[^0-9a-zA-Z._-]")
		file_name = regex.sub("", file_name)
		return file_name

	def key_generator(self, file_name, parent_doctype, parent_name):
		"""
		Generate keys for s3 objects uploaded with file name attached.
		"""
		hook_cmd = frappe.get_hooks().get("s3_key_generator")
		if hook_cmd:
			try:
				k = frappe.get_attr(hook_cmd[0])(
					file_name=file_name, parent_doctype=parent_doctype, parent_name=parent_name
				)
				if k:
					return k.rstrip("/").lstrip("/")
			except Exception as e:
				frappe.logger().error(f"S3 key generator hook failed: {e}")

		file_name = file_name.replace(" ", "_")
		file_name = self.strip_special_chars(file_name)
		key = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(8))

		today = datetime.datetime.now()
		year = today.strftime("%Y")
		month = today.strftime("%m")
		day = today.strftime("%d")

		doc_path = None

		if not doc_path:
			if self.folder_name:
				final_key = (
					self.folder_name
					+ "/"
					+ year
					+ "/"
					+ month
					+ "/"
					+ day
					+ "/"
					+ parent_doctype
					+ "/"
					+ key
					+ "_"
					+ file_name
				)
			else:
				final_key = (
					year + "/" + month + "/" + day + "/" + parent_doctype + "/" + key + "_" + file_name
				)
			return final_key
		else:
			final_key = doc_path + "/" + key + "_" + file_name
			return final_key

	def upload_files_to_s3_with_key(self, file_path, file_name, is_private, parent_doctype, parent_name):
		"""
		Uploads a new file to S3.
		Strips the file extension to set the content_type in metadata.
		"""
		mime_type = magic.from_file(file_path, mime=True)
		key = self.key_generator(file_name, parent_doctype, parent_name)
		content_type = mime_type
		try:
			if is_private:
				self.S3_CLIENT.upload_file(
					file_path,
					self.BUCKET,
					key,
					ExtraArgs={
						"ContentType": content_type,
						"Metadata": {"ContentType": content_type, "file_name": file_name},
					},
				)
			else:
				self.S3_CLIENT.upload_file(
					file_path,
					self.BUCKET,
					key,
					ExtraArgs={
						"ContentType": content_type,
						"ACL": "public-read",
						"Metadata": {
							"ContentType": content_type,
						},
					},
				)

		except boto3.exceptions.S3UploadFailedError:
			frappe.throw(frappe._("File Upload Failed. Please try again."))
		return key

	def delete_from_s3(self, key):
		"""Delete file from s3"""
		if self.s3_settings_doc.enable and key:
			try:
				self.S3_CLIENT.delete_object(Bucket=self.s3_settings_doc.bucket_name, Key=key)
			except ClientError:
				frappe.throw(frappe._("Access denied: Could not delete file"))

	def read_file_from_s3(self, key):
		"""
		Function to read file from a s3 file.
		"""
		return self.S3_CLIENT.get_object(Bucket=self.BUCKET, Key=key)

	def get_url(self, key, file_name=None):
		"""
		Return url.

		:param bucket: s3 bucket name
		:param key: s3 object key
		"""
		if self.s3_settings_doc.signed_url_expiry_time:
			self.signed_url_expiry_time = self.s3_settings_doc.signed_url_expiry_time  # noqa
		else:
			self.signed_url_expiry_time = 120
		params = {
			"Bucket": self.BUCKET,
			"Key": key,
		}
		if file_name:
			params["ResponseContentDisposition"] = f"filename={file_name}"

		url = self.S3_CLIENT.generate_presigned_url(
			"get_object",
			Params=params,
			ExpiresIn=self.signed_url_expiry_time,
		)

		return url
