# Dashboard Mode

Frappe Theme can turn any **Single DocType** into a full dashboard with number cards, charts, heatmaps, SDG wheels, and custom HTML blocks — all rendered inside the form view without writing any frontend code.

## Overview

| Feature | Description |
|---------|-------------|
| **Dashboard Layout** | Hides standard form chrome (sidebar, actions, comments) and renders a clean dashboard |
| **Component Support** | Number Cards, Dashboard Charts, Heatmaps, SDG Wheels, Custom HTML Blocks |
| **Filter Support** | Form fields can act as dashboard filters with Apply/Reset buttons |
| **Refresh** | Dashboard header with a Refresh button to re-render all components |
| **Permission-Aware** | Components respect user's DocType read permissions |

## How It Works

```
Single DocType with is_dashboard = 1
    ↓
Form loads → overwrite_form.bundle.js detects is_dashboard
    ↓
dashboard_header_handlers(frm):
  - Hides page actions, sidebar, comment box, breadcrumb controls
  - Adds dashboard header with title + Refresh button
    ↓
dashboard_form_events_handler(frm):
  - Finds fields with is_apply_button property
  - Adds Apply/Reset filter buttons
    ↓
initializeDashboards():
  - Reads sva_ft Property Setter configs for each HTML field
  - Initializes components: SVANumberCard, Chart, SVAHeatmap, SDG Wheel
  - Renders into respective HTML fields
```

## Step-by-Step Setup

### Step 1: Create a Single DocType

1. Navigate to **DocType** > **New**
2. Set the DocType name (e.g., "Project Dashboard")
3. Check **Is Single** — this is required for dashboard mode
4. Add **HTML fields** for each dashboard component you want
5. Optionally add filter fields (Select, Link, Date, etc.) for interactive filtering
6. Save

Example field layout:

| Field Name | Field Type | Purpose |
|------------|-----------|---------|
| `cards_html` | HTML | Number cards row |
| `chart_html` | HTML | Dashboard chart |
| `map_html` | HTML | India heatmap |
| `sdg_html` | HTML | SDG wheel |
| `status_filter` | Select | Filter control |
| `date_filter` | Date | Filter control |

### Step 2: Enable Dashboard Mode

Add the `is_dashboard` property to the DocType:

1. Open the DocType in Edit mode
2. Add a custom property `is_dashboard` = `1` at the DocType level (via Property Setter or DocType JSON)

Alternatively, set it via bench console:

```python
import frappe

frappe.get_doc({
    "doctype": "Property Setter",
    "doctype_or_field": "DocType",
    "doc_type": "Project Dashboard",
    "property": "is_dashboard",
    "property_type": "Check",
    "value": "1"
}).insert()
frappe.db.commit()
```

### Step 3: Configure Components via Custom Property Setter

For each HTML field, configure what component it should render using [Custom Property Setter](custom-property-setter.md):

1. Open the DocType in Edit mode or Customize Form
2. Click on an HTML field row
3. Click **"Set Property"**
4. Select the appropriate `property_type` and configure

#### Number Card Example

| Setting | Value |
|---------|-------|
| Property Type | `Number Card` |
| Number Card | Select a Frappe Number Card (e.g., "Total Projects") |
| Label | "Active Projects" |
| Icon | `fa-project-diagram` |
| Background Color | `#f0f9ff` |
| Text Color | `#1e3a5f` |
| Value Color | `#0066cc` |

#### Dashboard Chart Example

| Setting | Value |
|---------|-------|
| Property Type | `Dashboard Chart` |
| Chart | Select a Dashboard Chart (e.g., "Monthly Sales") |
| Label | "Sales Trend" |

#### Heatmap Example

| Setting | Value |
|---------|-------|
| Property Type | `Heatmap (India Map)` |
| Report | Select a Report with state/district column |
| Default View | `State` |
| Primary Target | Column name for color gradient |
| Target Fields | Configure via "Setup Target Fields" |
| Min Data Color | `#ffeda0` |
| Max Data Color | `#800026` |

#### SDG Wheel Example

| Setting | Value |
|---------|-------|
| Property Type | `SDG Wheel` |
| Report | Select a Report with SDG data |
| SDG Name Column | Column containing SDG names |
| Target Fields | Configure via "Setup Target Fields" |

#### Custom HTML Block Example

| Setting | Value |
|---------|-------|
| Property Type | `Custom HTML Block` |
| HTML Block | Select a Custom HTML Block |

### Step 4: Configure Filters (Optional)

To make form fields act as dashboard filters:

1. Add non-HTML fields (Select, Link, Date, etc.) to the DocType
2. Set the `is_apply_button` property on these fields via Property Setter
3. When the dashboard loads, Apply and Reset buttons appear automatically
4. Users can set filter values and click Apply to refresh all components with the filter context

### Step 5: Save and Test

1. Save the DocType
2. Navigate to the Single DocType form (`/app/project-dashboard`)
3. The form renders as a dashboard with all configured components

## Dashboard Behavior

### What Changes in Dashboard Mode

When `is_dashboard` is enabled, the form view is modified:

| Element | Behavior |
|---------|----------|
| Page Actions | Hidden |
| Sidebar | Hidden |
| Comment Box | Hidden |
| Breadcrumb Controls | Simplified |
| Form Header | Replaced with dashboard header (title + Refresh button) |
| Save Button | Hidden (Single DocType auto-saves filter state) |

### Refresh Button

The dashboard header includes a **Refresh** button that:
1. Cancels any in-flight requests (via AbortController)
2. Re-renders all dashboard components with current filter values
3. Fetches fresh data from APIs/reports

### Filter Flow

```
User sets filter field values
    ↓
Clicks "Apply" button
    ↓
Filter values collected from form fields
    ↓
Each component re-initialized with new filters
    ↓
Components fetch fresh data with filter context
```

Clicking "Reset" clears all filter fields and refreshes components without filters.

## Complete Example

### Creating a Sales Dashboard

1. **Create the DocType**:
   - Name: "Sales Dashboard"
   - Is Single: Yes
   - Fields:
     - `region_filter` (Select: North, South, East, West)
     - `date_from` (Date)
     - `total_sales_html` (HTML)
     - `sales_chart_html` (HTML)
     - `sales_map_html` (HTML)

2. **Enable Dashboard Mode**:
   ```python
   # In bench console
   frappe.get_doc({
       "doctype": "Property Setter",
       "doctype_or_field": "DocType",
       "doc_type": "Sales Dashboard",
       "property": "is_dashboard",
       "property_type": "Check",
       "value": "1"
   }).insert()
   ```

3. **Configure Components**:
   - Set Property on `total_sales_html` → Number Card → link to "Total Sales" Number Card
   - Set Property on `sales_chart_html` → Dashboard Chart → link to "Monthly Sales" chart
   - Set Property on `sales_map_html` → Heatmap (India Map) → link to "Sales by State" report

4. **Enable Filters**:
   - Set `is_apply_button` property on `region_filter` and `date_from` fields

5. **Navigate to `/app/sales-dashboard`** — the dashboard renders with all components, filter controls, and a refresh button.

## Tips

- Dashboard mode only works with **Single DocTypes** — it checks `frm.meta.issingle && frm.meta.is_dashboard`
- Multiple components of the same type are supported (e.g., 5 number cards across different HTML fields)
- The AbortController ensures that navigating away or refreshing cancels pending API requests
- Component rendering order follows the field order in the DocType definition
- For detailed component configuration options, see [Custom Property Setter](custom-property-setter.md)
- Heatmap and SDG Wheel require reports that return appropriately structured data (see [India Heatmap](india-heatmap.md))
