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
    ├── ui_setup.js    ← Wrapper, scroll container, loading state, AbortSignal
    ├── data.js        ← fetchMeta() + fetchDocs() via frappe.db
    ├── fields.js      ← formatCellValue() with vdr_events.formatCell hook
    ├── rendering.js   ← buildTable, buildThead, buildTbody, section/field rows, legend
    ├── edit.js        ← Inline editing + dialog editing + beforeSave/afterSave hooks
    └── helpers.js     ← getColumnCount, sortDataByDocs, isEmptyRow, getFieldUnit
```

---

## Constructor API

```js
new SVAVerticalDocRenderer({
  wrapper,              // HTMLElement — container
  frm,                  // Frappe form object (for vdr_events + context)

  doctype,              // string | object
                        //   string  → DocType name; fetchMeta() calls frappe.db.get_meta()
                        //   object  → pre-built meta (e.g. frm.meta); name derived from .name

  docs,                 // string[] — doc names shown as columns (left-to-right)
  column_configs,       // [{label, bg_color, text_color}] — index-aligned to docs
  fields_to_show,       // string[] | null — allowlist; null = all non-hidden fields
  fields_to_hide,       // string[] — fieldnames to exclude
  show_section_headers, // boolean (default true)
  show_unit,            // boolean — "Unit" column parsed from field.description
  hide_empty_rows,      // boolean — skip rows where all docs have no value
  title,                // string | null
  show_legend,          // boolean
  legend_items,         // [{label, bg_color, text_color, description}]
  crud_permissions,     // string[] — ["read"] or ["read","write"]
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
  afterRender(instance) {},
};
```

---

## Integration points (files outside this directory)

| File | What was changed |
|---|---|
| `public/js/overwrite_form.bundle.js` | Import + `case "Vertical Doc Renderer"` in `renderCustomBlock` switch |
| `frappe_theme/doctype/custom_property_setter/custom_property_setter.json` | New `property_type` option + 13 config fields (`vdr_doctype`, `vdr_docs`, `vdr_column_configs`, `vdr_fields_to_show`, `vdr_fields_to_hide`, `vdr_show_sections`, `vdr_show_unit`, `vdr_hide_empty_rows`, `vdr_title`, `vdr_show_legend`, `vdr_legend_items`) |
| `public/js/doctype/property_setter.js` | `vdr_fields_being_affected` added to clear_fields on property_type change |

---

## Inline editing

When `crud_permissions` includes `"write"`:
- **Simple types** (Data, Int, Float, Date, Check, Select, Small Text): in-cell Frappe control with ✓/✗ buttons
- **Complex types** (Link, Text, Attach, etc.): `frappe.ui.Dialog` popup
- Save path: `frappe.db.set_value(doctype, docName, fieldname, newValue)`

Read-only fields (`df.read_only = 1`) are never editable.

---

## CSS custom properties (theming)

Override these in your app CSS to restyle:

```css
.sva-vdr-container {
  --sva-vdr-header-bg:    #1a3a5c;
  --sva-vdr-header-text:  #fff;
  --sva-vdr-section-bg:   #1a3a5c;
  --sva-vdr-section-text: #fff;
  --sva-vdr-label-bg:     #dce6f1;
  --sva-vdr-label-text:   #1a3a5c;
  --sva-vdr-row-hover:    #f0f4ff;
}
```

---

## Pending / known gaps

- **Pagination**: no pagination yet; all docs passed in `docs[]` are fetched at once
- **Refresh method**: no public `refresh()` — re-instantiate to reload
- **Child table fields**: skipped during fetch (only scalar fields fetched)
- **Link field display values**: `frappe.format()` resolves link titles asynchronously; initial render shows raw names until resolved

---

## Branch

`claude/create-sva-vertical-doc-renderer`
