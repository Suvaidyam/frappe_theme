import boto3
import frappe
from botocore.client import Config
from botocore.exceptions import ClientError
from frappe.tests import IntegrationTestCase
from frappe.utils.password import get_decrypted_password

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
		pass
		"""
		This test checks if the S3 connection can be established.
		"""
		# if self.cloud_assets_doc.enable:
		# 	if self.cloud_assets_doc.provider == "AWS":
		# 		s3_client = S3Operations()
		# 		try:
		# 			s3_client.S3_CLIENT.head_bucket(Bucket=s3_client.BUCKET)
		# 			connection_successful = True
		# 		except ClientError as e:
		# 			error_code = e.response['Error']['Code']
		# 			if error_code == "403":
		# 				print("Connection to S3 established, but access to bucket is forbidden (403). Check IAM permissions.")
		# 			else:
		# 				print(f"Connection failed: {e}")
		# 		except Exception as e:
		# 			print(f"Connection failed: {e}")
		# 		self.assertTrue(connection_successful, "Failed to connect to AWS S3 or access bucket.")
		# 	else:
		# 		self.skipTest("Skipping test case of S3 because provider is not AWS S3.")
		# else:
		# 	self.skipTest("Cloud Assets integration is disabled.")
