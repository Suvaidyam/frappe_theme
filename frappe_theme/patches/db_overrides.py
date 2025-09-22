import frappe
from frappe_theme.utils.data_protection import decrypt_value, mask_value, get_data_protection

_original_get_value = frappe.db.get_value

def patched_get_value(*args, **kwargs):
    print('patched_get_value????????????????????????????????????????????????????????????????????')
    result = _original_get_value(*args, **kwargs)
    if not result:
        return result

    doctype = args[0]
    fields = args[1] if isinstance(args[1], (list, tuple)) else [args[1]]

    meta = frappe.get_meta(doctype)
    user_roles = frappe.get_roles(frappe.session.user)

    def process_value(val, df):
        if not df: return val
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = decrypt_value(val)
        if cfg.get("masking"):
            val = mask_value(val, cfg, user_roles)
        return val

    if isinstance(result, dict):
        for f in fields:
            df = meta.get_field(f)
            if f in result:
                result[f] = process_value(result[f], df)
    elif isinstance(result, (list, tuple)):
        new_res = []
        for i, f in enumerate(fields):
            df = meta.get_field(f)
            new_res.append(process_value(result[i], df))
        result = tuple(new_res) if isinstance(result, tuple) else new_res
    else:
        df = meta.get_field(fields[0])
        result = process_value(result, df)

    return result

frappe.db.get_value = patched_get_value
