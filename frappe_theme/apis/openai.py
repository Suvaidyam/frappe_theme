from openai import OpenAI
import json
from datetime import datetime, date
from frappe_theme.apis.export_json import export_json_without_meta
import frappe

api_key = frappe.get_conf().get("openai_key")
client = OpenAI(api_key=api_key)


def datetime_handler(obj):
    """JSON serializer for datetime objects"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def clean_data_for_json(data):
    """
    Recursively convert non-serializable objects to JSON-safe format
    """
    if isinstance(data, dict):
        return {key: clean_data_for_json(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [clean_data_for_json(item) for item in data]
    elif isinstance(data, (datetime, date)):
        return data.isoformat()
    elif hasattr(data, '__dict__'):
        # Handle Frappe objects like DocField by converting to dict
        try:
            return clean_data_for_json(data.__dict__)
        except:
            return str(data)
    elif hasattr(data, 'as_dict'):
        # Handle Frappe Document objects
        try:
            return clean_data_for_json(data.as_dict())
        except:
            return str(data)
    else:
        return data

def extract_relevant_data(raw_data):
    """
    Extract only business-relevant data for executive report,
    filtering out technical metadata and complex objects
    """
    if not isinstance(raw_data, dict) or 'message' not in raw_data:
        return raw_data
    
    main_data = raw_data['message'].get('main_table', {}).get('data', {})
    
    # Extract key business fields only
    relevant_fields = {
        'name': main_data.get('name'),
        'project_name': main_data.get('project_name'),
        'ngo': main_data.get('ngo'),
        'donor': main_data.get('donor'),
        'donor_name': main_data.get('donor_name'),
        'project_start_date': main_data.get('project_start_date'),
        'project_end_date': main_data.get('project_end_date'),
        'total_planned_budget': main_data.get('total_planned_budget'),
        'overall_planned_budget': main_data.get('overall_planned_budget'),
        'grant_duration_month': main_data.get('grant_duration_month'),
        'frequency': main_data.get('frequency'),
        'custom_grant_type': main_data.get('custom_grant_type'),
        'project_objective': main_data.get('project_objective'),
        'custom_project_goals': main_data.get('custom_project_goals'),
        'lowest_geography_level': main_data.get('lowest_geography_level')
    }
    
    # Add beneficiary data if available
    beneficiaries = main_data.get('custom_number_of_beneficiaries', {}).get('data', [])
    if beneficiaries:
        relevant_fields['beneficiaries'] = [
            {
                'demography_group': b.get('demography_group_data'),
                'directly_impacted': b.get('custom_directly_impacted'),
                'indirectly_impacted': b.get('count')
            } for b in beneficiaries
        ]
    
    # Add related table summaries
    related_tables = raw_data['message'].get('related_tables', [])
    for table in related_tables:
        table_name = table.get('table_doctype', '')
        if table_name == 'Grant' and table.get('data'):
            grant_data = table['data'][0] if table['data'] else {}
            relevant_fields['grant_status'] = grant_data.get('grant_status')
            relevant_fields['grant_type'] = grant_data.get('grant_type')
            relevant_fields['start_date'] = grant_data.get('start_date')
            relevant_fields['end_date'] = grant_data.get('end_date')
    
    return relevant_fields

@frappe.whitelist()
def generate_executive_report(doctype, docname):
    """
    Takes grant JSON, extracts only relevant fields,
    and generates a concise Executive Report using OpenAI.
    """
    try:
        # Get the raw data from export_json
        raw_data = export_json_without_meta(doctype, docname)
        
        # Extract only business-relevant data
        relevant_data = extract_relevant_data(raw_data)
        
        # Clean the data to make it JSON serializable
        cleaned_data = clean_data_for_json(relevant_data)
        
        # System prompt for structured executive report
        system_prompt = """You are an assistant that generates concise Executive Reports from grant data.
Generate output in two parts:
1. Plain text version (no HTML).
2. HTML version using <h3> for headings and <p> for content.
Keep report under 300 words, executive-friendly, no jargon.
Return both in a JSON object with keys 'plain_text' and 'html'.
"""

        # Create user prompt with cleaned data
        user_prompt = f"Grant Data:\n{json.dumps(cleaned_data, indent=2)}"

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",   # cost-effective & good quality
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4,  # lower temp for consistency
            max_tokens=600    # cap output
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        frappe.log_error(f"Error in generate_executive_report: {str(e)}")
        return f"Error generating report: {str(e)}"