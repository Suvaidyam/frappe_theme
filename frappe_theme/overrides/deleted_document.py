import frappe
from frappe.core.doctype.deleted_document.deleted_document import DeletedDocument


class CustomDeletedDocument(DeletedDocument):
	@staticmethod
	def clear_old_logs(days=180):
		# If "My Theme" has deleted_doc_always_show enabled, skip purging entirely.
		try:
			always_show = frappe.db.get_single_value("My Theme", "deleted_doc_always_show")
		except Exception:
			always_show = False

		if always_show:
			return

		DeletedDocument.clear_old_logs(days=days)
