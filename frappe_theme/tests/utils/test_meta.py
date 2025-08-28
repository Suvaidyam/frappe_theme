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