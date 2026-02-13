import re
from typing import Any, Optional


class SQLBuilder:
	"""
	Replaces %(name)s style placeholders in SQL strings with actual values,
	and optionally injects Frappe User Permission conditions.

	Handles:
	    - Comparison operators: =, !=, <>, <, >, <=, >=
	    - IN / NOT IN (with lists/tuples)
	    - LIKE / NOT LIKE
	    - BETWEEN ... AND ...
	    - IS NULL / IS NOT NULL (when value is None)
	    - Missing/empty params → condition neutralized to 1=1
	    - String escaping (single quotes)
	    - Bool → 1/0
	    - Catch-all for remaining placeholders
	    - Frappe User Permissions (auto-injected based on doctype link fields)

	Usage:
	    # Without user permissions
	    result = SQLBuilder.apply(sql, params)

	    # With user permissions
	    result = SQLBuilder.apply(sql, params, apply_permissions=True)

	    # With specific user
	    result = SQLBuilder.apply(sql, params, apply_permissions=True, user="user@example.com")
	"""

	_MISSING = object()

	def __init__(
		self,
		sql: str,
		params: dict | None = None,
		apply_permissions: bool = False,
		user: str | None = None,
	):
		self.sql = sql
		self.params = params or {}
		self.apply_permissions = apply_permissions
		self.user = user

	# ------------------------------------------------------------------ #
	#  Public API
	# ------------------------------------------------------------------ #

	def build(self) -> str:
		"""Parse and return the final SQL string with all placeholders replaced."""
		sql = self.sql
		sql = self._replace_in(sql)
		sql = self._replace_between(sql)
		sql = self._replace_like(sql)
		sql = self._replace_comparison(sql)
		sql = self._replace_remaining(sql)

		if self.apply_permissions:
			sql = self._inject_user_permissions(sql)

		return sql

	@classmethod
	def apply(
		cls,
		sql: str,
		params: dict | None = None,
		apply_permissions: bool = False,
		user: str | None = None,
	) -> str:
		"""Shortcut: build SQL in one call."""
		return cls(sql, params, apply_permissions, user).build()

	@staticmethod
	def extract_placeholders(sql: str, unique: bool = True) -> list:
		"""
		Extract all placeholder variable names from a SQL string.

		Args:
		    sql: SQL string with %(name)s style placeholders
		    unique: If True, return unique names (default). If False, return all occurrences.

		Returns:
		    List of variable names found in the SQL (whitespace stripped).

		Examples:
		    >>> SQLBuilder.extract_placeholders("SELECT * FROM tbl WHERE name = %(name)s")
		    ['name']

		    >>> SQLBuilder.extract_placeholders("SELECT * FROM tbl WHERE name = %(  name  )s")
		    ['name']

		    >>> SQLBuilder.extract_placeholders(
		    ...     "SELECT * FROM tbl WHERE name = %(name)s AND status IN %(statuses)s"
		    ... )
		    ['name', 'statuses']
		"""
		# Match %(  name  )s with optional whitespace around the name
		pattern = re.compile(r"%\(\s*(\w+)\s*\)s")
		matches = pattern.findall(sql)

		if unique:
			# Preserve order while removing duplicates
			seen = set()
			result = []
			for name in matches:
				if name not in seen:
					seen.add(name)
					result.append(name)
			return result

		return matches

	# ------------------------------------------------------------------ #
	#  Value Formatting
	# ------------------------------------------------------------------ #

	@staticmethod
	def format_value(val: Any) -> str | None:
		"""Convert a Python value to its SQL literal representation."""
		if val is None:
			return "NULL"
		if isinstance(val, bool):
			return "1" if val else "0"
		if isinstance(val, (int | float)):
			return str(val)
		if isinstance(val, (list | tuple)):
			if not val:
				return None
			return "({})".format(", ".join(SQLBuilder.format_value(v) for v in val))
		return "'{}'".format(str(val).replace("'", "''"))

	# ------------------------------------------------------------------ #
	#  User Permission Handling
	# ------------------------------------------------------------------ #

	@staticmethod
	def _get_frappe():
		"""Import frappe lazily so the class works outside Frappe too."""
		try:
			import frappe

			return frappe
		except ImportError:
			return None

	# SQL keywords that should never be treated as table aliases
	_SQL_KEYWORDS = frozenset(
		{
			"SELECT",
			"FROM",
			"WHERE",
			"AND",
			"OR",
			"ON",
			"AS",
			"JOIN",
			"LEFT",
			"RIGHT",
			"INNER",
			"OUTER",
			"CROSS",
			"FULL",
			"NATURAL",
			"GROUP",
			"ORDER",
			"BY",
			"HAVING",
			"LIMIT",
			"OFFSET",
			"UNION",
			"INSERT",
			"UPDATE",
			"DELETE",
			"SET",
			"INTO",
			"VALUES",
			"IN",
			"NOT",
			"IS",
			"NULL",
			"LIKE",
			"BETWEEN",
			"EXISTS",
			"CASE",
			"WHEN",
			"THEN",
			"ELSE",
			"END",
			"ASC",
			"DESC",
			"DISTINCT",
			"ALL",
			"ANY",
			"SOME",
			"TRUE",
			"FALSE",
			"CREATE",
			"ALTER",
			"DROP",
			"TABLE",
			"INDEX",
			"VIEW",
			"IF",
			"BEGIN",
			"COMMIT",
			"ROLLBACK",
			"WITH",
			"RECURSIVE",
			"OVER",
			"PARTITION",
			"ROWS",
			"RANGE",
			"FETCH",
			"NEXT",
			"FIRST",
			"LAST",
			"ONLY",
		}
	)

	def _extract_tables(self, sql: str) -> list:
		"""
		Extract all Frappe tables and their aliases from the SQL.

		Returns list of dicts:
		    [
		        {"doctype": "Project proposal", "alias": "pp", "table": "`tabProject proposal`"},
		        {"doctype": "Grant", "alias": "g", "table": "`tabGrant`"},
		    ]
		"""
		pattern = re.compile(
			r"`tab([^`]+)`"  # group 1: doctype name inside `tab...`
			r"(?:\s+(?:AS\s+)?"  # optional AS keyword
			r"(\w+))?",  # group 2: alias (optional)
			re.IGNORECASE,
		)

		tables = []
		seen = set()

		for m in pattern.finditer(sql):
			doctype = m.group(1)
			alias = m.group(2)
			table = f"`tab{doctype}`"

			# Don't treat SQL keywords as aliases
			if alias and alias.upper() in self._SQL_KEYWORDS:
				alias = None

			key = (doctype, alias)
			if key in seen:
				continue
			seen.add(key)

			tables.append(
				{
					"doctype": doctype,
					"alias": alias,
					"table": table,
				}
			)

		return tables

	def _get_user_permissions(self) -> dict:
		"""
		Get current user's permissions from Frappe.

		Returns dict like:
		    {
		        "Company": ["My Company LLC"],
		        "Territory": ["India", "Nepal"],
		    }
		"""
		frappe = self._get_frappe()
		if not frappe:
			return {}

		user = self.user or frappe.session.user

		# Admins bypass user permissions
		if user == "Administrator":
			return {}

		try:
			user_perms = frappe.permissions.get_user_permissions(user=user)
		except Exception:
			return {}

		# Flatten to {doctype: [list of allowed doc names]}
		result = {}
		for doctype, perm_list in user_perms.items():
			if isinstance(perm_list, list):
				values = []
				for p in perm_list:
					if isinstance(p, dict) and "doc" in p:
						values.append(p["doc"])
					elif isinstance(p, str):
						values.append(p)
				if values:
					result[doctype] = values

		return result

	def _get_doctype_link_fields(self, doctype: str) -> dict:
		"""
		Get Link fields for a doctype that map to user-permission-controlled doctypes.

		Returns dict: {linked_doctype: fieldname}
		    e.g. {"Company": "company", "Territory": "territory"}
		"""
		frappe = self._get_frappe()
		if not frappe:
			return {}

		try:
			meta = frappe.get_meta(doctype)
		except Exception:
			return {}

		link_fields = {}
		for field in meta.fields:
			if field.fieldtype == "Link" and field.options:
				link_fields[field.options] = field.fieldname

		return link_fields

	def _get_applicable_conditions(self, doctype: str, user_perms: dict) -> list:
		"""
		For a given doctype, determine which user permission conditions apply.

		Returns list of dicts:
		    [
		        {"fieldname": "company", "values": ["My Company"]},
		        {"fieldname": "territory", "values": ["India", "Nepal"]},
		    ]
		"""
		frappe = self._get_frappe()
		if not frappe:
			return []

		link_fields = self._get_doctype_link_fields(doctype)
		conditions = []

		for perm_doctype, allowed_values in user_perms.items():
			# Case 1: User permission on the doctype itself
			#         e.g. user permission on "Project" → filter `tabProject`.name
			if perm_doctype == doctype:
				conditions.append(
					{
						"fieldname": "name",
						"values": allowed_values,
					}
				)

			# Case 2: Doctype has a Link field to the permission-controlled doctype
			#         e.g. `tabProject`.company is a Link to "Company"
			elif perm_doctype in link_fields:
				conditions.append(
					{
						"fieldname": link_fields[perm_doctype],
						"values": allowed_values,
					}
				)

		return conditions

	def _build_permission_clause(self, table_ref: str, conditions: list) -> str:
		"""Build a SQL clause string from permission conditions."""
		clauses = []

		for cond in conditions:
			field = f"{table_ref}.{cond['fieldname']}"
			values = cond["values"]

			if len(values) == 1:
				escaped = self.format_value(values[0])
				clauses.append(f"{field} = {escaped}")
			else:
				escaped_list = ", ".join(self.format_value(v) for v in values)
				clauses.append(f"{field} IN ({escaped_list})")

		return " AND ".join(clauses)

	def _inject_user_permissions(self, sql: str) -> str:
		"""
		Main method: parse tables from SQL, check user permissions,
		and inject WHERE/AND conditions.
		"""
		frappe = self._get_frappe()
		if not frappe:
			return sql

		user_perms = self._get_user_permissions()
		if not user_perms:
			return sql

		tables = self._extract_tables(sql)
		if not tables:
			return sql

		permission_clauses = []

		for table_info in tables:
			doctype = table_info["doctype"]
			alias = table_info["alias"]
			table_ref = alias if alias else table_info["table"]

			conditions = self._get_applicable_conditions(doctype, user_perms)
			if conditions:
				clause = self._build_permission_clause(table_ref, conditions)
				permission_clauses.append(clause)

		if not permission_clauses:
			return sql

		perm_sql = " AND ".join(f"({c})" for c in permission_clauses)
		sql = self._append_conditions(sql, perm_sql)

		return sql

	def _append_conditions(self, sql: str, conditions: str) -> str:
		"""
		Smartly append permission conditions to the SQL.

		- SQL with existing WHERE → append with AND
		- SQL without WHERE → inject WHERE before ORDER BY / GROUP BY / LIMIT / end
		"""
		where_pos = self._find_top_level_where(sql)

		if where_pos != -1:
			insert_pos = self._find_clause_end(sql, where_pos)
			before = sql[:insert_pos].rstrip()
			after = sql[insert_pos:]
			separator = "\n" if "\n" in sql else " "
			return f"{before} AND {conditions}{separator}{after.lstrip()}"
		else:
			insert_pos = self._find_insert_point(sql)
			before = sql[:insert_pos].rstrip()
			after = sql[insert_pos:]
			separator = "\n" if "\n" in sql else " "
			return f"{before}\nWHERE {conditions}{separator}{after.lstrip()}"

	def _find_top_level_where(self, sql: str) -> int:
		"""Find position of last top-level WHERE (ignores subqueries)."""
		depth = 0
		last_where = -1
		upper_sql = sql.upper()
		i = 0

		while i < len(sql):
			if sql[i] == "(":
				depth += 1
			elif sql[i] == ")":
				depth -= 1
			elif depth == 0 and upper_sql[i : i + 5] == "WHERE":
				before_ok = i == 0 or not upper_sql[i - 1].isalnum()
				after_ok = i + 5 >= len(sql) or not upper_sql[i + 5].isalnum()
				if before_ok and after_ok:
					last_where = i
			i += 1

		return last_where

	def _find_clause_end(self, sql: str, where_pos: int) -> int:
		"""Find where the WHERE clause ends (before GROUP BY, ORDER BY, LIMIT, etc.)."""
		keywords = ["GROUP BY", "HAVING", "ORDER BY", "LIMIT", "UNION"]
		upper_sql = sql.upper()
		depth = 0
		i = where_pos + 5

		while i < len(sql):
			if sql[i] == "(":
				depth += 1
			elif sql[i] == ")":
				depth -= 1
			elif depth == 0:
				for kw in keywords:
					if upper_sql[i : i + len(kw)] == kw:
						before_ok = i == 0 or not upper_sql[i - 1].isalnum()
						after_ok = i + len(kw) >= len(sql) or not upper_sql[i + len(kw)].isalnum()
						if before_ok and after_ok:
							return i
			i += 1

		return len(sql)

	def _find_insert_point(self, sql: str) -> int:
		"""Find where to insert a WHERE clause if none exists."""
		keywords = ["GROUP BY", "HAVING", "ORDER BY", "LIMIT", "UNION"]
		upper_sql = sql.upper()
		depth = 0

		for i in range(len(sql)):
			if sql[i] == "(":
				depth += 1
			elif sql[i] == ")":
				depth -= 1
			elif depth == 0:
				for kw in keywords:
					if upper_sql[i : i + len(kw)] == kw:
						before_ok = i == 0 or not upper_sql[i - 1].isalnum()
						after_ok = i + len(kw) >= len(sql) or not upper_sql[i + len(kw)].isalnum()
						if before_ok and after_ok:
							return i

		return len(sql)

	# ------------------------------------------------------------------ #
	#  Placeholder Replacers
	# ------------------------------------------------------------------ #

	def _get(self, key: str) -> Any:
		return self.params.get(key, self._MISSING)

	def _replace_in(self, sql: str) -> str:
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+IN|IN)\s*\(?\s*%\(\s*(\w+)\s*\)s(?:\s*\))?",
			re.IGNORECASE,
		)

		def _handler(m):
			column, operator, key = m.group(1), m.group(2).upper(), m.group(3)
			val = self._get(key)
			if val is self._MISSING:
				return "1=1"
			if not isinstance(val, (list | tuple)):
				val = [val]
			if not val:
				return "1=1"
			formatted = ", ".join(self.format_value(v) for v in val)
			return f"{column} {operator} ({formatted})"

		return pattern.sub(_handler, sql)

	def _replace_between(self, sql: str) -> str:
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+BETWEEN|BETWEEN)\s+%\(\s*(\w+)\s*\)s\s+AND\s+%\(\s*(\w+)\s*\)s",
			re.IGNORECASE,
		)

		def _handler(m):
			column, op = m.group(1), m.group(2)
			key1, key2 = m.group(3), m.group(4)
			val1, val2 = self._get(key1), self._get(key2)
			if val1 is self._MISSING or val2 is self._MISSING:
				return "1=1"
			return f"{column} {op} {self.format_value(val1)} AND {self.format_value(val2)}"

		return pattern.sub(_handler, sql)

	def _replace_like(self, sql: str) -> str:
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+LIKE|LIKE)\s+%\(\s*(\w+)\s*\)s",
			re.IGNORECASE,
		)

		def _handler(m):
			column, op, key = m.group(1), m.group(2), m.group(3)
			val = self._get(key)
			if val is self._MISSING:
				return "1=1"
			return f"{column} {op} {self.format_value(val)}"

		return pattern.sub(_handler, sql)

	def _replace_comparison(self, sql: str) -> str:
		pattern = re.compile(
			r"(\S+)\s*(!=|<>|<=|>=|=|<|>)\s*%\(\s*(\w+)\s*\)s",
		)

		def _handler(m):
			column, op, key = m.group(1), m.group(2), m.group(3)
			val = self._get(key)
			if val is self._MISSING:
				return "1=1"
			formatted = self.format_value(val)
			if formatted == "NULL":
				if op == "=":
					return f"{column} IS NULL"
				if op in ("!=", "<>"):
					return f"{column} IS NOT NULL"
			return f"{column} {op} {formatted}"

		return pattern.sub(_handler, sql)

	def _replace_remaining(self, sql: str) -> str:
		pattern = re.compile(r"%\(\s*(\w+)\s*\)s")

		def _handler(m):
			key = m.group(1)
			val = self._get(key)
			if val is self._MISSING:
				return "NULL"
			return self.format_value(val)

		return pattern.sub(_handler, sql)
