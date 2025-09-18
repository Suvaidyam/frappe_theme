import frappe
import json
from frappe import _
import re
from frappe.utils import cint
from frappe.custom.doctype.custom_field.custom_field import create_custom_field

@frappe.whitelist(allow_guest=True)
def get_my_theme():
    return frappe.get_doc("My Theme")


@frappe.whitelist(allow_guest=True)
def get_property_set(doctype):
        return frappe.db.get_list("Property Setter", fields=["*"] , filters={"doc_type": doctype,"property":['IN',["filter_by","link_filter","wf_state_field"]]},ignore_permissions=True)
    

@frappe.whitelist()
def get_doctype_fields(doctype):
    custom_fields = frappe.get_all("Custom Field", filters={"dt": doctype}, fields=["*"],ignore_permissions=True)
    dt = frappe.get_doc("DocType", doctype,ignore_permissions=True)
    if len(custom_fields) > 0:
        dt.fields.extend(custom_fields)
    return dt

@frappe.whitelist()
def get_my_list_settings(doctype):
	try:
		return frappe.get_cached_doc("List View Settings", doctype,ignore_permissions=True)
	except frappe.DoesNotExistError:
		frappe.clear_messages()

@frappe.whitelist()
def get_meta_fields(doctype):
    meta_fields = frappe.get_meta(doctype).fields
    property_setters = frappe.get_all('Property Setter', 
                                      filters={'doc_type': doctype}, 
                                      fields=['field_name', 'property', 'value'],ignore_permissions=True)
    # Convert meta_fields into mutable dictionaries if necessary
    fields_dict = [f.as_dict() for f in meta_fields if f.fieldtype not in ['Tab Break']]
    # Apply property setter values to the meta fields
    for field in fields_dict:
        for ps in property_setters:
            if field.get('fieldname') == ps.field_name:
                # Dynamically set the field property
                field[ps.property] = ps.value
    
    return fields_dict

@frappe.whitelist()
def get_permissions(doctype,_type='Direct'):
    permissions = []
    if _type == 'Report':
        permissions.append('read')
    else:
        if frappe.has_permission(doctype,'read'):
            permissions.append('read')
        if frappe.has_permission(doctype,'write'):
            permissions.append('write')
        if frappe.has_permission(doctype,'create'):
            permissions.append('create')
        if frappe.has_permission(doctype,'delete'):
            permissions.append('delete')
        if frappe.has_permission(doctype,'submit'):
            permissions.append('submit')
        if frappe.has_permission(doctype,'cancel'):
            permissions.append('cancel')
        if frappe.has_permission(doctype,'print'):
            permissions.append('print')
    return permissions

@frappe.whitelist() 
def get_meta(doctype):
    frappe.flags.ignore_permissions = True
    return frappe.get_meta(doctype).as_dict()


@frappe.whitelist()
def get_html_fields(doctype):
    try:
        doctype_meta = frappe.get_meta(doctype)
        html_fields = [field.fieldname for field in doctype_meta.fields 
                      if field.fieldtype == "HTML"]
        return html_fields
    except Exception as e:
        frappe.log_error(f"Error getting HTML fields for {doctype}: {str(e)}")
        return []

@frappe.whitelist()
def execute_number_card_query(report_name, filters=None):
    try:
        # Get the report document
        report_doc = frappe.get_doc('Report', report_name)
        if not report_doc or not report_doc.query:
            frappe.throw('Report not found or invalid')

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
                field = field.strip('\'"')
                
                # Safely format the value based on type
                if isinstance(value, (int, float)):
                    where_conditions.append(f"{field} = {value}")
                else:
                    # Remove any existing quotes and escape single quotes in the value
                    value = str(value).strip('\'"').replace("'", "\\'") 
                    where_conditions.append(f"{field} = '{value}'")

            if where_conditions:
                query += " WHERE " + " AND ".join(where_conditions)
        
        # Execute the query
        result = frappe.db.sql(query, as_dict=True)
        
        # Get column information by creating a temporary table
        temp_table_name = f'temp_report_{frappe.generate_hash()[:10]}'
        try:
            # Create temporary table
            frappe.db.sql(f'CREATE TEMPORARY TABLE `{temp_table_name}` AS {base_query}')
            
            # Get column information
            columns = frappe.db.sql(f'DESCRIBE `{temp_table_name}`', as_dict=True)
            column_types = {col.Field: col.Type for col in columns}
            
            return {
                'result': result,
                'column_types': column_types
            }
        finally:
            # Clean up temporary table
            frappe.db.sql(f'DROP TEMPORARY TABLE IF EXISTS `{temp_table_name}`')
    except Exception as e:
        frappe.log_error(f"Error executing number card query: {str(e)}")
        return None


@frappe.whitelist()
def get_linked_doctype_fields(doc_type, frm_doctype):
    """Get linked fields between two doctypes"""
    try:
        # Get standard fields
        res = frappe.get_list('DocField', 
            filters={
                'parent': doc_type,
                'fieldtype': 'Link',
                'options': ['IN', ['DocType', frm_doctype]]
            },
            fields=['fieldname', 'options'],
            ignore_permissions=True
        )

        # Get custom fields
        cus_ref_res = frappe.get_list('Custom Field',
            filters={
                'dt': doc_type,
                'fieldtype': 'Link',
                'options': ['IN', ['DocType', frm_doctype]]
            },
            fields=['fieldname', 'options'],
            ignore_permissions=True
        )

        # Combine and filter fields
        filds = res + cus_ref_res
        filds = [f for f in filds if f.fieldname not in ["amended_from", "parent_grant"]]

        if not filds:
            return None

        field = filds[0]
        result = {'field': field}

        if field.options == 'DocType':
            # Get standard dynamic link fields
            fieldname = frappe.get_list('DocField',
                filters={
                    'parent': doc_type,
                    'fieldtype': 'Dynamic Link',
                    'options': field.fieldname
                },
                fields=['fieldname'],
                ignore_permissions=True
            )

            # Get custom dynamic link fields
            fieldname2 = frappe.get_list('Custom Field',
                filters={
                    'dt': doc_type,
                    'fieldtype': 'Dynamic Link',
                    'options': field.fieldname
                },
                fields=['fieldname'],
                ignore_permissions=True
            )

            fieldname3 = fieldname + fieldname2
            if fieldname3:
                result['final_field'] = fieldname3[0]
        return result

    except Exception as e:
        frappe.log_error(f"Error in get_linked_doctype_fields: {str(e)}")
        return None

@frappe.whitelist()
def get_versions(dt, dn, page_length, start, filters=None):
    if isinstance(filters, str):
        filters = json.loads(filters)

    # ✅ Ensure integers for LIMIT/OFFSET
    page_length = int(page_length or 20)
    start = int(start or 0)

    conditions = ["ver.ref_doctype = %(dt)s", "ver.docname = %(dn)s"]
    params = {"dt": dt, "dn": dn, "page_length": page_length, "start": start}

    if filters and isinstance(filters, dict):
        if filters.get("doctype"):
            conditions.append(
                "(ver.custom_actual_doctype = %(doctype)s OR "
                "(COALESCE(ver.custom_actual_doctype, '') = '' AND ver.ref_doctype = %(doctype)s))"
            )
            params["doctype"] = filters["doctype"]

        if filters.get("owner"):
            conditions.append("usr.full_name LIKE %(owner)s")
            params["owner"] = filters["owner"] + "%"

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT
            ver.name,
            ver.owner,
            ver.creation,
            ver.custom_actual_doctype,
            ver.custom_actual_document_name,
            ver.ref_doctype,
            ver.docname,
            ver.data,
            usr.full_name AS owner_fullname
        FROM `tabVersion` ver
        LEFT JOIN `tabUser` usr ON ver.owner = usr.name
        WHERE {where_clause}
        ORDER BY ver.creation DESC
        LIMIT %(page_length)s OFFSET %(start)s
    """
    rows = frappe.db.sql(sql, params, as_dict=True)

    # 🔄 Post-process JSON changes in Python
    results = []
    for r in rows:
        data = frappe.parse_json(r.get("data") or "{}")
        changed = []
        for field_change in data.get("changed", []):
            fieldname, old_val, new_val = field_change

            # Lookup field label
            label = frappe.db.get_value("DocField",
                {"fieldname": fieldname, "parent": r.ref_doctype}, "label"
            ) or frappe.db.get_value("DocField",
                {"fieldname": fieldname, "parent": r.custom_actual_doctype}, "label"
            ) or frappe.db.get_value("Custom Field",
                {"fieldname": fieldname, "dt": r.ref_doctype}, "label"
            ) or frappe.db.get_value("Custom Field",
                {"fieldname": fieldname, "dt": r.custom_actual_doctype}, "label"
            ) or fieldname

            changed.append([
                label,
                "(blank)" if not old_val or old_val == "null" else old_val,
                "(blank)" if not new_val or new_val == "null" else new_val,
            ])

        results.append({
            "custom_actual_doctype": r.custom_actual_doctype,
            "custom_actual_document_name": r.custom_actual_document_name,
            "ref_doctype": r.ref_doctype,
            "owner": r.owner_fullname,
            "creation": r.creation,
            "docname": r.docname,
            "changed": changed,
        })

    return results

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

@frappe.whitelist()
def copy_role_perms(doc):
    doc = frappe.parse_json(doc) if isinstance(doc, str) else doc

    role_from, role_to = doc.get('role_from'), doc.get('role_to')
    fields = ['name', 'parent', 'permlevel']

    perms_from = frappe.get_all('Custom DocPerm', {'role': role_from}, fields, ignore_permissions=True)
    perms_to = frappe.get_all('Custom DocPerm', {'role': role_to}, fields, ignore_permissions=True)

    perms_to_map = {(p.parent, p.permlevel): p.name for p in perms_to}

    updated, created = 0, 0

    for perm in perms_from:
        src = frappe.get_doc('Custom DocPerm', perm.name)
        common = get_common_permissions(src, doc)

        if not common:
            continue

        key = (perm.parent, perm.permlevel)

        if key in perms_to_map:
            tgt = frappe.get_doc('Custom DocPerm', perms_to_map[key])
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
        'select': 'select', 'read': 'read', 'write': 'write', 'create': 'create',
        'delete_to': 'delete', 'submit_to': 'submit', 'cancel_to': 'cancel',
        'amend': 'amend', 'report': 'report', 'export': 'export', 'import_to': 'import',
        'share': 'share', 'print': 'print', 'email': 'email'
    }
    return {
        tgt: int(doc.get(src_field, 0))
        for src_field, tgt in fields_map.items()
        if int(doc.get(src_field, 0)) == int(getattr(src, tgt, 0))
    }


def apply_common_permissions(doc, perms):
    all_fields = ['select', 'read', 'write', 'create', 'delete', 'submit', 'cancel',
                  'amend', 'report', 'export', 'import', 'share', 'print', 'email']
    for field in all_fields:
        setattr(doc, field, perms.get(field, 0))






@frappe.whitelist()
def save_field_comment(doctype_name, docname, field_name, field_label, comment_text, is_external=0,status='Open'):
    try:
        # Find or create the parent DocType Field Comment document
        existing_comments = frappe.get_all('DocType Field Comment', filters={
            'doctype_name': doctype_name,
            'docname': docname,
            'field_name': field_name
        }, fields=['name'])

        if existing_comments and len(existing_comments) > 0:
            comment_doc = frappe.get_doc('DocType Field Comment', existing_comments[0].name)
        else:
            # Create new parent document
            comment_doc = frappe.get_doc({
                'doctype': 'DocType Field Comment',
                'doctype_name': doctype_name,
                'docname': docname,
                'field_name': field_name,
                'field_label': field_label,
                'status': status  # Set initial status
            })
            comment_doc.insert(ignore_permissions=True)

        # Create the child DocType Field Comment Log entry
        comment_log_entry = frappe.get_doc({
            'doctype': 'DocType Field Comment Log',
            'parent': comment_doc.name,
            'parenttype': 'DocType Field Comment',
            'parentfield': 'comment_log',
            'comment': comment_text,
            'user': frappe.session.user,
            'creation_date': frappe.utils.now_datetime(),
            'is_external': int(is_external)  # Convert to integer and use the passed value
        })

        # Insert the child document, ignoring permissions
        comment_log_entry.insert(ignore_permissions=True)

        # Verify the comment was saved
        # saved_log = frappe.get_doc('DocType Field Comment Log', comment_log_entry.name)

        # Return the newly created comment log entry for UI update
        return {
            'name': comment_log_entry.name,
            'parent': comment_doc.name,
            'comment': comment_text,
            'user': frappe.session.user,
            'creation_date': comment_log_entry.creation_date,
            'is_external': comment_log_entry.is_external
        }

    except Exception as e:
        frappe.log_error(f"Error in save_field_comment: {str(e)}\nTraceback: {frappe.get_traceback()}", "Comment Save Error")
        return None

@frappe.whitelist()
def send_mention_notification(mentioned_user, comment_doc, doctype, docname, field_name, field_label, comment):
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
            notification_message = f"{from_user} mentioned you in a comment on {field_label} in {doctype} {docname}"
            
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
        frappe.log_error(f"Error sending mention notification: {str(e)}", "DocType Field Comment Notification Error")

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
        comment_doc = frappe.get_doc({
            'doctype': 'DocType Field Comment',
            'doctype_name': doctype_name,
            'docname': docname,
            'field_name': field_name,
            'field_label': field_label,
            'status': 'Open'  # Set initial status
        })
        comment_doc.insert(ignore_permissions=True)
        
        return comment_doc.name
    except Exception as e:
        frappe.log_error(f"Error creating new comment thread: {str(e)}")
        return None

@frappe.whitelist()
def load_field_comments(doctype_name, docname, field_name):
    """Load all comment threads for a specific field"""
    try:
        # Get all parent comment documents for the field
        user_roll = frappe.db.get_value("SVA User", {"email": frappe.session.user}, "role_profile")
        user_type = frappe.db.get_value("Role Profile", user_roll, "custom_belongs_to")
        comment_docs = frappe.get_all(
            'DocType Field Comment',
            filters={
                'doctype_name': doctype_name,
                'docname': docname,
                'field_name': field_name
            },
            fields=['name', 'status'],
            order_by='creation desc',  # Most recent first
            ignore_permissions=True
        )

        if not comment_docs:
            return {
                'threads': []
            }

        # Get all comment logs for these parent documents
        threads = []
        for doc in comment_docs:
            filters = {
                'parent': doc.name,
                'parenttype': 'DocType Field Comment',
                'parentfield': 'comment_log'
            }

            if user_type == 'NGO':
                filters['is_external'] = 1

            comment_logs = frappe.get_all(
                'DocType Field Comment Log',
                filters=filters,
                fields=['name', 'comment', 'user', 'creation_date', 'is_external'],
                order_by='creation_date asc',
                ignore_permissions=True
            )
            threads.append({
                'name': doc.name,
                'status': doc.status,
                'comments': comment_logs
            })

        return {
            'threads': threads
        }

    except Exception as e:
        frappe.log_error(f"Error in load_field_comments: {str(e)}")
        return {
            'threads': []
        }

@frappe.whitelist()
def load_all_comments(doctype_name, docname):
    """Load all comments for a document"""
    try:
        # Get all parent comment documents for the document
        user_roll = frappe.db.get_value("SVA User", {"email": frappe.session.user}, "role_profile")
        user_type = frappe.db.get_value("Role Profile", user_roll, "custom_belongs_to")
        comment_docs = frappe.get_all(
            'DocType Field Comment',
            filters={
                'doctype_name': doctype_name,
                'docname': docname
            },
            fields=['name', 'field_name', 'field_label', 'status'],
            ignore_permissions=True
        )

        if not comment_docs:
            return []

        # Get all comment logs for these parent documents
        all_comments = []
        for doc in comment_docs:
            filters = {
                'parent': doc.name,
                'parenttype': 'DocType Field Comment',
                'parentfield': 'comment_log'
            }
            if user_type == 'NGO':
                filters['is_external'] = 1
                
            comment_logs = frappe.get_all(
                'DocType Field Comment Log',
                filters=filters,
                fields=['name', 'comment', 'user', 'creation_date', 'is_external'],
                order_by='creation_date asc',
                ignore_permissions=True
            )

            all_comments.append({
                'field_name': doc.field_name,
                'field_label': doc.field_label,
                'status': doc.status,
                'comments': comment_logs
            })
        return all_comments

    except Exception as e:
        frappe.log_error(f"Error in load_all_comments: {str(e)}")
        return []

@frappe.whitelist()
def get_all_field_comment_counts(doctype_name, docname):
    """Get comment counts for all fields in a document in a single call"""
    try:
        # Get user type for filtering
        user_roll = frappe.db.get_value("SVA User", {"email": frappe.session.user}, "role_profile")
        user_type = frappe.db.get_value("Role Profile", user_roll, "custom_belongs_to")
        
        # Get all parent comment documents for the document
        comment_docs = frappe.get_all(
            'DocType Field Comment',
            filters={
                'doctype_name': doctype_name,
                'docname': docname,
                'status': ['IN', ['Open', 'Resolved']]
            },
            fields=['name', 'field_name'],
            ignore_permissions=True
        )

        if not comment_docs:
            return {}

        # Create a dictionary to store counts
        field_counts = {}
        
        # Get all comment logs for these parent documents
        for doc in comment_docs:
            filters = {
                'parent': doc.name,
                'parenttype': 'DocType Field Comment',
                'parentfield': 'comment_log'
            }
            
            # For NGO users, only count external comments
            if user_type == 'NGO':
                filters['is_external'] = 1
                
            count = frappe.db.count(
                'DocType Field Comment Log',
                filters=filters
            )
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
        if not frappe.db.exists('DocType Field Comment Log', comment_name):
            frappe.throw(f"Comment {comment_name} does not exist")
        # Update the external flag
        frappe.db.set_value('DocType Field Comment Log', comment_name, 'is_external', is_external)
        
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

        return frappe.db.sql(query, {
            "txt": txt,
            "ngo": ngo
        })
    except Exception as e:
        frappe.log_error(f"Error in get_eligible_users_for_task: {str(e)}")
        return []

@frappe.whitelist()
def get_workflow_count(doctype):
    wf_field = frappe.get_cached_value('Workflow',{'document_type':doctype,"is_active":1},'workflow_state_field')
    if not wf_field:
        return []

    sql = f"""
        SELECT 
            wfs.state AS state,
            COALESCE(COUNT(tab.name), 0) AS count,
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

    if not len(conf_doc.get('child_doctypes',[])):
        return {"options":[], "option_map": {}}
    for row in conf_doc.get('child_doctypes',[]):
        if row.get("connection_type") not in ["Direct","Referenced","Unfiltered"]:
            continue
        else:
            link_doctype = row.get("link_doctype") or row.get("referenced_link_doctype")
            if link_doctype and link_doctype not in doctypes_info:
                    doctypes_info[link_doctype] = row

    if not doctypes_info:
        return {"options":[], "option_map": {}}

    doctypes_to_check = list(doctypes_info.keys())

    workflows = frappe.db.sql(f"""
        SELECT name,document_type
        FROM `tabWorkflow`
        WHERE is_active = 1
        AND document_type IN ({", ".join(["%s"] * len(doctypes_to_check))})
        ORDER BY document_type
    """, tuple(doctypes_to_check),as_dict=True)

    if not len(workflows):
        return {"options": [], "option_map": {}}

    options = []
    option_map = {}
    for workflow in workflows:
        if workflow.document_type in doctypes_info:
            options.append(workflow.document_type)
            option_map[workflow.document_type] = doctypes_info[workflow.document_type]

    return {"options" : options,'option_map': option_map}


@frappe.whitelist()
def get_files(doctype, docname):
    all_doctype = [doctype]
    all_docname = [docname]

    try:
        get_config = frappe.get_doc("SVADatatable Configuration", doctype)
    except frappe.DoesNotExistError:
        frappe.log_error(title="SVADatatable Configuration missing", message=f"No SVADatatable Configuration found for doctype: {doctype}")
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
                    docname_list = frappe.get_all(child.link_doctype, filters={child.link_fieldname: docname}, fields=["name"])
                    all_docname.extend([doc.name for doc in docname_list])
            elif child.connection_type == "Referenced" and child.referenced_link_doctype and child.dn_reference_field:
                if frappe.has_permission(child.referenced_link_doctype, "read"):
                    all_doctype.append(child.referenced_link_doctype)
                    docname_list = frappe.get_all(child.referenced_link_doctype, filters={child.dn_reference_field: docname}, fields=["name"])
                    all_docname.extend([doc.name for doc in docname_list])
            elif child.connection_type == "Indirect" and child.link_doctype:
                pass
                # skipping this part for future enhancement
            elif child.connection_type == "Is Custom Design":
                # skipping this part for future enhancement
                pass

    except Exception as e:
        frappe.log_error(title=f"Error in get_files config from svadatatable configuration", message=str(e))

    try:
        file_list = frappe.get_all(
            "File",
            filters={
                "attached_to_name": ["in", all_docname],
                "attached_to_doctype": ["in", all_doctype],
            },
            fields=["name", "file_url", "attached_to_doctype", "attached_to_name", "owner", "file_name","file_size","creation"],
            as_list=False
        )
        return file_list
    except Exception as e:
        frappe.log_error(title="Error fetching files", message=str(e))
        return []

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
            "property_setters": frappe.get_all("Property Setter", fields="*", filters={"doc_type": dt}, order_by="name"),
            "custom_perms": [],
            "links": frappe.get_all("DocType Link", fields="*", filters={"parent": dt}, order_by="name"),
            "doctype": dt,
        }
        if with_permissions:
            custom["custom_perms"] = frappe.get_all("Custom DocPerm", fields="*", filters={"parent": dt}, order_by="name")
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


from frappe.modules.utils import sync_customizations_for_doctype
import json
import frappe

def _apply_customizations(custom_data: dict):
    """
    Core logic for applying customizations for a single doctype
    and its child tables. Used by both single and multiple import.
    """
    # Ensure JSON contains main doctype key
    if not custom_data.get("doctype"):
        frappe.throw("Invalid JSON: 'doctype' missing.")

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
        return {
            "status": "success",
            "message": f"Customizations imported for {applied_dt} and child tables"
        }

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
            frappe.throw("Invalid JSON format. Expected dict of doctypes.")

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
            "message": f"Imported {len(imported)} doctypes, {len(errors)} failed."
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
            doctype,
            fields="*",
            filters=filters,
            or_filters=or_filters,
            order_by="creation asc"
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
        if isinstance(data,str):
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
        with open(file_path, "r", encoding="utf-8") as f:
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
        with open(file_path, "r", encoding="utf-8") as f:
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
