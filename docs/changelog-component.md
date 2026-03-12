# Change Log / Version Component

Frappe Theme enhances Frappe's standard Version tracking to display a unified change log across parent and child documents — all changes to connected DocTypes appear in the parent form's timeline.

## Overview

| Feature | Description |
|---------|-------------|
| **Unified History** | Changes to child/connected documents are consolidated into the parent's version history |
| **Field-Level Permissions** | Version entries respect user's field-level read permissions |
| **Child Table Changes** | Both regular field changes and child table row changes are extracted and displayed |
| **Label Resolution** | Field names are automatically resolved to human-readable labels |
| **Extensible Filters** | Filter builder can be overridden by downstream apps |
| **Infinite Scroll** | Paginated timeline with lazy loading |

## How It Works

### Custom Fields on Version DocType

Frappe Theme adds two custom fields to the built-in `Version` DocType:

| Field | Type | Purpose |
|-------|------|---------|
| `custom_actual_doctype` | Link | Stores the original DocType of the changed document |
| `custom_actual_document_name` | Data | Stores the original document name |

These fields are defined in `frappe_theme/custom/version.json`.

### Version Redirect Logic

When a Version record is created (via the `validate` hook on the Version DocType), Frappe Theme checks if the changed document belongs to a connected DocType. If so, it **rewrites** the Version's `ref_doctype` and `docname` to point to the parent document, while preserving the original values in the custom fields.

This is handled by `frappe_theme/controllers/timeline.py`:

```
Document Change → Version Created → validate hook fires
    ↓
Is the changed DocType a connected child?
    ↓ YES                          ↓ NO
Rewrite ref_doctype/docname       Leave as-is
to parent document
    ↓
Store original in
custom_actual_doctype/
custom_actual_document_name
```

#### Supported Connection Patterns

The redirect logic handles three categories:

1. **Template DocTypes** — Built-in DocTypes with known reference fields:

   | DocType | DocType Reference Field | Name Reference Field |
   |---------|------------------------|---------------------|
   | File | `attached_to_doctype` | `attached_to_name` |
   | ToDo | `reference_type` | `reference_name` |
   | Notes | `reference_doctype` | `related_to` |

2. **Direct Connections** — Any DocType configured as a Direct connection in SVADatatable Configuration. The Version is redirected using the `link_fieldname` to find the parent document.

3. **SVADatatable Configuration Parents** — If the changed DocType itself is an SVADatatable Configuration parent, versions are left as-is (no redirect needed).

### Result

After redirection, all child document changes appear when viewing the parent document's timeline. For example, if a Task is linked to a Project via Direct connection, changes to that Task will show up in the Project's change log with the label showing it came from the Task DocType.

## VersionUtils API

The `VersionUtils` class in `frappe_theme/utils/version_utils.py` provides the data retrieval layer.

### get_versions()

```python
from frappe_theme.utils.version_utils import VersionUtils

results = VersionUtils.get_versions(
    dt="Project",           # Parent DocType
    dn="PROJ-001",         # Parent document name
    page_length=10,        # Number of results per page
    start=0,               # Offset for pagination
    filters={              # Optional filters
        "doctype": "Task",     # Filter by specific connected DocType
        "owner": "John"        # Filter by user (prefix match)
    }
)
```

**Returns**: List of dicts, each containing:

| Field | Description |
|-------|-------------|
| `custom_actual_doctype` | Original DocType (if redirected) |
| `custom_actual_document_name` | Original document name (if redirected) |
| `ref_doctype` | Parent DocType |
| `owner` | Full name of the user who made the change |
| `creation` | Timestamp of the change |
| `docname` | Parent document name |
| `changed` | JSON array of changes: `[field_label, old_value, new_value, is_child_table, child_table_field, row_name]` |

### build_version_filters()

An extensible method that builds the SQL WHERE clause. Override this in downstream apps to add custom filtering logic:

```python
class CustomVersionUtils(VersionUtils):
    @staticmethod
    def build_version_filters(dt, dn, filters=None):
        where, search, joins, extra_where, params = (
            VersionUtils.build_version_filters(dt, dn, filters)
        )
        # Add custom logic
        extra_where += " AND ver.owner != 'Administrator'"
        return where, search, joins, extra_where, params
```

### Field-Level Permission Filtering

For non-Administrator users, `get_versions()` automatically filters out field changes that the user doesn't have read permission for. This uses Frappe's `get_permitted_fields()` with caching for performance.

## Whitelisted API Endpoints

### get_versions

```python
frappe.call(
    "frappe_theme.api.get_versions",
    dt="Project",
    dn="PROJ-001",
    page_length=10,
    start=0,
    filters={"doctype": "Task"}
)
```

### get_timeline_dt

Returns the list of distinct connected DocTypes that have version entries for a document. Used to populate the DocType filter dropdown in the timeline UI.

```python
frappe.call(
    "frappe_theme.api.get_timeline_dt",
    dt="Project",
    dn="PROJ-001"
)
# Returns: [{"custom_actual_doctype": "Task"}, {"custom_actual_doctype": "File"}, ...]
```

## SVATimelineGenerator (JavaScript)

The frontend timeline renderer is the `SVATimelineGenerator` class in `public/js/custom_components/timeline.bundle.js`.

### Features

- **Change Table**: Each version entry shows a table with field name, old value, and new value columns
- **User Info**: Displays user's full name and creation timestamp
- **Pagination**: Default page length of 10 with infinite scroll (loads more on scroll)
- **Filters**: DocType dropdown and owner search input
- **JSON Formatting**: Complex JSON values are rendered as formatted tables

### Setup

The Timeline component is used via the **Is Custom Design** connection type with the **Timeline** template. No additional configuration is needed beyond the standard setup:

1. Add an **HTML** field to your DocType
2. Configure it via **SVADatatable Configuration** or **Custom Property Setter**:
   - **Connection Type / Property Type**: `Is Custom Design`
   - **Template**: `Timeline`
3. Save

The timeline will automatically display:
- All direct changes to the parent document
- All changes to connected child documents (that have been redirected via the validate hook)
- Filtered by the current user's field-level permissions

## Tips

- The timeline groups changes by Version record, so multiple field changes made in a single save appear together
- Child table row changes include the parent table field label (e.g., "Items > Quantity") for clarity
- The `build_version_filters()` method is designed to be extended — if your downstream app needs custom version filtering, override this static method in a subclass
- Blank values are displayed as "(blank)" for clarity
- The SQL uses a CTE (Common Table Expression) with `JSON_TABLE` for efficient extraction of changes from the Version JSON data
