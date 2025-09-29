import boto3
import frappe
from frappe.tests import IntegrationTestCase

from frappe_theme.controllers.sva_integrations.cloud_assets.s3_bucket import S3Operations


class TestS3Operations(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		self.cloud_assets_doc = frappe.get_doc("Cloud Assets", "Cloud Assets").as_dict()

	def test_enabled_cloud_assets(self):
		"""
		This test checks if the Cloud Assets integration is enabled.
		"""
		self.assertTrue(self.cloud_assets_doc.enable)

	def test_s3_connection(self):
		"""
		This test checks if the S3 connection can be established.
		"""
		if self.cloud_assets_doc.enable:
			if self.cloud_assets_doc.provider == "AWS":
				# client = S3Operations()
				try:
					pass
					# client.S3_CLIENT.list_buckets()
					# connection_successful = True
				except Exception as e:
					connection_successful = False
					print(f"Connection failed: {e}")
				self.assertTrue(connection_successful, "Failed to connect to AWS S3.")
			else:
				print("Skipping test case of AWS S3 because provider is not AWS.")
				self.skipTest("Skipping test case of AWS S3 because provider is not AWS.")
		else:
			print("Cloud Assets integration is disabled")
			self.skipTest("Cloud Assets integration is disabled.")
