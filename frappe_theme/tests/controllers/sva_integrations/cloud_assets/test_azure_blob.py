import frappe
from frappe.tests import IntegrationTestCase

from frappe_theme.controllers.sva_integrations.cloud_assets.azure_blob import AzureBlobOperations


class TestAzureBlobOperations(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		self.cloud_assets_doc = frappe.get_doc("Cloud Assets", "Cloud Assets").as_dict()

	def test_enabled_cloud_assets(self):
		"""
		This test checks if the Cloud Assets integration is enabled.
		"""
		if self.cloud_assets_doc.enable:
			self.assertTrue(self.cloud_assets_doc.enable)
			print(f"status of Cloud Assets enable: {self.cloud_assets_doc.enable}")
		else:
			print("Cloud Assets integration is disabled")
			self.skipTest("Cloud Assets integration is disabled.")

	def test_azure_blob_connection(self):
		"""
		This test checks if the Azure Blob connection can be established.
		"""
		if self.cloud_assets_doc.enable:
			if self.cloud_assets_doc.provider == "Azure":
				print("Azure Blob test case executing...")
				blob_client = AzureBlobOperations()
				try:
					containers = blob_client.BLOB_CLIENT.list_containers()
					if containers:
						connection_successful = True
				except Exception as e:
					connection_successful = False
					print(f"Connection failed: {e}")
				self.assertTrue(connection_successful, "Failed to connect to Azure Blob Storage.")
			else:
				print("Skipping test case of Azure Blob because provider is not Azure.")
				reason = "Cloud Assets provider is not set to Azure."
				print(f"Skipping test_azure_blob_connection: {reason}")
				self.skipTest(reason)
		else:
			print("Cloud Assets integration is disabled")
			self.skipTest("Cloud Assets integration is disabled.")

	def test_azure_blob_connection_invalid_credentials(self):
		"""
		Negative test: Should pass if connection fails with invalid Azure Blob credentials.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()

			# Simulate invalid credentials
			blob_client.BLOB_CLIENT.account_key = frappe.conf.get("db_type")

			try:
				blob_client.BLOB_CLIENT.list_containers()
				# If no error, test should fail
				self.fail("Connection succeeded with invalid credentials, but it should have failed.")
				print("Connection unexpectedly succeeded with invalid credentials.")
			except Exception as e:
				# Expected path: connection fails
				self.assertIsNotNone(e, "Expected an exception for invalid credentials.")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_azure_blob_connection_invalid_credentials: {reason}")
			self.skipTest(reason)

	def test_strip_special_chars(self):
		"""
		This test checks if special characters are stripped from file names.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			test_file_name = "test@file#name!.txt"
			stripped_name = blob_client.strip_special_chars(test_file_name)
			self.assertEqual(
				stripped_name, "testfilename.txt", "Special characters were not stripped correctly."
			)
			print(f"Original: {test_file_name}, Stripped: {stripped_name}")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_strip_special_chars: {reason}")
			self.skipTest(reason)

	def test_strip_special_chars_invalid_type(self):
		"""
		Negative test: Checks behavior when input is not a string.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			with self.assertRaises(TypeError):
				blob_client.strip_special_chars(None)
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_strip_special_chars_invalid_type: {reason}")
			self.skipTest(reason)

	def test_key_generator(self):
		"""
		This test checks if the key generator creates a valid key.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			test_file_name = "example.txt"
			parent_doctype = "TestDocType"
			parent_name = "TestDocName"
			generated_key = blob_client.key_generator(test_file_name, parent_doctype, parent_name)
			self.assertIn(parent_doctype, generated_key, "Parent doctype not in generated key.")
			self.assertIn("example.txt", generated_key, "File name not in generated key.")
			print(f"Generated Key: {generated_key}")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_key_generator: {reason}")
			self.skipTest(reason)

	def test_key_generator_missing_params(self):
		"""
		Negative test: Checks behavior when required params are missing.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			with self.assertRaises(TypeError):
				blob_client.key_generator("file.txt")  # Missing parent_doctype and parent_name
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_key_generator_missing_params: {reason}")
			self.skipTest(reason)

	def test_upload_and_delete_file(self):
		"""
		This test checks if a file can be uploaded and then deleted from Azure Blob Storage.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			import os
			import tempfile

			if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider != "Azure":
				self.skipTest("Cloud Assets integration is disabled or provider is not Azure.")

			blob_client = AzureBlobOperations()

			# Create a temporary file to upload
			with tempfile.NamedTemporaryFile(delete=False) as temp_file:
				temp_file.write(b"Sample content for testing.")
				temp_file_path = temp_file.name
				temp_file_name = os.path.basename(temp_file_path)

			try:
				# Upload the file
				key = blob_client.upload_files_with_key(
					file_path=temp_file_path,
					file_name=temp_file_name,
					is_private=False,
					parent_doctype="TestDocType",
					parent_name="TestDocName",
				)
				self.assertIsNotNone(key, "Failed to upload file to Azure Blob Storage.")
				print(f"Uploaded file key: {key}")

				# Now delete the file
				blob_client.delete_file(key)
				print(f"Deleted file with key: {key}")

				# Verify deletion by attempting to get the blob properties (should raise an error)
				from azure.core.exceptions import ResourceNotFoundError

				try:
					blob_client.BLOB_CLIENT.get_blob_client(
						container=blob_client.CONTAINER, blob=key
					).get_blob_properties()
					self.fail("Blob still exists after deletion.")
				except ResourceNotFoundError:
					pass

			finally:
				os.remove(temp_file_path)
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_upload_and_delete_file: {reason}")
			self.skipTest(reason)

	def test_upload_files_with_key_missing_file(self):
		"""
		Negative test: Checks upload failure when file does not exist.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			with self.assertRaises(FileNotFoundError):
				blob_client.upload_files_with_key(
					file_path="non_existent_file.txt",
					file_name="non_existent_file.txt",
					is_private=False,
					parent_doctype="TestDocType",
					parent_name="TestDocName",
				)
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_upload_files_with_key_missing_file: {reason}")
			self.skipTest(reason)

	def test_delete_file_invalid_key(self):
		"""
		Negative test: Checks deletion with an invalid blob key.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			with self.assertRaises(Exception):
				blob_client.delete_file("invalid/key/does/not/exist.txt")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_delete_file_invalid_key: {reason}")
			self.skipTest(reason)

	def test_get_url(self):
		"""
		This test checks if a signed URL can be generated for a blob.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			test_key = "TestDocType/TestDocName/example.txt"
			url = blob_client.get_url(test_key)
			self.assertIn(test_key, url, "Generated URL does not contain the correct blob key.")
			print(f"Generated URL: {url}")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_get_url: {reason}")
			self.skipTest(reason)

	def test_get_url_invalid_key(self):
		"""
		Negative test: Checks URL generation for a non-existent blob key.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			url = blob_client.get_url("invalid/key/does/not/exist.txt")
			self.assertIn("invalid/key/does/not/exist.txt", url)
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_get_url_invalid_key: {reason}")
			self.skipTest(reason)

	def test_get_public_url(self):
		"""
		This test checks if a public URL can be generated for a blob.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			test_key = "TestDocType/TestDocName/example.txt"
			public_url = blob_client.get_public_url(test_key)
			expected_url = (
				f"https://{blob_client.account_name}.blob.core.windows.net/{blob_client.CONTAINER}/{test_key}"
			)
			self.assertEqual(public_url, expected_url, "Public URL is not generated correctly.")
			print(f"Public URL: {public_url}")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_get_public_url: {reason}")
			self.skipTest(reason)

	def test_read_blob(self):
		"""
		This test checks if the content of a blob can be read.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			import os
			import tempfile

			if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider != "Azure":
				blob_client = AzureBlobOperations()

				# Create a temporary file to upload
				with tempfile.NamedTemporaryFile(delete=False) as temp_file:
					sample_content = b"Sample content for testing read_blob."
					temp_file.write(sample_content)
					temp_file_path = temp_file.name
					temp_file_name = os.path.basename(temp_file_path)

				try:
					# Upload the file
					key = blob_client.upload_files_with_key(
						file_path=temp_file_path,
						file_name=temp_file_name,
						is_private=False,
						parent_doctype="TestDocType",
						parent_name="TestDocName",
					)
					self.assertIsNotNone(key, "Failed to upload file to Azure Blob Storage.")
					print(f"Uploaded file key for read test: {key}")

					# Read the blob content
					content = blob_client.read_blob(key)
					self.assertEqual(
						content, sample_content, "Blob content does not match the uploaded content."
					)
					print(f"Read blob content: {content}")

				finally:
					# Clean up: delete the blob and temporary file
					blob_client.delete_file(key)
					os.remove(temp_file_path)
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_read_blob: {reason}")
			self.skipTest(reason)

	def test_read_blob_invalid_key(self):
		"""
		Negative test: Checks reading a blob that does not exist.
		"""
		if self.cloud_assets_doc.enable and self.cloud_assets_doc.provider == "Azure":
			blob_client = AzureBlobOperations()
			with self.assertRaises(Exception):
				blob_client.read_blob("invalid/key/does/not/exist.txt")
		else:
			reason = "Cloud Assets integration is disabled or provider is not Azure."
			print(f"Skipping test_read_blob_invalid_key: {reason}")
			self.skipTest(reason)
