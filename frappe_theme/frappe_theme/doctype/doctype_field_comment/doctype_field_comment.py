# import frappe
import re

import frappe

# Copyright (c) 2025, Suvaidyam and contributors
# For license information, please see license.txt
# import frappe
from frappe.model.document import Document


class DocTypeFieldComment(Document):
	pass


# @frappe.whitelist()
# def send_mention_notification(mentioned_user, comment_doc, doctype, docname, field_name, field_label, comment):
#     """Send notification to mentioned user"""
#     try:
#         # Extract user from mention data
#         mention_pattern = r'data-id="([^"]+)"'
#         mentioned_users = re.findall(mention_pattern, comment)

#         if not mentioned_users:
#             return

#         # Get user's full name
#         from_user = frappe.utils.get_fullname(frappe.session.user)

#         for user_email in mentioned_users:
#             # Get user ID from email
#             user_id = frappe.db.get_value("User", {"email": user_email}, "name")
#             if not user_id:
#                 continue

#             # Create notification message
#             notification_message = f"{from_user} mentioned you in a comment on {field_label} in {doctype} {docname}"

#             # Create Notification Log entry
#             notification = frappe.new_doc("Notification Log")
#             notification.for_user = user_id
#             notification.from_user = frappe.session.user
#             notification.type = "Mention"
#             notification.document_type = doctype
#             notification.document_name = docname
#             notification.subject = notification_message
#             notification.email_content = f"""
#                 <p>{from_user} mentioned you in a comment:</p>
#                 <p>{comment}</p>
#                 <p>Document: {doctype} {docname}</p>
#                 <p>Field: {field_label}</p>
#             """
#             notification.insert(ignore_permissions=True)

#     except Exception as e:
#         frappe.log_error(f"Error sending mention notification: {str(e)}", "DocType Field Comment Notification Error")
