import json

import frappe
from frappe import _


@frappe.whitelist()
def get_possible_link_filters(doctype, parent_doctype):
	"""
	Determine possible link relationships between a given doctype and its parent doctype.

	This function analyzes the fields of both the specified `doctype` and `parent_doctype` to identify
	possible link relationships, such as "One to One" and "Many to One", based on field types and options.

	Parameters:
	    doctype (str): The name of the child doctype to analyze for link relationships.
	    parent_doctype (str): The name of the parent doctype to analyze against.

	Returns:
	    list[dict]: A list of dictionaries, each representing a possible link relationship. Each dictionary may contain:
	        - foreign_fieldname (str): The fieldname in the child doctype that links to the parent.
	        - label (str): The label of the field in the child doctype.
	        - local_fieldname (str): The fieldname in the parent doctype that links to the child (if applicable).
	        - type (str): The type of relationship ("One to One", "Many to One", etc.).
	        - doctype (str): The name of the child doctype.
	        - description (str): A description of the relationship.
	        - primary_key (str, optional): The fieldname in a child table that acts as a primary key (for "Many to One" relationships).

	Example return value:
	    [
	        {
	            "foreign_fieldname": "customer",
	            "label": "Customer",
	            "local_fieldname": "customer",
	            "type": "One to One",
	            "doctype": "Sales Invoice",
	            "description": "Parent Single Link"
	        },
	        {
	            "foreign_fieldname": "item_code",
	            "label": "Item Code",
	            "primary_key": "item_code",
	            "local_fieldname": "items",
	            "doctype": "Sales Invoice",
	            "type": "Many to One",
	            "description": "Parent Many, Child Single Link"
	        }
	    ]
	"""
	# Input validation for doctype and parent_doctype
	if not doctype or not isinstance(doctype, str):
		frappe.throw(
			"Parameter 'doctype' is required and must be a valid DocType name.", frappe.ValidationError
		)
	if not parent_doctype or not isinstance(parent_doctype, str):
		frappe.throw(
			"Parameter 'parent_doctype' is required and must be a valid DocType name.", frappe.ValidationError
		)
	if not frappe.db.exists("DocType", doctype):
		frappe.throw(f"DocType '{doctype}' does not exist.", frappe.DoesNotExistError)
	if not frappe.db.exists("DocType", parent_doctype):
		frappe.throw(f"DocType '{parent_doctype}' does not exist.", frappe.DoesNotExistError)

	meta = frappe.get_meta(doctype)
	parent_meta = frappe.get_meta(parent_doctype)
	link_fields = []
	for field in meta.fields:
		if field.fieldtype in ["Link", "Table", "Table MultiSelect"] and not field.hidden:
			if field.fieldtype == "Link":
				relevant_parent_link_field = next(
					(
						f
						for f in parent_meta.fields
						if f.fieldtype == "Link" and f.options == field.options and not f.hidden
					),
					None,
				)
				foreign_fieldname = field.fieldname
				if relevant_parent_link_field:
					link_fields.append(
						{
							"foreign_fieldname": foreign_fieldname,
							"label": field.label,
							"local_fieldname": relevant_parent_link_field.fieldname,
							"type": "One to One",
							"doctype": doctype,
							"description": "Parent Single Link",
						}
					)
				std_child_tables = frappe.get_all(
					"DocField",
					filters=[
						["DocField", "options", "=", field.options],
						["DocField", "fieldtype", "=", "Link"],
						[
							"DocField",
							"parent",
							"in",
							frappe.get_all("DocType", filters=[["DocType", "istable", "=", 1]], pluck="name"),
						],
					],
					fields=["fieldname AS primary_key", "parent"],
				)
				for child in std_child_tables:
					relevant_parent_table_field = next(
						(
							f
							for f in parent_meta.fields
							if f.fieldtype in ["Table", "Table MultiSelect"]
							and f.options == child.parent
							and not f.hidden
						),
						None,
					)
					if relevant_parent_table_field:
						link_fields.append(
							{
								"foreign_fieldname": foreign_fieldname,
								"label": field.label,
								"primary_key": child.primary_key,
								"local_fieldname": relevant_parent_table_field.fieldname,
								"doctype": doctype,
								"type": "Many to One",
								"description": "Parent Many, Child Single Link",
							}
						)
			elif field.fieldtype in ["Table", "Table MultiSelect"]:
				relevant_child_table_field = next(
					(
						f
						for f in parent_meta.fields
						if f.fieldtype in ["Table", "Table MultiSelect"]
						and f.options == field.options
						and not f.hidden
					),
					None,
				)
				if relevant_child_table_field:
					child_table_meta = frappe.get_meta(field.options)
					first_link_field = next(
						(f for f in child_table_meta.fields if f.fieldtype == "Link" and not f.hidden), None
					)
					if first_link_field:
						link_fields.append(
							{
								"foreign_fieldname": field.fieldname,
								"label": field.label,
								"primary_key": first_link_field.fieldname,
								"local_fieldname": relevant_child_table_field.fieldname,
								"doctype": field.options,
								"type": "Many to Many",
								"description": "Parent Many Link",
							}
						)
				else:
					child_meta = frappe.get_meta(field.options)
					if child_meta:
						for child_field in child_meta.fields:
							if child_field.fieldtype == "Link":
								relevant_parent_link_field = next(
									(
										f
										for f in parent_meta.fields
										if f.fieldtype == "Link"
										and f.options == child_field.options
										and not f.hidden
									),
									None,
								)
								if relevant_parent_link_field:
									relevant_primary_key_field = next(
										(
											f
											for f in child_meta.fields
											if f.fieldtype == "Link"
											and f.options == relevant_parent_link_field.options
											and not f.hidden
										),
										None,
									)
									foreign_fieldname = child_field.fieldname
									if relevant_parent_link_field and relevant_primary_key_field:
										link_fields.append(
											{
												"foreign_fieldname": foreign_fieldname,
												"label": child_field.label,
												"local_fieldname": relevant_parent_link_field.fieldname,
												"primary_key": relevant_primary_key_field.fieldname,
												"doctype": field.options,
												"type": "One to Many",
												"description": "Parent Single, Child Many Link",
											}
										)
	return link_fields


@frappe.whitelist()
def check_if_datatable_is_configured_as_child_table(doctype):
	parents = frappe.get_all("SVADatatable Configuration", pluck="parent_doctype")
	is_dashboard = frappe.db.exists(
		"Property Setter", {"property": "is_dashboard", "value": ["!=", "0"], "doc_type": doctype}
	)
	if (len(parents) and doctype in parents) or is_dashboard:
		return {
			"freeze": False,
			"parents": [],
			"message": f"'{_(doctype)}' is configured as a parent datatable or dashboard DocType; child datatable checks are not applicable.",
		}

	direct_matches = frappe.get_all(
		"SVADatatable Configuration Child",
		filters={"link_doctype": doctype},
		fields=["name", "parent", "redirect_to_main_form"],
	)
	if direct_matches:
		parents = list({doc.parent for doc in direct_matches})
		return {
			"freeze": any(process_doc(doc) for doc in direct_matches),
			"parents": parents,
			"message": f"'{_(doctype)}' is configured as a child datatable via SVADatatable Configuration in {', '.join(_(p) for p in parents)}.",
		}

	ref_matches = frappe.get_all(
		"SVADatatable Configuration Child",
		filters={"referenced_link_doctype": doctype},
		fields=["name", "parent", "redirect_to_main_form"],
	)
	if ref_matches:
		parents = list({doc.parent for doc in ref_matches})
		return {
			"freeze": any(process_doc(doc) for doc in ref_matches),
			"parents": parents,
			"message": f"'{_(doctype)}' is configured as a child datatable via referenced_link_doctype in SVADatatable Configuration in {', '.join(_(p) for p in parents)}.",
		}

	child_conf_matches = frappe.get_all(
		"SVADatatable Child Conf",
		filters={"link_doctype": doctype},
		fields=["name", "parent", "redirect_to_main_form"],
	)
	if child_conf_matches:
		parents = list({doc.parent for doc in child_conf_matches})
		return {
			"freeze": any(process_doc(doc) for doc in child_conf_matches),
			"parents": parents,
			"message": f"'{_(doctype)}' is configured as a child datatable via SVADatatable Child Conf in {', '.join(_(p) for p in parents)}.",
		}

	direct_prop_matches = frappe.get_all(
		"Property Setter",
		filters={"property": "sva_ft", "value": ["like", f'%"link_doctype":"{doctype}"%']},
		fields=["name", "doc_type", "value"],
	)
	if direct_prop_matches:
		doc_types = list({doc.doc_type for doc in direct_prop_matches})
		return {
			"freeze": any(process_json(doc.value) for doc in direct_prop_matches),
			"parents": doc_types,
			"message": f"'{_(doctype)}' is configured as a child datatable via sva_ft property setter in {', '.join(_(dt) for dt in doc_types)}.",
		}

	ref_prop_matches = frappe.get_all(
		"Property Setter",
		filters={"property": "sva_ft", "value": ["like", f'%"referenced_link_doctype":"{doctype}"%']},
		fields=["name", "doc_type", "value"],
	)
	if ref_prop_matches:
		doc_types = list({doc.doc_type for doc in ref_prop_matches})
		return {
			"freeze": any(process_json(doc.value) for doc in ref_prop_matches),
			"parents": doc_types,
			"message": f"'{_(doctype)}' is configured as a child datatable via referenced_link_doctype in sva_ft property setter in {', '.join(_(dt) for dt in doc_types)}.",
		}

	return {
		"freeze": False,
		"parents": [],
		"message": f"'{_(doctype)}' is not configured as a child datatable.",
	}


def process_doc(doc):
	if doc:
		if not doc.get("redirect_to_main_form", 0):
			return True

	return False


def process_json(prop):
	if isinstance(prop, str):
		prop = json.loads(prop)

	if not prop.get("redirect_to_main_form", 0):
		return True

	return False
