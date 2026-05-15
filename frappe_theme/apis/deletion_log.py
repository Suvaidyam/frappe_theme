import re

import frappe
from frappe.query_builder import DocType, Interval, Order
from frappe.query_builder.functions import Now

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
	except Exception:
		return []

	# Iterate meta.fields to preserve form field order
	summary = []
	for df in meta.fields:
		fieldname = df.fieldname
		if fieldname in _system_skip:
			continue
		if df.hidden or df.fieldtype in _layout_types:
			continue

		value = doc_data.get(fieldname)
		if value in (None, "", [], {}):
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

			# Use QueryBuilder — no f-string table/column interpolation
			tbl = DocType(linked_dt)
			title_col = tbl[title_field]
			title_rows = (
				frappe.qb.from_(tbl)
				.select(tbl.name, title_col.as_("title"))
				.where(tbl.name.isin(values))
				.run(as_dict=True)
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

	Result is cached in Redis for 5 minutes to avoid repeated schema queries.
	"""
	cache_key = f"sva_dl_conn__{dt}"
	cached = frappe.cache().get_value(cache_key)
	if cached is not None:
		return frappe.parse_json(cached)

	result = _compute_connections(dt)
	frappe.cache().set_value(cache_key, frappe.as_json(result), expires_in_sec=300)
	return result


def _compute_connections(dt: str) -> dict[str, list[str]]:
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

	DocField = DocType("DocField")
	DocTypeT = DocType("DocType")

	# ── 2. Direct Link fields pointing to dt ──────────────────────────────────
	auto_links = (
		frappe.qb.from_(DocField)
		.join(DocTypeT)
		.on(DocTypeT.name == DocField.parent)
		.select(DocField.parent.as_("link_doctype"), DocField.fieldname.as_("link_field"))
		.distinct()
		.where(
			(DocField.fieldtype == "Link")
			& (DocField.options == dt)
			& (DocTypeT.issingle == 0)
			& (DocTypeT.istable == 0)
			& (DocTypeT.module.notin(_SYSTEM_MODULES))
		)
		.run(as_dict=True)
	)
	for row in auto_links:
		_add(connections, row.link_doctype, row.link_field)

	# ── 3. Dynamic Link patterns ───────────────────────────────────────────────
	# Self-join on DocField: df_dt has fieldtype=Link/options=DocType,
	# df_ref has fieldtype=Dynamic Link/options=df_dt.fieldname
	df_dt = DocField.as_("df_dt")
	df_ref = DocField.as_("df_ref")
	dyn_links = (
		frappe.qb.from_(df_dt)
		.join(df_ref)
		.on(
			(df_ref.parent == df_dt.parent)
			& (df_ref.fieldtype == "Dynamic Link")
			& (df_ref.options == df_dt.fieldname)
		)
		.join(DocTypeT)
		.on(DocTypeT.name == df_dt.parent)
		.select(
			df_dt.parent.as_("link_doctype"),
			df_dt.fieldname.as_("doctype_field"),
			df_ref.fieldname.as_("name_field"),
		)
		.distinct()
		.where(
			(df_dt.fieldtype == "Link")
			& (df_dt.options == "DocType")
			& (DocTypeT.issingle == 0)
			& (DocTypeT.istable == 0)
			& (DocTypeT.module.notin(_SYSTEM_MODULES))
		)
		.run(as_dict=True)
	)
	for row in dyn_links:
		_add(connections, row.link_doctype, f"__dl__{row.doctype_field}:{row.name_field}")

	# ── 4. Child tables of dt ─────────────────────────────────────────────────
	child_tables = (
		frappe.qb.from_(DocField)
		.select(DocField.options.as_("child_dt"))
		.distinct()
		.where(
			(DocField.parent == dt)
			& (DocField.fieldtype.isin(["Table", "Table MultiSelect"]))
			& (DocField.options.isnotnull())
			& (DocField.options != "")
		)
		.run(as_dict=True)
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
def get_deletion_log_count(dt: str, dn: str) -> dict:
	"""
	Return the total count of deleted records related to document (dt, dn).
	Fetches all candidate rows (filtered by doctype) at once — no batching,
	no cursor issues. Only deleted_doctype, deleted_name, and data are read.
	Returns {"count": int}
	"""
	connections = _build_connections(dt)
	if not connections:
		return {"count": 0}

	DD = DocType("Deleted Document")

	# Fetch only the three columns needed — no limit so all records are counted
	all_rows = (
		frappe.qb.from_(DD)
		.select(DD.deleted_doctype, DD.deleted_name, DD.data)
		.where(DD.deleted_doctype.isin(list(connections.keys())))
		.run(as_dict=True)
	)

	count = 0
	for r in all_rows:
		link_fields = connections.get(r.deleted_doctype)
		if not link_fields:
			continue
		try:
			doc_data = frappe.parse_json(r.data or "{}")
		except Exception:
			doc_data = {}

		if "" in link_fields:
			if r.deleted_name == dn:
				count += 1
		else:
			for lf in link_fields:
				if lf.startswith("__dl__"):
					_, pair = lf.split("__dl__", 1)
					doctype_field, name_field = pair.split(":", 1)
					if doc_data.get(doctype_field) == dt and doc_data.get(name_field) == dn:
						count += 1
						break
				else:
					if doc_data.get(lf) == dn:
						count += 1
						break

	return {"count": count}


@frappe.whitelist()
def get_deletion_log(
	dt: str,
	dn: str,
	date_filter: str = "all",
	doctype_filter: str = "",
	page_length: int = 30,
	cursor: str = "",
) -> dict:
	"""
	Return paginated deleted documents related to document (dt, dn).

	date_filter:  "all" | "last_7_days"
	doctype_filter: "" (all) | specific deleted_doctype value
	page_length:  records per page (default 30)
	cursor:       ISO datetime of the last record on the previous page
	              (empty string = start from the newest record)

	Returns {"records": [...], "has_more": bool, "cursor": str}

	Uses cursor-based pagination so no records are ever skipped regardless of
	how many unrelated deleted documents exist in the database.
	"""
	_SQL_BATCH = 500  # rows fetched from DB per iteration
	page_length = int(page_length)
	connections = _build_connections(dt)

	if doctype_filter and doctype_filter in connections:
		connections = {doctype_filter: connections[doctype_filter]}

	doctypes_in = list(connections.keys())
	if not doctypes_in:
		return {"records": [], "has_more": False, "cursor": ""}

	DD = DocType("Deleted Document")
	matched: list[dict] = []
	last_creation: str = ""
	batch_cursor: str = cursor  # moves backward in time as we page through batches

	while len(matched) <= page_length:
		# ── Fetch one batch ───────────────────────────────────────────────────
		q = (
			frappe.qb.from_(DD)
			.select(
				DD.name,
				DD.deleted_doctype,
				DD.deleted_name,
				DD.data,
				DD.restored,
				DD.new_name,
				DD.creation,
				DD.owner,
			)
			.where(DD.deleted_doctype.isin(doctypes_in))
			.orderby(DD.creation, order=Order.desc)
			.limit(_SQL_BATCH)
		)
		if date_filter == "last_7_days":
			q = q.where(DD.creation >= (Now() - Interval(days=7)))
		if batch_cursor:
			q = q.where(DD.creation < batch_cursor)

		batch = q.run(as_dict=True)
		if not batch:
			break  # no more rows in the DB

		for r in batch:
			link_fields = connections.get(r.deleted_doctype)
			if link_fields is None:
				continue

			try:
				doc_data = frappe.parse_json(r.data or "{}")
			except Exception:
				doc_data = {}

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

			display_name = ""
			extra_skip: list[str] = []
			if r.deleted_doctype == "File":
				display_name = doc_data.get("file_name", "") or r.deleted_name
				extra_skip = [
					"attached_to_field",
					"is_private",
					"uploaded_to_dropbox",
					"uploaded_to_google_drive",
				]
			elif r.deleted_doctype == "Notes":
				display_name = doc_data.get("title", "") or r.deleted_name

			base_skip = (
				matched_link_field
				if isinstance(matched_link_field, list)
				else ([matched_link_field] if matched_link_field else [])
			)

			matched.append(
				{
					"dd_name": r.name,
					"deleted_doctype": r.deleted_doctype,
					"deleted_name": r.deleted_name,
					"display_name": display_name,
					"_owner": r.owner or "",
					"creation": str(r.creation),
					"restored": r.restored,
					"new_name": r.new_name or "",
					"is_parent": is_parent,
					"fields_to_skip": base_skip + extra_skip,
				}
			)

			if len(matched) > page_length:
				break  # we have enough — stop scanning this batch

		if len(matched) > page_length:
			break

		# Advance cursor to oldest row in this batch for next iteration
		batch_cursor = str(batch[-1].creation)

		if len(batch) < _SQL_BATCH:
			break  # DB exhausted

	has_more = len(matched) > page_length
	page_records = matched[:page_length]

	if page_records:
		last_creation = page_records[-1]["creation"]

	# ── Owner names + role profile for this page only ────────────────────────
	page_owners = {r["_owner"] for r in page_records if r["_owner"]}
	owner_map: dict[str, str] = {}
	role_map: dict[str, str] = {}
	if page_owners:
		User = DocType("User")
		owner_rows = (
			frappe.qb.from_(User)
			.select(User.name, User.full_name, User.role_profile_name)
			.where(User.name.isin(list(page_owners)))
			.run(as_dict=True)
		)
		for r in owner_rows:
			owner_map[r.name] = r.full_name
			if r.role_profile_name:
				role_map[r.name] = r.role_profile_name

		# Fall back to role_profiles child table for users without a primary profile
		missing = [u for u in page_owners if u not in role_map]
		if missing:
			UserRoleProfile = DocType("User Role Profile")
			child_rows = (
				frappe.qb.from_(UserRoleProfile)
				.select(UserRoleProfile.parent, UserRoleProfile.role_profile)
				.where(UserRoleProfile.parent.isin(missing))
				.orderby(UserRoleProfile.idx)
				.run(as_dict=True)
			)
			for r in child_rows:
				if r.parent not in role_map and r.role_profile:
					role_map[r.parent] = r.role_profile

	for item in page_records:
		owner = item.pop("_owner")
		item["deleted_by"] = owner_map.get(owner) or owner
		item["role"] = role_map.get(owner, "")

	return {"records": page_records, "has_more": has_more, "cursor": last_creation}


@frappe.whitelist()
def get_deletion_log_detail(name: str, deleted_doctype: str, fields_to_skip: str | list = "[]") -> list[dict]:
	"""
	Return the full field summary for a single Deleted Document record.
	Called lazily when the user expands a card in the deletion log drawer.
	"""
	if isinstance(fields_to_skip, str):
		try:
			fields_to_skip = frappe.parse_json(fields_to_skip)
		except Exception:
			fields_to_skip = []

	DD = DocType("Deleted Document")
	rows = frappe.qb.from_(DD).select(DD.data).where(DD.name == name).limit(1).run(as_dict=True)
	if not rows:
		return []

	try:
		doc_data = frappe.parse_json(rows[0].data or "{}")
	except Exception:
		doc_data = {}

	summary = _build_deletion_summary(deleted_doctype, doc_data, fields_to_skip)
	return _resolve_link_titles(summary)
