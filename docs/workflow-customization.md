# Workflow Customization

Frappe Theme extends Frappe's built-in workflow system with **approval assignments**, **workflow audit trail**, and **timeline visualization**.

## Overview

| Feature | Description |
|---------|-------------|
| **Approval Assignments** | Assign specific users to approve/reject at each workflow state |
| **Custom Transitions** | Dynamic Approve/Reject actions based on assignments |
| **Workflow Audit Trail** | Full history of workflow actions via SVA Workflow Action DocType |
| **Approval Timeline** | Visual timeline showing workflow progression |
| **Dialog Fields** | Require specific fields or comments during workflow transitions |

## How It Works

Frappe Theme overrides two core Frappe workflow methods:

| Original Method | Override | Purpose |
|----------------|----------|---------|
| `frappe.model.workflow.get_transitions` | `get_custom_transitions` | Returns custom Approve/Reject transitions when approval assignments exist |
| `frappe.model.workflow.apply_workflow` | `custom_apply_workflow` | Handles custom approval logic and audit trail |

### Approval Assignment Flow

```
1. User triggers a workflow transition
2. If the transition has "Allow Assignment" enabled:
   → A dialog appears to assign approvers
   → An SVA Workflow Action record is created with approval_assignments
   → The document stays in the current state until all required approvals are done
3. Assigned users see "Approve" and "Reject" buttons
4. When all required users approve:
   → Document moves to the positive (next) state
5. If any required user rejects:
   → Document moves to the negative (rejected) state
```

## Step-by-Step Setup

### Step 1: Create a Standard Frappe Workflow

1. Navigate to **Workflow** (`/app/workflow`)
2. Create a workflow for your DocType (e.g., `Leave Application`)
3. Define states and transitions as usual

### Step 2: Enable Approval Assignments on a Transition

In the Workflow Transition table, the following custom fields are available:

| Field | Description |
|-------|-------------|
| **Allow Assignment** (`custom_allow_assignment`) | Check this to enable approval assignments on this transition |
| **Positive State** (`custom_positive_state`) | State to move to when all required approvals are done |
| **Negative State** (`custom_negative_state`) | State to move to when a required approval is rejected |
| **Comment** (`custom_comment`) | Enable comment field in the workflow dialog |
| **Comment Required** (`custom_comment_required`) | Make the comment mandatory |
| **Selected Fields** (`custom_selected_fields`) | JSON array of additional fields to show in the workflow dialog |

### Step 3: Configure Transition Dialog Fields

You can require users to fill in additional fields when applying a workflow action. Add field definitions to `custom_selected_fields`:

```json
[
    {
        "fieldname": "expected_date",
        "label": "Expected Completion Date",
        "read_only": false,
        "reqd": true,
        "fetch_if_exists": false
    },
    {
        "fieldname": "priority",
        "label": "Priority Level",
        "read_only": false,
        "reqd": false,
        "fetch_if_exists": true
    }
]
```

### Step 4: Using the Workflow

When a user applies a workflow action with approval assignments enabled:

1. A dialog appears with:
   - The configured fields (if any)
   - An **Approval Assignments** table to select approvers
   - A comment field (if enabled)
2. The user selects approvers and fills required fields
3. The document transitions but stays in the current state until approvals are complete

### Step 5: Approving/Rejecting

Assigned approvers see **Approve** and **Reject** buttons on the document:

- **Approve**: Marks the user's assignment as "Approved"
- **Reject**: Marks the user's assignment as "Rejected"

Both actions require a comment (configured via `is_comment_required`).

### Approval Resolution Logic

The system determines the next state based on these rules:

| Scenario | Result |
|----------|--------|
| All required approvers approved | Move to **Positive State** |
| Any required approver rejected | Move to **Negative State** |
| Still pending required approvals | Stay in current state |
| All non-required assignments rejected | Move to **Negative State** |
| Any non-required approved, none pending | Move to **Positive State** |

> "Required" assignments are those with the `required` flag set in the approval_assignments table.

## SVA Workflow Action (Audit Trail)

Every workflow action creates a record in the **SVA Workflow Action** DocType:

| Field | Description |
|-------|-------------|
| Reference DocType | The DocType of the document |
| Reference Name | The document name |
| Workflow Action | The action taken (e.g., "Submit", "Approve", "Reject") |
| Workflow State Previous | State before the action |
| Workflow State Current | State after the action |
| Role | The role that performed the action |
| User | The user who performed the action |
| Comment | Any comment provided during the action |
| Action Data | JSON array of field values changed during the transition |
| Approval Assignments | Child table tracking each approver's status |

### Querying the Audit Trail

```python
# Get workflow history for a document
audit_trail = frappe.get_all(
    "SVA Workflow Action",
    filters={
        "reference_doctype": "Leave Application",
        "reference_name": "LA-001"
    },
    fields=["workflow_action", "workflow_state_previous",
            "workflow_state_current", "user", "comment", "creation"],
    order_by="creation asc"
)
```

## Approval Timeline API

The `get_workflow_audit` API returns a structured workflow audit trail for visualization:

```python
frappe.call(
    "frappe_theme.apis.approval_timeline.get_workflow_audit",
    doctype="Leave Application",
    reference_name="LA-001",
    limit=50
)
```

This returns the workflow state sequence and all actions taken, which the **Approval Timeline** Vue component renders as a visual timeline.

## Approval Tracker

The **Approval Tracker** DocType provides a summary view of approval status across documents. It tracks:

- Which documents are pending approval
- Who the assigned approvers are
- Current approval status per assignee

## After Custom Approval Hook

If your DocType controller has an `after_custom_approval` method, it will be called after a custom approval action completes and the state changes:

```python
class LeaveApplication(Document):
    def after_custom_approval(self, data):
        """Called after custom approval action"""
        action = data["action"]          # "Approve" or "Reject"
        current_state = data["current_state"]
        next_state = data["next_state"]
        comment = data["custom_comment"]

        if action == "Approve" and next_state == "Approved":
            self.send_approval_notification()
```

## Tips

- Approval assignments work alongside standard Frappe workflow transitions — they add an extra layer, not replace it
- The Administrator role can act on any pending approval assignment
- Workflow actions are logged even for standard (non-custom) transitions, providing a complete audit trail
- The audit trail includes field changes made during transitions (stored in `action_data`)
- Use `custom_comment_required` to enforce documentation of approval decisions
