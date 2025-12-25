import json

import frappe
from frappe import _
from frappe.utils import fmt_money


class Chart:
	@staticmethod
	def chart_settings(settings) -> list[dict]:
		"""Process and return visible charts with their details."""
		visible_charts = [chart for chart in settings.charts if chart.is_visible]
		updated_charts = []

		for chart in visible_charts:
			if not frappe.db.exists("Dashboard Chart", chart.dashboard_chart):
				continue
			chart_details = frappe.get_cached_doc("Dashboard Chart", chart.dashboard_chart)
			chart["details"] = chart_details

			if chart.details.chart_type == "Report":
				chart["report"] = (
					frappe.get_cached_doc("Report", chart.details.report_name)
					if frappe.db.exists("Report", chart.details.report_name)
					else None
				)

			updated_charts.append(chart)

		return updated_charts

	@staticmethod
	def get_chart_data(
		type: str,
		details: str,
		report: str | None = None,
		doctype: str | None = None,
		docname: str | None = None,
	) -> dict:
		"""Get chart data based on type and parameters."""
		try:
			details = json.loads(details)
			report = json.loads(report) if report else None

			if type == "Report":
				return Chart.chart_report(details, report, doctype, docname)
			elif type == "Document Type":
				return Chart.chart_doc_type(details, doctype, docname)
			else:
				return Chart._get_empty_chart_data(f"Invalid chart type: {type}")
		except Exception as e:
			frappe.log_error(f"Error in get_chart_data: {str(e)}")
			return Chart._get_empty_chart_data(str(e))

	@staticmethod
	def _get_empty_chart_data(message: str = "") -> dict:
		"""Return empty chart data structure."""
		return {"data": {"labels": [], "datasets": [{"data": []}]}, "message": message}

	@staticmethod
	def _get_colors(details: dict) -> list[str]:
		"""Get colors for chart from details."""
		if details.get("custom_options"):
			return list(json.loads(details.get("custom_options")))
		return [x.get("color") for x in details.get("y_axis", [])]

	@staticmethod
	def chart_doc_type(details: dict, doctype: str | None = None, docname: str | None = None) -> dict:
		"""Generate chart data for document type."""
		try:
			filters = Chart._process_filters(json.loads(details.get("filters_json", "[]")))

			if doctype and docname:
				filters.extend(Chart._get_doc_filters(details.get("document_type"), doctype, docname))

			data = frappe.db.get_list(
				details.get("document_type"), filters=filters, fields=["label", "count"]
			)

			return {
				"data": {
					"labels": [x.get("label") for x in data],
					"datasets": [
						{
							"data": [x.get("count") for x in data],
							"backgroundColor": Chart._get_colors(details),
						}
					],
				},
				"message": "Document Type",
			}
		except Exception as e:
			frappe.log_error(f"Error in chart_doc_type: {str(e)}")
			return Chart._get_empty_chart_data(str(e))

	@staticmethod
	def _process_filters(filters: list) -> list:
		"""Clean and process filters."""
		processed_filters = []
		for filter_condition in filters:
			if len(filter_condition) < 3:
				continue

			if isinstance(filter_condition[3], list):
				filter_condition[3] = [x for x in filter_condition[3] if x is not None]
				if not filter_condition[3]:
					continue

			if len(filter_condition) > 4 and filter_condition[4] is False:
				filter_condition.pop(4)

			processed_filters.append(filter_condition)

		return processed_filters

	@staticmethod
	def _get_doc_filters(doc_type: str, doctype: str, docname: str) -> list:
		"""Get document filters based on doctype and docname."""
		filters = []
		meta = frappe.get_meta(doc_type)

		if not meta.fields:
			return filters

		# Check for direct link field
		direct_link_field = next(
			(
				x
				for x in meta.fields
				if x.fieldtype == "Link" and x.options == doctype and x.fieldname not in ["amended_form"]
			),
			None,
		)
		if direct_link_field:
			filters.append([doc_type, direct_link_field.fieldname, "=", docname])

		# Check for reference fields
		reference_dt_field = next(
			(x for x in meta.fields if x.fieldtype == "Link" and x.options == "DocType"), None
		)
		if reference_dt_field:
			reference_dn_field = next(
				(
					x
					for x in meta.fields
					if x.fieldtype == "Dynamic Link" and x.options == reference_dt_field.fieldname
				),
				None,
			)
			if reference_dn_field:
				filters.extend(
					[
						[doc_type, reference_dt_field.fieldname, "=", doctype],
						[doc_type, reference_dn_field.fieldname, "=", docname],
					]
				)

		return filters

	@staticmethod
	def chart_report(
		details: dict, report: dict | None = None, doctype: str | None = None, docname: str | None = None
	) -> dict:
		"""Generate chart data for report type."""
		try:
			if not report:
				return Chart._get_empty_chart_data("Report not found.")
			chart_data = Chart._get_empty_chart_data("No data available.")
			if report.get("report_type") == "Query Report" and report.get("query"):
				conditions = "WHERE 1=1"
				if (doctype and docname) and doctype != docname:
					for f in report.get("columns", []):
						if f.get("fieldtype") == "Link" and f.get("options") == doctype:
							conditions += f" AND t.{f.get('fieldname')} = '{docname}'"

				query = f"""
                    SELECT
                        t.*
                    FROM
                        ({report.get('query')}) AS t {conditions}
                """

				data = frappe.db.sql(query, as_dict=True)
				columns = report.get("columns", [])

				if details.get("type") in ["Bar", "Line"]:
					chart_data = Chart.process_response_for_bar_or_line_chart(details, data, columns)

			if report.get("report_type") == "Script Report":
				from frappe.desk.query_report import run

				response = run(report.get("name"), filters={})
				data = response.get("result", [])
				columns = response.get("columns", [])
				data = Chart.filter_script_report_data(data, columns, doctype, docname)

				if details.get("type") in ["Bar", "Line"]:
					chart_data = Chart.process_response_for_bar_or_line_chart(details, data, columns)

			return chart_data

		except Exception as e:
			frappe.log_error(f"Error in chart_report: {str(e)}")
			return Chart._get_empty_chart_data(str(e))

	@staticmethod
	def process_response_for_bar_or_line_chart(chart_doc, data, columns):
		y_axis_columns = chart_doc.get("y_axis", [])
		data_sets = []
		labels = []
		data_sets_map = {}

		for y_axis in y_axis_columns:
			y_field = y_axis.get("y_field")
			_type = (y_axis.get("custom_type") or chart_doc.get("type")).lower()
			_label = y_axis.get("custom_label") or next(
				(col.get("label") for col in columns if col.get("fieldname") == y_field),
				y_field,
			)
			data_sets_map[y_field] = {
				"data": [],
				"backgroundColor": y_axis.get("color"),
				"borderColor": y_axis.get("color") if _type == "line" else None,
				"type": _type,
				"label": _label,
			}
			if chart_doc.get("custom_stack") or chart_doc.get("custom_overlap"):
				data_sets_map[y_field]["stack"] = "same"

		labels = []

		# Loop rows
		for row in data:
			row_has_value = False
			row_values = {}

			for y_axis in y_axis_columns:
				y_field = y_axis.get("y_field")

				if isinstance(row, dict):
					value = row.get(y_field)
				else:
					y_idx = next(
						(i for i, col in enumerate(columns) if col.get("fieldname") == y_field),
						None,
					)
					value = row[y_idx] if y_idx is not None else None

				value = value or 0
				row_values[y_field] = value

				if value:
					row_has_value = True

			if not row_has_value:
				continue

			if isinstance(row, dict):
				label = row.get(chart_doc.get("x_field")) or "Unknown"
			else:
				x_idx = next(
					(i for i, col in enumerate(columns) if col.get("fieldname") == chart_doc.get("x_field")),
					None,
				)
				label = row[x_idx] if x_idx is not None else "Unknown"

			labels.append(label)

			for y_field, dataset in data_sets_map.items():
				_field = next((col for col in columns if col.get("fieldname") == y_field), None)
				dataset["data"].append(
					{
						"x": row_values.get(y_field),
						"y": row_values.get(y_field),
						"meta": {**_field, "label": dataset["label"] or _field.get("label") or y_field},
					}
				)

		data_sets = list(data_sets_map.values())

		return {
			"data": {"labels": labels, "datasets": data_sets},
			"message": chart_doc,
		}

	@staticmethod
	def filter_script_report_data(result, columns, dt=None, dn=None):
		"""Filter report data based on document type and name."""
		if not dt or not dn:
			return result

		if dt == dn:
			return result

		primary_link_field = None

		for col in columns:
			if col.get("fieldtype") == "Link" and col.get("options") == dt:
				primary_link_field = col.get("fieldname")
				break
		if not primary_link_field:
			return result
		data = []
		for row in result:
			if isinstance(row, dict):
				if row.get(primary_link_field) == dn:
					data.append(row)
			else:
				idx = None
				for i, col in enumerate(columns):
					if col.get("fieldname") == primary_link_field:
						idx = i
						break
				if idx is not None and row[idx] == dn:
					data.append(row)
		return data
