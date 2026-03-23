# Copyright (c) 2024, Suvaidyam and contributors
# For license information, please see license.txt

import re

import frappe
import requests
from frappe.model.document import Document

from frappe_theme.dt_api import get_number_card_count


class MyTheme(Document):
	def before_save(self):
		if self.login_page_title is not None:
			extra_spaces = re.search(r"^\s+", self.login_page_title)
			if extra_spaces:
				self.login_page_title = ""
			else:
				pass

	@frappe.whitelist()
	def eval_number_card(self, numbercard, doctype, docname):
		details = None
		if frappe.db.exists("Number Card", numbercard):
			details = frappe.get_doc("Number Card", numbercard).as_dict()

		if not details:
			return 0
		report = None
		if details.get("type") == "Report":
			report = frappe.get_doc("Report", details.get("report_name"))
		res = get_number_card_count(details.get("type"), details, report, doctype, docname)
		if res.get("count"):
			return res.get("count")
		else:
			return 0

	@frappe.whitelist()
	def get_sva_workflow_action(self, doc, next_state=None, action=None):
		if not doc.doctype or not doc.name:
			return False

		result = frappe.db.sql(
			"""
			SELECT workflow_action, workflow_state_current
			FROM `tabSVA Workflow Action`
			WHERE reference_doctype = %s
			AND reference_name = %s
			ORDER BY creation DESC
			LIMIT 1
		""",
			(doc.doctype, doc.name),
			as_dict=True,
		)

		if result:
			workflow_action = result[0].get("workflow_action")
			workflow_state_current = result[0].get("workflow_state_current")
			if workflow_state_current == next_state and workflow_action == action:
				return True
			else:
				return False
		else:
			return False

	def get_request_post(self, url, data=None, headers=None, json=None, params=None, timeout=None):
		return requests.post(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_get(self, url, headers=None, params=None, timeout=None):
		return requests.get(url, headers=headers, params=params, timeout=timeout)

	def get_request_put(self, url, data, headers=None, json=None, params=None, timeout=None):
		return requests.put(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_delete(self, url, headers=None, params=None, timeout=None):
		return requests.delete(url, headers=headers, params=params, timeout=timeout)

	def get_request_patch(self, url, data, headers=None, json=None, params=None, timeout=None):
		return requests.patch(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_head(self, url, headers=None, params=None, timeout=None):
		return requests.head(url, headers=headers, params=params, timeout=timeout)
