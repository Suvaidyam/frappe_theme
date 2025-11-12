import frappe
from frappe import _


def sanitize_all_fields(doc, method=None):
	"""Sanitize all string fields in a document to prevent HTML injection.

	Behavior:
	- When `sanitize_all_fields` is enabled (in site config or in the `My Theme`
	    single doctype), the function validates string fields and raises
	    `frappe.ValidationError` if HTML content is detected (i.e. when the
	    sanitized value differs from the original). This enforces that users cannot
	    submit HTML into non-HTML fields.

	- When `sanitize_all_fields` is not enabled in either site config or the
	    `My Theme` single doctype, the function does nothing.

	Excluded fieldtypes: HTML, Table, Table MultiSelect, Image, Attach, Attach Image,
	Text Editor, Code.
	"""

	# site config flag: set `sanitize_all_fields` in site_config.json or via bench config
	# Try to use frappe's sanitize_html if available; otherwise fall back to
	# Python's html.escape to ensure HTML is not executed.
	sanitize_func = None
	utils_mod = getattr(frappe, "utils", None)
	if utils_mod:
		html_utils = getattr(utils_mod, "html_utils", None)
		if html_utils:
			sanitize_func = getattr(html_utils, "sanitize_html", None)

	if sanitize_func is None:
		import html as _html

		def sanitize_func(s):
			return _html.escape(s)

	conf = frappe.get_conf() or {}

	# Only run sanitizer when enabled via the site config or the single `My Theme`
	# doctype (this app's single doctype). Per-document flags are not used.
	site_flag = bool(conf.get("sanitize_all_fields"))

	# Read the single theme doctype `My Theme` if available (issingle = 1)
	theme_flag = False
	try:
		theme = frappe.get_single_value("My Theme", "sanitize_all_fields")
		if theme:
			theme_flag = bool(theme)
	except Exception:
		frappe.log_error("Failed to get single 'My Theme' doctype for sanitization flag.")
		# get_single not available or doctype missing — ignore

	if not (site_flag or theme_flag):
		# sanitizer not enabled for this site/theme — do nothing
		return

	# From this point, sanitizer is enabled and MUST enforce validation: if any
	# non-excluded string field contains HTML (sanitized != original), raise.

	meta = frappe.get_meta(doc.doctype)
	excluded = {
		"HTML",
		"Table",
		"Table MultiSelect",
		"Image",
		"Attach",
		"Attach Image",
		"Text Editor",
		"Code",
		"Long Text",
		"Small Text",
		"Markdown Editor",
		"JSON",
		"Text",
	}

	for df in meta.fields:
		if df.fieldtype in excluded:
			continue

		fieldname = df.fieldname
		value = doc.get(fieldname)

		if isinstance(value, str) and value.strip():
			sanitized_value = sanitize_func(value)
			if sanitized_value != value:
				frappe.throw(
					_("HTML is not allowed in field {0}.").format(df.label or fieldname),
					exc=frappe.ValidationError,
				)
