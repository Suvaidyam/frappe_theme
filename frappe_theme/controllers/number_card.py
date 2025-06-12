import frappe
import json
from typing import Dict, List, Optional, Union

class NumberCard:
    # Consolidated function mappings
    AGGREGATE_FUNCTIONS = {
        'Sum': 'SUM',
        'Average': 'AVG',
        'Minimum': 'MIN',
        'Maximum': 'MAX',
        'Count': 'COUNT'
    }

    @staticmethod
    def number_card_settings(settings) -> List[Dict]:
        """Get visible number cards with their details."""
        try:
            visible_cards = [card for card in settings.number_cards if card.is_visible]
            updated_cards = []

            for card in visible_cards:
                if not frappe.db.exists('Number Card', card.number_card):
                    continue

                card_details = frappe.get_cached_doc('Number Card', card.number_card)
                card['details'] = card_details

                if card_details.type == 'Report' and card_details.report_name:
                    if frappe.db.exists('Report', card_details.report_name):
                        card['report'] = frappe.get_cached_doc('Report', card_details.report_name)
                    else:
                        card['report'] = None
                elif card_details.type == 'Document Type':
                    card['report'] = None

                updated_cards.append(card)

            return updated_cards
        except Exception as e:
            frappe.log_error(f"Error in number_card_settings: {str(e)}")
            return []

    @staticmethod
    def get_number_card_count(type: str, details: str, report: Optional[str] = None, 
                            doctype: Optional[str] = None, docname: Optional[str] = None) -> Dict:
        """Get count based on card type."""
        try:
            details = json.loads(details)
            report = json.loads(report) if report else None

            if type == 'Report':
                return NumberCard.card_type_report(details, report, doctype, docname)
            elif type == 'Document Type':
                return NumberCard.card_type_docype(details, doctype, docname)
            return {'count': 0, 'message': 'Invalid type', 'field_type': None}
        except Exception as e:
            frappe.log_error(f"Error in get_number_card_count: {str(e)}")
            return {'count': 0, 'message': str(e), 'field_type': None}

    @staticmethod
    def card_type_report(details: Dict, report: Optional[Dict] = None, 
                        doctype: Optional[str] = None, docname: Optional[str] = None) -> Dict:
        """Handle report type number cards."""
        try:
            if not report or not report.get('query'):
                return {'count': 0, 'message': 'Report', 'field_type': None}

            conditions = "WHERE 1=1"
            field_type = None
            
            # Build conditions
            for f in report.get('columns', []):
                if f.get('fieldtype') == 'Link' and f.get('options') == doctype:
                    conditions += f" AND t.{f.get('fieldname')} = '{docname}'"
                field_type = f.get('fieldtype')

            field_name = details.get('report_field')
            function = NumberCard.AGGREGATE_FUNCTIONS.get(details.get('report_function'))
            
            if not function:
                return {'count': 0, 'message': 'Invalid function', 'field_type': field_type}

            query = f"SELECT {function}(t.{field_name}) AS count FROM ({report.get('query')}) AS t {conditions}"
            count = frappe.db.sql(query, as_dict=True)
            
            return {
                'count': count[0].get('count') if count else 0,
                'message': 'Report',
                'field_type': field_type
            }
        except Exception as e:
            frappe.log_error(f"Error in card_type_report: {str(e)}")
            return {'count': 0, 'message': str(e), 'field_type': None}

    @staticmethod
    def card_type_docype(details: Dict, doctype: Optional[str] = None, 
                        docname: Optional[str] = None) -> Dict:
        """Handle document type number cards."""
        try:
            filters = json.loads(details.get('filters_json', '[]'))
            
            # Clean up filters
            filters = [f for f in filters if f and len(f) >= 4 and 
                      (not isinstance(f[3], list) or any(x is not None for x in f[3]))]
            
            # Remove false from filter conditions
            filters = [f[:-1] if len(f) > 4 and f[4] is False else f for f in filters]

            if doctype and docname:
                meta = frappe.get_meta(details.get('document_type'))
                if meta.fields:
                    # Add direct link field filter
                    direct_link = next((x for x in meta.fields 
                                     if x.fieldtype == 'Link' and x.options == doctype 
                                     and x.fieldname not in ['amended_form']), None)
                    if direct_link:
                        filters.append([details.get('document_type'), 
                                     direct_link.get('fieldname'), '=', docname])

                    # Add reference field filters
                    ref_dt = next((x for x in meta.fields 
                                 if x.fieldtype == 'Link' and x.options == 'DocType'), None)
                    if ref_dt:
                        ref_dn = next((x for x in meta.fields 
                                     if x.fieldtype == 'Dynamic Link' 
                                     and x.options == ref_dt.get('fieldname')), None)
                        if ref_dn:
                            filters.extend([
                                [details.get('document_type'), ref_dt.get('fieldname'), '=', doctype],
                                [details.get('document_type'), ref_dn.get('fieldname'), '=', docname]
                            ])

            function = details.get('function')
            if function == 'Count':
                count = frappe.db.count(details.get('document_type'), filters=filters)
            else:
                agg_function = NumberCard.AGGREGATE_FUNCTIONS.get(function)
                if not agg_function:
                    return {'count': 0, 'message': 'Invalid function', 'field_type': None}
                    
                count = frappe.db.get_value(
                    details.get('document_type'),
                    filters,
                    f"{agg_function}({details.get('aggregate_function_based_on')})"
                )

            return {
                'count': count or 0,
                'message': details,
                'field_type': None
            }
        except Exception as e:
            frappe.log_error(f"Error in card_type_docype: {str(e)}")
            return {'count': 0, 'message': str(e), 'field_type': None}
        