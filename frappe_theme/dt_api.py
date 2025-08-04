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
def get_user_list_settings(parent_id, child_dt):
	return DTConf.get_user_list_settings(parent_id, child_dt)


@frappe.whitelist()
def get_sva_dt_settings(doctype):
	return DTConf.get_sva_dt_settings(doctype)


@frappe.whitelist()
def get_number_card_count(type, details, report=None, doctype=None, docname=None):
	return NumberCard.get_number_card_count(type, details, report, doctype, docname)


@frappe.whitelist()
def get_chart_data(type, details, report=None, doctype=None, docname=None):
	return Chart.get_chart_data(type, details, report, doctype, docname)


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
):
	return DTConf.get_dt_list(
		doctype,
		doc,
		ref_doctype,
		filters,
		fields,
		limit_page_length,
		order_by,
		limit_start,
		_type,
		unfiltered,
	)


@frappe.whitelist()
def get_report_filters(doctype):
	return DTConf.get_report_filters(doctype)


@frappe.whitelist()
def get_dt_count(doctype, doc=None, ref_doctype=None, filters=None, _type="List", unfiltered=0):
	return DTConf.get_dt_count(doctype, doc, ref_doctype, filters, _type, unfiltered)
