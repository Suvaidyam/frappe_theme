# Copyright (c) 2024, Suvaidyam and contributors
# For license information, please see license.txt

# import frappe
import re

from frappe.model.document import Document


class MyTheme(Document):
	def before_save(self):
		if self.login_page_title is not None:
			extra_spaces = re.search(r"^\s+", self.login_page_title)
			if extra_spaces:
				self.login_page_title = ""
			else:
				pass
