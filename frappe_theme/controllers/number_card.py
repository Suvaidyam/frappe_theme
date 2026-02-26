import json

import frappe

from .filters import DTFilters


class NumberCard:
	# Consolidated function mappings
	AGGREGATE_FUNCTIONS = {
		"Sum": "SUM",
		"Average": "AVG",
		"Minimum": "MIN",
		"Maximum": "MAX",
		"Count": "COUNT",
	}

	@staticmethod
	def check_card_permissions_and_settings(number_card_name: str) -> dict:
		"""Check if the user has permission to view the number card."""
		response = {"permitted": False, "number_card": None, "report": None, "message": ""}
		try:
			if not frappe.has_permission("Number Card", "read", number_card_name):
				response["message"] = "You do not have permission to view this Number Card"
				return response
			if not frappe.db.exists("Number Card", number_card_name):
				response["message"] = "Number Card does not exist"
				return response
			number_card = frappe.get_cached_doc("Number Card", number_card_name)
			response["number_card"] = number_card
			if number_card.type == "Report" and number_card.report_name:
				if not frappe.db.exists("Report", number_card.report_name):
					response["message"] = "Report does not exist"
					return response
				report = frappe.get_cached_doc("Report", number_card.report_name)
				response["report"] = report
				response["permitted"] = True if report.is_permitted() else False
			elif number_card.type == "Document Type":
				response["permitted"] = (
					True if frappe.has_permission(number_card.document_type, "read") else False
				)
			return response
		except Exception as e:
			frappe.log_error(f"Error in check_card_permissions: {str(e)}")
			response["message"] = f"Error checking permissions: {str(e)}"
			return response

	@staticmethod
	def number_card_settings(settings) -> list[dict]:
		"""Get visible number cards with their details."""
		try:
			visible_cards = [card for card in settings.number_cards if card.is_visible]
			updated_cards = []

			for card in visible_cards:
				if card.fetch_from == "DocField":
					updated_cards.append(card)
				else:
					if not frappe.db.exists("Number Card", card.number_card):
						continue

					card_details = frappe.get_cached_doc("Number Card", card.number_card)
					card["details"] = card_details

					if card_details.type == "Report" and card_details.report_name:
						if frappe.db.exists("Report", card_details.report_name):
							card["report"] = frappe.get_cached_doc("Report", card_details.report_name)
						else:
							card["report"] = None
					elif card_details.type == "Document Type":
						card["report"] = None

					updated_cards.append(card)

			return updated_cards
		except Exception as e:
			frappe.log_error(f"Error in number_card_settings: {str(e)}")
			return []

	@staticmethod
	def get_number_card_count(
		type: str,
		details: str,
		report: dict | None = None,
		doctype: str | None = None,
		docname: str | None = None,
		filters: dict | list | None = None,
	) -> dict:
		"""Get count based on card type."""
		try:
			if isinstance(details, str):
				details = json.loads(details or "{}")
			if isinstance(report, str):
				report = json.loads(report or "{}")
			if type == "Report":
				return NumberCard.card_type_report(details, report, doctype, docname, filters)
			elif type == "Document Type":
				return NumberCard.card_type_doctype(details, doctype, docname, filters)
			return {"count": 0, "message": "Invalid type", "column": {"fieldtype": "Int"}}
		except Exception as e:
			frappe.log_error(f"Error in get_number_card_count: {str(e)}")
			return {
				"count": 0,
				"message": f"Error from get_number_card_count : {str(e)}",
				"column": {"fieldtype": "Int"},
			}

	@staticmethod
	def card_type_report(
		details: dict,
		report: dict | None = None,
		doctype: str | None = None,
		docname: str | None = None,
		filters: dict | list | None = None,
	) -> dict:
		"""Handle report type number cards."""
		try:
			if report:
				report = frappe.get_cached_doc("Report", report.get("name"))
			outer_filters, inner_filters, not_applied_filters = DTFilters.get_report_filters(
				report, filters, doctype
			)
			filters_json = frappe.parse_json(details.get("filters_json") or "{}")
			if report.get("report_type") == "Script Report":
				from frappe.desk.query_report import run

				column = {"fieldtype": "Int"}
				report_data = run(
					report.get("name"), filters={**inner_filters, **filters_json}, ignore_prepared_report=True
				)
				if report_data and report_data.get("result"):
					if details.get("report_function"):
						function = NumberCard.AGGREGATE_FUNCTIONS.get(details.get("report_function"))
						field_name = details.get("report_field")
						matching_link_field = None
						if doctype and docname:
							if doctype != docname and report_data.get("columns"):
								matching_link_field = next(
									(
										col
										for col in report_data.get("columns")
										if col.get("fieldtype") == "Link" and col.get("options") == doctype
									),
									None,
								)

						report_field_column = next(
							(col for col in report_data.get("columns") if col.get("fieldname") == field_name),
							None,
						)
						if report_field_column:
							column = report_field_column

						values = []
						for row in report_data.get("result"):
							if isinstance(row, dict):
								if matching_link_field:
									if row.get(matching_link_field.get("fieldname")) != docname:
										continue

								values.append(row.get(field_name))
							else:
								if matching_link_field:
									if row[report_data.get("columns").index(matching_link_field)] != docname:
										continue
								index = report_data.get("columns").index(
									next(
										col
										for col in report_data.get("columns")
										if col.get("fieldname") == field_name
									)
								)
								values.append(row[index])

						if function == "SUM":
							count = sum(values) or 0
						elif function == "AVG":
							count = sum(values) / len(values) if values else 0
						elif function == "MIN":
							count = min(values) if values else 0
						elif function == "MAX":
							count = max(values) if values else 0
						elif function == "COUNT":
							count = len(values) or 0
						else:
							return {"count": 0, "message": "Invalid function", "column": column}
				return {"count": count, "message": "Script Report Response", "column": column}
			elif report.get("report_type") == "Query Report":
				column = {"fieldtype": "Int"}
				# Find the column details
				for f in report.get("columns", []):
					if details.get("report_field") == f.get("fieldname"):
						column = f
						break
				executable_query = report.execute_query_report(
					outer_filters=outer_filters,
					filters={**filters_json, **inner_filters},
					ref_doctype=doctype,
					ref_docname=docname,
					unfiltered=0,
					return_query=True,
				)
				field_name = details.get("report_field")
				function = NumberCard.AGGREGATE_FUNCTIONS.get(details.get("report_function"))
				if not function:
					return {"count": 0, "message": "Invalid function", "column": column}

				query = f"SELECT {function}(t.{field_name}) AS count FROM ({executable_query}) AS t"
				count = frappe.db.sql(query, {**filters_json, **inner_filters}, as_dict=True)

				return {
					"count": count[0].get("count") if count else 0,
					"message": "Query Report Response",
					"column": column,
				}
			return {"count": 0, "message": "Invalid report type", "column": {"fieldtype": "Int"}}
		except Exception as e:
			frappe.log_error(f"Error in card_type_report: {str(e)}")
			return {"count": 0, "message": str(e), "column": {"fieldtype": "Int"}}

	@staticmethod
	def card_type_doctype(
		details: dict,
		doctype: str | None = None,
		docname: str | None = None,
		filters: dict | list | None = None,
	) -> dict:
		"""Handle document type number cards."""
		try:
			column = {"fieldtype": "Int"}
			_filters = json.loads(details.get("filters_json", "[]"))
			valid_filters, invalid_filters = {}, []
			# Clean up filters
			_filters = [
				f
				for f in _filters
				if f and len(f) >= 4 and (not isinstance(f[3], list) or any(x is not None for x in f[3]))
			]

			# Remove false from filter conditions
			_filters = [_f[:-1] if len(_f) > 4 and _f[4] is False else _f for _f in _filters]

			if isinstance(filters, str):
				filters = json.loads(filters or "{}")
			if filters:
				valid_filters, invalid_filters = DTFilters.validate_doctype_filters(
					doctype, docname, filters, details.get("document_type")
				)
				if isinstance(valid_filters, dict):
					for key, value in valid_filters.items():
						if isinstance(value, list):
							operator = value[0]
							val = value[1]
							_filters.append([details.get("document_type"), key, operator, val])
						else:
							_filters.append([details.get("document_type"), key, "=", value])
				elif isinstance(valid_filters, list):
					_filters.extend(valid_filters)

			meta = frappe.get_meta(details.get("document_type"))
			if doctype and docname and doctype != docname:
				if meta.fields:
					# Add direct link field filter
					direct_link = next(
						(
							x
							for x in meta.fields
							if x.fieldtype == "Link"
							and x.options == doctype
							and x.fieldname not in ["amended_form"]
						),
						None,
					)
					if direct_link:
						_filters.append(
							[details.get("document_type"), direct_link.get("fieldname"), "=", docname]
						)

					# Add reference field filters
					ref_dt = next(
						(x for x in meta.fields if x.fieldtype == "Link" and x.options == "DocType"), None
					)
					if ref_dt:
						ref_dn = next(
							(
								x
								for x in meta.fields
								if x.fieldtype == "Dynamic Link" and x.options == ref_dt.get("fieldname")
							),
							None,
						)
						if ref_dn:
							_filters.extend(
								[
									[details.get("document_type"), ref_dt.get("fieldname"), "=", doctype],
									[details.get("document_type"), ref_dn.get("fieldname"), "=", docname],
								]
							)

			function = details.get("function")
			if function == "Count":
				count = frappe.db.count(details.get("document_type"), filters=_filters)
			else:
				agg_function = NumberCard.AGGREGATE_FUNCTIONS.get(function)
				if not agg_function:
					return {
						"count": 0,
						"message": "Invalid function",
						"column": {"fieldtype": "Int"},
						"valid_filters": valid_filters,
						"invalid_filters": invalid_filters,
					}
				count_column = next(
					(f for f in meta.fields if f.fieldname == details.get("aggregate_function_based_on")),
					None,
				)
				if count_column:
					column = count_column

				count = frappe.db.get_value(
					details.get("document_type"),
					filters,
					[{agg_function: details.get("aggregate_function_based_on")}],
				)

			return {
				"count": count or 0,
				"message": "DocType Number Card Response",
				"column": column,
				"valid_filters": valid_filters,
				"invalid_filters": invalid_filters,
			}
		except Exception as e:
			frappe.log_error(f"Error in card_type_doctype: {str(e)}")
			return {
				"count": 0,
				"message": str(e),
				"column": {"fieldtype": "Int"},
				"valid_filters": None,
				"invalid_filters": [],
			}
