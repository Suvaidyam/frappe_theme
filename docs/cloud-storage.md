# Cloud Storage

Frappe Theme integrates with **AWS S3** and **Azure Blob Storage** to automatically upload files to the cloud when they are attached to documents, and delete them when the file is trashed.

## Overview

| Feature | Description |
|---------|-------------|
| **Auto-Upload** | Files are automatically uploaded to cloud storage on creation |
| **Auto-Delete** | Files are automatically removed from cloud storage when trashed |
| **Pre-Signed URLs** | Private files are served via time-limited signed URLs |
| **Provider Support** | AWS S3 and Azure Blob Storage |
| **Migration** | Migrate existing local files to cloud storage |
| **Exclusions** | Exclude specific DocTypes from cloud upload |

## How It Works

File operations are hooked into Frappe's document events:

| Event | Hook | Action |
|-------|------|--------|
| `File.after_insert` | `file_upload_to_cloud` | Upload file to cloud, remove local copy, update File URL |
| `File.on_trash` | `delete_from_cloud` | Delete file from cloud storage |

The flow:

```
1. User attaches a file to a document
2. Frappe saves the File document (triggers after_insert)
3. Frappe Theme uploads the file to S3/Azure
4. Local file is deleted from disk
5. File document URL is updated to cloud URL (or API endpoint for private files)
```

## Step-by-Step Setup

### Step 1: Open Cloud Assets Configuration

1. Go to **My Theme** > **Features** tab
2. Click the **"Cloud Assets"** button
3. This opens the **Cloud Assets** DocType configuration

### Step 2: Configure the Provider

#### AWS S3

| Field | Description |
|-------|-------------|
| **Enable** | Check to activate cloud storage |
| **Provider** | Select `AWS` |
| **Path** | S3 bucket and folder path in format `bucket-name/folder-name` |
| **Region Name** | AWS region (e.g., `ap-south-1`) |
| **Access Key** | AWS IAM access key ID |
| **Secret Key** | AWS IAM secret access key (stored encrypted) |
| **Env Manager** | Check to load credentials from `site_config.json` instead |
| **Signed URL Expiry Time** | Expiry time in seconds for pre-signed URLs (default: 120) |

**Using Environment Variables (recommended for production):**

1. Check **Env Manager**
2. Add credentials to `site_config.json`:

```json
{
    "access_key": "your-aws-access-key",
    "secret_key": "your-aws-secret-key"
}
```

**S3 Bucket Requirements:**

- The IAM user must have permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`
- For public files: `s3:PutObjectAcl` permission is also needed
- CORS configuration may be needed for direct browser access

#### Azure Blob Storage

| Field | Description |
|-------|-------------|
| **Enable** | Check to activate cloud storage |
| **Provider** | Select `Azure` |
| **Connection String** | Azure Blob Storage connection string |
| **Container Name** | Name of the blob container |

### Step 3: Configure Exclusions (Optional)

In the **Cloud Asset Exclusion** child table, add DocTypes whose attached files should **not** be uploaded to the cloud:

| Field | Description |
|-------|-------------|
| Include Doctype | DocType name to exclude from cloud uploads |

This is useful for DocTypes where you want files to remain on the local server.

### Step 4: Save and Test

1. Save the Cloud Assets configuration
2. Attach a file to any document
3. Verify the file URL changes to a cloud URL (S3 pre-signed URL or Azure blob URL)
4. Check that the local file has been removed from the server

## File URL Patterns

| File Type | URL Pattern |
|-----------|-------------|
| Private (S3) | `/api/method/frappe_theme.controllers.sva_integrations.cloud_assets.generate_file?key=...&file_name=...` |
| Public (S3) | Pre-signed S3 URL (direct access) |
| Private (Azure) | Similar API endpoint with signed URL redirect |

Private files are served through a Frappe API endpoint that generates a time-limited signed URL and redirects the browser to it.

## S3 Key Structure

Files are organized in S3 using this path structure:

```
{folder_name}/{year}/{month}/{day}/{parent_doctype}/{random_key}_{file_name}
```

Example: `uploads/2025/03/15/Sales Invoice/A1B2C3D4_invoice.pdf`

### Custom Key Generator

You can customize the S3 key generation by adding a hook in your app:

```python
# In your app's hooks.py
s3_key_generator = "my_app.utils.custom_s3_key_generator"
```

```python
# In my_app/utils.py
def custom_s3_key_generator(file_name, parent_doctype, parent_name):
    return f"custom/{parent_doctype}/{parent_name}/{file_name}"
```

## Migrating Existing Files

To upload all existing local files to cloud storage:

```python
frappe.call(
    "frappe_theme.controllers.sva_integrations.cloud_assets.migrate_existing_files"
)
```

This iterates through all File records, checks if they are still local (not already on cloud), and uploads them.

> **Warning**: This can be a long-running operation for sites with many files. Consider running it in a background job.

## Tips

- Pre-signed URLs for private files expire after the configured time (default: 120 seconds) — this means users need an active session to download files
- The `content_hash` field of the File DocType is used to store the S3/Azure key, enabling deletion
- Files attached to excluded DocTypes remain on the local file system
- If cloud storage is disabled, files behave normally (stored locally)
- The cloud upload only applies to new files — existing files are not automatically migrated unless you run the migration function
