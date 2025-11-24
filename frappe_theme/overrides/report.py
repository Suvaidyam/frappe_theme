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
	def execute_query_report(self, filters):
		if not self.query:
			frappe.throw(_("Must specify a Query to run"), title=_("Report Document Error"))

		check_safe_sql_query(self.query)

		# 1. Parse columns of the report
		columns = self.get_columns() or []

		# 2. Build user-permission filters
		user_perm_conditions = self.get_user_permission_conditions(columns)

		# 3. Append permission filters to SQL safely
		sql_with_permissions = self.apply_permission_filter(self.query, user_perm_conditions)

		# 4. Execute SQL
		result = [list(t) for t in frappe.db.sql(sql_with_permissions, filters)]

		# 5. Resolve auto columns if missing
		if not columns:
			columns = [cstr(c[0]) for c in frappe.db.get_description()]

		return [columns, result]

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
		return f"SELECT * FROM ({sql}) as __tmp WHERE {permission_sql}"
