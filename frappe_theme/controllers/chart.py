import json

import frappe
from frappe import _
from frappe.desk.doctype.dashboard_chart.dashboard_chart import (
	DashboardChart,
	get_chart_config,
	get_group_by_chart_config,
	get_heatmap_chart_config,
)
from frappe.utils import get_datetime

from frappe_theme.controllers.filters import DTFilters


class Chart:
	@staticmethod
	def check_chart_permissions_and_settings(chart_name: str) -> dict:
		"""Check if the user has permission to view the dashboard chart."""
		response = {"permitted": False, "chart": None, "report": None, "message": ""}
		try:
			if not frappe.has_permission("Dashboard Chart", "read", chart_name):
				response["message"] = "You do not have permission to view this Dashboard Chart"
				return response
			if not frappe.db.exists("Dashboard Chart", chart_name):
				response["message"] = "Dashboard Chart does not exist"
				return response
			chart = frappe.get_cached_doc("Dashboard Chart", chart_name)
			response["chart"] = chart
			if chart.chart_type == "Report" and chart.report_name:
				if not frappe.db.exists("Report", chart.report_name):
					response["message"] = "Report does not exist"
					return response
				report = frappe.get_cached_doc("Report", chart.report_name)
				response["report"] = report
				response["permitted"] = True if report.is_permitted() else False
			elif chart.chart_type == "Document Type":
				response["permitted"] = True if frappe.has_permission(chart.document_type, "read") else False
			return response
		except Exception as e:
			frappe.log_error(f"Error in check_chart_permissions: {str(e)}")
			response["message"] = f"Error checking permissions: {str(e)}"
			return response

	@staticmethod
	def hex_to_rgba(hex_color, alpha=0.2):
		hex_color = hex_color.lstrip("#")

		r = int(hex_color[0:2], 16)
		g = int(hex_color[2:4], 16)
		b = int(hex_color[4:6], 16)

		return f"rgba({r}, {g}, {b}, {alpha})"

	@staticmethod
	def default_colors(length=50) -> list[str]:
		"""Return a list of default colors for charts."""
		my_theme = frappe.get_cached_doc("My Theme", "My Theme").as_dict()
		primary_color = my_theme.get("navbar_color")

		colors = [Chart.lighten_hex(primary_color, amount=0.2)] if primary_color else []
		fallback_colors = [
			"#3498db",
			"#e74c3c",
			"#2ecc71",
			"#9b59b6",
			"#f1c40f",
			"#e67e22",
			"#1abc9c",
			"#34495e",
			"#7f8c8d",
			"#d35400",
			"#27ae60",
			"#8e44ad",
			"#2980b9",
			"#16a085",
			"#2c3e50",
			"#f39c12",
			"#bdc3c7",
			"#95a5a6",
			"#c0392b",
		]
		for i in range(length):
			colors.append(fallback_colors[i % len(fallback_colors)])
		return colors

	@staticmethod
	def lighten_hex(hex_color, amount=0.3):
		"""
		amount: 0 → original color
		        1 → white
		"""
		hex_color = hex_color.lstrip("#")
		r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

		r = int(r + (255 - r) * amount)
		g = int(g + (255 - g) * amount)
		b = int(b + (255 - b) * amount)

		return f"#{r:02x}{g:02x}{b:02x}"

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
		filters: dict | list | None = None,
	) -> dict:
		"""Get chart data based on type and parameters."""
		try:
			details = json.loads(details)
			report = json.loads(report) if report else None

			if type == "Report":
				return Chart.chart_report(details, report, doctype, docname, filters)
			elif type == "Document Type":
				return Chart.chart_doc_type(details, doctype, docname, filters)
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
			return list(json.loads(details.get("custom_options").get("colors", "[]")))
		colors = [x.get("color") for x in details.get("y_axis", [])]
		if not len(colors):
			colors = Chart.default_colors()
		return colors

	@staticmethod
	def chart_doc_type(
		chart_doc: dict, doctype: str | None = None, docname: str | None = None, filters=None
	) -> dict:
		try:
			filters_json = Chart._process_filters(json.loads(chart_doc.get("filters_json", "[]")))
			final_filters = []
			if len(filters_json):
				final_filters.extend(filters_json)
			if doctype and docname:
				final_filters.extend(Chart._get_doc_filters(chart_doc.get("document_type"), doctype, docname))
			valid_filters, invalid_filters = {}, []
			if filters:
				valid_filters, invalid_filters = DTFilters.validate_doctype_filters(
					doctype, docname, filters, chart_doc.get("document_type")
				)
				if len(valid_filters):
					final_filters.extend(valid_filters)

			# Use the core chart generator to respect timespan, intervals, etc.
			chart_config = Chart.get(chart_doc.get("name"), filters=final_filters)

			if not chart_config:
				return Chart._get_empty_chart_data("No data available")

			chart_type = chart_doc.get("type")

			if chart_type in ["Bar", "Line"]:
				colors = Chart._get_colors(chart_doc)
				datasets = []
				_labels = (
					[label if label else "Unknown" for label in chart_config.get("labels", [])]
					if chart_config.get("labels", [])
					else []
				)

				for idx, ds in enumerate(chart_config.get("datasets", [])):
					values = ds.get("values") or ds.get("data") or []
					color = (
						colors[idx % len(colors)]
						if colors
						else Chart.default_colors()[idx % len(Chart.default_colors())]
					)

					dataset = {
						"label": _labels[idx] if idx < len(_labels) else f"Series {idx + 1}",
						"data": values,
						"backgroundColor": color,
						"type": chart_type.lower(),
					}

					if chart_type == "Line":
						dataset["borderColor"] = color
						dataset["fill"] = bool(chart_doc.get("custom_show_area"))
						if chart_doc.get("custom_show_area"):
							dataset["backgroundColor"] = Chart.hex_to_rgba(color)
						if chart_doc.get("custom__curved_area"):
							dataset["tension"] = 0.4
						dataset["pointRadius"] = 3 if chart_doc.get("custom_show_data_points") else 0
					else:
						if chart_doc.get("custom_stack") or chart_doc.get("custom_overlap"):
							dataset["stack"] = "same"

					datasets.append(dataset)

				data = {
					"labels": _labels,
					"datasets": datasets,
				}

				return {"data": data, "message": chart_doc}

			if chart_type in ["Pie", "Donut"]:
				labels = (
					[label if label else "Unknown" for label in chart_config.get("labels", [])]
					if chart_config.get("labels", [])
					else []
				)
				ds_list = chart_config.get("datasets", []) or []

				if not ds_list:
					return Chart._get_empty_chart_data("No dataset available")

				values = ds_list[0].get("values") or ds_list[0].get("data") or []
				pairs = list(zip(labels, values, strict=False))
				pairs.sort(key=lambda x: x[1] or 0, reverse=True)

				max_slices = chart_doc.get("custom_max_slices")
				if max_slices and max_slices > 0 and len(pairs) > max_slices:
					top = pairs[: max_slices - 1]
					others = pairs[max_slices - 1 :]
					others_total = sum(v or 0 for _, v in others)
					if others_total:
						top.append(("Others", others_total))
					pairs = top

				labels = [p[0] for p in pairs]
				values = [p[1] or 0 for p in pairs]

				colors = Chart._get_colors(chart_doc) or Chart.default_colors()

				data = {
					"labels": labels,
					"datasets": [
						{
							"data": values,
							"backgroundColor": colors[: len(values)],
							"borderColor": "#ffffff",
							"borderWidth": 1,
						}
					],
				}

				return {"data": data, "message": chart_doc}

			# For Percentage, Heatmap and other types, return the frappe chart config as-is
			return {
				"data": chart_config,
				"message": chart_doc,
			}
		except Exception as e:
			frappe.log_error(f"Error in chart_doc_type: {str(e)}")
			return Chart._get_empty_chart_data(str(e))

	@frappe.whitelist()
	def get(
		chart_name=None,
		chart=None,
		no_cache=None,
		filters=None,
		from_date=None,
		to_date=None,
		timespan=None,
		time_interval=None,
		heatmap_year=None,
		refresh=None,
	):
		if chart_name:
			chart: DashboardChart = frappe.get_doc("Dashboard Chart", chart_name)
		else:
			chart = frappe._dict(frappe.parse_json(chart))

		heatmap_year = heatmap_year or chart.heatmap_year
		timespan = timespan or chart.timespan

		if timespan == "Select Date Range":
			if from_date and len(from_date):
				from_date = get_datetime(from_date)
			else:
				from_date = chart.from_date

			if to_date and len(to_date):
				to_date = get_datetime(to_date)
			else:
				to_date = get_datetime(chart.to_date)

		timegrain = time_interval or chart.time_interval
		filters = frappe.parse_json(filters) or frappe.parse_json(chart.filters_json)
		if not filters:
			filters = []

		# don't include cancelled documents
		filters.append([chart.document_type, "docstatus", "<", 2])

		if chart.chart_type == "Group By":
			chart_config = get_group_by_chart_config(chart, filters)
		else:
			if chart.type == "Heatmap":
				chart_config = get_heatmap_chart_config(chart, filters, heatmap_year)
			else:
				chart_config = get_chart_config(chart, filters, timespan, timegrain, from_date, to_date)

		return chart_config

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
		if not doctype or not docname:
			return filters
		if doctype == docname:
			return filters

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
		details: dict,
		report: dict | None = None,
		doctype: str | None = None,
		docname: str | None = None,
		filters: (dict | list | None) = None,
	) -> dict:
		"""Generate chart data for report type."""
		try:
			if not report:
				return Chart._get_empty_chart_data("Report not found.")
			chart_data = Chart._get_empty_chart_data("No data available.")
			filters_json = frappe.parse_json(details.get("filters_json") or "{}")
			if report:
				report_doc = frappe.get_doc("Report", report.get("name"))
			outer_filters, inner_filters, not_applied_filters = DTFilters.get_report_filters(
				report, filters, doctype
			)
			if report.get("report_type") == "Query Report" and report.get("query"):
				columns, data = report_doc.execute_query_report(
					outer_filters=outer_filters,
					ref_doctype=doctype,
					ref_docname=docname,
					filters={**filters_json, **inner_filters},
				)

				if details.get("type") in ["Bar", "Line"]:
					chart_data = Chart.process_response_for_bar_or_line_chart(details, data, columns)
				elif details.get("type") in ["Pie", "Donut"]:
					chart_data = Chart.process_response_for_pie_or_donut_chart(details, data, columns)

			if report.get("report_type") == "Script Report":
				from frappe.desk.query_report import run

				response = run(report.get("name"), filters={**filters_json, **inner_filters} or {})
				data = response.get("result", [])
				columns = response.get("columns", [])
				data = Chart.filter_script_report_data(data, columns, doctype, docname)

				if details.get("type") in ["Bar", "Line"]:
					chart_data = Chart.process_response_for_bar_or_line_chart(details, data, columns)
				elif details.get("type") in ["Pie", "Donut"]:
					chart_data = Chart.process_response_for_pie_or_donut_chart(details, data, columns)

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
		default_colors = Chart.default_colors()

		for index, y_axis in enumerate(y_axis_columns):
			y_field = y_axis.get("y_field")
			_type = (y_axis.get("custom_type") or chart_doc.get("type")).lower()
			_label = y_axis.get("custom_label") or next(
				(col.get("label") for col in columns if col.get("fieldname") == y_field),
				y_field,
			)
			data_sets_map[y_field] = {
				"data": [],
				"backgroundColor": y_axis.get("color") or default_colors[index],
				"borderColor": y_axis.get("color") or default_colors[index] if _type == "line" else None,
				"type": _type,
				"label": _label,
			}
			if chart_doc.get("custom_stack") or chart_doc.get("custom_overlap"):
				data_sets_map[y_field]["stack"] = "same"
			if _type == "line":
				data_sets_map[y_field]["pointRadius"] = 0
				if chart_doc.get("custom_show_area"):
					data_sets_map[y_field]["fill"] = True
					data_sets_map[y_field]["backgroundColor"] = Chart.hex_to_rgba(
						y_axis.get("color") or default_colors[index]
					)
				if chart_doc.get("custom_show_data_points"):
					data_sets_map[y_field]["pointRadius"] = 3

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
	def process_response_for_pie_or_donut_chart(chart_doc, data, columns):
		"""Process response data for pie or donut charts.

		Supports two modes:
		- Single dataset (default): Uses first y-axis, creates one pie/donut with color variations
		- Multiple datasets: Uses all y-axis columns, creates concentric rings (set custom_multiple_datasets=True)
		"""
		y_axis_columns = chart_doc.get("y_axis", [])

		if not y_axis_columns:
			return {
				"data": {"labels": [], "datasets": [{"data": []}]},
				"message": "No y-axis configuration found",
			}

		# Check if multiple datasets mode is enabled
		use_multiple_datasets = chart_doc.get("custom_multiple_datasets", False)

		if use_multiple_datasets:
			# Multiple datasets mode: create concentric rings
			return Chart._process_multi_dataset_pie_donut(chart_doc, data, columns, y_axis_columns)
		else:
			# Single dataset mode: use first y-axis with color variations
			return Chart._process_single_dataset_pie_donut(chart_doc, data, columns, y_axis_columns)

	@staticmethod
	def _process_single_dataset_pie_donut(chart_doc, data, columns, y_axis_columns):
		"""Process pie/donut chart with single dataset (color variations per slice)."""
		labels = []
		dataset_values = []
		background_colors = []

		y_axis = y_axis_columns[0]  # Use first y-axis
		y_field = y_axis.get("y_field")
		y_label = y_axis.get("custom_label") or next(
			(col.get("label") for col in columns if col.get("fieldname") == y_field),
			y_field,
		)

		# Collect all data first
		all_data = []
		for row in data:
			# Get the value for y-field
			if isinstance(row, dict):
				value = row.get(y_field)
				label = row.get(chart_doc.get("x_field")) or "Unknown"
			else:
				y_idx = next(
					(i for i, col in enumerate(columns) if col.get("fieldname") == y_field),
					None,
				)
				x_idx = next(
					(i for i, col in enumerate(columns) if col.get("fieldname") == chart_doc.get("x_field")),
					None,
				)
				value = row[y_idx] if y_idx is not None else None
				label = row[x_idx] if x_idx is not None else "Unknown"

			value = value or 0

			# Skip rows with no value
			if not value:
				continue

			all_data.append({"label": label, "value": value})

		# Sort by value in descending order
		all_data.sort(key=lambda x: x["value"], reverse=True)

		# Apply max_slices limit if specified
		max_slices = chart_doc.get("custom_max_slices")
		if max_slices and max_slices > 0 and len(all_data) > max_slices:
			# Keep top N slices
			top_slices = all_data[:max_slices]
			# Group remaining slices as "Others"
			others_slices = all_data[max_slices:]
			others_total = sum(item["value"] for item in others_slices)

			if others_total > 0:
				top_slices.append({"label": "Others", "value": others_total})

			all_data = top_slices

		# Extract labels and values
		labels = [item["label"] for item in all_data]
		dataset_values = [item["value"] for item in all_data]

		# Generate colors for each slice
		base_color = y_axis.get("color") or "#3498db"

		if len(labels) > 1:
			for i in range(len(labels)):
				lightness = 0.1 * i if i < 10 else 0.1 * (i % 10)
				background_colors.append(Chart.lighten_hex(base_color, lightness))
		else:
			background_colors.append(base_color)
		custom_colors = []
		custom_options = chart_doc.get("custom_options")
		if custom_options:
			custom_options = json.loads(custom_options)
			if custom_options.get("colors"):
				custom_colors = custom_options.get("colors")

		if not len(custom_colors):
			custom_colors = Chart.default_colors()
		return {
			"data": {
				"labels": labels,
				"datasets": [
					{
						"data": dataset_values,
						"label": y_label,
						"backgroundColor": custom_colors if len(custom_colors) else background_colors,
						"borderWidth": 1,
						"borderColor": "#ffffff",
					}
				],
			},
			"message": chart_doc,
		}

	@staticmethod
	def _process_multi_dataset_pie_donut(chart_doc, data, columns, y_axis_columns):
		"""Process pie/donut chart with multiple datasets (concentric rings)."""
		labels = []
		datasets = []
		custom_colors = []

		custom_options = chart_doc.get("custom_options")
		if custom_options:
			custom_options = json.loads(custom_options)
			if custom_options.get("colors"):
				custom_colors = custom_options.get("colors")

		if not len(custom_colors):
			custom_colors = Chart.default_colors()

		# Build datasets for each y-axis
		for y_axis in y_axis_columns:
			y_field = y_axis.get("y_field")
			_label = y_axis.get("custom_label") or next(
				(col.get("label") for col in columns if col.get("fieldname") == y_field),
				y_field,
			)

			dataset = {
				"label": _label,
				"data": [],
				"backgroundColor": custom_colors if len(custom_colors) else y_axis.get("color") or "#3498db",
				"borderWidth": 1,
				"borderColor": "#ffffff",
			}
			datasets.append({"field": y_field, "dataset": dataset})

		# Collect all row data first with aggregated values
		row_data = []
		for row in data:
			if isinstance(row, dict):
				label = row.get(chart_doc.get("x_field")) or "Unknown"
			else:
				x_idx = next(
					(i for i, col in enumerate(columns) if col.get("fieldname") == chart_doc.get("x_field")),
					None,
				)
				label = row[x_idx] if x_idx is not None else "Unknown"

			# Collect values for each y-axis
			row_values = {}
			total_value = 0
			for ds_info in datasets:
				y_field = ds_info["field"]

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
				total_value += value

			row_data.append({"label": label, "values": row_values, "total": total_value})

		# Sort by total value in descending order
		row_data.sort(key=lambda x: x["total"], reverse=True)

		# Apply max_slices limit if specified
		max_slices = chart_doc.get("custom_max_slices")
		if max_slices and max_slices > 0 and len(row_data) > max_slices:
			# Keep top N slices
			top_rows = row_data[:max_slices]
			# Group remaining slices as "Others"
			others_rows = row_data[max_slices:]

			# Aggregate "Others" values for each y-axis
			others_values = {}
			for ds_info in datasets:
				y_field = ds_info["field"]
				others_values[y_field] = sum(row["values"].get(y_field, 0) for row in others_rows)

			others_total = sum(others_values.values())
			if others_total > 0:
				top_rows.append({"label": "Others", "values": others_values, "total": others_total})

			row_data = top_rows

		# Extract labels and populate datasets
		labels = [row["label"] for row in row_data]
		for ds_info in datasets:
			y_field = ds_info["field"]
			ds_info["dataset"]["data"] = [row["values"].get(y_field, 0) for row in row_data]

		# Extract just the dataset objects (remove field info)
		final_datasets = [ds_info["dataset"] for ds_info in datasets]

		return {
			"data": {
				"labels": labels,
				"datasets": final_datasets,
			},
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
