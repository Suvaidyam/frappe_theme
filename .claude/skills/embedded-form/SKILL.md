---
name: embedded-form
description: Embedded DocType Form Renderer — renders a complete DocType form inline inside an HTML field of a parent form (not a modal dialog). Use when working on the embedded_form.bundle.js standalone API, the EmbeddedFormMixin, tab rendering, composite proxy, or set_only_once handling.
---

# Embedded DocType Form Renderer

Renders a linked DocType's complete form inline inside a DOM wrapper instead of a modal dialog. Reuses all existing `dt_events` hooks with identical signatures — event handlers work in both rendering modes without changes.

## Key Files

| File | Purpose |
|------|---------|
| `frappe_theme/public/js/datatable/mixins/embedded_form.js` | `EmbeddedFormMixin` — mixed into `SvaDataTable.prototype` |
| `frappe_theme/public/js/embedded_form.bundle.js` | Standalone global API for use in Client Scripts |
| `frappe_theme/public/js/datatable/mixins/form_dialog.js` | Parallel dialog path — changes here usually need mirroring |
| `frappe_theme/hooks.py` | `embedded_form.bundle.js` registered in `app_include_js` |
| `frappe_theme/dt_api.py` | `get_meta_fields(include_tabs=False)` — pass `include_tabs=True` to get Tab Breaks |
| `frappe_theme/controllers/dt_conf.py` | `get_meta_fields` implementation — filters out `Tab Break` unless `include_tabs` is set |

## Standalone API

```javascript
// In a Frappe Client Script
await frappe_theme.embedded_form.render({
    parent_frm: frm,
    target_doctype: "Employee",
    target_docname: frm.doc.employee,  // null for create mode
    html_field: "details_html",        // HTML fieldname on the parent DocType
    mode: "write",                     // "create" | "write" | "view"  (default: "write")
});
```

### Storage on `parent_frm` (all keyed by DocType name)

```javascript
frm.sva_dt_frm["Employee"]        // comprehensive frm-compatible object (doc, meta, fields_dict, set_value, ScriptManager, …)
frm.embedded_form["Employee"]     // dialog-compatible proxy (get_value, set_value, fields_dict, get_values)
frm.embedded_frm["Employee"]      // alias → sva_dt_frm["Employee"]
frm.embedded_controls["Employee"] // fg.fields_dict (direct field control access)
```

Multiple DocTypes can be embedded simultaneously in different HTML fields of the same parent form.

### `frm.sva_dt_frm[doctype]` interface

Comprehensive frm-compatible stub for Client Script lifecycle:

```javascript
{
    doctype, docname, doc,
    meta: frappe.get_meta(doctype),
    perm: frappe.perm.get_perm(doctype),
    fields_dict,         // from FieldGroup
    fields_list,
    set_value, get_value, get_field,
    refresh_field, refresh_fields,
    set_df_property,
    toggle_display, toggle_enable, toggle_reqd,
    is_new: () => !doc.name,
    dirty: () => {},
    events: {}, cscript: {},
    page: { set_title, add_inner_button, set_primary_action, … },
    toolbar: { current_status, refresh },
    dashboard: { refresh, add_section, … },
    layout: fg,          // FieldGroup extends Layout — fully compatible
    call, has_perm, save,
    trigger,             // fires dt_events then script_manager.trigger
    script_manager,      // real frappe.ui.form.ScriptManager instance
    add_custom_button, set_intro,
}
```

## EmbeddedFormMixin Methods

| Method | Signature | Notes |
|--------|-----------|-------|
| `showEmbeddedFormPanel` | `(doctype, name, mode)` | Opens/resets panel below the table. Wires close button + `onAfterSave → reloadTable()` |
| `createEmbeddedForm` | `(doctype, name, wrapper_el, mode, onAfterSave)` | Core renderer. Returns dialog-compatible proxy (also sets `this.form_dialog`) |
| `_openForm` | `(doctype, name, mode)` | Router: checks `use_embedded_form` flag, dispatches to panel or dialog |
| `_prepareEmbeddedFieldsWriteMode` | `(doctype, name, doc, fields, mode, fg_holder)` | Mirrors `createFormDialog` field prep. Binds `onchange`/`click` from `dt_events`, handles Tables, Links, Attach, `set_only_once` |
| `_prepareEmbeddedFieldsViewMode` | `(doctype, name, doc, fields, mode)` | All fields `read_only: 1` |
| `_renderEmbeddedFormFooter` | `(wrapper_el, doctype, name, mode, form_proxy, fg, onAfterSave)` | Renders Save / Cancel buttons |
| `_saveEmbeddedForm` | `(doctype, name, mode, form_proxy, fg, onAfterSave)` | `validate` → insert/set_value → after_insert/after_update/after_save |
| `_splitFieldsByTabs` | `(fields)` | Splits field list into `{ tabGroups, hasTabs }` at Tab Break boundaries |
| `_renderEmbeddedTabs` | `(wrapper_el, tabGroups, allFgs, allFieldsDict)` | Bootstrap tab nav + per-tab FieldGroups. Active tab = first non-empty group (`renderedCount === 0`, not `i === 0`) |
| `_buildCompositeProxy` | `(allFgs, allFieldsDict, wrapper_el)` | Aggregates `fields_dict`, `get_value`, `set_value`, `get_values`, `fields_list` across all tab FieldGroups |

## Tab Rendering

Fields are fetched with `include_tabs: 1` so Tab Break fields come back from the backend. `_splitFieldsByTabs` groups fields into `{ label, fields }` buckets at each Tab Break boundary.

**Critical detail:** Frappe DocTypes often start with a Tab Break, creating an empty placeholder group at index 0. The active tab is tracked with `renderedCount` (number of groups actually rendered), not array index `i`. First rendered group → `renderedCount === 0` → active.

## `set_only_once` — Two-Part Fix (applies to both dialog and embedded paths)

1. **UI layer** — in `_prepareEmbeddedFieldsWriteMode`, when `mode === "write"`:
   ```javascript
   if (f.set_only_once) {
       if (mode === "write") {
           f.read_only = 1;          // locked unconditionally in edit mode
       } else if (doc[f.fieldname]) {
           f.default = doc[f.fieldname];
           f.read_only = 1;
       } else {
           f.reqd = 0; f.hidden = 1;
       }
   }
   ```

2. **Save payload** — in `_saveEmbeddedForm`, exclude from `fields_to_update`:
   ```javascript
   fg.fields_list.filter(f =>
       !["Section Break", "Column Break", "HTML", "Button", "Tab Break"].includes(f.df.fieldtype)
       && !f.df.set_only_once    // ← must be present
   )
   ```
   Missing this causes Frappe to throw _"Value cannot be changed for \<field label\>"_.

## `dt_events` Compatibility

All hooks fire with identical signatures in both rendering paths:

| Hook | Signature |
|------|-----------|
| `customize_form_fields` | `(dt, fields, mode, has_additional_action, name)` |
| `[fieldname]` (onchange) | `(dt, mode, field, name)` |
| `after_render` | `(dt, mode, has_additional_action, name)` — `dt.form_dialog` is composite proxy |
| `validate` | `(dt, mode, values, has_additional_action)` |
| `after_insert` | `(dt, response_doc)` |
| `after_update` | `(dt, response_doc)` |
| `after_save` | `(dt, mode, values)` |

## `fg_holder` Pattern

Link field `get_query` closures need to call `fg.get_value(sibling_field)`, but the FieldGroup doesn't exist yet when the closure is defined. Solution: a mutable reference object set after construction.

```javascript
const fg_holder = { instance: null };
// ... passed into field prep, closures capture fg_holder ...
// After FieldGroup is created:
fg_holder.instance = form_proxy;  // composite proxy, so cross-tab sibling lookups work
```

## Activation (SvaDataTable)

Set `use_embedded_form: true` on the connection or options:

```javascript
// In SVADatatable Configuration connection settings
{ use_embedded_form: true }

// Or in SvaDataTable constructor options
new SvaDataTable({ ..., options: { use_embedded_form: true } });
```

This routes all three action types — Create (Add Row), Edit, and View — through `_openForm` → `showEmbeddedFormPanel`.

## Parallel Paths Rule

`form_dialog.js` and `embedded_form.js` are parallel. **Always edit both** when changing:
- Field preparation logic (e.g., new field type handling, `set_only_once`)
- Save payload filtering
- `dt_events` hook execution order or arguments
