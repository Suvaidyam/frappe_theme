# Custom Property Setter

The Custom Property Setter is Frappe Theme's **field-level configuration system** for attaching UI components (tables, charts, heatmaps, etc.) to HTML fields. It replaces the older SVADatatable Configuration approach with a simpler, per-field property model.

## Overview

| Aspect | Description |
|--------|-------------|
| **What it does** | Stores component configuration as JSON properties on individual HTML fields |
| **Where it's stored** | Frappe's built-in `Property Setter` DocType with `property = "sva_ft"` |
| **How it's configured** | Via a "Set Property" button on HTML fields in DocType Edit or Customize Form |
| **Virtual DocType** | `Custom Property Setter` — defines the schema for the configuration dialog (no database table) |

## How It Works

```
DocType Edit / Customize Form
    ↓
Click on an HTML field row
    ↓
Click "Set Property" button (added by overwrite_form.bundle.js)
    ↓
Configuration dialog opens with Custom Property Setter fields
    ↓
Select property_type → type-specific fields appear
    ↓
Save → Property Setter record created:
    doc_type = <Your DocType>
    field_name = <HTML field name>
    property = "sva_ft"
    property_type = "JSON"
    value = <JSON configuration>
    ↓
Form loads → overwrite_form reads sva_ft properties
    ↓
Renders the configured component into the HTML field
```

## Property Types

The `property_type` field determines what component the HTML field will render:

| Property Type | Component | Description |
|---------------|-----------|-------------|
| `DocType (Direct)` | SvaDataTable | Table of records with a direct Link field to the parent |
| `DocType (Indirect)` | SvaDataTable | Table linked via matching field values |
| `DocType (Referenced)` | SvaDataTable | Table linked through a reference DocType |
| `DocType (Unfiltered)` | SvaDataTable | Table showing all records (no parent filter) |
| `Report` | SvaDataTable | Report results rendered as a table |
| `Is Custom Design` | Various | Custom templates: Tasks, Email, Timeline, Gallery, Notes, etc. |
| `Number Card` | SVANumberCard | Single number card widget |
| `Dashboard Chart` | Chart widget | Dashboard chart |
| `Heatmap (India Map)` | SVAHeatmap | India state/district map visualization |
| `SDG Wheel` | SDG Wheel | Sustainable Development Goals wheel |
| `Carousel` | SVACarousel | Image/video carousel |
| `DocField` | Field display | Display a specific DocField value |
| `Custom HTML Block` | HTML Block | Renders a Custom HTML Block |

## Step-by-Step Configuration

### Step 1: Open DocType Configuration

Navigate to one of:
- **DocType** edit form (`/app/doctype/<name>`) — for standard DocTypes you control
- **Customize Form** (`/app/customize-form?doctype=<name>`) — for customizing any DocType

### Step 2: Select an HTML Field

Click on an **HTML** type field row in the fields table. The "Set Property" button appears in the field editing area.

### Step 3: Click "Set Property"

This opens the Custom Property Setter dialog with all configuration fields.

### Step 4: Select Property Type

Choose from the `property_type` dropdown. The dialog dynamically shows/hides fields based on your selection:

#### For DocType connections (Direct/Indirect/Referenced/Unfiltered):

| Field | Description |
|-------|-------------|
| **Link DocType** | The child DocType to display |
| **Link Fieldname** | (Direct only) Auto-detected Link field name |
| **Local Field** | (Indirect only) Field on parent DocType |
| **Foreign Field** | (Indirect only) Matching field on child DocType |
| **Referenced Link DocType** | (Referenced only) The intermediate reference DocType |
| **Dt Reference Field** | (Referenced only) DocType field on the reference |
| **Dn Reference Field** | (Referenced only) Document name field on the reference |

#### For Report:

| Field | Description |
|-------|-------------|
| **Link Report** | The Frappe Report to execute |
| **Report Type** | Auto-fetched (Query Report or Script Report) |
| **Unfiltered** | Skip parent-context filtering |

#### For Heatmap (India Map):

| Field | Description |
|-------|-------------|
| **Report** | Report with state/district data column |
| **Default View** | State or District |
| **Target Fields** | Configure via "Setup Target Fields" button |
| **Primary Target** | Column for color gradient |
| **Min/Max Data Color** | Color range for the gradient |
| **Block Height** | Container height in pixels |

#### For Number Card:

| Field | Description |
|-------|-------------|
| **Number Card** | Link to a Frappe Number Card |
| **Label** | Display label |
| **Icon** | Card icon |
| **Card Styling** | Background, text, value, border colors |
| **Hover Effects** | Background, text, value colors on hover |

#### For SDG Wheel:

| Field | Description |
|-------|-------------|
| **Report** | Report providing SDG data |
| **SDG Name Column** | Column containing SDG names |
| **Target Fields** | Configure via "Setup Target Fields" button |
| **Block Height** | Container height in pixels |

### Step 5: Configure Additional Settings

For DocType connections, additional configuration buttons are available:

| Button | Opens Dialog For |
|--------|-----------------|
| **Setup Listview Setting** | Column selection and ordering for the table |
| **Setup Crud Permissions** | Enable/disable read, write, create, delete |
| **Setup List Filters** | Pre-defined filters for the data query |
| **Setup Action List** | Custom actions available on table rows |

Conditional visibility options (JS expressions):

| Field | Description |
|-------|-------------|
| **Disable Add Depends On** | JS expression to hide the Add button |
| **Disable Edit Depends On** | JS expression to disable editing |
| **Disable Delete Depends On** | JS expression to hide delete |
| **Disable Workflow Depends On** | JS expression to hide workflow actions |

### Step 6: Save

The configuration is saved as a `Property Setter` record with:
- `doc_type`: Your DocType name
- `field_name`: The HTML field name
- `property`: `sva_ft`
- `property_type`: `JSON`
- `value`: JSON string containing all configuration

## Comparison: Custom Property Setter vs SVADatatable Configuration

| Aspect | Custom Property Setter | SVADatatable Configuration |
|--------|----------------------|---------------------------|
| **Scope** | Per HTML field | Per DocType (central config) |
| **Storage** | Property Setter records | Dedicated DocType records |
| **UI** | Button on field rows in DocType editor | Separate configuration form |
| **Supports** | All component types (tables, cards, charts, heatmaps, SDG, carousel) | Tables, cards, charts (via tabs) |
| **Migration** | Newer approach | Legacy approach |
| **Coexistence** | Both work simultaneously | Both work simultaneously |

> **Note**: Both systems work simultaneously. The form rendering logic in `overwrite_form.bundle.js` checks both Property Setter (`sva_ft`) and SVADatatable Configuration for each HTML field.

## Under the Hood

### Virtual DocType

The `Custom Property Setter` DocType (`is_virtual: 1`) doesn't have a database table. It serves purely as a schema definition for the configuration dialog. The actual data is stored in standard Frappe `Property Setter` records.

### Form Override

The `customPropertySetter(frm)` function in `overwrite_form.bundle.js` adds the "Set Property" button when editing DocType or Customize Form. It:

1. Detects when the form is a DocType or Customize Form
2. Adds a "Set Property" button to HTML field rows
3. Opens a dialog using the Custom Property Setter DocType fields
4. Loads existing `sva_ft` Property Setter values if they exist
5. Saves the configuration as a Property Setter on submit

### Field Changes Handlers

The `field_changes` object in `property_setter.js` handles dynamic UI updates when property_type or connection_type changes. For example:
- Selecting "DocType (Direct)" auto-populates connection_type as "Direct" and shows the Link DocType field
- Selecting "Heatmap (India Map)" shows heatmap-specific fields (report, colors, target fields)
- Changing the Link DocType auto-detects the link fieldname for Direct connections

## Tips

- Custom Property Setter is the recommended approach for new setups — it's simpler and doesn't require creating a separate configuration record
- The "Set Property" button only appears on HTML-type fields since only HTML fields can host visual components
- You can configure multiple HTML fields on the same DocType, each with a different property_type
- For Dashboard Mode (see [Dashboard Mode](dashboard-mode.md)), Custom Property Setter is the primary configuration method
- The configuration dialog includes all the same options as SVADatatable Configuration (CRUD permissions, listview settings, filters, actions, conditional visibility)
