# API Reference

## Python APIs

### Main APIs (`api.py`)

| Method | Description | Auth |
|--------|-------------|------|
| `get_my_theme()` | Returns the active My Theme configuration | Guest |
| `get_doctype_fields(doctype)` | Returns all fields (including custom) for a DocType | Login |
| `get_my_list_settings(doctype)` | Returns cached list view settings for a DocType | Login |
| `get_meta_fields(doctype)` | Returns meta fields with property setters applied | Login |
| `get_property_set(doctype)` | Returns property setters for filter/workflow fields | Guest |
| `get_files(doctype, docname)` | Returns all files attached to a document | Login |

### DataTable APIs (`dt_api.py`)

| Method | Description |
|--------|-------------|
| `get_dt_list()` | Fetch list data for DocTypes or Reports with filtering and pagination |
| `get_dt_count()` | Get record count with filters applied |
| `get_report_filters()` | Retrieve report filter configurations |
| `get_chart_data()` | Get chart data for dashboard charts |
| `get_number_card_count()` | Get aggregated number card values |
| `link_report_list()` | Get linked reports for a DocType |

### Workspace APIs (`wp_api.py`)

| Method | Description |
|--------|-------------|
| `get_html_blocks(workspace)` | Retrieve custom HTML blocks for a workspace |

### Specialized APIs (`apis/`)

#### `approval_timeline.py`

```python
frappe.call(
    "frappe_theme.apis.approval_timeline.get_workflow_audit",
    doctype="Leave Application",
    reference_name="LA-001",
    limit=50
)
```

Returns the complete workflow audit trail including state sequence and all actions.

#### `export_json.py`

```python
# Export document with related tables as JSON
frappe.call(
    "frappe_theme.apis.export_json.export_json",
    doctype="Project",
    docname="PROJ-001"
)

# Export as Excel (XLSX) with multiple sheets
frappe.call(
    "frappe_theme.apis.export_json.export_excel",
    doctype="Project",
    docname="PROJ-001"
)
```

#### `meta.py`

```python
# Get possible link relationships between two DocTypes
frappe.call(
    "frappe_theme.apis.meta.get_possible_link_filters",
    doctype="Task",
    parent_doctype="Project"
)
# Returns: One-to-One, Many-to-One, Many-to-Many, One-to-Many relationships
```

#### `sva_property_setter.py`

```python
# Save field data protection configuration
frappe.call(
    "frappe_theme.apis.sva_property_setter.save_field_data_protection",
    values={
        "doctype": "Employee",
        "fieldname": "aadhaar_number",
        "data_protection": {"encrypt": True, "masking": {...}}
    }
)

# Get field data protection configuration
frappe.call(
    "frappe_theme.apis.sva_property_setter.get_field_data_protection",
    doctype="Employee",
    fieldname="aadhaar_number"
)

# Get all regex validations for a DocType
frappe.call(
    "frappe_theme.apis.sva_property_setter.get_regex_validation",
    doctype="Employee"
)
```

#### `public_api.py`

```python
# Guest-accessible value getter
frappe.call(
    "frappe_theme.apis.public_api.get_values",
    doctype="Item",
    docname="ITEM-001",
    fields=["item_name", "item_group"]
)
```

#### `doc_pdf.py`

```python
# Export document as PDF
frappe.call(
    "frappe_theme.apis.doc_pdf.export_pdf",
    doctype="Sales Invoice",
    docname="SINV-001"
)
```

#### `file_manager.py`

```python
# Download a file
frappe.call(
    "frappe_theme.apis.file_manager.download_file",
    file_path="/path/to/file"
)
```

### Cloud Storage APIs

```python
# Generate a signed URL for a cloud file
frappe.call(
    "frappe_theme.controllers.sva_integrations.cloud_assets.generate_file",
    key="uploads/2025/03/15/Invoice/ABC123_file.pdf",
    file_name="file.pdf"
)

# Migrate all local files to cloud
frappe.call(
    "frappe_theme.controllers.sva_integrations.cloud_assets.migrate_existing_files"
)
```

### Workflow APIs

```python
# Apply custom workflow with approval
frappe.call(
    "frappe_theme.overrides.workflow.custom_apply_workflow",
    doc=doc_json,
    action="Submit",
    is_custom_transition=0,
    is_comment_required=0,
    custom_comment=""
)

# Handle approval action (Approve/Reject)
frappe.call(
    "frappe_theme.overrides.workflow.handle_custom_approval_action",
    doc=doc_json,
    action="Approve",
    custom_comment="Looks good, approved."
)
```

## JavaScript Classes

### SVAHTTP

HTTP client wrapper with request cancellation support.

**File**: `public/js/svadb.js`

```javascript
const http = new SVAHTTP(abortSignal);

// Call any Frappe API method
await http.call({
    method: "frappe.client.get_count",
    args: { doctype: "Task", filters: { status: "Open" } }
});

// Fetch a document
const doc = await http.get_doc("Task", "TASK-001");

// Fetch a list
const tasks = await http.get_list("Task", {
    fields: ["name", "subject", "status"],
    filters: { project: "PROJ-001" },
    limit_page_length: 20
});

// Get a single value
const status = await http.get_value("Task", { name: "TASK-001" }, "status");

// Set a value
await http.set_value("Task", "TASK-001", "status", "Completed");

// Check if a record exists
const exists = await http.exists("Task", { subject: "My Task" });
```

### SvaDataTable

Interactive data table component.

**File**: `public/js/datatable/sva_datatable.bundle.js`

```javascript
const table = new SvaDataTable({
    wrapper: HTMLElement,          // Container element
    columns: [],                   // Column definitions
    rows: [],                      // Initial row data
    limit: 20,                     // Rows per page
    options: {
        serialNumberColumn: true,  // Show row numbers
        freezeColumnsAtLeft: 1,    // Freeze N columns
        editable: false,           // Enable inline editing
        defaultSort: {
            column: "creation",
            direction: "desc"
        },
        style: ""                  // Inline CSS
    },
    frm: cur_frm,                  // Frappe form object
    doctype: "Task",               // DocType name
    connection: {                  // Connection config
        connection_type: "Direct",
        link_doctype: "Task",
        link_fieldname: "project",
        crud_permissions: '["read", "write"]',
        listview_settings: '[]'
    },
    signal: AbortSignal,           // For request cancellation
    onFieldClick: (field, row) => {},
    onFieldValueChange: (field, value, row) => {}
});

// Methods
await table.reloadTable(true);     // Reload table (true = reset pagination)
await table.reloadRow("TASK-001"); // Reload single row
```

### SVANumberCard

Number card widget with batching and caching.

**File**: `public/js/number_card.js`

```javascript
const cards = new SVANumberCard({
    wrapper: HTMLElement,          // Container element
    frm: cur_frm,                  // Frappe form object
    numberCards: [                 // Array of card configs
        {
            number_card: "Total Sales",    // Frappe Number Card name
            card_label: "Sales",           // Display label
            is_visible: true,
            icon_value: "fa-dollar",
            background_color: "#f0f9ff",
            text_color: "#333",
            value_color: "#000"
        }
    ],
    filters: {},                   // Additional filters
    signal: AbortSignal
});
```

### SVAHeatmap

India state/district map visualization.

**File**: `public/js/custom_components/heatmap.bundle.js`

```javascript
const map = new SVAHeatmap({
    wrapper: HTMLElement,
    report: "Sales by State",          // Report name
    html_field: "map_html",            // HTML field name
    frm: cur_frm,
    default_view: "State",             // "State" or "District"
    block_height: 445,                 // Container height (px)
    primary_target: "total_amount",    // Column for color gradient
    target_fields: JSON.stringify([    // Additional popup columns
        "count", "avg_amount"
    ]),
    state_name_column: "state",        // Column with state names
    min_data_color: "#ffeda0",         // Color for min values
    max_data_color: "#800026",         // Color for max values
    filters: {},
    standard_filters: {}
});
```

### SVADashboardManager

Orchestrates number cards and charts lifecycle.

**File**: `public/js/sva_dashboard_manager.bundle.js`

```javascript
const dashboard = new SVADashboardManager({
    frm: cur_frm,
    numberCards: [...],    // Number card configurations
    charts: [...],         // Chart configurations
    signal: AbortSignal
});
```

## Jinja Template Helpers

Available in Jinja templates via `frappe_theme.utils.jinja_methods`:

| Method | Description |
|--------|-------------|
| `format_currency(value)` | Format as USD or INR with proper separators |
| `base_url()` | Get base URL from site config |
| `approver_details(dt, dn, workflow_state)` | Get approver name, email, role |
| `workflow_allowed_user(dt, state)` | Get users allowed for a workflow state |
| `incode_url(url)` | Encode URL as JWT token |
| `decode_url(token)` | Decode JWT token back to URL |
| `get_login_url(email)` | Generate login or password reset URL |
| `ordinal(n)` | Convert number to ordinal (1st, 2nd, 3rd) |

### Usage in Print Formats or Email Templates

```html
<p>Amount: {{ format_currency(doc.grand_total) }}</p>
<p>Approved by: {{ approver_details(doc.doctype, doc.name, "Approved").name }}</p>
<a href="{{ get_login_url(doc.owner) }}">Login Link</a>
```

## SQL Builder Utility

**File**: `utils/sql_builder.py`

Template-based SQL builder with parameter replacement:

```python
from frappe_theme.utils.sql_builder import SQLBuilder

builder = SQLBuilder(
    template="SELECT * FROM `tabTask` WHERE %(status)s AND %(project)s",
    params={
        "status": ["=", "Open"],
        "project": ["=", "PROJ-001"]
    }
)
query = builder.build()
```

Supports operators: `=`, `!=`, `<>`, `<`, `>`, `<=`, `>=`, `IN`, `NOT IN`, `LIKE`, `BETWEEN`, `IS NULL`.
