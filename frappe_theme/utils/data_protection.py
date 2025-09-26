import json
import frappe
import logging
from cryptography.fernet import Fernet, InvalidToken
from frappe.desk import reportview
from frappe import _
from frappe.desk import query_report, reportview

logger = logging.getLogger(__name__)

@frappe.whitelist()
def encrypt_doc_fields(doc, method=None):
    """Encrypt fields before saving"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val and not is_encrypted(val):
                doc.set(df.fieldname, encrypt_value(val))

@frappe.whitelist()
def decrypt_doc_fields(doc, method=None):
    """Decrypt fields after loading - for single document view"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val and is_encrypted(val):
                doc.set(df.fieldname, decrypt_value(val))

@frappe.whitelist()
def mask_doc_list_view(*args, **kwargs):
    """Enhanced wrapper for list view with decryption + masking"""
    result = reportview.get(*args, **kwargs)
    
    try:
        if isinstance(result, dict) and "keys" in result and "values" in result:
            doctype = kwargs.get("doctype") or (args[0] if args else None)
            if doctype:
                meta = frappe.get_meta(doctype)
                user_roles = frappe.get_roles(frappe.session.user)

                processing_fields = []
                for idx, fieldname in enumerate(result["keys"]):
                    df = meta.get_field(fieldname)
                    if not df:
                        continue
                    cfg = get_data_protection(df)
                    if cfg.get("encrypt") or (cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", [])):
                        processing_fields.append((idx, cfg, fieldname))

                for row in result["values"]:
                    for idx, cfg, fieldname in processing_fields:
                        if idx < len(row) and row[idx]:
                            value = row[idx]
                            if cfg.get("encrypt") and is_encrypted(value):
                                value = decrypt_value(value)
                            
                            if cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", []):
                                value = mask_value(value, cfg, user_roles)
                            
                            row[idx] = value

    except Exception as e:
        frappe.log_error("List Processing Error", frappe.get_traceback())
        logger.error(f"List processing failed: {e}")
    
    return result

def is_encrypted(value):
    """Check if value is encrypted (Fernet tokens start with 'gAAAA')"""
    return isinstance(value, str) and value.startswith("gAAAA")

@frappe.whitelist()
def get_data_protection(field):
    """Load data_protection config from field meta"""
    cfg = getattr(field, "data_protection", None)
    if not cfg:
        return {}
    try:
        if isinstance(cfg, str):
            return json.loads(cfg)
        return cfg
    except Exception as e:
        logger.error(f"Invalid data_protection JSON for field {field.fieldname}: {e}")
        return {}

@frappe.whitelist()
def get_cipher():
    """Get Fernet cipher using site_config.json 'encryption_key'"""
    key = frappe.conf.get("encryption_key")
    if not key:
        raise RuntimeError("Encryption key not found in site_config.json")
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"Invalid encryption key: {e}")

@frappe.whitelist()
def encrypt_value(value):
    """Encrypt value using Fernet"""
    if not value:
        return value
    try:
        cipher = get_cipher()
        return cipher.encrypt(str(value).encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return value

@frappe.whitelist()
def decrypt_value(value):
    """Decrypt value using Fernet"""
    if not value or not is_encrypted(value):
        return value
    try:
        cipher = get_cipher()
        return cipher.decrypt(value.encode()).decode()
    except InvalidToken:
        logger.warning(f"Invalid token during decryption, returning original value")
        return value
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return value

@frappe.whitelist()
def mask_value(value, cfg, user_roles):
    """Apply masking based on config"""
    if not value or not cfg.get("masking"):
        return value

    m = cfg["masking"]

    allowed_roles = m.get("role_based_unmask", [])
    if any(role in user_roles for role in allowed_roles):
        return value

    char = m.get("masking_character", "X")
    strategy = m.get("masking_strategy", "full").lower()
    
    try:
        value_str = str(value)
        
        if strategy == "full":
            return char * len(value_str)

        elif strategy == "partial":
            prefix = int(m.get("visible_prefix", 0))
            suffix = int(m.get("visible_suffix", 0))
            if prefix + suffix >= len(value_str):
                return char * len(value_str)
            middle_length = len(value_str) - prefix - suffix
            return value_str[:prefix] + (char * middle_length) + value_str[-suffix:]

        elif strategy == "regex":
            import re
            pattern = m.get("pattern", r".")
            masked_value = re.sub(pattern, char, value_str)
            return masked_value if masked_value != value_str else char * len(value_str)

        elif strategy == "custom":
            func_path = m.get("custom_function")
            if func_path:
                try:
                    fn = frappe.get_attr(func_path)
                    return fn(value_str, char)
                except Exception as e:
                    logger.error(f"Custom masking failed: {e}")
                    return char * len(value_str)
            else:
                return char * len(value_str)

        else:
            return char * len(value_str)

    except Exception as e:
        logger.error(f"Masking failed: {e}")
        return char * len(str(value))


@frappe.whitelist()
def mask_query_report(*args, **kwargs):
    """
    Wrapper around frappe.desk.query_report.run
    Apply decryption + masking on report data
    """
    result = query_report.run(*args, **kwargs)

    try:
        report_name = kwargs.get("report_name") or (args[0] if args else None)
        if not report_name:
            return result

        report = frappe.get_doc("Report", report_name)
        doctype = report.ref_doctype
        if not doctype:
            return result

        meta = frappe.get_meta(doctype)
        user_roles = frappe.get_roles(frappe.session.user)

        for row in result.get("result", []):
            for col in result.get("columns", []):
                fieldname = col.get("fieldname")
                if not fieldname:
                    continue

                df = meta.get_field(fieldname)
                if not df:
                    continue

                cfg = get_data_protection(df)

                if cfg.get("encrypt") or cfg.get("masking"):
                    val = row.get(fieldname)

                    if cfg.get("encrypt") and is_encrypted(val):
                        val = decrypt_value(val)

                    if cfg.get("masking") and "report" in cfg["masking"].get("apply_masking_on", []):
                        val = mask_value(val, cfg, user_roles)

                    row[fieldname] = val

    except Exception as e:
        frappe.log_error("Report Processing Error", frappe.get_traceback())
        logger.error(f"Report processing failed: {e}")

    return result


@frappe.whitelist()
def mask_query_report_export_query():
    """Custom export from query reports with masking"""
    from frappe.desk.utils import get_csv_bytes, pop_csv_params, provide_binary_file
    from frappe.desk.query_report import format_fields, build_xlsx_data, valid_report_name
    from frappe.utils.xlsxutils import handle_html

    # Step 1: replicate Frappe’s export_query logic
    form_params = frappe._dict(frappe.local.form_dict)
    csv_params = pop_csv_params(form_params)

    from frappe.desk.query_report import clean_params, parse_json
    clean_params(form_params)
    parse_json(form_params)

    report_name = form_params.report_name
    frappe.permissions.can_export(
        frappe.get_cached_value("Report", report_name, "ref_doctype"),
        raise_exception=True,
    )

    file_format_type = form_params.file_format_type
    custom_columns = frappe.parse_json(form_params.custom_columns or "[]")
    include_indentation = form_params.include_indentation
    include_filters = form_params.include_filters
    visible_idx = form_params.visible_idx
    include_hidden_columns = form_params.include_hidden_columns

    if isinstance(visible_idx, str):
        visible_idx = json.loads(visible_idx)

    # Step 2: Run report
    data = query_report.run(report_name, form_params.filters, custom_columns=custom_columns, are_default_filters=False)
    data = frappe._dict(data)
    data.filters = form_params.applied_filters

    if not data.columns:
        frappe.respond_as_web_page(
            _("No data to export"),
            _("You can try changing the filters of your report."),
        )
        return

    # Step 3: Apply masking here
    try:
        report = frappe.get_doc("Report", report_name)
        doctype = report.ref_doctype
        if doctype:
            meta = frappe.get_meta(doctype)
            user_roles = frappe.get_roles(frappe.session.user)

            for row in data.result:
                for col, val in row.items():
                    df = meta.get_field(col)
                    if not df:
                        continue

                    cfg = get_data_protection(df)

                    if cfg.get("encrypt") and is_encrypted(val):
                        val = decrypt_value(val)

                    if cfg.get("masking") and "report" in cfg["masking"].get("apply_masking_on", []):
                        val = mask_value(val, cfg, user_roles)

                    row[col] = val
    except Exception:
        frappe.log_error("Report Export Masking Error", frappe.get_traceback())

    # Step 4: Continue with normal export
    format_fields(data)
    xlsx_data, column_widths = build_xlsx_data(
        data,
        visible_idx,
        include_indentation,
        include_filters=include_filters,
        include_hidden_columns=include_hidden_columns,
    )

    if file_format_type == "CSV":
        content = get_csv_bytes(
            [[handle_html(frappe.as_unicode(v)) if isinstance(v, str) else v for v in r] for r in xlsx_data],
            csv_params,
        )
        file_extension = "csv"
    elif file_format_type == "Excel":
        from frappe.utils.xlsxutils import make_xlsx

        file_extension = "xlsx"
        content = make_xlsx(xlsx_data, "Query Report", column_widths=column_widths).getvalue()

    if include_filters:
        for value in (data.filters or {}).values():
            suffix = ""
            if isinstance(value, list):
                suffix = "_" + ",".join(value)
            elif isinstance(value, str) and value not in {"Yes", "No"}:
                suffix = f"_{value}"

            if valid_report_name(report_name, suffix):
                report_name += suffix

    provide_binary_file(report_name, file_extension, content)



# ==================== EXPORT HANDLING ====================

@frappe.whitelist()
def mask_export_query(*args, **kwargs):
    """
    Wrapper around frappe.desk.reportview.export_query
    """
    result = reportview.export_query(*args, **kwargs)
    
    try:
        doctype = kwargs.get("doctype") or (args[0] if args else None)
        if not doctype:
            return result

        meta = frappe.get_meta(doctype)
        user_roles = frappe.get_roles(frappe.session.user)

        # Keys exist in first row
        if result and isinstance(result, list):
            header = result[0]  # first row is header
            for i, fieldname in enumerate(header):
                df = meta.get_field(fieldname)
                if not df:
                    continue

                cfg = get_data_protection(df)
                if not (cfg.get("encrypt") or cfg.get("masking")):
                    continue

                # Process each row after header
                for row in result[1:]:
                    if i < len(row) and row[i]:
                        val = row[i]

                        if cfg.get("encrypt") and is_encrypted(val):
                            val = decrypt_value(val)

                        if cfg.get("masking") and "report" in cfg["masking"].get("apply_masking_on", []):
                            val = mask_value(val, cfg, user_roles)

                        row[i] = val

    except Exception as e:
        frappe.log_error("Export Processing Error", frappe.get_traceback())
        logger.error(f"Export processing failed: {e}")

    return result