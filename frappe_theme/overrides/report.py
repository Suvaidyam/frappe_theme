import json

import frappe
from frappe import _
from frappe.core.doctype.report.report import Report
from frappe.utils import cstr
from frappe.utils.safe_exec import check_safe_sql_query

from frappe_theme.utils.permission_engine import get_permission_query_conditions_custom


def before_save(doc, method=None):
	if doc.custom_create_view:
		if doc.custom_view_type == "Logical":
			sql = f"""
                CREATE OR REPLACE VIEW `{doc.custom_view_name}` AS
                ({doc.query})
            """
		# elif doc.custom_view_type == "Materialized":
		#     sql = f"""
		#         CREATE MATERIALIZED VIEW IF NOT EXISTS `{doc.custom_view_name}` AS ({doc.query})
		#         """
		try:
			frappe.db.sql_ddl(sql)
		except Exception as e:
			frappe.throw(f"Error in creating view: {e}")


class CustomReport(Report):
	# -------------------------------
	# ✨ Main overridden Query Executor
	# -------------------------------
	def execute_query_report(
		self,
		filters,
		ref_doctype=None,
		ref_docname=None,
		limit_page_length=None,
		limit_start=None,
		unfiltered=0,
		return_query=False,
		additional_filters=None,
	):
		if not self.query:
			frappe.throw(_("Must specify a Query to run"), title=_("Report Document Error"))

		if filters is None:
			filters = {}

		if additional_filters is None:
			additional_filters = {}

		check_safe_sql_query(self.query)

		# 1. Parse columns of the report
		columns = self.get_columns() or []

		# 2. Build user-permission filters
		user_perm_conditions = self.get_user_permission_conditions(columns)

		# 3. Append permission filters to SQL safely
		sql_with_permissions = self.apply_permission_filter(self.query, user_perm_conditions)

		# 3.a Apply doctype/docname filter if applicable
		sql_with_applied_filters = self.apply_dt_dn_filter_and_filters(
			sql_with_permissions,
			ref_doctype,
			ref_docname,
			additional_filters,
			unfiltered,
			limit_page_length,
			limit_start,
		)
		# 4. Execute SQL
		result = frappe.db.sql(sql_with_applied_filters, filters, as_dict=True)
		# 5. Resolve auto columns if missing
		if not columns:
			columns = [cstr(c[0]) for c in frappe.db.get_description()]

		if return_query:
			return sql_with_applied_filters

		return columns, result

	def execute_and_count_query_report_rows(self, filters, ref_doctype=None, ref_docname=None, unfiltered=0):
		if not self.query:
			frappe.throw(_("Must specify a Query to run"), title=_("Report Document Error"))

		check_safe_sql_query(self.query)

		# 1. Parse columns of the report
		columns = self.get_columns() or []

		# 2. Build user-permission filters
		user_perm_conditions = self.get_user_permission_conditions(columns)

		# 3. Append permission filters to SQL safely
		sql_with_permissions = self.apply_permission_filter(self.query, user_perm_conditions)

		# 3.a Apply doctype/docname filter if applicable
		sql_with_applied_filters = self.apply_dt_dn_filter_and_filters(
			sql_with_permissions, ref_doctype, ref_docname, filters, unfiltered
		)
		# 4. Execute SQL
		result = frappe.db.sql(
			f"SELECT COUNT(*) AS count FROM ({sql_with_applied_filters}) as __count", as_dict=True
		)

		return result[0].get("count") if result else 0

	# -------------------------------------------
	# ✨ Detect all Link fields & apply permissions
	# -------------------------------------------
	def get_user_permission_conditions(self, columns):
		"""
		Loop through columns, detect fieldtype=Link
		Then ask Frappe to generate permission match conditions
		"""
		conditions = []
		for col in columns:
			if not isinstance(col, dict) and hasattr(col, "as_dict"):
				col = col.as_dict()

			if isinstance(col, dict) and col.get("fieldtype") == "Link":
				linked_dt = col.get("options")
				fieldname = col.get("fieldname")
				if not linked_dt or not fieldname:
					continue
				# Frappe’s internal match condition builder
				match_condition = get_permission_query_conditions_custom(linked_dt)
				if match_condition:
					conditions.append(f"{fieldname} {match_condition}")
		return conditions

	# ----------------------------------------------------------
	# ✨ Inject permission filters into SQL safely at end of WHERE
	# ----------------------------------------------------------
	def apply_permission_filter(self, sql, conditions):
		if not conditions:
			return sql  # No permissions → original SQL

		permission_sql = " AND ".join(f"({c})" for c in conditions)

		# If SQL already contains WHERE
		if " where " in sql.lower():
			return sql + " AND " + permission_sql

		# Otherwise add WHERE
		return f"SELECT * FROM ({sql.replace(';', '')}) as __tmp WHERE {permission_sql}"

	def apply_dt_dn_filter_and_filters(
		self, sql, doctype, docname, filters, unfiltered=0, limit_page_length=None, limit_start=None
	):
		available_columns = (self.columns or []) + (self.filters or [])

		conditions = "WHERE 1=1"
		if doctype and docname and doctype != docname:
			for f in available_columns:
				if f.fieldname and f.fieldname not in filters and f.options == doctype and unfiltered == 0:
					conditions += f" AND __t.{f.fieldname} = '{docname}'"
		if filters:
			filter_conditions = CustomReport.filters_to_sql_conditions(filters, table_alias="__t")
			if filter_conditions:
				conditions += " AND " + filter_conditions

		if limit_page_length and limit_start is not None:
			conditions += f" LIMIT {limit_start}, {limit_page_length}"

		# Otherwise add WHERE
		return f"SELECT * FROM ({sql.replace(';', '')}) as __t {conditions}"

	@staticmethod
	def filters_to_sql_conditions(filters, table_alias="t"):
		conditions = []
		if isinstance(filters, str):
			filters = json.loads(filters)

		if isinstance(filters, dict):
			_filters = []
			for key, value in filters.items():
				if isinstance(value, list):
					operator = value[0]
					val = value[1]
					_filters.append([table_alias, key, operator, val])
				else:
					_filters.append([table_alias, key, "=", value])

			filters = _filters

		for f in filters:
			if len(f) < 4:
				continue

			doctype, field, operator, value = f[:4]
			field_name = f"{table_alias}.{field}"

			if operator.lower() == "between" and isinstance(value, (list | tuple)) and len(value) == 2:
				condition = f"{field_name} BETWEEN '{value[0]}' AND '{value[1]}'"
			elif operator.lower() == "like":
				condition = f"{field_name} LIKE '{value}'"
			elif operator.lower() == "in" and isinstance(value, (list | tuple)):
				in_values = ", ".join(f"'{v}'" for v in value)
				condition = f"{field_name} IN ({in_values})"
			elif operator.lower() == "not in" and isinstance(value, (list | tuple)):
				not_in_values = ", ".join(f"'{v}'" for v in value)
				condition = f"{field_name} NOT IN ({not_in_values})"
			elif operator.lower() == "is":
				val = str(value).lower()
				if val == "set":
					condition = f"{field_name} IS NOT NULL"
				elif val == "not set":
					condition = f"{field_name} IS NULL"
			else:
				condition = f"{field_name} {operator} '{value}'"

			conditions.append(condition)

		return " AND ".join(conditions)
