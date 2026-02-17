<div align="center">

# ⚡ Frappe Theme - Quick Start Guide

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frappe](https://img.shields.io/badge/Frappe-Framework-blue)](https://frappeframework.com/)

> **Get started in 5 minutes**  
> Installation, setup, and common use cases

[🏠 Home](README.md) • [📖 Documentation](DOCUMENTATION.md) • [📋 Features](FEATURES_SUMMARY.md) • [🐛 Issues](https://github.com/Suvaidyam/frappe_theme/issues)

</div>

---

## 📑 Table of Contents

- [🚀 5-Minute Setup](#-5-minute-setup)
- [📋 Common Use Cases](#-common-use-cases)
- [🎨 Customization Examples](#-customization-examples)
- [🔧 Configuration Checklist](#-configuration-checklist)
- [🐛 Quick Troubleshooting](#-quick-troubleshooting)
- [📞 Need Help?](#-need-help)

---

## 🚀 5-Minute Setup

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 20%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Step 1**  
Install

</td>
<td style="width: 20%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Step 2**  
Configure Theme

</td>
<td style="width: 20%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Step 3**  
Add Heatmap

</td>
<td style="width: 20%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Step 4**  
Add Table

</td>
<td style="width: 20%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**Step 5**  
Setup Permissions

</td>
</tr>
</table>

---

### 1. Install the App

```bash
cd ~/frappe-bench
bench get-app https://github.com/Suvaidyam/frappe_theme --branch main
bench --site your-site install-app frappe_theme
bench setup requirements
bench build --app frappe_theme
bench restart
```

### 2. Configure Theme

1. Login to your site
2. Go to **Desk > My Theme**
3. Set your colors:
   - Primary Color: `#3498db`
   - Secondary Color: `#2ecc71`
   - Text Color: `#2c3e50`
4. Save and refresh

### 3. Add Heatmap to Workspace

1. Go to **Desk > SVAWorkspace Configuration**
2. Create new configuration
3. Select workspace (e.g., "Sales")
4. Add heatmap:
   - DocType: `Sales Order`
   - Date Field: `transaction_date`
   - Value Field: `grand_total`
5. Save

### 4. Add Custom Table to Form

1. Go to **Desk > SVADatatable Configuration**
2. Create new configuration
3. Configure:
   - Parent DocType: `Customer`
   - Child DocType: `Sales Order`
   - Link Field: `customer`
4. Add fields to display
5. Save

### 5. Setup Bulk Permissions

1. Go to **Desk > Bulk Role Profile Permissions**
2. Select DocType
3. Click "Load Role Profiles"
4. Apply preset (e.g., "Full Access")
5. Click "Apply Permissions"

---

## 📋 Common Use Cases

### Use Case 1: Add Number Card to Form

```javascript
// In your DocType's JS file
frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.dashboard.add_indicator(__('Total: {0}', 
                [format_currency(frm.doc.grand_total)]), 'blue');
        }
    }
});
```

### Use Case 2: Custom Datatable with Events

```javascript
frm.dt_events = {
    'Sales Order Item': {
        before_load: function(dt) {
            console.log('Loading datatable...');
        },
        after_insert: async function(dt, response) {
            frappe.show_alert({
                message: 'Item added successfully',
                indicator: 'green'
            });
        },
        customize_form_fields: function(dt, fields) {
            // Hide certain fields
            fields.forEach(field => {
                if (field.fieldname === 'internal_field') {
                    field.hidden = 1;
                }
            });
        }
    }
};
```

### Use Case 3: Add Approval Timeline

```python
# In your DocType's Python file
@frappe.whitelist()
def get_approval_history(name):
    from frappe_theme.apis.approval_timeline import get_timeline
    return get_timeline('Sales Order', name)
```

### Use Case 4: Encrypt Sensitive Field

```python
# In Custom Field
{
    "fieldname": "ssn",
    "fieldtype": "Data",
    "label": "SSN",
    "encrypt": 1  # Add this property
}
```

### Use Case 5: Export Data as JSON

```python
# In your script
import frappe
from frappe_theme.apis.export_json import export_data

data = export_data(
    doctype='Customer',
    filters={'territory': 'India'},
    fields=['name', 'customer_name', 'email']
)
```

---

## 🎨 Customization Examples

### Example 1: Custom Theme Colors

```python
# In My Theme DocType
{
    "primary_color": "#3498db",
    "secondary_color": "#2ecc71",
    "success_color": "#27ae60",
    "warning_color": "#f39c12",
    "danger_color": "#e74c3c",
    "info_color": "#3498db",
    "text_color": "#2c3e50",
    "background_color": "#ecf0f1"
}
```

### Example 2: Workspace Heatmap

```javascript
// Configuration
{
    "workspace": "Sales",
    "heatmap_doctype": "Sales Order",
    "date_field": "transaction_date",
    "value_field": "grand_total",
    "color_scheme": "green",
    "start_date": "2024-01-01"
}
```

### Example 3: Custom Datatable

```javascript
// SVADatatable Configuration
{
    "doctype": "Customer",
    "fields": [
        "name",
        "customer_name",
        "territory",
        "customer_group",
        "mobile_no",
        "email_id"
    ],
    "filters": {
        "disabled": 0,
        "territory": "India"
    },
    "page_length": 20,
    "enable_actions": true,
    "custom_actions": [
        {
            "label": "Send Email",
            "method": "send_welcome_email",
            "icon": "mail"
        }
    ]
}
```

---

## 🔧 Configuration Checklist

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Initial Setup
- [ ] Install app
- [ ] Configure theme colors
- [ ] Set up logo and branding
- [ ] Configure encryption key (if using encryption)

**[→ Installation guide](#1-install-the-app)**

### Workspace Setup
- [ ] Add heatmaps to relevant workspaces
- [ ] Add custom tables
- [ ] Configure number cards
- [ ] Set up quick filters

**[→ Workspace guide](DOCUMENTATION.md#2--workspace-enhancements)**

### Form Enhancements
- [ ] Add number cards to forms
- [ ] Add charts to forms
- [ ] Configure custom datatables
- [ ] Add field comments

**[→ Form guide](DOCUMENTATION.md#9--form-enhancements)**

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Security Setup
- [ ] Configure field encryption
- [ ] Set up data masking rules
- [ ] Configure role-based permissions
- [ ] Enable global sanitizer

**[→ Security guide](DOCUMENTATION.md#6--security--data-protection)**

### Workflow Setup
- [ ] Configure custom workflow actions
- [ ] Set up approval tracking
- [ ] Configure email notifications

**[→ Workflow guide](DOCUMENTATION.md#5--workflow-management)**

### Testing
- [ ] Test theme customization
- [ ] Verify permissions
- [ ] Test datatables
- [ ] Check mobile responsiveness

**[→ Troubleshooting](#-quick-troubleshooting)**

</td>
</tr>
</table>

---

## 🐛 Quick Troubleshooting

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### ❌ Assets not loading

```bash
bench clear-cache
bench build --app frappe_theme --force
bench restart
```

**[→ More details](DOCUMENTATION.md#-troubleshooting)**

---

### ❌ Permission errors

```bash
bench execute frappe_theme.setup.reset_permissions
bench clear-cache
```

**[→ Permission guide](DOCUMENTATION.md#7--permission-management)**

---

### ❌ JavaScript errors

1. Check browser console (F12)
2. Rebuild assets: `bench build --app frappe_theme --force`
3. Clear browser cache (Ctrl+Shift+R)

**[→ Development guide](DOCUMENTATION.md#-development-guide)**

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### ❌ Theme not applying

1. Clear cache: `bench clear-cache`
2. Check My Theme DocType is saved
3. Refresh browser (Ctrl+F5)

**[→ Theme guide](DOCUMENTATION.md#1--theme-customization)**

---

### ❌ Datatable not showing

1. Check SVADatatable Configuration
2. Verify DocType permissions
3. Check browser console for errors
4. Rebuild: `bench build --app frappe_theme`

**[→ Datatable guide](DOCUMENTATION.md#4--custom-datatables-svadatatable)**

---

### ❌ Still having issues?

- Check error logs: `tail -f sites/your-site/logs/error.log`
- Enable debug mode in `site_config.json`
- Contact support: tech@suvaidyam.com

**[→ Full troubleshooting guide](DOCUMENTATION.md#-troubleshooting)**

</td>
</tr>
</table>

---

## 📞 Need Help?

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

📖  
**[Complete Documentation](DOCUMENTATION.md)**  
Detailed technical guide with API reference

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

📋  
**[Features Summary](FEATURES_SUMMARY.md)**  
200+ features with examples

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🐛  
**[Report Issues](https://github.com/Suvaidyam/frappe_theme/issues)**  
Bug reports and feature requests

</td>
</tr>
<tr>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

📧  
**Email Support**  
tech@suvaidyam.com

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

💬  
**Community**  
Join our discussions

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

🎓  
**Training**  
Custom training available

</td>
</tr>
</table>

---

**Happy Customizing! 🎉**

---

**Made with ❤️ by [Suvaidyam](https://suvaidyam.com)**

---

<div align="center">

### 📚 Navigation

[🏠 Home](README.md) • [📖 Documentation](DOCUMENTATION.md) • [⚡ Quick Start](QUICK_START.md) • [📋 Features](FEATURES_SUMMARY.md)

**[⬆ Back to Top](#-frappe-theme---quick-start-guide)**

</div>
