import json

import frappe

OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "in", "not in", "like", "not like", "between", "not between"]


class DTFilters:
	@staticmethod
	def validate_doctype_filters(doctype, docname, filters, base_doctype=None):
		if not doctype:
			return filters, []
		renderer_dt = frappe.get_meta(doctype, True)
		if renderer_dt.get("is_dashboard") != 1:
			return filters, []

		valid_filters = []
		invalid_filters = []
		if doctype is None or docname is None:
			return filters, []
		if doctype != docname:
			return filters, []
		else:
			if not filters:
				return valid_filters, invalid_filters

			if isinstance(filters, str):
				filters = frappe.parse_json(filters)
			fields = [f.as_dict() for f in renderer_dt.get("fields", [])]
			base_fields = [f.as_dict() for f in frappe.get_meta(base_doctype, True).get("fields", [])]
			if isinstance(filters, dict):
				valid_filters = {}
			if isinstance(filters, list):
				valid_filters = []
			invalid_filters = []
			filter_keys = []
			if isinstance(filters, dict):
				filter_keys = list(filters.keys())
			elif isinstance(filters, list):
				filter_keys = [f[1] for f in filters if len(f) >= 2]

			for key in filter_keys:
				filter_field = next((f.as_dict() for f in fields if f.get("fieldname") == key), None)
				if filter_field.fieldtype == "Link":
					DTFilters.process_link_fields_as_filters(
						base_fields, filter_field, base_doctype, filters, key, valid_filters, invalid_filters
					)
				elif filter_field.fieldtype == "Table MultiSelect":
					first_link_field = DTFilters.get_conf_for_multi_slect_link_field(
						filter_field.get("options")
					)
					DTFilters.process_link_fields_as_filters(
						base_fields,
						first_link_field,
						base_doctype,
						filters,
						key,
						valid_filters,
						invalid_filters,
					)
				else:
					invalid_filters.append(filter_field)
		return valid_filters, invalid_filters

	@staticmethod
	def get_matching_link_field(source_field, target_fields):
		_field = None
		if source_field.get("fieldtype") == "Link":
			_field = source_field
		elif source_field.get("fieldtype") == "Table MultiSelect":
			_field = DTFilters.get_conf_for_multi_slect_link_field(source_field.get("options"))

		if _field:
			return next(
				(
					f
					for f in target_fields
					if f.get("fieldtype") == "Link" and f.get("options") == _field.get("options")
				),
				None,
			)

		return None

	@staticmethod
	def _unwrap_operator_value(value):
		"""If value is an operator expression like ['in', 'foo'], return the operand ('foo').

		Otherwise return the value as-is.
		"""
		if (
			value
			and isinstance(value, list)
			and len(value) > 1
			and value[0] in OPERATORS
		):
			return value[1]
		return value

	@staticmethod
	def get_report_filters(report, client_filters, dt):
		"""Partition client filters into outer (column), inner (report-filter), and not-applied.

		Returns:
			tuple: (outer_filters, inner_filters, not_applied_filters)
		"""
		if not dt:
			return client_filters, {}, []

		if isinstance(client_filters, str):
			client_filters = json.loads(client_filters)
		if client_filters is None:
			client_filters = {}

		meta = frappe.get_meta(dt, True)
		if meta.get("is_dashboard") != 1:
			return client_filters, {}, []

		report_filters = report.get("filters", [])
		report_columns = report.get("columns", [])
		client_filter_keys = list(client_filters.keys())

		# Build a dict for O(1) lookup of Link / Table MultiSelect fields by fieldname
		link_fields_by_name = {
			f.get("fieldname"): {
				"fieldname": f.get("fieldname"),
				"fieldtype": f.get("fieldtype"),
				"options": f.get("options"),
			}
			for f in meta.get("fields", [])
			if (
				f.get("fieldtype") in ["Link", "Table MultiSelect"]
				and f.get("fieldname") in client_filter_keys
			)
		}

		outer_filters = {}
		inner_filters = {}
		not_applied_filters = []

		for key in client_filter_keys:
			value = client_filters[key]
			field = link_fields_by_name.get(key)

			if field:
				matched = DTFilters._match_via_link_field(
					field, value, report_columns, report_filters, outer_filters, inner_filters
				)
			else:
				matched = DTFilters._match_via_fieldname(
					key, value, report_columns, report_filters, outer_filters, inner_filters
				)

			if not matched:
				not_applied_filters.append(key)

		return outer_filters, inner_filters, not_applied_filters

	@staticmethod
	def _match_via_link_field(field, value, report_columns, report_filters, outer_filters, inner_filters):
		"""Resolve a Link / Table MultiSelect field against report columns and filters.

		Returns True if at least one match was found.
		"""
		matching_column = DTFilters.get_matching_link_field(field, report_columns)
		matching_filter = DTFilters.get_matching_link_field(field, report_filters)

		if matching_column:
			outer_filters[matching_column.get("fieldname")] = value
		if matching_filter:
			inner_filters[matching_filter.get("fieldname")] = DTFilters._unwrap_operator_value(value)

		return bool(matching_column or matching_filter)

	@staticmethod
	def _match_via_fieldname(key, value, report_columns, report_filters, outer_filters, inner_filters):
		"""Match a non-link field directly by fieldname against report columns and filters.

		Returns True if at least one match was found.
		"""
		matching_column = next(
			(f for f in report_columns if f.get("fieldname") == key), None
		)
		matching_filter = next(
			(f for f in report_filters if f.get("fieldname") == key), None
		)

		if matching_column:
			outer_filters[matching_column.get("fieldname")] = value
		if matching_filter:
			inner_filters[matching_filter.get("fieldname")] = DTFilters._unwrap_operator_value(value)

		return bool(matching_column or matching_filter)

	@staticmethod
	def get_conf_for_multi_slect_link_field(child_doctype):
		child_meta = frappe.get_meta(child_doctype)
		return next((f.as_dict() for f in child_meta.fields if f.fieldtype == "Link" and not f.hidden), None)

	@staticmethod
	def _extract_filter_value(filters, key, filter_fieldname):
		"""Extract the filter value for a key, unwrapping list-of-dicts into an 'in' clause."""
		value = filters[key]
		if isinstance(value, list):
			return ["in", [v.get(filter_fieldname) for v in value]]
		return value

	@staticmethod
	def process_link_fields_as_filters(
		base_fields, filter_field, base_doctype, filters, key, valid_filters, invalid_filters
	):
		"""Map a dashboard filter field to the corresponding base doctype filter.

		Handles three cases:
		  1. Direct match  – a Link field in base_doctype shares the same target doctype.
		  2. Self-reference – the filter targets the base_doctype itself, so it maps to 'name'.
		  3. Dynamic Link  – the base_doctype has a (Link→DocType + Dynamic Link) pair.

		Mutates `valid_filters` and `invalid_filters` in place.
		"""
		if isinstance(filter_field, str):
			filter_field = frappe.parse_json(filter_field or "{}")

		filter_options = filter_field.get("options")
		filter_fieldname = filter_field.get("fieldname")

		relevant_field_from_base = next(
			(f for f in base_fields if f.get("options") == filter_options), None
		)

		if relevant_field_from_base:
			DTFilters._apply_direct_match(
				relevant_field_from_base, filters, key, filter_fieldname, valid_filters
			)
			return

		if filter_options == base_doctype:
			DTFilters._apply_name_filter(filters, key, filter_fieldname, valid_filters)
			return

		DTFilters._apply_dynamic_link_filter(
			base_fields, filter_field, base_doctype, filters, key, filter_fieldname,
			valid_filters, invalid_filters,
		)

	@staticmethod
	def _apply_direct_match(relevant_field, filters, key, filter_fieldname, valid_filters):
		"""Apply filter when a direct Link field match exists in the base doctype."""
		target_fieldname = relevant_field.get("fieldname")

		if isinstance(filters, list):
			for f in filters:
				if f[1] == key:
					f[1] = target_fieldname
					if isinstance(f[3], list):
						f[2] = "in"
						f[3] = [v.get(filter_fieldname) for v in f[3]]
					valid_filters.append(f)
		else:
			valid_filters[target_fieldname] = DTFilters._extract_filter_value(
				filters, key, filter_fieldname
			)

	@staticmethod
	def _apply_name_filter(filters, key, filter_fieldname, valid_filters):
		"""Map filter to the 'name' field when the filter targets the base doctype."""
		valid_filters["name"] = DTFilters._extract_filter_value(filters, key, filter_fieldname)

	@staticmethod
	def _apply_dynamic_link_filter(
		base_fields, filter_field, base_doctype, filters, key, filter_fieldname,
		valid_filters, invalid_filters,
	):
		"""Resolve filter via a Dynamic Link pair (Link→DocType + Dynamic Link)."""
		filter_options = filter_field.get("options")

		ref_dt_field = next(
			(x for x in base_fields if x.get("fieldtype") == "Link" and x.get("options") == "DocType"),
			None,
		)
		if not ref_dt_field:
			invalid_filters.append(filter_field)
			return

		ref_dn_field = next(
			(
				x for x in base_fields
				if x.get("fieldtype") == "Dynamic Link"
				and x.get("options") == ref_dt_field.get("fieldname")
			),
			None,
		)
		if not ref_dn_field:
			invalid_filters.append(filter_field)
			return

		ref_dt_fieldname = ref_dt_field.get("fieldname")
		ref_dn_fieldname = ref_dn_field.get("fieldname")

		if isinstance(filters, list):
			valid_filters.append([base_doctype, ref_dt_fieldname, "=", filter_options])
			value = filters[key]
			if isinstance(value, list):
				valid_filters.append(
					[base_doctype, ref_dn_fieldname, "in", [v.get(filter_fieldname) for v in value]]
				)
			else:
				valid_filters.append([base_doctype, ref_dn_fieldname, "=", value])
		else:
			valid_filters[ref_dt_fieldname] = filter_options
			valid_filters[ref_dn_fieldname] = DTFilters._extract_filter_value(
				filters, key, filter_fieldname
			)
