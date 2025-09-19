# Copyright (c) 2025, Suvaidyam and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.model.document import Document


class SVAPropertySetter(Document):
	def on_update(self):
		self.sync_property_setter()

	def sync_property_setter(self):
		try:
			if not self.doc_type or not self.fname:
				frappe.throw('Doctype and Fieldname is required.')

			ps = frappe.db.get_value("Property Setter",{"doc_type": self.doc_type, "field_name": self.fname, "property": "data_protection"})
			config = {
				"encrypt": 1 if self.get("encrypt") else 0
			}
			if self.get("masking"):
				apply_masking_on = []

				if self.get("list_view"):
					apply_masking_on.append("list")
				if self.get("form_view"):
					apply_masking_on.append("form")
				if self.get("reports"):
					apply_masking_on.append("report")
				if self.get("api_response"):
					apply_masking_on.append("api")

				config["masking"] = {
					"masking_strategy": self.get("masking_strategy", "Partial"),
					"visible_prefix": self.get("visible_prefix", 2),
					"visible_suffix": self.get("visible_suffix", 2),
					"masking_character": self.get("masking_character", "X"),
					"role_based_unmask": [
						r.strip() for r in (self.get("role_based_unmask") or "").splitlines() if r.strip()
					],
					"apply_masking_on": apply_masking_on,
					"mask_on_export": 1 if self.get("mask_on_export") else 0,
					"custom_function": self.get("custom_function", ""),
					"pattern": self.get("pattern", "")
				}
			if ps:
				doc = frappe.get_doc("Property Setter", ps)
				doc.value = json.dumps(config)
				doc.flags.ignore_permissions = True
				doc.save()
			else:
				doc = frappe.get_doc({
					"doctype": "Property Setter",
					"doctype_or_field": "DocField",
					"doc_type": self.doc_type,
					"field_name": self.fname,
					"property": "data_protection",
					"value": json.dumps(config),
					"property_type": "Text"
				})
				doc.insert(ignore_permissions=True)
			# clear cache of meta for immediate effect
			frappe.clear_cache(doctype=self.doc_type)
		except Exception as e:
			frappe.log_error('Error in sync property setter', frappe.get_traceback())	
	
	def on_trash(self):
		ps = frappe.db.exists("Property Setter",{"doc_type": self.doc_type, "field_name": self.fname, "property": "data_protection"})
		if ps:
			frappe.delete_doc('Property Setter', ps, force=1, ignore_permissions=True, ignore_missing=True)
			frappe.db.commit()


