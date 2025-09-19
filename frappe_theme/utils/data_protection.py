import json
import frappe
import logging
from cryptography.fernet import Fernet, InvalidToken
from frappe.desk import reportview

logger = logging.getLogger(__name__)

# ---------- Load Config ----------
@frappe.whitelist()
def get_data_protection(field):
    """
    Load data_protection config from field meta
    """
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

# ---------- Encryption / Decryption ----------
@frappe.whitelist()
def get_cipher():
    """
    Get Fernet cipher using site_config.json 'encryption_key'
    """
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
        return cipher.encrypt(value.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return value  # fallback (don’t break saving)


@frappe.whitelist()
def decrypt_value(value):
    """Decrypt value using Fernet"""
    if not value:
        return value
    try:
        cipher = get_cipher()
        return cipher.decrypt(value.encode()).decode()
    except InvalidToken:
        # Value was not encrypted or key changed
        return value
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return value

# ---------- Masking ----------
@frappe.whitelist()
def mask_value(value, cfg, user_roles):
    """
    Apply masking based on config
    """
    if not value or not cfg.get("masking"):
        return value

    m = cfg["masking"]

    # Role-based unmask
    allowed_roles = m.get("role_based_unmask", [])
    if any(role in user_roles for role in allowed_roles):
        return value

    char = m.get("masking_character", "X")
    strategy = m.get("masking_strategy", "full").lower()
    try:
        if strategy == "full":
            return char * len(value)

        elif strategy == "partial":
            prefix, suffix = int(m.get("visible_prefix", 0)), int(m.get("visible_suffix", 0))
            if prefix + suffix >= len(value):
                return char * len(value)
            return value[:prefix] + (char * (len(value) - prefix - suffix)) + value[-suffix:]

        elif strategy == "regex":
            import re
            pattern = m.get("pattern", r".")
            masked_value = re.sub(pattern, char, value)
            if masked_value == value:
                return char * len(value)
            return masked_value

        elif strategy == "custom function":
            func_path = m.get("custom_function")
            if func_path:
                try:
                    fn = frappe.get_attr(func_path)
                    return fn(value,char)
                except Exception as e:
                    logger.error(f"Custom masking failed: {e}")
                    return char * len(value)
            else:
                return char * len(value)

        else:
            return char * len(value)

    except Exception as e:
        logger.error(f"Masking failed: {e}")
    return value

@frappe.whitelist()
def encrypt_doc_fields(doc, method=None):
    """Encrypt fields before saving"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val and not val.startswith("gAAAA"):
                print(val,'encrypt_value???????????????????????????????????????????????',encrypt_value(val))
                doc.set(df.fieldname, encrypt_value(val))

@frappe.whitelist()
def decrypt_doc_fields(doc, method=None):
    """Decrypt fields after loading"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val:
                print(val,'decrypt_value???????????????????????????????????????????????',decrypt_value(val))
                doc.set(df.fieldname, decrypt_value(val))

@frappe.whitelist()
def get_with_masking(*args, **kwargs):
    """Wrapper around frappe.desk.reportview.get to apply masking on list view"""
    result = reportview.get(*args, **kwargs)
    try:
        # Frappe v15 returns { keys: [...], values: [...] }
        if isinstance(result, dict) and "keys" in result and "values" in result:
            doctype = kwargs.get("doctype") or (args[0] if args else None)
            if doctype:
                meta = frappe.get_meta(doctype)
                user_roles = frappe.get_roles(frappe.session.user)

                # Find index of fields that need masking
                masking_fields = []
                for idx, fieldname in enumerate(result["keys"]):
                    df = meta.get_field(fieldname)
                    if not df:
                        continue
                    cfg = get_data_protection(df)
                    if cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", []):
                        masking_fields.append((idx, cfg))

                # Apply masking on each row
                for row in result["values"]:
                    for idx, cfg in masking_fields:
                        if idx < len(row):
                            row[idx] = mask_value(row[idx], cfg, user_roles)

    except Exception:
        frappe.log_error("List Masking Error", frappe.get_traceback())
    return result

@frappe.whitelist()
def mask_doc_list(docs, meta):
    """Mask values in list view / reports"""
    user_roles = frappe.get_roles(frappe.session.user)
    for doc in docs:
        for df in meta.fields:
            cfg = get_data_protection(df)
            if cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", []):
                if df.fieldname in doc:
                    doc[df.fieldname] = mask_value(doc[df.fieldname], cfg, user_roles)
    return docs