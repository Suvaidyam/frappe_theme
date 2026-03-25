# Approval Timeline

The Approval Timeline is a visual component that shows workflow progression for any document with an active workflow. It consists of two sections:

- **Progress Bar** (top): Shows approval stages as colored dots with connecting lines
- **Action History** (bottom): Detailed log of every workflow action with field values, comments, and approval assignments

Accessible from the form menu: **Menu > Approval Timeline**

## Architecture

```
Form Menu → "Approval Timeline"
    → frappe.require("approval_timeline.bundle.js")
    → new frappe.ui.CustomApprovalTimeline({ wrapper, doctype, referenceName })
        → Vue 3 App (App.vue) mounts
        → Calls frappe_theme.apis.approval_timeline.get_workflow_audit
        → Renders progress bar + action history
```

### File Structure

| File | Purpose |
|------|---------|
| `apis/approval_timeline.py` | Backend API — fetches workflow config, audit trail, and field data |
| `public/js/vue/approval_timeline/App.vue` | Vue 3 SFC — renders progress bar and timeline |
| `public/js/vue/approval_timeline/approval_timeline.bundle.js` | Bundle entry — creates Vue app, registers `frappe.ui.CustomApprovalTimeline` |
| `public/js/doctype/global_doctype.js` | Adds "Approval Timeline" to form menu on all doctypes with active workflows |

## Workflow Configuration

### Custom Fields on Workflow Document State

These fields are added to the standard Frappe **Workflow Document State** child table:

| Field | Fieldname | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| Closure | `custom_closure` | Select | No | Terminal state type. Options: `Positive`, `Negative`, `Neutral`, `Sign-Off Prerequisite`, `Completed`, `Cancelled` |
| Approval Stage | `custom_approval_stage` | Data | No | Stage label for the progress bar. If empty, the state name is used |
| NGO State | `custom_ngo_state` | Data | No | Alternative label shown to NGO users |

### Approval Stage

The `custom_approval_stage` field controls how states are grouped in the progress bar.

**How it works:**
- The progress bar shows **unique approval stages**, not individual workflow states
- Stages are ordered by the row index (`idx`) of their first appearance in the workflow states table
- If `custom_approval_stage` is empty, the **state name** is used as the stage label

**Example — Grouping states into stages:**

| idx | State | Approval Stage | Effect |
|-----|-------|---------------|--------|
| 1 | Pending | Pending | Shows as "Pending" |
| 2 | Sent Back to NGO | Pending | Grouped with idx 1 — same stage |
| 3 | Proposal Submitted | Proposal Submitted | New stage |
| 4 | Proposal Under Review | Proposal Under Review | New stage |
| 5 | MoU Signing ongoing | MoU Signing ongoing | New stage |
| 6 | MoU Signed | MoU Signed | New stage |
| 7 | Approved | *(Positive closure)* | Moved to end |
| 8 | Rejected | *(Negative closure)* | Hidden by default |

When the document is in "Sent Back to NGO" (idx 2), the progress bar shows "Pending" as the active stage because both states share the same approval stage.

### Closure Types

The `custom_closure` field determines terminal state behavior in the progress bar:

| Closure | Progress Bar | Visibility | Icon |
|---------|-------------|------------|------|
| **Positive** | All stages turn green | Shown by default. Hidden when Negative/Neutral is reached | Green checkmark |
| **Negative** | Visited stages green, unvisited grey | Hidden by default. Shown only when reached | Red X |
| **Neutral** | Visited stages green, unvisited grey | Hidden by default. Shown only when reached | Grey clock |
| **Sign-Off Prerequisite** | Normal stage behavior | Always visible | Standard dot |
| **Completed** | Normal stage behavior | Always visible | Standard dot |
| **Cancelled** | Normal stage behavior | Always visible | Standard dot |
| *No closure* | Normal stage behavior | Always visible | Standard dot |

**Stage ordering rule:** Terminal closure stages (`Positive`, `Negative`, `Neutral`) are always placed at the **end** of the progress bar, regardless of their row index. All other stages maintain their row order.

**Mutual exclusivity:** When a Negative or Neutral closure is reached, the Positive stage is hidden (and vice versa). Only the relevant terminal stage is displayed.

## Progress Bar Logic

### Completion Rules

| Current State | Non-closure Stages | Terminal Stage |
|--------------|-------------------|----------------|
| **In progress** (no closure) | Stages before current index = green. Current = grey. After = grey | Positive shown at end (grey) |
| **Positive closure reached** | ALL stages = green | Positive = green checkmark |
| **Negative closure reached** | Stages up to highest visited index = green. Unvisited = grey | Negative = red X |
| **Neutral closure reached** | Stages up to highest visited index = green. Unvisited = grey | Neutral = grey (completed) |

**"Highest visited index" rule:** When Negative/Neutral is reached, the system finds the furthest stage that was actually visited. All stages from the beginning up to that index are marked green, even if some intermediate stages were skipped (e.g., "Sent Back to NGO" was never visited but "Proposal Submitted" after it was).

### Loop-back Behavior

When a document loops back to an earlier state (e.g., "Sent Back to NGO" maps to the same stage as "Pending"), the progress bar returns to that stage's position. The stage becomes grey/active again.

## Bottom Timeline (Action History)

The bottom section shows every workflow action in **reverse chronological order** (newest first).

### Left Panel

Each action shows:
- **Timeline node**: Colored circle with icon (checkmark, X, back arrow, clock)
- **State badge**: Current workflow state with color based on closure
- **Action label**: e.g., "Submit", "Approve", "Reject", "Send Back To NGO"
- **User info**: Avatar with initials, full name, role
- **Timestamp**: Relative time ("5 mins ago") or absolute date

### Right Panel

Each action shows:
- **Field Values**: Fields captured during the transition (from `custom_selected_fields` on the workflow transition)
- **Approval Assignments**: Table showing each approver's user, action status, comment, and remark
- **Comments**: Any comment provided during the action
- **Show More/Less**: Expandable for actions with many fields

### Vertical Line Colors

The vertical line connecting timeline items is colored:
- **Green**: Normal transitions (action was performed successfully)
- **Red**: The transition that resulted in a Negative closure (rejection)
- **Grey**: Default (last item has no line)

### Node Colors

| State Closure | Node Color | Icon |
|--------------|------------|------|
| Positive | Green border, light green bg | Checkmark |
| Negative | Red border, light red bg | X mark |
| Neutral | Grey border, light grey bg | Clock |
| *No closure* | Grey border, light grey bg | Clock |

Actions also get icons based on the action name (fallback when no closure):
- `approve` / `approved` → Checkmark
- `reject` / `rejected` → X mark
- `send back` → Back arrow
- `submit` / `submitted` → Checkmark

## API Reference

### `get_workflow_audit`

**Endpoint:** `frappe_theme.apis.approval_timeline.get_workflow_audit`

**Method:** Whitelisted (requires login)

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctype` | string | Yes | The DocType name |
| `reference_name` | string | No | Specific document name. If omitted, returns all actions for the DocType |
| `limit` | int | No | Maximum actions to return (default: 100) |

**Response:**

```json
{
    "success": true,
    "workflow": "Grant Application Form",
    "workflow_states": [
        {
            "state": "Pending",
            "doc_status": 0,
            "is_optional": 0,
            "approval_stage": "Pending",
            "closure": null
        }
    ],
    "approval_stages": [
        { "stage": "Pending", "closure": null },
        { "stage": "Proposal Submitted", "closure": null },
        { "stage": "Approved", "closure": "Positive" }
    ],
    "state_stage_map": [
        { "state": "Pending", "stage": "Pending", "closure": null },
        { "state": "Sent Back to NGO", "stage": "Pending", "closure": null },
        { "state": "Approved", "stage": "Approved", "closure": "Positive" }
    ],
    "current_doc_state": "Proposal Under Review",
    "actions": [
        {
            "name": "SWA-00001",
            "reference_name": "GAF-0142",
            "workflow_state_previous": "Pending",
            "workflow_state_current": "Proposal Submitted",
            "workflow_action": "Submit",
            "user": "admin@example.com",
            "role": "NGO Admin",
            "comment": "Submitting proposal",
            "creation": "2026-03-24 10:00:00",
            "action_data": [
                {
                    "fieldname": "expected_date",
                    "fieldtype": "Date",
                    "value": "2026-04-01",
                    "label": "Expected Date"
                }
            ],
            "approval_assignments": [
                {
                    "name": "AAC-00001",
                    "fields": [
                        { "label": "User", "value": "John Doe", "fieldname": "user", "fieldtype": "Link" },
                        { "label": "Action", "value": "Approved", "fieldname": "action", "fieldtype": "Data" }
                    ]
                }
            ]
        }
    ],
    "type": "action_taken"
}
```

**Key fields in response:**

| Field | Description |
|-------|-------------|
| `workflow_states` | State sequence derived from transition graph. Each entry includes `approval_stage` and `closure`. |
| `approval_stages` | Unique stages in row order. Terminal closures (Positive, Negative, Neutral) moved to end. Used by the progress bar. |
| `state_stage_map` | Complete mapping of every workflow state to its stage and closure. Used for frontend lookups (e.g., determining if "MoU Signed" has a closure). |
| `actions` | SVA Workflow Action records enriched with `action_data` (field values) and `approval_assignments` (approver table). Ordered newest first. |
| `type` | `"action_taken"` if actions exist, `"no_action"` if none |

### `get_workflow_state_sequence`

**Endpoint:** `frappe_theme.apis.approval_timeline.get_workflow_state_sequence`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow_name` | string | Yes | Name of the Workflow document |

**Returns:** Array of state objects in logical sequence (DFS traversal of transition graph).

### Field-Level Permissions

The API respects field-level permissions:
- `action_data` fields are filtered against the user's permitted fields for the main DocType
- `approval_assignments` are hidden if the user lacks read permission on that field's permlevel in SVA Workflow Action
- Administrator bypasses all field-level permission checks

## Frontend Usage

### Instantiation

The timeline is lazy-loaded as a separate bundle:

```javascript
frappe.require("approval_timeline.bundle.js").then(() => {
    new frappe.ui.CustomApprovalTimeline({
        wrapper: document.getElementById("timeline-container"),
        doctype: "Project Proposal",
        referenceName: "GAF-0142",
        documentTitle: "Project Proposal - Masaan",
    });
});
```

### Constructor Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `wrapper` | HTMLElement | Yes | DOM element to mount the Vue app into |
| `doctype` | string | Yes | The DocType name |
| `referenceName` | string | Yes | The document name |
| `documentTitle` | string | No | Display title in the header |
| `wf_state` | string | No | Override workflow state (instead of reading from document) |

### Methods

| Method | Description |
|--------|-------------|
| `refresh()` | Unmounts and re-creates the Vue app (reloads data) |
| `cleanup()` | Unmounts the Vue app and cleans up |

### Vue Props

The App.vue component accepts these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `doctype` | String | *(required)* | DocType name |
| `referenceName` | String | `null` | Document name |
| `documentTitle` | String | `""` | Display title |
| `workflowState` | String | `null` | Override state |
| `autoLoad` | Boolean | `true` | Auto-fetch data on mount |

### Auto-Registration

The timeline menu item is automatically added to all forms via `global_doctype.js`:
- Checks if user has read permission on `SVA Workflow Action`
- Checks if the DocType has an active workflow (`frappe.model.workflow.has_active_workflow`)
- Adds "Approval Timeline" to the form's **Menu** dropdown
- Opens a dialog with the timeline component

## Theming

The timeline reads theme colors from `frappe.boot.my_theme`:
- `navbar_color` → Used for user avatar background
- `navbar_text_color` → Used for avatar text

If theme colors are not available, default grey avatars are used.

### Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| Success (green) | Completed stages, positive nodes, green lines | `#10b981` |
| Danger (red) | Rejected nodes, negative lines | `#ef4444` |
| Info (blue) | Draft, disbursed states | `#3b82f6` |
| Default (grey) | Pending stages, neutral nodes, default lines | `#94a3b8` / `#e2e8f0` |
