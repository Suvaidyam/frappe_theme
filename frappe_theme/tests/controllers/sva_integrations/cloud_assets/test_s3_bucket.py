import tempfile

import frappe
from botocore.exceptions import ClientError
from frappe.tests import IntegrationTestCase

from frappe_theme.controllers.sva_integrations.cloud_assets.s3_bucket import S3Operations


class TestS3Operations(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		self.cloud_assets_doc = frappe.get_doc("Cloud Assets", "Cloud Assets")
		self.s3_ops = S3Operations()

	# -------------------------------
	# Positive Test Cases
	# -------------------------------
	def test_strip_special_chars(self):
		"""
		Positive: File names should be sanitized correctly.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			file_name = "my@file#name$.txt"
			cleaned = self.s3_ops.strip_special_chars(file_name)
			self.assertEqual(cleaned, "myfilename.txt")
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_strip_special_chars: {reason}")
			self.skipTest(reason)

	def test_key_generator(self):
		"""
		Positive: Key generator should return a valid S3 key.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			key = self.s3_ops.key_generator("test.png", "TestDoc", "TEST-0001")
			self.assertIn("TestDoc", key)
			self.assertTrue(key.endswith("test.png"))
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_key_generator: {reason}")
			self.skipTest(reason)

	def test_upload_and_read_file(self):
		"""
		Positive: Upload a file and read it back.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			with tempfile.NamedTemporaryFile(delete=False) as temp_file:
				temp_file.write(b"Hello S3")
				temp_file.flush()
				key = self.s3_ops.upload_files_with_key(
					file_path=temp_file.name,
					file_name="hello.txt",
					is_private=True,
					parent_doctype="TestDoc",
					parent_name="TEST-0002",
				)

			obj = self.s3_ops.read_file_from_s3(key)
			data = obj["Body"].read().decode()
			self.assertEqual(data, "Hello S3")

			# Cleanup
			self.s3_ops.delete_file(key)
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_upload_and_read_file: {reason}")
			self.skipTest(reason)

	# -------------------------------
	# Negative Test Cases
	# -------------------------------
	def test_delete_invalid_key(self):
		"""
		Negative: Deleting non-existent key should not raise error (AWS behavior).
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			try:
				self.s3_ops.delete_file("invalid/key.txt")
			except Exception as e:
				self.fail(f"Delete should not raise an exception, but got: {e}")
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_delete_invalid_key: {reason}")
			self.skipTest(reason)

	def test_read_invalid_key(self):
		"""
		Negative: Reading non-existent key should raise error.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			with self.assertRaises(ClientError):
				self.s3_ops.read_file_from_s3("invalid/key.txt")
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_read_invalid_key: {reason}")
			self.skipTest(reason)

	def test_upload_invalid_file(self):
		"""
		Negative: Uploading non-existent file should raise error.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "AWS":
			with self.assertRaises(FileNotFoundError):
				self.s3_ops.upload_files_with_key(
					file_path="invalid/path.txt",
					file_name="fake.txt",
					is_private=True,
					parent_doctype="TestDoc",
					parent_name="TEST-0003",
				)
		else:
			reason = "Cloud Assets integration is disabled or provider is not AWS."
			print(f"Skipping test_upload_invalid_file: {reason}")
			self.skipTest(reason)
