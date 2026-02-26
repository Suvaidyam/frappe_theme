import json

import frappe
from frappe.desk.query_report import run

from frappe_theme.controllers.chart import Chart
from frappe_theme.controllers.filters import DTFilters
from frappe_theme.controllers.number_card import NumberCard


class DTConf:
	@staticmethod
	def check_list_permissions(doctype, _type="List"):
		response = {"permitted": False, "message": ""}
		if _type == "Report":
			if not frappe.has_permission("Report", "read"):
				response["message"] = "No permission to read Report doctype"
				return response
			report = frappe.get_cached_doc("Report", doctype)
			response["permitted"] = True if report.is_permitted() else False
			if not response["permitted"]:
				response["message"] = f"No permission to access report {doctype}"
			return response
		else:
			response["permitted"] = True if frappe.has_permission(doctype, "read") else False
			if not response["permitted"]:
				response["message"] = f"No permission to access doctype {doctype}"
			return response

	# datatable settings
	def get_direct_connection_dts(dt):
		standard_dts = frappe.get_list(
			"DocField",
			filters=[["DocField", "options", "=", dt], ["DocField", "parenttype", "=", "DocType"]],
			pluck="parent",
			ignore_permissions=True,
		)
		custom_dts = frappe.get_list(
			"Custom Field",
			filters=[
				["Custom Field", "options", "=", dt],
			],
			pluck="dt",
			ignore_permissions=True,
		)
		return standard_dts + custom_dts

	def get_indirect_connection_local_fields(dt):
		fields = frappe.get_meta(dt).fields
		valid_fields = [
			{"value": field.fieldname, "label": field.label, "options": field.options}
			for field in fields
			if field.fieldtype in ["Link"] and field.options not in ["Workflow State", dt]
		]
		return valid_fields

	def get_indirect_connection_foreign_fields(dt, local_field_option):
		fields = frappe.get_all(
			"DocField",
			filters=[
				["DocField", "parent", "=", dt],
				["DocField", "options", "=", local_field_option],
				["DocField", "parenttype", "=", "DocType"],
			],
			fields=["label", "fieldname as value"],
		)
		return fields

	# workflow
	def get_workflow_with_dt(dt):
		exists = frappe.db.exists("Workflow", {"document_type": dt})
		if exists:
			wf_doc = frappe.get_doc("Workflow", exists)
			return wf_doc.as_dict()
		else:
			frappe.throw("No workflow found for this doctype")

	def get_direct_connection_fields(dt, link_dt):
		standard_dt_fields = frappe.get_list(
			"DocField",
			filters=[
				["DocField", "options", "=", dt],
				["DocField", "parenttype", "=", "DocType"],
				["DocField", "parent", "=", link_dt],
			],
			fields=["label", "fieldname"],
			ignore_permissions=True,
		)
		custom_dt_fields = frappe.get_list(
			"Custom Field",
			filters=[["Custom Field", "options", "=", dt], ["Custom Field", "dt", "=", link_dt]],
			fields=["label", "fieldname"],
			ignore_permissions=True,
		)
		return standard_dt_fields + custom_dt_fields

	# config for sva datatable
	def get_sva_dt_settings(doctype):
		if doctype == "SVADatatable Configuration":
			return None
		if not frappe.db.exists("SVADatatable Configuration", doctype):
			return None

		settings = frappe.get_doc("SVADatatable Configuration", doctype)
		settings = settings.as_dict()
		# number cards
		updated_cards = NumberCard.number_card_settings(settings)
		settings["number_cards"] = updated_cards

		# charts
		updated_charts = Chart.chart_settings(settings)
		settings["charts"] = updated_charts
		return settings

	def get_meta_fields(doctype, _type, meta_attached=False):
		if _type == "Report":
			report = frappe.get_doc("Report", doctype)
			if report.report_type != "Query Report":
				response = run(report.name, filters={})
				if meta_attached:
					return {"fields": response.get("columns"), "meta": {}}
				else:
					return response.get("columns")
			elif report.report_type == "Query Report":
				if meta_attached:
					return {"fields": report.get("columns"), "meta": {}}
				else:
					return report.columns
		else:
			meta_fields = frappe.get_meta(doctype, True).fields
			property_setters = frappe.get_all(
				"Property Setter",
				filters={"doc_type": doctype},
				fields=["field_name", "property", "value"],
				ignore_permissions=True,
			)
			# Convert meta_fields into mutable dictionaries if necessary
			fields_dict = [f.as_dict() for f in meta_fields if f.fieldtype not in ["Tab Break"]]
			# Apply property setter values to the meta fields
			for field in fields_dict:
				for ps in property_setters:
					if field.get("fieldname") == ps.field_name:
						# Dynamically set the field property
						field[ps.property] = ps.value
			if meta_attached:
				return {"fields": fields_dict, "meta": frappe.get_meta(doctype, True).as_dict()}
			else:
				return fields_dict

	@staticmethod
	def get_dt_list(options):
		if options["_type"] == "Report":
			return DTConf.report_list(options)
		else:
			return DTConf.doc_type_list(options)

	@staticmethod
	def report_list(options):
		filters = options["filters"]
		if isinstance(filters, str):
			filters = json.loads(filters)
		if filters is None:
			filters = {}

		report = frappe.get_doc("Report", options["doctype"])
		outer_filters, inner_filters, not_applied_filters = DTFilters.get_report_filters(
			report, filters, options["ref_doctype"]
		)
		if report.report_type == "Query Report":
			columns, result = report.execute_query_report(
				filters=inner_filters,
				outer_filters=outer_filters,
				ref_doctype=options["ref_doctype"],
				ref_docname=options["doc"],
				limit_page_length=options["limit_page_length"],
				limit_start=options["limit_start"],
				unfiltered=options["unfiltered"],
			)
			if options["return_columns"]:
				return {"result": result, "columns": report.get("columns")}
			else:
				return result
		elif report.report_type == "Script Report":
			response = run(report.name, filters=inner_filters)
			columns = response.get("columns")
			result = Chart.filter_script_report_data(
				response.get("result"), columns, options["ref_doctype"], options["doc"]
			)

			# apply pagination
			if (
				options["limit_page_length"]
				and options["limit_start"] is not None
				and int(options["limit_page_length"] or 0) < len(result)
			):
				result = result[
					options["limit_start"] : options["limit_start"] + int(options["limit_page_length"] or 0)
				]

			if options["return_columns"]:
				return {"result": result, "columns": columns}
			else:
				return result

	def doc_type_list(options):
		filters = options["filters"]
		fields = options["fields"]
		limit_page_length = options["limit_page_length"]
		order_by = options["order_by"]
		limit_start = options["limit_start"]
		doc = options["doc"]
		ref_doctype = options["ref_doctype"]
		doctype = options["doctype"]

		if filters is not None and not isinstance(filters, (dict | list)):
			filters = {}

		valid_filters, invalid_filters = filters, []
		if ref_doctype == doc:
			valid_filters, invalid_filters = DTFilters.validate_doctype_filters(
				doctype=ref_doctype, docname=doc, base_doctype=doctype, filters=filters
			)

		return frappe.get_list(
			doctype,
			filters=valid_filters,
			fields=fields,
			limit_page_length=limit_page_length,
			order_by=order_by,
			limit_start=limit_start,
		)

	def get_dt_count(options):
		filters = options["filters"]
		doctype = options["doctype"]
		if options["_type"] == "Report":
			report = frappe.get_doc("Report", options["doctype"])
			outer_filters, inner_filters, not_applied_filters = DTFilters.get_report_filters(
				report, options["filters"], options["ref_doctype"]
			)
			if report.report_type == "Query Report":
				query = report.execute_query_report(
					filters=inner_filters,
					outer_filters=outer_filters,
					ref_doctype=options["ref_doctype"],
					ref_docname=options["doc"],
					unfiltered=options["unfiltered"],
					return_query=True,
				)
				count = frappe.db.sql(f"SELECT COUNT(*) AS count FROM ({query}) as __count", as_dict=True)
				return count[0].get("count") if count else 0
			elif report.report_type == "Script Report":
				response = run(report.name, filters=inner_filters)
				result = Chart.filter_script_report_data(
					response.get("result"), response.get("columns"), options["ref_doctype"], options["doc"]
				)
				return len(result)
		else:
			cleaned_filters = [item[:-1] if item and item[-1] is False else item for item in filters]
			return frappe.db.count(doctype, filters=cleaned_filters)

	# listview settings

	def setup_user_list_settings(parent_id, child_dt, listview_settings):
		user = frappe.session.user
		if user == "Administrator":
			return
		exists = frappe.db.exists(
			"SVADT User Listview Settings", {"parent_id": parent_id, "child_dt": child_dt, "user": user}
		)
		if exists:
			doc = frappe.get_doc("SVADT User Listview Settings", exists)
			doc.listview_settings = listview_settings
			doc.save(ignore_permissions=True)
		else:
			frappe.get_doc(
				{
					"doctype": "SVADT User Listview Settings",
					"parent_id": parent_id,
					"child_dt": child_dt,
					"user": user,
					"listview_settings": listview_settings,
				}
			).insert(ignore_permissions=True)

	def delete_user_list_settings(parent_id, child_dt):
		user = frappe.session.user
		if user == "Administrator":
			return None
		exists = frappe.db.exists(
			"SVADT User Listview Settings", {"parent_id": parent_id, "child_dt": child_dt, "user": user}
		)
		if exists:
			frappe.delete_doc("SVADT User Listview Settings", exists)
		return True

	def update_sva_ft_property(doctype, fieldname, key, value):
		exists = frappe.db.exists(
			"Property Setter",
			{
				"doc_type": doctype,
				"field_name": fieldname,
				"property": "sva_ft",
			},
		)
		if exists:
			ps_doc = frappe.get_doc("Property Setter", exists)
			if isinstance(ps_doc.value, str):
				sva_ft_dict = json.loads(ps_doc.value)
			else:
				sva_ft_dict = ps_doc.value
			sva_ft_dict[key] = value
			if isinstance(sva_ft_dict, dict):
				ps_doc.value = json.dumps(sva_ft_dict)
			else:
				ps_doc.value = sva_ft_dict
			ps_doc.save(ignore_permissions=True)

	def get_user_list_settings(parent_id, child_dt):
		user = frappe.session.user
		if user == "Administrator":
			return None
		listview_settings = None
		if frappe.db.exists(
			"SVADT User Listview Settings", {"parent_id": parent_id, "child_dt": child_dt, "user": user}, True
		):
			listview_settings = frappe.get_cached_value(
				"SVADT User Listview Settings",
				frappe.db.exists(
					"SVADT User Listview Settings",
					{"parent_id": parent_id, "child_dt": child_dt, "user": user},
					True,
				),
				"listview_settings",
			)
		return listview_settings

	# build datatable for doctype
	def doc_filters(doctype, filters=None):
		dtmeta = frappe.get_meta(doctype)
		field_dicts = {}
		field_dicts[doctype] = []

		for field in dtmeta.fields:
			field_dict = DTConf.process_field(field)
			if field_dict.get("fieldtype") in ["Table", "Table MultiSelect"]:
				continue
				# child_meta = frappe.get_meta(field_dict.get('options'))
				# if len(child_meta.fields) > 0:
				#     field_dicts[field_dict.get('options')] = []
				#     for child_field in child_meta.fields:
				#         child_field_dict = DTConf.process_field(child_field)
				#         field_dicts[field_dict.get('options')].append(child_field_dict)
				# continue
			field_dicts[doctype].append(field_dict)
		return field_dicts

	def process_field(field):
		field_dict = {}
		for key, value in field.__dict__.items():
			if key == "link_filters" and isinstance(value, list):
				field_dict[key] = json.dumps(value)
			else:
				field_dict[key] = value
		return field_dict

	# build datatable for report
	def link_report_list(doctype):
		other_report_list = frappe.get_all(
			"Report",
			or_filters=[
				["Report Filter", "options", "=", doctype],
				["Report Column", "options", "=", doctype],
			],
			pluck="name",
		)
		return other_report_list

	def filters_to_sql_conditions(filters, table_alias="t"):
		conditions = []

		if isinstance(filters, str):
			filters = json.loads(filters)

		if isinstance(filters, dict):
			filters = [[table_alias, key, "=", value] for key, value in filters.items()]

		for f in filters:
			if len(f) < 4:
				continue

			doctype, field, operator, value = f[:4]
			field_name = f"{table_alias}.{field}"

			if operator.lower() == "between" and isinstance(value, (list | tuple)) and len(value) == 2:
				condition = f"{field_name} BETWEEN '{value[0]}' AND '{value[1]}'"
			elif operator.lower() == "like":
				condition = f"{field_name} LIKE '{value}'"
			elif operator.lower() == "in" and isinstance(value, (list | tuple)):
				in_values = ", ".join(f"'{v}'" for v in value)
				condition = f"{field_name} IN ({in_values})"
			elif operator.lower() == "not in" and isinstance(value, (list | tuple)):
				not_in_values = ", ".join(f"'{v}'" for v in value)
				condition = f"{field_name} NOT IN ({not_in_values})"
			elif operator.lower() == "is":
				val = str(value).lower()
				if val == "set":
					condition = f"{field_name} IS NOT NULL"
				elif val == "not set":
					condition = f"{field_name} IS NULL"
			else:
				condition = f"{field_name} {operator} '{value}'"

			conditions.append(condition)

		return " AND ".join(conditions)

	def get_report_filters(doctype):
		if doctype:
			report = frappe.get_cached_doc("Report", doctype)
			report = report.as_dict()
			return report.get("filters")
		else:
			return []

	def get_connection_type_confs(doctype, ref_doctype):
		meta = frappe.get_meta(doctype)
		if meta.fields:
			# Add direct link field filter
			direct_link = next(
				(
					x
					for x in meta.fields
					if x.fieldtype == "Link"
					and x.options == ref_doctype
					and x.fieldname not in ["amended_form"]
				),
				None,
			)
			if direct_link:
				return {
					"link_doctype": doctype,
					"connection_type": "Direct",
					"link_fieldname": direct_link.fieldname,
				}

			# Add reference field filters
			ref_dt = next((x for x in meta.fields if x.fieldtype == "Link" and x.options == "DocType"), None)
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
					return {
						"referenced_link_doctype": doctype,
						"dt_reference_field": ref_dt.fieldname,
						"dn_reference_field": ref_dn.fieldname,
						"connection_type": "Referenced",
					}
			return {
				"connection_type": "Unfiltered",
			}
		return None
