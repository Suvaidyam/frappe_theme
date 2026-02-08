import frappe

from frappe_theme.controllers.chart import Chart
from frappe_theme.controllers.dt_conf import DTConf
from frappe_theme.controllers.number_card import NumberCard
from frappe_theme.print import ColorPrint


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
def get_chart_data(type, details, report=None, doctype=None, docname=None, filters=None):
	return Chart.get_chart_data(type, details, report, doctype, docname, filters)


@frappe.whitelist()
def link_report_list(doctype):
	return DTConf.link_report_list(doctype)


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
	ColorPrint.green(f"Getting dt list for {doctype}", f"with filters: {filters}")
	options = {
		'doctype': doctype,
		'doc': doc,
		'ref_doctype': ref_doctype,
		'filters': filters,
		'fields': fields,
		'limit_page_length': limit_page_length,
		'order_by': order_by,
		'limit_start': limit_start,
		'_type': _type,
		'unfiltered': unfiltered,
		'return_columns': return_columns
	}
	return DTConf.get_dt_list(options)


@frappe.whitelist()
def get_report_filters(doctype):
	return DTConf.get_report_filters(doctype)


@frappe.whitelist()
def get_dt_count(doctype, doc=None, ref_doctype=None, filters=None, _type="List", unfiltered=0):
	options = {
		'doctype': doctype,
		'doc': doc,
		'ref_doctype': ref_doctype,
		'filters': filters,
		'_type': _type,
		'unfiltered': unfiltered
	}
	return DTConf.get_dt_count(options)
