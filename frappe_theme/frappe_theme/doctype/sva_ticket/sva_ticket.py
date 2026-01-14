import frappe
from frappe import _
from frappe.model.document import Document

from frappe_theme.services.heldesk import create_ticket


class SVATicket(Document):
	def validate(self):
		if self.is_new():
			return

		old_status = frappe.db.get_value("SVA Ticket", self.name, "status")

		if old_status == "Closed":
			frappe.throw(
				_("Closed tickets are read-only. You cannot modify this ticket."), frappe.PermissionError
			)

	def after_insert(self):
		hd_id = create_ticket(
			{
				"subject": self.subject,
				"description": self.description,
				"priority": self.priority,
				"ticket_type": self.ticket_type,
			}
		)
		if hd_id:
			frappe.db.set_value(self.doctype, self.name, "hd_id", hd_id)
