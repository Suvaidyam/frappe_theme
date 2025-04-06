import frappe
import json
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_my_theme():
    return frappe.get_doc("My Theme")


@frappe.whitelist(allow_guest=True)
def get_property_set(doctype):
        return frappe.db.get_list("Property Setter", fields=["*"] , filters={"doc_type": doctype,"property":['IN',["filter_by","link_filter"]]},ignore_permissions=True)
    

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
def get_permissions(doctype):
    permissions = []
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
def get_versions(dt,dn,page_length,start,filters = None):
    if isinstance(filters, str):
        filters = json.loads(filters)
    
    where_clause = f"ver.ref_doctype = '{dt}' AND ver.docname = '{dn}'"
    search_param_cond = ""
    if filters and isinstance(filters, dict):
        if filters.get('doctype'):
            where_clause += f" AND (ver.custom_actual_doctype = '{filters['doctype']}' OR (COALESCE(ver.custom_actual_doctype, '') = '' AND ver.ref_doctype = '{filters['doctype']}'))"
        
        if filters.get('owner'):
            search_param_cond = f" WHERE usr.full_name LIKE '{filters['owner']}%'"
        else:
            search_param_cond = ""
    
    sql = f"""
        WITH extracted AS (
            SELECT
                ver.name AS name,
                ver.owner AS owner,
                ver.creation AS creation,
                ver.custom_actual_doctype,
                ver.custom_actual_document_name,
                ver.ref_doctype,
                ver.docname,
                jt.elem AS changed_elem,
                JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[0]')) AS field_name,
                JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[1]')) AS old_value,
                JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[2]')) AS new_value
            FROM `tabVersion` AS ver,
            JSON_TABLE(JSON_EXTRACT(ver.data, '$.changed'), '$[*]'
                COLUMNS (
                    elem JSON PATH '$'
                )
            ) jt
            WHERE {where_clause}
            # WHERE ver.ref_doctype = '{dt}' AND ver.docname = '{dn}'
        )
        SELECT
            e.custom_actual_doctype,
            e.custom_actual_document_name,
            e.ref_doctype,
            usr.full_name AS owner,
            e.creation AS creation,
            e.docname,
            JSON_ARRAYAGG(
                JSON_ARRAY(
                    COALESCE(tf.label, ctf.label, e.field_name),
                    COALESCE(
                        CASE
                            WHEN e.old_value = 'null' OR e.old_value = '' THEN '(blank)'
                            ELSE e.old_value
                        END,
                        ''
                    ),
                    COALESCE(
                        CASE
                            WHEN e.new_value = 'null' OR e.new_value = '' THEN '(blank)'
                            ELSE e.new_value
                        END
                    , '')
                )
            ) AS changed
        FROM extracted e
        LEFT JOIN `tabDocField` AS tf ON (e.field_name = tf.fieldname AND tf.parent IN (e.ref_doctype, e.custom_actual_doctype))
        LEFT JOIN `tabCustom Field` AS ctf ON (e.field_name = ctf.fieldname AND ctf.dt IN (e.ref_doctype, e.custom_actual_doctype))
        LEFT JOIN `tabUser` AS usr ON e.owner = usr.name
        {search_param_cond}
        GROUP BY e.name
        ORDER BY e.creation DESC
        LIMIT {page_length}
        OFFSET {start}
    """
    return frappe.db.sql(sql,as_dict=True)


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
    # Parse the doc parameter if it's a string
    if isinstance(doc, str):
        doc = frappe.parse_json(doc)
    
    # Get all existing Custom DocPerm records for the source role
    existing_perms = frappe.get_all('Custom DocPerm', 
                    filters={
                        'role': doc.get('role_from'), 
                        'permlevel': 0,
                    },
                    fields=['name', 'parent'],
                    ignore_permissions=True
                )
    
    # Check if records with role_to already exist
    existing_role_to_perms = frappe.get_all('Custom DocPerm',
                    filters={
                        'role': doc.get('role_to'),
                        'permlevel': 0,
                    },
                    fields=['name', 'parent'],
                    ignore_permissions=True
                )
    
    records_updated = 0
    records_created = 0
    
    # Create a dictionary of existing doctypes for role_to for faster lookup
    existing_doctypes = {perm.parent: perm.name for perm in existing_role_to_perms}
    
    # Process each permission from the source role
    for perm in existing_perms:
        # Get the full document for the permission
        source_perm = frappe.get_doc('Custom DocPerm', perm.name)
        
        # Get common permissions between source_perm and doc
        common_permissions = get_common_permissions(source_perm, doc)
        
        # Check if this doctype already has a permission for role_to
        if perm.parent in existing_doctypes:
            # Get the existing permission for role_to with the same parent
            target_perm_name = existing_doctypes[perm.parent]
            target_perm_doc = frappe.get_doc('Custom DocPerm', target_perm_name)
            
            # Update the permission values based on common permissions
            apply_common_permissions(target_perm_doc, common_permissions)
            
            # Only save if there are common permissions to apply
            if common_permissions:
                target_perm_doc.save()
                records_updated += 1
        else:
            # Create a new permission with role_to
            new_perm = frappe.get_doc('Custom DocPerm', perm.name)
            new_perm.role = doc.get('role_to')
            
            # Copy parent from the original permission
            new_perm.parent = perm.parent
            
            # Apply common permissions
            apply_common_permissions(new_perm, common_permissions)
            
            # Only insert if there are common permissions to apply
            if common_permissions:
                new_perm.insert()
                records_created += 1
    
    # Create redirect link
    redirect_link = f'<a href="/app/custom-docperm" class="">View Permissions</a>'
    
    # Show appropriate message with redirect link
    if records_updated > 0 and records_created > 0:
        frappe.msgprint(f"{records_updated} permissions updated and {records_created} permissions created successfully {redirect_link}")
    elif records_updated > 0:
        frappe.msgprint(f"{records_updated} permissions updated successfully {redirect_link}")
    elif records_created > 0:
        frappe.msgprint(f"{records_created} permissions created successfully {redirect_link}")
    else:
        frappe.msgprint(f"No permissions were updated or created")
    
    return True

def get_common_permissions(source_perm, doc):
    """Get common permissions between source_perm and doc"""
    common_permissions = {}
    
    # Check each permission field
    if 'select' in doc and int(doc.get('select', 0)) == int(source_perm.select):
        common_permissions['select'] = int(doc.get('select', 0))
    if 'read' in doc and int(doc.get('read', 0)) == int(source_perm.read):
        common_permissions['read'] = int(doc.get('read', 0))
    if 'write' in doc and int(doc.get('write', 0)) == int(source_perm.write):
        common_permissions['write'] = int(doc.get('write', 0))
    if 'create' in doc and int(doc.get('create', 0)) == int(source_perm.create):
        common_permissions['create'] = int(doc.get('create', 0))
    if 'delete_to' in doc and int(doc.get('delete_to', 0)) == int(source_perm.delete):
        common_permissions['delete'] = int(doc.get('delete_to', 0))
    if 'submit_to' in doc and int(doc.get('submit_to', 0)) == int(source_perm.submit):
        common_permissions['submit'] = int(doc.get('submit_to', 0))
    if 'cancel_to' in doc and int(doc.get('cancel_to', 0)) == int(source_perm.cancel):
        common_permissions['cancel'] = int(doc.get('cancel_to', 0))
    if 'amend' in doc and int(doc.get('amend', 0)) == int(source_perm.amend):
        common_permissions['amend'] = int(doc.get('amend', 0))
    if 'report' in doc and int(doc.get('report', 0)) == int(source_perm.report):
        common_permissions['report'] = int(doc.get('report', 0))
    if 'export' in doc and int(doc.get('export', 0)) == int(source_perm.export):
        common_permissions['export'] = int(doc.get('export', 0))
    if 'import_to' in doc and int(doc.get('import_to', 0)) == int(getattr(source_perm, 'import', 0)):
        common_permissions['import'] = int(doc.get('import_to', 0))
    if 'share' in doc and int(doc.get('share', 0)) == int(source_perm.share):
        common_permissions['share'] = int(doc.get('share', 0))
    if 'print' in doc and int(doc.get('print', 0)) == int(source_perm.print):
        common_permissions['print'] = int(doc.get('print', 0))
    if 'email' in doc and int(doc.get('email', 0)) == int(source_perm.email):
        common_permissions['email'] = int(doc.get('email', 0))
    
    return common_permissions

def apply_common_permissions(target_perm, common_permissions):
    """Apply common permissions to a permission document"""
    # For each permission, check if it's in common_permissions
    # If it is, use that value, otherwise set it to 0
    if 'select' in common_permissions:
        target_perm.select = common_permissions['select']
    else:
        target_perm.select = 0
        
    if 'read' in common_permissions:
        target_perm.read = common_permissions['read']
    else:
        target_perm.read = 0
        
    if 'write' in common_permissions:
        target_perm.write = common_permissions['write']
    else:
        target_perm.write = 0
        
    if 'create' in common_permissions:
        target_perm.create = common_permissions['create']
    else:
        target_perm.create = 0
        
    if 'delete' in common_permissions:
        target_perm.delete = common_permissions['delete']
    else:
        target_perm.delete = 0
        
    if 'submit' in common_permissions:
        target_perm.submit = common_permissions['submit']
    else:
        target_perm.submit = 0
        
    if 'cancel' in common_permissions:
        target_perm.cancel = common_permissions['cancel']
    else:
        target_perm.cancel = 0
        
    if 'amend' in common_permissions:
        target_perm.amend = common_permissions['amend']
    else:
        target_perm.amend = 0
        
    if 'report' in common_permissions:
        target_perm.report = common_permissions['report']
    else:
        target_perm.report = 0
        
    if 'export' in common_permissions:
        target_perm.export = common_permissions['export']
    else:
        target_perm.export = 0
        
    if 'import' in common_permissions:
        setattr(target_perm, 'import', common_permissions['import'])
    else:
        setattr(target_perm, 'import', 0)
        
    if 'share' in common_permissions:
        target_perm.share = common_permissions['share']
    else:
        target_perm.share = 0
        
    if 'print' in common_permissions:
        target_perm.print = common_permissions['print']
    else:
        target_perm.print = 0
        
    if 'email' in common_permissions:
        target_perm.email = common_permissions['email']
    else:
        target_perm.email = 0

