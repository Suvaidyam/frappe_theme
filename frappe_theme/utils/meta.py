import frappe


@frappe.whitelist()
def get_meta(doctype, filters=None, keys=None, cached=True):
	"""
	Get filtered meta fields for a given doctype with optional key selection.

	Args:
	    doctype (str): Doctype name
	    filters (dict): Key-value conditions to filter fields.
	                    Supports exact match, list IN/NOT IN, and bool flags.
	    keys (list or dict): Keys to include in the response.
	                        - If list: ["fieldname", "fieldtype", "label"]
	                        - If dict: {"fieldname": "name", "fieldtype": "type"} (rename keys)
	                        - If None: returns full DocField objects

	Example usage:
	    # Get only specific keys
	    get_meta("Customer", keys=["fieldname", "fieldtype", "label"])

	    # Get keys with renaming
	    get_meta("Customer", keys={"fieldname": "name", "fieldtype": "type"})

	    # With filters and keys
	    get_meta("Customer",
	            filters={"fieldtype": ["Link", "Data"]},
	            keys=["fieldname", "label"])

	Returns:
	    list: Filtered list of fields with selected keys only
	"""
	meta = frappe.get_meta(doctype, cached)
	fields = []

	for f in meta.fields:
		if not f.fieldname:
			continue

		match = True
		if filters:
			for key, condition in filters.items():
				value = getattr(f, key, None)

				if isinstance(condition, dict):
					if "IN" in condition and value not in condition["IN"]:
						match = False
						break
					if "NOT IN" in condition and value in condition["NOT IN"]:
						match = False
						break
				elif isinstance(condition, list):
					if value not in condition:
						match = False
						break
				else:
					if value != condition:
						match = False
						break

		if match:
			if keys is None:
				# Return full DocField object
				fields.append(f)
			elif isinstance(keys, list):
				# Return dict with selected keys
				field_dict = {}
				for key in keys:
					field_dict[key] = getattr(f, key, None)
				fields.append(field_dict)
			elif isinstance(keys, dict):
				# Return dict with renamed keys
				field_dict = {}
				for original_key, new_key in keys.items():
					field_dict[new_key] = getattr(f, original_key, None)
				fields.append(field_dict)

	return fields
