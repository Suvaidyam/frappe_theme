import frappe


def validate(self, method):
	dt_connections = frappe.get_all("SVADatatable Configuration", pluck="name")
	if self.ref_doctype in dt_connections:
		return
	template_dt = {
		"File": {"dt_reference_field": "attached_to_doctype", "dn_reference_field": "attached_to_name"},
		"ToDo": {"dt_reference_field": "reference_type", "dn_reference_field": "reference_name"},
		"Notes": {"dt_reference_field": "reference_doctype", "dn_reference_field": "related_to"},
	}
	if self.ref_doctype in template_dt:
		dt = template_dt[self.ref_doctype]
		curr_doc = frappe.get_doc(self.ref_doctype, self.docname)
		if (
			curr_doc
			and curr_doc.get(dt.get("dt_reference_field"))
			and curr_doc.get(dt.get("dn_reference_field"))
		):
			self.custom_actual_doctype = self.ref_doctype
			self.custom_actual_document_name = self.docname
			self.ref_doctype = curr_doc.get(dt.get("dt_reference_field"))
			self.docname = curr_doc.get(dt.get("dn_reference_field"))
	else:
		dts = frappe.get_all(
			"SVADatatable Configuration Child",
			filters=[["SVADatatable Configuration Child", "connection_type", "IN", ["Direct"]]],
			or_filters=[
				["SVADatatable Configuration Child", "link_doctype", "=", self.ref_doctype],
				["SVADatatable Configuration Child", "referenced_link_doctype", "=", self.ref_doctype],
			],
			fields=[
				"parent",
				"connection_type",
				"link_doctype",
				"referenced_link_doctype",
				"local_field",
				"foreign_field",
				"link_fieldname",
				"dt_reference_field",
				"dn_reference_field",
			],
		)
		if len(dts) > 0:
			dt = dts[0]
			if dt.connection_type == "Direct":
				if self.ref_doctype == dt.link_doctype:
					curr_doc = frappe.get_doc(self.ref_doctype, self.docname)
					if curr_doc and curr_doc.get(dt.link_fieldname):
						self.custom_actual_doctype = self.ref_doctype
						self.custom_actual_document_name = self.docname
						self.ref_doctype = dt.parent
						self.docname = curr_doc.get(dt.link_fieldname)
