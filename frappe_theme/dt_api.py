import frappe

from frappe_theme.controllers.chart import Chart
from frappe_theme.controllers.dt_conf import DTConf
from frappe_theme.controllers.number_card import NumberCard


@frappe.whitelist()
def get_direct_connection_dts(dt):
	return DTConf.get_direct_connection_dts(dt)


@frappe.whitelist()
def get_indirect_connection_local_fields(dt):
	return DTConf.get_indirect_connection_local_fields(dt)


@frappe.whitelist()
def get_indirect_connection_foreign_fields(dt, local_field_option):
	return DTConf.get_indirect_connection_foreign_fields(dt, local_field_option)


@frappe.whitelist()
def get_direct_connection_fields(dt, link_dt):
	return DTConf.get_direct_connection_fields(dt, link_dt)


@frappe.whitelist()
def get_workflow_with_dt(dt):
	return DTConf.get_workflow_with_dt(dt)


@frappe.whitelist()
def doc_filters(doctype, filters=None):
	return DTConf.doc_filters(doctype, filters)


@frappe.whitelist()
def setup_user_list_settings(parent_id, child_dt, listview_settings):
	return DTConf.setup_user_list_settings(parent_id, child_dt, listview_settings)


@frappe.whitelist()
def delete_user_list_settings(parent_id, child_dt):
	return DTConf.delete_user_list_settings(parent_id, child_dt)


@frappe.whitelist()
def update_sva_ft_property(doctype, fieldname, key, value):
	return DTConf.update_sva_ft_property(doctype, fieldname, key, value)


@frappe.whitelist()
def get_user_list_settings(parent_id, child_dt):
	return DTConf.get_user_list_settings(parent_id, child_dt)


@frappe.whitelist()
def get_sva_dt_settings(doctype):
	return DTConf.get_sva_dt_settings(doctype)


@frappe.whitelist()
def get_connection_type_confs(doctype, ref_doctype):
	return DTConf.get_connection_type_confs(doctype, ref_doctype)


@frappe.whitelist()
def get_number_card_count(type, details, report=None, doctype=None, docname=None, filters=None):
	return NumberCard.get_number_card_count(type, details, report, doctype, docname, filters)


@frappe.whitelist()
def check_card_permissions_and_settings(number_card_name: str):
	return NumberCard.check_card_permissions_and_settings(number_card_name)


@frappe.whitelist()
def get_chart_data(type, details, report=None, doctype=None, docname=None, filters=None):
	return Chart.get_chart_data(type, details, report, doctype, docname, filters)


@frappe.whitelist()
def check_chart_permissions_and_settings(chart_name: str):
	return Chart.check_chart_permissions_and_settings(chart_name)


@frappe.whitelist()
def link_report_list(doctype):
	return DTConf.link_report_list(doctype)


@frappe.whitelist()
def check_list_permissions(doctype: str, _type: str = "Direct"):
	return DTConf.check_list_permissions(doctype, _type)


@frappe.whitelist()
def get_meta_fields(doctype, _type="Direct", meta_attached=False):
	return DTConf.get_meta_fields(doctype, _type, meta_attached)


@frappe.whitelist()
def get_dt_list(
	doctype,
	doc=None,
	ref_doctype=None,
	filters=None,
	fields=None,
	limit_page_length=None,
	order_by=None,
	limit_start=None,
	_type="List",
	unfiltered=0,
	return_columns=False,
):
	options = {
		"doctype": doctype,
		"doc": doc,
		"ref_doctype": ref_doctype,
		"filters": filters,
		"fields": fields,
		"limit_page_length": limit_page_length,
		"order_by": order_by,
		"limit_start": limit_start,
		"_type": _type,
		"unfiltered": unfiltered,
		"return_columns": return_columns,
	}
	return DTConf.get_dt_list(options)


@frappe.whitelist()
def get_report_filters(doctype):
	return DTConf.get_report_filters(doctype)


@frappe.whitelist()
def get_dt_count(doctype, doc=None, ref_doctype=None, filters=None, _type="List", unfiltered=0):
	options = {
		"doctype": doctype,
		"doc": doc,
		"ref_doctype": ref_doctype,
		"filters": filters,
		"_type": _type,
		"unfiltered": unfiltered,
	}
	return DTConf.get_dt_count(options)


@frappe.whitelist()
def get_workflow_transitions_for_table(doctype, states):
	"""
	Return allowed workflow transitions for each unique state in one call.
	Avoids the per-row DB load that frappe.model.workflow.get_transitions does.

	states: JSON list of unique workflow state strings present in the table rows
	Returns: { state: [transition_dicts] }
	"""
	import json

	if isinstance(states, str):
		try:
			states = json.loads(states)
		except (json.JSONDecodeError, TypeError):
			frappe.throw(frappe._("Invalid value for 'states': expected a JSON list of strings."))

	if not isinstance(states, list) or not all(isinstance(s, str) for s in states):
		frappe.throw(frappe._("'states' must be a list of strings."))

	try:
		workflow = frappe.get_doc("Workflow", {"document_type": doctype, "is_active": 1})
	except Exception:
		return {}

	user_roles = set(frappe.get_roles())
	result = {}

	for state in states:
		transitions = [
			tr.as_dict() for tr in workflow.transitions if tr.state == state and tr.allowed in user_roles
		]
		result[state] = transitions

	return result
