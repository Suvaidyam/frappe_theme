import json

import frappe
from frappe import _


class Chart:
	@staticmethod
	def chart_settings(settings) -> list[dict]:
		"""Process and return visible charts with their details."""
		visible_charts = [chart for chart in settings.charts if chart.is_visible]
		updated_charts = []

		for chart in visible_charts:
			if not frappe.db.exists("Dashboard Chart", chart.chart_label):
				continue

			chart_details = frappe.get_cached_doc("Dashboard Chart", chart.chart_label)
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
			if not report or not report.get("query"):
				return Chart._get_empty_chart_data("Invalid report configuration")

			y_axis = details.get("y_axis", [])
			y_field = y_axis[0].get("y_field") if y_axis else None
			if not y_field:
				return Chart._get_empty_chart_data("Invalid chart configuration")

			conditions = "WHERE 1=1"
			for f in report.get("columns", []):
				if f.get("fieldtype") == "Link" and f.get("options") == doctype:
					conditions += f" AND t.{f.get('fieldname')} = '{docname}'"

			query = f"""
                SELECT t.{y_field} AS count, t.{details.get('x_field')} AS label
                FROM ({report.get('query')}) AS t {conditions}
            """

			data = frappe.db.sql(query, as_dict=True)

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
				"message": details,
			}
		except Exception as e:
			frappe.log_error(f"Error in chart_report: {str(e)}")
			return Chart._get_empty_chart_data(str(e))
