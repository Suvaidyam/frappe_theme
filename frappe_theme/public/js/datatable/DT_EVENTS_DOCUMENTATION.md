# SVA DataTable Events (dt_events)

Complete reference for all events in SVA DataTable with examples and best practices.

## Overview

SVA DataTable provides event hooks at different lifecycle stages, allowing you to customize behavior for initialization, row operations, forms, workflows, and display.

### Event Types

**Doctype-specific events:**

```javascript
frm.dt_events = {
    'DocTypeName': {
        before_load: function(dt) { },
        after_insert: async function(dt, response) { }
    }
}
```

**Global events (all tables):**

```javascript
frm.dt_global_events = {
    before_load: function(dt) { },
    after_insert: async function(dt, response) { }
}
```

---

## Event Lifecycle

Events are called in this order:

1. **Initialization Phase**
   - `before_load` - Setup before any data fetch
   - `before_table_load` - After metadata, before rendering
   - `after_load` - After table renders

2. **Row & Form Phase**
   - `after_row_update` - Single row update
   - `add_row_handler` - "Add Row" button clicked
   - `customize_form_fields` - Form dialog preparation
   - `after_insert` - New record created
   - `after_update` - Record updated
   - `after_save` - Any save (insert or update)
   - `after_delete` - Record deleted
   - `after_render` - Form dialog rendered

3. **Workflow Phase**
   - `before_workflow_action` - Before transition
   - `after_workflow_dialog_render` - Dialog displayed
   - `after_workflow_action` - Transition complete

4. **Display Phase**
   - `formatter` - Cell value formatting
   - `columnEvents` - Column click/hover handlers
   - `additional_row_actions` - Row dropdown menu

---

## Initialization Events

### before_load

Called before table initialization starts.

**Parameters:**
- `dt` - SvaDataTable instance

**Async:** Yes

**Use cases:**
- Initialize custom properties
- Load server configuration
- Prepare filters

**Example:**

```javascript
frm.dt_events['Sales Order Item'] = {
    before_load: async function(dt) {
        dt.total_quantity = 0;
        const config = await frappe.call({
            method: 'get_config'
        });
        dt.config = config.message;
    }
}
```

**Important:**
- Rows not loaded yet - cannot access `dt.rows`
- Can modify `dt.columns`, `dt.options`

---

### before_table_load

Called after metadata is fetched, before table renders.

**Parameters:**
- `dt` - SvaDataTable instance

**Async:** Yes

**Use cases:**
- Filter columns
- Reorder columns
- Set column visibility based on permissions

**Example:**

```javascript
frm.dt_events['Order Items'] = {
    before_table_load: function(dt) {
        // Hide internal columns
        dt.columns = dt.columns.filter(col => {
            return !col.fieldname.startsWith('_');
        });
        
        // Reorder by priority
        const priority = ['item_code', 'qty', 'rate', 'amount'];
        dt.columns.sort((a, b) => {
            const aIdx = priority.indexOf(a.fieldname);
            const bIdx = priority.indexOf(b.fieldname);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
    }
}
```

**Important:**
- Metadata available - columns, fields info
- Rows not loaded yet
- Changes take effect before rendering

---

### after_load

Called after table body is fully rendered.

**Parameters:**
- `dt` - SvaDataTable instance

**Async:** Yes

**Use cases:**
- Calculate totals
- Apply styling
- Attach event listeners
- Update parent form

**Example:**

```javascript
frm.dt_events['Invoice Items'] = {
    after_load: async function(dt) {
        let total = 0;
        dt.rows.forEach(row => {
            total += parseFloat(row.amount || 0);
        });
        
        if (dt.frm) {
            dt.frm.set_value('total_items', dt.rows.length);
            dt.frm.set_value('grand_total', total);
        }
    }
}
```

**Important:**
- All rows available in `dt.rows`
- DOM is rendered - can apply CSS
- Final initialization step

---

## Row Management Events

### after_row_update

Called when a single row is updated.

**Parameters:**
- `dt` - SvaDataTable instance
- `updated_doc` - Updated document
- `rowIndex` - Row position

**Async:** Yes

**Use cases:**
- Recalculate dependent values
- Update summary rows
- Apply conditional styling

**Example:**

```javascript
frm.dt_events['Order Lines'] = {
    after_row_update: async function(dt, updated_doc, rowIndex) {
        const lineTotal = (updated_doc.quantity || 0) * (updated_doc.rate || 0);
        
        let grandTotal = 0;
        dt.rows.forEach(row => {
            grandTotal += parseFloat(row.amount || 0);
        });
        
        if (dt.frm) {
            dt.frm.set_value('total', grandTotal);
        }
    }
}
```

**Important:**
- Single row only - not entire table
- Can update parent form
- DOM access available

---

### add_row_handler

Called when "Add Row" button is clicked.

**Parameters:** None

**Async:** Yes

**Use cases:**
- Custom row creation workflows
- Show confirmation dialogs
- Redirect to full form
- Pre-populate fields

**Example:**

```javascript
frm.dt_events['Sales Order Items'] = {
    add_row_handler: async function() {
        const config = await frappe.call({
            method: 'get_default_item'
        });
        
        frappe.new_doc('Sales Order Item', {
            item_code: config.message.item_code,
            rate: config.message.default_rate
        });
    }
}
```

**Important:**
- Replaces default behavior - you must handle row creation
- No parameters passed
- Use `frappe.new_doc()` to create

---

## Form Events

### customize_form_fields

Called when form dialog is being prepared.

**Parameters:**
- `dt` - SvaDataTable instance
- `fields` - Array of field definitions
- `mode` - 'create', 'write', or 'view'
- `has_additional_action` - Boolean
- `name` - Document name (for edit)

**Async:** Yes

**Returns:** Modified fields array or null

**Use cases:**
- Show/hide fields based on mode
- Make fields required/readonly
- Add field validators
- Configure field behavior

**Example:**

```javascript
frm.dt_events['Order Items'] = {
    customize_form_fields: function(dt, fields, mode, has_additional_action, name) {
        if (mode === 'create') {
            fields = fields.map(f => {
                if (['item_code', 'quantity'].includes(f.fieldname)) {
                    f.reqd = 1;
                }
                return f;
            });
        } else if (mode === 'write') {
            fields = fields.map(f => {
                if (f.fieldname === 'item_code') {
                    f.read_only = 1; // Cannot change after creation
                }
                return f;
            });
        }
        
        return fields;
    }
}
```

**Important:**
- Must return fields array
- Called for all modes - check `mode` parameter
- Changes apply before dialog shows

---

## Data Events

### after_insert

Called after a new document is successfully created.

**Parameters:**
- `dt` - SvaDataTable instance
- `response` - Created document with all fields

**Async:** Yes

**Use cases:**
- Show success messages
- Update parent counters
- Send notifications
- Log creation
- Trigger downstream processes

**Example:**

```javascript
frm.dt_events['Purchase Orders'] = {
    after_insert: async function(dt, response) {
        frappe.show_alert({
            message: 'PO created successfully',
            indicator: 'success'
        });
        
        if (dt.frm) {
            dt.frm.set_value('po_count', (dt.frm.doc.po_count || 0) + 1);
        }
    }
}
```

**Important:**
- Full document available
- Transaction is complete
- Parent form context available

---

### after_update

Called after an existing document is updated.

**Parameters:**
- `dt` - SvaDataTable instance
- `response` - Updated document

**Async:** Yes

**Use cases:**
- Show update confirmation
- Recalculate totals
- Check constraints
- Update parent form

**Example:**

```javascript
frm.dt_events['Invoice Items'] = {
    after_update: async function(dt, response) {
        let total = 0;
        dt.rows.forEach(row => {
            total += parseFloat(row.amount || 0);
        });
        
        if (dt.frm) {
            dt.frm.set_value('total', total);
        }
    }
}
```

**Important:**
- For edits only, not new records
- Updated document provided with new values
- Can refresh parent

---

### after_save

Called after any save operation (insert or update).

**Parameters:**
- `dt` - SvaDataTable instance
- `mode` - 'create' or 'write'
- `values` - Saved field values

**Async:** Yes

**Use cases:**
- Unified save handling
- Audit logging
- Cleanup
- Mode-specific actions

**Example:**

```javascript
frm.dt_events['Order Items'] = {
    after_save: async function(dt, mode, values) {
        if (mode === 'create') {
            frappe.show_alert({
                message: 'Item added',
                indicator: 'success'
            });
        }
        
        await frappe.call({
            method: 'log_change',
            args: {
                item_id: values.name,
                action: mode
            }
        });
    }
}
```

**Important:**
- Fires for both inserts and updates
- Check `mode` to distinguish operations

---

### after_delete

Called after a document is successfully deleted.

**Parameters:**
- `dt` - SvaDataTable instance
- `name` - Name of deleted document

**Async:** Yes

**Use cases:**
- Show confirmation
- Update counters
- Recalculate totals
- Audit logging
- Check for orphaned records

**Example:**

```javascript
frm.dt_events['Ledger Entries'] = {
    after_delete: async function(dt, name) {
        dt.rows = dt.rows.filter(r => r.name !== name);
        
        let debit_total = 0, credit_total = 0;
        dt.rows.forEach(row => {
            debit_total += parseFloat(row.debit || 0);
            credit_total += parseFloat(row.credit || 0);
        });
        
        if (dt.frm) {
            dt.frm.set_value('total_debit', debit_total);
            dt.frm.set_value('total_credit', credit_total);
        }
    }
}
```

**Important:**
- Only document name available
- Permanent operation
- Transaction complete

---

### after_render

Called after form dialog is fully rendered.

**Parameters:**
- `dt` - SvaDataTable instance
- `mode` - 'create', 'write', or 'view'
- `has_additional_action` - Boolean
- `name` - Document name (for edit)

**Async:** Yes

**Use cases:**
- Set field focus
- Pre-fill default values
- Add keyboard shortcuts
- Apply custom styling
- Add tooltips

**Example:**

```javascript
frm.dt_events['Quotation Items'] = {
    after_render: async function(dt, mode, has_additional_action, name) {
        const dialog = dt.form_dialog;
        
        if (mode === 'create') {
            dialog.fields_dict['item_code'].$input.focus();
            dialog.set_value('validity_days', 30);
        }
        
        dialog.$wrapper.on('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                dialog.get_primary_btn().click();
            }
        });
    }
}
```

**Important:**
- Dialog fully rendered
- All fields available
- Can attach event listeners
- Can apply CSS

---

## Workflow Events

### before_workflow_action

Called before workflow state transition is initiated.

**Parameters:**
- `dt` - SvaDataTable instance
- `state_info` - State and action information
- `docname` - Document name
- `prevState` - Current state
- `doc` - Document object

**Async:** Yes

**Use cases:**
- Validate prerequisites
- Check permissions
- Prevent invalid transitions
- Log attempts

**Example:**

```javascript
frm.dt_events['Approval Request'] = {
    before_workflow_action: async function(dt, state_info, docname, prevState, doc) {
        if (state_info.action === 'Approve') {
            if (!doc.manager_assigned) {
                frappe.throw('Manager must be assigned');
            }
        }
    }
}
```

**Important:**
- Can throw errors to block transition
- Fires before dialog is shown
- Full document available

---

### after_workflow_dialog_render

Called after workflow dialog is displayed.

**Parameters:**
- `dt` - SvaDataTable instance
- `state_info` - State and action information
- `docname` - Document name
- `prevState` - Current state

**Async:** No (synchronous)

**Use cases:**
- Customize dialog fields
- Pre-fill values
- Make fields required
- Lock fields

**Example:**

```javascript
frm.dt_events['Approval Form'] = {
    after_workflow_dialog_render: function(dt, state_info, docname, prevState) {
        const dialog = dt.workflow_dialog;
        
        if (state_info.action === 'Reject') {
            dialog.set_df_property('reason', 'reqd', 1);
        }
        
        dialog.fields_dict['reason'].$input.focus();
    }
}
```

**Important:**
- Synchronous only - no async/await
- Changes immediately visible
- Dialog reference available

---

### after_workflow_action

Called after workflow state transition is complete.

**Parameters:**
- `dt` - SvaDataTable instance
- `state_info` - State and action information
- `docname` - Document name
- `prevState` - Previous state
- `doc` - Updated document

**Async:** Yes

**Use cases:**
- Send notifications
- Update related records
- Create dependent documents
- Log workflow history

**Example:**

```javascript
frm.dt_events['Leave Request'] = {
    after_workflow_action: async function(dt, state_info, docname, prevState, doc) {
        const newState = state_info.next_state;
        
        frappe.show_alert({
            message: 'Request ' + state_info.action + 'ed',
            indicator: 'success'
        });
        
        if (newState === 'Approved') {
            await frappe.call({
                method: 'send_approval_email',
                args: { request_id: docname }
            });
        }
    }
}
```

**Important:**
- Transition is complete
- Updated document available with new state
- Perfect for notifications

---

## Display Events

### formatter

Called when cells are rendered for display.

**Parameters vary by formatter type:**
- Serial number `'#'`: `(serial, row, dt)`
- Field formatter: `(value, column, row, dt)`

**Async:** No (synchronous)

**Returns:** HTML string

**Use cases:**
- Format numbers/dates/currencies
- Apply conditional colors
- Create links
- Show badges
- Progress bars

**Example - Serial Number:**

```javascript
frm.dt_events['Items'] = {
    formatter: {
        '#': function(serialNumber, row, dt) {
            return '<strong>' + serialNumber + '</strong>';
        }
    }
}
```

**Example - Field Formatter:**

```javascript
frm.dt_events['Invoices'] = {
    formatter: {
        'amount': function(value, column, row, dt) {
            const formatted = Number(value || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2
            });
            
            const color = value > 10000 ? '#d32f2f' : '#333';
            return '<span style="color: ' + color + '">$' + formatted + '</span>';
        },
        
        'status': function(value, column, row, dt) {
            const colors = {
                'Active': '#4caf50',
                'Inactive': '#f44336',
                'Pending': '#ff9800'
            };
            
            const bgColor = colors[value] || '#999';
            return '<span style="background: ' + bgColor + '; color: white; ' +
                   'padding: 4px 12px; border-radius: 3px;">' + value + '</span>';
        }
    }
}
```

**Important:**
- Must be synchronous - no async
- Keep fast - called for every cell
- Return HTML as string
- Don't attach events - use columnEvents instead

---

### columnEvents

Called when clicking or hovering on columns.

**Parameters:**
- `element` - DOM element
- `value` - Cell value
- `column` - Column definition
- `row` - Row data
- `dt` - SvaDataTable instance

**Async:** No (event handler)

**Supported events:** 'click', 'dblclick', 'mouseenter', 'mouseleave'

**Use cases:**
- Navigate on click
- Show details
- Delete with confirmation
- Quick actions

**Example:**

```javascript
frm.dt_events['Customers'] = {
    columnEvents: {
        'customer_name': {
            'click': function(element, value, column, row, dt) {
                frappe.set_route('Form', 'Customer', row.name);
            },
            
            'mouseenter': function(element, value, column, row, dt) {
                element.style.backgroundColor = '#f5f5f5';
                element.style.cursor = 'pointer';
            },
            
            'mouseleave': function(element, value, column, row, dt) {
                element.style.backgroundColor = '';
            }
        },
        
        'outstanding_amount': {
            'click': function(element, value, column, row, dt) {
                if (value > 0) {
                    frappe.show_alert({
                        message: 'Outstanding: ' + value,
                        indicator: 'warning'
                    });
                }
            }
        }
    }
}
```

**Important:**
- Element and row data provided
- Synchronous - no async/await
- Can be called many times per page

---

### additional_row_actions

Called when building the row action dropdown menu.

**Parameters:**
- `dt` - SvaDataTable instance
- `row` - Row data
- `primaryKey` - Document name

**Async:** Yes (in action function)

**Returns:** Object with action definitions

**Use cases:**
- Send emails
- Print/export
- Create related documents
- Duplicate records
- Custom workflows

**Example:**

```javascript
frm.dt_events['Sales Orders'] = {
    additional_row_actions: {
        'send_email': {
            label: 'Send Email',
            
            condition: function(dt, row, primaryKey) {
                return row.status === 'Confirmed' && row.customer_email;
            },
            
            action: async function(dt, row, primaryKey) {
                await frappe.call({
                    method: 'send_order_email',
                    args: { order_id: primaryKey }
                });
                
                frappe.show_alert({
                    message: 'Email sent',
                    indicator: 'success'
                });
            }
        },
        
        'print': {
            label: 'Print',
            
            condition: (dt, row) => row.docstatus === 1,
            
            action: async (dt, row, pk) => {
                frappe.utils.print('Sales Order', pk);
            }
        },
        
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
}
```

**Important:**
- Label is text shown to user
- Condition is optional - controls visibility
- Action supports async
- Row data available

---

## Global Events

Define events that apply to all datatables in the form:

```javascript
frm.dt_global_events = {
    before_load: function(dt) {
        console.log('Loading: ' + dt.doctype);
    },
    
    after_insert: async function(dt, response) {
        console.log('Created in: ' + dt.doctype);
    }
}
```

**Advantages:**
- DRY - avoid code duplication
- Consistent behavior across tables
- Centralized logic

---

## Best Practices

### DO

```javascript
// Use async/await
after_insert: async function(dt, response) {
    await frappe.call({ method: 'notify' });
}

// Check event exists
if (frm?.dt_events?.[doctype]?.after_insert) {
    // Safe to use
}

// Handle errors
after_insert: async function(dt, response) {
    try {
        await frappe.call({ method: 'validate' });
    } catch(error) {
        frappe.show_alert({
            message: 'Error: ' + error.message,
            indicator: 'danger'
        });
    }
}

// Return fields in customize_form_fields
customize_form_fields: function(dt, fields, mode) {
    fields.forEach(f => f.hidden = 0);
    return fields; // Important!
}

// Keep formatters fast
formatter: {
    'amount': (val) => '$' + Number(val).toFixed(2)
}
```

### DON'T

```javascript
// Don't use callbacks
after_insert: function(dt, response) {
    frappe.call({
        callback: (r) => { /* */ }
    });
}

// Don't attach events in formatters
formatter: {
    'field': (val) => {
        element.addEventListener('click', fn); // Wrong!
        return val;
    }
}

// Don't do heavy operations in formatters
formatter: {
    'field': function(val) {
        let result = expensive_calculation(val); // Freezes table
        return result;
    }
}

// Don't forget to return fields
customize_form_fields: function(dt, fields) {
    fields.forEach(f => f.hidden = 0);
    // Forgot to return!
}

// Don't access rows before after_load
before_load: function(dt) {
    dt.rows.forEach(row => { }); // Doesn't exist yet
}
```

---

## Complete Example

```javascript
frm.dt_events['Invoice Line'] = {
    // Initialization
    before_load: async function(dt) {
        dt.total = 0;
    },
    
    after_load: async function(dt) {
        console.log('Loaded ' + dt.rows.length + ' items');
    },
    
    // Forms
    customize_form_fields: function(dt, fields, mode) {
        if (mode === 'create') {
            fields.forEach(f => {
                if (f.fieldname === 'item_code') f.reqd = 1;
            });
        }
        return fields;
    },
    
    // Data
    after_insert: async function(dt, response) {
        frappe.show_alert({
            message: 'Item added',
            indicator: 'success'
        });
    },
    
    after_save: function(dt, mode, values) {
        dt.reloadTable();
    },
    
    // Display
    formatter: {
        'amount': (val) => '$' + Number(val).toFixed(2)
    },
    
    columnEvents: {
        'item_code': {
            'click': (el, val, col, row) => {
                frappe.set_route('Form', 'Item', val);
            }
        }
    },
    
    additional_row_actions: {
        'delete': {
            label: 'Delete',
            action: async (dt, row, pk) => {
                frappe.confirm('Delete item?', async () => {
                    await frappe.call({
                        method: 'frappe.client.delete',
                        args: { doctype: dt.doctype, name: pk }
                    });
                    dt.reloadTable();
                });
            }
        }
    }
}
```

---

## Common Patterns

**Conditional field configuration:**

```javascript
customize_form_fields: function(dt, fields, mode) {
    return fields.map(f => {
        if (mode === 'write') {
            f.read_only = ['item_code', 'uom'].includes(f.fieldname);
        }
        return f;
    });
}
```

**Calculate and sync totals:**

```javascript
after_row_update: function(dt, doc, idx) {
    let total = dt.rows.reduce((sum, r) => sum + (r.amount || 0), 0);
    if (dt.frm) dt.frm.set_value('total', total);
}
```

**Notify on important changes:**

```javascript
after_update: async function(dt, response) {
    if (response.status === 'Critical') {
        await frappe.call({
            method: 'send_alert',
            args: { item: response.name }
        });
    }
}
```

---

## API Reference

| Event | Async | Parameters | Returns |
|-------|-------|-----------|---------|
| `before_load` | Yes | `(dt)` | - |
| `before_table_load` | Yes | `(dt)` | - |
| `after_load` | Yes | `(dt)` | - |
| `after_row_update` | Yes | `(dt, doc, idx)` | - |
| `add_row_handler` | Yes | `()` | - |
| `customize_form_fields` | Yes | `(dt, fields, mode, action, name)` | fields |
| `after_insert` | Yes | `(dt, response)` | - |
| `after_update` | Yes | `(dt, response)` | - |
| `after_save` | Yes | `(dt, mode, values)` | - |
| `after_delete` | Yes | `(dt, name)` | - |
| `after_render` | Yes | `(dt, mode, action, name)` | - |
| `before_workflow_action` | Yes | `(dt, state, name, prev, doc)` | - |
| `after_workflow_dialog_render` | No | `(dt, state, name, prev)` | - |
| `after_workflow_action` | Yes | `(dt, state, name, prev, doc)` | - |
| `formatter['#']` | No | `(serial, row, dt)` | HTML |
| `formatter['field']` | No | `(value, col, row, dt)` | HTML |
| `columnEvents` | No | `(el, val, col, row, dt)` | - |
| `additional_row_actions` | Yes | `(dt, row, pk)` | - |
