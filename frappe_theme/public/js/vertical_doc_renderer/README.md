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

### Minimal — doctype name + doc list

```js
const container = document.createElement("div");
document.body.appendChild(container);

new SVAVerticalDocRenderer({
    wrapper: container,
    doctype: "Employee",
    docs: ["EMP-0001", "EMP-0002", "EMP-0003"],
});
```

This fetches the `Employee` meta automatically, fetches the three documents, and renders the table.

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

    docs,                 // string[] — doc names shown as columns, left to right
                          //   e.g. ["EMP-0001", "EMP-0002", "EMP-0003"]

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
                          //   Add "write" to enable inline editing on cells
                          //   e.g. ["read", "write"]

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

## Inline editing

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

| Field types | Edit mode |
|---|---|
| Data, Int, Float, Currency, Percent, Date, Datetime, Time, Check, Select, Small Text | In-cell editor (Frappe control with ✓ / ✗ buttons) |
| Link, Text, Long Text, Attach, and all others | Dialog popup (`frappe.ui.Dialog`) |

Clicking a cell opens the editor. Saving calls `frappe.db.set_value(doctype, docName, fieldname, newValue)` and refreshes the cell. Fields with `read_only: 1` in the meta are never editable.

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

The component is then rendered automatically on form load. `vdr_events` can still be set from the form's DocType JS to override rendering.

---

## Full example

```js
frappe.ui.form.on("My DocType", {
    refresh(frm) {
        const wrapper = frm.fields_dict.comparison_view.$wrapper[0];
        wrapper.innerHTML = "";

        // Set event overrides before creating the component
        frm.vdr_events = {
            formatCell(value, df, doc, colIndex) {
                if (df.fieldname === "status") {
                    const colors = { Active: "green", Inactive: "red", Pending: "orange" };
                    return `<span style="color:${colors[value] || "inherit"}">${value || "-"}</span>`;
                }
                return null;
            },
            afterRender(instance) {
                console.log("VDR ready:", instance);
            },
        };

        new SVAVerticalDocRenderer({
            wrapper,
            frm,
            doctype: "Employee",
            docs: [frm.doc.primary_employee, frm.doc.secondary_employee, frm.doc.tertiary_employee].filter(Boolean),
            column_configs: [
                { label: "Primary",   bg_color: "#4472C4", text_color: "#fff" },
                { label: "Secondary", bg_color: "#70AD47", text_color: "#fff" },
                { label: "Tertiary",  bg_color: "#ED7D31", text_color: "#fff" },
            ],
            fields_to_hide: ["naming_series", "full_name", "employee_number"],
            show_section_headers: true,
            show_unit: false,
            title: "Employee Comparison",
            crud_permissions: ["read", "write"],
            show_legend: true,
            legend_items: [
                { label: "Primary",   bg_color: "#4472C4", description: "Primary employee for this record" },
                { label: "Secondary", bg_color: "#70AD47", description: "Secondary employee for this record" },
            ],
        });
    },
});
```
