import json

import frappe
import openpyxl

from frappe_theme.api import get_files


def get_visible_fields(fields):
	"""Return all visible fields from a DocType meta object"""
	# print(fields)
	visible = []
	section_hidden = False
	column_hidden = False
	for df in fields:
		# Track hidden Section Breaks
		if df["fieldtype"] == "Section Break":
			section_hidden = bool(df["hidden"])
			column_hidden = False  # reset when new section starts
			continue

			# Track hidden Column Breaks
		if df["fieldtype"] == "Column Break":
			column_hidden = bool(df["hidden"])
			continue

			# Skip hidden field
		if df["hidden"]:
			continue

			# Skip fields inside hidden section/column
		if section_hidden or column_hidden:
			continue

		visible.append(df)

	return visible


def get_title(doctype, docname, as_title_field=True):
	doc = frappe.db.get_value(doctype, docname, "*", as_dict=True)
	main_doc_meta = frappe.get_meta(doctype).as_dict()
	fields = get_visible_fields(main_doc_meta["fields"])

	fields_meta = [
		{
			"fieldname": f["fieldname"],
			"fieldtype": f["fieldtype"],
			"options": f["options"],
			"label": f["label"],
		}
		for f in fields
		if not (
			f["fieldtype"] in ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
			or f["hidden"]
		)
	]
	if as_title_field:
		for field in fields_meta:
			if field["fieldtype"] == "Link":
				# return print("hhhh")
				link_val = doc.get(field["fieldname"])
				if link_val:
					related_doc_meta = frappe.get_meta(field["options"])
					title_field = related_doc_meta.title_field or "name"
					doc[field["fieldname"]] = (
						frappe.db.get_value(field["options"], link_val, title_field) or link_val
					)
			elif field["fieldtype"] == "JSON":
				json_data = doc.get(field["fieldname"])
				if json_data:
					doc[field["fieldname"]] = json.loads(json_data)
			elif field["fieldtype"] in ["Table", "Table MultiSelect"]:
				child_doctype = field["options"]
				child_meta = frappe.get_meta(child_doctype)
				child_rows = frappe.get_all(
					child_doctype,
					filters={"parent": docname, "parenttype": doctype, "parentfield": field["fieldname"]},
					fields="*",
				)
				for row in child_rows:
					for child_field in child_meta.fields:
						if child_field.fieldtype == "Link":
							link_val = row.get(child_field.fieldname)
							if link_val:
								related_child_meta = frappe.get_meta(child_field.options)
								title_field = related_child_meta.title_field or "name"
								row[child_field.fieldname] = (
									frappe.db.get_value(child_field.options, link_val, title_field)
									or link_val
								)
				child_fields_meta = [
					{
						"fieldname": f.fieldname,
						"fieldtype": f.fieldtype,
						"options": f.options,
						"label": f.label,
					}
					for f in child_meta.fields
					if f.fieldname
				]
				if child_rows:
					doc[field["fieldname"]] = {"data": child_rows, "meta": child_fields_meta}
	for field in fields_meta:
		if field["fieldtype"] in ["Attach", "Attach Image"]:
			attach_val = doc.get(field["fieldname"])
			if attach_val and not attach_val.startswith("http"):
				base_url = frappe.utils.get_url()
				doc[field["fieldname"]] = f"{base_url}{attach_val}"
	_doc = {}
	for f in fields_meta:
		_doc[f["fieldname"]] = doc.get(f["fieldname"])
	return {
		"data": _doc,
		"meta": fields_meta,
	}


def get_related_tables(doctype, docname, exclude_meta_fields=None, as_title_field=True):
	main_data = get_title(doctype, docname, as_title_field)

	sva_dt_config = frappe.get_doc("SVADatatable Configuration", doctype)
	related_tables = []

	for child in sva_dt_config.child_doctypes:
		html_field = child.html_field
		table_doctype = None
		filters = {}
		if child.connection_type == "Direct":
			table_doctype = child.link_doctype
			filters = {child.link_fieldname: main_data["data"].get("name")}
		elif child.connection_type == "Indirect":
			table_doctype = child.link_doctype
			filters = {child.foreign_field: main_data["data"].get(child.local_field)}
		elif child.connection_type == "Referenced":
			table_doctype = child.referenced_link_doctype
			filters = {
				child.dn_reference_field: main_data["data"].get("name"),
				child.dt_reference_field: doctype,
			}
		elif child.connection_type == "Unfiltered":
			table_doctype = child.link_doctype
			filters = {}
		elif child.connection_type == "Is Custom Design":
			if child.template == "Notes":
				table_doctype = "Notes"
				filters = {"reference_doctype": doctype, "related_to": main_data["data"].get("name")}
			elif child.template == "Tasks":
				table_doctype = "ToDo"
				filters = {"reference_type": doctype, "reference_name": main_data["data"].get("name")}
			elif child.template == "Gallery":
				continue
				# data = get_files(doctype, main_data["data"].get("name"))

			elif child.template == "Email":
				table_doctype = "Communication"
				filters = {"reference_doctype": doctype, "reference_name": main_data["data"].get("name")}
			elif child.template == "Linked Users":
				continue
			else:
				table_doctype = "Geography Details"
				filters = {"document_type": doctype, "docname": main_data["data"].get("name")}

		try:
			if not table_doctype:
				continue

			meta = frappe.get_meta(table_doctype)
			table_data = frappe.db.get_list(table_doctype, filters=filters, fields=["name"])
			all_docs = []
			for row in table_data:
				doc = get_title(table_doctype, row.name, as_title_field)
				all_docs.append(doc)

			fields_meta = [
				{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "options": f.options, "label": f.label}
				for f in meta.fields
				if f.fieldtype not in exclude_meta_fields and f.fieldname
			]
			# convert string to JSON in child table
			if child:
				_child = child.as_dict()
				_child.update(
					{
						"listview_settings": json.loads(child.listview_settings or "[]"),
						"crud_permissions": json.loads(child.crud_permissions or "[]"),
						"extended_condition": json.loads(child.extended_condition or "[]"),
					}
				)

			if len(all_docs):
				related_tables.append(
					{
						"table_doctype": table_doctype,
						"html_field": html_field,
						"data": all_docs,
						"sva_dt_meta": _child,
						"meta": fields_meta if all_docs else {},
					}
				)
		except Exception as e:
			frappe.log_error(f"Error fetching data for {table_doctype}: {str(e)}")
			table_data = []

	return main_data, related_tables


@frappe.whitelist()
def export_json(doctype, docname, excluded_fieldtypes=None):
	if excluded_fieldtypes is None:
		excluded_fieldtypes = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
	try:
		main_data, related_tables = get_related_tables(doctype, docname, excluded_fieldtypes, True)
		result = {
			doctype: {"data": main_data.get("data", {}), "meta": main_data.get("meta", [])},
		}

		# Extract child tables from main_data and add as separate entries
		for field in main_data.get("meta", []):
			if field.get("fieldtype") in ["Table", "Table MultiSelect"]:
				child_table = main_data["data"].get(field["fieldname"])
				if child_table and isinstance(child_table, dict):
					# Use label instead of doctype name
					key = field.get("label") or field["options"]
					result[key] = {
						"data": child_table.get("data", []),
						"meta": child_table.get("meta", []),
					}
					# Remove child table from main doc data
					result[doctype]["data"].pop(field["fieldname"], None)

		# Extract child tables from related tables and add as separate entries
		for table in related_tables:
			table_doctype = table.get("table_doctype")
			table_meta = table.get("meta", [])
			table_data = [doc.get("data", {}) for doc in table.get("data", [])]
			result[table_doctype] = {
				"data": table_data,
				"meta": table_meta,
				"sva_dt_meta": table.get("sva_dt_meta", {}),
			}
			# For each doc in related table, check for child tables
			for field in table_meta:
				if field.get("fieldtype") in ["Table", "Table MultiSelect"]:
					child_doctype = field.get("options")
					key = child_doctype
					all_child_rows = []
					child_meta = None
					for doc in table_data:
						child_table = doc.get(field["fieldname"])
						if child_table and isinstance(child_table, dict):
							all_child_rows.extend(child_table.get("data", []))
							child_meta = child_table.get("meta", [])
							doc.pop(field["fieldname"], None)
					if all_child_rows:
						result[key] = {
							"data": all_child_rows,
							"meta": child_meta or [],
						}
		return result
	except Exception as e:
		return {"error": str(e)}


@frappe.whitelist()
def export_excel(doctype, docname):
	from io import BytesIO

	try:
		excluded_fieldtypes = ["Column Break", "Section Break", "Tab Break", "Fold", "HTML", "Button"]
		exported = export_json(doctype, docname, excluded_fieldtypes)
		if "error" in exported:
			return {"success": False, "error": exported["error"]}

		wb = openpyxl.Workbook()
		first_sheet = True

		for key, value in exported.items():
			data = value.get("data", [])
			meta = value.get("meta", [])
			if not isinstance(data, list):
				data = [data]
			headers = [
				f.get("label", f.get("fieldname", ""))
				for f in meta
				if f.get("fieldtype") not in excluded_fieldtypes
			]
			if first_sheet:
				ws = wb.active
				ws.title = str(key)
				first_sheet = False
			else:
				ws = wb.create_sheet(title=str(key))
			ws.append(headers)
			for row in data:
				ws.append(
					[
						str(row.get(f.get("fieldname", "")))
						if row.get(f.get("fieldname", "")) is not None
						else ""
						for f in meta
						if f.get("fieldtype") not in excluded_fieldtypes
					]
				)

		output = BytesIO()
		wb.save(output)
		output.seek(0)
		filedata = output.read()
		filename = f"{doctype}_{docname}.xlsx"

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
