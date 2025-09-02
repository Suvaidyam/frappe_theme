import json
from io import BytesIO
from typing import Any, Optional

import frappe
import openpyxl

from frappe_theme.api import get_files

# Constants
EXCLUDED_FIELDTYPES = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
TABLE_FIELDTYPES = ["Table", "Table MultiSelect"]
LINK_FIELDTYPES = ["Link"]
ATTACHMENT_FIELDTYPES = ["Attach", "Attach Image"]


def get_visible_fields(fields: list[dict]) -> list[dict]:
	"""Return all visible fields from a DocType meta object"""
	visible = []
	section_hidden = False
	column_hidden = False

	for df in fields:
		# Track hidden Section Breaks
		if df["fieldtype"] == "Section Break":
			section_hidden = bool(df.get("hidden", 0))
			column_hidden = False  # reset when new section starts
			continue

		# Track hidden Column Breaks
		if df["fieldtype"] == "Column Break":
			column_hidden = bool(df.get("hidden", 0))
			continue

		# Skip hidden fields or fields in hidden sections/columns
		if bool(df.get("hidden", 0)) or section_hidden or column_hidden:
			continue

		visible.append(df)

	# Add name field at the beginning
	visible.insert(0, {"fieldname": "name", "fieldtype": "Data", "label": "Name", "hidden": 0, "options": ""})
	return visible


def get_fields_meta(fields: list[dict]) -> list[dict]:
	"""Extract field metadata, excluding system fields"""
	return [
		{
			"fieldname": f["fieldname"],
			"fieldtype": f["fieldtype"],
			"options": f["options"],
			"label": f["label"],
		}
		for f in fields
		if f["fieldtype"] not in EXCLUDED_FIELDTYPES and not f.get("hidden")
	]


def process_link_fields(doc: dict, fields_meta: list[dict]) -> None:
	"""Process link fields to get title field values"""
	for field in fields_meta:
		if field["fieldtype"] not in LINK_FIELDTYPES:
			continue

		link_val = doc.get(field["fieldname"])
		if not link_val:
			continue

		try:
			related_doc_meta = frappe.get_meta(field["options"])
			title_field = related_doc_meta.title_field or "name"
			doc[field["fieldname"]] = frappe.db.get_value(field["options"], link_val, title_field) or link_val
		except Exception as e:
			frappe.log_error(title="Error fetching link field title", message=str(e))


def process_json_fields(doc: dict, fields_meta: list[dict]) -> None:
	"""Process JSON fields to parse JSON data"""
	for field in fields_meta:
		if field["fieldtype"] != "JSON":
			continue

		json_data = doc.get(field["fieldname"])
		if json_data:
			try:
				doc[field["fieldname"]] = json.loads(json_data)
			except (json.JSONDecodeError, TypeError):
				frappe.log_error(title="Error parsing JSON field", message=f"Field: {field['fieldname']}")


def process_child_table_row(row: dict, child_fields: list[dict]) -> None:
	"""Process a single child table row"""
	# Process link fields in child table
	for child_field in child_fields:
		if child_field["fieldtype"] not in LINK_FIELDTYPES:
			continue

		link_val = row.get(child_field["fieldname"])
		if not link_val:
			continue

		try:
			related_child_meta = frappe.get_meta(child_field["options"])
			title_field = related_child_meta.title_field or "name"
			row[child_field["fieldname"]] = (
				frappe.db.get_value(child_field["options"], link_val, title_field) or link_val
			)
		except Exception as e:
			frappe.log_error(title="Error fetching link field title", message=str(e))

	# Extract only relevant field data
	return {child_field["fieldname"]: row.get(child_field["fieldname"]) for child_field in child_fields}


def process_table_fields(doc: dict, fields_meta: list[dict], doctype: str, docname: str) -> None:
	"""Process table fields to get child table data"""
	for field in fields_meta:
		if field["fieldtype"] not in TABLE_FIELDTYPES:
			continue

		child_doctype = field["options"]
		try:
			child_meta = frappe.get_meta(child_doctype).as_dict()
			child_fields = get_visible_fields(child_meta["fields"])

			child_rows = frappe.get_all(
				child_doctype,
				filters={"parent": docname, "parenttype": doctype, "parentfield": field["fieldname"]},
				fields="*",
			)

			if not child_rows:
				continue

			processed_rows = [process_child_table_row(row, child_fields) for row in child_rows]
			child_fields_meta = get_fields_meta(child_fields)

			doc[field["fieldname"]] = {"data": processed_rows, "meta": child_fields_meta}
		except Exception as e:
			frappe.log_error(f"Error processing table field {field['fieldname']}: {str(e)}")
			continue


def process_attachment_fields(doc: dict, fields_meta: list[dict]) -> None:
	"""Process attachment fields to create full URLs"""
	base_url = frappe.utils.get_url()

	for field in fields_meta:
		if field["fieldtype"] not in ATTACHMENT_FIELDTYPES:
			continue

		attach_val = doc.get(field["fieldname"])
		if attach_val and not attach_val.startswith("http"):
			doc[field["fieldname"]] = f"{base_url}{attach_val}"


def get_title(doctype: str, docname: str, as_title_field: bool = True) -> dict:
	"""Get document data with title field processing"""
	doc = frappe.db.get_value(doctype, docname, "*", as_dict=True)
	if not doc:
		return {"data": {}, "meta": []}

	main_doc_meta = frappe.get_meta(doctype).as_dict()
	fields = get_visible_fields(main_doc_meta["fields"])
	fields_meta = get_fields_meta(fields)

	if as_title_field:
		process_link_fields(doc, fields_meta)
		process_json_fields(doc, fields_meta)
		process_table_fields(doc, fields_meta, doctype, docname)

	process_attachment_fields(doc, fields_meta)

	# Extract only relevant field data
	_doc = {f["fieldname"]: doc.get(f["fieldname"]) for f in fields_meta}

	return {"data": _doc, "meta": fields_meta}


def get_connection_filters(child: dict, main_data: dict, doctype: str) -> tuple[str | None, dict]:
	"""Get table doctype and filters based on connection type"""
	connection_type = child.connection_type
	main_name = main_data["data"].get("name")

	if connection_type == "Direct":
		return child.link_doctype, {child.link_fieldname: main_name}

	elif connection_type == "Indirect":
		return child.link_doctype, {child.foreign_field: main_data["data"].get(child.local_field)}

	elif connection_type == "Referenced":
		return child.referenced_link_doctype, {
			child.dn_reference_field: main_name,
			child.dt_reference_field: doctype,
		}

	elif connection_type == "Unfiltered":
		return child.link_doctype, {}

	elif connection_type == "Is Custom Design":
		template = child.template

		if template == "Notes":
			return "Notes", {"reference_doctype": doctype, "related_to": main_name}

		elif template == "Tasks":
			return "ToDo", {"reference_type": doctype, "reference_name": main_name}

		elif template == "Gallery":
			return None, {}  # Skip for now

		elif template == "Email":
			return "Communication", {"reference_doctype": doctype, "reference_name": main_name}

		elif template == "Linked Users":
			return None, {}  # Skip

		else:
			return "Geography Details", {"document_type": doctype, "docname": main_name}

	return None, {}


def get_related_tables(
	doctype: str, docname: str, exclude_meta_fields: list[str] | None = None, as_title_field: bool = True
) -> tuple[dict, list[dict]]:
	"""Get main document data and related tables"""
	if exclude_meta_fields is None:
		exclude_meta_fields = EXCLUDED_FIELDTYPES

	main_data = get_title(doctype, docname, as_title_field)

	try:
		sva_dt_config = frappe.get_doc("SVADatatable Configuration", doctype, as_dict=True)
	except frappe.DoesNotExistError:
		return main_data, []

	related_tables = []

	for child in sva_dt_config.child_doctypes:
		table_doctype, filters = get_connection_filters(child, main_data, doctype)

		if not table_doctype:
			continue

		try:
			meta = frappe.get_meta(table_doctype)
			table_data = frappe.db.get_list(table_doctype, filters=filters, fields=["name"])

			if not table_data:
				continue

			all_docs = [get_title(table_doctype, row.name, as_title_field) for row in table_data]

			fields_meta = [
				{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "label": f.label}
				for f in meta.fields
				if f.fieldtype not in exclude_meta_fields and f.fieldname
			]

			# Process child configuration
			_child = child.as_dict()
			_child.update(
				{
					"listview_settings": json.loads(child.listview_settings or "[]"),
					"crud_permissions": json.loads(child.crud_permissions or "[]"),
					"extended_condition": json.loads(child.extended_condition or "[]"),
				}
			)

			related_tables.append(
				{
					"table_doctype": table_doctype,
					"html_field": child.html_field,
					"data": all_docs,
					"sva_dt_meta": _child,
					"meta": fields_meta,
				}
			)

		except Exception as e:
			frappe.log_error(f"Error fetching data for {table_doctype}: {str(e)}")
			continue

	return main_data, related_tables


def extract_child_tables_from_data(result: dict, data_key: str, main_data: dict) -> None:
	"""Extract child tables from main data and add as separate entries"""
	for field in main_data.get("meta", []):
		if field.get("fieldtype") not in TABLE_FIELDTYPES:
			continue

		child_table = main_data["data"].get(field["fieldname"])
		if not (child_table and isinstance(child_table, dict)):
			continue

		key = field.get("label") or field["options"]
		result[key] = {
			"data": child_table.get("data", []),
			"meta": child_table.get("meta", []),
		}
		# Remove child table from main doc data
		result[data_key]["data"].pop(field["fieldname"], None)


def extract_child_tables_from_related(result: dict, related_tables: list[dict]) -> None:
	"""Extract child tables from related tables and add as separate entries"""
	for table in related_tables:
		table_doctype = table.get("table_doctype")
		table_meta = table.get("meta", [])
		table_data = [doc.get("data", {}) for doc in table.get("data", [])]

		result[table_doctype] = {
			"data": table_data,
			"meta": table_meta,
			"sva_dt_meta": table.get("sva_dt_meta", {}),
		}

		# Process child tables within related tables
		for field in table_meta:
			if field.get("fieldtype") not in TABLE_FIELDTYPES:
				continue

			child_doctype = field.get("options")
			all_child_rows = []
			child_meta = None

			for doc in table_data:
				child_table = doc.get(field["fieldname"])
				if not (child_table and isinstance(child_table, dict)):
					continue

				all_child_rows.extend(child_table.get("data", []))
				child_meta = child_table.get("meta", [])
				doc.pop(field["fieldname"], None)

			if all_child_rows:
				result[child_doctype] = {
					"data": all_child_rows,
					"meta": child_meta or [],
				}


@frappe.whitelist()
def export_json(doctype: str, docname: str, excluded_fieldtypes: list[str] | None = None) -> dict:
	"""Export document and related tables as JSON"""
	if excluded_fieldtypes is None:
		excluded_fieldtypes = EXCLUDED_FIELDTYPES

	try:
		main_data, related_tables = get_related_tables(doctype, docname, excluded_fieldtypes, True)

		result = {
			doctype: {"data": main_data.get("data", {}), "meta": main_data.get("meta", [])},
		}

		# Extract child tables from main data
		extract_child_tables_from_data(result, doctype, main_data)

		# Extract child tables from related tables
		extract_child_tables_from_related(result, related_tables)

		return result

	except Exception as e:
		frappe.log_error(f"Error in export_json: {str(e)}")
		return {"error": str(e)}


@frappe.whitelist()
def export_excel(doctype: str, docname: str) -> dict:
	"""Export document and related tables as Excel file"""
	try:
		exported = export_json(doctype, docname, EXCLUDED_FIELDTYPES)

		if "error" in exported:
			return {"success": False, "error": exported["error"]}

		wb = openpyxl.Workbook()
		first_sheet = True

		for key, value in exported.items():
			data = value.get("data", [])
			meta = value.get("meta", [])

			# Ensure data is a list
			if not isinstance(data, list):
				data = [data]

			# Get headers for non-excluded fields
			headers = [
				f.get("label", f.get("fieldname", ""))
				for f in meta
				if f.get("fieldtype") not in EXCLUDED_FIELDTYPES
			]

			# Create or use existing worksheet
			if first_sheet:
				ws = wb.active
				ws.title = str(key)[:31]  # Excel sheet name limit
				first_sheet = False
			else:
				ws = wb.create_sheet(title=str(key)[:31])

			# Add headers
			if headers:
				ws.append(headers)

			# Add data rows
			for row in data:
				ws.append(
					[
						str(row.get(f.get("fieldname", "")))
						if row.get(f.get("fieldname", "")) is not None
						else ""
						for f in meta
						if f.get("fieldtype") not in EXCLUDED_FIELDTYPES
					]
				)

		# Save to BytesIO
		output = BytesIO()
		wb.save(output)
		output.seek(0)
		filedata = output.read()
		filename = f"{doctype}_{docname}.xlsx"

		# Set response for file download
		frappe.local.response.filename = filename
		frappe.local.response.filecontent = filedata
		frappe.local.response.content_type = (
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		)
		frappe.local.response.type = "download"

		return {"success": True, "message": f"Excel file generated successfully: {filename}"}

	except Exception as e:
		frappe.log_error(f"Error in export_excel: {str(e)}")
		return {"success": False, "error": str(e)}
