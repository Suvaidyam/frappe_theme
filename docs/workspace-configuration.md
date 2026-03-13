# Workspace Configuration

The **SVAWorkspace Configuration** DocType lets you embed interactive heatmaps and data tables directly into Frappe workspace pages.

## Overview

Each SVAWorkspace Configuration is tied to a specific Workspace and defines:

- **Heatmaps**: India state/district map visualizations (see [India Heatmap](india-heatmap.md))
- **Tables**: SvaDatatable instances showing DocType records in the workspace

## Step-by-Step Setup

### Step 1: Create a Custom HTML Block

Workspace widgets render inside Frappe's **Custom HTML Block** elements:

1. Navigate to **Custom HTML Block** (`/app/custom-html-block`)
2. Click **+ Add Custom HTML Block**
3. Give it a name (e.g., `Project Dashboard Table`)
4. Leave the HTML content empty — the component will populate it
5. Save

### Step 2: Add the Block to Your Workspace

1. Navigate to the workspace you want to customize
2. Click **Edit** on the workspace
3. Add a new **Custom Block** widget
4. Select the Custom HTML Block you created
5. Position it where you want the widget to appear
6. Save the workspace

### Step 3: Create SVAWorkspace Configuration

1. Navigate to `/app/svaworkspace-configuration`
2. Click **+ Add SVAWorkspace Configuration**
3. Set **Workspace** to the target workspace
4. Save

> Each workspace can have only one configuration (auto-named by workspace name).

### Step 4: Add Heatmaps (Optional)

See [India Heatmap](india-heatmap.md) for detailed heatmap configuration.

In the **Heatmaps** table, add rows with:

| Field | Required | Description |
|-------|----------|-------------|
| Custom Block | Yes | Link to the Custom HTML Block |
| Report | Yes | The report providing geographic data |
| Default View | Yes | `State` or `District` |
| Primary Target | Yes | Numeric column for color coding |
| Target Fields | — | Additional columns for popups |
| Label | — | Display label |
| Block Height (px) | — | Container height |
| Min Data Color | — | Color for lowest values |
| Max Data Color | — | Color for highest values |

### Step 5: Add Tables (Optional)

Switch to the **Tables** tab and add rows in the **Tables** child table. Each row configures a SvaDatatable to render in the workspace.

The SVAWorkspace DT Child fields work similarly to SVADatatable Configuration Child — specify the Custom HTML Block, the DocType to display, connection settings, and table preferences.

## How It Works

### Boot-Time Loading

Workspace configurations are loaded at **boot time** via the `boot_theme` hook:

```python
# In boot.py
bootinfo.sva_workspaces = {
    "Workspace Name": workspace_config_dict,
    ...
}
```

This means the configuration is available immediately when a workspace page loads, without additional API calls.

### Client-Side Rendering

When a workspace page loads, the `sva_workspace.bundle.js` script:

1. Checks if the current workspace has an SVAWorkspace Configuration in `frappe.boot.sva_workspaces`
2. Finds the matching Custom HTML Blocks on the page
3. Instantiates `SVAHeatmap` or `SvaDataTable` components in each block
4. Passes the configuration options from the boot data

## Tips

- Workspace configurations are loaded once at boot time — changes require a page refresh
- You can combine heatmaps and tables on the same workspace
- Each Custom HTML Block can only hold one component (one heatmap or one table)
- The workspace name must exactly match — create the configuration using the Link field to ensure accuracy
