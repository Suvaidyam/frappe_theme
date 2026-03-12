# Frappe Theme — GitHub Copilot Instructions

## About This Project

**frappe_theme** is a Frappe Framework utility app that extends desk/web interfaces with:
- Interactive data tables (SvaDataTable) with 5 connection types
- Dashboard mode for Single DocTypes (Number Cards, Charts, Heatmaps, SDG Wheel)
- Custom Property Setter system for field-level component configuration
- Change Log with field-level permission filtering
- Theme customization, data protection (encryption + masking), cloud storage, workflow extensions

## Tech Stack

- Python 3.10+, Frappe Framework v14+, MariaDB/MySQL
- Frontend: Vanilla JS + Vue.js, Frappe asset pipeline
- Linting: ruff, eslint, prettier

## File Structure Quick Reference

| Path | Purpose |
|------|---------|
| `hooks.py` | App hooks — JS/CSS includes, doc_events, overrides |
| `api.py` | Main whitelisted API endpoints |
| `dt_api.py` | DataTable/Report data APIs (critical) |
| `controllers/dt_conf.py` | DTConf class — core data fetching engine |
| `controllers/filters.py` | DTFilters — filter validation |
| `utils/version_utils.py` | VersionUtils — change log system |
| `utils/data_protection.py` | Fernet encryption + masking |
| `public/js/overwrite_form.bundle.js` | Form customization + dashboard mode |
| `public/js/doctype/property_setter.js` | Custom Property Setter dialog |
| `public/js/svadb.js` | SVAHTTP — HTTP client with AbortController |
| `public/js/datatable/` | SvaDataTable component |
| `frappe_theme/doctype/` | DocType definitions |
| `docs/` | Feature documentation |

## Coding Patterns

### Python
- Use `@frappe.whitelist()` for all exposed API methods
- Use `frappe.get_list()` for permission-safe queries (never bypass with raw SQL for user data)
- Use parameterized queries with `frappe.db.sql("... %s ...", [value])` — no string interpolation
- Permission checks: `frappe.has_permission()` or `DTConf.check_list_permissions()`
- Error handling: `frappe.throw()` for user-facing errors

### JavaScript
- Bundle files: `*.bundle.js` in `public/js/`, registered in `hooks.py` → `app_include_js`
- DocType JS: registered in `hooks.py` → `doctype_js`
- Always use AbortSignal for async operations
- Use `SVAHTTP` class for API calls (wraps frappe.call with abort support)
- SvaDataTable events: `frm.dt_events['DocType'] = { before_load, after_load, formatter, ... }`

### Configuration
- Component configs: Property Setter with `property = "sva_ft"`, value = JSON
- Dashboard mode: `is_dashboard = 1` on Single DocType
- Virtual DocTypes (`is_virtual: 1`): no DB table, schema-only

### Data Flow
- All table/report data flows through `dt_api.get_dt_list()` → `DTConf` → `DTFilters`
- Connection types: Direct, Indirect, Referenced, Unfiltered, Report
- Custom Property Setter: DocType editor → "Set Property" on HTML field → saves sva_ft JSON
- Change Log: Version validate hook redirects child versions to parent → VersionUtils extracts with JSON_TABLE

## Documentation
See `docs/` for detailed guides. Key files:
- `docs/sva-datatable.md` — DataTable configuration + dt_events API
- `docs/api-reference.md` — All Python/JS APIs
- `docs/custom-property-setter.md` — sva_ft configuration system
- `docs/dashboard-mode.md` — Dashboard setup
- `docs/changelog-component.md` — Version tracking
