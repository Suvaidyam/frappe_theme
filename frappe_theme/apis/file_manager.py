import json
import os
from io import BytesIO

import frappe
from frappe.utils.file_manager import get_file

from frappe_theme.services.background_file.generator import enqueue_in_background


@frappe.whitelist()
def download_file(file_path):
	file_data = get_file(file_path)
	file_name = os.path.basename(file_data[0])
	file_content = file_data[1]
	file_stream = BytesIO(file_content)
	frappe.local.response.filename = file_name
	frappe.local.response.filecontent = file_stream.getvalue()
	frappe.local.response.type = "download"


@frappe.whitelist()
def check_existing_file(ref_doctype, ref_docname, title):
	"""Check if a file already exists for the given reference."""
	existing = frappe.db.get_value(
		"File",
		{
			"attached_to_doctype": ref_doctype,
			"attached_to_name": ref_docname,
			"attached_to_field": title,
		},
		["file_url", "file_name", "modified"],
		as_dict=True,
	)
	return existing


@frappe.whitelist()
def generate(
	method_path,
	fn_args=None,
	fn_kwargs=None,
	title="Processing",
	ref_doctype=None,
	ref_docname=None,
	queue="long",
	timeout=600,
):
	if isinstance(fn_args, str):
		fn_args = json.loads(fn_args)
	if isinstance(fn_kwargs, str):
		fn_kwargs = json.loads(fn_kwargs)

	enqueue_in_background(
		fn=method_path,
		fn_args=fn_args,
		fn_kwargs=fn_kwargs,
		title=title,
		ref_doctype=ref_doctype,
		ref_docname=ref_docname,
		queue=queue,
		timeout=int(timeout),
	)
