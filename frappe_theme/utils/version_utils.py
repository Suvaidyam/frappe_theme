import json

import frappe
from frappe.model import get_permitted_fields


class VersionUtils:
	"""
	Class-based utility for version management with custom filtering.
	This class can be extended in other apps to add custom filters.
	"""

	@staticmethod
	def build_version_filters(dt, dn, filters=None):
		"""
		Build version filters. This method can be overridden in other apps.
		Extends the base filter logic from frappe_theme.

		Args:
		        dt: DocType name
		        dn: Document name
		        filters: Optional filters dictionary

		Returns:
		        tuple: (where_clause, search_param_cond, additional_joins, additional_where)
		"""
		# Parse filters if string
		if isinstance(filters, str):
			filters = json.loads(filters)

		# Base where clause
		where_clause = f"ver.ref_doctype = '{dt}' AND ver.docname = '{dn}'"
		search_param_cond = ""
		additional_joins = ""
		additional_where = ""

		# Apply standard filters
		if filters and isinstance(filters, dict):
			if filters.get("doctype"):
				where_clause += f" AND (ver.custom_actual_doctype = '{filters['doctype']}' OR (COALESCE(ver.custom_actual_doctype, '') = '' AND ver.ref_doctype = '{filters['doctype']}'))"

			if filters.get("owner"):
				search_param_cond = f" AND usr.full_name LIKE '{filters['owner']}%'"
			else:
				search_param_cond = ""

		return where_clause, search_param_cond, additional_joins, additional_where

	@classmethod
	def get_versions(cls, dt, dn, page_length, start, filters=None):
		"""
		Get versions using class-based filter builder.
		This method uses build_version_filters which can be overridden in subclasses.

		Args:
		        dt: DocType name
		        dn: Document name
		        page_length: Number of records per page
		        start: Starting offset
		        filters: Optional filters dictionary

		Returns:
		        list: List of version records
		"""
		where_clause, search_param_cond, additional_joins, additional_where = cls.build_version_filters(
			dt, dn, filters
		)
		sql = f"""
			WITH extracted AS (
				-- Regular field changes
				SELECT
					ver.name AS name,
					ver.owner AS owner,
					ver.creation AS creation,
					ver.custom_actual_doctype,
					ver.custom_actual_document_name,
					ver.ref_doctype,
					ver.docname,
					jt.elem AS changed_elem,
					JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[0]')) AS field_name,
					JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[1]')) AS old_value,
					JSON_UNQUOTE(JSON_EXTRACT(jt.elem, '$[2]')) AS new_value,
					NULL AS child_table_field,
					NULL AS row_name,
					0 AS is_child_table
				FROM `tabVersion` AS ver
				CROSS JOIN JSON_TABLE(JSON_EXTRACT(ver.data, '$.changed'), '$[*]'
					COLUMNS (
						elem JSON PATH '$'
					)
				) jt
				WHERE {where_clause}
				AND JSON_EXTRACT(ver.data, '$.changed') IS NOT NULL

				UNION ALL

				-- Child table row changes
				SELECT
					ver.name AS name,
					ver.owner AS owner,
					ver.creation AS creation,
					ver.custom_actual_doctype,
					ver.custom_actual_document_name,
					ver.ref_doctype,
					ver.docname,
					fc.elem AS changed_elem,
					JSON_UNQUOTE(JSON_EXTRACT(fc.elem, '$[0]')) AS field_name,
					JSON_UNQUOTE(JSON_EXTRACT(fc.elem, '$[1]')) AS old_value,
					JSON_UNQUOTE(JSON_EXTRACT(fc.elem, '$[2]')) AS new_value,
					JSON_UNQUOTE(JSON_EXTRACT(rc.elem, '$[0]')) AS child_table_field,
					JSON_UNQUOTE(JSON_EXTRACT(rc.elem, '$[2]')) AS row_name,
					1 AS is_child_table
				FROM `tabVersion` AS ver
				CROSS JOIN JSON_TABLE(JSON_EXTRACT(ver.data, '$.row_changed'), '$[*]'
					COLUMNS (
						elem JSON PATH '$'
					)
				) rc
				CROSS JOIN JSON_TABLE(JSON_EXTRACT(rc.elem, '$[3]'), '$[*]'
					COLUMNS (
						elem JSON PATH '$'
					)
				) fc
				WHERE {where_clause}
				AND JSON_EXTRACT(ver.data, '$.row_changed') IS NOT NULL
				AND JSON_EXTRACT(rc.elem, '$[3]') IS NOT NULL
			)
			SELECT
				e.custom_actual_doctype,
				e.custom_actual_document_name,
				e.ref_doctype,
				usr.full_name AS owner,
				e.creation AS creation,
				e.docname,
				JSON_ARRAYAGG(
					JSON_ARRAY(
						CASE
							WHEN e.is_child_table = 1 THEN
								CONCAT(
									COALESCE(
										(SELECT tf.label FROM `tabDocField` tf WHERE e.child_table_field = tf.fieldname AND tf.parent = e.ref_doctype LIMIT 1),
										(SELECT tf.label FROM `tabDocField` tf WHERE e.child_table_field = tf.fieldname AND tf.parent = e.custom_actual_doctype LIMIT 1),
										(SELECT ctf.label FROM `tabCustom Field` ctf WHERE e.child_table_field = ctf.fieldname AND ctf.dt = e.ref_doctype LIMIT 1),
										(SELECT ctf.label FROM `tabCustom Field` ctf WHERE e.child_table_field = ctf.fieldname AND ctf.dt = e.custom_actual_doctype LIMIT 1),
										e.child_table_field
									),
									' > ',
									COALESCE(
										(SELECT tf.label FROM `tabDocField` tf
										 WHERE e.field_name = tf.fieldname
										 AND tf.parent = COALESCE(
											 (SELECT tf2.options FROM `tabDocField` tf2 WHERE tf2.fieldname = e.child_table_field AND tf2.parent = COALESCE(e.custom_actual_doctype, e.ref_doctype) LIMIT 1),
											 (SELECT ctf2.options FROM `tabCustom Field` ctf2 WHERE ctf2.fieldname = e.child_table_field AND ctf2.dt = COALESCE(e.custom_actual_doctype, e.ref_doctype) LIMIT 1)
										 ) LIMIT 1),
										(SELECT ctf.label FROM `tabCustom Field` ctf
										 WHERE ctf.fieldname = e.field_name
										 AND ctf.dt = COALESCE(
											 (SELECT tf2.options FROM `tabDocField` tf2 WHERE tf2.fieldname = e.child_table_field AND tf2.parent = COALESCE(e.custom_actual_doctype, e.ref_doctype) LIMIT 1),
											 (SELECT ctf2.options FROM `tabCustom Field` ctf2 WHERE ctf2.fieldname = e.child_table_field AND ctf2.dt = COALESCE(e.custom_actual_doctype, e.ref_doctype) LIMIT 1)
										 ) LIMIT 1),
										e.field_name
									)
								)
							ELSE
								COALESCE(
									(SELECT tf.label FROM `tabDocField` tf WHERE e.field_name = tf.fieldname AND tf.parent = e.ref_doctype LIMIT 1),
									(SELECT tf.label FROM `tabDocField` tf WHERE e.field_name = tf.fieldname AND tf.parent = e.custom_actual_doctype LIMIT 1),
									(SELECT ctf.label FROM `tabCustom Field` ctf WHERE e.field_name = ctf.fieldname AND ctf.dt = e.ref_doctype LIMIT 1),
									(SELECT ctf.label FROM `tabCustom Field` ctf WHERE e.field_name = ctf.fieldname AND ctf.dt = e.custom_actual_doctype LIMIT 1),
									e.field_name
								)
						END,
						COALESCE(
							CASE
								WHEN e.old_value = 'null' OR e.old_value = '' THEN '(blank)'
								ELSE e.old_value
							END,
							''
						),
						COALESCE(
							CASE
								WHEN e.new_value = 'null' OR e.new_value = '' THEN '(blank)'
								ELSE e.new_value
							END,
							''
						),
						e.is_child_table,
						e.child_table_field,
						e.row_name,
						e.field_name
					)
				) AS changed
			FROM extracted e
			LEFT JOIN `tabUser` AS usr ON e.owner = usr.name
			{additional_joins}
			WHERE 1=1 {additional_where} {search_param_cond}
			GROUP BY e.name
			ORDER BY e.creation DESC
			LIMIT {page_length}
			OFFSET {start}
		"""
		results = frappe.db.sql(sql, as_dict=True)

		# Apply field-level permissions filtering
		if results:
			if frappe.session.user != "Administrator":
				results = VersionUtils._apply_field_level_permissions(results, dt)
			else:
				# For Administrator, still filter out entries with empty changed arrays
				results = VersionUtils._filter_empty_changed_arrays(results)

		return results

	def _filter_empty_changed_arrays(results):
		"""Filter out entries with empty changed arrays (for Administrator users)."""
		filtered_results = []
		for result in results:
			changed_value = result.get("changed")

			# Skip entries with empty or missing changed field
			if not changed_value:
				continue

			# Handle empty string or empty JSON array string
			if isinstance(changed_value, str):
				changed_value_stripped = changed_value.strip()
				if changed_value_stripped in ("", "[]", "null"):
					continue

			try:
				changed_array = json.loads(changed_value) if isinstance(changed_value, str) else changed_value
			except (json.JSONDecodeError, TypeError):
				# Skip entries with invalid JSON
				continue

			if not isinstance(changed_array, list):
				continue

			# Skip entries with empty array
			if len(changed_array) == 0:
				continue

			filtered_results.append(result)

		return filtered_results

	def _apply_field_level_permissions(results, parent_doctype):
		"""
		Filter field changes based on user's field-level permissions.
		Uses caching to optimize performance.
		"""
		# Cache for permitted fields per doctype
		permitted_fields_cache = {}
		# Cache for child table doctype resolution
		child_table_doctype_cache = {}

		def get_cached_permitted_fields(doctype, parenttype=None):
			"""Get permitted fields with caching."""
			cache_key = (doctype, parenttype)
			if cache_key not in permitted_fields_cache:
				permitted_fields_cache[cache_key] = set(
					get_permitted_fields(
						doctype=doctype,
						parenttype=parenttype,
						ignore_virtual=True,
					)
				)
			return permitted_fields_cache[cache_key]

		def get_child_table_doctype(parent_doctype, child_table_field):
			"""Get child table doctype from parent doctype and fieldname."""
			cache_key = (parent_doctype, child_table_field)
			if cache_key not in child_table_doctype_cache:
				# Try to get from meta
				try:
					meta = frappe.get_meta(parent_doctype)
					field = meta.get_field(child_table_field)
					if field and field.fieldtype == "Table":
						child_table_doctype_cache[cache_key] = field.options
					else:
						child_table_doctype_cache[cache_key] = None
				except Exception:
					child_table_doctype_cache[cache_key] = None
			return child_table_doctype_cache[cache_key]

		# Process each result
		filtered_results = []
		for result in results:
			changed_value = result.get("changed")

			# Skip entries with empty or missing changed field
			if not changed_value:
				continue

			# Handle empty string or empty JSON array string
			if isinstance(changed_value, str):
				changed_value_stripped = changed_value.strip()
				if changed_value_stripped in ("", "[]", "null"):
					continue

			try:
				changed_array = json.loads(changed_value) if isinstance(changed_value, str) else changed_value
			except (json.JSONDecodeError, TypeError):
				# Skip entries with invalid JSON
				continue

			if not isinstance(changed_array, list):
				continue

			# Skip entries with empty array
			if len(changed_array) == 0:
				continue

			# Determine parent doctype for permission checks
			parent_doctype_for_check = (
				result.get("custom_actual_doctype") or result.get("ref_doctype") or parent_doctype
			)

			# Filter field changes based on permissions
			filtered_changes = []
			for change_item in changed_array:
				if not isinstance(change_item, list):
					# Skip non-list entries
					continue

				# Need at least field_name (index 6) for permission checking
				# Old format entries (< 7 elements) will be skipped
				if len(change_item) < 7:
					continue

				# Extract field information from the change array
				# Format: [field_label, old_value, new_value, is_child_table, child_table_field, row_name, field_name]
				is_child_table = change_item[3] if len(change_item) > 3 else 0
				# Handle string representation of boolean
				if isinstance(is_child_table, str):
					is_child_table = int(is_child_table) if is_child_table.isdigit() else 0
				is_child_table = bool(is_child_table)

				child_table_field = change_item[4] if len(change_item) > 4 else None
				field_name = change_item[6] if len(change_item) > 6 else None

				# If field_name is not available, try to extract from label (fallback)
				if not field_name and len(change_item) > 0:
					# This is a fallback - ideally field_name should always be present
					field_name = change_item[0] if change_item[0] else None

				if not field_name:
					# Skip if we can't determine field name
					continue

				# Determine the doctype to check permissions for
				doctype_to_check = parent_doctype_for_check
				parenttype_for_check = None

				if is_child_table and child_table_field:
					# For child table fields, get the child table doctype
					child_table_doctype = get_child_table_doctype(parent_doctype_for_check, child_table_field)
					if child_table_doctype:
						doctype_to_check = child_table_doctype
						parenttype_for_check = parent_doctype_for_check

				# Get permitted fields for this doctype
				permitted_fields = get_cached_permitted_fields(doctype_to_check, parenttype_for_check)

				# Check if field is permitted
				if field_name in permitted_fields:
					# Remove field_name from the array before adding (to maintain original format)
					# Keep only first 6 elements: [field_label, old_value, new_value, is_child_table, child_table_field, row_name]
					filtered_changes.append(change_item[:6])

			# Skip entries where all fields were filtered out (empty changed array)
			if len(filtered_changes) == 0:
				continue

			# Update result with filtered changes
			result_copy = result.copy()
			result_copy["changed"] = json.dumps(filtered_changes)
			filtered_results.append(result_copy)

		return filtered_results
