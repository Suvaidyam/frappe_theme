---
name: background-file
description: Background file generation service. Use when adding background processing for file generation, report exports, or any long-running task that needs user notifications. Covers usage of enqueue_in_background, the JS helper frappe.background_file.run, and the API endpoint.
---

# Background File Generation Service

A reusable wrapper that runs any function in the background and notifies the user via Notification Log (bell icon) on start, completion (with download link), or failure (with error summary).

## Key Files

- `frappe_theme/services/background_file/generator.py` — Core service (`enqueue_in_background`, `_run`, `_save_response_file`, `_notify`)
- `frappe_theme/apis/file_manager.py` — Whitelisted API endpoints (`generate`, `check_existing_file`, `download_file`)
- `frappe_theme/public/js/background_file.js` — Client-side helper (`frappe.background_file.run`)
- `frappe_theme/public/css/frappe_theme.css` — Hover underline style for download notifications

## How It Works

1. User triggers via JS or Python
2. **JS only**: If `ref_doctype`, `ref_docname`, and `title` are all provided, checks for an existing file via `check_existing_file` API
3. If existing file found: shows dialog — **Download Existing** or **Generate New**
4. If no existing file (or user chose "Generate New"): proceeds with generation
5. A "Generation started in the background" notification is created + blue toast
6. The function is enqueued via `frappe.enqueue` on the `long` queue
7. After execution, the wrapper checks `frappe.local.response.filecontent` (set by `send_file()`)
8. If file content exists: updates or creates a private `File` doc (with `attached_to_doctype/name/field`), sends download notification with link
9. If no file content: sends plain "Completed" notification
10. On error: logs error, sends "Failed" notification with error details and support message

## Usage — JavaScript (from a form button)

```javascript
frappe.background_file.run({
    fn: "myapp.module.my_function",
    fn_args: [frm.doc.name],           // positional args (for *args functions)
    fn_kwargs: { key: "value" },        // keyword args (for **kwargs functions)
    title: "My Report",
    ref_doctype: "My Doctype",          // optional: attaches file & links notification to document
    ref_docname: frm.doc.name,          // optional: enables existing file check & file attachment
});
```

## Usage — Python (from controller/cron)

```python
from frappe_theme.services.background_file.generator import enqueue_in_background

enqueue_in_background(
    fn="myapp.module.my_function",
    fn_args=["ARG-001"],
    title="My Report",
    ref_doctype="My Doctype",
    ref_docname="ARG-001",
)
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fn` | *required* | Dotted path string to the Python function |
| `fn_args` | `[]` | Positional arguments (list) — for functions accepting `*args` |
| `fn_kwargs` | `{}` | Keyword arguments (dict) — for functions accepting `**kwargs` |
| `title` | `"Processing"` | Shown in notifications, toast, and used as `attached_to_field` for file lookup |
| `ref_doctype` | `None` | Reference DocType — file attached to it, shown in notification (blue text) |
| `ref_docname` | `None` | Reference document name — shown in notification, used for file lookup |
| `queue` | `"long"` | RQ queue (`"short"`, `"default"`, `"long"`) |
| `timeout` | `600` | Job timeout in seconds |
| `user` | current user | User to notify (Python only) |

## Function Contract

The wrapped function needs **no changes**. If it uses `send_file()` (sets `frappe.local.response.filecontent` and `frappe.local.response.filename`), the wrapper automatically captures the file and creates a download link. Functions that don't produce files also work — they just get a plain "Completed" notification.

## Existing File Detection (JS only)

When triggered from JS with all three references (`ref_doctype`, `ref_docname`, `title`), the helper calls `check_existing_file` API which matches on:
- `attached_to_doctype` = `ref_doctype`
- `attached_to_name` = `ref_docname`
- `attached_to_field` = `title`

If found, a dialog is shown with the last modified date:
> **{title} Already Exists**
> A {title} was already generated for {ref_doctype}: {ref_docname} on {date}.
> Would you like to download the existing file or generate a new one?
> [ Generate New ] [ Download Existing ]

This check does **not** apply when calling from Python.

## File Storage

Files are saved as private `File` docs with:
- `attached_to_doctype` = `ref_doctype` (appears in document's attachments sidebar)
- `attached_to_name` = `ref_docname`
- `attached_to_field` = `title` (used as key for existing file lookup/update)
- `is_private` = 1

When regenerating, if a file already exists with the same three references, it is **updated in place** (same File doc, new content).

## Notification Behavior

| Status | Subject | Extra |
|--------|---------|-------|
| Started | `"{title} - Generation started in the background"` | + blue toast (JS only) |
| Success (file) | `"🔗 {title} - Ready for Download"` | Clickable link, underlines on hover |
| Success (no file) | `"{title} - Completed"` | |
| Failed | `"❌ {title} - Generation Failed. Please Retry."` | Error details in email_content + "contact support" message |

All notifications include a blue ref line: `{ref_doctype}: {ref_docname}` (when provided).
Notifications set `document_type` and `document_name` for the "Open Reference Document" button.

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `frappe_theme.apis.file_manager.generate` | Enqueue background generation. Param `method_path` (not `fn`) to avoid Frappe handler conflict |
| `frappe_theme.apis.file_manager.check_existing_file` | Check if file exists for given `ref_doctype`, `ref_docname`, `title`. Returns `file_url`, `file_name`, `modified` |
| `frappe_theme.apis.file_manager.download_file` | Download a file by path |

## Important Notes

- Use `fn_args` (list) for functions that accept `*args`, use `fn_kwargs` (dict) for functions that accept `**kwargs`
- The API uses `method_path` (not `fn`) to avoid conflict with Frappe's internal `fn` parameter in the RPC handler
- The wrapper calls `frappe.set_user(user)` in the background job to maintain permission context
- Files are saved as private (`is_private=1`)
- Errors are logged via `frappe.log_error()` and visible in Error Log
- The existing file check only works from JS (not Python), since the dialog requires user interaction
- CSS class `bg-file-download-link` on success notifications enables underline-on-hover styling
