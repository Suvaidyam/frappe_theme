# Copyright (c) 2025, Suvaidyam and contributors
# For license information, please see license.txt

from hashlib import md5

import frappe
from frappe.model.document import Document


class SVADTUserListviewSettings(Document):
	def on_update(self):
		setting_id = md5(f"{self.parent_id}-{self.child_dt}-{self.user}".encode()).hexdigest()
		frappe.cache.set_value(setting_id, self.listview_settings)

	def on_trash(self):
		setting_id = md5(f"{self.parent_id}-{self.child_dt}-{self.user}".encode()).hexdigest()
		if frappe.cache.exists(setting_id):
			frappe.cache.delete_value(setting_id)
