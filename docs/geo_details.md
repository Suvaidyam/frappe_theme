---
name: geo-details
description: Reusable geo/map component for displaying locations on Leaflet maps. Use when adding geo tagging, location maps, or coordinate visualization to any Frappe page. Covers single-location mode (response details), multi-location mode (dashboards with marker clustering), maximize/fullscreen, reverse geocoding, and marker click dialogs with SvaDataTable.
---

# GeoDetails — Reusable Geo/Map Component

A self-contained vanilla JS class that renders Leaflet maps with single or multiple markers, built-in maximize/fullscreen, reverse geocoding via Nominatim, and marker click dialogs with SvaDataTable integration.

## Key Files

- `frappe_theme/public/js/vue/geo_details/geo_details.bundle.js` — Core class (`frappe.ui.GeoDetails`)
- `mform_integration/.../page/response_details/response_details.js` — Consumer: single-location mode
- `mform_integration/.../page/form_dashboard/form_dashboard.js` — Consumer: multi-location mode

## How It Works

1. Consumer creates a placeholder `<div>` in the page HTML
2. Consumer calls `frappe.require("geo_details.bundle.js")` to load the bundle
3. Instantiate `new frappe.ui.GeoDetails({ wrapper, ... })` with options
4. GeoDetails renders internally: header (title + maximize button), map, footer (village + coordinates)
5. Mode is auto-detected: `coords` option = single mode, `groups` option = multi mode
6. In single mode: one marker, `setView` at zoom level, optional reverse geocode for village name
7. In multi mode: multiple markers with `fitBounds`, marker click opens location dialog (reverse geocode + SvaDataTable)
8. Maximize button opens a fullscreen `frappe.ui.Dialog` with a cloned map instance
9. `destroy()` cleans up map and DOM

## Usage — Single Location (Response Details)

```javascript
// HTML placeholder
`<div class="mform-detail-card"><div id="response-geo-container"></div></div>`

// Initialize
frappe.require("geo_details.bundle.js", () => {
    wrapper._response_map = new frappe.ui.GeoDetails({
        wrapper: document.getElementById('response-geo-container'),
        coords: { lat: 23.0225, lng: 72.5714 },
        title: 'Household Geo Tagging',
        maximizeTitle: 'Household Geo Tagging',
        height: 250,
        zoom: 15,
        showMaximize: true,
        showFooter: true,    // shows village name + coordinates below map
    });
});

// Cleanup (on page re-render or navigation)
if (wrapper._response_map) {
    wrapper._response_map.destroy();
    wrapper._response_map = null;
}
```

## Usage — Multiple Locations (Dashboard)

```javascript
// Build groups from result data
let groups = {};
result.forEach((row) => {
    if (row.latitude && row.longitude) {
        let key = row.latitude + "," + row.longitude;
        if (!groups[key]) {
            groups[key] = { lat: row.latitude, lng: row.longitude, records: [] };
        }
        groups[key].records.push(row);
    }
});

// Initialize
frappe.require("geo_details.bundle.js", () => {
    new frappe.ui.GeoDetails({
        wrapper: document.getElementById("mform-geo-map"),
        groups: groups,
        doctype: doctype,           // used for marker click dialog table
        title: "Geographical Reach",
        maximizeTitle: "Geographical Reach",
        height: 390,
        showMaximize: true,
    });
});
```

## Usage — Custom HTML Block Placeholder

In Custom HTML Block templates, use `<div id="household-geo"></div>` as a placeholder. The consumer (e.g., `response_details.js`) detects this div and initializes GeoDetails inside it:

```javascript
let $geo = $(page.body).find('#household-geo');
if ($geo.length) {
    let geo_html = build_geo_section(doc, fields);
    if (geo_html) {
        $geo.html(geo_html);
        let coords = parse_coordinates(doc, fields);
        if (coords) {
            init_geo_map(wrapper, coords);
        }
    }
}
```

## Constructor Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `wrapper` | HTMLElement/jQuery | *required* | Container element to render into |
| `coords` | `{ lat, lng }` | `null` | Single location — triggers single mode |
| `groups` | `{ "lat,lng": { lat, lng, records[] } }` | `{}` | Multiple locations — triggers multi mode |
| `doctype` | string | `""` | DocType name for marker click dialog (multi mode) |
| `title` | string | `""` | Title text shown in header above map |
| `height` | number/null | `250` | Map height in px. `null` = inherit from parent CSS |
| `zoom` | number | `15` | Zoom level (single mode only) |
| `scrollWheelZoom` | boolean | `true` | Enable scroll wheel zoom on map |
| `showMaximize` | boolean | `true` | Show maximize/expand button in header |
| `maximizeTitle` | string | `title` or `"Geo Tagging"` | Dialog title for fullscreen view |
| `showFooter` | boolean | `false` | Show village name + coordinates below map (single mode only) |
| `onMarkerClick` | Function | `null` | Custom marker click handler `(group) => {}` — overrides default location dialog |
| `fitBoundsPadding` | `[number, number]` | `[30, 30]` | Padding for `fitBounds` (multi mode) |

## Mode Detection

- **Single mode**: `coords` is provided → one marker, `setView`, optional footer with reverse geocode
- **Multi mode**: `groups` is provided (no `coords`) → multiple markers, `fitBounds`, marker click dialog

## Built-in Features

### Maximize / Fullscreen
- Renders an expand button (`frappe.utils.icon("expand")`) in the header row next to the title
- Opens a `frappe.ui.Dialog` made fullscreen via `frappe.utils.make_dialog_fullscreen(dlg)`
- Creates a new GeoDetails instance inside the dialog (with `showMaximize: false`)
- Auto-destroys the cloned instance on dialog hide

### Reverse Geocoding (Single Mode)
- When `showFooter: true`, calls Nominatim API: `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json`
- Extracts village/town/city/county from response
- Displays as "Village: {name} | Coordinates: {lat}, {lng}" below the map

### Marker Click Dialog (Multi Mode)
- Default behavior when `onMarkerClick` is not provided
- Opens `frappe.ui.Dialog` with:
  - SvaDataTable filtered to records at that location (`name IN [...]`)
  - Location card with reverse geocoded address and record count
- Override with custom `onMarkerClick: (group) => { ... }` callback

### Cleanup
```javascript
// Always call destroy() before re-rendering or navigating away
geoInstance.destroy();  // removes Leaflet map + clears wrapper innerHTML
```

## Dependencies

- **Leaflet.js** (`L`) — must be available globally (loaded by Frappe)
- **frappe.ui.Dialog** — for maximize and location dialogs
- **frappe.ui.SvaDataTable** (`sva_datatable.bundle.js`) — for marker click dialog table (multi mode, loaded dynamically via `frappe.require`)
- **OpenStreetMap tiles** — `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Nominatim API** — for reverse geocoding (no API key needed, rate-limited)

## Coordinate Parsing Pattern

Standard pattern for extracting coordinates from a doc's `coordinates` field:

```javascript
function parse_coordinates(doc, fields) {
    let has_coords = fields.some(f => f.fieldname === 'coordinates');
    if (!has_coords || !doc.coordinates) return null;
    let parts = String(doc.coordinates).split(',');
    if (parts.length === 2) {
        let lat = parseFloat(parts[0].trim());
        let lng = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
}
```

## Important Notes

- No `hooks.py` changes needed — loaded dynamically via `frappe.require("geo_details.bundle.js")`
- Requires `bench build --app frappe_theme` after changes to the bundle
- The class is exported as `frappe.ui.GeoDetails` (global namespace)
- Wrapper element must exist in DOM before instantiation
- Uses `setTimeout(() => ..., 0)` internally for map initialization (ensures DOM is ready)
- For maximize dialog, uses `setTimeout(() => ..., 200)` to allow dialog animation
- Map container gets a unique ID: `"geo-map-" + frappe.utils.get_random(8)`
- Always store the instance reference for cleanup: `wrapper._response_map = new frappe.ui.GeoDetails(...)`
