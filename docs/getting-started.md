# Getting Started

## Prerequisites

- **Frappe Framework** v14 or later (v15 recommended)
- **bench** CLI installed and configured
- A working Frappe/ERPNext site

## Installation

### Stable Release

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app frappe_theme
```

### Development Release

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch development
bench install-app frappe_theme
```

After installation, run a bench build and restart:

```bash
bench build --app frappe_theme
bench restart
```

## First-Time Setup

### 1. Configure Theme Colors

Navigate to **My Theme** (search for "My Theme" in the search bar). This is a singleton DocType where you can customize:

- Login page colors, background, and layout
- Navbar colors and custom logo
- Button colors (primary and secondary)
- Body and content box colors
- Table header/body colors
- Input field colors
- Sidebar colors and states
- Widget colors (number cards)

See [Theme Customization](theme-customization.md) for the full guide.

### 2. Set Up Connected Tables (SvaDatatable)

To embed a linked DocType's records inside a parent DocType form:

1. Add an **HTML** field to your parent DocType (via Customize Form or DocType editor)
2. Create a new **SVADatatable Configuration** record
3. Set the **Parent DocType** to your target DocType
4. Add child entries in the **Child Doctypes** table specifying which HTML field to render into and the connection type

See [SvaDatatable](sva-datatable.md) for the full guide.

### 3. Set Up Workspace Widgets

To add heatmaps or tables to a workspace:

1. Create a **Custom HTML Block** in Frappe
2. Add it to your target workspace
3. Create an **SVAWorkspace Configuration** record for that workspace
4. Add heatmap or table entries pointing to the Custom HTML Block

See [Workspace Configuration](workspace-configuration.md) for the full guide.

## App Architecture

### How It Works

Frappe Theme hooks into the Frappe framework at multiple levels:

| Hook | Purpose |
|------|---------|
| `extend_bootinfo` | Loads My Theme config and SVAWorkspace configs at boot time |
| `doc_events` on `*` | Global field sanitization, encryption/decryption on every DocType |
| `doc_events` on `File` | Auto-upload/delete files from cloud storage |
| `override_whitelisted_methods` | Intercepts list views and reports for data masking |
| `override_doctype_class` | Custom behavior for Report and Customize Form |
| `app_include_js/css` | Loads UI components, field overrides, and theme styles |
| `scheduler_events` | Syncs ticket status every 10 minutes |

### Key DocTypes

| DocType | Type | Purpose |
|---------|------|---------|
| `My Theme` | Singleton | App-wide theme and feature configuration |
| `SVADatatable Configuration` | Regular | Configure tables, number cards, and charts per DocType |
| `SVAWorkspace Configuration` | Regular | Configure heatmaps and tables per workspace |
| `SVADT Connections` | Virtual | Manage connection settings for linked DocTypes |
| `SVADT User Listview Settings` | Regular | Per-user column visibility preferences |
| `SVA Workflow Action` | Regular | Workflow audit trail records |
| `Approval Tracker` | Regular | Track approval status across documents |
| `SVAProperty Setter` | Regular | Custom property setters for data protection and validation |
| `Gallery` | Regular | File gallery configuration |
| `Notes` | Regular | Document notes |
| `SVA Task Planner` | Regular | Task planning |
| `SVA Ticket` | Regular | Support ticket integration |
| `Carousel` | Regular | Carousel slide configuration |

### Directory Structure

```
frappe_theme/
├── api.py                  # Main whitelisted API methods
├── dt_api.py               # DataTable-specific APIs
├── wp_api.py               # Workspace APIs
├── boot.py                 # Boot-time initialization
├── hooks.py                # Frappe hooks configuration
├── apis/                   # Specialized API modules
│   ├── approval_timeline.py
│   ├── export_json.py
│   ├── meta.py
│   └── sva_property_setter.py
├── controllers/            # Business logic controllers
│   ├── dt_conf.py          # DataTable configuration
│   ├── chart.py            # Chart data provider
│   ├── number_card.py      # Number card aggregation
│   ├── filters.py          # Filter validation
│   └── sva_integrations/   # Cloud storage integrations
├── overrides/              # Frappe class/method overrides
│   ├── workflow.py         # Custom approval workflows
│   └── report.py           # Custom report behavior
├── utils/                  # Utility modules
│   ├── data_protection.py  # Encryption and masking
│   ├── global_sanitizer.py # XSS protection
│   ├── jinja_methods.py    # Jinja template helpers
│   └── sql_builder.py      # SQL query builder
├── frappe_theme/doctype/   # DocType definitions
└── public/                 # Frontend assets
    ├── js/                 # JavaScript bundles
    │   ├── datatable/      # SvaDatatable component
    │   ├── custom_components/  # Heatmap, Gallery, etc.
    │   ├── vue/            # Vue.js components
    │   └── filters/        # Filter UI components
    ├── css/                # Stylesheets
    └── boundaries/         # GeoJSON map data
```
