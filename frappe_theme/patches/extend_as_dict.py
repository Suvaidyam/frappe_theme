import frappe
from frappe.model.base_document import BaseDocument
from frappe_theme.utils.data_protection import get_data_protection, mask_value

_original_as_dict = BaseDocument.as_dict

@frappe.whitelist()
def masked_as_dict(self, *args, **kwargs):
    d = _original_as_dict(self, *args, **kwargs)
    user_roles = frappe.get_roles(frappe.session.user)

    for df in self.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("masking"):
            fieldname = df.fieldname
            if fieldname in d:
                d[fieldname] = mask_value(d[fieldname], cfg, user_roles)
    print(d,'d????????===============================???????????????????????????????????????')
    return d

def patch_as_dict():
    BaseDocument.as_dict = masked_as_dict
