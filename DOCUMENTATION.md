<div align="center">

# 📖 Frappe Theme - Complete Documentation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frappe](https://img.shields.io/badge/Frappe-Framework-blue)](https://frappeframework.com/)

> **A comprehensive customization app for Frappe Framework**  
> Built by Suvaidyam | Version 1.0.0

[🏠 Home](README.md) • [⚡ Quick Start](QUICK_START.md) • [📋 Features](FEATURES_SUMMARY.md) • [🐛 Issues](https://github.com/Suvaidyam/frappe_theme/issues)

</div>

---

## 📑 Table of Contents

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Getting Started**
- [Overview](#-overview)
- [Installation](#-installation)
- [Configuration](#-configuration)

**Core Features**
- [Theme Customization](#1--theme-customization)
- [Workspace Enhancements](#2--workspace-enhancements)
- [Data Visualization](#3--data-visualization)
- [Custom Datatables](#4--custom-datatables-svadatatable)
- [Workflow Management](#5--workflow-management)
- [Security & Data Protection](#6--security--data-protection)
- [Permission Management](#7--permission-management)

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Advanced Features**
- [Property Setters](#8--property-setters)
- [Form Enhancements](#9--form-enhancements)
- [Export & Reporting](#10--export--reporting)
- [Integrations](#11--integrations)
- [Utilities](#12--utilities)
- [Geographic Data](#14--geographic-data)
- [Mobile Enhancements](#15--mobile-enhancements)

**Technical Reference**
- [Frontend Features](#-frontend-features)
- [Backend Features](#-backend-features)
- [API Reference](#-api-reference)
- [Development Guide](#-development-guide)

</td>
</tr>
</table>

---

## 🎯 Overview

**Frappe Theme** transforms your Frappe/ERPNext instance with advanced customization capabilities, enhanced UI components, powerful data visualization, workflow management, and enterprise-grade security features.

### Key Highlights

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🎨  
**Advanced Theming**  
Complete UI customization

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

📊  
**Data Visualization**  
Charts, heatmaps, number cards

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🔐  
**Security**  
Field encryption, data masking

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🔄  
**Workflow Extensions**  
Custom actions, approval tracking

</td>
</tr>
<tr>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

📋  
**Bulk Operations**  
Mass permission management

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🎯  
**Custom Datatables**  
Advanced filtering & actions

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🌐  
**Geographic Data**  
India states & districts boundaries

</td>
<td style="width: 25%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🤖  
**AI Integration**  
OpenAI & WrenAI support

</td>
</tr>
</table>

**→ [See all 200+ features](FEATURES_SUMMARY.md)**

---

## 📦 Installation

### Prerequisites

- Frappe Framework v14+
- Python 3.10+
- Node.js 18+
- MariaDB 10.6+ / PostgreSQL 13+

### Stable Version

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/Suvaidyam/frappe_theme --branch main
bench install-app frappe_theme
bench setup requirements
bench build --app frappe_theme
bench restart
```

### Development Version

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/Suvaidyam/frappe_theme --branch development
bench install-app frappe_theme
bench setup requirements
```

---

## 🚀 Core Features


### 1. 🎨 Theme Customization

#### My Theme DocType
Centralized theme management for complete UI control.

**Features:**
- Custom color schemes (primary, secondary, text, background)
- Font customization
- Logo and branding
- Custom CSS injection
- Real-time preview

**Usage:**
```javascript
// Navigate to: Desk > My Theme
// Configure your theme settings
```

---

### 2. 📊 Workspace Enhancements

#### SVAWorkspace Configuration
Add powerful elements to workspaces without coding.

**Available Components:**
- **Heatmaps** - Activity visualization
- **Custom Tables** - Any DocType data display
- **Number Cards** - KPI metrics
- **Charts** - Data visualizations

**Example:**
```javascript
{
    "workspace": "Sales",
    "heatmap_doctype": "Sales Order",
    "date_field": "transaction_date",
    "value_field": "grand_total"
}
```

---

### 3. 📈 Data Visualization

#### Number Cards in Forms
Display real-time KPIs in DocType forms.

**Features:**
- Tab-based placement
- Custom queries
- Color-coded indicators
- Auto-refresh

#### Charts in Forms
Interactive charts embedded in forms.

**Supported Types:**
- Line, Bar, Pie, Donut, Area charts
- Real-time data updates
- Custom filters
- Export capabilities

#### Heatmaps
Visual data density representation.

**Use Cases:**
- Activity tracking
- Sales patterns
- Resource utilization
- Time-based analysis

---

### 4. 🗂️ Custom Datatables (SVADatatable)

Powerful, configurable tables with advanced features.

**Key Features:**
- Custom field selection
- Advanced filtering (text, date, select, multiselect)
- Sorting & pagination
- Bulk actions
- Export (CSV, Excel, JSON)
- Conditional formatting
- Row-level actions
- Inline editing

**Configuration:**
```python
{
    "doctype": "Customer",
    "fields": ["name", "customer_name", "territory"],
    "filters": {"disabled": 0},
    "page_length": 20,
    "enable_actions": True
}
```

**Events System:**
```javascript
frm.dt_events = {
    'Customer': {
        before_load: function(dt) {
            // Setup before data fetch
        },
        after_insert: async function(dt, response) {
            // After new record created
        },
        customize_form_fields: function(dt, fields) {
            // Modify form fields
        }
    }
}
```

---

### 5. 🔄 Workflow Management

#### Custom Workflow Actions
Extend workflows with custom logic.

**Capabilities:**
- Pre/post workflow hooks
- Custom validation
- Data transformation
- External API calls
- Email notifications
- State-based actions

#### Approval Tracker
Complete approval history tracking.

**Features:**
- Timeline view
- Approval comments
- State transitions
- User assignments
- Audit trail
- Export history

#### Approval Timeline API
```python
@frappe.whitelist()
def get_approval_timeline(doctype, docname):
    return frappe_theme.apis.approval_timeline.get_timeline(doctype, docname)
```

---

### 6. 🔐 Security & Data Protection

#### Field-Level Encryption
AES-256 encryption for sensitive fields.

**Features:**
- Automatic encryption on save
- Transparent decryption on load
- Role-based access
- Secure key management

**Configuration:**
```python
{
    "fieldname": "ssn",
    "fieldtype": "Data",
    "encrypt": 1
}
```

#### Data Masking
Protect sensitive data in views.

**Masking Patterns:**
- Email: `u***@example.com`
- Phone: `***-***-1234`
- Custom patterns

#### Global Sanitizer
XSS protection for all inputs.

```python
doc_events = {
    "*": {
        "validate": "frappe_theme.utils.global_sanitizer.sanitize_all_fields"
    }
}
```

---

### 7. 👥 Permission Management

#### Bulk Role Profile Permissions
Manage permissions at scale.

**Features:**
- Load all role profiles
- Bulk assignment
- Quick presets
- Permission levels (0-9)

**Presets:**
- **Read Only** - Read permission
- **Full Access** - All permissions
- **Report Only** - Read, Report, Export, Print
- **Data Entry** - Read, Write, Create, Report, Export, Print, Email

**Usage:**
1. Select DocType
2. Load Role Profiles
3. Apply preset or customize
4. Apply permissions

#### Copy Role Permissions
Copy permissions between roles.

#### Bulk Workspace Permissions
Manage workspace visibility for multiple roles.

---

### 8. 🛠️ Property Setters

#### Custom Property Setter
Enhanced property management.

**Features:**
- Bulk updates
- Version control
- Rollback support
- Export/import

#### SVA Property Setter
Extended functionality for property management.

---

### 9. 📝 Form Enhancements

#### DocType Field Comments
Contextual help for form fields.

**Features:**
- Rich text comments
- Field-level documentation
- User-specific notes
- Comment history
- Inline display

#### Multi-Image Gallery
Display multiple images in gallery view.

**Features:**
- Lightbox view
- Drag & drop upload
- Bulk upload
- Image preview
- Delete/reorder

#### Custom Import
Enhanced import with validation.

**Features:**
- Template generation
- Data validation
- Error reporting
- Bulk processing
- Progress tracking

---

### 10. 📤 Export & Reporting

#### Export JSON
Export DocType data in JSON format.

**Features:**
- Custom field selection
- Nested child tables
- Filtered exports
- Batch processing

**API:**
```python
@frappe.whitelist()
def export_doctype_json(doctype, filters=None, fields=None):
    return frappe_theme.apis.export_json.export_data(doctype, filters, fields)
```

#### Multiple Export Formats
- JSON
- CSV
- Excel
- PDF

#### Custom Report Overrides
Enhanced report functionality.

```python
override_doctype_class = {
    "Report": "frappe_theme.overrides.report.CustomReport"
}
```

---

### 11. 🔌 Integrations

#### Cloud Assets
Automatic file upload to cloud storage.

**Supported Providers:**
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

**Configuration:**
```python
doc_events = {
    "File": {
        "after_insert": "frappe_theme.controllers.sva_integrations.cloud_assets.file_upload_to_cloud",
        "on_trash": "frappe_theme.controllers.sva_integrations.cloud_assets.delete_from_cloud"
    }
}
```

#### Helpdesk Integration (SVA Ticket)
Ticket management system.

**Features:**
- Ticket creation
- Status tracking
- Auto-sync (every 10 minutes)
- Email notifications

#### OpenAI Integration
AI-powered features.

**Capabilities:**
- Text generation
- Data analysis
- Smart suggestions
- Content summarization

**API:**
```python
@frappe.whitelist()
def get_ai_suggestion(prompt, context=None):
    return frappe_theme.apis.openai.get_completion(prompt, context)
```

#### WrenAI Integration
Custom AI assistant.

---

### 12. 🛠️ Utilities

#### SQL Builder
Secure dynamic query builder.

**Features:**
- Parameterized queries
- SQL injection prevention
- Query optimization
- Result caching

**Usage:**
```python
from frappe_theme.utils.sql_builder import SQLBuilder

builder = SQLBuilder("Customer")
builder.select(["name", "customer_name"])
builder.where("territory", "=", "India")
builder.limit(10)
results = builder.execute()
```

#### Version Utils
Enhanced version tracking.

**Features:**
- Detailed change tracking
- Field-level comparison
- Version rollback
- Audit trail

#### Jinja Methods
Custom Jinja filters.

```python
jinja = {
    "methods": "frappe_theme.utils.jinja_methods"
}
```

---

### 13. ⏰ Cron Jobs

#### Ticket Status Sync
Automatic synchronization every 10 minutes.

```python
scheduler_events = {
    "cron": {
        "*/10 * * * *": [
            "frappe_theme.cron.sync_ticket_status.run"
        ]
    }
}
```

---

### 14. 🌍 Geographic Data

#### India Boundaries
Complete geographic data for India.

**Included:**
- State boundaries (GeoJSON)
- District boundaries (GeoJSON)
- States data (JSON)
- Districts data (JSON)
- 39 individual district files

**Files:**
- `boundaries/state_boundries.json` (6.2 MB)
- `boundaries/districts_boundaries.json` (13.6 MB)
- `json/states.json` (2.4 MB)
- `json/districts.json` (4.9 MB)

**Usage:**
```javascript
// Load state boundaries
fetch('/assets/frappe_theme/boundaries/state_boundries.json')
    .then(response => response.json())
    .then(data => {
        // Use GeoJSON data for maps
    });
```

---

### 15. 📱 Mobile Enhancements

#### Mobile View Optimizations
Responsive design improvements.

**Features:**
- Touch-optimized controls
- Responsive layouts
- Mobile-friendly forms
- Swipe gestures
- Optimized performance

**File:** `public/js/mobile_view.js`

---


## 🎨 Frontend Features

### Vue.js Components

Built with **Vue 3.5.13**, **Pinia 3.0.2**, and **Vue Router 4.5.0**.

#### Available Components

1. **SVA Card** (`vue/sva_card`)
   - Customizable card component
   - Multiple layouts
   - Action buttons
   - Loading states

2. **SVA Chart** (`vue/sva_chart`)
   - Chart.js integration
   - Multiple chart types
   - Real-time updates
   - Export functionality

3. **Approval Timeline** (`vue/approval_timeline`)
   - Visual timeline
   - State transitions
   - User avatars
   - Comments display

4. **Approval Tracker** (`vue/approval_tracker`)
   - Approval status tracking
   - Pending approvals
   - History view

5. **DT Action** (`vue/dt_action`)
   - Datatable actions
   - Bulk operations
   - Custom buttons

6. **Field Comment** (`vue/Field Comment`)
   - Inline field comments
   - Rich text support
   - User mentions

7. **Override Chart** (`vue/override_chart`)
   - Custom chart overrides
   - Enhanced functionality

---

### Custom Components

Located in `public/js/custom_components/`

#### 1. Heatmap Component
**File:** `heatmap.bundle.js`

**Features:**
- Activity heatmap visualization
- Date-based data
- Color gradients
- Tooltips
- Click events

**Usage:**
```javascript
new frappe.ui.Heatmap({
    parent: wrapper,
    doctype: 'Sales Order',
    date_field: 'transaction_date',
    value_field: 'grand_total'
});
```

#### 2. Timeline Component
**File:** `timeline.bundle.js`

**Features:**
- Activity timeline
- User actions
- Timestamps
- Filtering
- Export

#### 3. Communication Component
**File:** `communication.bundle.js`

**Features:**
- Email threads
- Comments
- Attachments
- Reply functionality

#### 4. Task Component
**File:** `task.bundle.js`

**Features:**
- Task management
- Status tracking
- Assignments
- Due dates

#### 5. Note Component
**File:** `note.bundle.js`

**Features:**
- Quick notes
- Rich text editor
- Attachments
- Sharing

#### 6. Linked Users Component
**File:** `linked_users.bundle.js`

**Features:**
- User linking
- Permissions
- Notifications

#### 7. SDG Wheel Component
**File:** `sdg_wheel.bundle.js`

**Features:**
- UN SDG goals visualization
- Interactive wheel
- Goal selection
- Progress tracking

**Includes:** 18 SDG icons in `public/images/sdg_icons/`

#### 8. Filters Ribbon Component
**File:** `filters_ribbon.bundle.js`

**Features:**
- Quick filters
- Tag-based filtering
- Clear all
- Save filters

#### 9. Gallery Component
**Folder:** `gallery/`

**Features:**
- Image gallery
- Lightbox view
- Thumbnails
- Navigation

#### 10. Approval Request Component
**Folder:** `approval_request/`

**Features:**
- Approval requests
- Action buttons
- Comments
- History

#### 11. Dynamic HTML Component
**Folder:** `dynamic_html/`

**Features:**
- Dynamic content rendering
- Template support
- Data binding

---

### Field Overrides

Located in `public/js/fields_overwrite/`

#### 1. Link Field Override
**File:** `override_link.bundle.js`

**Enhancements:**
- Quick create
- Advanced search
- Recent values
- Custom filters

#### 2. Select Field Override
**File:** `override_select.bundle.js`

**Enhancements:**
- Searchable dropdown
- Custom options
- Icons support

#### 3. Multiselect Field Override
**File:** `override_multiselect.bundle.js`

**Enhancements:**
- Tag-based selection
- Bulk select/deselect
- Search functionality
- Custom rendering

#### 4. Table Multiselect Override
**File:** `override_table_multiselect.bundle.js`

**Enhancements:**
- Checkbox selection
- Select all
- Bulk actions

#### 5. Date Field Override
**File:** `override_date_field.bundle.js`

**Enhancements:**
- Custom date picker
- Quick dates (Today, Yesterday, etc.)
- Date range selection
- Keyboard shortcuts

#### 6. Button Field Override
**File:** `override_button.bundle.js`

**Enhancements:**
- Custom styling
- Loading states
- Confirmation dialogs
- Icon support

---

### Datatable Features

Located in `public/js/datatable/`

#### SVA Datatable
**File:** `sva_datatable.bundle.js` (146 KB)

**Complete datatable solution with:**
- Virtual scrolling
- Infinite loading
- Advanced filtering
- Sorting
- Bulk actions
- Export
- Custom renderers
- Event system

#### Filters
**Folder:** `datatable/filters/`

**Filter Types:**
- Text filter
- Number filter
- Date filter
- Select filter
- Multiselect filter
- Range filter
- Boolean filter

#### Sort Selector
**File:** `sva_sort_selector.bundle.js`

**Features:**
- Multi-column sorting
- Ascending/descending
- Sort priority
- Save sort preferences

#### List Settings
**File:** `list_settings.bundle.js`

**Features:**
- Column visibility
- Column order
- Page length
- Default filters
- Save settings per user

#### Events Documentation
**File:** `DT_EVENTS_DOCUMENTATION.md`

Complete reference for datatable events:
- `before_load`
- `after_load`
- `before_table_load`
- `after_row_update`
- `add_row_handler`
- `customize_form_fields`
- `after_insert`
- `after_update`
- `after_save`
- `after_delete`
- `after_render`

---

### UI Enhancements

#### 1. Breadcrumb Override
**File:** `breadcrumb_override.js`

**Features:**
- Custom breadcrumb styling
- Additional navigation
- Icons support

#### 2. Sidebar Override
**File:** `sidebar_override.js`

**Features:**
- Custom sidebar items
- Collapsible sections
- Icons
- Badges

#### 3. Extended Chart
**File:** `extended_chart.js`

**Features:**
- Chart.js extensions
- Custom chart types
- Enhanced tooltips
- Export charts

#### 4. Number Card
**File:** `number_card.js`

**Features:**
- KPI cards
- Trend indicators
- Color coding
- Click actions

#### 5. Customizations
**File:** `customizations.js`

**Global UI customizations:**
- Form layouts
- List views
- Buttons
- Colors

#### 6. Loader Element
**File:** `loader-element.js`

**Features:**
- Custom loading animations
- Progress indicators
- Skeleton screens

---

### Bundles

#### 1. Frappe Theme Bundle
**File:** `frappe_theme.bundle.js`

Main theme bundle with core functionality.

#### 2. SVA Workspace Bundle
**File:** `sva_workspace.bundle.js`

Workspace enhancements and customizations.

#### 3. Overwrite Form Bundle
**File:** `overwrite_form.bundle.js`

Form customizations and enhancements.

#### 4. Overwrite Workflow Bundle
**File:** `overwrite_workflow.bundle.js`

Workflow extensions and custom actions.

#### 5. Global Exporter Bundle
**File:** `global_exporter.bundle.js`

Export functionality across the app.

#### 6. SVA Dashboard Manager Bundle
**File:** `sva_dashboard_manager.bundle.js`

Dashboard management and customization.

#### 7. SVA Carousel Bundle
**File:** `sva_carousel.bundle.js`

Image carousel for web pages.

#### 8. Utils Bundle
**File:** `utils.bundle.js`

Utility functions and helpers.

---

### Utility Scripts

#### 1. SVADB
**File:** `svadb.js`

Database utility functions:
- Query builder
- Data fetching
- Caching
- Batch operations

#### 2. Utils
**File:** `utils.js`

General utility functions:
- Date formatting
- String manipulation
- Number formatting
- Validation

#### 3. SVA DT Utils
**File:** `sva_dt_utils.js`

Datatable utility functions.

#### 4. Fields Comment
**File:** `fields_comment.js` (72 KB)

Complete field comment system:
- Add comments
- Edit comments
- Delete comments
- Comment history
- User mentions
- Rich text support

#### 5. Custom Import
**File:** `custom_import.js`

Enhanced import functionality:
- Template generation
- Validation
- Error handling
- Progress tracking

#### 6. Multi Image Gallery
**File:** `multi_image_gallery.js`

Image gallery management:
- Multiple uploads
- Gallery view
- Lightbox
- Delete/reorder

---

### Web Form Enhancements

Located in `public/js/web_form/`

**File:** `common_web_form.bundle.js`

**Features:**
- Enhanced web forms
- Custom validation
- Multi-step forms
- File uploads
- Progress saving

---

### DocType Scripts

Located in `public/js/doctype/`

#### 1. Workflow
**File:** `workflow.js`

Custom workflow enhancements.

#### 2. Web Form
**File:** `web_form.js`

Web form customizations.

#### 3. Property Setter
**File:** `property_setter.js`

Property setter enhancements.

#### 4. Customize Form
**File:** `customize_form.js`

Form customization tools.

#### 5. DocType
**File:** `doctype.js`

DocType customizations.

#### 6. Global DocType
**File:** `global_doctype.js`

Global DocType enhancements applied to all DocTypes.

---

### CSS Styling

#### 1. Main Theme CSS
**File:** `public/css/frappe_theme.css`

**Includes:**
- Color schemes
- Typography
- Layout styles
- Component styles
- Responsive design

#### 2. Number Card Mapper CSS
**File:** `public/css/number_card_mapper.css`

**Styles for:**
- Number cards
- KPI displays
- Trend indicators
- Color coding

---

### Images & Assets

Located in `public/images/`

#### 1. SDG Icons
**Folder:** `sdg_icons/` (18 icons)

UN Sustainable Development Goals icons.

#### 2. Utility Images
- `no-data-found.png` - Empty state
- `form-not-saved.png` - Unsaved changes warning
- `E_SDG_logo_Square_WEB.png` - SDG logo

---


## 🔧 Backend Features

### DocTypes

Located in `frappe_theme/frappe_theme/doctype/`

#### Configuration DocTypes

1. **My Theme**
   - Theme configuration
   - Color schemes
   - Branding

2. **SVAWorkspace Configuration**
   - Workspace customization
   - Custom elements
   - Heatmaps, tables, charts

3. **SVADatatable Configuration**
   - Datatable setup
   - Field selection
   - Filters & actions

4. **SVADatatable Configuration Child**
   - Child table for datatable fields

5. **SVADatatable Child Conf**
   - Child table configuration

6. **SVADatatable Action Conf**
   - Custom actions configuration

7. **SVAWorkspace DT Child**
   - Workspace datatable child

8. **SVAWorkspace Heatmap Child**
   - Workspace heatmap child

9. **Custom Property Setter**
   - Enhanced property setter

10. **SVAProperty Setter**
    - Custom property management

11. **SVADT User Listview Settings**
    - User-specific list view settings

12. **SVADT Connections**
    - Database connections

#### Permission Management DocTypes

1. **Bulk Role Profile Permissions**
   - Bulk permission assignment
   - Role profile management
   - Quick presets

2. **Bulk Role Profile Permissions Child**
   - Child table for permissions

3. **Copy Role Perms**
   - Copy permissions between roles

4. **Copy Role Perms Child**
   - Child table for role copying

5. **Bulk Workspace Permissions**
   - Workspace visibility management

6. **Bulk Workspace Permissions Child**
   - Child table for workspace permissions

#### Workflow DocTypes

1. **SVA Workflow Action**
   - Custom workflow actions
   - Pre/post hooks

2. **SVA Workflow Action Data Child**
   - Workflow action data

3. **Approval Tracker**
   - Approval history tracking
   - Timeline view

4. **Approval Assignment Child**
   - Approval assignments

#### Data & Content DocTypes

1. **DocType Field Comment**
   - Field-level comments
   - Documentation

2. **DocType Field Comment Log**
   - Comment history

3. **Notes**
   - Quick notes
   - Documentation

4. **Gallery**
   - Image gallery management

5. **Carousel**
   - Image carousel

6. **Activity Images**
   - Activity-related images

7. **Contact Us**
   - Contact form submissions

8. **SVA Task Planner**
   - Task planning and management

#### Visualization DocTypes

1. **Number Card Child**
   - Number card configuration

2. **Dashboard Chart Child**
   - Chart configuration

3. **Dashboard Chart Short**
   - Short chart configuration

4. **Visualization Mapper**
   - Visualization mapping

#### Integration DocTypes

1. **SVA Ticket**
   - Helpdesk ticket integration

2. **WrenAI User Thread**
   - AI conversation threads

#### Utility DocTypes

1. **SVAFixture**
   - Fixture management
   - Data export/import

2. **Workspace Sidebar Remapping**
   - Sidebar customization

---

### Controllers

Located in `frappe_theme/controllers/`

#### 1. Chart Controller
**File:** `chart.py`

**Functions:**
- Chart data processing
- Multiple chart types
- Data aggregation
- Filtering

**Key Methods:**
```python
def get_chart_data(doctype, chart_type, filters)
def process_timeseries_data(data, date_field)
def aggregate_data(data, group_by)
```

#### 2. Number Card Controller
**File:** `number_card.py`

**Functions:**
- KPI calculations
- Trend analysis
- Comparison logic
- Color coding

**Key Methods:**
```python
def calculate_number_card(doctype, filters, function)
def get_trend(current, previous)
def get_color_code(value, thresholds)
```

#### 3. DT Configuration Controller
**File:** `dt_conf.py`

**Functions:**
- Datatable configuration
- Field metadata
- Filter setup
- Action configuration

**Key Methods:**
```python
def get_dt_config(doctype)
def get_fields_meta(doctype, fields)
def setup_filters(config)
```

#### 4. Filters Controller
**File:** `filters.py`

**Functions:**
- Filter processing
- Query building
- Filter validation
- Custom filters

**Key Methods:**
```python
def process_filters(filters)
def build_filter_query(filters)
def validate_filter(filter_config)
```

#### 5. Timeline Controller
**File:** `timeline.py`

**Functions:**
- Activity timeline
- Version tracking
- User actions
- Timestamps

**Key Methods:**
```python
def get_timeline(doctype, docname)
def format_timeline_data(data)
```

#### 6. Wren Controller
**File:** `wren.py`

**Functions:**
- WrenAI integration
- Conversation management
- Context handling

#### 7. Copy Role Perms
**Folder:** `copy_role_perms/`

**Functions:**
- Permission copying
- Role management
- Bulk operations

#### 8. SVA Integrations
**Folder:** `sva_integrations/`

**Includes:**
- Cloud assets integration
- External API connections

---

### APIs

Located in `frappe_theme/apis/`

#### 1. Export JSON API
**File:** `export_json.py`

**Functions:**
```python
@frappe.whitelist()
def export_doctype_json(doctype, filters=None, fields=None):
    """Export DocType data as JSON"""
    
@frappe.whitelist()
def export_with_children(doctype, name):
    """Export document with child tables"""
```

#### 2. Export Data API
**Folder:** `export_data/`

**Supported Formats:**
- JSON
- CSV
- Excel
- PDF

#### 3. Approval Timeline API
**File:** `approval_timeline.py`

**Functions:**
```python
@frappe.whitelist()
def get_timeline(doctype, docname):
    """Get approval timeline"""
    
@frappe.whitelist()
def add_approval_comment(doctype, docname, comment):
    """Add approval comment"""
```

#### 4. Doc PDF API
**File:** `doc_pdf.py`

**Functions:**
```python
@frappe.whitelist()
def generate_pdf(doctype, name, format=None):
    """Generate PDF for document"""
```

#### 5. OpenAI API
**File:** `openai.py`

**Functions:**
```python
@frappe.whitelist()
def get_completion(prompt, context=None):
    """Get AI completion"""
    
@frappe.whitelist()
def analyze_data(data, question):
    """Analyze data with AI"""
```

#### 6. Meta API
**File:** `meta.py`

**Functions:**
```python
@frappe.whitelist()
def get_doctype_meta(doctype):
    """Get DocType metadata"""
    
@frappe.whitelist()
def get_field_options(doctype, fieldname):
    """Get field options"""
```

#### 7. Public API
**File:** `public_api.py`

**Functions:**
```python
@frappe.whitelist(allow_guest=True)
def get_public_data(doctype, filters):
    """Get public data"""
```

#### 8. SVA Property Setter API
**File:** `sva_property_setter.py`

**Functions:**
```python
@frappe.whitelist()
def set_property(doctype, fieldname, property, value):
    """Set property"""
    
@frappe.whitelist()
def bulk_set_properties(properties):
    """Bulk set properties"""
```

#### 9. Extract ZIP Images API
**File:** `extract_zip_images.py`

**Functions:**
```python
@frappe.whitelist()
def extract_images_from_zip(file_url):
    """Extract images from ZIP file"""
```

---

### Utilities

Located in `frappe_theme/utils/`

#### 1. SQL Builder
**File:** `sql_builder.py`

**Features:**
- Secure query building
- Parameterized queries
- SQL injection prevention
- Query optimization

**Usage:**
```python
from frappe_theme.utils.sql_builder import SQLBuilder

builder = SQLBuilder("Customer")
builder.select(["name", "customer_name", "territory"])
builder.where("territory", "=", "India")
builder.where("disabled", "=", 0)
builder.order_by("customer_name", "ASC")
builder.limit(10)
results = builder.execute()
```

**Test File:** `test_sql_builder.py` (33 KB)

#### 2. Data Protection
**File:** `data_protection.py`

**Features:**
- Field encryption (AES-256)
- Data masking
- Role-based access
- Secure key management

**Functions:**
```python
def encrypt_doc_fields(doc, method=None):
    """Encrypt sensitive fields"""
    
def decrypt_doc_fields(doc, method=None):
    """Decrypt fields for authorized users"""
    
def mask_doc_list_view(doctype, args):
    """Mask data in list view"""
    
def mask_query_report(report_name, filters):
    """Mask data in reports"""
```

#### 3. Global Sanitizer
**File:** `global_sanitizer.py`

**Features:**
- XSS protection
- HTML sanitization
- Script injection prevention

**Functions:**
```python
def sanitize_all_fields(doc, method=None):
    """Sanitize all text fields"""
    
def sanitize_html(html):
    """Sanitize HTML content"""
```

#### 4. Version Utils
**File:** `version_utils.py`

**Features:**
- Version tracking
- Field-level comparison
- Change history
- Rollback support

**Class:**
```python
class VersionUtils:
    @staticmethod
    def get_versions(dt, dn, page_length, start, filters=None):
        """Get document versions"""
    
    @staticmethod
    def compare_versions(version1, version2):
        """Compare two versions"""
    
    @staticmethod
    def rollback_to_version(doctype, name, version):
        """Rollback to specific version"""
```

#### 5. Jinja Methods
**File:** `jinja_methods.py`

**Custom Jinja filters and methods:**
```python
def format_currency_indian(value):
    """Format currency in Indian style"""
    
def get_state_name(state_code):
    """Get state name from code"""
    
def get_district_name(district_code):
    """Get district name from code"""
```

#### 6. Permission Engine
**File:** `permission_engine.py`

**Custom permission evaluation:**
```python
def has_custom_permission(doctype, ptype, doc=None):
    """Check custom permissions"""
```

#### 7. Index Utils
**File:** `index.py`

**Indexing utilities:**
```python
def create_index(doctype, fields):
    """Create database index"""
    
def get_state_closure_by_type(state_type):
    """Get state closure"""
```

---

### Overrides

Located in `frappe_theme/overrides/`

#### 1. Report Override
**File:** `report.py`

**Class:**
```python
class CustomReport(Report):
    """Enhanced report functionality"""
    
    def before_save(self):
        """Custom validation"""
    
    def get_data(self, filters):
        """Custom data fetching"""
```

#### 2. Workflow Override
**File:** `workflow.py`

**Functions:**
```python
@frappe.whitelist()
def custom_apply_workflow(doc, action):
    """Custom workflow application"""
    
@frappe.whitelist()
def get_custom_transitions(doc, workflow):
    """Get custom transitions"""
```

---

### Services

Located in `frappe_theme/services/`

#### 1. OpenAI Service
**File:** `openai.py`

**Service wrapper for OpenAI API:**
```python
class OpenAIService:
    def __init__(self, api_key):
        self.api_key = api_key
    
    def get_completion(self, prompt, model="gpt-4"):
        """Get completion"""
    
    def analyze_data(self, data, question):
        """Analyze data"""
```

#### 2. Helpdesk Service
**File:** `heldesk.py`

**Helpdesk integration:**
```python
class HelpdeskService:
    def sync_tickets(self):
        """Sync tickets"""
    
    def create_ticket(self, subject, description):
        """Create ticket"""
```

---

### Cron Jobs

Located in `frappe_theme/cron/`

#### Sync Ticket Status
**File:** `sync_ticket_status.py`

**Schedule:** Every 10 minutes

```python
def run():
    """Sync ticket status from helpdesk"""
    tickets = frappe.get_all("SVA Ticket", filters={"status": ["!=", "Closed"]})
    for ticket in tickets:
        sync_ticket(ticket.name)
```

---

### Setup & Migration

Located in `frappe_theme/setup/`

#### Migration
**File:** `migration.py`

**Functions:**
```python
def after_migrate():
    """Run after migration"""
    setup_custom_fields()
    setup_property_setters()
    clear_cache()
```

#### Install
**File:** `install.py`

**Functions:**
```python
def after_install():
    """Run after installation"""
    create_default_theme()
    setup_permissions()
```

---

### Integrations

Located in `frappe_theme/sva_integrations/`

#### Cloud Assets
**Features:**
- AWS S3 integration
- Google Cloud Storage
- Azure Blob Storage
- Automatic upload
- CDN support

---

### Configuration

Located in `frappe_theme/config/`

**App configuration and settings**

---

### Fixtures

Located in `frappe_theme/fixtures/`

**File:** `svadatatable_configuration.json`

**Pre-configured datatable setups**

---

### Patches

Located in `frappe_theme/patches/`

**File:** `patches.txt`

**Database patches for updates:**
```
frappe_theme.patches.v1_0.setup_custom_fields
frappe_theme.patches.v1_0.migrate_old_data
```

---

### Tests

Located in `frappe_theme/tests/`

**Test Structure:**
```
tests/
├── __init__.py
├── utils.py
├── apis/
├── utils/
└── controllers/
```

---


## 📚 API Reference

### Main API Endpoints

Located in `frappe_theme/api.py`

#### Theme API

```python
@frappe.whitelist(allow_guest=True)
def get_my_theme():
    """Get current theme configuration
    
    Returns:
        dict: Theme configuration
    """
    return frappe.get_doc("My Theme")
```

#### Property Setter API

```python
@frappe.whitelist(allow_guest=True)
def get_property_set(doctype):
    """Get property setters for a DocType
    
    Args:
        doctype (str): DocType name
        
    Returns:
        list: Property setters
    """
    return frappe.db.get_list(
        "Property Setter",
        fields=["*"],
        filters={"doc_type": doctype}
    )
```

#### DocType Fields API

```python
@frappe.whitelist()
def get_doctype_fields(doctype):
    """Get all fields including custom fields
    
    Args:
        doctype (str): DocType name
        
    Returns:
        dict: DocType with all fields
    """
    custom_fields = frappe.get_all("Custom Field", filters={"dt": doctype})
    dt = frappe.get_doc("DocType", doctype)
    dt.fields.extend(custom_fields)
    return dt
```

#### List Settings API

```python
@frappe.whitelist()
def get_my_list_settings(doctype):
    """Get list view settings
    
    Args:
        doctype (str): DocType name
        
    Returns:
        dict: List view settings
    """
    return frappe.get_cached_doc("List View Settings", doctype)
```

#### Meta Fields API

```python
@frappe.whitelist()
def get_meta_fields(doctype):
    """Get meta fields with property setters applied
    
    Args:
        doctype (str): DocType name
        
    Returns:
        list: Fields with properties
    """
    meta_fields = frappe.get_meta(doctype).fields
    property_setters = frappe.get_all("Property Setter", 
        filters={"doc_type": doctype})
    # Apply property setters
    return fields_dict
```

#### Versions API

```python
@frappe.whitelist()
def get_versions(dt, dn, page_length, start, filters=None):
    """Get document version history
    
    Args:
        dt (str): DocType
        dn (str): Document name
        page_length (int): Number of versions per page
        start (int): Starting index
        filters (str): Optional filters
        
    Returns:
        list: Version history
    """
    return VersionUtils.get_versions(dt, dn, page_length, start, filters)
```

#### Permissions API

```python
@frappe.whitelist()
def get_permissions(doctype, _type="Direct"):
    """Get user permissions for a DocType
    
    Args:
        doctype (str): DocType name
        _type (str): Permission type (Direct/Report)
        
    Returns:
        list: Available permissions
    """
    permissions = []
    if frappe.has_permission(doctype, "read"):
        permissions.append("read")
    # ... more permissions
    return permissions
```

---

### DT API Endpoints

Located in `frappe_theme/dt_api.py`

**Datatable-specific API endpoints**

---

### WP API Endpoints

Located in `frappe_theme/wp_api.py`

**WordPress integration API**

---

## ⚙️ Configuration

### Hooks Configuration

**File:** `frappe_theme/hooks.py`

#### App Metadata

```python
app_name = "frappe_theme"
app_title = "Frappe Theme"
app_publisher = "Suvaidyam"
app_description = "A custom app to customize color theme of frappe desk and web"
app_email = "tech@suvaidyam.com"
app_license = "mit"
```

#### CSS Includes

```python
app_include_css = [
    "/assets/frappe_theme/css/frappe_theme.css",
    "/assets/frappe_theme/css/number_card_mapper.css"
]
```

#### JS Includes

```python
app_include_js = [
    "global_exporter.bundle.js",
    "sva_workspace.bundle.js",
    "overwrite_form.bundle.js",
    "overwrite_workflow.bundle.js",
    "override_date_field.bundle.js",
    "frappe_theme.bundle.js",
    "override_link.bundle.js",
    "override_select.bundle.js",
    "override_table_multiselect.bundle.js",
    "override_button.bundle.js",
    "override_multiselect.bundle.js",
    "/assets/frappe_theme/js/svadb.js",
    "/assets/frappe_theme/js/fields_comment.js",
    "/assets/frappe_theme/js/extended_chart.js",
    "/assets/frappe_theme/js/mobile_view.js",
    "/assets/frappe_theme/js/utils.js",
    "/assets/frappe_theme/js/custom_import.js",
    "/assets/frappe_theme/js/sva_dt_utils.js",
    "/assets/frappe_theme/js/customizations.js",
    "/assets/frappe_theme/js/doctype/global_doctype.js",
    "/assets/frappe_theme/js/breadcrumb_override.js",
    "/assets/frappe_theme/js/sidebar_override.js",
    "/assets/frappe_theme/js/multi_image_gallery.js"
]
```

#### Boot Info

```python
extend_bootinfo = "frappe_theme.boot.boot_theme"
```

#### Web Includes

```python
web_include_css = "/assets/frappe_theme/css/frappe_theme.css"
web_include_js = "/assets/frappe_theme/js/frappe_theme.bundle.js"
```

#### Web Form Includes

```python
webform_include_js = {
    "*": ["public/js/web_form/common_web_form.bundle.js"]
}
```

#### DocType JS

```python
doctype_js = {
    "Workflow": "public/js/doctype/workflow.js",
    "Web Form": "public/js/doctype/web_form.js",
    "Customize Form": [
        "public/js/doctype/property_setter.js",
        "public/js/doctype/customize_form.js"
    ],
    "DocType": [
        "public/js/doctype/property_setter.js",
        "public/js/doctype/doctype.js"
    ]
}
```

#### Jinja Methods

```python
jinja = {
    "methods": "frappe_theme.utils.jinja_methods"
}
```

#### After Migrate

```python
after_migrate = "frappe_theme.setup.migration.after_migrate"
```

#### DocType Overrides

```python
override_doctype_class = {
    "Report": "frappe_theme.overrides.report.CustomReport"
}
```

#### Document Events

```python
doc_events = {
    "*": {
        "validate": "frappe_theme.utils.global_sanitizer.sanitize_all_fields",
        "before_insert": "frappe_theme.utils.data_protection.encrypt_doc_fields",
        "before_save": "frappe_theme.utils.data_protection.encrypt_doc_fields",
        "onload": "frappe_theme.utils.data_protection.decrypt_doc_fields"
    },
    "Version": {
        "validate": "frappe_theme.controllers.timeline.validate"
    },
    "Report": {
        "before_save": "frappe_theme.overrides.report.before_save"
    },
    "File": {
        "after_insert": "frappe_theme.controllers.sva_integrations.cloud_assets.file_upload_to_cloud",
        "on_trash": "frappe_theme.controllers.sva_integrations.cloud_assets.delete_from_cloud"
    }
}
```

#### Method Overrides

```python
override_whitelisted_methods = {
    "frappe.model.workflow.apply_workflow": 
        "frappe_theme.overrides.workflow.custom_apply_workflow",
    "frappe.model.workflow.get_transitions": 
        "frappe_theme.overrides.workflow.get_custom_transitions",
    "frappe.desk.reportview.get": 
        "frappe_theme.utils.data_protection.mask_doc_list_view",
    "frappe.desk.listview.get": 
        "frappe_theme.utils.data_protection.mask_doc_list_view",
    "frappe.desk.query_report.run": 
        "frappe_theme.utils.data_protection.mask_query_report",
    "frappe.desk.query_report.export_query": 
        "frappe_theme.utils.data_protection.mask_query_report_export_query"
}
```

#### Scheduler Events

```python
scheduler_events = {
    "cron": {
        "*/10 * * * *": [
            "frappe_theme.cron.sync_ticket_status.run"
        ]
    }
}
```

---

### Site Configuration

**File:** `site_config.json`

```json
{
    "frappe_theme_encryption_key": "your-encryption-key-here",
    "frappe_theme_cloud_provider": "aws",
    "frappe_theme_aws_access_key": "your-aws-key",
    "frappe_theme_aws_secret_key": "your-aws-secret",
    "frappe_theme_aws_bucket": "your-bucket-name",
    "frappe_theme_openai_key": "your-openai-key",
    "frappe_theme_debug": 0,
    "developer_mode": 0
}
```

---

### Package Configuration

#### package.json

```json
{
  "name": "frappe_theme",
  "version": "1.0.0",
  "description": "A custom app to customize color theme of frappe desk and web",
  "dependencies": {
    "chart.js": "^4.1.1",
    "chartjs-plugin-datalabels": "^2.2.0",
    "pinia": "^3.0.2",
    "vue": "^3.5.13",
    "vue-chartjs": "^5.3.2",
    "vue-router": "^4.5.0"
  },
  "author": "Suvaidyam",
  "license": "ISC"
}
```

#### pyproject.toml

```toml
[project]
name = "frappe_theme"
version = "1.0.0"
description = "A custom app to customize color theme of frappe desk and web"
authors = [
    {name = "Suvaidyam", email = "tech@suvaidyam.com"}
]
license = {text = "MIT"}
requires-python = ">=3.10"

[tool.ruff]
line-length = 110
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "W", "I"]
ignore = ["E501"]
```

---

## 🛠️ Development Guide

### Setup Development Environment

```bash
# Clone repository
cd apps
git clone https://github.com/your-repo/frappe_theme
cd frappe_theme

# Install Node dependencies
yarn install

# Install pre-commit hooks
pre-commit install

# Build assets
cd ../..
bench build --app frappe_theme
```

### Pre-commit Configuration

**File:** `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.2.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.56.0
    hooks:
      - id: eslint
        args: [--fix]

  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        args: [--write]
```

### Building Assets

```bash
# Build all assets
bench build --app frappe_theme

# Build specific bundle
bench build --app frappe_theme --bundle frappe_theme.bundle.js

# Watch for changes (development)
bench watch

# Force rebuild
bench build --app frappe_theme --force
```

### Running Tests

```bash
# Run all tests
bench run-tests --app frappe_theme

# Run specific test file
bench run-tests --app frappe_theme --module frappe_theme.tests.test_api

# Run with coverage
bench run-tests --app frappe_theme --coverage

# Run specific test class
bench run-tests --app frappe_theme --test frappe_theme.tests.test_api.TestAPI
```

### Code Quality

```bash
# Run ruff linter
ruff check .

# Run ruff formatter
ruff format .

# Run ESLint
eslint frappe_theme/public/js

# Run Prettier
prettier --write "frappe_theme/public/js/**/*.js"
```

### Project Structure

```
frappe_theme/
├── frappe_theme/              # Python module
│   ├── __init__.py
│   ├── hooks.py              # App configuration
│   ├── api.py                # Main API
│   ├── dt_api.py             # Datatable API
│   ├── wp_api.py             # WordPress API
│   ├── boot.py               # Boot configuration
│   ├── install.py            # Installation scripts
│   ├── print.py              # Print customizations
│   │
│   ├── apis/                 # API modules
│   ├── controllers/          # Business logic
│   ├── utils/                # Utilities
│   ├── overrides/            # Overrides
│   ├── services/             # External services
│   ├── cron/                 # Scheduled jobs
│   ├── setup/                # Setup & migration
│   ├── sva_integrations/     # Integrations
│   │
│   ├── frappe_theme/         # Module DocTypes
│   │   ├── doctype/          # DocType definitions
│   │   ├── page/             # Custom pages
│   │   ├── report/           # Custom reports
│   │   ├── number_card/      # Number cards
│   │   └── custom/           # Custom scripts
│   │
│   ├── public/               # Static assets
│   │   ├── js/               # JavaScript
│   │   │   ├── custom_components/
│   │   │   ├── fields_overwrite/
│   │   │   ├── datatable/
│   │   │   ├── vue/
│   │   │   ├── doctype/
│   │   │   └── web_form/
│   │   ├── css/              # Stylesheets
│   │   ├── images/           # Images
│   │   ├── boundaries/       # Geographic data
│   │   └── json/             # JSON data
│   │
│   ├── templates/            # Jinja templates
│   ├── www/                  # Web pages
│   ├── config/               # Configuration
│   ├── fixtures/             # Fixture data
│   ├── patches/              # Database patches
│   └── tests/                # Test files
│
├── .github/
│   └── workflows/            # CI/CD workflows
│
├── node_modules/             # Node dependencies
├── package.json              # Node config
├── yarn.lock                 # Yarn lock
├── pyproject.toml            # Python config
├── .eslintrc                 # ESLint config
├── .editorconfig             # Editor config
├── .gitignore                # Git ignore
├── .pre-commit-config.yaml   # Pre-commit hooks
├── README.md                 # Basic readme
├── DOCUMENTATION.md          # This file
└── license.txt               # MIT License
```

---

## 🚀 Deployment

### Production Deployment

```bash
# Pull latest changes
cd apps/frappe_theme
git pull origin main

# Update dependencies
yarn install

# Build assets
cd ../..
bench build --app frappe_theme

# Run migrations
bench migrate

# Clear cache
bench clear-cache

# Restart services
sudo supervisorctl restart all
```

### Docker Deployment

```dockerfile
FROM frappe/bench:latest

# Install app
RUN bench get-app https://github.com/your-repo/frappe_theme --branch main
RUN bench install-app frappe_theme

# Build assets
RUN bench build --app frappe_theme

# Expose port
EXPOSE 8000
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Assets Not Loading

```bash
bench clear-cache
bench build --app frappe_theme --force
bench restart
```

#### 2. Permission Errors

```bash
bench execute frappe_theme.setup.reset_permissions
```

#### 3. Database Migration Issues

```bash
bench migrate --app frappe_theme
```

#### 4. JavaScript Errors

Check browser console and rebuild:
```bash
bench build --app frappe_theme --force
```

### Debug Mode

Enable in `site_config.json`:
```json
{
    "developer_mode": 1,
    "frappe_theme_debug": 1
}
```

### Logs

```bash
# Error logs
tail -f sites/your-site/logs/error.log

# Web logs
tail -f sites/your-site/logs/web.log

# Worker logs
tail -f sites/your-site/logs/worker.log
```

---

## 📄 License

MIT License - Copyright (c) 2024 Suvaidyam

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Install pre-commit hooks** (`pre-commit install`)
4. **Make your changes** - Write clean, documented code
5. **Run tests and linting**
6. **Commit your changes** (`git commit -m 'Add amazing feature'`)
7. **Push to your fork** (`git push origin feature/amazing-feature`)
8. **Open a Pull Request**

### Contribution Guidelines

- **Code Style**: Follow PEP 8 for Python, ESLint for JavaScript
- **Documentation**: Update docs for new features
- **Tests**: Add tests for bug fixes and new features
- **Commits**: Use clear, descriptive commit messages
- **Issues**: Reference issue numbers in commits and PRs

**[→ See detailed contributing guide in README.md](README.md#-contributing)**

---

## 📞 Support

- **Email:** tech@suvaidyam.com
- **GitHub Issues:** [Report bugs](https://github.com/Suvaidyam/frappe_theme/issues)
- **Documentation:** [Full docs](https://docs.your-domain.com)

---

## 🙏 Acknowledgments

- Frappe Framework team
- All contributors
- Open-source community

---

**Made with ❤️ by Suvaidyam**



---

**Made with ❤️ by [Suvaidyam](https://suvaidyam.com)**

---

<div align="center">

### 📚 Navigation

[🏠 Home](README.md) • [📖 Documentation](DOCUMENTATION.md) • [⚡ Quick Start](QUICK_START.md) • [📋 Features](FEATURES_SUMMARY.md)

**[⬆ Back to Top](#-frappe-theme---complete-documentation)**

</div>
