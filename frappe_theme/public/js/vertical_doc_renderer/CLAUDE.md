# SVAVerticalDocRenderer — Module Context

This directory contains the `SVAVerticalDocRenderer` component. When working in this module, read this file first for full context.

---

## What this component does

Renders multiple documents of any DocType side-by-side as a comparison table:
- **Rows** = DocType fields (grouped by section breaks)
- **Columns** = individual documents
- **Section Breaks** = styled full-width header rows

It is mixin-based (mirrors SVADatatable architecture) and supports per-cell/row/header overrides via a `vdr_events` hook system.

---

## File map

```
vertical_doc_renderer/
├── sva_vertical_doc_renderer.bundle.js   ← Main class + mixin assembly
└── mixins/
    ├── ui_setup.js     ← Wrapper, scroll container (overflow:auto + max_height),
    │                      loading state, AbortSignal, _ensureStyles() CSS injection
    ├── data.js         ← fetchMeta() + fetchDocs() — three-branch (object[]/string[]/null)
    ├── fields.js       ← formatCellValue() with vdr_events.formatCell hook
    ├── rendering.js    ← buildTable, buildThead, buildTbody, _buildDocHeaderCell(),
    │                      _buildValueCell() (per-cell validation state + data-raw-value),
    │                      section/field rows, legend, delete row integration
    ├── edit.js         ← Auto-sync inline editing (blur/change save, ESC cancel,
    │                      spinner, revert on fail) + dialog editing + save hooks
    ├── helpers.js      ← getColumnCount, isEmptyRow, getFieldUnit, getVisibleFields
    ├── viewport.js     ← IntersectionObserver sentinel; lazy column loading on scroll;
    │                      calls resolveLinkTitles() + _appendDeleteCell() per batch
    ├── create.js       ← "+" column header; openCreateDialog(); beforeCreate/afterCreate hooks
    ├── validation.js   ← _evaluateDepends(), isFieldHidden/ReadOnly/Required(),
    │                      validateBeforeSave(), showErrorBanner(), clearErrorBanner()
    ├── link_titles.js  ← resolveLinkTitles() batch-fetch (one get_list per link-doctype),
    │                      _applyLinkTitles() updates cell textContent + title attr
    └── delete.js       ← _canDelete() RPM check, _buildDeleteRow(), _buildDeleteCell(),
                           _appendDeleteCell(), _showDeleteIcon(), _hideDeleteIcon(),
                           deleteDoc() frappe.xcall, _removeColumn() DOM + data sync
```

---

## Constructor API

```js
new SVAVerticalDocRenderer({
  wrapper,              // HTMLElement — container
  frm,                  // Frappe form object (for vdr_events + context)

  doctype,              // string | object
                        //   string  → DocType name; fetchMeta() calls frappe.xcall(
                        //             "frappe_theme.dt_api.get_meta_fields", { meta_attached: 1 })
                        //             Returns { fields: [...], meta: {...full frappe meta...} }
                        //   object  → pre-built/mimicked meta {name, fields[]}; used as-is

  docs,                 // string[] | object[] | null
                        //   string[]  → names; fetched in batches as user scrolls
                        //   object[]  → inline data; zero API calls; lazy-sliced from memory
                        //   null      → frappe.db.get_list paginated (start + limit per batch)

  column_configs,       // [{label, bg_color, text_color}] — index-aligned to docs
  fields_to_show,       // string[] | null — allowlist; null = all non-hidden fields
  fields_to_hide,       // string[] — fieldnames to exclude
  show_section_headers, // boolean (default true)
  show_unit,            // boolean — "Unit" column parsed from field.description
  hide_empty_rows,      // boolean — skip rows where all docs have no value
  title,                // string | null
  show_legend,          // boolean
  legend_items,         // [{label, bg_color, text_color, description}]

  crud_permissions,     // string[] — ["read"] | ["read","write"] | ["read","write","create","delete"]
                        //   "write"  → inline cell auto-sync editing (blur/change)
                        //   "create" → "+" column header opens create dialog
                        //   "delete" → 🗑 icon row; frappe.model.can_delete() also checked

  filters,              // frappe filter array — used when docs: null
  order_by,             // string — used when docs: null
  column_batch_size,    // number (0 = auto from viewport width)
  column_width,         // number px (default 150) — for auto batch-size calculation
  max_height,           // number px (default 600) — scrollBox max-height for vertical sticky
                        //   0 = no vertical limit (header sticks to browser viewport)

  signal,               // AbortSignal
});
```

---

## vdr_events hook system

Set on the Frappe form before the component renders:

```js
frm.vdr_events = {
  formatCell(value, df, doc, colIndex) {},       // return non-null to override cell HTML
  renderRow(df, allDocsData, tr) {},             // return true = custom row built
  renderSectionHeader(label, colCount, tr) {},   // return true = custom header built
  renderColumnHeader(doc, colIndex, th) {},      // mutate th directly
  beforeSave(df, docName, newValue) {},          // return false to cancel save
  afterSave(df, docName, newValue) {},
  beforeCreate(values, dialog) {},               // return false to cancel create
  afterCreate(newDoc) {},
  afterRender(instance) {},
};
```

---

## Integration points (files outside this directory)

| File | What was changed |
|---|---|
| `public/js/overwrite_form.bundle.js` | Import + `case "Vertical Doc Renderer"` in `renderCustomBlock` switch; passes `crud_permissions` and `max_height` from `conf` |
| `frappe_theme/doctype/custom_property_setter/custom_property_setter.json` | New `property_type` option + VDR config fields; `section_break_qivk` depends_on updated to include "Vertical Doc Renderer" so the shared `crud_permissions` JSON field and "Setup Crud Permissions" button are visible for VDR; `setup_list_settings` button hidden for VDR via depends_on |
| `public/js/doctype/property_setter.js` | `vdr_fields_being_affected` list includes all VDR fields + `crud_permissions` (cleared to `["read"]` when property_type is emptied) |

### crud_permissions in VDR config dialog

The `crud_permissions` JSON field and "Setup Crud Permissions" button live in `section_break_qivk`, which is shared between Datatable and VDR types. The button calls `set_crud_permissiions(dialog)` — for VDR, `connection_type` is `""` (empty), which falls into the `else` branch showing all four permissions (read/write/create/delete). The dialog sets the JSON value; `overwrite_form.bundle.js` reads `conf.crud_permissions` and passes it as `JSON.parse(conf.crud_permissions)` to the VDR constructor.

---

## Inline editing (auto-sync)

When `crud_permissions` includes `"write"`:
- **Simple types** (Data, Int, Float, Date, Check, Select, Small Text): in-cell Frappe control; saves automatically on `blur` (text) or `change` (Check/Select); ESC cancels
- **Complex types** (Link, Text, Attach, etc.): `frappe.ui.Dialog` with explicit Save button
- **Saving state**: cell opacity drops to 0.5 + spinner icon while async save is in-flight
- **On failure**: cell reverts to original HTML; error banner appears above table
- **On success**: error banner cleared; `doc[fieldname]` updated in memory
- Save path: `frappe.db.set_value(doctype, docName, fieldname, newValue)`
- Read-only fields (`df.read_only = 1` or `read_only_depends_on`) are never editable.

---

## Validations (per-cell, per-document)

`depends_on`, `mandatory_depends_on`, `read_only_depends_on` are evaluated independently
for each document column using `frappe.utils.custom_eval`:

| Expression type | Effect |
|---|---|
| `df.depends_on` | Cell is `visibility:hidden` if expression is false for this doc |
| `df.read_only_depends_on` | Cell styled as muted; click-to-edit disabled |
| `df.mandatory_depends_on` | Attempting to save empty value shows error banner, blocks save |

---

## Link field titles

After render (and after each viewport batch), `resolveLinkTitles()`:
1. Collects all unique Link field values across `this.data`, grouped by linked DocType
2. Skips already-cached values (`this._linkTitles`)
3. Issues **one `frappe.db.get_list` per linked DocType** (never one per cell)
4. **Title field discovery** (two sources, in priority order):
   - `frappe.boot.link_title_doctypes[ldt]` — populated by Frappe when `show_title_field_in_link = 1` on the DocType
   - `frappe.get_meta(ldt)?.title_field` — in-memory fallback; works if the linked DocType's form was opened earlier in the session (zero extra API calls)
5. Updates cell `textContent` with the resolved title; cell `title` attribute shows raw name
6. Cells where `title === rawName` (no separate display title exists) are left unchanged

---

## Delete column

When `crud_permissions` includes `"delete"` **and** `frappe.model.can_delete(doctype)`:
- A `<tr class="sva-vdr-delete-row">` appears as the first tbody row
- Each doc column gets a 🗑 button (hidden, revealed on column header hover with 150ms debounce)
- Clicking confirms → `frappe.xcall("frappe.client.delete")` → column removed from DOM + data arrays
- Hover identification uses `doc.name` (not column index) so remaining columns work after deletion

---

## Sticky freeze

- **Params column** (`left: 0; z-index: 1`): stays visible when scrolling right
- **Doc header cells** (`top: 0; z-index: 2`): stay visible when scrolling down
- **Corner cell** (paramTh, `top: 0; left: 0; z-index: 3`): always visible
- Requires `scrollBox` to have `overflow: auto` + `max-height` — controlled by `max_height` param
- `container` uses `overflow: visible` (not `hidden`) to allow sticky to propagate

---

## CSS custom properties (theming)

```css
.sva-vdr-container {
  --sva-vdr-header-bg:      #1a3a5c;
  --sva-vdr-header-text:    #fff;
  --sva-vdr-section-bg:     #1a3a5c;
  --sva-vdr-section-text:   #fff;
  --sva-vdr-label-bg:       #dce6f1;
  --sva-vdr-label-text:     #1a3a5c;
  --sva-vdr-row-hover:      #f0f4ff;
  --sva-vdr-readonly-bg:    #f5f5f5;
  --sva-vdr-readonly-text:  #999;
}
```

---

## API notes

### `fetchMeta()` — why not `frappe.db.get_meta`
`frappe.db.get_meta` does not exist in the version of Frappe used here. Meta is fetched via:
```js
frappe.xcall("frappe_theme.dt_api.get_meta_fields", {
    doctype, _type: "Direct", meta_attached: 1
})
// Returns: { fields: [...filtered fields...], meta: {...full frappe meta...} }
```
`frappe.xcall` resolves the `message` payload directly (unlike `frappe.call` which returns `{ message: ... }`).
The response is spread into `this.meta`:
```js
this.meta = { ...(response.meta || {}), name: this.doctype, fields: response.fields || [] };
```

### `frappe.xcall` vs `frappe.call` vs `SVAHTTP.call`
- **`frappe.xcall(method, args)`** — flat JSON args, resolves `message` directly → preferred for VDR
- **`frappe.call({ method, args })`** — nested args, returns `{ message: ... }` → old pattern
- **`SVAHTTP.call`** — internal HTTP client; sends flat JSON body, similar to xcall

---

## Known gaps

- **Refresh method**: no public `refresh()` — re-instantiate to reload
- **Child table fields**: skipped during fetch (only scalar fields fetched)
- **doctype.name not validated**: when `doctype` is an object, `doctype.name` is never checked against the server — any string works (intentional for mimicked meta)
- **docs: null + mimicked meta**: unsupported — warns and renders empty (no real DB table to query)
- **Section row colSpan**: does not include the "+" create column (cosmetic; section headers span data columns only)
- **Link titles without title_field config**: if neither `frappe.boot.link_title_doctypes` nor the in-memory meta cache has a title field for a linked DocType, the raw document name is shown (correct fallback — configure `show_title_field_in_link = 1` and `title_field` on the linked DocType to enable display titles)

---

## Branch

`claude/create-sva-vertical-doc-renderer`
