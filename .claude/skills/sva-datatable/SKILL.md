---
name: sva-datatable
description: Work with the SVA Datatable component — a modular, mixin-based interactive table for displaying connected DocType records inline. Use when modifying, extending, or debugging SVADatatable behavior, adding new mixins, or understanding the file structure.
---

# SVA Datatable — Architecture & Development Guide

SVADatatable is a modular interactive table component split across an orchestrator class and 10 prototype mixins. All methods are composed onto `SvaDataTable.prototype` via `Object.assign`, preserving `this` context, class identity, and `instanceof` checks.

## File Structure

```
frappe_theme/public/js/datatable/
├── sva_datatable.bundle.js          ← Orchestrator: class definition, constructor, reloadTable, reloadRow
├── mixins/
│   ├── rendering.js                 ← Table DOM creation: createTable, createTableHead, createTableBody, createTableRow, createTotalRow, createSortingIcon, updateTableBody, createNoDataFoundPage, createSkeletonLoader
│   ├── fields.js                    ← Cell rendering: getCellStyle, createEditableField, createNonEditableField, bindColumnEvents, percentageCell
│   ├── action_column.js             ← Row actions: createActionColumn, checkCondition
│   ├── form_dialog.js               ← CRUD dialogs: createFormDialog, deleteRecord, childTableDialog
│   ├── workflow.js                  ← Workflow transitions: wf_action
│   ├── pagination.js                ← Page controls: setupPagination, updatePageButtons
│   ├── ui_setup.js                  ← Chrome: setupHeader, setupFooter, setupWrapper, setupTableWrapper, setupListviewSettings, createSettingsButton, add_custom_button
│   ├── data.js                      ← Data fetching: getDocList, get_permissions, sortByColumn, getUserWiseListSettings
│   ├── helpers.js                   ← Utilities: setTitle, showSkeletonLoader, hideSkeletonLoader, findDOMRowByDocname, add_field, restyle_field, handleNoPermission
│   └── transpose.js                 ← Report transpose: transposeTable
├── sva_sort_selector.bundle.js      (standalone)
├── list_settings.bundle.js          (standalone)
└── filters/                         (standalone)
```

## Pattern: Prototype Mixin via Object.assign

Each mixin file exports a plain object of methods. The orchestrator composes them:

```javascript
// mixins/example.js
const ExampleMixin = {
    myMethod() {
        // `this` refers to the SvaDataTable instance at runtime
        this.rows.forEach(row => { /* ... */ });
    },
};
export default ExampleMixin;
```

```javascript
// sva_datatable.bundle.js
import ExampleMixin from "./mixins/example.js";

class SvaDataTable {
    isAsync = (fn) => fn?.constructor?.name === "AsyncFunction";
    constructor({ wrapper, columns, rows, ... }) { /* ... */ }
    async reloadTable(reset = false) { /* ... */ }
    async reloadRow(docname_or_updated_doc, fetch_from_server = false) { /* ... */ }
}

Object.assign(SvaDataTable.prototype,
    RenderingMixin, FieldsMixin, ActionColumnMixin, FormDialogMixin,
    WorkflowMixin, PaginationMixin, UISetupMixin, DataMixin,
    HelpersMixin, TransposeMixin
);

frappe.provide("frappe.ui");
frappe.ui.SvaDataTable = SvaDataTable;
export default SvaDataTable;
```

## Key Rules

### Adding a new method
1. Identify which mixin it belongs to by category (rendering, data, UI, etc.)
2. Add the method to the appropriate mixin's exported object
3. Access instance state via `this` — it works automatically on the prototype
4. If the method needs external imports, add them at the top of the mixin file (ES modules deduplicate)

### Creating a new mixin
1. Create `mixins/<name>.js` with the standard pattern above
2. Import it in `sva_datatable.bundle.js`
3. Add it to the `Object.assign(SvaDataTable.prototype, ..., NewMixin)` call
4. Run `bench build --app frappe_theme` to verify

### Avoiding circular imports
- Mixin files must NEVER `import SvaDataTable` from the orchestrator
- If a mixin needs to instantiate SvaDataTable (e.g., child table dialogs), use `new frappe.ui.SvaDataTable({...})` instead
- This is the pattern used in `form_dialog.js` → `childTableDialog`

### External imports in mixins
Mixins that need external modules re-import them directly. ES module bundlers deduplicate, so there's no performance cost:

```javascript
// mixins/ui_setup.js
import SVASortSelector from "../sva_sort_selector.bundle.js";
import SVAListSettings from "../list_settings.bundle.js";
import SVAFilterArea from "../filters/filter_area.bundle.js";
import DTAction from "../../vue/dt_action/dt.action.bundle.js";
```

## Consumers

SVADatatable is consumed in multiple ways — all must keep working:

| Pattern | Files |
|---------|-------|
| `import SvaDataTable from "..."` | `overwrite_form.bundle.js`, `sva_dashboard_manager.bundle.js`, Vue components |
| `frappe.ui.SvaDataTable` | Dynamic instantiation in various apps |
| `frappe.require("sva_datatable.bundle.js")` | Lazy-loaded consumers |

**None of these require changes** when modifying mixins — the orchestrator's exports remain identical.

## Percent Progress Bar

Percent fieldtype columns render a visual progress bar instead of plain text. Implemented in `fields.js` via `percentageCell(value, bgColor, textColor)`.

- **Bar**: A thin (5px) rounded bar filled proportionally to the value (clamped 0–100%), with rounded ends (`border-radius:99px`)
- **Bar color**: Uses the column's `color` from list view settings (`col?.color`), defaults to `#3182ce` (blue). Set in `fields.js` line ~640: `let barColor = col?.color || "#3182ce"`
- **Text color**: The `textColor` param is optional — when omitted, text inherits from `td.style.color` which is set by list view settings in `rendering.js` (line 82: `if (col?.color) td.style.color = col.color`). Currently no caller passes `textColor`.
- **Text**: Rounded integer value shown right-aligned next to the bar with `%` suffix (`font-variant-numeric: tabular-nums` for alignment)
- **Custom formatters** still override the progress bar if defined via `dt_events` (checked first, lines 622–632)
- **Total row**: Percent columns show the **average** across visible rows, also rendered as a progress bar with list view color (`rendering.js` line ~429)

```javascript
// percentageCell(value, bgColor, textColor) in fields.js
// Returns HTML: flex row with [thin bar div] + [pct% span]
// Bar: <div style="flex:1; height:5px; background:#e5e5e5;"> → <div width:${pct}%; background:${bgColor}>
// Text: <span font-size:12px; color:${textColor}>${pct}%</span>
```

## List View Setting Colors on Cells

Colors from list view settings are applied to every data row cell in `rendering.js` (lines 82–83), **after** the cell content is rendered:

```javascript
if (col?.color) td.style.color = col.color;
if (col?.bg_color) td.style.backgroundColor = col.bg_color;
```

This cascades into child elements (e.g., progress bar text) via CSS inheritance.

## Total Row

The total row (`createTotalRow()` in `rendering.js`) is enabled by `connection.add_total_row`. Key behaviors:

- **Summable types**: Currency, Int, Float, Percent
- **Currency**: Uses `formatCurrency()` from `utils.js` (same locale-aware formatter as data rows)
- **Percent**: Shows **average** (not sum) as a progress bar via `percentageCell(avg, col?.color || "#3182ce")`
- **Int/Float**: Sum with `toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })`
- **Non-summable**: Shows "-" centered with `var(--text-muted)` color
- **Colors from list view settings** are applied **last** (lines 445–446) so they override defaults like `var(--text-muted)`:
  - `col?.color` → `td.style.color`
  - `col?.bg_color` → `td.style.backgroundColor` (overrides default `#f9f9f9`)
- **Sticky columns**: Use `col?.bg_color || "#f9f9f9"` as background (must be explicit, not inherited from `<tr>`, to cover scrolled content)
- **Default styling**: `fontWeight: bold`, `backgroundColor: #f9f9f9`, `borderTop: 2px solid #d1d8dd`

## Event System (dt_events)

SVADatatable fires lifecycle events that consumer code hooks into via `frm.dt_events[doctype]` and `frm.dt_global_events`. The key phases are:

1. **Initialization**: `before_load` → `before_table_load` → `after_load`
2. **Row & Form**: `after_row_update`, `add_row_handler`, `customize_form_fields`, `after_insert`, `after_update`, `after_save`, `after_delete`, `after_render`
3. **Workflow**: `before_workflow_action`, `after_workflow_dialog_render`, `after_workflow_action`
4. **Display**: `formatter['fieldname']`, `columnEvents['fieldname']`, `additional_row_actions`

Event handlers are called from various mixins — the orchestrator handles `before_load`, `before_table_load`, `after_load` in `reloadTable()`, while other events are fired from their respective mixins.

## Constructor Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `wrapper` | required | DOM element to render into |
| `columns` | `[]` | Column definitions |
| `rows` | `[]` | Row data |
| `limit` | `10` | Rows per page |
| `connection` | — | SVADT connection config (type, doctype, permissions, etc.) |
| `options` | `{serialNumberColumn: true, editable: false}` | Table options |
| `frm` | — | Parent form object |
| `doctype` | — | Target DocType |
| `cdtfname` | — | Child table field name |
| `render_only` | `false` | Skip permission/data fetching, render with provided data |
| `onFieldClick` | `() => {}` | Field click callback |
| `onFieldValueChange` | `() => {}` | Field value change callback |
| `signal` | `null` | AbortController signal for request cancellation |

## Connection Types

| Type | Description |
|------|-------------|
| `Direct` | Child DocType has a Link field pointing to parent |
| `Indirect` | Relationship through matching local and foreign Link fields |
| `Referenced` | Many-to-many through an intermediary DocType |
| `Unfiltered` | All records, no connection filter |
| `Report` | Renders a Frappe Report as a table |
| `Is Custom Design` | Renders a built-in component template |

## Verification After Changes

After modifying any mixin or the orchestrator, always run:

```bash
bench build --app frappe_theme
```

Then manually verify in the browser:
- Table loads with data
- CRUD operations (add, edit, delete) work
- Pagination (next/prev/page numbers)
- Sorting (click column headers)
- Workflow transitions (if applicable)
- Filter area
- Settings/column visibility dialog
- Child table dialogs (tests `frappe.ui.SvaDataTable` self-reference)
- Total row displays when `add_total_row` is enabled on the connection
- Total row sums Currency/Int/Float and averages Percent columns
- Total row respects `color` and `bg_color` from list view settings
- Total row sticky columns show correct `bg_color` (fallback `#f9f9f9`)
- Percent columns show progress bar (thin bar + value label)
- Percent progress bar uses `color` from list view settings (default blue `#3182ce`)
- Currency formatting in total row matches data rows (`formatCurrency` from `utils.js`)

## Related Documentation

- Full user-facing docs: `frappe_theme/docs/sva-datatable.md`
- Event system reference: `frappe_theme/public/js/datatable/DT_EVENTS_DOCUMENTATION.md`
- Number cards & charts: `frappe_theme/docs/number-cards-and-charts.md`
