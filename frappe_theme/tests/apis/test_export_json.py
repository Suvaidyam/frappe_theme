import json
import unittest
from unittest.mock import Mock, patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_theme.apis.export_json import (
	export_excel,
	export_json,
	get_connection_filters,
	get_fields_meta,
	get_visible_fields,
	process_child_table_row,
	process_json_fields,
)


class TestExportJSONAPI(IntegrationTestCase):
	"""
	Integration tests for Export JSON/Excel API.
	"""

	def setUp(self):
		self.doctype = "User"
		self.hide_field()
		self.meta = frappe.get_meta(self.doctype)

	def test_get_visible_fields(self):
		"""Test get_visible_fields function that will return all visible fields from a DocType meta object"""
		pass

	# def test_hidden_section_field(self):
	#     pass

	def tearDown(self):
		return super().tearDown()

	def hide_field(self):
		"""Helper function that will hide fields in the DocType meta object using property setter"""
		doc = frappe.new_doc("Property Setter")
		doc.update(
			{
				"doc_type": self.doctype,
				"doctype_or_field": "DocField",
				"field_name": "status",
				"property": "hidden",
				"value": 1,
			}
		)
		doc.insert(ignore_permissions=True)
