import json

import frappe
from frappe import _


@frappe.whitelist()
def add_more_batch(doctype, filters, grouping_field, link_field=None):
	"""
	Generic "Add More" batch duplication for SVAVerticalDocRenderer.

	Finds the latest batch (max grouping_field value) from existing records
	that match `filters`, then duplicates every record in that batch with
	grouping_field = max + 1.  All other field values are carried over as-is
	so the new batch starts as an exact copy ready for editing.

	Args:
	    doctype (str):        Child DocType to duplicate records in.
	    filters (str|list):   JSON-encoded frappe filter array.
	    grouping_field (str): Field that identifies the batch (e.g. "batch_no").
	    link_field (str|None): Field that links to the item/plot — used for
	                           reference only, not required for duplication.

	Returns:
	    dict: {
	        created   (int):      Number of new records inserted.
	        next_batch (int):     Batch number assigned to the new records.
	        names     (list[str]): Names of the newly created documents.
	    }
	"""
	frappe.has_permission(doctype, "write", throw=True)

	if isinstance(filters, str):
		filters = json.loads(filters)

	# ── Discover data fields from meta ──────────────────────────────────────
	meta = frappe.get_meta(doctype)

	SKIP_TYPES = {
		"Section Break",
		"Column Break",
		"Tab Break",
		"HTML",
		"Table",
		"Button",
		"Fold",
		"Heading",
		"Image",
		"Signature",
		"Barcode",
	}
	SYSTEM_FIELDS = {
		"name",
		"creation",
		"modified",
		"modified_by",
		"owner",
		"docstatus",
		"idx",
		"doctype",
		"parent",
		"parentfield",
		"parenttype",
		"amended_from",
	}

	data_fieldnames = [
		df.fieldname
		for df in meta.fields
		if df.fieldtype not in SKIP_TYPES and df.fieldname not in SYSTEM_FIELDS
	]

	if not data_fieldnames:
		frappe.throw(_("No data fields found for {0}").format(doctype))

	fetch_fields = list({"name", grouping_field} | set(data_fieldnames))

	# ── Fetch all records matching parent filters ────────────────────────────
	records = frappe.db.get_all(
		doctype,
		filters=filters,
		fields=fetch_fields,
		limit=0,
	)

	if not records:
		return {"created": 0, "next_batch": 1, "names": []}

	# ── Find max batch value (supports integer batch numbers) ────────────────
	def safe_int(v):
		try:
			return int(v or 0)
		except (ValueError, TypeError):
			return 0

	max_batch = max(safe_int(r.get(grouping_field)) for r in records)
	next_batch = max_batch + 1

	latest_batch = [r for r in records if safe_int(r.get(grouping_field)) == max_batch]

	if not latest_batch:
		return {"created": 0, "next_batch": next_batch, "names": []}

	# ── Duplicate each record in the latest batch ────────────────────────────
	created_names = []
	for record in latest_batch:
		new_doc = frappe.new_doc(doctype)
		for field in data_fieldnames:
			if field != grouping_field and field in record:
				new_doc.set(field, record[field])
		new_doc.set(grouping_field, next_batch)
		new_doc.insert(ignore_permissions=False)
		created_names.append(new_doc.name)

	frappe.db.commit()

	return {
		"created": len(created_names),
		"next_batch": next_batch,
		"names": created_names,
	}


@frappe.whitelist()
def delete_batch_records(doctype, filters, grouping_field, batch_value):
	"""
	Delete all records belonging to a specific batch.

	Args:
	    doctype (str):         DocType to delete records from.
	    filters (str|list):    JSON-encoded frappe filter array (parent filters).
	    grouping_field (str):  Field that identifies the batch (e.g. "batch_no").
	    batch_value:           Value of the batch to delete (e.g. 2).

	Returns:
	    dict: { deleted (int): number of records deleted }
	"""
	frappe.has_permission(doctype, "delete", throw=True)

	if isinstance(filters, str):
		filters = json.loads(filters)

	# Coerce batch_value to int when it looks numeric
	try:
		batch_value = int(batch_value)
	except (ValueError, TypeError):
		pass

	batch_filters = list(filters) + [[grouping_field, "=", batch_value]]
	names = frappe.db.get_all(doctype, filters=batch_filters, pluck="name")

	deleted = 0
	for name in names:
		frappe.delete_doc(doctype, name, ignore_permissions=False)
		deleted += 1

	frappe.db.commit()
	return {"deleted": deleted}
