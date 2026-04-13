# SVAVerticalDocRenderer

A reusable Frappe component that renders multiple documents of any DocType side-by-side as a comparison table — fields as rows, documents as columns, section breaks as styled header rows.

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│  Parameters     │   Doc A      │   Doc B      │   Doc C      │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ ── Contact ─────────────────────────────────────────────────── │
│  First Name     │  Alice       │  Bob         │  Carol       │
│  Last Name      │  Smith       │  Jones       │  White       │
│  Mobile No.     │  9876543210  │  9123456789  │  9000001111  │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ ── Address ─────────────────────────────────────────────────── │
│  Village        │  Kadakella   │  Santhavurity│  Kambara     │
│  District       │  Srikakulam  │  East Godavar│  East Godavar│
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Quick start

The component is automatically available anywhere in the Frappe desk after `bench build` because it is imported by `overwrite_form.bundle.js`. Import it directly in any JS file:

```js
import SVAVerticalDocRenderer from "../../vertical_doc_renderer/sva_vertical_doc_renderer.bundle.js";
```

Or, if you're writing inline DocType JS (registered via `doctype_js` in hooks.py), the class is available on `window` after the bundle loads — but the import approach is recommended for bundle files.

---

## Basic usage

### Minimal — doctype name + doc names (`string[]`)

```js
const container = document.createElement("div");
document.body.appendChild(container);

new SVAVerticalDocRenderer({
    wrapper: container,
    doctype: "Employee",
    docs: ["EMP-0001", "EMP-0002", "EMP-0003"],
});
```

Fetches the `Employee` meta automatically, fetches the three documents, and renders the table. If you pass more names than fit in the viewport, the rest are lazily fetched as the user scrolls right.

---

### `docs: null` — auto-fetch with server-side pagination

Never loads more than one batch per API call:

```js
new SVAVerticalDocRenderer({
    wrapper: container,
    doctype: "Employee",
    docs: null,                              // auto-fetch
    filters: [["department", "=", "IT"]],   // frappe.db.get_list filters
    order_by: "employee_name asc",
    column_batch_size: 5,                   // columns per scroll batch (0 = auto from viewport)
});
```

Initial load: `get_list({ start: 0, limit: 5 })`. On scroll: `start: 5`, `start: 10`, … Stops when the server returns fewer than `batch_size` records.

---

### `docs: object[]` — inline data, zero API calls for data

```js
const records = [
    { name: "EMP-0001", first_name: "Alice", department: "IT" },
    { name: "EMP-0002", first_name: "Bob",   department: "HR" },
];

new SVAVerticalDocRenderer({
    wrapper: container,
    doctype: "Employee",   // string — meta still fetched from server
    docs: records,         // object[] — used as-is, no get_list call
});
```

---

### Mimicked meta — zero network calls

Any `{ name, fields[] }` object works as the `doctype` param — no real DB table required:

```js
const fakeMeta = {
    name: "My Comparison",
    fields: [
        { fieldname: "info_section", label: "Info",      fieldtype: "Section Break" },
        { fieldname: "full_name",    label: "Full Name", fieldtype: "Data" },
        { fieldname: "score",        label: "Score",     fieldtype: "Float" },
    ],
};

const fakeData = [
    { name: "row-1", full_name: "Alice", score: 9.5 },
    { name: "row-2", full_name: "Bob",   score: 8.2 },
];

// Zero network calls — meta and data both provided inline
new SVAVerticalDocRenderer({ wrapper: container, doctype: fakeMeta, docs: fakeData });
```

---

### Inside a Frappe form (DocType JS)

```js
// my_doctype.js
frappe.ui.form.on("My DocType", {
    refresh(frm) {
        // Render a comparison of related records inside an HTML field
        const wrapper = frm.fields_dict.my_html_field.$wrapper[0];
        wrapper.innerHTML = "";

        new SVAVerticalDocRenderer({
            wrapper,
            frm,
            doctype: "Employee",
            docs: ["EMP-0001", "EMP-0002", "EMP-0003"],
            column_configs: [
                { label: "Alice",  bg_color: "#4472C4", text_color: "#fff" },
                { label: "Bob",    bg_color: "#70AD47", text_color: "#fff" },
                { label: "Carol",  bg_color: "#ED7D31", text_color: "#fff" },
            ],
        });
    },
});
```

---

### Pass a pre-built meta object (skip the network fetch)

When you already have the meta (e.g. you're inside the form's own JS and `frm.meta` is available), pass the object directly. The component detects the type and skips `frappe.db.get_meta()`:

```js
new SVAVerticalDocRenderer({
    wrapper,
    frm,
    doctype: frm.meta,          // object → used as-is; name derived from frm.meta.name
    docs: ["REC-001", "REC-002"],
});
```

Any plain object with a `.name` string and a `.fields` array is accepted:

```js
const customMeta = {
    name: "Employee",
    fields: [
        { fieldname: "employee_name", label: "Name",       fieldtype: "Data" },
        { fieldname: "department",    label: "Department", fieldtype: "Link", options: "Department" },
        { fieldname: "date_of_joining", label: "Joined",  fieldtype: "Date" },
    ],
};

new SVAVerticalDocRenderer({
    wrapper,
    doctype: customMeta,
    docs: ["EMP-0001", "EMP-0002"],
});
```

---

## All constructor options

```js
new SVAVerticalDocRenderer({
    // ── Required ────────────────────────────────────────────────────────────
    wrapper,              // HTMLElement — where the table is rendered

    doctype,              // string | object
                          //   "Employee"  → fetches meta via frappe.db.get_meta("Employee")
                          //   frm.meta    → used directly; doctype name = frm.meta.name
                          //   customMeta  → any object with .name and .fields

    docs,                 // string[] | object[] | null
                          //   string[]  → doc names fetched in viewport batches
                          //   object[]  → inline data; zero API calls; lazy from memory
                          //   null      → auto-fetch via frappe.db.get_list (paginated)

    // ── Column headers ───────────────────────────────────────────────────────
    column_configs,       // object[] — styling per column, index-aligned with docs
                          //   { label, bg_color, text_color }
                          //   Defaults: label = doc name, bg = #4472C4, text = #fff
                          //   e.g. [
                          //     { label: "NF",   bg_color: "#4472C4", text_color: "#fff" },
                          //     { label: "M-NF", bg_color: "#70AD47", text_color: "#fff" },
                          //     { label: "CF",   bg_color: "#ED7D31", text_color: "#fff" },
                          //   ]

    // ── Field visibility ────────────────────────────────────────────────────
    fields_to_show,       // string[] | null (default null = show all non-hidden fields)
                          //   e.g. ["first_name", "last_name", "mobile_number"]
    fields_to_hide,       // string[] (default [])
                          //   e.g. ["naming_series", "full_name"]

    // ── Layout ──────────────────────────────────────────────────────────────
    show_section_headers, // boolean (default true)
                          //   Renders Section Break / Tab Break labels as full-width rows
    show_unit,            // boolean (default false)
                          //   Adds a "Unit" column. Value is parsed from field.description:
                          //     "in acre" → "ac", "in year" → "yr", "(kg)" → "kg"
    hide_empty_rows,      // boolean (default false)
                          //   Skip rows where every doc has null/empty value

    // ── Optional extras ─────────────────────────────────────────────────────
    title,                // string | null — heading shown above the table
    show_legend,          // boolean (default false)
    legend_items,         // object[] — footnote legend below the table
                          //   { label, bg_color, text_color, description }
                          //   e.g. [
                          //     { label: "NF",   bg_color: "#4472C4", description: "Natural Farming Farmer" },
                          //     { label: "M-NF", bg_color: "#70AD47", description: "Matured NF Farmer" },
                          //   ]

    // ── Permissions & editing ───────────────────────────────────────────────
    crud_permissions,     // string[] (default ["read"])
                          //   "write"  → inline cell auto-sync editing (blur/change saves)
                          //   "create" → "+" column header to create new docs in a dialog
                          //   "delete" → 🗑 icon row (frappe.model.can_delete() also checked)
                          //   e.g. ["read", "write", "create", "delete"]

    // ── Pagination / lazy loading ───────────────────────────────────────────
    filters,              // frappe filter array — used when docs: null
                          //   e.g. [["department", "=", "IT"]]
    order_by,             // string — e.g. "creation desc" — used when docs: null
    column_batch_size,    // number (default 0 = auto-calculate from viewport width)
                          //   Number of columns to render per scroll batch
    column_width,         // number px (default 150) — column width estimate for auto batch size
    max_height,           // number px (default 600) — scrollBox max-height for vertical sticky
                          //   0 = no limit (header sticks to browser viewport via window scroll)

    // ── Integration ─────────────────────────────────────────────────────────
    frm,                  // Frappe form object (optional)
                          //   - Used to read frm.vdr_events (see Events section)
                          //   - Not required for standalone use
    signal,               // AbortSignal (optional)
                          //   Pass an AbortController signal to clean up on navigation
                          //   e.g. signal: controller.signal
});
```

---

## Overriding rendering with `vdr_events`

Set `frm.vdr_events` before instantiating the component (or pass `events` directly — see tip below). Each handler is optional; return the specified value to override default behavior, or return nothing/`null` to fall through to the default.

### Override a specific cell's display

```js
frm.vdr_events = {
    formatCell(value, df, doc, colIndex) {
        // Highlight zero values in red
        if (df.fieldtype === "Int" && value === 0) {
            return `<span style="color:red;">0</span>`;
        }
        // Return null/undefined to use default frappe.format()
        return null;
    },
};
```

### Override an entire field row

```js
frm.vdr_events = {
    renderRow(df, allDocsData, tr) {
        if (df.fieldname === "mobile_number") {
            // Build a completely custom <tr>
            tr.innerHTML = `
                <td style="font-weight:bold;padding:4px 10px;">Mobile</td>
                ${allDocsData.map(doc =>
                    `<td style="padding:4px 10px;">
                        <a href="tel:${doc.mobile_number}">${doc.mobile_number || "-"}</a>
                    </td>`
                ).join("")}
            `;
            return true; // signal: row is fully built, skip default rendering
        }
        return null;     // fall through to default for all other rows
    },
};
```

### Override a section header

```js
frm.vdr_events = {
    renderSectionHeader(label, colCount, tr) {
        const td = document.createElement("td");
        td.colSpan = colCount;
        td.style.cssText = "background:#2c3e50;color:#ecf0f1;padding:6px 12px;font-size:14px;font-weight:bold;";
        td.textContent = `▸ ${label}`;
        tr.appendChild(td);
        return true; // signal: header is fully built
    },
};
```

### Override a column header cell

```js
frm.vdr_events = {
    renderColumnHeader(doc, colIndex, th) {
        // Mutate the th directly — no return value needed
        th.innerHTML = `
            <div style="font-size:14px;font-weight:bold;">${th.textContent}</div>
            <div style="font-size:11px;opacity:0.8;">${doc.name}</div>
        `;
    },
};
```

### Save hooks (inline editing)

```js
frm.vdr_events = {
    beforeSave(df, docName, newValue) {
        if (df.fieldname === "status" && newValue === "Blocked") {
            frappe.msgprint("You cannot set status to Blocked.");
            return false; // cancels the save
        }
        return true;
    },

    afterSave(df, docName, newValue) {
        frappe.show_alert({ message: `${df.label} updated`, indicator: "green" });
    },
};
```

### Create hooks (inline creation)

```js
frm.vdr_events = {
    beforeCreate(values, dialog) {
        if (!values.full_name) {
            frappe.msgprint("Full name is required.");
            return false; // cancels the insert
        }
    },

    afterCreate(newDoc) {
        frappe.show_alert({ message: `Created ${newDoc.name}`, indicator: "green" });
    },
};
```

### Run code after the table is fully rendered

```js
frm.vdr_events = {
    afterRender(instance) {
        console.log("Rendered", instance.docs.length, "columns");
        // instance.meta, instance.data, instance._table are all available here
    },
};
```

> **Tip — passing events without a form:**
> If you're using the component standalone (no `frm`), pass events directly:
> ```js
> const instance = new SVAVerticalDocRenderer({ wrapper, doctype, docs, ... });
> // OR monkey-patch before init (not recommended)
> ```
> A cleaner pattern: wrap the constructor so you can pass `events` as a param:
> ```js
> const fakefrm = { vdr_events: { formatCell(v, df) { ... } } };
> new SVAVerticalDocRenderer({ wrapper, frm: fakefrm, doctype, docs });
> ```

---

## Inline editing (auto-sync)

Enable by adding `"write"` to `crud_permissions`:

```js
new SVAVerticalDocRenderer({
    wrapper,
    doctype: "Employee",
    docs: ["EMP-0001", "EMP-0002"],
    crud_permissions: ["read", "write"],
});
```

**Behavior by field type:**

| Field types | Edit behaviour |
|---|---|
| Data, Int, Float, Currency, Percent, Date, Datetime, Time, Small Text | In-cell editor — saves automatically when focus leaves the input (blur) |
| Check, Select | In-cell editor — saves immediately on `change` |
| Link, Text, Long Text, Attach, and all others | Dialog popup (`frappe.ui.Dialog`) with an explicit Save button |

**UX details:**
- Click a cell to open the editor — no separate Edit button needed.
- **ESC** while editing reverts the cell to its original content without saving.
- While saving: cell opacity drops to 0.5 and a spinner (↻) appears.
- **On success**: error banner (if any) is cleared; in-memory `doc[fieldname]` is updated.
- **On failure**: cell reverts to original content; a red error banner appears above the table.
- Read-only fields (`df.read_only = 1` or `read_only_depends_on` evaluated true) are never editable.

---

## Validations (depends_on per cell per document)

`depends_on`, `mandatory_depends_on`, and `read_only_depends_on` are evaluated **independently for each document column** using `frappe.utils.custom_eval` (falling back to `new Function` evaluation):

| Field attribute | Effect |
|---|---|
| `depends_on` | Cell is `visibility: hidden` for documents where the expression is false |
| `read_only_depends_on` | Cell styled as muted; click-to-edit disabled for that document |
| `mandatory_depends_on` | Saving an empty value shows the error banner and blocks the API call |

Example — show "Verified By" only when Status is "Active":
```js
// In your DocType field definition:
{ fieldname: "verified_by", label: "Verified By", fieldtype: "Link",
  depends_on: "eval:doc.status == 'Active'" }
```
In the comparison table, the "Verified By" row is visible only in columns where `status === "Active"`.

---

## Link field titles

After render (and after each lazy-loaded viewport batch), the component resolves display names for Link fields in a single batch per linked DocType — never one API call per cell:

```
Customer CUST-001 → "John's Company"   (customer_name field)
Item     ITEM-001 → "Steel Bolt 5mm"   (item_name field)
```

**How title fields are discovered (in priority order):**
1. `frappe.boot.link_title_doctypes` — Frappe populates this at boot for DocTypes with `show_title_field_in_link = 1`
2. `frappe.get_meta(linkedDoctype)?.title_field` — in-memory fallback; available if the linked DocType's form was opened during the same session (zero extra API calls)

If neither source has a title field, the raw document name is shown (correct default).

To enable display titles for a custom DocType: open **Customize Form** → the DocType → check **Show Title in Link** and set the **Title Field**.

---

## Delete column

Enable by adding `"delete"` to `crud_permissions` (frappe Role Permission Manager is also checked):

```js
new SVAVerticalDocRenderer({
    wrapper,
    doctype: "Employee",
    docs: ["EMP-0001", "EMP-0002"],
    crud_permissions: ["read", "write", "create", "delete"],
});
```

- A 🗑 button appears in each column header on hover (150 ms debounce so you can move the mouse from header to button).
- Clicking shows a `frappe.confirm` dialog.
- On confirm: `frappe.xcall("frappe.client.delete", { doctype, name })` → column removed from DOM and data arrays.
- Hover state is tracked by `doc.name` (not column index), so remaining columns continue to work correctly after a deletion.

---

## Sticky freeze

The "Parameters" label column and the document header row are both sticky:

| Element | CSS | Result |
|---|---|---|
| Parameters column | `position: sticky; left: 0; z-index: 1` | Stays visible while scrolling right |
| Doc header cells | `position: sticky; top: 0; z-index: 2` | Stays visible while scrolling down |
| Corner cell (Parameters header) | `position: sticky; top: 0; left: 0; z-index: 3` | Always visible |

Sticky works because `scrollBox` has `overflow: auto` and `max-height`. Control the height with `max_height`:

```js
new SVAVerticalDocRenderer({
    wrapper,
    doctype: "Employee",
    docs: ["EMP-0001"],
    max_height: 400,   // px — scrollBox height cap; sticky works within the box
    // max_height: 0   // no cap — header sticks to the browser viewport via window scroll
});
```

---

## AbortSignal — clean teardown on navigation

If the wrapper is part of a Frappe tab or modal that can be destroyed, pass an `AbortSignal` so the component cleans up:

```js
const controller = new AbortController();

new SVAVerticalDocRenderer({
    wrapper,
    doctype: "Employee",
    docs: ["EMP-0001"],
    signal: controller.signal,
});

// Later, when the tab/modal closes:
controller.abort(); // clears the wrapper content
```

---

## CSS theming

The component uses CSS custom properties so you can restyle it globally or per-page without touching the component code:

```css
/* Global override */
:root {
    --sva-vdr-header-bg:    #2c3e50;   /* "Parameters" column header background */
    --sva-vdr-header-text:  #ecf0f1;   /* "Parameters" column header text */
    --sva-vdr-section-bg:   #2c3e50;   /* Section break row background */
    --sva-vdr-section-text: #ecf0f1;   /* Section break row text */
    --sva-vdr-label-bg:     #d5e8f7;   /* Field label cell background */
    --sva-vdr-label-text:   #1a3a5c;   /* Field label cell text */
    --sva-vdr-row-hover:    #eaf3ff;   /* Row hover highlight */
}

/* Scoped override — only inside a specific wrapper */
#my-comparison-block {
    --sva-vdr-section-bg: #1a6b3a;
    --sva-vdr-label-bg:   #d5f0e0;
}
```

---

## No-code configuration (Property Setter)

Developers who prefer a UI-driven approach can configure the component via the **Custom Property Setter** dialog in Frappe desk without writing any JS:

1. Open a DocType in **Customize Form**
2. Click an HTML field → **Set Property**
3. Set **Property Type** = `Vertical Doc Renderer`
4. Fill in:
   - **Source DocType** — which DocType to display
   - **Document Names** — JSON array, e.g. `["DOC-001", "DOC-002"]`
   - **Column Configs** — JSON array, e.g. `[{"label":"A","bg_color":"#4472C4","text_color":"#fff"}]`
   - **Fields to Show / Hide**, **Show Section Headers**, **Show Unit Column**, etc.
   - **Setup Crud Permissions** — click the button to open a dialog for configuring read/write/create/delete access; defaults to `["read"]` only

The component is then rendered automatically on form load. `vdr_events` can still be set from the form's DocType JS to override rendering.

---

## Full example

```js
frappe.ui.form.on("My DocType", {
    refresh(frm) {
        const wrapper = frm.fields_dict.comparison_view.$wrapper[0];
        wrapper.innerHTML = "";

        // Event overrides — set before instantiating
        frm.vdr_events = {
            // Colour-code the "status" field per document
            formatCell(value, df, doc, colIndex) {
                if (df.fieldname === "status") {
                    const colors = { Active: "green", Inactive: "red", Pending: "orange" };
                    return `<span style="color:${colors[value] || "inherit"}">${value || "-"}</span>`;
                }
                return null; // use default frappe.format() for everything else
            },

            // Block saving "Blocked" status
            beforeSave(df, docName, newValue) {
                if (df.fieldname === "status" && newValue === "Blocked") {
                    frappe.msgprint("Status cannot be set to Blocked here.");
                    return false; // cancels the save
                }
            },

            afterRender(instance) {
                console.log("VDR ready — columns:", instance.docs.length);
            },
        };

        new SVAVerticalDocRenderer({
            wrapper,
            frm,
            doctype: "Employee",

            // Three docs pinned by the parent form; lazy batches load on scroll
            docs: [
                frm.doc.primary_employee,
                frm.doc.secondary_employee,
                frm.doc.tertiary_employee,
            ].filter(Boolean),

            column_configs: [
                { label: "Primary",   bg_color: "#4472C4", text_color: "#fff" },
                { label: "Secondary", bg_color: "#70AD47", text_color: "#fff" },
                { label: "Tertiary",  bg_color: "#ED7D31", text_color: "#fff" },
            ],

            fields_to_hide: ["naming_series", "full_name", "employee_number"],
            show_section_headers: true,
            show_unit: false,
            hide_empty_rows: true,

            title: "Employee Comparison",

            // Inline editing + create + delete enabled; RPM still enforced
            crud_permissions: ["read", "write", "create", "delete"],

            max_height: 500,    // px — params column and header row stick within this box

            show_legend: true,
            legend_items: [
                { label: "Primary",   bg_color: "#4472C4", description: "Primary employee for this record" },
                { label: "Secondary", bg_color: "#70AD47", description: "Secondary employee for this record" },
            ],
        });
    },
});
```
