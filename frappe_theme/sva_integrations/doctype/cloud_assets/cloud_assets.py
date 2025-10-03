# Copyright (c) 2025, Suvaidyam and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class CloudAssets(Document):
	def validate(self):
		if self.env_manager:
			self.access_key = ""
			self.secret_key = ""
