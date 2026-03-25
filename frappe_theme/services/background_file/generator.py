import frappe
from frappe import _


def enqueue_in_background(
	fn,
	fn_args=None,
	fn_kwargs=None,
	title="Processing",
	ref_doctype=None,
	ref_docname=None,
	queue="long",
	timeout=600,
	user=None,
):
	"""Run any function in the background with start/completion notifications.

	If the function sets frappe.local.response.filecontent (via send_file),
	the file is automatically saved and a download link is included in the
	completion notification.

	Usage:
	    enqueue_in_background(
	        fn="abf.auto_generated_reports.sanction_letter.generate_sanction_letter",
	        fn_args=["GAF-13306"],
	        title="Sanction Letter",
	        ref_doctype="Project proposal",
	        ref_docname="GAF-13306",
	    )
	"""
	user = user or frappe.session.user

	_notify(
		user,
		f"{title} - Generation started in the background",
		ref_doctype=ref_doctype,
		ref_docname=ref_docname,
		status="Started",
	)

	frappe.enqueue(
		"frappe_theme.services.background_file.generator._run",
		queue=queue,
		timeout=timeout,
		fn=fn,
		fn_args=fn_args or [],
		fn_kwargs=fn_kwargs or {},
		title=title,
		ref_doctype=ref_doctype,
		ref_docname=ref_docname,
		user=user,
		enqueue_after_commit=True,
	)


def _run(fn, fn_args, fn_kwargs, title, ref_doctype, ref_docname, user):
	"""Background job wrapper."""
	frappe.set_user(user)

	try:
		frappe.get_attr(fn)(*fn_args, **fn_kwargs)
		frappe.db.commit()

		# Check if the function set file content on the response (via send_file)
		file_url = _save_response_file(ref_doctype, ref_docname, title)

		if file_url:
			_notify(
				user,
				f'🔗 <span class="bg-file-download-link">{title} - Ready for Download</span>',
				link=file_url,
				ref_doctype=ref_doctype,
				ref_docname=ref_docname,
				status="Completed",
			)
		else:
			_notify(
				user,
				f"{title} - Completed",
				ref_doctype=ref_doctype,
				ref_docname=ref_docname,
				status="Completed",
			)

	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(title=f"{title} Failed", message=str(e))
		_notify(
			user,
			f"{title} - Generation Failed. Please Retry.",
			email_content=f"<b>Error:</b> {str(e)}",
			ref_doctype=ref_doctype,
			ref_docname=ref_docname,
			status="Failed",
		)
		frappe.db.commit()


def _save_response_file(ref_doctype=None, ref_docname=None, title=None):
	"""If the function set frappe.local.response.filecontent, save it as a File doc
	and return the file_url. Otherwise return None."""
	file_content = getattr(frappe.local.response, "filecontent", None)
	file_name = getattr(frappe.local.response, "filename", None)

	if not file_content or not file_name:
		return None

	file_doc = {
		"doctype": "File",
		"file_name": file_name,
		"content": file_content,
		"is_private": 1,
	}
	if ref_doctype and ref_docname:
		file_doc["attached_to_doctype"] = ref_doctype
		file_doc["attached_to_name"] = ref_docname

	if title:
		file_doc["attached_to_field"] = title
	exists = False
	if ref_doctype and ref_docname and title:
		exists = frappe.db.exists(
			"File",
			{"attached_to_doctype": ref_doctype, "attached_to_name": ref_docname, "attached_to_field": title},
			True,
		)

	if exists:
		_file = frappe.get_doc("File", exists)
	else:
		_file = frappe.get_doc(file_doc)

	_file.update(file_doc)
	_file.flags.ignore_validate = True
	_file.save(ignore_permissions=True)
	frappe.db.commit()

	return _file.file_url


def _notify(
	user, subject, link=None, email_content=None, ref_doctype=None, ref_docname=None, status="Failed"
):
	# Add ref info as a small muted line in the subject (visible in bell dropdown)
	if ref_doctype and ref_docname:
		subject += (
			f'<br><span class="text-small" style="color: #2490EF;">{_(ref_doctype)}: {ref_docname}</span>'
		)

	if status == "Failed":
		subject = f"❌ {subject}"
		subject += '<br><span class="text-small">If this issue persists, please contact support.</span>'

	doc = {
		"doctype": "Notification Log",
		"subject": subject,
		"for_user": user,
		"type": "Alert",
	}
	if link:
		doc["link"] = link
	if ref_doctype:
		doc["document_type"] = ref_doctype
	if ref_docname:
		doc["document_name"] = ref_docname
	if email_content:
		doc["email_content"] = email_content

	frappe.get_doc(doc).insert(ignore_permissions=True)
	frappe.db.commit()
