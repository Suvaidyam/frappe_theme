# Data Protection

Frappe Theme provides **field-level encryption** and **data masking** to protect sensitive data across forms, list views, reports, and exports.

## Overview

| Feature | Description |
|---------|-------------|
| **Encryption** | Fernet symmetric encryption for field values stored in the database |
| **Masking** | Display masked values (e.g., `XXXXX`) based on user roles and context |
| **Sanitization** | XSS protection by sanitizing all document fields on validate |
| **Regex Validation** | Custom regex patterns for field input validation |

## How It Works

The data protection system hooks into Frappe's document lifecycle:

```
Save Flow:    Form → before_insert/before_save → encrypt fields → Database
Load Flow:    Database → onload → decrypt fields → Form
List View:    Database → reportview.get override → decrypt + mask → List
Report View:  Database → query_report.run override → decrypt + mask → Report
```

### Document Event Hooks

| Event | Hook | Action |
|-------|------|--------|
| `before_insert` | `encrypt_doc_fields` | Encrypt marked fields before first save |
| `before_save` | `encrypt_doc_fields` | Encrypt marked fields before every save |
| `onload` | `decrypt_doc_fields` | Decrypt fields when loading a document |
| `validate` | `sanitize_all_fields` | Sanitize all fields for XSS (if enabled) |

### Whitelisted Method Overrides

| Original Method | Override | Purpose |
|----------------|----------|---------|
| `frappe.desk.reportview.get` | `mask_doc_list_view` | Decrypt + mask in list views |
| `frappe.desk.listview.get` | `mask_doc_list_view` | Decrypt + mask in list views |
| `frappe.desk.query_report.run` | `mask_query_report` | Decrypt + mask in reports |
| `frappe.desk.query_report.export_query` | `mask_query_report_export_query` | Decrypt + mask in report exports |

## Setting Up Encryption

### Step 1: Generate an Encryption Key

Generate a Fernet encryption key and add it to your site's `site_config.json`:

```bash
# Generate a key using Python
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add the key to `site_config.json`:

```json
{
    "encryption_key": "your-generated-fernet-key-here"
}
```

> **Important**: Keep this key safe. If lost, encrypted data cannot be recovered.

### Step 2: Configure Field-Level Encryption

Use the **SVAProperty Setter** DocType or the Customize Form interface to mark fields for encryption.

The data protection configuration is stored as a JSON property on the field's `data_protection` attribute:

```json
{
    "encrypt": true
}
```

### Step 3: Save the Configuration

Once configured, all future saves of documents with that DocType will automatically encrypt the marked fields. Existing data is **not** retroactively encrypted — only new saves will encrypt values.

### How Encryption Works

- Uses **Fernet** symmetric encryption from the `cryptography` library
- Encrypted values start with `gAAAA` prefix (used to detect already-encrypted values)
- Encryption happens **before** the value is written to the database
- Decryption happens **after** the value is read from the database
- The encryption key is read from `site_config.json` at runtime

## Setting Up Data Masking

Masking hides sensitive data from users who don't have the required roles, while still allowing authorized users to see the actual values.

### Step 1: Configure Masking Rules

Add masking configuration to a field's `data_protection` JSON:

```json
{
    "encrypt": true,
    "masking": {
        "apply_masking_on": ["form", "list", "report"],
        "masking_strategy": "partial",
        "masking_character": "*",
        "visible_prefix": 2,
        "visible_suffix": 4,
        "role_based_unmask": ["System Manager", "HR Manager"]
    }
}
```

### Masking Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| `full` | Replace entire value with masking character | `John Doe` → `XXXXXXXX` |
| `partial` | Keep prefix and suffix visible | `1234567890` → `12****7890` |
| `regex` | Apply regex pattern for masking | Custom pattern matching |
| `custom` | Use a custom Python function | Provide `custom_function` path |

### Masking Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `apply_masking_on` | Array | Where to apply masking: `form`, `list`, `report` |
| `masking_strategy` | String | `full`, `partial`, `regex`, or `custom` |
| `masking_character` | String | Character used for masking (default: `X`) |
| `visible_prefix` | Int | Number of characters visible at start (partial only) |
| `visible_suffix` | Int | Number of characters visible at end (partial only) |
| `role_based_unmask` | Array | Roles that can see the unmasked value |
| `pattern` | String | Regex pattern (regex strategy only) |
| `custom_function` | String | Dotted path to custom masking function (custom strategy only) |

### Custom Masking Function

For the `custom` strategy, provide a Python function path:

```json
{
    "masking": {
        "masking_strategy": "custom",
        "custom_function": "my_app.utils.mask_aadhaar"
    }
}
```

The function receives `(value, masking_character)` and must return the masked string:

```python
def mask_aadhaar(value, char):
    # Show only last 4 digits of Aadhaar
    if len(value) >= 4:
        return char * (len(value) - 4) + value[-4:]
    return char * len(value)
```

## XSS Sanitization

Enable global field sanitization to prevent XSS attacks:

1. Go to **My Theme** > **Features** tab
2. Check **"Sanitize all fields"**
3. Save

When enabled, the `sanitize_all_fields` function runs on the `validate` event of **every** DocType, cleaning potentially dangerous HTML/script content from all text fields.

## Regex Validation

Use **SVAProperty Setter** to add regex validation patterns to fields. This validates field input against a pattern before saving.

### Setting Up Regex Validation

Use the API to save regex validation rules:

```python
# Save a regex validation
frappe.call(
    "frappe_theme.apis.sva_property_setter.save_field_data_protection",
    values={
        "doctype": "Employee",
        "fieldname": "aadhaar_number",
        "data_protection": {
            "regex": "^[0-9]{12}$",
            "regex_message": "Aadhaar number must be exactly 12 digits"
        }
    }
)
```

### Retrieving Validation Rules

```python
# Get regex validation for a DocType
rules = frappe.call(
    "frappe_theme.apis.sva_property_setter.get_regex_validation",
    doctype="Employee"
)
```

## Tips

- Encryption adds a small overhead to save/load operations — only encrypt truly sensitive fields
- Masking is applied **after** decryption, so masked values in lists/reports are the actual decrypted values with masking applied
- Users with roles listed in `role_based_unmask` see the full unmasked value
- The encryption key should be backed up securely — losing it means losing access to all encrypted data
- Encrypted values are stored as base64 strings starting with `gAAAA` and are typically longer than the original values
- Report exports also respect masking rules, so exported CSV/Excel files contain masked data for unauthorized users
