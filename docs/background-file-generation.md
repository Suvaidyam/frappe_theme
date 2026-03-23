# Background File Generation

Run any function in the background with automatic notifications for start, completion (with download link), and failure.

## Overview

The Background File Generation service wraps any existing Python function — no code changes needed. It handles:

- Enqueueing the function as a background job
- Notifying the user when generation starts, completes, or fails
- Automatically capturing files produced via `send_file()` and saving them with a download link
- Detecting previously generated files and prompting the user to download or regenerate

## Quick Start

### JavaScript

```javascript
frappe.background_file.run({
    fn: "myapp.module.generate_report",
    fn_args: [frm.doc.name],
    title: "Monthly Report",
    ref_doctype: "Project",
    ref_docname: frm.doc.name,
});
```

### Python

```python
from frappe_theme.services.background_file.generator import enqueue_in_background

enqueue_in_background(
    fn="myapp.module.generate_report",
    fn_args=["PRJ-001"],
    title="Monthly Report",
    ref_doctype="Project",
    ref_docname="PRJ-001",
)
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `string` | *required* | Dotted path to the Python function to execute |
| `fn_args` | `list` | `[]` | Positional arguments — use for functions with `*args` |
| `fn_kwargs` | `dict` | `{}` | Keyword arguments — use for functions with `**kwargs` |
| `title` | `string` | `"Processing"` | Display title for notifications and file identification |
| `ref_doctype` | `string` | `None` | Reference DocType — links file and notifications to document |
| `ref_docname` | `string` | `None` | Reference document name |
| `queue` | `string` | `"long"` | RQ queue: `"short"`, `"default"`, or `"long"` |
| `timeout` | `int` | `600` | Job timeout in seconds |
| `user` | `string` | current user | User to notify (Python only) |

## How It Works

### Flow

```
User clicks button
    │
    ▼
[JS] Check for existing file (if ref_doctype + ref_docname + title provided)
    │
    ├─ File exists → Show dialog: "Download Existing" / "Generate New"
    │                   │
    │                   ├─ Download → Opens file URL
    │                   └─ Generate → Continue ▼
    │
    └─ No file → Continue ▼

[JS/Python] Call enqueue_in_background()
    │
    ▼
Notification: "{title} - Generation started in the background"
Toast: "Processing in background. Check notifications."
    │
    ▼
Background worker executes function
    │
    ├─ Success + file produced → Save file, notify with download link
    ├─ Success + no file       → Notify "Completed"
    └─ Error                   → Log error, notify "Failed" with error summary
```

### File Capture

The wrapper automatically detects files produced by `send_file()` (or any code that sets `frappe.local.response.filecontent` and `frappe.local.response.filename`). No changes to your existing functions are needed.

### File Storage

Generated files are saved as private `File` docs with:

| Field | Value | Purpose |
|-------|-------|---------|
| `attached_to_doctype` | `ref_doctype` | File appears in document's attachment sidebar |
| `attached_to_name` | `ref_docname` | Links to specific document |
| `attached_to_field` | `title` | Used as key for existing file detection |
| `is_private` | `1` | Only accessible to authorized users |

When regenerating, existing files with the same three references are updated in place.

## Notifications

All notifications appear in the bell icon dropdown. When `ref_doctype` and `ref_docname` are provided, they appear as a blue subtitle line.

### Started
> {title} - Generation started in the background
> <span style="color:#2490EF">{ref_doctype}: {ref_docname}</span>

### Success (with file)
> 🔗 {title} - Ready for Download *(underlines on hover, clicks to download)*
> <span style="color:#2490EF">{ref_doctype}: {ref_docname}</span>

### Success (no file)
> {title} - Completed
> <span style="color:#2490EF">{ref_doctype}: {ref_docname}</span>

### Failed
> ❌ {title} - Generation Failed. Please Retry.
> <span style="color:#2490EF">{ref_doctype}: {ref_docname}</span>
> If this issue persists, please contact support.

Failed notifications include the error details in the `email_content` field, visible when opening the Notification Log form.

## Existing File Dialog

When triggered from JavaScript with all three references (`ref_doctype`, `ref_docname`, `title`), the helper checks if a file already exists. If found, a dialog appears:

> **{title} Already Exists**
>
> A **{title}** was already generated for **{ref_doctype}: {ref_docname}** on **{date}**.
>
> Would you like to download the existing file or generate a new one?
>
> [ Generate New ] &nbsp; [ Download Existing ]

This check is only available from the JS helper, not from direct Python calls.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `frappe_theme.apis.file_manager.generate` | POST | Enqueue a background generation job |
| `frappe_theme.apis.file_manager.check_existing_file` | POST | Check if a file exists for given references |
| `frappe_theme.apis.file_manager.download_file` | POST | Download a file by path |

> **Note:** The `generate` endpoint uses `method_path` as the parameter name (not `fn`) to avoid a conflict with Frappe's internal RPC handler which reserves the `fn` parameter.

## Examples

### Form Button — Positional Args

```javascript
frm.add_custom_button(__("Generate Sanction Letter"), () => {
    frappe.background_file.run({
        fn: "myapp.reports.sanction_letter.generate_sanction_letter",
        fn_args: [frm.doc.name],
        title: "Sanction Letter",
        ref_doctype: frm.doc.doctype,
        ref_docname: frm.doc.name,
    });
}, __("Actions"));
```

### Form Button — Keyword Args

```javascript
frm.add_custom_button(__("Export Budget"), () => {
    frappe.background_file.run({
        fn: "myapp.apis.budget.export_budget_excel",
        fn_kwargs: { grant_name: frm.doc.name, fiscal_year: "2025-26" },
        title: "Budget Export",
        ref_doctype: "Grant",
        ref_docname: frm.doc.name,
    });
}, __("Actions"));
```

### Python — Cron Job

```python
from frappe_theme.services.background_file.generator import enqueue_in_background

def daily_report():
    for project in frappe.get_all("Project", filters={"status": "Active"}):
        enqueue_in_background(
            fn="myapp.reports.daily.generate_daily_report",
            fn_args=[project.name],
            title="Daily Report",
            ref_doctype="Project",
            ref_docname=project.name,
            user="administrator@example.com",
        )
```

## Architecture

```
frappe_theme/
├── services/background_file/
│   ├── __init__.py
│   └── generator.py          # enqueue_in_background, _run, _save_response_file, _notify
├── apis/
│   └── file_manager.py       # generate, check_existing_file, download_file
└── public/
    ├── js/background_file.js  # frappe.background_file.run (JS helper)
    └── css/frappe_theme.css   # .bg-file-download-link hover style
```
