"""
Unit tests for global_sanitizer.sanitize_all_fields.

Covers the caching fix: the "My Theme" enabled/disabled flag must be read via
frappe.get_cached_doc() (Redis-backed, invalidated on save) instead of a
fresh frappe.db.get_single_value() query on every single document validate().

To run in Frappe:
    bench run-tests --module frappe_theme.utils.test_global_sanitizer

Or standalone (frappe is mocked, no bench/site required):
    python -m unittest test_global_sanitizer -v
"""

import importlib.util
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODULE_PATH = os.path.join(THIS_DIR, "global_sanitizer.py")


class ValidationError(Exception):
	pass


def _make_mock_frappe(site_conf=None, theme_flag=False, meta_fields=None):
	"""Build a mock `frappe` module.

	theme_flag simulates the value stored on the "My Theme" singleton — this
	is what frappe.get_cached_doc("My Theme").get("sanitize_all_fields")
	should return. frappe.db.get_single_value is left as a bare MagicMock so
	tests can assert it was never called (the whole point of the fix).
	"""
	frappe = MagicMock()
	frappe.utils = None  # forces fallback to the deterministic html.escape path
	frappe._ = lambda s: s
	frappe.ValidationError = ValidationError

	def _throw(msg, exc=Exception, **kwargs):
		raise exc(msg)

	frappe.throw = _throw
	frappe.get_conf.return_value = site_conf or {}

	theme_doc = MagicMock()
	theme_doc.get = lambda key, default=None: (
		theme_flag if key == "sanitize_all_fields" else default
	)
	frappe.get_cached_doc.return_value = theme_doc

	meta = MagicMock()
	meta.fields = meta_fields or []
	frappe.get_meta.return_value = meta

	frappe.log_error = MagicMock()
	return frappe


def _load_module(mock_frappe):
	"""Load global_sanitizer.py directly by file path with `frappe` mocked in
	sys.modules — bypasses frappe_theme/utils/__init__.py (and its real,
	unrelated dependency chain) entirely, so this runs without a Frappe bench.
	"""
	spec = importlib.util.spec_from_file_location("global_sanitizer_under_test", MODULE_PATH)
	module = importlib.util.module_from_spec(spec)
	with patch.dict(sys.modules, {"frappe": mock_frappe}):
		spec.loader.exec_module(module)
	return module


def _field(fieldname, fieldtype, label=None):
	return SimpleNamespace(fieldname=fieldname, fieldtype=fieldtype, label=label)


class TestCachingRegression(unittest.TestCase):
	"""The actual bug this fix addresses: no direct DB query on every call."""

	def test_uses_get_cached_doc_not_db_get_single_value(self):
		mock_frappe = _make_mock_frappe(theme_flag=False)
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(doctype="Some Doctype")
		module.sanitize_all_fields(doc)

		mock_frappe.get_cached_doc.assert_called_once_with("My Theme")
		mock_frappe.db.get_single_value.assert_not_called()

	def test_get_cached_doc_called_even_when_site_flag_already_enables_it(self):
		# Regression guard: even if the site-config flag alone would enable
		# sanitization, the function must still resolve theme_flag the same
		# (cached) way rather than reintroducing a raw DB read anywhere.
		mock_frappe = _make_mock_frappe(site_conf={"sanitize_all_fields": True}, theme_flag=False)
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(doctype="Some Doctype", get=lambda f: None)
		module.sanitize_all_fields(doc)

		mock_frappe.db.get_single_value.assert_not_called()

	def test_exception_reading_theme_falls_back_safely(self):
		# get_cached_doc raising must not propagate — matches the original
		# try/except-and-log behavior around the single-value read.
		mock_frappe = _make_mock_frappe()
		mock_frappe.get_cached_doc.side_effect = Exception("cache backend unavailable")
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(doctype="Some Doctype")
		module.sanitize_all_fields(doc)  # must not raise

		mock_frappe.log_error.assert_called_once()


class TestSanitizeBehavior(unittest.TestCase):
	"""Functional behavior must be unchanged by the caching fix."""

	def test_email_queue_is_always_skipped(self):
		mock_frappe = _make_mock_frappe(theme_flag=True)
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(doctype="Email Queue")
		module.sanitize_all_fields(doc)

		mock_frappe.get_cached_doc.assert_not_called()

	def test_disabled_does_nothing(self):
		mock_frappe = _make_mock_frappe(site_conf={}, theme_flag=False)
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(
			doctype="Some Doctype",
			get=lambda f: "<script>alert(1)</script>",
		)
		module.sanitize_all_fields(doc)  # must not raise even with HTML present

	def test_enabled_raises_on_html_in_plain_field(self):
		mock_frappe = _make_mock_frappe(theme_flag=True)
		module = _load_module(
			_patch_meta(mock_frappe, [_field("title", "Data", "Title")])
		)

		doc = SimpleNamespace(
			doctype="Some Doctype",
			get=lambda f: "<b>bold</b>" if f == "title" else None,
		)

		with self.assertRaises(ValidationError):
			module.sanitize_all_fields(doc)

	def test_enabled_allows_clean_value(self):
		mock_frappe = _make_mock_frappe(theme_flag=True)
		mock_frappe = _patch_meta(mock_frappe, [_field("title", "Data", "Title")])
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(
			doctype="Some Doctype",
			get=lambda f: "Plain text" if f == "title" else None,
		)
		module.sanitize_all_fields(doc)  # must not raise

	def test_excluded_fieldtypes_are_never_checked(self):
		mock_frappe = _make_mock_frappe(theme_flag=True)
		mock_frappe = _patch_meta(
			mock_frappe,
			[_field("body", "Text Editor", "Body"), _field("attachment", "Attach", "File")],
		)
		module = _load_module(mock_frappe)

		doc = SimpleNamespace(
			doctype="Some Doctype",
			get=lambda f: "<script>alert(1)</script>",
		)
		module.sanitize_all_fields(doc)  # excluded fieldtypes -> must not raise


def _patch_meta(mock_frappe, fields):
	meta = MagicMock()
	meta.fields = fields
	mock_frappe.get_meta.return_value = meta
	return mock_frappe


if __name__ == "__main__":
	unittest.main(verbosity=2)
