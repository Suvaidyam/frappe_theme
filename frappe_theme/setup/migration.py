import frappe

from frappe_theme.overrides.report import create_view
from frappe_theme.print import ColorPrint


def after_migrate():
	ColorPrint.blue(
		"---------------------------------------- Creating views for reports \n----------------------------------------"
	)
	fields = ["custom_create_view", "custom_view_name", "query", "custom_view_type"]
	filters = {"custom_create_view": 1}
	reports = frappe.get_all("Report", filters=filters, fields=fields)
	for report in reports:
		create_view(report)
	ColorPrint.green(
		f"---------------------------------------- {len(reports)} Views created successfully \n----------------------------------------"
	)
