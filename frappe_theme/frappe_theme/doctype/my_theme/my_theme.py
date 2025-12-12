# Copyright (c) 2024, Suvaidyam and contributors
# For license information, please see license.txt

import re

import frappe
from frappe.model.document import Document


class MyTheme(Document):
	def before_save(self):
		if self.login_page_title is not None:
			extra_spaces = re.search(r"^\s+", self.login_page_title)
			if extra_spaces:
				self.login_page_title = ""
			else:
				pass

	@frappe.whitelist()
	def eval_number_card(self, number_card):
		try:
			if not number_card:
				return 0
			number_card_doc = frappe.get_cached_doc("Number Card", number_card)
			result = frappe.call(
				"frappe.desk.doctype.number_card.number_card.get_result",
				doc=number_card_doc,
				filters=number_card_doc.filters_json or [],
			)
			return result

		except Exception:
			frappe.log_error(frappe.get_traceback(), "Number Card Eval Error")
			return 0
