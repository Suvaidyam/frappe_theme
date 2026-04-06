import frappe
from frappe import _


def get_setup_stages(args=None):
	return [
		{
			"status": _("Saving Theme Settings"),
			"fail_msg": _("Failed to save Theme Settings"),
			"tasks": [
				{
					"fn": setup_theme_settings,
					"args": args,
					"fail_msg": _("Failed to save Theme Settings"),
				}
			],
		}
	]


def setup_theme_settings(args):
	theme = frappe.get_doc("My Theme")

	fields = [
		"navbar_color",
		"navbar_text_color",
		"button_background_color",
		"button_text_color",
		"secondary_button_background_color",
		"secondary_button_text_color",
		"hide_fields_comment",
		"show_comment_count_default",
	]

	for field in fields:
		val = args.get(field)
		if val is not None:
			setattr(theme, field, val)

	theme.save(ignore_permissions=True)
	frappe.db.commit()
