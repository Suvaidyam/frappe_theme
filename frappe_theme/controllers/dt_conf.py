import frappe
from frappe.desk.query_report import get_script
from frappe.utils.safe_exec import read_sql
from frappe_theme.controllers.number_card import NumberCard
from frappe_theme.controllers.chart import Chart
import json
from hashlib import md5

class DTConf():
    # datatable settings
    def get_direct_connection_dts(dt):
        standard_dts = frappe.get_list('DocField',filters=[
            ['DocField', 'options', '=', dt],
            ['DocField', 'parenttype', '=', "DocType"]
        ],pluck='parent',ignore_permissions=True)
        custom_dts = frappe.get_list('Custom Field',filters=[
            ['Custom Field', 'options', '=', dt],
        ],pluck='dt',ignore_permissions=True)
        return standard_dts + custom_dts

    def get_indirect_connection_local_fields(dt):
        fields = frappe.get_meta(dt).fields
        valid_fields = [{'value':field.fieldname,'label':field.label,'options':field.options} for field in fields if field.fieldtype in ["Link"] and field.options not in ["Workflow State",dt]]
        return valid_fields

    def get_indirect_connection_foreign_fields(dt,local_field_option):
        fields = frappe.get_all('DocField',
            filters=[
                ['DocField', 'parent', '=', dt],
                ['DocField', 'options', '=', local_field_option],
                ['DocField', 'parenttype', '=', "DocType"]
            ],
            fields=['label','fieldname as value'])
        return fields

    # workflow
    def get_workflow_with_dt(dt):
        exists = frappe.db.exists('Workflow', {'document_type': dt})
        if exists:
            wf_doc = frappe.get_doc('Workflow', exists)
            return wf_doc.as_dict()
        else:
            frappe.throw('No workflow found for this doctype')

    def get_direct_connection_fields(dt,link_dt):
        standard_dt_fields = frappe.get_list('DocField',filters=[
            ['DocField', 'options', '=', dt],
            ['DocField', 'parenttype', '=', "DocType"],
            ['DocField', 'parent', '=', link_dt]
        ],fields=['label','fieldname'],ignore_permissions=True)
        custom_dt_fields = frappe.get_list('Custom Field',filters=[
            ['Custom Field', 'options', '=', dt],
            ['Custom Field', 'dt', '=', link_dt]
        ],fields=['label','fieldname'],ignore_permissions=True)
        return standard_dt_fields + custom_dt_fields

    # config for sva datatable
    def get_sva_dt_settings(doctype):
        if doctype == 'SVADatatable Configuration':
            return None
        if not frappe.db.exists("SVADatatable Configuration", doctype):
            return None

        settings = frappe.get_doc("SVADatatable Configuration", doctype)
        settings = settings.as_dict()
        # number cards
        updated_cards = NumberCard.number_card_settings(settings)
        settings['number_cards'] = updated_cards

        # charts
        updated_charts = Chart.chart_settings(settings)
        settings['charts'] = updated_charts
        return settings
    
    def get_meta_fields(doctype,_type):
        if _type == 'Report':
            report = frappe.get_doc('Report',doctype)   
            return report.columns
        else:
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

    def get_dt_list(doctype,doc=None,ref_doctype=None, filters=None, fields=None, limit_page_length=None, order_by=None, limit_start=None, _type="List",unfiltered=0):
        if _type == 'Report': 
            return DTConf.report_list(doctype,doc,ref_doctype, filters, limit_page_length,limit_start,unfiltered)
        else:
            return DTConf.doc_type_list(doctype,filters, fields, limit_page_length, order_by, limit_start)

    def report_list(doctype,doc=None,ref_doctype=None, filters=None, limit_page_length=None,limit_start=None,unfiltered=0):
        doc_filters = DTConf.get_report_filters(doctype)
            # convert filters to sql conditions
        conditions = ""
        for f in doc_filters:
            if f.get('fieldname') and f.get('fieldname') not in filters and f.get('options') == ref_doctype and unfiltered == 0:
                conditions += f" AND t.{f.get('fieldname')} = '{doc}'"
        if filters:
            conditions = conditions +' AND '+ DTConf.filters_to_sql_conditions(filters)
        if limit_page_length and limit_start is not None:
            conditions += f" LIMIT {limit_start}, {limit_page_length}"
        # return conditions
        data = frappe.get_doc('Report',doctype)
        query = data.get('query')
        final_sql = f"SELECT * FROM ({query}) AS t WHERE 1=1 {conditions}"
        result = read_sql(final_sql, as_dict=1)
        return result
    
    def doc_type_list(doctype,filters=None, fields=None, limit_page_length=None, order_by=None, limit_start=None):
        if filters is not None and not isinstance(filters, (dict, list)):
            filters = {}
        return frappe.get_list(doctype, filters=filters, fields=fields, 
                        limit_page_length=limit_page_length, 
                        order_by=order_by, limit_start=limit_start)
        
    def get_dt_count(doctype,doc=None,ref_doctype=None, filters=None,_type="List",unfiltered=False):
        if _type == 'Report': 
            doc_filters = DTConf.get_report_filters(doctype)
            # convert filters to sql conditions
            conditions = ""
            for f in doc_filters:
                if f.get('fieldname') and f.get('fieldname') not in filters and f.get('options') == ref_doctype and unfiltered == 0:
                    conditions += f" AND t.{f.get('fieldname')} = '{doc}'"
            if filters:
                conditions = conditions +' AND '+ DTConf.filters_to_sql_conditions(filters)
            # return conditions
            data = frappe.get_doc('Report',doctype)
            query = data.get('query')
            final_sql = f"SELECT COUNT(*) AS count FROM ({query}) AS t WHERE 1=1 {conditions}"
            result = read_sql(final_sql, as_dict=1)
            return result[0].get('count')
        else:
            if filters is not None and not isinstance(filters, (dict, list)):
                filters = {}
            cleaned_filters = [item[:-1] if item and item[-1] is False else item for item in filters]
            return frappe.db.count(doctype, filters=cleaned_filters)

    # listview settings
    
    def setup_user_list_settings(parent_id,child_dt,listview_settings):
        user = frappe.session.user
        if user == "Administrator":
            return
        exists = frappe.db.exists("SVADT User Listview Settings",{"parent_id":parent_id,"child_dt":child_dt,"user":user})
        if exists:
            doc = frappe.get_doc("SVADT User Listview Settings",exists)
            doc.listview_settings = listview_settings
            doc.save(ignore_permissions=True)
        else:
            frappe.get_doc({"doctype":"SVADT User Listview Settings","parent_id":parent_id,"child_dt":child_dt,"user":user,"listview_settings":listview_settings}).insert(ignore_permissions=True)
            
    def delete_user_list_settings(parent_id,child_dt):
        user = frappe.session.user
        if user == "Administrator":
            return None
        exists = frappe.db.exists("SVADT User Listview Settings",{"parent_id":parent_id,"child_dt":child_dt,"user":user})
        if exists:
            frappe.delete_doc("SVADT User Listview Settings",exists)
        return True

    def get_user_list_settings(parent_id,child_dt):
        user = frappe.session.user
        if user == "Administrator":
            return None
        setting_id = md5(f"{parent_id}-{child_dt}-{user}".encode('utf-8')).hexdigest()
        listview_settings = None
        if frappe.cache.exists(setting_id):
            listview_settings = frappe.cache.get_value(setting_id)
        elif frappe.db.exists("SVADT User Listview Settings",{"parent_id":parent_id,"child_dt":child_dt,"user":user}):
            listview_settings = frappe.get_doc("SVADT User Listview Settings",frappe.db.exists("SVADT User Listview Settings",{"parent_id":parent_id,"child_dt":child_dt,"user":user})).listview_settings
        return listview_settings

    # build datatable for doctype
    def doc_filters(doctype, filters=None):
        dtmeta = frappe.get_meta(doctype)
        field_dicts = {}
        field_dicts[doctype] = []
        
        for field in dtmeta.fields:
            field_dict = DTConf.process_field(field)
            if field_dict.get('fieldtype') in ["Table", "Table MultiSelect"]:
                continue
                # child_meta = frappe.get_meta(field_dict.get('options'))
                # if len(child_meta.fields) > 0:
                #     field_dicts[field_dict.get('options')] = []
                #     for child_field in child_meta.fields:
                #         child_field_dict = DTConf.process_field(child_field)
                #         field_dicts[field_dict.get('options')].append(child_field_dict)
                # continue
            field_dicts[doctype].append(field_dict)
        return field_dicts

    def process_field(field):
        field_dict = {}
        for key, value in field.__dict__.items():
            if key == 'link_filters' and isinstance(value, list):
                field_dict[key] = json.dumps(value)
            else:
                field_dict[key] = value
        return field_dict
    # build datatable for report
    def link_report_list(doctype):
        other_report_list = frappe.get_all('Report',
            filters=[
                ['Report Filter','options','=',doctype],
                ['Report','report_type','=','Query Report']
            ],
            pluck='name')
        return other_report_list
    
    def filters_to_sql_conditions(filters, table_alias="t"):
        conditions = []

        for f in filters:
            if len(f) < 4:
                continue

            doctype, field, operator, value = f[:4]
            field_name = f"{table_alias}.{field}"

            if operator.lower() == "between" and isinstance(value, (list, tuple)) and len(value) == 2:
                condition = f"{field_name} BETWEEN '{value[0]}' AND '{value[1]}'"
            elif operator.lower() == "like":
                condition = f"{field_name} LIKE '{value}'"
            elif operator.lower() == "in" and isinstance(value, (list, tuple)):
                in_values = ", ".join(f"'{v}'" for v in value)
                condition = f"{field_name} IN ({in_values})"
            elif operator.lower() == "not in" and isinstance(value, (list, tuple)):
                not_in_values = ", ".join(f"'{v}'" for v in value)
                condition = f"{field_name} NOT IN ({not_in_values})"
            elif operator.lower() == "is":
                val = str(value).lower()
                if val == "set":
                    condition = f"{field_name} IS NOT NULL"
                elif val == "not set":
                    condition = f"{field_name} IS NULL"
            else:
                condition = f"{field_name} {operator} '{value}'"

            conditions.append(condition)

        return " AND ".join(conditions)
    
    def get_report_filters(doctype):
        if doctype:
            filters = get_script(doctype)
            return filters.get('filters')
        else:
            return []


    