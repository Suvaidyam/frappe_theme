# India Heatmap

Display interactive, color-coded maps of India at state or district level, powered by **Leaflet.js** and GeoJSON boundary data. Heatmaps visualize report data geographically and can be embedded in **Workspaces** or **DocType forms**.

## Overview

- Toggle between **State** and **District** views
- Color gradient based on data values (configurable min/max colors)
- Click on a state/district to see detailed popup data
- Legend display showing the color scale
- Supports multiple target fields (primary + additional)
- Integrates with Frappe Reports for data

## Coverage

The app includes GeoJSON boundary data for all **36 Indian States and Union Territories**:

Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chandigarh, Chhattisgarh, Delhi, Goa, Gujarat, Haryana, Himachal Pradesh, Jammu & Kashmir, Jharkhand, Karnataka, Kerala, Lakshadweep, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Puducherry, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal, Andaman & Nicobar Islands, Dadra & Nagar Haveli, Ladakh.

## Using Heatmaps in Workspaces

### Step 1: Create a Report

Create a Frappe Report that returns state or district-level data. The report must have:

- A column containing **state names** (must match GeoJSON state names)
- One or more **numeric columns** for the heatmap values

Example report output:

| State | Beneficiary Count | Total Amount |
|-------|-------------------|--------------|
| Maharashtra | 1500 | 2500000 |
| Gujarat | 800 | 1200000 |
| Karnataka | 650 | 980000 |

### Step 2: Create a Custom HTML Block

1. Navigate to **Custom HTML Block** (`/app/custom-html-block`)
2. Create a new block (e.g., `State Heatmap Block`)
3. Leave the HTML content empty — the heatmap component will populate it
4. Save

### Step 3: Add the Block to Your Workspace

1. Edit your target workspace
2. Add a **Custom Block** widget
3. Select the Custom HTML Block you just created
4. Save the workspace

### Step 4: Create SVAWorkspace Configuration

1. Navigate to **SVAWorkspace Configuration** (`/app/svaworkspace-configuration`)
2. Create a new record
3. Set **Workspace** to your target workspace

### Step 5: Add Heatmap Entry

In the **Heatmaps** table, add a row:

| Field | Required | Description |
|-------|----------|-------------|
| **Custom Block** | Yes | Link to the Custom HTML Block created in Step 2 |
| **Report** | Yes | Link to the Frappe Report created in Step 1 |
| **Default View** | Yes | `State` or `District` — the initial map view |
| **Primary Target** | Yes | Select the numeric column from the report to color-code the map |
| **Target Fields** | — | Click "Setup Target Fields" to select additional numeric columns shown in popups |
| **Label** | — | Custom label for the heatmap |
| **Block Height (px)** | — | Height of the map container (default varies) |
| **Min Data Color** | — | Color for the lowest value in the gradient (e.g., light yellow `#ffeda0`) |
| **Max Data Color** | — | Color for the highest value in the gradient (e.g., dark red `#800026`) |

Save the configuration. The heatmap will now render in your workspace.

### Step 6: Configure Target Fields

Click the **"Setup Target Fields"** button to open a dialog where you can select which report columns to display in the map popup. The primary target determines the color gradient, while additional target fields provide supplementary data in popups.

## Using Heatmaps in DocType Forms

You can also embed heatmaps inside DocType forms using an SVADatatable Configuration with a **Report** connection type:

1. Add an **HTML** field to the DocType form
2. Create/open the **SVADatatable Configuration** for that DocType
3. Add a child entry with:
   - **HTML Field**: your HTML field
   - **Connection Type**: `Report`
   - **Link Report**: your geographic report

The heatmap will render inside the form when the report returns geographic data.

## Report Requirements

For the heatmap to work correctly, your report must:

1. **Return a column with state or district names** — the names must match the GeoJSON boundary data
2. **Return at least one numeric column** — used for the color gradient
3. **Be accessible to the user** — the user must have permission to run the report

### State Name Matching

State names in your report should match the standard names used in the GeoJSON data. Common names like "Maharashtra", "Gujarat", "Delhi", etc. are supported. The component handles common variations.

## JavaScript API (Advanced)

For programmatic usage:

```javascript
new SVAHeatmap({
    wrapper: document.getElementById('map-container'),
    report: 'Sales by State',
    html_field: 'map_html',
    frm: cur_frm,
    default_view: 'State',         // or 'District'
    block_height: 445,
    primary_target: 'total_sales',
    target_fields: JSON.stringify(['count', 'avg_amount']),
    state_name_column: 'state',
    min_data_color: '#ffeda0',     // Light yellow
    max_data_color: '#800026',     // Dark red
    filters: {},
    standard_filters: {}
});
```

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `wrapper` | HTMLElement | Container element for the map |
| `report` | String | Name of the Frappe Report |
| `html_field` | String | Name of the HTML field |
| `frm` | Object | Frappe form object |
| `default_view` | String | `"State"` or `"District"` |
| `block_height` | Number | Map container height in pixels |
| `primary_target` | String | Column name for color gradient |
| `target_fields` | String (JSON) | Additional columns for popup display |
| `state_name_column` | String | Column name containing state/district names |
| `min_data_color` | String | Hex color for minimum values |
| `max_data_color` | String | Hex color for maximum values |
| `filters` | Object | Additional report filters |
| `standard_filters` | Object | Standard filter overrides |

## Tips

- Choose contrasting min/max colors for better readability (e.g., light-to-dark gradient)
- The District view loads additional GeoJSON files, so the first load may take slightly longer
- Clicking on a state in State view can drill down to District view for that state
- The heatmap auto-resizes to fit its container
