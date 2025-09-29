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
		self.assertTrue(self.cloud_assets_doc.enable)

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
				self.skipTest("Skipping test case of Azure Blob because provider is not Azure.")
		else:
			print("Cloud Assets integration is disabled")
			self.skipTest("Cloud Assets integration is disabled.")
