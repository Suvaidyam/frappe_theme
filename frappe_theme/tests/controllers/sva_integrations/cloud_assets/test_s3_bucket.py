import frappe
from frappe.tests import IntegrationTestCase


class TestS3Operations(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		self.cloud_assets_doc = frappe.get_doc("Cloud Assets", "Cloud Assets").as_dict()

	def test_enabled_cloud_assets(self):
		self.assertTrue(self.cloud_assets_doc.enable)

	def test_s3_connection(self):
		# self.s3_operations = S3Operations()
		# self.assertIsNotNone(self.s3_operations.S3_CLIENT)
		pass
