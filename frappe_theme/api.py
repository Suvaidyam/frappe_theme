import json
import re
from typing import Optional, Union

import frappe
from frappe import _
from frappe.utils import cint

from frappe_theme.utils import get_state_closure_by_type
from frappe_theme.utils.version_utils import VersionUtils


@frappe.whitelist(allow_guest=True)
def get_my_theme():
	return frappe.get_doc("My Theme")


@frappe.whitelist(allow_guest=True)
def get_property_set(doctype):
	return frappe.db.get_list(
		"Property Setter",
		fields=["*"],
		filters={"doc_type": doctype, "property": ["IN", ["filter_by", "link_filter", "wf_state_field"]]},
		ignore_permissions=True,
	)


@frappe.whitelist()
def get_doctype_fields(doctype):
	custom_fields = frappe.get_all(
		"Custom Field", filters={"dt": doctype}, fields=["*"], ignore_permissions=True
	)
	dt = frappe.get_doc("DocType", doctype, ignore_permissions=True)
	if len(custom_fields) > 0:
		dt.fields.extend(custom_fields)
	return dt


@frappe.whitelist()
def get_my_list_settings(doctype):
	try:
		return frappe.get_cached_doc("List View Settings", doctype, ignore_permissions=True)
	except frappe.DoesNotExistError:
		frappe.clear_messages()


@frappe.whitelist()
def get_meta_fields(doctype):
	meta_fields = frappe.get_meta(doctype).fields
	property_setters = frappe.get_all(
		"Property Setter",
		filters={"doc_type": doctype},
		fields=["field_name", "property", "value"],
		ignore_permissions=True,
	)
	# Convert meta_fields into mutable dictionaries if necessary
	fields_dict = [f.as_dict() for f in meta_fields if f.fieldtype not in ["Tab Break"]]
	# Apply property setter values to the meta fields
	for field in fields_dict:
		for ps in property_setters:
			if field.get("fieldname") == ps.field_name:
				# Dynamically set the field property
				field[ps.property] = ps.value

	return fields_dict


@frappe.whitelist()
def get_versions(
	dt: str,
	dn: str,
	page_length: int,
	start: int,
	filters: str | None = None,
) -> list[dict]:
	return VersionUtils.get_versions(dt, dn, page_length, start, filters)


@frappe.whitelist()
def get_permissions(doctype, _type="Direct"):
	permissions = []
	if _type == "Report":
		permissions.append("read")
	else:
		if frappe.has_permission(doctype, "read"):
			permissions.append("read")
		if frappe.has_permission(doctype, "write"):
			permissions.append("write")
		if frappe.has_permission(doctype, "create"):
			permissions.append("create")
		if frappe.has_permission(doctype, "delete"):
			permissions.append("delete")
		if frappe.has_permission(doctype, "submit"):
			permissions.append("submit")
		if frappe.has_permission(doctype, "cancel"):
			permissions.append("cancel")
		if frappe.has_permission(doctype, "print"):
			permissions.append("print")
	return permissions


@frappe.whitelist()
def get_meta(doctype):
	frappe.flags.ignore_permissions = True
	return frappe.get_meta(doctype).as_dict()


@frappe.whitelist()
def get_html_fields(doctype):
	try:
		doctype_meta = frappe.get_meta(doctype)
		html_fields = [field.fieldname for field in doctype_meta.fields if field.fieldtype == "HTML"]
		return html_fields
	except Exception as e:
		frappe.log_error(f"Error getting HTML fields for {doctype}: {str(e)}")
		return []


@frappe.whitelist()
def execute_number_card_query(report_name, filters=None):
	try:
		# Get the report document
		report_doc = frappe.get_doc("Report", report_name)
		if not report_doc or not report_doc.query:
			frappe.throw(_("Report not found or invalid"))

		# Get the base query from the report
		base_query = report_doc.query

		# Create subquery
		query = f"SELECT * FROM ({base_query}) AS subquery"

		# Add WHERE clause if filters are provided
		if filters:
			# Convert string filters to dict if needed
			if isinstance(filters, str):
				filters = frappe.parse_json(filters)

			where_conditions = []
			for field, value in filters.items():
				# Clean the field name (remove quotes if present)
				field = field.strip("'\"")

				# Safely format the value based on type
				if isinstance(value, (int | float)):
					where_conditions.append(f"{field} = {value}")
				else:
					# Remove any existing quotes and escape single quotes in the value
					value = str(value).strip("'\"").replace("'", "\\'")
					where_conditions.append(f"{field} = '{value}'")

			if where_conditions:
				query += " WHERE " + " AND ".join(where_conditions)

		# Execute the query
		result = frappe.db.sql(query, as_dict=True)

		# Get column information by creating a temporary table
		temp_table_name = f"temp_report_{frappe.generate_hash()[:10]}"
		try:
			# Create temporary table
			frappe.db.sql(f"CREATE TEMPORARY TABLE `{temp_table_name}` AS {base_query}")

			# Get column information
			columns = frappe.db.sql(f"DESCRIBE `{temp_table_name}`", as_dict=True)
			column_types = {col.Field: col.Type for col in columns}

			return {"result": result, "column_types": column_types}
		finally:
			# Clean up temporary table
			frappe.db.sql(f"DROP TEMPORARY TABLE IF EXISTS `{temp_table_name}`")
	except Exception as e:
		frappe.log_error(f"Error executing number card query: {str(e)}")
		return None


@frappe.whitelist()
def get_linked_doctype_fields(doc_type, frm_doctype):
	"""Get linked fields between two doctypes"""
	try:
		# Get standard fields
		res = frappe.get_list(
			"DocField",
			filters={"parent": doc_type, "fieldtype": "Link", "options": ["IN", ["DocType", frm_doctype]]},
			fields=["fieldname", "options"],
			ignore_permissions=True,
		)

		# Get custom fields
		cus_ref_res = frappe.get_list(
			"Custom Field",
			filters={"dt": doc_type, "fieldtype": "Link", "options": ["IN", ["DocType", frm_doctype]]},
			fields=["fieldname", "options"],
			ignore_permissions=True,
		)

		# Combine and filter fields
		filds = res + cus_ref_res
		filds = [f for f in filds if f.fieldname not in ["amended_from", "parent_grant"]]

		if not filds:
			return None

		field = filds[0]
		result = {"field": field}

		if field.options == "DocType":
			# Get standard dynamic link fields
			fieldname = frappe.get_list(
				"DocField",
				filters={"parent": doc_type, "fieldtype": "Dynamic Link", "options": field.fieldname},
				fields=["fieldname"],
				ignore_permissions=True,
			)

			# Get custom dynamic link fields
			fieldname2 = frappe.get_list(
				"Custom Field",
				filters={"dt": doc_type, "fieldtype": "Dynamic Link", "options": field.fieldname},
				fields=["fieldname"],
				ignore_permissions=True,
			)

			fieldname3 = fieldname + fieldname2
			if fieldname3:
				result["final_field"] = fieldname3[0]
		return result

	except Exception as e:
		frappe.log_error(f"Error in get_linked_doctype_fields: {str(e)}")
		return None


@frappe.whitelist()
def get_timeline_dt(dt, dn):
	sql = f"""
        SELECT DISTINCT ver.custom_actual_doctype AS doctype
        FROM `tabVersion` AS ver
        WHERE ver.ref_doctype = '{dt}'
        AND ver.docname = '{dn}'
        AND ver.custom_actual_doctype IS NOT NULL
    """

	result = frappe.db.sql(sql, as_dict=True)
	return [row["doctype"] for row in result]


# @frappe.whitelist()
# def copy_role_perms(doc):
#     # Parse the doc parameter if it's a string
#     if isinstance(doc, str):
#         doc = frappe.parse_json(doc)

#     # Get all existing Custom DocPerm records for the source role
#     existing_perms = frappe.get_all('Custom DocPerm',
#                     filters={
#                         'role': doc.get('role_from'),
#                         'permlevel': 0,
#                     },
#                     fields=['name', 'parent'],
#                     ignore_permissions=True
#                 )

#     # Check if records with role_to already exist
#     existing_role_to_perms = frappe.get_all('Custom DocPerm',
#                     filters={
#                         'role': doc.get('role_to'),
#                         'permlevel': 0,
#                     },
#                     fields=['name', 'parent'],
#                     ignore_permissions=True
#                 )

#     records_updated = 0
#     records_created = 0

#     # Create a dictionary of existing doctypes for role_to for faster lookup
#     existing_doctypes = {perm.parent: perm.name for perm in existing_role_to_perms}

#     # Process each permission from the source role
#     for perm in existing_perms:
#         # Get the full document for the permission
#         source_perm = frappe.get_doc('Custom DocPerm', perm.name)

#         # Get common permissions between source_perm and doc
#         common_permissions = get_common_permissions(source_perm, doc)

#         # Check if this doctype already has a permission for role_to
#         if perm.parent in existing_doctypes:
#             # Get the existing permission for role_to with the same parent
#             target_perm_name = existing_doctypes[perm.parent]
#             target_perm_doc = frappe.get_doc('Custom DocPerm', target_perm_name)

#             # Update the permission values based on common permissions
#             apply_common_permissions(target_perm_doc, common_permissions)

#             # Only save if there are common permissions to apply
#             if common_permissions:
#                 target_perm_doc.save()
#                 records_updated += 1
#         else:
#             # Create a new permission with role_to
#             new_perm = frappe.get_doc('Custom DocPerm', perm.name)
#             new_perm.role = doc.get('role_to')

#             # Copy parent from the original permission
#             new_perm.parent = perm.parent

#             # Apply common permissions
#             apply_common_permissions(new_perm, common_permissions)

#             # Only insert if there are common permissions to apply
#             if common_permissions:
#                 new_perm.insert()
#                 records_created += 1

#     # Create redirect link
#     redirect_link = f'<a href="/app/custom-docperm" class="">View Permissions</a>'

#     # Show appropriate message with redirect link
#     if records_updated > 0 and records_created > 0:
#         frappe.msgprint(f"{records_updated} permissions updated and {records_created} permissions created successfully {redirect_link}")
#     elif records_updated > 0:
#         frappe.msgprint(f"{records_updated} permissions updated successfully {redirect_link}")
#     elif records_created > 0:
#         frappe.msgprint(f"{records_created} permissions created successfully {redirect_link}")
#     else:
#         frappe.msgprint(f"No permissions were updated or created")

#     return True

# def get_common_permissions(source_perm, doc):
#     """Get common permissions between source_perm and doc"""
#     common_permissions = {}

#     # Check each permission field
#     if 'select' in doc and int(doc.get('select', 0)) == int(source_perm.select):
#         common_permissions['select'] = int(doc.get('select', 0))
#     if 'read' in doc and int(doc.get('read', 0)) == int(source_perm.read):
#         common_permissions['read'] = int(doc.get('read', 0))
#     if 'write' in doc and int(doc.get('write', 0)) == int(source_perm.write):
#         common_permissions['write'] = int(doc.get('write', 0))
#     if 'create' in doc and int(doc.get('create', 0)) == int(source_perm.create):
#         common_permissions['create'] = int(doc.get('create', 0))
#     if 'delete_to' in doc and int(doc.get('delete_to', 0)) == int(source_perm.delete):
#         common_permissions['delete'] = int(doc.get('delete_to', 0))
#     if 'submit_to' in doc and int(doc.get('submit_to', 0)) == int(source_perm.submit):
#         common_permissions['submit'] = int(doc.get('submit_to', 0))
#     if 'cancel_to' in doc and int(doc.get('cancel_to', 0)) == int(source_perm.cancel):
#         common_permissions['cancel'] = int(doc.get('cancel_to', 0))
#     if 'amend' in doc and int(doc.get('amend', 0)) == int(source_perm.amend):
#         common_permissions['amend'] = int(doc.get('amend', 0))
#     if 'report' in doc and int(doc.get('report', 0)) == int(source_perm.report):
#         common_permissions['report'] = int(doc.get('report', 0))
#     if 'export' in doc and int(doc.get('export', 0)) == int(source_perm.export):
#         common_permissions['export'] = int(doc.get('export', 0))
#     if 'import_to' in doc and int(doc.get('import_to', 0)) == int(getattr(source_perm, 'import', 0)):
#         common_permissions['import'] = int(doc.get('import_to', 0))
#     if 'share' in doc and int(doc.get('share', 0)) == int(source_perm.share):
#         common_permissions['share'] = int(doc.get('share', 0))
#     if 'print' in doc and int(doc.get('print', 0)) == int(source_perm.print):
#         common_permissions['print'] = int(doc.get('print', 0))
#     if 'email' in doc and int(doc.get('email', 0)) == int(source_perm.email):
#         common_permissions['email'] = int(doc.get('email', 0))

#     return common_permissions

# def apply_common_permissions(target_perm, common_permissions):
#     """Apply common permissions to a permission document"""
#     # For each permission, check if it's in common_permissions
#     # If it is, use that value, otherwise set it to 0
#     if 'select' in common_permissions:
#         target_perm.select = common_permissions['select']
#     else:
#         target_perm.select = 0

#     if 'read' in common_permissions:
#         target_perm.read = common_permissions['read']
#     else:
#         target_perm.read = 0

#     if 'write' in common_permissions:
#         target_perm.write = common_permissions['write']
#     else:
#         target_perm.write = 0

#     if 'create' in common_permissions:
#         target_perm.create = common_permissions['create']
#     else:
#         target_perm.create = 0

#     if 'delete' in common_permissions:
#         target_perm.delete = common_permissions['delete']
#     else:
#         target_perm.delete = 0

#     if 'submit' in common_permissions:
#         target_perm.submit = common_permissions['submit']
#     else:
#         target_perm.submit = 0

#     if 'cancel' in common_permissions:
#         target_perm.cancel = common_permissions['cancel']
#     else:
#         target_perm.cancel = 0

#     if 'amend' in common_permissions:
#         target_perm.amend = common_permissions['amend']
#     else:
#         target_perm.amend = 0

#     if 'report' in common_permissions:
#         target_perm.report = common_permissions['report']
#     else:
#         target_perm.report = 0

#     if 'export' in common_permissions:
#         target_perm.export = common_permissions['export']
#     else:
#         target_perm.export = 0

#     if 'import' in common_permissions:
#         setattr(target_perm, 'import', common_permissions['import'])
#     else:
#         setattr(target_perm, 'import', 0)

#     if 'share' in common_permissions:
#         target_perm.share = common_permissions['share']
#     else:
#         target_perm.share = 0

#     if 'print' in common_permissions:
#         target_perm.print = common_permissions['print']
#     else:
#         target_perm.print = 0

#     if 'email' in common_permissions:
#         target_perm.email = common_permissions['email']
#     else:
#         target_perm.email = 0


@frappe.whitelist()
def copy_role_perms(doc):
	doc = frappe.parse_json(doc) if isinstance(doc, str) else doc

	role_from, role_to = doc.get("role_from"), doc.get("role_to")
	fields = ["name", "parent", "permlevel"]

	perms_from = frappe.get_all("Custom DocPerm", {"role": role_from}, fields, ignore_permissions=True)
	perms_to = frappe.get_all("Custom DocPerm", {"role": role_to}, fields, ignore_permissions=True)

	perms_to_map = {(p.parent, p.permlevel): p.name for p in perms_to}

	updated, created = 0, 0

	for perm in perms_from:
		src = frappe.get_doc("Custom DocPerm", perm.name)
		common = get_common_permissions(src, doc)

		if not common:
			continue

		key = (perm.parent, perm.permlevel)

		if key in perms_to_map:
			tgt = frappe.get_doc("Custom DocPerm", perms_to_map[key])
			apply_common_permissions(tgt, common)
			tgt.save()
			updated += 1
		else:
			new_doc = frappe.copy_doc(src)
			new_doc.role = role_to
			apply_common_permissions(new_doc, common)
			new_doc.insert()
			created += 1

	if updated or created:
		msg = f"{updated} updated, {created} created. <a href='/app/custom-docperm'>View Permissions</a>"
	else:
		msg = "No permissions updated or created"

	frappe.msgprint(msg)
	return True


def get_common_permissions(src, doc):
	fields_map = {
		"select": "select",
		"read": "read",
		"write": "write",
		"create": "create",
		"delete_to": "delete",
		"submit_to": "submit",
		"cancel_to": "cancel",
		"amend": "amend",
		"report": "report",
		"export": "export",
		"import_to": "import",
		"share": "share",
		"print": "print",
		"email": "email",
	}
	return {
		tgt: int(doc.get(src_field, 0))
		for src_field, tgt in fields_map.items()
		if int(doc.get(src_field, 0)) == int(getattr(src, tgt, 0))
	}


def apply_common_permissions(doc, perms):
	all_fields = [
		"select",
		"read",
		"write",
		"create",
		"delete",
		"submit",
		"cancel",
		"amend",
		"report",
		"export",
		"import",
		"share",
		"print",
		"email",
	]
	for field in all_fields:
		setattr(doc, field, perms.get(field, 0))


@frappe.whitelist()
def save_field_comment(
	doctype_name, docname, field_name, field_label, comment_text, is_external=0, status="Open"
):
	try:
		# Find or create the parent DocType Field Comment document
		existing_comments = frappe.get_all(
			"DocType Field Comment",
			filters={"doctype_name": doctype_name, "docname": docname, "field_name": field_name},
			fields=["name"],
		)

		if existing_comments and len(existing_comments) > 0:
			comment_doc = frappe.get_doc("DocType Field Comment", existing_comments[0].name)
		else:
			# Create new parent document
			comment_doc = frappe.get_doc(
				{
					"doctype": "DocType Field Comment",
					"doctype_name": doctype_name,
					"docname": docname,
					"field_name": field_name,
					"field_label": field_label,
					"status": status,  # Set initial status
				}
			)
			comment_doc.insert(ignore_permissions=True)

		# Create the child DocType Field Comment Log entry
		comment_log_entry = frappe.get_doc(
			{
				"doctype": "DocType Field Comment Log",
				"parent": comment_doc.name,
				"parenttype": "DocType Field Comment",
				"parentfield": "comment_log",
				"comment": comment_text,
				"user": frappe.session.user,
				"creation_date": frappe.utils.now_datetime(),
				"is_external": int(is_external),  # Convert to integer and use the passed value
			}
		)

		# Insert the child document, ignoring permissions
		comment_log_entry.insert(ignore_permissions=True)

		# Verify the comment was saved
		# saved_log = frappe.get_doc('DocType Field Comment Log', comment_log_entry.name)

		# Return the newly created comment log entry for UI update
		return {
			"name": comment_log_entry.name,
			"parent": comment_doc.name,
			"comment": comment_text,
			"user": frappe.session.user,
			"creation_date": comment_log_entry.creation_date,
			"is_external": comment_log_entry.is_external,
		}

	except Exception as e:
		frappe.log_error(
			f"Error in save_field_comment: {str(e)}\nTraceback: {frappe.get_traceback()}",
			"Comment Save Error",
		)
		return None


@frappe.whitelist()
def send_mention_notification(
	mentioned_user, comment_doc, doctype, docname, field_name, field_label, comment
):
	"""Send notification to mentioned user"""
	try:
		# Extract user from mention data
		mention_pattern = r'data-id="([^"]+)"'
		mentioned_users = re.findall(mention_pattern, comment)

		if not mentioned_users:
			return

		# Get user's full name
		from_user = frappe.utils.get_fullname(frappe.session.user)

		for user_email in mentioned_users:
			# Get user ID from email
			user_id = frappe.db.get_value("User", {"email": user_email}, "name")
			if not user_id:
				continue

			# Create notification message
			notification_message = (
				f"{from_user} mentioned you in a comment on {field_label} in {doctype} {docname}"
			)

			# Create Notification Log entry
			notification = frappe.new_doc("Notification Log")
			notification.for_user = user_id
			notification.from_user = frappe.session.user
			notification.type = "Mention"
			notification.document_type = doctype
			notification.document_name = docname
			notification.subject = notification_message
			notification.email_content = f"""
                <p>{from_user} mentioned you in a comment:</p>
                <p>{comment}</p>
                <p>Document: {doctype} {docname}</p>
                <p>Field: {field_label}</p>
            """
			notification.insert(ignore_permissions=True)

	except Exception as e:
		frappe.log_error(
			f"Error sending mention notification: {str(e)}", "DocType Field Comment Notification Error"
		)


# @frappe.whitelist()
# def get_comment_count(doctype_name, docname, field_name):
#     """Get the count of comments for a specific field"""
#     try:
#         frappe.log_error(f"Getting comment count for: {doctype_name} {docname} {field_name}", "Comment Count Debug")

#         # First verify if the document exists
#         doc_exists = frappe.db.exists(doctype_name, docname)
#         frappe.log_error(f"Document exists: {doc_exists}", "Comment Count Debug")

#         # Get the parent comment document with more detailed logging
#         comment_doc = frappe.get_all(
#             'DocType Field Comment',
#             filters={
#                 'doctype_name': doctype_name,
#                 'docname': docname,
#                 'field_name': field_name,
#                 'status': ['IN', ['Open', 'Resolved']]
#             },
#             fields=['name', 'doctype_name', 'docname', 'field_name'],
#             limit=1,
#             ignore_permissions=True
#         )

#         frappe.log_error(f"Found comment doc: {comment_doc}", "Comment Count Debug")

#         if not comment_doc:
#             frappe.log_error(f"No comment document found for {doctype_name} {docname} {field_name}", "Comment Count Error")
#             return 0

#         # Get the count of comment logs with detailed logging
#         # First, let's verify the parent document exists
#         parent_exists = frappe.db.exists('DocType Field Comment', comment_doc[0].name)
#         frappe.log_error(f"Parent document exists: {parent_exists}", "Comment Count Debug")

#         if not parent_exists:
#             frappe.log_error(f"Parent document {comment_doc[0].name} does not exist", "Comment Count Error")
#             return 0

#         # Get all comment logs for this parent
#         comment_logs = frappe.get_all(
#             'DocType Field Comment Log',
#             filters={
#                 'parent': comment_doc[0].name,
#                 'parenttype': 'DocType Field Comment',
#                 'parentfield': 'comment_log'
#             },
#             fields=['name', 'comment', 'user', 'creation_date'],
#             ignore_permissions=True
#         )

#         frappe.log_error(f"Comment logs found: {comment_logs}", "Comment Count Debug")

#         # Get the count
#         count = len(comment_logs)
#         frappe.log_error(f"Total count: {count}", "Comment Count Debug")

#         # If count is 0 but we have a parent document, verify the relationship
#         if count == 0:
#             # Check if there are any logs at all in the system
#             total_logs = frappe.db.count('DocType Field Comment Log')
#             frappe.log_error(f"Total logs in system: {total_logs}", "Comment Count Debug")

#             # Check if the parent field exists in the DocType Field Comment table
#             parent_field = frappe.db.get_value('DocType Field Comment', comment_doc[0].name, 'parentfield')
#             frappe.log_error(f"Parent field value: {parent_field}", "Comment Count Debug")

#             # Check if the comment_log table field exists
#             table_field = frappe.db.get_value('DocType Field Comment', comment_doc[0].name, 'comment_log')
#             frappe.log_error(f"Table field value: {table_field}", "Comment Count Debug")

#         return count
#     except Exception as e:
#         frappe.log_error(f"Error in get_comment_count: {str(e)}\nTraceback: {frappe.get_traceback()}", "Comment Count Error")
#         return 0


@frappe.whitelist()
def create_new_comment_thread(doctype_name, docname, field_name, field_label):
	"""Create a new comment thread for a field"""
	try:
		# Create new parent document
		comment_doc = frappe.get_doc(
			{
				"doctype": "DocType Field Comment",
				"doctype_name": doctype_name,
				"docname": docname,
				"field_name": field_name,
				"field_label": field_label,
				"status": "Open",  # Set initial status
			}
		)
		comment_doc.insert(ignore_permissions=True)

		return comment_doc.name
	except Exception as e:
		frappe.log_error(f"Error creating new comment thread: {str(e)}")
		return None


def get_usr_type_roll():
	user_roll = ""
	user_type = ""
	try:
		# Get all parent comment documents for the field
		sva_usr_exists = frappe.db.exists("SVA User", {"email": frappe.session.user})
		if sva_usr_exists:
			user_roll = frappe.db.get_value("SVA User", {"email": frappe.session.user}, "role_profile")
		else:
			user_roll = frappe.db.get_value(
				"User Role Profile", {"parent": frappe.session.user}, "role_profile"
			)
		try:
			if user_roll:
				user_type = frappe.db.get_value("Role Profile", user_roll, "custom_belongs_to")
			else:
				user_type = ""
		except Exception as e:
			frappe.log_error(f"Error in load_field_comments: {str(e)}")
		return user_type
	except Exception as e:
		frappe.log_error(f"Error in get_usr_type_roll: {str(e)}")
		return ""


@frappe.whitelist()
def load_field_comments(doctype_name, docname, field_name):
	"""Load all comment threads for a specific field"""
	try:
		user_type = get_usr_type_roll()
		comment_docs = frappe.get_all(
			"DocType Field Comment",
			filters={"doctype_name": doctype_name, "docname": docname, "field_name": field_name},
			fields=["name", "status"],
			order_by="creation desc",  # Most recent first
			ignore_permissions=True,
		)

		if not comment_docs:
			return {"threads": []}

		# Get all comment logs for these parent documents
		threads = []
		for doc in comment_docs:
			filters = {
				"parent": doc.name,
				"parenttype": "DocType Field Comment",
				"parentfield": "comment_log",
			}

			if user_type == "NGO":
				filters["is_external"] = 1

			comment_logs = frappe.get_all(
				"DocType Field Comment Log",
				filters=filters,
				fields=["name", "comment", "user", "creation_date", "is_external"],
				order_by="creation_date asc",
				ignore_permissions=True,
			)
			threads.append({"name": doc.name, "status": doc.status, "comments": comment_logs})

		return {"threads": threads}

	except Exception as e:
		frappe.log_error(f"Error in load_field_comments: {str(e)}")
		return {"threads": []}


@frappe.whitelist()
def load_all_comments(doctype_name, docname):
	"""Load all comments for a document"""
	try:
		# Get all parent comment documents for the document
		user_type = get_usr_type_roll()

		comment_docs = frappe.get_all(
			"DocType Field Comment",
			filters={"doctype_name": doctype_name, "docname": docname},
			fields=["name", "field_name", "field_label", "status"],
			ignore_permissions=True,
		)

		if not comment_docs:
			return []

		# Get all comment logs for these parent documents
		all_comments = []
		for doc in comment_docs:
			filters = {
				"parent": doc.name,
				"parenttype": "DocType Field Comment",
				"parentfield": "comment_log",
			}
			if user_type == "NGO":
				filters["is_external"] = 1

			comment_logs = frappe.get_all(
				"DocType Field Comment Log",
				filters=filters,
				fields=["name", "comment", "user", "creation_date", "is_external"],
				order_by="creation_date asc",
				ignore_permissions=True,
			)

			all_comments.append(
				{
					"field_name": doc.field_name,
					"field_label": doc.field_label,
					"status": doc.status,
					"comments": comment_logs,
				}
			)
		return all_comments

	except Exception as e:
		frappe.log_error(f"Error in load_all_comments: {str(e)}")
		return []


@frappe.whitelist()
def get_all_field_comment_counts(doctype_name, docname):
	"""Get comment counts for all fields in a document in a single call"""
	try:
		# Get user type for filtering
		user_type = get_usr_type_roll()

		# Get all parent comment documents for the document
		comment_docs = frappe.get_all(
			"DocType Field Comment",
			filters={
				"doctype_name": doctype_name,
				"docname": docname,
				"status": ["IN", ["Open", "Resolved"]],
			},
			fields=["name", "field_name"],
			ignore_permissions=True,
		)
		if not comment_docs:
			return {}

		# Create a dictionary to store counts
		field_counts = {}

		# Get all comment logs for these parent documents
		for doc in comment_docs:
			filters = {
				"parent": doc.name,
				"parenttype": "DocType Field Comment",
				"parentfield": "comment_log",
			}

			# For NGO users, only count external comments
			if user_type == "NGO":
				filters["is_external"] = 1

			count = frappe.db.count("DocType Field Comment Log", filters=filters)
			field_counts[doc.field_name] = count

		return field_counts

	except Exception as e:
		frappe.log_error(f"Error in get_all_field_comment_counts: {str(e)}")
		return {}


@frappe.whitelist()
def update_comment_external_flag(comment_name, is_external):
	"""Update the external flag for a comment"""
	try:
		# Check if the comment exists
		if not frappe.db.exists("DocType Field Comment Log", comment_name):
			frappe.throw(f"Comment {comment_name} does not exist")
		# Update the external flag
		frappe.db.set_value("DocType Field Comment Log", comment_name, "is_external", is_external)

		return True
	except Exception as e:
		frappe.log_error(f"Error updating external flag for comment {comment_name}: {str(e)}")
		return False


@frappe.whitelist()
def get_total_open_resolved_comment_count(doctype_name, docname):
	"""Return the total count of open and resolved comments for a document"""
	try:
		field_counts = get_all_field_comment_counts(doctype_name, docname)
		total = sum(field_counts.values()) if field_counts else 0
		return total
	except Exception as e:
		frappe.log_error(f"Error in get_total_open_resolved_comment_count: {str(e)}")
		return 0


@frappe.whitelist()
def get_eligible_users_for_task(doctype, txt, searchfield, start, page_length, filters):
	"""Get eligible users for a task"""
	try:
		txt = f"%{txt}%" if txt else "%"
		ngo = filters.get("ngo") if filters else None

		condition = "sva.email LIKE %(txt)s"
		if ngo:
			condition += " AND ngo.name = %(ngo)s"

		query = f"""
            SELECT
                sva.email,
                sva.full_name
            FROM `tabNGO` AS ngo
            LEFT JOIN `tabUser Permission` AS up ON ngo.name = up.for_value
            LEFT JOIN `tabSVA User` AS sva ON up.user = sva.email
            WHERE {condition}
            LIMIT {int(start)}, {int(page_length)}
        """

		return frappe.db.sql(query, {"txt": txt, "ngo": ngo})
	except Exception as e:
		frappe.log_error(f"Error in get_eligible_users_for_task: {str(e)}")
		return []


@frappe.whitelist()
def get_workflow_count(doctype):
	wf_field = frappe.get_cached_value(
		"Workflow", {"document_type": doctype, "is_active": 1}, "workflow_state_field"
	)
	if not wf_field:
		return []

	sql = f"""
        SELECT
            wfs.state AS state,
            COALESCE(COUNT(DISTINCT tab.name), 0) AS count,
            ws.style
        FROM `tabWorkflow` AS w
        LEFT JOIN `tabWorkflow Document State` AS wfs ON wfs.parent = w.name
        LEFT JOIN `tabWorkflow State` AS ws ON ws.name = wfs.state
        LEFT JOIN `tab{doctype}` AS tab ON tab.{wf_field} = wfs.state
        WHERE w.document_type = %s AND w.is_active = 1
        GROUP BY wfs.state
        ORDER BY wfs.state
    """

	return frappe.db.sql(sql, (doctype,), as_dict=True)


@frappe.whitelist()
def workflow_doctype_query(current_doctype):
	"""Return workflows allowed by SVADatatable Configuration for given doctype,
	including either link_fieldname or dn_reference_field depending on type."""

	if not current_doctype:
		return {"options": [], "option_map": {}}

	if not frappe.db.exists("SVADatatable Configuration", current_doctype):
		return {"options": [], "option_map": {}}

	conf_doc = frappe.get_doc("SVADatatable Configuration", current_doctype).as_dict()

	doctypes_info = {}

	if not len(conf_doc.get("child_doctypes", [])):
		return {"options": [], "option_map": {}}
	for row in conf_doc.get("child_doctypes", []):
		if row.get("connection_type") not in ["Direct", "Referenced", "Unfiltered"]:
			continue
		else:
			link_doctype = row.get("link_doctype") or row.get("referenced_link_doctype")
			if link_doctype and link_doctype not in doctypes_info:
				doctypes_info[link_doctype] = row

	if not doctypes_info:
		return {"options": [], "option_map": {}}

	doctypes_to_check = list(doctypes_info.keys())

	workflows = frappe.db.sql(
		f"""
        SELECT name,document_type
        FROM `tabWorkflow`
        WHERE is_active = 1
        AND document_type IN ({", ".join(["%s"] * len(doctypes_to_check))})
        ORDER BY document_type
    """,
		tuple(doctypes_to_check),
		as_dict=True,
	)

	if not len(workflows):
		return {"options": [], "option_map": {}}

	options = []
	option_map = {}
	for workflow in workflows:
		if workflow.document_type in doctypes_info:
			options.append(workflow.document_type)
			option_map[workflow.document_type] = doctypes_info[workflow.document_type]

	return {"options": options, "option_map": option_map}


@frappe.whitelist()
def get_files(doctype, docname):
	all_doctype = [doctype]
	all_docname = [docname]

	try:
		if frappe.db.exists("SVADatatable Configuration", doctype):
			get_config = frappe.get_doc("SVADatatable Configuration", doctype)
	except frappe.DoesNotExistError:
		frappe.log_error(
			title="SVADatatable Configuration missing",
			message=f"No SVADatatable Configuration found for doctype: {doctype}",
		)
		# Optionally, return empty list or a specific error message
		return []
	except Exception as e:
		frappe.log_error(title="Error fetching SVADatatable Configuration", message=str(e))
		return []

	try:
		for child in get_config.child_doctypes:
			if child.connection_type == "Direct" and child.link_doctype:
				if frappe.has_permission(child.link_doctype, "read"):
					all_doctype.append(child.link_doctype)
					docname_list = frappe.get_all(
						child.link_doctype, filters={child.link_fieldname: docname}, fields=["name"]
					)
					all_docname.extend([doc.name for doc in docname_list])
			elif (
				child.connection_type == "Referenced"
				and child.referenced_link_doctype
				and child.dn_reference_field
			):
				if frappe.has_permission(child.referenced_link_doctype, "read"):
					all_doctype.append(child.referenced_link_doctype)
					docname_list = frappe.get_all(
						child.referenced_link_doctype,
						filters={child.dn_reference_field: docname},
						fields=["name"],
					)
					all_docname.extend([doc.name for doc in docname_list])
			elif child.connection_type == "Indirect" and child.link_doctype:
				pass
				# skipping this part for future enhancement
			elif child.connection_type == "Is Custom Design":
				# skipping this part for future enhancement
				pass

	except Exception as e:
		frappe.log_error(title="Error in get_files config from svadatatable configuration", message=str(e))

	try:
		file_list = frappe.get_all(
			"File",
			filters={
				"attached_to_name": ["in", all_docname],
				"attached_to_doctype": ["in", all_doctype],
				"is_folder": 0,
			},
			fields=[
				"name",
				"file_url",
				"attached_to_doctype",
				"folder",
				"attached_to_name",
				"attached_to_field",
				"owner",
				"file_name",
				"file_type",
				"file_size",
				"creation",
			],
			as_list=False,
		)
		return file_list
	except Exception as e:
		frappe.log_error(title="Error fetching files", message=str(e))
		return []


@frappe.whitelist()
def get_folders(doctype: str = None, docname: str = None):
	"""Return list of File folders: Home, Home/Attachments (global) + folders linked to the document."""
	# Global folders (always shown)
	global_folders = [
		{"name": "Home", "file_name": "Home"},
		{"name": "Home/Attachments", "file_name": "Attachments"},
	]

	# Include any other top-level global folders that exist under Home
	root_folders = frappe.get_all(
		"File",
		filters={
			"is_folder": 1,
			"folder": "Home",
			"attached_to_doctype": ["is", "not set"],
		},
		fields=["name", "file_name"],
		order_by="file_name asc",
	)

	seen = {"Home", "Home/Attachments"}
	combined = list(global_folders)
	for f in root_folders:
		if f["name"] not in seen:
			seen.add(f["name"])
			combined.append(f)

	# Document-specific folders (created with attached_to_name)
	doc_folders = []
	if doctype and docname:
		doc_folders = frappe.get_all(
			"File",
			filters={
				"is_folder": 1,
				"attached_to_doctype": doctype,
				"attached_to_name": docname,
			},
			fields=["name", "file_name"],
			order_by="file_name asc",
		)

	for f in doc_folders:
		if f["name"] not in seen:
			seen.add(f["name"])
			combined.append(f)

	return combined


@frappe.whitelist()
def upload_file_to_folder(
	doctype: str,
	docname: str,
	file_url: str,
	folder: str | None = None,
	file_name: str | None = None,
):
	"""Move an already-uploaded file into the chosen folder."""
	if not file_url:
		frappe.throw(_("file_url is required"))

	# Find the file doc attached to this specific document
	filters = {"file_url": file_url, "attached_to_doctype": doctype, "attached_to_name": docname}
	file_doc_name = frappe.db.get_value("File", filters, "name")

	if not file_doc_name:
		# Constrained fallback: match by file_url + current user (owner) + created in the last 5 minutes
		file_doc_name = frappe.db.get_value(
			"File",
			{
				"file_url": file_url,
				"owner": frappe.session.user,
				"creation": (">=", frappe.utils.add_to_date(None, minutes=-5)),
			},
			"name",
			order_by="creation desc",
		)

	if not file_doc_name:
		frappe.throw(_("Uploaded file not found"))

	file_doc = frappe.get_cached_doc("File", file_doc_name)

	if folder:
		file_doc.folder = folder

	if file_name:
		file_doc.file_name = file_name

	file_doc.save(ignore_permissions=False)
	return file_doc.as_dict()


@frappe.whitelist()
def export_customizations(doctype: str, with_permissions: bool = False):
	"""
	Export custom fields, property setters, permissions for a DocType (and child tables)
	and return as downloadable JSON.
	"""
	with_permissions = cint(with_permissions)

	def get_customizations(dt):
		custom = {
			"custom_fields": frappe.get_all("Custom Field", fields="*", filters={"dt": dt}, order_by="name"),
			"property_setters": frappe.get_all(
				"Property Setter", fields="*", filters={"doc_type": dt}, order_by="name"
			),
			"custom_perms": [],
			"links": frappe.get_all("DocType Link", fields="*", filters={"parent": dt}, order_by="name"),
			"doctype": dt,
		}
		if with_permissions:
			custom["custom_perms"] = frappe.get_all(
				"Custom DocPerm", fields="*", filters={"parent": dt}, order_by="name"
			)
		return custom

	# Main DocType customizations
	data = get_customizations(doctype)

	# Child table customizations
	for d in frappe.get_meta(doctype).get_table_fields():
		data[f"child_{d.options}"] = get_customizations(d.options)

	return frappe.as_json(data)


@frappe.whitelist()
def export_multiple_customizations(doctypes: list[str] | str, with_permissions: bool = False):
	"""
	Export customizations for multiple doctypes at once.
	Accepts a list of doctypes (from dialog table) and returns a JSON blob.
	"""
	if isinstance(doctypes, str):
		import json

		doctypes = json.loads(doctypes)

	all_data = {}

	for dt in doctypes:
		doctype_name = dt.get("doctype_name") if isinstance(dt, dict) else dt
		# Directly call function in same file
		data = export_customizations(doctype_name, with_permissions)
		import json

		all_data[doctype_name] = json.loads(data)

	return frappe.as_json(all_data)


import frappe
from frappe.modules.utils import sync_customizations_for_doctype


def _apply_customizations(custom_data: dict):
	"""
	Core logic for applying customizations for a single doctype
	and its child tables. Used by both single and multiple import.
	"""
	# Ensure JSON contains main doctype key
	if not custom_data.get("doctype"):
		frappe.throw(_("Invalid JSON: 'doctype' missing."))

	main_doctype = custom_data["doctype"]

	# ---------------- Apply main doctype customizations ----------------
	sync_customizations_for_doctype(custom_data, folder="", filename=f"{main_doctype}.json")

	# ---------------- Apply customizations for child tables (if any) ----------------
	for key, value in custom_data.items():
		if key.startswith("child_") and isinstance(value, dict):
			child_dt = value.get("doctype")
			if child_dt:
				sync_customizations_for_doctype(value, folder="", filename=f"{child_dt}.json")

	frappe.clear_cache(doctype=main_doctype)
	return main_doctype


@frappe.whitelist()
def import_customizations(file_url: str, target_doctype: str):
	"""
	Import customizations for a single doctype (and its child tables).
	- Validates file content
	- Ensures correct doctype match
	- Applies customizations via _apply_customizations
	"""
	try:
		# ---------------- Read uploaded file from File doctype ----------------
		file_doc = frappe.get_doc("File", {"file_url": file_url})
		content = file_doc.get_content()
		data = json.loads(content)

		if not data.get("doctype"):
			raise frappe.ValidationError("Doctype attribute not found in data.")
		if data["doctype"] != target_doctype:
			raise frappe.ValidationError(
				f"Importing customizations for wrong doctype: <b>{data['doctype']}</b>"
			)

		applied_dt = _apply_customizations(data)
		return {"status": "success", "message": f"Customizations imported for {applied_dt} and child tables"}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Import Customizations Error")
		frappe.throw(f"Failed to import customizations: {str(e)}")


@frappe.whitelist()
def import_multiple_customizations(file_url: str):
	"""
	Import customizations for multiple doctypes (and child tables).
	JSON must match output of download_multiple_customizations.
	- Iterates over each doctype
	- Applies customizations individually
	"""
	try:
		file_doc = frappe.get_doc("File", {"file_url": file_url})
		content = file_doc.get_content()
		data = json.loads(content)

		if not isinstance(data, dict):
			frappe.throw(_("Invalid JSON format. Expected dict of doctypes."))

		imported, errors = [], []

		# ---------------- Iterate and apply each doctype ----------------
		for doctype_name, custom_data in data.items():
			try:
				applied_dt = _apply_customizations(custom_data)
				imported.append(applied_dt)
			except Exception as inner_e:
				frappe.log_error(frappe.get_traceback(), f"Import Error for {doctype_name}")
				errors.append(f"{doctype_name}: {str(inner_e)}")

		return {
			"status": "completed",
			"imported": imported,
			"errors": errors,
			"message": f"Imported {len(imported)} doctypes, {len(errors)} failed.",
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Import Multiple Customizations Error")
		frappe.throw(f"Failed to import multiple customizations: {str(e)}")


from frappe.utils.response import build_response


@frappe.whitelist()
def export_fixture_single_doctype(docname):
	"""
	Export data for a single SVAFixture record as downloadable JSON.
	Returns just the array of records (like fixtures), not wrapped in a dict.
	"""
	import json

	fx = frappe.get_doc("SVAFixture", docname)
	filters_data = json.loads(fx.filters) if fx.filters else {}

	def get_records(doctype, filters_data):
		filters = filters_data.get("filters", {})
		or_filters = filters_data.get("or_filters", [])
		meta = frappe.get_meta(doctype)

		if meta.issingle:
			return []

		return frappe.get_all(
			doctype, fields="*", filters=filters, or_filters=or_filters, order_by="creation asc"
		)

	# Just return the array, no wrapping object
	records = get_records(fx.ref_doctype, filters_data)

	return frappe.as_json(records)


@frappe.whitelist()
def export_fixtures_runtime():
	"""
	Export fixtures (with filters & or_filters) as downloadable JSON.
	"""
	export_data = {}
	for fx in frappe.get_all("SVAFixture", fields=["ref_doctype", "name"]):
		data = export_fixture_single_doctype(fx.name)
		if isinstance(data, str):
			export_data[fx.ref_doctype] = json.loads(data)
		else:
			export_data[fx.ref_doctype] = data

	return frappe.as_json(export_data)


import os

from frappe.core.doctype.data_import.data_import import import_doc


def import_records_to_doctype(doctype, records):
	"""
	Add 'doctype' to each record, save modified JSON to a temp file,
	import the data using import_doc, and then remove the temp file.
	"""
	# Add 'doctype' to each record
	for record in records:
		record["doctype"] = doctype

	# Save modified JSON to a temporary file
	tmp_path = os.path.join(frappe.get_site_path("private", "files"), f"tmp_{doctype}.json")
	with open(tmp_path, "w", encoding="utf-8") as f:
		json.dump(records, f, indent=2)

	# Import records from temp JSON
	import_doc(tmp_path, sort=True)
	os.remove(tmp_path)


@frappe.whitelist()
def import_fixture_single_doctype(file_url, fixture_name):
	"""
	Import single-doctype fixture from a JSON file uploaded via Attach field.
	Uses the 'ref_doctype' from SVAFixture for setting 'doctype'.
	"""
	try:
		# Get the File doc
		file_docs = frappe.get_all("File", filters={"file_url": file_url}, fields=["name"])
		if not file_docs:
			return {"status": "error", "message": "File not found."}

		file_doc = frappe.get_doc("File", file_docs[0].name)
		file_path = file_doc.get_full_path()

		# Check if file exists on disk
		if not os.path.exists(file_path):
			return {"status": "error", "message": "File not found on disk."}

		# Get the fixture document to read ref_doctype
		fixture_doc = frappe.get_doc("SVAFixture", fixture_name)
		target_doctype = fixture_doc.ref_doctype
		if not target_doctype:
			return {"status": "error", "message": "ref_doctype not set in SVAFixture."}

		# Load records from JSON file
		with open(file_path, encoding="utf-8") as f:
			records = json.load(f)

		# Import records into the target_doctype
		import_records_to_doctype(target_doctype, records)

		return {"status": "success", "message": f"Fixtures imported successfully into {target_doctype}"}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Fixture Import Error")
		return {"status": "error", "message": str(e)}


@frappe.whitelist()
def import_fixtures_runtime(file_url):
	"""
	Import a runtime-exported JSON file.
	The JSON must be like:
	{
	    "District": [...],
	    "State": [...],
	    ...
	}
	Each key is a DocType, value is a list of records.
	"""
	try:
		# Get File doc
		file_docs = frappe.get_all("File", filters={"file_url": file_url}, fields=["name"])
		if not file_docs:
			return {"status": "error", "message": "File not found."}

		file_doc = frappe.get_doc("File", file_docs[0].name)
		file_path = file_doc.get_full_path()

		# Check if file exists on disk
		if not os.path.exists(file_path):
			return {"status": "error", "message": "File not found on disk."}

		# Read JSON data (multiple doctypes)
		with open(file_path, encoding="utf-8") as f:
			data = json.load(f)

		# Loop through each DocType in JSON and import
		for doctype, records in data.items():
			if not records:
				continue  # Skip empty arrays
			import_records_to_doctype(doctype, records)

		return {"status": "success", "message": "All fixtures imported successfully!"}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Fixture Import Error")
		return {"status": "error", "message": str(e)}


from frappe.model.document import Document
from frappe.model.workflow import WorkflowStateError, get_workflow, is_transition_condition_satisfied


@frappe.whitelist()
def get_user_wise_transitions(doc: Union["Document", str, dict], user=None) -> list[dict]:
	"""Return list of possible transitions for the given doc"""
	if not isinstance(doc, Document):
		doc = frappe.get_doc(frappe.parse_json(doc))
		doc.load_from_db()

	if doc.is_new():
		return []

	doc.check_permission("read")

	workflow = get_workflow(doc.doctype)
	current_state = doc.get(workflow.workflow_state_field)

	if not current_state:
		frappe.throw(_("Workflow State not set"), WorkflowStateError)

	transitions = []
	roles = frappe.get_roles(username=user) if user else frappe.get_roles()
	for transition in workflow.transitions:
		if transition.state == current_state and transition.allowed in roles:
			if not is_transition_condition_satisfied(transition, doc):
				continue
			transitions.append(transition.as_dict())

	return transitions


@frappe.whitelist()
def get_documents_with_available_transitions(doctype, user=None):
	exists_wf = frappe.db.exists("Workflow", {"is_active": 1, "document_type": doctype}, True)
	if not exists_wf:
		return []
	wf = frappe.get_doc("Workflow", exists_wf)
	positive_closure = get_state_closure_by_type(doctype)
	negative_closure = get_state_closure_by_type(doctype, "Negative")
	doc_lists = frappe.get_all(
		wf.document_type,
		filters={wf.workflow_state_field: ["not in", [positive_closure, negative_closure]]},
		pluck="name",
	)
	result = []
	for doc in doc_lists:
		doc = frappe.get_doc(wf.document_type, doc)
		transitions = get_user_wise_transitions(doc, user=user)
		if len(transitions) > 0:
			result.append(doc.name)
	return result


@frappe.whitelist()
def get_workflow_based_users(doctype):
	check_existing_workflow = frappe.db.exists("Workflow", {"is_active": 1, "document_type": doctype}, True)
	if not check_existing_workflow:
		return []
	workflow = frappe.get_doc("Workflow", check_existing_workflow).as_dict()
	transitions = workflow.get("transitions", [])

	transition_roles = set()
	for transition in transitions:
		role = transition.get("allowed", None)
		if role:
			transition_roles.add(role)
	users = []
	role_users = frappe.get_all(
		"Has Role",
		filters={
			"role": ["in", list(transition_roles)],
			"parenttype": "User",
			"parent": ["!=", frappe.session.user],
		},
		pluck="parent",
	)

	users = frappe.get_all(
		"User", filters={"name": ["in", role_users]}, fields=["email as value", "full_name as label"]
	)

	return list(users)


@frappe.whitelist()
def get_approval_trakcer_module_options():
	data = frappe.get_all(
		"Workflow",
		filters=[
			["Workflow", "is_active", "=", 1],
			["Workflow Transition", "allowed", "in", frappe.get_roles()],
		],
		distinct=True,
		fields=["document_type as value", "workflow_name as label"],
		order_by="workflow_name asc",
	)
	return data
