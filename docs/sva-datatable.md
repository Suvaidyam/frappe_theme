# SvaDatatable — Connected DocType Tables

SvaDatatable lets you display records from any linked/connected DocType as an interactive table directly inside a parent DocType's form. This is configured entirely through the UI — no code required.

## Overview

Instead of navigating away from a form to see related records, SvaDatatable renders them inline as a table with:

- Pagination, sorting, and filtering
- CRUD operations (create, read, update, delete) with permission control
- Workflow state indicators and actions
- Frozen columns
- Serial number column
- Export and import support
- Per-user column visibility preferences

## Step-by-Step Configuration

### Step 1: Add an HTML Field to the Parent DocType

The SvaDatatable renders inside an **HTML** type field. You need to add one (or more) HTML fields to the DocType where you want to display connected tables.

1. Go to **Customize Form** (or edit the DocType directly)
2. Select the target DocType (e.g., `Project`)
3. Add a new field:
   - **Type**: `HTML`
   - **Name**: e.g., `tasks_html` (this name will be referenced later)
   - **Label**: e.g., `Tasks` (optional, shown as the section heading)
4. Place it in the desired tab/section of the form
5. Save

### Step 2: Create an SVADatatable Configuration

1. Search for **"SVADatatable Configuration"** or navigate to `/app/svadatatable-configuration`
2. Click **+ Add SVADatatable Configuration**
3. Set **Parent DocType** to your target DocType (e.g., `Project`)
4. Save

> The configuration is auto-named by the Parent DocType, so there can be only one configuration per DocType.

### Step 3: Add Child DocType Entries

In the **Tables** tab of the SVADatatable Configuration, add rows to the **Child Doctypes** table. Each row defines one connected table to render.

#### Required Fields

| Field | Description |
|-------|-------------|
| **HTML Field** | Select the HTML field you created in Step 1 (dropdown shows all HTML fields in the parent DocType) |
| **Connection Type** | How the child DocType connects to the parent (see below) |

#### Connection Types

##### Direct Connection

Use when the **child DocType has a Link field** pointing to the parent DocType.

Example: `Task` has a `project` Link field pointing to `Project`.

| Field | Value |
|-------|-------|
| Connection Type | `Direct` |
| Link DocType | `Task` |
| Link Fieldname | Auto-detected (e.g., `project`) |

##### Indirect Connection

Use when the relationship goes through a **local Link field** in the parent DocType that matches a **foreign Link field** in the child DocType.

Example: `Project` has a `company` Link field, and `Employee` also has a `company` Link field. You want to show all employees of the same company.

| Field | Value |
|-------|-------|
| Connection Type | `Indirect` |
| Link DocType | `Employee` |
| Local Field | `company` (field in parent DocType) |
| Foreign Field | `company` (field in child DocType) |

##### Referenced Connection

Use when the relationship goes through an **intermediary DocType** (many-to-many).

Example: `Project` is linked to `Consultant` through a `Project Consultant` DocType that has Link fields to both.

| Field | Value |
|-------|-------|
| Connection Type | `Referenced` |
| Referenced Link DocType | `Project Consultant` |
| Dt Reference Field | Field in the intermediary that links to the parent |
| Dn Reference Field | Field in the intermediary that links to the child |

##### Unfiltered

Shows **all records** of the linked DocType without any filter. The records are displayed regardless of any connection to the parent document.

| Field | Value |
|-------|-------|
| Connection Type | `Unfiltered` |
| Link DocType | `ToDo` |

##### Report

Renders the output of a **Frappe Report** as a table.

| Field | Value |
|-------|-------|
| Connection Type | `Report` |
| Link Report | Select a Report (e.g., `Project Billing Summary`) |
| Unfiltered | Check to show report data without parent-based filtering |

##### Is Custom Design

Renders a **built-in component template** instead of a data table.

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | Choose from: `Tasks`, `Email`, `Timeline`, `Gallery`, `Notes`, `Linked Users`, `Approval Request`, `HTML View From API` |
| Endpoint | (For `HTML View From API` only) Python method path that returns HTML (e.g., `my_app.api.get_dashboard_html`) |

### Step 4: Configure Table Settings

Each child entry has a **Settings** section with these options:

#### Listview Settings

Click **"Setup Listview Setting"** to configure which columns appear in the table. This opens a dialog where you can select fields and set their visibility and order.

#### CRUD Permissions

Click **"Setup Crud Permissions"** to control what operations users can perform:

- **Read** — view records (default)
- **Create** — add new records
- **Write** — edit existing records
- **Delete** — remove records

The permissions are stored as a JSON array, e.g., `["read", "write", "create"]`.

#### Action List

Click **"Setup Action List"** to configure custom action buttons that appear in each row.

#### List Filters

Click **"Setup List Filters"** to configure default filters that are always applied to the table data.

### Step 5: Configure Conditional Visibility

Control when add/edit/delete buttons and workflow actions appear using JavaScript expressions:

| Field | Description | Example |
|-------|-------------|---------|
| Disable Add Depends On (JS) | Hide the "Add row" button | `doc.workflow_state == "Approved"` |
| Disable Edit Depends On (JS) | Disable editing records | `doc.docstatus == 1` |
| Disable Delete Depends On (JS) | Disable deleting records | `doc.workflow_state != "Draft"` |
| Disable Workflow Depends On (JS) | Hide workflow action buttons | `doc.docstatus == 1` |

> In these expressions, `doc` refers to the **parent document** (not the child row).

### Step 6: Additional Options

| Field | Default | Description |
|-------|---------|-------------|
| Title | — | Custom title displayed above the table |
| Workflow Action Label | "Approval" | Label for the workflow action column |
| "Add row" Button Label | "Add row" | Custom label for the add button |
| Redirect to main form on any Action | No | Open the child document's form instead of inline dialog |
| Make Dialogs Fullscreen | No | Use fullscreen dialogs for add/edit |
| Keep workflow enabled after form submission | No | Keep workflow buttons visible after parent form is submitted |
| Hide workflow (Even If exists) | No | Force-hide workflow actions even if a workflow is configured |
| Hide Table | No | Temporarily hide this table without deleting the configuration |
| Allow Export | No | Enable export button for the table data |
| Allow Import | No | Enable import button |
| Transposed | No | (Report only) Display report data in transposed layout |
| Extend Condition | No | Enable extended filter conditions |
| Extended Condition | — | Additional filter conditions in JSON format |

## Extended Conditions

When **Extend Condition** is checked, you can add custom filters in JSON format:

```json
[["Task", "status", "=", "Open"], ["Task", "priority", "=", "High"]]
```

These filters are applied in addition to the connection-based filters.

## SVADT Connections DocType

The **SVADT Connections** is a virtual DocType that provides an alternative way to manage DataTable connections. It includes all the same fields as the SVADatatable Configuration Child, plus a **Display Depends On** field for conditional rendering.

**Display Depends On** example:
```javascript
eval:doc.workflow_state == "Approved"
```

This makes the entire table visible or hidden based on the parent document's state.

## User Listview Settings

Each user can personalize their column visibility using the **SVADT User Listview Settings** DocType. This is managed automatically through the table's column settings UI — users don't need to create these records manually.

## JavaScript Events (dt_events)

SvaDatatable provides a comprehensive event system for customizing behavior at every lifecycle stage. Events are defined per-DocType or globally in your client script.

### Defining Events

**DocType-specific events:**

```javascript
frappe.ui.form.on('Project', {
    refresh(frm) {
        frm.dt_events = {
            'Task': {
                before_load: async function(dt) {
                    dt.total_tasks = 0;
                },
                after_load: async function(dt) {
                    frm.set_value('task_count', dt.rows.length);
                },
                after_insert: async function(dt, response) {
                    frappe.show_alert({ message: 'Task added', indicator: 'success' });
                }
            }
        };
    }
});
```

**Global events (all tables on the form):**

```javascript
frm.dt_global_events = {
    before_load: function(dt) {
        console.log('Loading: ' + dt.doctype);
    }
};
```

### Event Lifecycle

Events are called in this order:

**1. Initialization Phase:**

| Event | Async | Parameters | Description |
|-------|-------|-----------|-------------|
| `before_load` | Yes | `(dt)` | Setup before any data fetch. Rows not available yet |
| `before_table_load` | Yes | `(dt)` | After metadata fetched, before rendering. Can modify columns |
| `after_load` | Yes | `(dt)` | After table is fully rendered. All rows available in `dt.rows` |

**2. Row & Form Phase:**

| Event | Async | Parameters | Description |
|-------|-------|-----------|-------------|
| `after_row_update` | Yes | `(dt, updated_doc, rowIndex)` | Single row updated |
| `add_row_handler` | Yes | `()` | "Add Row" button clicked (replaces default behavior) |
| `customize_form_fields` | Yes | `(dt, fields, mode, has_action, name)` | Form dialog preparation. **Must return fields array** |
| `after_insert` | Yes | `(dt, response)` | New record created |
| `after_update` | Yes | `(dt, response)` | Existing record updated |
| `after_save` | Yes | `(dt, mode, values)` | Any save (insert or update). `mode` is `'create'` or `'write'` |
| `after_delete` | Yes | `(dt, name)` | Record deleted |
| `after_render` | Yes | `(dt, mode, has_action, name)` | Form dialog fully rendered |

**3. Workflow Phase:**

| Event | Async | Parameters | Description |
|-------|-------|-----------|-------------|
| `before_workflow_action` | Yes | `(dt, state_info, docname, prevState, doc)` | Before transition. Can throw to block |
| `after_workflow_dialog_render` | No | `(dt, state_info, docname, prevState)` | Dialog displayed |
| `after_workflow_action` | Yes | `(dt, state_info, docname, prevState, doc)` | Transition complete |

**4. Display Phase:**

| Event | Async | Parameters | Returns |
|-------|-------|-----------|---------|
| `formatter['fieldname']` | No | `(value, column, row, dt)` | HTML string |
| `formatter['#']` | No | `(serial, row, dt)` | HTML string |
| `columnEvents['fieldname']` | No | `(element, value, column, row, dt)` | — |
| `additional_row_actions` | Yes | `(dt, row, primaryKey)` | — |

### Display Events Examples

**Cell formatting:**

```javascript
frm.dt_events['Invoice'] = {
    formatter: {
        'amount': function(value, column, row, dt) {
            const color = value > 10000 ? '#d32f2f' : '#333';
            return `<span style="color: ${color}">$${Number(value).toFixed(2)}</span>`;
        },
        'status': function(value, column, row, dt) {
            const colors = { 'Paid': '#4caf50', 'Unpaid': '#f44336', 'Pending': '#ff9800' };
            return `<span style="background: ${colors[value] || '#999'}; color: white;
                     padding: 4px 12px; border-radius: 3px;">${value}</span>`;
        }
    }
};
```

**Column click handlers:**

```javascript
frm.dt_events['Customer'] = {
    columnEvents: {
        'customer_name': {
            'click': function(element, value, column, row, dt) {
                frappe.set_route('Form', 'Customer', row.name);
            }
        }
    }
};
```

**Custom row actions (dropdown menu):**

```javascript
frm.dt_events['Sales Order'] = {
    additional_row_actions: {
        'send_email': {
            label: 'Send Email',
            condition: function(dt, row, pk) {
                return row.status === 'Confirmed';
            },
            action: async function(dt, row, pk) {
                await frappe.call({ method: 'send_order_email', args: { order_id: pk } });
                frappe.show_alert({ message: 'Email sent', indicator: 'success' });
            }
        }
    }
};
```

### Complete Example

```javascript
frm.dt_events['Invoice Line'] = {
    before_load: async function(dt) { dt.total = 0; },
    after_load: async function(dt) { console.log('Loaded ' + dt.rows.length + ' items'); },

    customize_form_fields: function(dt, fields, mode) {
        if (mode === 'create') {
            fields.forEach(f => { if (f.fieldname === 'item_code') f.reqd = 1; });
        }
        return fields;  // Must return!
    },

    after_insert: async function(dt, response) {
        frappe.show_alert({ message: 'Item added', indicator: 'success' });
    },

    after_save: function(dt, mode, values) { dt.reloadTable(); },

    formatter: {
        'amount': (val) => '$' + Number(val).toFixed(2)
    },

    columnEvents: {
        'item_code': {
            'click': (el, val, col, row) => frappe.set_route('Form', 'Item', val)
        }
    },

    additional_row_actions: {
        'duplicate': {
            label: 'Duplicate',
            action: async (dt, row, pk) => {
                const doc = await frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: dt.doctype, name: pk }
                });
                delete doc.message.name;
                frappe.new_doc(dt.doctype, doc.message);
            }
        }
    }
};
```

> For the full events reference with all examples and best practices, see the source file: `public/js/datatable/DT_EVENTS_DOCUMENTATION.md`

## JavaScript API (Advanced)

For advanced use cases, you can instantiate `SvaDataTable` programmatically:

```javascript
const table = new SvaDataTable({
    wrapper: document.getElementById('my-container'),
    columns: [
        { fieldname: 'name', label: 'ID', fieldtype: 'Data' },
        { fieldname: 'subject', label: 'Subject', fieldtype: 'Data' },
        { fieldname: 'status', label: 'Status', fieldtype: 'Select' }
    ],
    rows: [],
    limit: 20,
    options: {
        serialNumberColumn: true,
        freezeColumnsAtLeft: 1,
        editable: false,
        defaultSort: { column: 'creation', direction: 'desc' }
    },
    frm: cur_frm,
    doctype: 'Task',
    connection: {
        connection_type: 'Direct',
        link_doctype: 'Task',
        link_fieldname: 'project',
        crud_permissions: '["read", "write", "create"]',
        listview_settings: '[]'
    },
    signal: new AbortController().signal
});
```

### Key Methods

| Method | Description |
|--------|-------------|
| `reloadTable(reset)` | Reload the entire table. Pass `true` to reset pagination |
| `reloadRow(docname, fetch_from_server)` | Update a single row without full reload |
| `getDocList()` | Fetch documents based on current filters and permissions |

## Tips

- You can render **multiple tables** into a single parent DocType by adding multiple HTML fields and multiple child entries
- Tables automatically respect Frappe's permission system — users only see records they have permission to access
- The table uses the **SVAHTTP** class for API calls, which supports request cancellation via AbortController
- Number cards and charts for the same DocType are configured in separate tabs of the same SVADatatable Configuration (see [Number Cards & Charts](number-cards-and-charts.md))
