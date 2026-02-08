"""
Frappe-style unit tests for SQLBuilder.

To run in Frappe:
    bench run-tests --module your_app.tests.test_sql_builder

Or standalone:
    python -m unittest test_sql_builder -v
"""

import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from sql_builder import SQLBuilder

# ====================================================================== #
#  Mock Frappe Module Setup
# ====================================================================== #


def _create_mock_frappe(
	user="test@example.com",
	user_permissions=None,
	doctype_meta=None,
):
	"""
	Create a mock frappe module for testing user permissions.

	Args:
	    user: Current session user
	    user_permissions: dict like {"Company": [{"doc": "My Co"}], ...}
	    doctype_meta: dict like {"Project": [{"fieldtype": "Link", "options": "Company", "fieldname": "company"}]}
	"""
	frappe = MagicMock()
	frappe.session = SimpleNamespace(user=user)

	if user_permissions is None:
		user_permissions = {}
	frappe.permissions.get_user_permissions.return_value = user_permissions

	if doctype_meta is None:
		doctype_meta = {}

	def mock_get_meta(doctype):
		meta = MagicMock()
		fields_data = doctype_meta.get(doctype, [])
		fields = []
		for f in fields_data:
			field = SimpleNamespace(**f)
			fields.append(field)
		meta.fields = fields
		return meta

	frappe.get_meta = mock_get_meta

	return frappe


# ====================================================================== #
#  Test Suite
# ====================================================================== #


class TestSQLBuilderPlaceholders(unittest.TestCase):
	"""Tests for placeholder replacement (no Frappe dependency)."""

	# ---------- Equality ----------

	def test_equality_string(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(name)s", {"name": "Amresh"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh'")

	def test_equality_integer(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age = %(age)s", {"age": 25})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age = 25")

	def test_equality_float(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE amount = %(amount)s", {"amount": 99.95})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount = 99.95")

	def test_equality_bool_true(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE active = %(active)s", {"active": True})
		self.assertEqual(result, "SELECT * FROM tbl WHERE active = 1")

	def test_equality_bool_false(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE active = %(active)s", {"active": False})
		self.assertEqual(result, "SELECT * FROM tbl WHERE active = 0")

	def test_equality_none_becomes_is_null(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(name)s", {"name": None})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name IS NULL")

	def test_equality_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(name)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_equality_none_params(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(name)s", None)
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ---------- Not Equal ----------

	def test_not_equal(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status != %(status)s", {"status": "Cancelled"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status != 'Cancelled'")

	def test_not_equal_angle_brackets(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status <> %(status)s", {"status": "Cancelled"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status <> 'Cancelled'")

	def test_not_equal_none_becomes_is_not_null(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name != %(name)s", {"name": None})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name IS NOT NULL")

	def test_not_equal_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status != %(status)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ---------- Comparison Operators ----------

	def test_greater_than(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age > %(age)s", {"age": 18})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age > 18")

	def test_less_than(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age < %(age)s", {"age": 65})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age < 65")

	def test_greater_than_or_equal(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE amount >= %(amount)s", {"amount": 1000})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount >= 1000")

	def test_less_than_or_equal(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE amount <= %(amount)s", {"amount": 5000})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount <= 5000")

	def test_comparison_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age > %(age)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ---------- IN / NOT IN ----------

	def test_in_with_list(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE status IN %(statuses)s",
			{"statuses": ["Active", "Pending"]},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active', 'Pending')")

	def test_in_with_integers(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE id IN %(ids)s", {"ids": [1, 2, 3]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE id IN (1, 2, 3)")

	def test_in_with_parentheses_in_sql(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE status IN (%(statuses)s)",
			{"statuses": ["Active", "Pending"]},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active', 'Pending')")

	def test_in_with_single_value(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status IN %(s)s", {"s": ["Active"]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active')")

	def test_in_with_scalar_value(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status IN %(s)s", {"s": "Active"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active')")

	def test_in_empty_list(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status IN %(s)s", {"s": []})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_in_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status IN %(s)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_not_in_with_list(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE status NOT IN %(s)s",
			{"s": ["Cancelled", "Rejected"]},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE status NOT IN ('Cancelled', 'Rejected')")

	def test_not_in_empty_list(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status NOT IN %(s)s", {"s": []})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_not_in_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE status NOT IN %(s)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_in_mixed_types(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE val IN %(v)s", {"v": [1, "two", 3.0, None]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE val IN (1, 'two', 3.0, NULL)")

	# ---------- LIKE / NOT LIKE ----------

	def test_like(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name LIKE %(p)s", {"p": "%mesh%"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name LIKE '%mesh%'")

	def test_not_like(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name NOT LIKE %(p)s", {"p": "%test%"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name NOT LIKE '%test%'")

	def test_like_missing_param(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name LIKE %(p)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ---------- BETWEEN ----------

	def test_between_integers(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE age BETWEEN %(min)s AND %(max)s",
			{"min": 18, "max": 30},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE age BETWEEN 18 AND 30")

	def test_between_strings(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE date BETWEEN %(s)s AND %(e)s",
			{"s": "2024-01-01", "e": "2024-12-31"},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE date BETWEEN '2024-01-01' AND '2024-12-31'")

	def test_between_missing_start(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age BETWEEN %(min)s AND %(max)s", {"max": 30})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_between_both_missing(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE age BETWEEN %(min)s AND %(max)s", {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ---------- String Escaping ----------

	def test_string_with_single_quote(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(n)s", {"n": "O'Brien"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'O''Brien'")

	def test_string_with_multiple_quotes(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(n)s", {"n": "It's a 'test'"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'It''s a ''test'''")

	# ---------- Multiple Conditions ----------

	def test_multiple_conditions_all_present(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s AND age > %(age)s",
			{"name": "Amresh", "statuses": ["active", "pending"], "age": 25},
		)
		self.assertEqual(
			result,
			"SELECT * FROM tbl WHERE name = 'Amresh' AND status IN ('active', 'pending') AND age > 25",
		)

	def test_multiple_conditions_some_missing(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name = %(name)s AND status IN %(s)s AND age > %(age)s",
			{"name": "Amresh"},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh' AND 1=1 AND 1=1")

	def test_multiple_conditions_all_missing(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name = %(name)s AND status IN %(s)s AND age > %(age)s", {}
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1 AND 1=1 AND 1=1")

	# ---------- Catch-all / Remaining ----------

	def test_placeholder_in_case(self):
		sql = "SELECT CASE WHEN status = 'Active' THEN %(label)s ELSE 'N/A' END FROM tbl"
		result = SQLBuilder.apply(sql, {"label": "Yes"})
		self.assertEqual(result, "SELECT CASE WHEN status = 'Active' THEN 'Yes' ELSE 'N/A' END FROM tbl")

	def test_remaining_placeholder_missing(self):
		result = SQLBuilder.apply("SELECT %(col)s FROM tbl", {})
		self.assertEqual(result, "SELECT NULL FROM tbl")

	# ---------- Edge Cases ----------

	def test_no_placeholders(self):
		sql = "SELECT * FROM tbl WHERE 1=1"
		self.assertEqual(SQLBuilder.apply(sql, {"name": "ignored"}), sql)

	def test_empty_sql(self):
		self.assertEqual(SQLBuilder.apply("", {}), "")

	def test_same_param_used_twice(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE name = %(n)s OR alias = %(n)s", {"n": "Amresh"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh' OR alias = 'Amresh'")

	def test_in_preserves_surrounding_spaces(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name = %(name)s AND status IN %(s)s AND age > %(age)s",
			{"name": "Amresh", "s": ["active", "pending"], "age": 25},
		)
		self.assertIn(") AND age", result)

	# ---------- Whitespace in Placeholders ----------

	def test_whitespace_in_equality_placeholder(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name = %(  name  )s",
			{"name": "Amresh"},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh'")

	def test_whitespace_in_in_placeholder(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE status IN %(  statuses  )s",
			{"statuses": ["Active", "Pending"]},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active', 'Pending')")

	def test_whitespace_in_between_placeholders(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE age BETWEEN %( min )s AND %(  max  )s",
			{"min": 18, "max": 30},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE age BETWEEN 18 AND 30")

	def test_whitespace_in_like_placeholder(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE name LIKE %(  pattern  )s",
			{"pattern": "%test%"},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE name LIKE '%test%'")

	def test_whitespace_in_comparison_placeholder(self):
		result = SQLBuilder.apply(
			"SELECT * FROM tbl WHERE age > %(   age   )s",
			{"age": 25},
		)
		self.assertEqual(result, "SELECT * FROM tbl WHERE age > 25")

	def test_whitespace_complex_query(self):
		sql = """
            SELECT * FROM `tabGrant` g
            WHERE g.status = %(                        status)s
              AND g.year = %(year            )s
              AND g.company IN %(companies )s
              AND g.amount BETWEEN %( min_amount)s AND %(max_amount)s
              AND g.name LIKE %( search )s
        """
		result = SQLBuilder.apply(
			sql,
			{
				"status": "Approved",
				"year": 2024,
				"companies": ["Company A", "Company B"],
				"min_amount": 1000,
				"max_amount": 50000,
				"search": "%grant%",
			},
		)
		self.assertIn("g.status = 'Approved'", result)
		self.assertIn("g.year = 2024", result)
		self.assertIn("g.company IN ('Company A', 'Company B')", result)
		self.assertIn("g.amount BETWEEN 1000 AND 50000", result)
		self.assertIn("g.name LIKE '%grant%'", result)

	# ---------- Frappe-style Patterns ----------

	def test_frappe_doctype_query(self):
		result = SQLBuilder.apply(
			"SELECT * FROM `tabProject` WHERE name = %(name)s AND docstatus = %(d)s",
			{"name": "PROJ-001", "d": 1},
		)
		self.assertEqual(result, "SELECT * FROM `tabProject` WHERE name = 'PROJ-001' AND docstatus = 1")

	def test_frappe_workflow_filter(self):
		result = SQLBuilder.apply(
			"SELECT * FROM `tabGrant` WHERE workflow_state IN %(states)s",
			{"states": ["Approved", "Pending"]},
		)
		self.assertEqual(result, "SELECT * FROM `tabGrant` WHERE workflow_state IN ('Approved', 'Pending')")

	def test_frappe_complex_query_partial_params(self):
		sql = (
			"SELECT name FROM `tabProject proposal` "
			"WHERE ngo = %(ngo)s "
			"AND focus_area = %(focus_area)s "
			"AND workflow_state IN %(states)s "
			"AND financial_year = %(fy)s"
		)
		result = SQLBuilder.apply(sql, {"ngo": "HelpAge India", "states": ["Approved"]})
		self.assertEqual(
			result,
			"SELECT name FROM `tabProject proposal` "
			"WHERE ngo = 'HelpAge India' "
			"AND 1=1 "
			"AND workflow_state IN ('Approved') "
			"AND 1=1",
		)

	# ---------- format_value ----------

	def test_format_value_string(self):
		self.assertEqual(SQLBuilder.format_value("hello"), "'hello'")

	def test_format_value_int(self):
		self.assertEqual(SQLBuilder.format_value(42), "42")

	def test_format_value_none(self):
		self.assertEqual(SQLBuilder.format_value(None), "NULL")

	def test_format_value_bool(self):
		self.assertEqual(SQLBuilder.format_value(True), "1")
		self.assertEqual(SQLBuilder.format_value(False), "0")

	def test_format_value_list(self):
		self.assertEqual(SQLBuilder.format_value([1, 2, 3]), "(1, 2, 3)")

	def test_format_value_empty_list(self):
		self.assertIsNone(SQLBuilder.format_value([]))

	# ---------- Instance vs Class Method ----------

	def test_instance_build(self):
		builder = SQLBuilder("SELECT * FROM tbl WHERE id = %(id)s", {"id": 10})
		self.assertEqual(builder.build(), "SELECT * FROM tbl WHERE id = 10")

	def test_class_method_apply(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE id = %(id)s", {"id": 10})
		self.assertEqual(result, "SELECT * FROM tbl WHERE id = 10")


class TestSQLBuilderExtractPlaceholders(unittest.TestCase):
	"""Tests for extract_placeholders method."""

	def test_single_placeholder(self):
		result = SQLBuilder.extract_placeholders("SELECT * FROM tbl WHERE name = %(name)s")
		self.assertEqual(result, ["name"])

	def test_multiple_placeholders(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s AND status = %(status)s AND age > %(age)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["name", "status", "age"])

	def test_duplicate_placeholder_unique(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s OR alias = %(name)s"
		result = SQLBuilder.extract_placeholders(sql, unique=True)
		self.assertEqual(result, ["name"])

	def test_duplicate_placeholder_not_unique(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s OR alias = %(name)s"
		result = SQLBuilder.extract_placeholders(sql, unique=False)
		self.assertEqual(result, ["name", "name"])

	def test_no_placeholders(self):
		sql = "SELECT * FROM tbl WHERE id = 1"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, [])

	def test_empty_sql(self):
		result = SQLBuilder.extract_placeholders("")
		self.assertEqual(result, [])

	def test_in_clause_placeholder(self):
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["statuses"])

	def test_between_placeholders(self):
		sql = "SELECT * FROM tbl WHERE age BETWEEN %(min_age)s AND %(max_age)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["min_age", "max_age"])

	def test_like_placeholder(self):
		sql = "SELECT * FROM tbl WHERE name LIKE %(pattern)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["pattern"])

	def test_complex_query(self):
		sql = """
            SELECT * FROM `tabGrant` g
            LEFT JOIN `tabProject` p ON p.name = g.project
            WHERE g.status = %(status)s
              AND g.year = %(year)s
              AND p.company IN %(companies)s
              AND g.amount BETWEEN %(min_amount)s AND %(max_amount)s
              AND p.name LIKE %(search)s
            ORDER BY g.creation DESC
        """
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["status", "year", "companies", "min_amount", "max_amount", "search"])

	def test_preserves_order(self):
		sql = "SELECT * FROM tbl WHERE z = %(z)s AND a = %(a)s AND m = %(m)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["z", "a", "m"])

	def test_placeholder_in_case_expression(self):
		sql = "SELECT CASE WHEN status = 'Active' THEN %(label)s ELSE %(default)s END FROM tbl"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["label", "default"])

	def test_placeholder_in_subquery(self):
		sql = """
            SELECT * FROM `tabGrant` g
            WHERE g.project IN (
                SELECT name FROM `tabProject` WHERE ngo = %(ngo)s
            )
            AND g.status = %(status)s
        """
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["ngo", "status"])

	def test_mixed_duplicates_preserves_first_occurrence_order(self):
		sql = "SELECT * FROM tbl WHERE a = %(x)s AND b = %(y)s AND c = %(x)s AND d = %(z)s AND e = %(y)s"
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["x", "y", "z"])

	def test_whitespace_in_placeholders(self):
		sql = """
            SELECT * FROM `tabGrant` g
            LEFT JOIN `tabProject` p ON p.name = g.project
            WHERE g.status = %(                        status)s
              AND g.year = %(year            )s
              AND p.company IN %(companies )s
              AND g.amount BETWEEN %( min_amount)s AND %(max_amount)s
              AND p.name LIKE %( search )s
            ORDER BY g.creation DESC
        """
		result = SQLBuilder.extract_placeholders(sql)
		self.assertEqual(result, ["status", "year", "companies", "min_amount", "max_amount", "search"])

	def test_whitespace_single_placeholder(self):
		result = SQLBuilder.extract_placeholders("SELECT * FROM tbl WHERE name = %(  name  )s")
		self.assertEqual(result, ["name"])


class TestSQLBuilderTableExtraction(unittest.TestCase):
	"""Tests for _extract_tables (no Frappe dependency)."""

	def _extract(self, sql):
		return SQLBuilder(sql)._extract_tables(sql)

	def test_single_table(self):
		tables = self._extract("SELECT * FROM `tabProject`")
		self.assertEqual(len(tables), 1)
		self.assertEqual(tables[0]["doctype"], "Project")
		self.assertIsNone(tables[0]["alias"])

	def test_table_with_alias(self):
		tables = self._extract("SELECT * FROM `tabProject` p")
		self.assertEqual(len(tables), 1)
		self.assertEqual(tables[0]["doctype"], "Project")
		self.assertEqual(tables[0]["alias"], "p")

	def test_table_with_as_alias(self):
		tables = self._extract("SELECT * FROM `tabProject` AS proj")
		self.assertEqual(len(tables), 1)
		self.assertEqual(tables[0]["alias"], "proj")

	def test_multiple_tables_with_join(self):
		sql = """
            SELECT * FROM `tabProject` p
            LEFT JOIN `tabGrant` g ON g.project = p.name
            LEFT JOIN `tabDonor` d ON d.name = p.donor
        """
		tables = self._extract(sql)
		doctypes = [t["doctype"] for t in tables]
		self.assertIn("Project", doctypes)
		self.assertIn("Grant", doctypes)
		self.assertIn("Donor", doctypes)

	def test_table_with_space_in_name(self):
		tables = self._extract("SELECT * FROM `tabProject proposal` pp")
		self.assertEqual(tables[0]["doctype"], "Project proposal")
		self.assertEqual(tables[0]["alias"], "pp")

	def test_subquery_tables(self):
		sql = """
            SELECT * FROM `tabGrant` g
            WHERE g.project IN (
                SELECT name FROM `tabProject` WHERE ngo = 'test'
            )
        """
		tables = self._extract(sql)
		doctypes = [t["doctype"] for t in tables]
		self.assertIn("Grant", doctypes)
		self.assertIn("Project", doctypes)

	def test_no_frappe_tables(self):
		tables = self._extract("SELECT * FROM users WHERE id = 1")
		self.assertEqual(len(tables), 0)


class TestSQLBuilderUserPermissions(unittest.TestCase):
	"""
	Tests for user permission injection.
	Uses mock frappe module to simulate different permission scenarios.
	"""

	def _apply_with_mock(self, sql, params, mock_frappe):
		"""Helper: patch frappe import and run SQLBuilder with permissions."""
		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			return SQLBuilder.apply(sql, params, apply_permissions=True)

	# ---------- Single Company Permission ----------

	def test_single_company_permission(self):
		"""User with Company='My Co' → adds company filter."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co", "is_default": 1}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
					{"fieldtype": "Data", "options": "", "fieldname": "project_name"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("`tabProject`.company = 'My Co'", result)
		self.assertIn("status = 'Active'", result)

	# ---------- Multiple Company Values ----------

	def test_multiple_company_values(self):
		"""User with multiple companies → uses IN clause."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "Company A"}, {"doc": "Company B"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("`tabProject`.company IN ('Company A', 'Company B')", result)

	# ---------- Table Alias Handling ----------

	def test_permission_with_alias(self):
		"""Permission should use table alias when available."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` p WHERE p.status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("p.company = 'My Co'", result)
		# Should NOT have `tabProject`.company (should use alias)
		self.assertNotIn("`tabProject`.company", result)

	# ---------- Multiple Tables / JOINs ----------

	def test_permissions_on_multiple_joined_tables(self):
		"""Permissions applied to each table that has applicable link fields."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
				"Grant": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
					{"fieldtype": "Link", "options": "Project", "fieldname": "project"},
				],
			},
		)

		sql = (
			"SELECT * FROM `tabProject` p "
			"LEFT JOIN `tabGrant` g ON g.project = p.name "
			"WHERE p.status = 'Active'"
		)
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("p.company = 'My Co'", result)
		self.assertIn("g.company = 'My Co'", result)

	# ---------- Doctype-level Permission (name filter) ----------

	def test_doctype_level_permission(self):
		"""Permission on doctype itself → filters by name."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Project": [{"doc": "PROJ-001"}, {"doc": "PROJ-002"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Data", "options": "", "fieldname": "project_name"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("`tabProject`.name IN ('PROJ-001', 'PROJ-002')", result)

	# ---------- Multiple Permission Types ----------

	def test_multiple_permission_types(self):
		"""User has both Company and Territory permissions."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
				"Territory": [{"doc": "India"}, {"doc": "Nepal"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
					{"fieldtype": "Link", "options": "Territory", "fieldname": "territory"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertIn("`tabProject`.company = 'My Co'", result)
		self.assertIn("`tabProject`.territory IN ('India', 'Nepal')", result)

	# ---------- Administrator Bypass ----------

	def test_administrator_bypasses_permissions(self):
		"""Administrator should not get any permission filters."""
		mock_frappe = _create_mock_frappe(
			user="Administrator",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		# No permission conditions should be added
		self.assertNotIn("company", result)
		self.assertEqual(result, sql)

	# ---------- No Applicable Permissions ----------

	def test_no_applicable_link_fields(self):
		"""Permission exists but doctype has no matching Link field → no filter."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Territory": [{"doc": "India"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
					# No Territory link field
				],
			},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertNotIn("territory", result)
		self.assertEqual(result, sql)

	# ---------- Empty Permissions ----------

	def test_empty_user_permissions(self):
		"""User has no permissions → no filter added."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={},
			doctype_meta={},
		)

		sql = "SELECT * FROM `tabProject` WHERE status = 'Active'"
		result = self._apply_with_mock(sql, {}, mock_frappe)

		self.assertEqual(result, sql)

	# ---------- No Frappe (graceful fallback) ----------

	def test_no_frappe_available(self):
		"""When frappe is not installed, permissions are silently skipped."""
		# Remove frappe from modules if present
		with patch.dict(sys.modules, {"frappe": None}):
			result = SQLBuilder.apply(
				"SELECT * FROM `tabProject` WHERE status = 'Active'",
				{},
				apply_permissions=True,
			)
		self.assertEqual(result, "SELECT * FROM `tabProject` WHERE status = 'Active'")

	# ---------- Combined: Params + Permissions ----------

	def test_params_and_permissions_together(self):
		"""Both placeholder replacement AND user permissions work together."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Grant": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabGrant` " "WHERE workflow_state IN %(states)s " "AND year = %(year)s"

		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			result = SQLBuilder.apply(
				sql,
				{"states": ["Approved", "Pending"], "year": 2024},
				apply_permissions=True,
			)

		# Params replaced
		self.assertIn("workflow_state IN ('Approved', 'Pending')", result)
		self.assertIn("year = 2024", result)
		# Permission added
		self.assertIn("`tabGrant`.company = 'My Co'", result)

	def test_params_missing_with_permissions(self):
		"""Missing params become 1=1, permissions still added."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Grant": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabGrant` WHERE workflow_state = %(state)s"

		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			result = SQLBuilder.apply(sql, {}, apply_permissions=True)

		self.assertIn("1=1", result)
		self.assertIn("`tabGrant`.company = 'My Co'", result)

	# ---------- SQL without WHERE (permissions add WHERE) ----------

	def test_permission_adds_where_clause(self):
		"""When SQL has no WHERE, permissions inject one."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT * FROM `tabProject` ORDER BY name"

		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			result = SQLBuilder.apply(sql, {}, apply_permissions=True)

		self.assertIn("WHERE", result)
		self.assertIn("`tabProject`.company = 'My Co'", result)
		self.assertIn("ORDER BY name", result)

	def test_permission_with_group_by(self):
		"""Permissions injected before GROUP BY."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = "SELECT company, COUNT(*) FROM `tabProject` GROUP BY company"

		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			result = SQLBuilder.apply(sql, {}, apply_permissions=True)

		self.assertIn("WHERE", result)
		self.assertIn("`tabProject`.company = 'My Co'", result)
		# WHERE should come before GROUP BY
		where_pos = result.upper().index("WHERE")
		group_pos = result.upper().index("GROUP BY")
		self.assertLess(where_pos, group_pos)

	# ---------- Subquery: permissions should not break subqueries ----------

	def test_permission_appended_to_outer_where(self):
		"""Permissions should be appended to the outer query, not inside subqueries."""
		mock_frappe = _create_mock_frappe(
			user="test@example.com",
			user_permissions={
				"Company": [{"doc": "My Co"}],
			},
			doctype_meta={
				"Grant": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
				"Project": [
					{"fieldtype": "Link", "options": "Company", "fieldname": "company"},
				],
			},
		)

		sql = (
			"SELECT * FROM `tabGrant` g "
			"WHERE g.project IN ("
			"  SELECT name FROM `tabProject` WHERE status = 'Active'"
			") "
			"AND g.year = 2024"
		)

		with patch.dict(sys.modules, {"frappe": mock_frappe}):
			result = SQLBuilder.apply(sql, {}, apply_permissions=True)

		self.assertIn("g.company = 'My Co'", result)


class TestSQLBuilderWhereDetection(unittest.TestCase):
	"""Tests for top-level WHERE detection (handles subqueries correctly)."""

	def _find_where(self, sql):
		builder = SQLBuilder(sql)
		return builder._find_top_level_where(sql)

	def test_simple_where(self):
		sql = "SELECT * FROM tbl WHERE id = 1"
		pos = self._find_where(sql)
		self.assertGreater(pos, -1)

	def test_no_where(self):
		sql = "SELECT * FROM tbl"
		pos = self._find_where(sql)
		self.assertEqual(pos, -1)

	def test_where_in_subquery_only(self):
		sql = "SELECT * FROM (SELECT * FROM tbl WHERE id = 1) sub"
		pos = self._find_where(sql)
		# Should return -1 because the WHERE is inside a subquery
		self.assertEqual(pos, -1)

	def test_where_both_outer_and_subquery(self):
		sql = "SELECT * FROM (SELECT * FROM tbl WHERE id = 1) sub WHERE sub.x = 2"
		pos = self._find_where(sql)
		# Should find the outer WHERE
		self.assertGreater(pos, -1)
		# Position should be after the closing )
		self.assertGreater(pos, sql.index(")"))


if __name__ == "__main__":
	unittest.main()
