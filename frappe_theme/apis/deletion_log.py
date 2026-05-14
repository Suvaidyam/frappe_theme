import re

import frappe

_HTML_TAG_RE = re.compile(r"<[^>]+>")

_SYSTEM_MODULES = (
	"Core",
	"Desk",
	"Email",
	"Integrations",
	"Printing",
	"Website",
	"Workflow",
	"Contacts",
	"Custom",
	"Automation",
)


# ── Internal helpers ──────────────────────────────────────────────────────────


def _strip_html(html: str, max_len: int = 200) -> str:
	"""Strip HTML tags and collapse whitespace for a plain-text preview."""
	text = _HTML_TAG_RE.sub(" ", html or "")
	text = re.sub(r"\s+", " ", text).strip()
	if len(text) > max_len:
		text = text[:max_len].rstrip() + "…"
	return text


def _build_deletion_summary(
	deleted_doctype: str, doc_data: dict, link_field_to_skip: str | list
) -> list[dict]:
	"""
	Build summary fields for a deleted document.
	link_field_to_skip: fieldname string or list of fieldnames to hide
	(e.g. both parts of a Dynamic Link pair).
	"""
	skip_fields: set = set()
	if isinstance(link_field_to_skip, list):
		skip_fields.update(link_field_to_skip)
	elif link_field_to_skip:
		skip_fields.add(link_field_to_skip)

	_system_skip = {
		"doctype",
		"name",
		"owner",
		"creation",
		"modified",
		"modified_by",
		"docstatus",
		"idx",
		"parent",
		"parenttype",
		"parentfield",
		"amended_from",
		"__islocal",
		"__unsaved",
	} | skip_fields

	_layout_types = {
		"Section Break",
		"Column Break",
		"Tab Break",
		"HTML",
		"Button",
		"Heading",
		"Fold",
		"Image",
	}
	_child_table_types = {"Table", "Table MultiSelect"}
	_html_types = {"Text Editor", "HTML Editor", "Long Text", "Small Text"}

	try:
		meta = frappe.get_meta(deleted_doctype)
		field_map = {df.fieldname: df for df in meta.fields}
	except Exception:
		return []

	summary = []
	for fieldname, value in doc_data.items():
		if fieldname in _system_skip:
			continue
		if value in (None, "", [], {}):
			continue
		df = field_map.get(fieldname)
		if not df:
			continue
		if df.hidden or df.fieldtype in _layout_types:
			continue

		if df.fieldtype in _child_table_types:
			count = len(value) if isinstance(value, list) else 0
			if count:
				summary.append(
					{
						"fieldname": fieldname,
						"label": df.label or fieldname,
						"value": f"{count} row{'s' if count != 1 else ''}",
						"fieldtype": df.fieldtype,
						"link_options": None,
					}
				)
			continue

		display_value = _strip_html(str(value)) if df.fieldtype in _html_types else str(value)
		summary.append(
			{
				"fieldname": fieldname,
				"label": df.label or fieldname,
				"value": display_value,
				"fieldtype": df.fieldtype,
				"link_options": df.options if df.fieldtype == "Link" else None,
			}
		)

	return summary


def _resolve_link_titles(summary_rows: list[dict]) -> list[dict]:
	"""
	For every Link-type field in summary_rows, replace the raw name with
	'Title (name)' by batch-fetching titles per linked doctype.
	"""
	by_dt: dict[str, list[tuple[int, str]]] = {}
	for idx, item in enumerate(summary_rows):
		if item.get("fieldtype") == "Link" and item.get("link_options") and item.get("value"):
			by_dt.setdefault(item["link_options"], []).append((idx, item["value"]))

	for linked_dt, idx_vals in by_dt.items():
		try:
			linked_meta = frappe.get_meta(linked_dt)
			title_field = linked_meta.title_field or "name"
			values = [v for _, v in idx_vals]
			in_ph = ", ".join(["%s"] * len(values))
			title_rows = frappe.db.sql(
				f"SELECT `name`, `{title_field}` AS title FROM `tab{linked_dt}` WHERE `name` IN ({in_ph})",
				values,
				as_dict=True,
			)
			name_to_title = {r.name: r.title for r in title_rows if r.title and r.title != r.name}
			for idx, value in idx_vals:
				title = name_to_title.get(value)
				summary_rows[idx]["value"] = f"{title} ({value})" if title else value
		except Exception:
			pass

	return [
		{"label": r["label"], "value": r["value"], "fieldtype": r.get("fieldtype", "")} for r in summary_rows
	]


def _build_connections(dt: str) -> dict[str, list[str]]:
	"""Return {deleted_doctype: [link_fieldnames]} map for dt.

	Sources (merged, no duplicates):
	1. SVADatatable Configuration — explicit app-specific mappings
	2. Direct Link fields          — tabDocField where options = dt
	3. Dynamic Link patterns       — doctype_field (Link→DocType) + name_field (Dynamic Link)
	4. Child tables of dt          — matched via 'parent' field
	5. File attachments            — attached_to_doctype / attached_to_name
	6. Notes                       — reference_doctype / related_to
	"""

	def _add(d: dict, doctype: str, fieldname: str) -> None:
		d.setdefault(doctype, [])
		if fieldname not in d[doctype]:
			d[doctype].append(fieldname)

	connections: dict[str, list[str]] = {dt: [""]}

	# ── 1. SVADatatable Configuration ─────────────────────────────────────────
	if frappe.db.exists("SVADatatable Configuration", dt):
		config = frappe.get_doc("SVADatatable Configuration", dt)
		for row in config.child_doctypes:
			if row.connection_type == "Direct" and row.link_doctype and row.link_fieldname:
				_add(connections, row.link_doctype, row.link_fieldname)
			elif (
				row.connection_type == "Referenced" and row.referenced_link_doctype and row.dt_reference_field
			):
				if row.dn_reference_field:
					marker = f"__dl__{row.dt_reference_field}:{row.dn_reference_field}"
					_add(connections, row.referenced_link_doctype, marker)
				else:
					_add(connections, row.referenced_link_doctype, row.dt_reference_field)

	_sys_ph = ", ".join(["%s"] * len(_SYSTEM_MODULES))

	# ── 2. Direct Link fields pointing to dt ──────────────────────────────────
	auto_links = frappe.db.sql(
		f"""
		SELECT DISTINCT df.parent AS link_doctype, df.fieldname AS link_field
		FROM `tabDocField` df
		INNER JOIN `tabDocType` dtt ON dtt.name = df.parent
		WHERE df.fieldtype = 'Link'
		  AND df.options = %s
		  AND dtt.issingle = 0
		  AND dtt.istable  = 0
		  AND dtt.module NOT IN ({_sys_ph})
		""",
		(dt, *_SYSTEM_MODULES),
		as_dict=True,
	)
	for row in auto_links:
		_add(connections, row.link_doctype, row.link_field)

	# ── 3. Dynamic Link patterns ───────────────────────────────────────────────
	dyn_links = frappe.db.sql(
		f"""
		SELECT DISTINCT
			df_dt.parent        AS link_doctype,
			df_dt.fieldname     AS doctype_field,
			df_ref.fieldname    AS name_field
		FROM `tabDocField` df_dt
		INNER JOIN `tabDocField` df_ref
			ON  df_ref.parent    = df_dt.parent
			AND df_ref.fieldtype = 'Dynamic Link'
			AND df_ref.options   = df_dt.fieldname
		INNER JOIN `tabDocType` dtt ON dtt.name = df_dt.parent
		WHERE df_dt.fieldtype = 'Link'
		  AND df_dt.options   = 'DocType'
		  AND dtt.issingle    = 0
		  AND dtt.istable     = 0
		  AND dtt.module NOT IN ({_sys_ph})
		""",
		_SYSTEM_MODULES,
		as_dict=True,
	)
	for row in dyn_links:
		_add(connections, row.link_doctype, f"__dl__{row.doctype_field}:{row.name_field}")

	# ── 4. Child tables of dt ─────────────────────────────────────────────────
	child_tables = frappe.db.sql(
		"""
		SELECT DISTINCT df.options AS child_dt
		FROM `tabDocField` df
		WHERE df.parent = %s
		  AND df.fieldtype IN ('Table', 'Table MultiSelect')
		  AND df.options IS NOT NULL AND df.options != ''
		""",
		(dt,),
		as_dict=True,
	)
	for row in child_tables:
		if row.child_dt:
			_add(connections, row.child_dt, "parent")

	# ── 5. File attachments (Data field — not a Dynamic Link) ─────────────────
	_add(connections, "File", "__dl__attached_to_doctype:attached_to_name")

	# ── 6. Notes (reference_doctype / related_to — Data field) ───────────────
	_add(connections, "Notes", "__dl__reference_doctype:related_to")

	return connections


# ── Whitelisted API endpoints ─────────────────────────────────────────────────


@frappe.whitelist()
def get_deletion_log_doctypes(dt: str) -> dict:
	"""Return doctype filter options and theme settings for the deletion log drawer."""
	connections = _build_connections(dt)
	try:
		always_show = bool(frappe.db.get_single_value("My Theme", "deleted_doc_always_show"))
	except Exception:
		always_show = True  # safe default — don't warn if setting unreadable

	return {
		"doctypes": [{"value": k, "label": k, "is_parent": k == dt} for k in connections],
		"always_show": always_show,
	}


@frappe.whitelist()
def get_deletion_log(dt: str, dn: str, date_filter: str = "all", doctype_filter: str = "") -> list[dict]:
	"""
	Return deleted documents related to document (dt, dn).

	date_filter:    "all" | "last_7_days"
	doctype_filter: "" (all) | specific deleted_doctype value

	Strategy: query by deleted_doctype (indexed) per doctype, then match
	link fields in Python — avoids JSON_EXTRACT in WHERE.
	"""
	date_cond = "AND creation >= DATE_SUB(NOW(), INTERVAL 7 DAY)" if date_filter == "last_7_days" else ""

	connections = _build_connections(dt)

	if doctype_filter and doctype_filter in connections:
		connections = {doctype_filter: connections[doctype_filter]}

	# ── Step 1: per-doctype queries (LIMIT 300 each) ──────────────────────────
	meta_rows = []
	for doc_type in connections:
		rows = frappe.db.sql(
			f"""
			SELECT name, deleted_doctype, deleted_name, restored, new_name, creation, owner
			FROM `tabDeleted Document`
			WHERE deleted_doctype = %s
			{date_cond}
			ORDER BY creation DESC
			LIMIT 300
			""",
			(doc_type,),
			as_dict=True,
		)
		meta_rows.extend(rows)

	if not meta_rows:
		return []

	# ── Step 2: fetch data JSON for all candidate rows ────────────────────────
	names = [r.name for r in meta_rows]
	in_ph = ", ".join(["%s"] * len(names))
	data_map = {
		r.name: r.data
		for r in frappe.db.sql(
			f"SELECT name, data FROM `tabDeleted Document` WHERE name IN ({in_ph})",
			names,
			as_dict=True,
		)
	}

	# ── Step 3: batch-resolve owner display names ─────────────────────────────
	owners = list({r.owner for r in meta_rows if r.owner})
	owner_map: dict[str, str] = {}
	if owners:
		owner_ph = ", ".join(["%s"] * len(owners))
		owner_map = {
			r.name: r.full_name
			for r in frappe.db.sql(
				f"SELECT name, full_name FROM `tabUser` WHERE name IN ({owner_ph})",
				owners,
				as_dict=True,
			)
		}

	# ── Step 4: match records and build summaries ─────────────────────────────
	matched: list[dict] = []
	all_summary_rows: list[dict] = []

	for r in meta_rows:
		link_fields = connections.get(r.deleted_doctype)
		if link_fields is None:
			continue

		try:
			doc_data = frappe.parse_json(data_map.get(r.name, "") or "{}")
		except Exception:
			doc_data = {}

		# "" sentinel → this is the parent document itself
		is_parent = "" in link_fields
		matched_link_field: str | list = ""

		if is_parent:
			if r.deleted_name != dn:
				continue
		else:
			found = False
			for lf in link_fields:
				if lf.startswith("__dl__"):
					_, pair = lf.split("__dl__", 1)
					doctype_field, name_field = pair.split(":", 1)
					if doc_data.get(doctype_field) == dt and doc_data.get(name_field) == dn:
						matched_link_field = [doctype_field, name_field]
						found = True
						break
				else:
					if doc_data.get(lf) == dn:
						matched_link_field = lf
						found = True
						break
			if not found:
				continue

		# Human-readable display name + fields to skip from pills
		display_name = ""
		extra_skip: list[str] = []
		if r.deleted_doctype == "File":
			display_name = doc_data.get("file_name", "") or r.deleted_name
			extra_skip = ["file_name"]
		elif r.deleted_doctype == "Notes":
			display_name = doc_data.get("title", "") or r.deleted_name

		base_skip = (
			matched_link_field
			if isinstance(matched_link_field, list)
			else ([matched_link_field] if matched_link_field else [])
		)
		fields_to_skip = base_skip + extra_skip

		summary = _build_deletion_summary(r.deleted_doctype, doc_data, fields_to_skip)
		start_idx = len(all_summary_rows)
		all_summary_rows.extend(summary)

		matched.append(
			{
				"deleted_doctype": r.deleted_doctype,
				"deleted_name": r.deleted_name,
				"display_name": display_name,
				"deleted_by": owner_map.get(r.owner) or r.owner or "",
				"creation": str(r.creation),
				"restored": r.restored,
				"new_name": r.new_name or "",
				"is_parent": is_parent,
				"_sum_start": start_idx,
				"_sum_end": len(all_summary_rows),
			}
		)

	if not matched:
		return []

	# ── Step 5: batch-resolve Link field titles ───────────────────────────────
	resolved = _resolve_link_titles(all_summary_rows)

	results = []
	for item in matched:
		item["summary"] = resolved[item.pop("_sum_start") : item.pop("_sum_end")]
		results.append(item)

	# Parent pinned first, then children newest-first
	results.sort(key=lambda x: (x["is_parent"], x["creation"]), reverse=True)
	return results
