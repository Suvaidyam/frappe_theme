app_name = "frappe_theme"
app_title = "Frappe Theme"
app_publisher = "Suvaidyam"
app_description = "A custom app to customize color theme of frappe desk and web"
app_email = "tech@suvaidyam.com"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------
# fixtures = []
# include js, css files in header of desk.html
import time

app_include_css = [
	"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
	f"/assets/frappe_theme/css/frappe_theme.css?ver={time.time()}",
	f"/assets/frappe_theme/css/number_card_mapper.css?ver={time.time()}",
]
app_include_js = [
	"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
	"global_exporter.bundle.js",
	"sva_workspace.bundle.js",
	"overwrite_form.bundle.js",
	"overwrite_workflow.bundle.js",
	"override_date_field.bundle.js",
	"frappe_theme.bundle.js",
	"override_table_multiselect.bundle.js",
	f"/assets/frappe_theme/js/svadb.js?ver={time.time()}",
	f"/assets/frappe_theme/js/fields_comment.js?ver={time.time()}",
	f"/assets/frappe_theme/js/extended_chart.js?ver={time.time()}",
	f"/assets/frappe_theme/js/mobile_view.js?ver={time.time()}",
	f"/assets/frappe_theme/js/utils.js?ver={time.time()}",
	f"/assets/frappe_theme/js/custom_import.js?ver={time.time()}",
	f"/assets/frappe_theme/js/sva_dt_utils.js?ver={time.time()}",
	f"/assets/frappe_theme/js/customizations.js?ver={time.time()}",
	f"/assets/frappe_theme/js/doctype/global_doctype.js?ver={time.time()}",
	f"/assets/frappe_theme/js/breadcrumb_override.js?ver={time.time()}",
	f"/assets/frappe_theme/js/sidebar_override.js?ver={time.time()}",
]
extend_bootinfo = "frappe_theme.boot.boot_theme"
# include js, css files in header of web template
web_include_css = "/assets/frappe_theme/css/frappe_theme.css"
web_include_js = f"/assets/frappe_theme/js/frappe_theme.bundle.js?ver={time.time()}"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "frappe_theme/public/scss/website"

# include js, css files in header of web form
webform_include_js = {
	"*": ["public/js/web_form/common_web_form.bundle.js"],
}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Workflow": "public/js/doctype/workflow.js",
	"Web Form": "public/js/doctype/web_form.js",
	"Customize Form": ["public/js/doctype/property_setter.js", "public/js/doctype/customize_form.js"],
	"DocType": ["public/js/doctype/property_setter.js", "public/js/doctype/doctype.js"],
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}
# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "frappe_theme/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
jinja = {"methods": "frappe_theme.utils.jinja_methods"}

# Installation
# ------------

# before_install = "frappe_theme.install.before_install"
# after_install = "frappe_theme.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "frappe_theme.uninstall.before_uninstall"
# after_uninstall = "frappe_theme.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "frappe_theme.utils.before_app_install"
# after_app_install = "frappe_theme.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "frappe_theme.utils.before_app_uninstall"
# after_app_uninstall = "frappe_theme.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "frappe_theme.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {"Report": "frappe_theme.overrides.report.CustomReport"}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"*": {
		"validate": "frappe_theme.utils.global_sanitizer.sanitize_all_fields",
		"before_insert": "frappe_theme.utils.data_protection.encrypt_doc_fields",
		"before_save": "frappe_theme.utils.data_protection.encrypt_doc_fields",
		"onload": "frappe_theme.utils.data_protection.decrypt_doc_fields",
	},
	"Version": {
		"validate": "frappe_theme.controllers.timeline.validate",
		# "on_cancel": "method",
		# "on_trash": "method"
	},
	"Report": {
		"before_save": "frappe_theme.overrides.report.before_save",
	},
	"File": {
		"after_insert": "frappe_theme.controllers.sva_integrations.cloud_assets.file_upload_to_cloud",
		"on_trash": "frappe_theme.controllers.sva_integrations.cloud_assets.delete_from_cloud",
	},
}

override_whitelisted_methods = {
	"frappe.model.workflow.apply_workflow": "frappe_theme.overrides.workflow.custom_apply_workflow",
	"frappe.model.workflow.get_transitions": "frappe_theme.overrides.workflow.get_custom_transitions",
	"frappe.desk.reportview.get": "frappe_theme.utils.data_protection.mask_doc_list_view",
	"frappe.desk.listview.get": "frappe_theme.utils.data_protection.mask_doc_list_view",
	"frappe.desk.query_report.run": "frappe_theme.utils.data_protection.mask_query_report",
	"frappe.desk.query_report.export_query": "frappe_theme.utils.data_protection.mask_query_report_export_query",
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	"cron": {
		"*/10 * * * *": [
			"frappe_theme.cron.sync_ticket_status.run",
		]
	}
}

# Testing
# -------

# before_tests = "frappe_theme.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "frappe_theme.event.get_events"
# }


#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "frappe_theme.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["frappe_theme.utils.before_request"]
# after_request = ["frappe_theme.utils.after_request"]

# Job Events
# ----------
# before_job = ["frappe_theme.utils.before_job"]
# after_job = ["frappe_theme.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"frappe_theme.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }
