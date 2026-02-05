"""
Frappe-style unit tests for SQLBuilder.

To run in Frappe:
    bench run-tests --module your_app.tests.test_sql_builder

Or standalone:
    python -m pytest test_sql_builder.py -v
"""

import unittest

# When used inside a Frappe app, replace with:
# from your_app.utils.sql_builder import SQLBuilder
from frappe_theme.utils.sql_builder import SQLBuilder


class TestSQLBuilder(unittest.TestCase):
	"""Test suite for SQLBuilder — covers all operator types, edge cases, and Frappe patterns."""

	# ------------------------------------------------------------------ #
	#  1. Basic Equality (=)
	# ------------------------------------------------------------------ #

	def test_equality_string(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, {"name": "Amresh"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh'")

	def test_equality_integer(self):
		sql = "SELECT * FROM tbl WHERE age = %(age)s"
		result = SQLBuilder.apply(sql, {"age": 25})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age = 25")

	def test_equality_float(self):
		sql = "SELECT * FROM tbl WHERE amount = %(amount)s"
		result = SQLBuilder.apply(sql, {"amount": 99.95})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount = 99.95")

	def test_equality_bool_true(self):
		sql = "SELECT * FROM tbl WHERE active = %(active)s"
		result = SQLBuilder.apply(sql, {"active": True})
		self.assertEqual(result, "SELECT * FROM tbl WHERE active = 1")

	def test_equality_bool_false(self):
		sql = "SELECT * FROM tbl WHERE active = %(active)s"
		result = SQLBuilder.apply(sql, {"active": False})
		self.assertEqual(result, "SELECT * FROM tbl WHERE active = 0")

	def test_equality_none_becomes_is_null(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, {"name": None})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name IS NULL")

	def test_equality_missing_param(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_equality_none_params(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, None)
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ------------------------------------------------------------------ #
	#  2. Not Equal (!=, <>)
	# ------------------------------------------------------------------ #

	def test_not_equal(self):
		sql = "SELECT * FROM tbl WHERE status != %(status)s"
		result = SQLBuilder.apply(sql, {"status": "Cancelled"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status != 'Cancelled'")

	def test_not_equal_angle_brackets(self):
		sql = "SELECT * FROM tbl WHERE status <> %(status)s"
		result = SQLBuilder.apply(sql, {"status": "Cancelled"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status <> 'Cancelled'")

	def test_not_equal_none_becomes_is_not_null(self):
		sql = "SELECT * FROM tbl WHERE name != %(name)s"
		result = SQLBuilder.apply(sql, {"name": None})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name IS NOT NULL")

	def test_not_equal_missing_param(self):
		sql = "SELECT * FROM tbl WHERE status != %(status)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ------------------------------------------------------------------ #
	#  3. Comparison Operators (<, >, <=, >=)
	# ------------------------------------------------------------------ #

	def test_greater_than(self):
		sql = "SELECT * FROM tbl WHERE age > %(age)s"
		result = SQLBuilder.apply(sql, {"age": 18})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age > 18")

	def test_less_than(self):
		sql = "SELECT * FROM tbl WHERE age < %(age)s"
		result = SQLBuilder.apply(sql, {"age": 65})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age < 65")

	def test_greater_than_or_equal(self):
		sql = "SELECT * FROM tbl WHERE amount >= %(amount)s"
		result = SQLBuilder.apply(sql, {"amount": 1000})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount >= 1000")

	def test_less_than_or_equal(self):
		sql = "SELECT * FROM tbl WHERE amount <= %(amount)s"
		result = SQLBuilder.apply(sql, {"amount": 5000})
		self.assertEqual(result, "SELECT * FROM tbl WHERE amount <= 5000")

	def test_comparison_missing_param(self):
		sql = "SELECT * FROM tbl WHERE age > %(age)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ------------------------------------------------------------------ #
	#  4. IN / NOT IN
	# ------------------------------------------------------------------ #

	def test_in_with_list(self):
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": ["Active", "Pending"]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active', 'Pending')")

	def test_in_with_integers(self):
		sql = "SELECT * FROM tbl WHERE id IN %(ids)s"
		result = SQLBuilder.apply(sql, {"ids": [1, 2, 3]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE id IN (1, 2, 3)")

	def test_in_with_parentheses_in_sql(self):
		sql = "SELECT * FROM tbl WHERE status IN (%(statuses)s)"
		result = SQLBuilder.apply(sql, {"statuses": ["Active", "Pending"]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active', 'Pending')")

	def test_in_with_single_value(self):
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": ["Active"]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active')")

	def test_in_with_scalar_value(self):
		"""A non-list value should be wrapped in a list automatically."""
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": "Active"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status IN ('Active')")

	def test_in_empty_list(self):
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": []})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_in_missing_param(self):
		sql = "SELECT * FROM tbl WHERE status IN %(statuses)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_not_in_with_list(self):
		sql = "SELECT * FROM tbl WHERE status NOT IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": ["Cancelled", "Rejected"]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE status NOT IN ('Cancelled', 'Rejected')")

	def test_not_in_empty_list(self):
		sql = "SELECT * FROM tbl WHERE status NOT IN %(statuses)s"
		result = SQLBuilder.apply(sql, {"statuses": []})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_not_in_missing_param(self):
		sql = "SELECT * FROM tbl WHERE status NOT IN %(statuses)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_in_mixed_types(self):
		sql = "SELECT * FROM tbl WHERE val IN %(vals)s"
		result = SQLBuilder.apply(sql, {"vals": [1, "two", 3.0, None]})
		self.assertEqual(result, "SELECT * FROM tbl WHERE val IN (1, 'two', 3.0, NULL)")

	# ------------------------------------------------------------------ #
	#  5. LIKE / NOT LIKE
	# ------------------------------------------------------------------ #

	def test_like(self):
		sql = "SELECT * FROM tbl WHERE name LIKE %(pattern)s"
		result = SQLBuilder.apply(sql, {"pattern": "%mesh%"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name LIKE '%mesh%'")

	def test_like_prefix(self):
		sql = "SELECT * FROM tbl WHERE name LIKE %(pattern)s"
		result = SQLBuilder.apply(sql, {"pattern": "Am%"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name LIKE 'Am%'")

	def test_not_like(self):
		sql = "SELECT * FROM tbl WHERE name NOT LIKE %(pattern)s"
		result = SQLBuilder.apply(sql, {"pattern": "%test%"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name NOT LIKE '%test%'")

	def test_like_missing_param(self):
		sql = "SELECT * FROM tbl WHERE name LIKE %(pattern)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ------------------------------------------------------------------ #
	#  6. BETWEEN
	# ------------------------------------------------------------------ #

	def test_between_integers(self):
		sql = "SELECT * FROM tbl WHERE age BETWEEN %(min_age)s AND %(max_age)s"
		result = SQLBuilder.apply(sql, {"min_age": 18, "max_age": 30})
		self.assertEqual(result, "SELECT * FROM tbl WHERE age BETWEEN 18 AND 30")

	def test_between_strings(self):
		sql = "SELECT * FROM tbl WHERE date BETWEEN %(start)s AND %(end)s"
		result = SQLBuilder.apply(sql, {"start": "2024-01-01", "end": "2024-12-31"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE date BETWEEN '2024-01-01' AND '2024-12-31'")

	def test_between_missing_start(self):
		sql = "SELECT * FROM tbl WHERE age BETWEEN %(min_age)s AND %(max_age)s"
		result = SQLBuilder.apply(sql, {"max_age": 30})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_between_missing_end(self):
		sql = "SELECT * FROM tbl WHERE age BETWEEN %(min_age)s AND %(max_age)s"
		result = SQLBuilder.apply(sql, {"min_age": 18})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	def test_between_both_missing(self):
		sql = "SELECT * FROM tbl WHERE age BETWEEN %(min_age)s AND %(max_age)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT * FROM tbl WHERE 1=1")

	# ------------------------------------------------------------------ #
	#  7. String Escaping
	# ------------------------------------------------------------------ #

	def test_string_with_single_quote(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, {"name": "O'Brien"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'O''Brien'")

	def test_string_with_multiple_quotes(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s"
		result = SQLBuilder.apply(sql, {"name": "It's a 'test'"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'It''s a ''test'''")

	# ------------------------------------------------------------------ #
	#  8. Multiple Conditions
	# ------------------------------------------------------------------ #

	def test_multiple_conditions_all_present(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s AND age > %(age)s"
		result = SQLBuilder.apply(
			sql,
			{
				"name": "Amresh",
				"statuses": ["active", "pending"],
				"age": 25,
			},
		)
		self.assertEqual(
			result,
			"SELECT * FROM tbl WHERE name = 'Amresh' AND status IN ('active', 'pending') AND age > 25",
		)

	def test_multiple_conditions_some_missing(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s AND age > %(age)s"
		result = SQLBuilder.apply(sql, {"name": "Amresh"})
		self.assertEqual(
			result,
			"SELECT * FROM tbl WHERE name = 'Amresh' AND 1=1 AND 1=1",
		)

	def test_multiple_conditions_all_missing(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s AND age > %(age)s"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(
			result,
			"SELECT * FROM tbl WHERE 1=1 AND 1=1 AND 1=1",
		)

	# ------------------------------------------------------------------ #
	#  9. Catch-all / Remaining Placeholders (CASE, SELECT, etc.)
	# ------------------------------------------------------------------ #

	def test_placeholder_in_case_expression(self):
		sql = "SELECT CASE WHEN status = 'Active' THEN %(label)s ELSE 'N/A' END FROM tbl"
		result = SQLBuilder.apply(sql, {"label": "Yes"})
		self.assertEqual(result, "SELECT CASE WHEN status = 'Active' THEN 'Yes' ELSE 'N/A' END FROM tbl")

	def test_placeholder_in_select(self):
		sql = "SELECT %(col)s FROM tbl"
		result = SQLBuilder.apply(sql, {"col": "name"})
		self.assertEqual(result, "SELECT 'name' FROM tbl")

	def test_remaining_placeholder_missing(self):
		sql = "SELECT %(col)s FROM tbl"
		result = SQLBuilder.apply(sql, {})
		self.assertEqual(result, "SELECT NULL FROM tbl")

	# ------------------------------------------------------------------ #
	#  10. Frappe-style Patterns
	# ------------------------------------------------------------------ #

	def test_frappe_doctype_query(self):
		"""Typical Frappe: fetching a single doctype by name."""
		sql = "SELECT * FROM `tabProject` WHERE name = %(name)s AND docstatus = %(docstatus)s"
		result = SQLBuilder.apply(sql, {"name": "PROJ-001", "docstatus": 1})
		self.assertEqual(
			result,
			"SELECT * FROM `tabProject` WHERE name = 'PROJ-001' AND docstatus = 1",
		)

	def test_frappe_workflow_filter(self):
		sql = "SELECT * FROM `tabGrant` WHERE workflow_state IN %(states)s"
		result = SQLBuilder.apply(sql, {"states": ["Approved", "Pending"]})
		self.assertEqual(
			result,
			"SELECT * FROM `tabGrant` WHERE workflow_state IN ('Approved', 'Pending')",
		)

	def test_frappe_date_range_filter(self):
		sql = (
			"SELECT * FROM `tabGrant` "
			"WHERE creation BETWEEN %(start_date)s AND %(end_date)s "
			"AND workflow_state = %(state)s"
		)
		result = SQLBuilder.apply(
			sql,
			{
				"start_date": "2024-04-01",
				"end_date": "2025-03-31",
				"state": "Approved",
			},
		)
		self.assertEqual(
			result,
			"SELECT * FROM `tabGrant` "
			"WHERE creation BETWEEN '2024-04-01' AND '2025-03-31' "
			"AND workflow_state = 'Approved'",
		)

	def test_frappe_complex_query_partial_params(self):
		"""Real-world: some filters provided, some skipped."""
		sql = (
			"SELECT name, project_name FROM `tabProject proposal` "
			"WHERE ngo = %(ngo)s "
			"AND focus_area = %(focus_area)s "
			"AND workflow_state IN %(states)s "
			"AND financial_year = %(fy)s"
		)
		result = SQLBuilder.apply(
			sql,
			{
				"ngo": "HelpAge India",
				"states": ["Approved"],
			},
		)
		self.assertEqual(
			result,
			"SELECT name, project_name FROM `tabProject proposal` "
			"WHERE ngo = 'HelpAge India' "
			"AND 1=1 "
			"AND workflow_state IN ('Approved') "
			"AND 1=1",
		)

	def test_frappe_like_search(self):
		sql = "SELECT name FROM `tabProject` WHERE project_name LIKE %(search)s"
		result = SQLBuilder.apply(sql, {"search": "%health%"})
		self.assertEqual(
			result,
			"SELECT name FROM `tabProject` WHERE project_name LIKE '%health%'",
		)

	def test_frappe_subquery_with_params(self):
		"""Params inside subqueries should also be replaced."""
		sql = (
			"SELECT * FROM `tabGrant` g "
			"WHERE g.project IN ("
			"  SELECT name FROM `tabProject` WHERE ngo = %(ngo)s"
			") "
			"AND g.workflow_state = %(state)s"
		)
		result = SQLBuilder.apply(sql, {"ngo": "Tata Trusts", "state": "Approved"})
		self.assertEqual(
			result,
			"SELECT * FROM `tabGrant` g "
			"WHERE g.project IN ("
			"  SELECT name FROM `tabProject` WHERE ngo = 'Tata Trusts'"
			") "
			"AND g.workflow_state = 'Approved'",
		)

	# ------------------------------------------------------------------ #
	#  11. format_value Static Method
	# ------------------------------------------------------------------ #

	def test_format_value_string(self):
		self.assertEqual(SQLBuilder.format_value("hello"), "'hello'")

	def test_format_value_int(self):
		self.assertEqual(SQLBuilder.format_value(42), "42")

	def test_format_value_float(self):
		self.assertEqual(SQLBuilder.format_value(3.14), "3.14")

	def test_format_value_none(self):
		self.assertEqual(SQLBuilder.format_value(None), "NULL")

	def test_format_value_bool(self):
		self.assertEqual(SQLBuilder.format_value(True), "1")
		self.assertEqual(SQLBuilder.format_value(False), "0")

	def test_format_value_list(self):
		self.assertEqual(SQLBuilder.format_value([1, 2, 3]), "(1, 2, 3)")

	def test_format_value_empty_list(self):
		self.assertIsNone(SQLBuilder.format_value([]))

	def test_format_value_tuple(self):
		self.assertEqual(SQLBuilder.format_value((1, 2)), "(1, 2)")

	# ------------------------------------------------------------------ #
	#  12. Instance vs Class Method
	# ------------------------------------------------------------------ #

	def test_instance_build(self):
		builder = SQLBuilder("SELECT * FROM tbl WHERE id = %(id)s", {"id": 10})
		self.assertEqual(builder.build(), "SELECT * FROM tbl WHERE id = 10")

	def test_class_method_apply(self):
		result = SQLBuilder.apply("SELECT * FROM tbl WHERE id = %(id)s", {"id": 10})
		self.assertEqual(result, "SELECT * FROM tbl WHERE id = 10")

	# ------------------------------------------------------------------ #
	#  13. Edge Cases
	# ------------------------------------------------------------------ #

	def test_no_placeholders(self):
		sql = "SELECT * FROM tbl WHERE 1=1"
		result = SQLBuilder.apply(sql, {"name": "ignored"})
		self.assertEqual(result, sql)

	def test_empty_sql(self):
		self.assertEqual(SQLBuilder.apply("", {}), "")

	def test_same_param_used_twice(self):
		sql = "SELECT * FROM tbl WHERE name = %(name)s OR alias = %(name)s"
		result = SQLBuilder.apply(sql, {"name": "Amresh"})
		self.assertEqual(result, "SELECT * FROM tbl WHERE name = 'Amresh' OR alias = 'Amresh'")

	def test_multiline_sql(self):
		sql = """
            SELECT *
            FROM `tabGrant`
            WHERE status = %(status)s
              AND year = %(year)s
        """
		result = SQLBuilder.apply(sql, {"status": "Approved", "year": 2024})
		expected = """
            SELECT *
            FROM `tabGrant`
            WHERE status = 'Approved'
              AND year = 2024
        """
		self.assertEqual(result, expected)

	def test_in_preserves_surrounding_spaces(self):
		"""Regression: IN replacement must not eat trailing spaces."""
		sql = "SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s AND age > %(age)s"
		result = SQLBuilder.apply(
			sql,
			{
				"name": "Amresh",
				"statuses": ["active", "pending"],
				"age": 25,
			},
		)
		self.assertIn(") AND age", result)


if __name__ == "__main__":
	unittest.main()
