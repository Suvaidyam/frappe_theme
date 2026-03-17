# Additional Components

Frappe Theme includes several UI components that can be embedded inside DocType forms using the "Is Custom Design" connection type in SVADatatable Configuration.

## Custom Design Templates

When creating an SVADatatable Configuration Child entry, setting **Connection Type** to `Is Custom Design` lets you choose from these built-in templates:

| Template | Description |
|----------|-------------|
| Tasks | Task management component with planning features |
| Email | Email communication viewer |
| Timeline | Document activity timeline |
| Gallery | File gallery (see [Gallery & Carousel](gallery-and-carousel.md)) |
| Notes | Document notes and annotations |
| Linked Users | Shows users linked to the document |
| Approval Request | Approval workflow request component |
| HTML View From API | Renders HTML returned by a custom Python API |

### Setting Up Any Template

1. Add an **HTML** field to your DocType
2. Open **SVADatatable Configuration** for that DocType
3. Add a row in **Child Doctypes**:
   - **HTML Field**: select your HTML field
   - **Connection Type**: `Is Custom Design`
   - **Template**: select the desired template
4. Save

## Tasks

The Tasks component integrates with the **SVA Task Planner** DocType to provide task management directly inside a form.

### Features

- Create, edit, and track tasks related to the parent document
- Task status management
- Task planning and assignment

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Tasks` |

## Email / Communication

The Communication component displays email and communication history for the document.

### Features

- View all emails sent and received for the document
- Communication timeline with sender/receiver details
- Integrates with Frappe's built-in communication system

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Email` |

## Timeline

The Timeline component shows a chronological history of all activities on a document.

### Features

- Version history (field changes)
- Comments
- Workflow state changes
- Assignment changes

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Timeline` |

## Notes

The Notes component provides a rich note-taking area linked to the document, using the **Notes** DocType.

### Features

- Add multiple notes to any document
- Rich text support
- Note history

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Notes` |

## Linked Users

Shows all users that are linked to or have interacted with the document.

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Linked Users` |

## Approval Request

Displays the approval request interface for documents with custom approval workflows (see [Workflow Customization](workflow-customization.md)).

### Features

- Shows pending approval assignments
- Approve/Reject buttons for assigned users
- Comment field for approval notes

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `Approval Request` |

## HTML View From API

Renders custom HTML content returned by a Python API endpoint. This is the most flexible template — you can display anything.

### Setup

| Field | Value |
|-------|-------|
| Connection Type | `Is Custom Design` |
| Template | `HTML View From API` |
| Endpoint | `my_app.api.get_dashboard_html` |

### Creating the API Endpoint

Your Python method should return an HTML string:

```python
import frappe

@frappe.whitelist()
def get_dashboard_html(doctype, docname):
    doc = frappe.get_doc(doctype, docname)

    html = f"""
    <div class="custom-dashboard">
        <h4>Dashboard for {doc.name}</h4>
        <div class="stats">
            <p>Status: {doc.status}</p>
            <p>Created: {doc.creation}</p>
        </div>
    </div>
    """
    return html
```

The endpoint is called with the parent document's context, and the returned HTML is injected into the HTML field.

## Approval Tracker

The **Approval Tracker** DocType and its Vue component provide a visual overview of approval status.

### Features

- Track approval status across multiple documents
- Visual status indicators (pending, approved, rejected)
- Filter by DocType, status, or user

This component is available as a Vue bundle (`approval_tracker.bundle.js`) and can be embedded in dashboards.

## Approval Timeline

The **Approval Timeline** Vue component renders a visual timeline of workflow actions.

### Features

- Chronological display of all workflow state changes
- Shows who took each action and when
- Displays comments and field changes at each step
- Color-coded by action type (approve, reject, submit, etc.)

This is powered by the `get_workflow_audit` API (see [Workflow Customization](workflow-customization.md)).

## Field Comments

The **Field Comments** feature adds per-field commenting capability to forms.

### Features

- Add comments on individual fields (not just the whole document)
- Comment thread per field
- Visual indicator showing which fields have comments

### Configuration

Field comments are enabled by default. To disable:

1. Go to **My Theme** > **Features** tab
2. Check **"Hide Fields Comment"**
3. Save

The feature uses the **DocType Field Comment** and **DocType Field Comment Log** DocTypes to store field-level comments.

## SDG Wheel

The **SDG Wheel** component visualizes Sustainable Development Goals alignment.

### Features

- Interactive wheel showing SDG categories
- Visual mapping of document/project SDG alignment
- Color-coded SDG sectors

This component is available as `sdg_wheel.bundle.js` and can be integrated into forms or dashboards.

## Filters Ribbon

The **Filters Ribbon** component adds a visual filter bar above data tables, showing active filters as removable chips/tags.

## Dynamic HTML

The **Dynamic HTML** component renders server-generated HTML content that can update based on document state or filters.

## Tips

- Multiple custom design templates can coexist on the same form by using different HTML fields
- The "HTML View From API" template is the most flexible — use it when none of the built-in templates fit your needs
- All custom design components inherit the parent form's context (doctype, docname) automatically
- Components are loaded lazily — they only initialize when the tab/section containing their HTML field is visible
