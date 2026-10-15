"""
Unit tests for data_protection.py's caching fix.

Covers: mask_query_report and mask_query_report_export_query must fetch the
Report document via frappe.get_cached_doc() (Redis-backed, invalidated on
save) instead of a fresh frappe.get_doc() on every single report run/export.

To run in Frappe:
    bench run-tests --module frappe_theme.utils.test_data_protection

Or standalone (frappe/cryptography deps are the only real ones needed;
this repo's own package __init__ chain is bypassed):
    python -m unittest test_data_protection -v
"""

import importlib.util
import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from cryptography.fernet import Fernet

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODULE_PATH = os.path.join(THIS_DIR, "data_protection.py")


class _dict(dict):
	"""Mirrors frappe._dict: a plain dict with attribute-style access."""

	__getattr__ = dict.get
	__setattr__ = dict.__setitem__


def _field(fieldname, data_protection=None):
	return SimpleNamespace(fieldname=fieldname, data_protection=data_protection)


def _make_mock_frappe(encryption_key):
	frappe = MagicMock()
	# @frappe.whitelist() must be an identity decorator here — otherwise every
	# decorated function in data_protection.py (nearly all of them) gets
	# replaced by a MagicMock instead of the real implementation under test.
	frappe.whitelist = lambda *a, **kw: (lambda fn: fn)
	frappe._dict = _dict
	frappe._ = lambda s: s
	frappe.session = SimpleNamespace(user="tester@example.com")
	frappe.get_roles.return_value = ["Some Role"]
	frappe.conf = MagicMock()
	frappe.conf.get = lambda k: encryption_key if k == "encryption_key" else None
	frappe.log_error = MagicMock()

	# frappe.desk.query_report / reportview submodules, for
	# `from frappe.desk import query_report, reportview` at module top.
	frappe.desk = MagicMock()
	frappe.desk.query_report = MagicMock()
	frappe.desk.reportview = MagicMock()

	sys.modules["frappe.desk"] = frappe.desk
	sys.modules["frappe.desk.query_report"] = frappe.desk.query_report
	sys.modules["frappe.desk.reportview"] = frappe.desk.reportview

	return frappe


def _load_module(mock_frappe):
	spec = importlib.util.spec_from_file_location("data_protection_under_test", MODULE_PATH)
	module = importlib.util.module_from_spec(spec)
	with patch.dict(sys.modules, {"frappe": mock_frappe}):
		spec.loader.exec_module(module)
	return module


class TestMaskQueryReportCachingRegression(unittest.TestCase):
	"""The actual bug: no fresh frappe.get_doc() fetch on every report run."""

	def setUp(self):
		self.key = Fernet.generate_key().decode()
		self.mock_frappe = _make_mock_frappe(self.key)
		self.module = _load_module(self.mock_frappe)

		report_doc = SimpleNamespace(ref_doctype="Some Doctype")
		self.mock_frappe.get_cached_doc.return_value = report_doc

		meta = MagicMock()
		meta.get_field = lambda fieldname: {
			"secret": _field("secret", {"encrypt": True}),
			"public": _field("public", None),
		}.get(fieldname)
		self.mock_frappe.get_meta.return_value = meta

	def test_uses_get_cached_doc_not_get_doc(self):
		self.mock_frappe.desk.query_report.run.return_value = {
			"result": [],
			"columns": [{"fieldname": "public"}],
		}

		self.module.mask_query_report("My Report")

		self.mock_frappe.get_cached_doc.assert_called_once_with("Report", "My Report")
		self.mock_frappe.get_doc.assert_not_called()

	def test_decrypts_encrypted_field_in_result(self):
		encrypted = self.module.encrypt_value("plain-secret")
		self.assertTrue(self.module.is_encrypted(encrypted))

		self.mock_frappe.desk.query_report.run.return_value = {
			"result": [{"secret": encrypted, "public": "hello"}],
			"columns": [{"fieldname": "secret"}, {"fieldname": "public"}],
		}

		result = self.module.mask_query_report("My Report")

		self.assertEqual(result["result"][0]["secret"], "plain-secret")
		self.assertEqual(result["result"][0]["public"], "hello")

	def test_no_report_name_short_circuits_without_lookup(self):
		self.mock_frappe.desk.query_report.run.return_value = {"result": [], "columns": []}

		self.module.mask_query_report(report_name=None)

		self.mock_frappe.get_cached_doc.assert_not_called()

	def test_lookup_failure_is_caught_and_logged(self):
		self.mock_frappe.get_cached_doc.side_effect = Exception("cache miss / DB down")
		self.mock_frappe.desk.query_report.run.return_value = {
			"result": [{"public": "hello"}],
			"columns": [{"fieldname": "public"}],
		}

		result = self.module.mask_query_report("My Report")  # must not raise

		self.mock_frappe.log_error.assert_called_once()
		self.assertEqual(result["result"][0]["public"], "hello")


class TestMaskQueryReportExportCachingRegression(unittest.TestCase):
	"""Same fix, applied in the export path (mask_query_report_export_query)."""

	def setUp(self):
		self.key = Fernet.generate_key().decode()
		self.mock_frappe = _make_mock_frappe(self.key)

		# Dynamic imports inside mask_query_report_export_query:
		#   from frappe.desk.query_report import build_xlsx_data, format_fields,
		#       valid_report_name, clean_params, parse_json
		#   from frappe.desk.utils import get_csv_bytes, pop_csv_params, provide_binary_file
		#   from frappe.utils.xlsxutils import handle_html
		qr = self.mock_frappe.desk.query_report
		qr.build_xlsx_data = MagicMock(return_value=([], {}))
		qr.format_fields = MagicMock()
		qr.valid_report_name = MagicMock(return_value=True)
		qr.clean_params = MagicMock()
		qr.parse_json = MagicMock()

		desk_utils = MagicMock()
		desk_utils.get_csv_bytes = MagicMock(return_value=b"csv-bytes")
		desk_utils.pop_csv_params = MagicMock(return_value={})
		desk_utils.provide_binary_file = MagicMock()
		sys.modules["frappe.desk.utils"] = desk_utils

		xlsxutils = MagicMock()
		xlsxutils.handle_html = lambda s: s
		xlsxutils.make_xlsx = MagicMock()
		sys.modules["frappe.utils.xlsxutils"] = xlsxutils

		self.mock_frappe.permissions = MagicMock()
		self.mock_frappe.get_cached_value.return_value = "Some Doctype"
		self.mock_frappe.parse_json = lambda s: json.loads(s) if s else []

		self.module = _load_module(self.mock_frappe)

		report_doc = SimpleNamespace(ref_doctype="Some Doctype")
		self.mock_frappe.get_cached_doc.return_value = report_doc

		meta = MagicMock()
		meta.get_field = lambda fieldname: {
			"secret": _field("secret", {"encrypt": True}),
		}.get(fieldname)
		self.mock_frappe.get_meta.return_value = meta

	def _form_params(self, result_rows, columns):
		self.mock_frappe.local = SimpleNamespace(
			form_dict={
				"report_name": "My Report",
				"file_format_type": "CSV",
				"custom_columns": "[]",
				"include_indentation": False,
				"include_filters": False,
				"visible_idx": [0],
				"include_hidden_columns": False,
				"filters": {},
				"applied_filters": {},
			}
		)
		self.mock_frappe.desk.query_report.run.return_value = {
			"result": result_rows,
			"columns": columns,
		}

	def test_uses_get_cached_doc_not_get_doc(self):
		self._form_params(result_rows=[], columns=[{"fieldname": "secret"}])

		self.module.mask_query_report_export_query()

		self.mock_frappe.get_cached_doc.assert_called_once_with("Report", "My Report")
		self.mock_frappe.get_doc.assert_not_called()

	def test_decrypts_before_export(self):
		encrypted = self.module.encrypt_value("plain-secret")
		row = {"secret": encrypted}
		self._form_params(result_rows=[row], columns=[{"fieldname": "secret"}])

		self.module.mask_query_report_export_query()

		self.assertEqual(row["secret"], "plain-secret")


if __name__ == "__main__":
	unittest.main(verbosity=2)
