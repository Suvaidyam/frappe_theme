import re
from typing import Any, Optional


class SQLBuilder:
	"""
	Replaces %(name)s style placeholders in SQL strings with actual values.

	Handles:
	    - Comparison operators: =, !=, <>, <, >, <=, >=
	    - IN / NOT IN (with lists/tuples)
	    - LIKE / NOT LIKE
	    - BETWEEN ... AND ...
	    - IS NULL / IS NOT NULL (when value is None)
	    - Missing/empty params → condition neutralized to 1=1
	    - String escaping (single quotes)
	    - Bool → 1/0
	    - Catch-all for remaining placeholders (e.g. in CASE expressions)

	Usage:
	    builder = SQLBuilder(sql, params)
	    result = builder.build()

	    # or use the class method
	    result = SQLBuilder.apply(sql, params)
	"""

	_MISSING = object()

	def __init__(self, sql: str, params: dict | None = None):
		self.sql = sql
		self.params = params or {}

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
		return sql

	@classmethod
	def apply(cls, sql: str, params: dict | None = None) -> str:
		"""Shortcut: build SQL in one call."""
		return cls(sql, params).build()

	# ------------------------------------------------------------------ #
	#  Value Formatting
	# ------------------------------------------------------------------ #

	@staticmethod
	def format_value(val: Any) -> str | None:
		"""
		Convert a Python value to its SQL literal representation.

		Returns None for empty lists (signal to caller).
		"""
		if val is None:
			return "NULL"
		if isinstance(val, bool):
			return "1" if val else "0"
		if isinstance(val, (int | float)):
			return str(val)
		if isinstance(val, (list | tuple)):
			if not val:
				return None  # empty list signal
			return "({})".format(", ".join(SQLBuilder.format_value(v) for v in val))
		# Default: string
		return "'{}'".format(str(val).replace("'", "''"))

	# ------------------------------------------------------------------ #
	#  Internal Replacers
	# ------------------------------------------------------------------ #

	def _get(self, key: str) -> Any:
		"""Retrieve param value or return _MISSING sentinel."""
		return self.params.get(key, self._MISSING)

	def _replace_in(self, sql: str) -> str:
		"""Handle IN / NOT IN clauses."""
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+IN|IN)\s*\(?\s*%\((\w+)\)s(?:\s*\))?",
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
		"""Handle BETWEEN ... AND ... clauses."""
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+BETWEEN|BETWEEN)\s+%\((\w+)\)s\s+AND\s+%\((\w+)\)s",
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
		"""Handle LIKE / NOT LIKE clauses."""
		pattern = re.compile(
			r"(\S+)\s+(NOT\s+LIKE|LIKE)\s+%\((\w+)\)s",
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
		"""Handle =, !=, <>, <, >, <=, >= operators."""
		pattern = re.compile(
			r"(\S+)\s*(!=|<>|<=|>=|=|<|>)\s*%\((\w+)\)s",
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
		"""Catch-all for any remaining %(key)s placeholders (e.g. in CASE, SELECT)."""
		pattern = re.compile(r"%\((\w+)\)s")

		def _handler(m):
			key = m.group(1)
			val = self._get(key)

			if val is self._MISSING:
				return "NULL"

			return self.format_value(val)

		return pattern.sub(_handler, sql)
