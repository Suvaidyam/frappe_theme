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
					f.as_dict()
					for f in target_fields
					if f.get("fieldtype") == "Link" and f.get("options") == _field.get("options")
				),
				None,
			)

		return None

	@staticmethod
	def get_report_filters(report, client_filters, dt):
		if dt:
			# Ensure client filters are in dict format
			if isinstance(client_filters, str):
				client_filters = json.loads(client_filters)
			if client_filters is None:
				client_filters = {}

			meta = frappe.get_meta(dt, True)
			outer_filters = {}
			inner_filters = {}
			not_applied_filters = []
			if meta.get("is_dashboard") != 1:
				outer_filters = client_filters
				return outer_filters, inner_filters, not_applied_filters

			report_filters = report.get("filters", [])
			report_columns = report.get("columns", [])
			client_filters_keys = list(client_filters.keys())
			fields = [
				{
					"fieldname": f.get("fieldname"),
					"fieldtype": f.get("fieldtype"),
					"options": f.get("options"),
				}
				for f in meta.get("fields", [])
				if (
					f.get("fieldtype") in ["Link", "Table MultiSelect"]
					and f.get("fieldname") in client_filters_keys
				)
			]

			for key in client_filters_keys:
				field = next((f for f in fields if f.get("fieldname") == key), None)
				if field:
					matching_column_link_field = DTFilters.get_matching_link_field(field, report_columns)
					if matching_column_link_field:
						outer_filters[matching_column_link_field.get("fieldname")] = client_filters[key]

					matching_filter_link_field = DTFilters.get_matching_link_field(field, report_filters)
					if matching_filter_link_field:
						if (
							client_filters[key]
							and isinstance(client_filters[key], list)
							and len(client_filters[key]) > 1
							and client_filters[key][0] in OPERATORS
						):
							inner_filters[matching_filter_link_field.get("fieldname")] = client_filters[key][
								1
							]
						else:
							inner_filters[matching_filter_link_field.get("fieldname")] = client_filters[key]
					if not (matching_column_link_field or matching_filter_link_field):
						not_applied_filters.append(key)
				else:
					mathing_column_field = next(
						(f for f in report_columns if f.get("fieldname") == key), None
					)
					mathing_filter_field = next(
						(f for f in report_filters if f.get("fieldname") == key), None
					)
					if mathing_column_field:
						outer_filters[mathing_column_field.get("fieldname")] = client_filters[key]
					if mathing_filter_field:
						if (
							client_filters[key]
							and isinstance(client_filters[key], list)
							and len(client_filters[key]) > 1
							and client_filters[key][0] in OPERATORS
						):
							inner_filters[mathing_filter_field.get("fieldname")] = client_filters[key][1]
						else:
							inner_filters[mathing_filter_field.get("fieldname")] = client_filters[key]
					if not (mathing_column_field or mathing_filter_field):
						not_applied_filters.append(key)
			return outer_filters, inner_filters, not_applied_filters

	@staticmethod
	def get_conf_for_multi_slect_link_field(child_doctype):
		child_meta = frappe.get_meta(child_doctype)
		return next((f.as_dict() for f in child_meta.fields if f.fieldtype == "Link" and not f.hidden), None)

	@staticmethod
	def process_link_fields_as_filters(
		base_fields, filter_field, base_doctype, filters, key, valid_filters, invalid_filters
	):
		relevant_field_from_base = next(
			(f.as_dict() for f in base_fields if f.get("options") == filter_field.get("options")), None
		)
		if isinstance(filter_field, str):
			filter_field = frappe.parse_json(filter_field or "{}")
		if not relevant_field_from_base:
			if filter_field.get("options") == base_doctype:
				if isinstance(filters[key], list):
					valid_filters["name"] = [
						"in",
						[v.get(filter_field.get("fieldname")) for v in filters[key]],
					]
				else:
					valid_filters["name"] = filters[key]
			else:
				ref_dt = next(
					(x for x in base_fields if x.fieldtype == "Link" and x.options == "DocType"), None
				)
				if ref_dt:
					ref_dn = next(
						(
							x
							for x in base_fields
							if x.fieldtype == "Dynamic Link" and x.options == ref_dt.get("fieldname")
						),
						None,
					)
					if ref_dn:
						if isinstance(filters, list):
							valid_filters.append(
								[base_doctype, ref_dt.get("fieldname"), "=", filter_field.get("options")]
							)
							if isinstance(filters[key], list):
								valid_filters.append(
									[
										base_doctype,
										ref_dn.get("fieldname"),
										"in",
										[v.get(filter_field.get("fieldname")) for v in filters[key]],
									]
								)
							else:
								valid_filters.append(
									[base_doctype, ref_dn.get("fieldname"), "=", filters[key]]
								)
						else:
							valid_filters[ref_dt.get("fieldname")] = filter_field.get("options")
							if isinstance(filters[key], list):
								valid_filters[ref_dn.get("fieldname")] = [
									"in",
									[v.get(filter_field.get("fieldname")) for v in filters[key]],
								]
							else:
								valid_filters[ref_dn.get("fieldname")] = filters[key]
					else:
						invalid_filters.append(filter_field)
				else:
					invalid_filters.append(filter_field)
					return
		else:
			if isinstance(filters, list):
				for f in filters:
					if f[1] == key:
						f[1] = relevant_field_from_base.get("fieldname")
						if isinstance(f[3], list):
							f[2] = "in"
							f[3] = [v.get(filter_field.get("fieldname")) for v in f[3]]
						valid_filters.append(f)
			else:
				if isinstance(filters[key], list):
					valid_filters[relevant_field_from_base.get("fieldname")] = [
						"in",
						[v.get(filter_field.get("fieldname")) for v in filters[key]],
					]
				else:
					valid_filters[relevant_field_from_base.get("fieldname")] = filters[key]
