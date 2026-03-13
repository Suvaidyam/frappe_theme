# Frappe Theme — AI Context

A Frappe Framework utility app by Suvaidyam that extends desk/web interfaces with advanced UI components, data visualization, theme customization, and security features — all configurable without code.

## Tech Stack

- **Backend**: Python 3.10+, Frappe Framework v14+ (v15 recommended)
- **Frontend**: Vanilla JS + Vue.js components, bundled via Frappe's asset pipeline
- **Database**: MariaDB/MySQL (uses JSON_TABLE, CTEs)
- **Build**: `bench build --app frappe_theme`
- **Tests**: `bench run-tests --app frappe_theme`
- **Linting**: ruff (Python), eslint + prettier (JS) via pre-commit

## Architecture Overview

This is a **Frappe app** — it follows Frappe's module/doctype/hooks architecture. Key entry points:

```
frappe_theme/
├── hooks.py                # App hooks — JS/CSS includes, doc_events, overrides
├── boot.py                 # Boot-time init (extend_bootinfo)
├── api.py                  # Main whitelisted API endpoints
├── dt_api.py               # DataTable/Report API endpoints (critical data layer)
├── wp_api.py               # Workspace API endpoints
├── apis/                   # Specialized API modules
│   ├── approval_timeline.py
│   ├── export_json.py
│   ├── meta.py
│   ├── sva_property_setter.py
│   ├── public_api.py
│   ├── doc_pdf.py
│   └── file_manager.py
├── controllers/            # Business logic
│   ├── dt_conf.py          # DTConf class — core data fetching engine
│   ├── chart.py            # Chart data provider
│   ├── number_card.py      # Number card aggregation
│   ├── filters.py          # DTFilters — filter validation and merging
│   └── sva_integrations/   # Cloud storage (S3, Azure)
├── overrides/              # Frappe class/method overrides
│   ├── workflow.py         # Custom approval workflows
│   └── report.py           # Report behavior overrides
├── utils/
│   ├── version_utils.py    # VersionUtils — change log with field-level perms
│   ├── data_protection.py  # Fernet encryption and field masking
│   ├── global_sanitizer.py # XSS protection on all doctypes
│   ├── jinja_methods.py    # Jinja template helpers
│   └── sql_builder.py      # Parameterized SQL builder
├── frappe_theme/doctype/   # DocType definitions (JSON + Python)
└── public/                 # Frontend assets
    ├── js/
    │   ├── overwrite_form.bundle.js     # Form customization + dashboard mode (1434 lines, critical)
    │   ├── sva_dashboard_manager.bundle.js  # Dashboard component lifecycle
    │   ├── datatable/                   # SvaDataTable component
    │   ├── custom_components/           # Heatmap, Gallery, Timeline, etc.
    │   ├── vue/                         # Vue.js components
    │   ├── filters/                     # Filter UI components
    │   ├── doctype/property_setter.js   # Custom Property Setter dialog (1064 lines)
    │   ├── doctype/customize_form.js    # Customize Form overrides
    │   └── svadb.js                     # SVAHTTP — HTTP client with AbortController
    ├── css/
    └── boundaries/                      # GeoJSON for India heatmap
```

## Key DocTypes

| DocType | Type | Purpose |
|---------|------|---------|
| `My Theme` | Singleton | App-wide theme config, `is_dashboard` prop |
| `SVADatatable Configuration` | Regular | Configure tables/cards/charts per DocType |
| `SVAWorkspace Configuration` | Regular | Heatmaps/tables in workspaces |
| `Custom Property Setter` | **Virtual** (no DB table) | Schema for field-level config dialog |
| `SVAProperty Setter` | Regular | Data protection and field masking |
| `SVADT Connections` | Virtual | Connection settings for linked DocTypes |
| `SVADT User Listview Settings` | Regular | Per-user column preferences |

## Critical Data Flow Patterns

### 1. DTConf — Data Fetching Engine (dt_api.py + controllers/dt_conf.py)

All data table and report data goes through `get_dt_list()`:

```
Frontend SvaDataTable → frappe.call("frappe_theme.dt_api.get_dt_list")
    → DTConf.check_list_permissions()
    → DTConf.get_dt_list(options)
        → report_list() for Reports (Query Report or Script Report)
        → doc_type_list() for DocTypes (uses frappe.get_list)
    → DTFilters validates all filters against field metadata
    → Returns {data, columns, total_count}
```

Connection types: Direct, Indirect, Referenced, Unfiltered, Report.

### 2. Custom Property Setter (sva_ft JSON)

Configuration stored as Property Setter with `property = "sva_ft"` and JSON value:

```
DocType Editor → Click HTML field → "Set Property" button
    → Dialog from Custom Property Setter virtual DocType fields
    → Saves to Property Setter: {doc_type, field_name, property: "sva_ft", value: JSON}
    → Form load: overwrite_form.bundle.js reads sva_ft → renders component
```

### 3. Dashboard Mode (is_dashboard on Single DocType)

```
Single DocType with is_dashboard = 1
    → overwrite_form.bundle.js detects frm.meta.issingle && frm.meta.is_dashboard
    → dashboard_header_handlers(): hides form chrome, adds refresh button
    → dashboard_form_events_handler(): sets up filter Apply/Reset
    → handleBlocks(): renders Number Cards, Charts, Heatmaps, SDG Wheels
    → SVADashboardManager orchestrates lifecycle
```

### 4. Change Log / Version Tracking (utils/version_utils.py)

```
Document change → Version created → validate hook fires
    → Redirects child doc versions to parent (custom_actual_doctype/document_name)
    → VersionUtils.get_versions(): SQL with JSON_TABLE extracts changes
    → Field-level permission filtering via get_permitted_fields()
    → Returns filtered change history
```

## Coding Conventions

- **Python APIs**: Always use `@frappe.whitelist()` decorator. Use `frappe.get_list()` for permission-safe queries.
- **SQL**: Use parameterized queries (`%s` placeholders) via `frappe.db.sql()`. Never string-interpolate user input.
- **Frontend bundles**: Named `*.bundle.js` in `public/js/`, auto-built by Frappe's asset pipeline. Registered in `hooks.py` under `app_include_js`.
- **DocType JS**: Registered in `hooks.py` under `doctype_js` dict (e.g., `"Customize Form": ["public/js/doctype/property_setter.js"]`).
- **Virtual DocTypes**: `is_virtual: 1` in JSON — no database table, used only as schema definitions.
- **Config storage**: Uses Frappe's Property Setter system with custom property names (e.g., `sva_ft`, `is_dashboard`, `is_apply_button`).
- **AbortController**: All async operations use AbortSignal for cancellation when navigating away.
- **Caching**: Permission checks and field metadata are cached per-request in class-level dicts.

## Documentation

Detailed docs for each feature are in `docs/`:

| Doc File | Feature |
|----------|---------|
| `getting-started.md` | Installation, prerequisites, architecture |
| `sva-datatable.md` | Connected DocType tables + dt_events API |
| `number-cards-and-charts.md` | Dashboard widgets in form tabs |
| `india-heatmap.md` | State/district map visualization |
| `theme-customization.md` | My Theme DocType colors |
| `data-protection.md` | Field-level encryption and masking |
| `workflow-customization.md` | Approval workflows and audit trail |
| `cloud-storage.md` | AWS S3 and Azure Blob |
| `gallery-and-carousel.md` | File gallery and carousel |
| `workspace-configuration.md` | Workspace heatmaps/tables |
| `dashboard-mode.md` | Single DocType → dashboard |
| `custom-property-setter.md` | Field-level component config |
| `changelog-component.md` | Version history component |
| `additional-components.md` | Timeline, Notes, Tasks, SDG Wheel |
| `api-reference.md` | Python APIs, JS classes, DTConf |

## Common Tasks

### Adding a new whitelisted API
1. Add function in `api.py`, `dt_api.py`, or create new file in `apis/`
2. Decorate with `@frappe.whitelist()`
3. For guest access: `@frappe.whitelist(allow_guest=True)`

### Adding a new dashboard component type
1. Add property_type option in `Custom Property Setter` DocType JSON
2. Add field visibility logic in `property_setter.js` → `field_changes` object
3. Add rendering logic in `overwrite_form.bundle.js` → `handleBlocks()`
4. Add component class in `public/js/custom_components/`

### Adding a new connection type
1. Update `DTConf.doc_type_list()` in `controllers/dt_conf.py`
2. Update `DTFilters` in `controllers/filters.py`
3. Update frontend connection handling in `overwrite_form.bundle.js`

### Adding a new DocType
1. `bench new-doctype <name>` or create JSON + Python manually in `frappe_theme/frappe_theme/doctype/<name>/`
2. If virtual: set `"is_virtual": 1` in JSON
3. Register any JS overrides in `hooks.py` → `doctype_js`

## Security Notes

- All data access goes through `frappe.get_list()` or explicit `check_list_permissions()` — never bypass
- Filter values validated against allowed operators in `DTFilters`
- XSS protection via `global_sanitizer.py` on all doc_events
- Field-level encryption uses Fernet (symmetric) via `data_protection.py`
- Field-level masking: Partial, Full, Regex, Custom Function strategies
