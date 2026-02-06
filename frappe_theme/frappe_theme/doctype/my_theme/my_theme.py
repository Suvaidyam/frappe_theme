# Copyright (c) 2024, Suvaidyam and contributors
# For license information, please see license.txt

import re

import frappe
import requests
from frappe.model.document import Document

from frappe_theme.dt_api import get_number_card_count


class MyTheme(Document):
	def before_save(self):
		if self.login_page_title is not None:
			extra_spaces = re.search(r"^\s+", self.login_page_title)
			if extra_spaces:
				self.login_page_title = ""
			else:
				pass

	@frappe.whitelist()
	def eval_number_card(self, numbercard, doctype, docname):
		details = None
		if frappe.db.exists("Number Card", numbercard):
			details = frappe.get_doc("Number Card", numbercard).as_dict()

		if not details:
			return 0
		report = None
		if details.get("type") == "Report":
			report = frappe.get_doc("Report", details.get("report_name"))
		res = get_number_card_count(details.get("type"), details, report, doctype, docname)
		if res.get("count"):
			return res.get("count")
		else:
			return 0

	def get_request_post(self, url, data=None, headers=None, json=None, params=None, timeout=None):
		return requests.post(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_get(self, url, headers=None, params=None, timeout=None):
		return requests.get(url, headers=headers, params=params, timeout=timeout)

	def get_request_put(self, url, data, headers=None, json=None, params=None, timeout=None):
		return requests.put(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_delete(self, url, headers=None, params=None, timeout=None):
		return requests.delete(url, headers=headers, params=params, timeout=timeout)

	def get_request_patch(self, url, data, headers=None, json=None, params=None, timeout=None):
		return requests.patch(url, data=data, headers=headers, json=json, params=params, timeout=timeout)

	def get_request_head(self, url, headers=None, params=None, timeout=None):
		return requests.head(url, headers=headers, params=params, timeout=timeout)

	# send email
	def send_mail(
		self,
		recipients=None,
		subject="No Subject",
		message="No Message",
		as_markdown=False,
		delayed=True,
		reference_doctype=None,
		reference_name=None,
		unsubscribe_method=None,
		unsubscribe_params=None,
		unsubscribe_message=None,
		add_unsubscribe_link=1,
		attachments=None,
		content=None,
		doctype=None,
		name=None,
		reply_to=None,
		queue_separately=False,
		cc=None,
		bcc=None,
		message_id=None,
		in_reply_to=None,
		send_after=None,
		expose_recipients=None,
		send_priority=1,
		communication=None,
		retry=1,
		now=None,
		read_receipt=None,
		is_notification=False,
		inline_images=None,
		template=None,
		args=None,
		header=None,
		print_letterhead=False,
		with_container=False,
		email_read_tracker_url=None,
		x_priority=3,
		email_headers=None,
	):
		# verify recipients
		verify_recipients = []
		if recipients:
			for recipient in recipients:
				is_verify = frappe.db.get_value("SVA User", {"email": recipient}, "is_verified")
				if is_verify:
					verify_recipients.append(recipient)
		# send email
		print(verify_recipients, "================================")
		frappe.sendmail(
			recipients=verify_recipients,
			subject=subject,
			message=message,
			as_markdown=as_markdown,
			delayed=delayed,
			reference_doctype=reference_doctype,
			reference_name=reference_name,
			unsubscribe_method=unsubscribe_method,
			unsubscribe_params=unsubscribe_params,
			unsubscribe_message=unsubscribe_message,
			add_unsubscribe_link=add_unsubscribe_link,
			attachments=attachments,
			content=content,
			doctype=doctype,
			name=name,
			reply_to=reply_to,
			queue_separately=queue_separately,
			cc=cc,
			bcc=bcc,
			message_id=message_id,
			in_reply_to=in_reply_to,
			send_after=send_after,
			expose_recipients=expose_recipients,
			send_priority=send_priority,
			communication=communication,
			retry=retry,
			now=now,
			read_receipt=read_receipt,
			is_notification=is_notification,
			inline_images=inline_images,
			template=template,
			args=args,
			header=header,
			print_letterhead=print_letterhead,
			with_container=with_container,
			email_read_tracker_url=email_read_tracker_url,
			x_priority=x_priority,
			email_headers=email_headers,
		)
