# your_app/utils/test_meta_utils.py

import frappe
from frappe.tests import IntegrationTestCase

from frappe_theme.utils.meta import get_meta


class TestMetaUtilsAPI(IntegrationTestCase):
	"""
	Integration tests for get_meta API.
	"""

	def setUp(self):
		self.doctype = "DocType"

	def test_api_get_required_fields(self):
		"""Test API returns required fields"""
		filters = {"reqd": 1}
		fields = get_meta(self.doctype, filters)
		fieldnames = [f.fieldname for f in fields]

		self.assertIn("module", fieldnames)

	def test_api_includes_data_fields(self):
		"""Test API includes Data fields only"""
		filters = {"fieldtype": {"IN": ["Data"]}}
		fields = get_meta(self.doctype, filters)

		self.assertTrue(all(f.fieldtype == "Data" for f in fields))

	def test_api_excludes_breaks(self):
		"""Test API excludes Section Break / Column Break"""
		filters = {"fieldtype": {"NOT IN": ["Section Break", "Column Break"]}}
		fields = get_meta(self.doctype, filters)
		fieldtypes = [f.fieldtype for f in fields]

		self.assertNotIn("Section Break", fieldtypes)
		self.assertNotIn("Column Break", fieldtypes)

	def test_api_multiple_filters(self):
		"""Test API with multiple filters"""
		filters = {"fieldtype": {"IN": ["Data"]}, "reqd": 1}
		fields = get_meta(self.doctype, filters)

		for f in fields:
			self.assertEqual(f.fieldtype, "Data")
			self.assertEqual(f.reqd, 1)

	def test_get_meta_with_cache(self):
		"""Test get_meta API with cached=True"""
		filters = {"reqd": 1}

		fields_first = get_meta(self.doctype, filters, cached=True)
		self.assertGreater(len(fields_first), 0)

		fields_cached = get_meta(self.doctype, filters, cached=True)
		self.assertEqual(
			[f.fieldname for f in fields_first],
			[f.fieldname for f in fields_cached],
		)
		print("Passed: Cached and fresh calls return identical fields")

	def test_get_meta_without_cache(self):
		"""Test get_meta API with cached=False (force DB fetch)"""
		filters = {"reqd": 1}

		fields_db = get_meta(self.doctype, filters, cached=False)
		self.assertGreater(len(fields_db), 0)

		fields_cached = get_meta(self.doctype, filters, cached=True)
		self.assertEqual(
			[f.fieldname for f in fields_db],
			[f.fieldname for f in fields_cached],
		)
		print("Passed: Cached and non-cached calls return consistent results")

	def test_get_meta_with_keys_list(self):
		"""Test get_meta API with keys parameter as list"""
		filters = {"fieldtype": {"IN": ["Data"]}}
		keys = ["fieldname", "fieldtype", "label"]

		fields = get_meta(self.doctype, filters, keys=keys)

		self.assertIsInstance(fields[0], dict)

		for field in fields:
			self.assertEqual(set(field.keys()), set(keys))
			self.assertIn("fieldname", field)
			self.assertIn("fieldtype", field)
			self.assertIn("label", field)
			self.assertEqual(field["fieldtype"], "Data")

		print(f"Passed: Keys list returns {len(fields)} fields with specified keys only")

	def test_get_meta_with_keys_dict(self):
		"""Test get_meta API with keys parameter as dict for renaming"""
		filters = {"fieldtype": {"IN": ["Data"]}}
		keys = {"fieldname": "name", "fieldtype": "type", "label": "display_label"}

		fields = get_meta(self.doctype, filters, keys=keys)

		self.assertIsInstance(fields[0], dict)

		for field in fields:
			self.assertEqual(set(field.keys()), set(keys.values()))
			self.assertIn("name", field)
			self.assertIn("type", field)
			self.assertIn("display_label", field)
			self.assertEqual(field["type"], "Data")

		print(f"Passed: Keys dict returns {len(fields)} fields with renamed keys")

	def test_get_meta_without_keys_returns_docfield_objects(self):
		"""Test get_meta API without keys parameter returns DocField objects"""
		filters = {"fieldtype": {"IN": ["Data"]}}

		fields = get_meta(self.doctype, filters)

		self.assertFalse(isinstance(fields[0], dict))
		self.assertTrue(hasattr(fields[0], "fieldname"))
		self.assertTrue(hasattr(fields[0], "fieldtype"))

		print(f"Passed: Without keys parameter returns {len(fields)} DocField objects")

	def test_get_meta_keys_with_filters_combination(self):
		"""Test get_meta API with both filters and keys parameters"""
		filters = {"reqd": 1, "fieldtype": {"NOT IN": ["Section Break", "Column Break"]}}
		keys = ["fieldname", "fieldtype", "reqd"]

		fields = get_meta(self.doctype, filters, keys=keys)

		for field in fields:
			self.assertEqual(field["reqd"], 1)
			self.assertNotIn(field["fieldtype"], ["Section Break", "Column Break"])

		for field in fields:
			self.assertEqual(set(field.keys()), set(keys))

		print(f"Passed: Filters + keys combination returns {len(fields)} filtered fields with selected keys")

	def test_get_meta_keys_with_nonexistent_key(self):
		"""Test get_meta API with keys parameter including non-existent field"""
		filters = {"fieldtype": {"IN": ["Data"]}}
		keys = ["fieldname", "fieldtype", "nonexistent_key"]

		fields = get_meta(self.doctype, filters, keys=keys)

		for field in fields:
			self.assertIn("nonexistent_key", field)
			self.assertIsNone(field["nonexistent_key"])

		print("Passed: Non-existent keys return None values")

	def test_get_meta_empty_keys_list(self):
		"""Test get_meta API with empty keys list"""
		filters = {"fieldtype": {"IN": ["Data"]}}
		keys = []

		fields = get_meta(self.doctype, filters, keys=keys)
		for field in fields:
			self.assertEqual(len(field), 0)
			self.assertIsInstance(field, dict)

		print(f"Passed: Empty keys list returns {len(fields)} empty dictionaries")
