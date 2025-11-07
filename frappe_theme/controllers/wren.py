import frappe
from frappe import _


@frappe.whitelist(allow_guest=True)
def save_thread_id(thread_id, user_id, title):
	# Create new record
	doc = frappe.get_doc(
		{"doctype": "WrenAI User Thread", "thread_id": thread_id, "user": user_id, "thread_title": title}
	)
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return {"status": "created", "name": doc.name}


@frappe.whitelist(allow_guest=True)
def get_user_threads(user_id):
	if user_id == "Administrator":
		# all threads
		return frappe.get_all("WrenAI User Thread", fields=["name", "thread_id", "thread_title", "user"])
	else:
		# only current user threads
		return frappe.get_all(
			"WrenAI User Thread",
			filters={"user": user_id},
			fields=["name", "thread_id", "thread_title", "user"],
		)
