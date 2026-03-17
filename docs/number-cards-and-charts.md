# Number Cards & Charts

Embed Frappe **Number Cards** and **Dashboard Charts** directly inside DocType form tabs using HTML fields. These are configured through the same **SVADatatable Configuration** DocType used for tables.

## Overview

- **Number Cards** show aggregated values (sum, count, average, etc.) from related data
- **Dashboard Charts** show visual charts (line, bar, pie, donut, etc.) from Frappe Dashboard Charts
- Both render inside HTML fields in the DocType form
- Both support custom styling, icons, and visibility control

## Prerequisites

Before configuring number cards or charts:

1. An **SVADatatable Configuration** must exist for the target DocType (see [SvaDatatable](sva-datatable.md) Step 2)
2. One or more **HTML fields** must exist in the target DocType form
3. For number cards: Frappe **Number Cards** must be created (or use DocField mode)
4. For charts: Frappe **Dashboard Charts** must be created

## Number Cards

### Step-by-Step Configuration

1. Open the **SVADatatable Configuration** for your target DocType
2. Go to the **Number Cards** tab
3. Click **Add Row** in the Number Cards table
4. Fill in the fields:

| Field | Required | Description |
|-------|----------|-------------|
| **HTML Field** | Yes | Select which HTML field in the form to render this card into |
| **Fetch From** | — | Choose `Number Card` (default) to use a Frappe Number Card, or `DocField` to display a field value from the current document |
| **Number Card** | When Fetch From = Number Card | Link to a Frappe Number Card |
| **Field** | When Fetch From = DocField | Select a field from the parent DocType whose value to display |
| **Card Label** | Yes (for DocField) | Display label for the card |
| **Info** | — | Tooltip text shown when hovering the info icon |
| **Sequence** | — | Order of cards (lower numbers appear first) |
| **Is Visible** | — | Toggle card visibility (default: checked) |

5. Save the configuration

### Styling Options

Each card supports custom colors for both normal and hover states:

**Icon Settings:**

| Field | Description |
|-------|-------------|
| Icon | Choose a FontAwesome icon |
| Icon Color | Color of the icon |

**Style Settings:**

| Field | Description |
|-------|-------------|
| Background Color | Card background |
| Label Color | Color of the card label text |
| Value Color | Color of the numeric value |

**Hover Effects:**

| Field | Description |
|-------|-------------|
| Hover Background Color | Card background on mouse hover |
| Hover Label Color | Label color on hover |
| Hover Value Color | Value color on hover |

### Example: Adding Sales Summary Cards

1. Create Number Cards in Frappe:
   - `Total Sales` (Sum of `grand_total` from Sales Invoice)
   - `Invoice Count` (Count of Sales Invoice)
   - `Average Sale` (Average of `grand_total` from Sales Invoice)

2. Add an HTML field `sales_summary_html` to Customer DocType

3. Create SVADatatable Configuration for Customer (if not exists)

4. In Number Cards tab, add three rows:
   - HTML Field: `sales_summary_html`, Number Card: `Total Sales`, Label: "Total Sales", Icon: money-bill
   - HTML Field: `sales_summary_html`, Number Card: `Invoice Count`, Label: "Invoices", Icon: file-invoice
   - HTML Field: `sales_summary_html`, Number Card: `Average Sale`, Label: "Avg. Sale", Icon: chart-line

5. Save — cards appear in the Customer form

### Features

- **Batch Processing**: Network requests are batched in 1-second windows for performance
- **Caching**: Card data is cached for 5 minutes with automatic invalidation on refresh
- **Skeleton Loading**: Cards show a shimmer animation while data loads
- **Indian Number Formatting**: Values are formatted with K, L (Lakh), Cr (Crore) abbreviations
- **Refresh**: Each card has a dropdown menu with a refresh option
- **Responsive**: Cards use a flex-based grid layout that adapts to screen size

## Dashboard Charts

### Step-by-Step Configuration

1. Create a **Dashboard Chart** in Frappe first:
   - Navigate to `/app/dashboard-chart/new`
   - Set the chart type (e.g., Count, Sum, Average)
   - Select the DocType and fields
   - Configure filters and time period
   - Save

2. Open the **SVADatatable Configuration** for your target DocType

3. Go to the **Charts** tab

4. Click **Add Row** in the Charts table

5. Fill in the fields:

| Field | Required | Description |
|-------|----------|-------------|
| **HTML Field** | Yes | Select which HTML field to render the chart into |
| **Dashboard Chart** | Yes | Link to the Frappe Dashboard Chart |
| **Chart Label** | — | Custom label (overrides the Dashboard Chart name) |
| **Sequence** | — | Order of charts (lower numbers appear first) |
| **Is Visible** | — | Toggle chart visibility (default: checked) |

6. Save

### Chart Styling

| Field | Default | Description |
|-------|---------|-------------|
| Background Color | — | Chart container background |
| Text Color | — | Chart title and label text color |
| Border Color | — | Chart container border color |
| Chart Height (px) | 300 | Height of the chart canvas |
| Show Legend | Yes | Display the chart legend |

### Supported Chart Types

The extended chart component supports all Frappe chart types:

| Type | Description |
|------|-------------|
| Line | Line chart with data points |
| Bar | Vertical bar chart |
| Percentage | Percentage bar |
| Pie | Pie chart (up to 6 slices) |
| Donut | Donut chart (up to 6 slices) |
| Heatmap | Date-based heatmap (annual view) |

Charts support smart tooltip formatting based on the field type — Currency, Float, Int, and Percent fields are each formatted appropriately.

### Chart Color Generation

Chart colors are automatically generated from the **navbar color** set in My Theme. The app creates a harmonious palette by lightening the base color into multiple shades, ensuring visual consistency with your theme.

## Multiple Cards and Charts on One Form

You can render multiple number cards and charts on the same form by:

- Using the **same HTML field** — multiple cards/charts will render in the same container
- Using **different HTML fields** — cards/charts will appear in different sections/tabs

This lets you create rich dashboards within any DocType form. For example, a Project form could have:

- Tab 1: Tasks table (SvaDatatable)
- Tab 2: Number cards (Total Tasks, Completed, Overdue) + Charts (Task Status Distribution, Timeline)

## Dashboard Manager

Behind the scenes, the **SVADashboardManager** JavaScript class orchestrates number cards and charts:

- Manages component lifecycle and cleanup
- Handles request cancellation via AbortController
- Applies debounced updates (250ms default) to avoid excessive re-renders
- Creates memoized containers for each HTML field

This is handled automatically — no manual interaction needed.
