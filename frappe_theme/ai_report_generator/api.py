import json
import re
import frappe
from frappe.utils.safe_exec import check_safe_sql_query


@frappe.whitelist()
def get_all_doctypes():
    """Return list of all regular (non-child, non-single) DocTypes for selection."""
    from frappe_theme.ai_report_generator.meta_analyzer import MetaAnalyzer
    return MetaAnalyzer([]).get_all_doctypes()


@frappe.whitelist()
def analyze_doctypes(doctypes, max_depth=3):
    """Analyze selected DocTypes and return schema + suggestions."""
    from frappe_theme.ai_report_generator.sql_generator import SQLGenerator

    if isinstance(doctypes, str):
        doctypes = json.loads(doctypes)

    generator = SQLGenerator(doctypes, "", max_depth=int(max_depth))
    suggestions = generator.suggest_columns_and_filters()

    # Check which doctypes lack descriptions
    missing_descriptions = []
    for dt in doctypes:
        exists = frappe.db.exists("AI Report Context", {"reference_doctype": dt})
        if not exists:
            missing_descriptions.append(dt)

    return {
        "suggestions": suggestions,
        "missing_descriptions": missing_descriptions,
    }


@frappe.whitelist()
def save_doctype_description(doctype, description, field_descriptions=None):
    """Save/update user description for a DocType (for AI context)."""
    existing = frappe.db.get_value("AI Report Context", {"reference_doctype": doctype})
    if existing:
        doc = frappe.get_doc("AI Report Context", existing)
        doc.description = description
        doc.field_descriptions = field_descriptions or ""
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc({
            "doctype": "AI Report Context",
            "reference_doctype": doctype,
            "description": description,
            "field_descriptions": field_descriptions or "",
        })
        doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


@frappe.whitelist()
def generate_report(doctypes, user_request, max_depth=3):
    """Generate SQL + columns + filters from natural language."""
    from frappe_theme.ai_report_generator.sql_generator import SQLGenerator

    if isinstance(doctypes, str):
        doctypes = json.loads(doctypes)

    generator = SQLGenerator(doctypes, user_request, max_depth=int(max_depth))
    result = generator.generate()
    return result


@frappe.whitelist()
def preview_query(query, filters=None):
    """Execute generated SQL with LIMIT for preview. Validates safety first."""
    if isinstance(filters, str):
        filters = json.loads(filters) if filters else {}

    check_safe_sql_query(query)

    # Replace filter placeholders with actual values or defaults
    safe_query = query
    if filters:
        for key, value in filters.items():
            placeholder = f"%({key})s"
            if placeholder in safe_query:
                safe_query = safe_query.replace(placeholder, frappe.db.escape(value))

    # Remove any remaining unset filter placeholders — replace with wildcards
    safe_query = re.sub(r'%\(\w+\)s', "'%%'", safe_query)

    # Add LIMIT if not present
    if "limit" not in safe_query.lower():
        safe_query = f"SELECT * FROM ({safe_query.rstrip(';')}) AS __preview LIMIT 20"

    result = frappe.db.sql(safe_query, as_dict=True)
    return result


@frappe.whitelist()
def save_as_report(report_name, ref_doctype, query, columns, filters, description=""):
    """Create a Frappe Query Report from the generated output."""
    if isinstance(columns, str):
        columns = json.loads(columns)
    if isinstance(filters, str):
        filters = json.loads(filters)

    report = frappe.get_doc({
        "doctype": "Report",
        "report_name": report_name,
        "ref_doctype": ref_doctype,
        "report_type": "Query Report",
        "query": query,
        "is_standard": "No",
        "custom_ai_report_description": description,
    })

    # Add columns using existing Report Column child table
    for col in columns:
        report.append("columns", {
            "fieldname": col.get("fieldname"),
            "label": col.get("label"),
            "fieldtype": col.get("fieldtype", "Data"),
            "options": col.get("options", ""),
            "width": col.get("width", 150),
        })

    # Add filters using existing Report Filter child table
    for f in filters:
        report.append("filters", {
            "fieldname": f.get("fieldname"),
            "label": f.get("label"),
            "fieldtype": f.get("fieldtype", "Data"),
            "options": f.get("options", ""),
            "default": f.get("default", ""),
            "reqd": f.get("reqd", 0),
            "wildcard": f.get("wildcard", 0),
        })

    report.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": report.name, "url": f"/app/query-report/{report.name}"}
