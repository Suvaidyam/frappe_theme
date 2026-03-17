<p align="center">
  <a href="https://sfrm.in">
    <img src="https://sfrm.in/files/Suvaidyam%20-%20Logo.png" alt="Suvaidyam" width="200">
  </a>
</p>

<h1 align="center">Frappe Theme</h1>

<p align="center">
A powerful utility app for <a href="https://frappeframework.com/">Frappe Framework</a> that extends desk and web interfaces with advanced UI components, data visualization, theme customization, and security features — all configurable without writing code.
</p>

<p align="center">
Built and maintained by <a href="https://sfrm.in">Suvaidyam</a> · <a href="https://github.com/Suvaidyam">GitHub</a>
</p>

## Key Features

| Feature | Description | Guide |
|---------|-------------|-------|
| **SvaDatatable** | Display connected/linked DocTypes as interactive tables inside any form | [docs/sva-datatable.md](docs/sva-datatable.md) |
| **Number Cards & Charts** | Embed number cards and dashboard charts inside DocType form tabs | [docs/number-cards-and-charts.md](docs/number-cards-and-charts.md) |
| **India Heatmap** | Interactive state/district map visualization with Leaflet.js | [docs/india-heatmap.md](docs/india-heatmap.md) |
| **Theme Customization** | Customize colors for navbar, sidebar, buttons, inputs, tables, login page | [docs/theme-customization.md](docs/theme-customization.md) |
| **Data Protection** | Field-level encryption (Fernet) and masking across forms, lists, and reports | [docs/data-protection.md](docs/data-protection.md) |
| **Workflow Customization** | Approval assignments, audit trail, and timeline visualization | [docs/workflow-customization.md](docs/workflow-customization.md) |
| **Cloud Storage** | Auto-upload files to AWS S3 or Azure Blob Storage | [docs/cloud-storage.md](docs/cloud-storage.md) |
| **Gallery & Carousel** | File gallery (Card/List/Directory views), image carousel, drag-drop reordering | [docs/gallery-and-carousel.md](docs/gallery-and-carousel.md) |
| **Workspace Widgets** | Embed heatmaps and data tables directly in Frappe workspaces | [docs/workspace-configuration.md](docs/workspace-configuration.md) |
| **Dashboard Mode** | Turn any Single DocType into a dashboard with cards, charts, maps | [docs/dashboard-mode.md](docs/dashboard-mode.md) |
| **Custom Property Setter** | Field-level component configuration via props (replaces central config) | [docs/custom-property-setter.md](docs/custom-property-setter.md) |
| **Change Log** | Unified version history across parent and connected child documents | [docs/changelog-component.md](docs/changelog-component.md) |
| **Additional Components** | Timeline, Notes, Tasks, Approval Tracker, Field Comments, SDG Wheel | [docs/additional-components.md](docs/additional-components.md) |

## Screenshots

### Heatmaps in Workspace
![Heatmap](https://github.com/user-attachments/assets/ac26b819-3df2-4697-a74d-3dfae57e6f90)

### Connected DocType Tables in Forms
![Datatable](https://github.com/user-attachments/assets/b27bdb58-0e4d-489a-93ef-ec434098eca4)

### Number Cards & Charts in Form Tabs
![Cards and Charts](https://github.com/user-attachments/assets/93181000-ad65-4a90-84ab-d4ad694ab06c)

### Custom Tables in Workspaces
![Workspace Table](https://github.com/user-attachments/assets/d3b65bbf-bbbe-4fae-a5f8-a19556e5c3b6)

### Theme Color Customization
![Theme Colors](https://github.com/user-attachments/assets/f56fca43-229a-4246-9fdb-b0e534df6f8b)

## Installation

**Stable (main branch):**

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app frappe_theme
```

**Latest (development branch):**

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch development
bench install-app frappe_theme
```

## Quick Start

1. **Install** the app using the commands above
2. **Navigate** to `My Theme` in the search bar to configure your desk colors
3. **Create** an `SVADatatable Configuration` to embed linked DocType tables in forms
4. **Create** an `SVAWorkspace Configuration` to add heatmaps or tables to workspaces

For detailed setup instructions, see the [Getting Started Guide](docs/getting-started.md).

## Documentation

- [Getting Started](docs/getting-started.md) — Installation, prerequisites, first setup
- [Theme Customization](docs/theme-customization.md) — My Theme DocType configuration
- [SvaDatatable](docs/sva-datatable.md) — Connected DocType tables in forms
- [Number Cards & Charts](docs/number-cards-and-charts.md) — Dashboard widgets in form tabs
- [India Heatmap](docs/india-heatmap.md) — State/district map visualization
- [Workspace Configuration](docs/workspace-configuration.md) — Heatmaps and tables in workspaces
- [Data Protection](docs/data-protection.md) — Field-level encryption and masking
- [Workflow Customization](docs/workflow-customization.md) — Approval workflows and audit trail
- [Cloud Storage](docs/cloud-storage.md) — AWS S3 and Azure Blob integration
- [Gallery & Carousel](docs/gallery-and-carousel.md) — File gallery and image carousel
- [Dashboard Mode](docs/dashboard-mode.md) — Single DocType dashboards with cards, charts, maps
- [Custom Property Setter](docs/custom-property-setter.md) — Field-level component configuration
- [Change Log](docs/changelog-component.md) — Unified version history component
- [Additional Components](docs/additional-components.md) — Timeline, Notes, Tasks, and more
- [API Reference](docs/api-reference.md) — Python APIs, JavaScript classes, DTConf engine

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/frappe_theme
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

## License

MIT
