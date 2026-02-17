<div align="center">

<img src="https://img.shields.io/badge/%E2%9A%A1-QUICK%20START-blueviolet?style=for-the-badge&labelColor=1a1a2e" alt="Quick Start" />

# ⚡ Frappe Theme — Quick Start Guide

### _Get Up and Running in 5 Minutes_

<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-f7df1e?style=flat-square" alt="License: MIT" /></a>
  <a href="https://frappeframework.com/"><img src="https://img.shields.io/badge/Frappe-Framework-0089ff?style=flat-square" alt="Frappe" /></a>
  <img src="https://img.shields.io/badge/Setup-5_Minutes-4CAF50?style=flat-square" alt="5 Min Setup" />
</p>

<a href="README.md"><img src="https://img.shields.io/badge/🏠_Home-grey?style=flat-square" /></a> · <a href="DOCUMENTATION.md"><img src="https://img.shields.io/badge/📖_Docs-grey?style=flat-square" /></a> · <a href="FEATURES_SUMMARY.md"><img src="https://img.shields.io/badge/📋_Features-grey?style=flat-square" /></a> · <a href="https://github.com/Suvaidyam/frappe_theme/issues"><img src="https://img.shields.io/badge/🐛_Issues-grey?style=flat-square" /></a>

</div>

---

## 📑 Table of Contents

| # | Section | Description |
|:---:|:---|:---|
| 1 | [🚀 5-Minute Setup](#-5-minute-setup) | Install and configure |
| 2 | [📋 Common Use Cases](#-common-use-cases) | Real-world examples |
| 3 | [🎨 Customization Examples](#-customization-examples) | Configuration samples |
| 4 | [🔧 Configuration Checklist](#-configuration-checklist) | Step-by-step checklist |
| 5 | [🐛 Quick Troubleshooting](#-quick-troubleshooting) | Fix common issues |
| 6 | [📞 Need Help?](#-need-help) | Support & resources |

---

<div align="center">

## 🚀 5-Minute Setup

</div>

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 20%; text-align: center; padding: 16px; border: 1px solid #30363d;">

### 1️⃣
**Install**

</td>
<td style="width: 20%; text-align: center; padding: 16px; border: 1px solid #30363d;">

### 2️⃣
**Configure Theme**

</td>
<td style="width: 20%; text-align: center; padding: 16px; border: 1px solid #30363d;">

### 3️⃣
**Add Heatmap**

</td>
<td style="width: 20%; text-align: center; padding: 16px; border: 1px solid #30363d;">

### 4️⃣
**Add Table**

</td>
<td style="width: 20%; text-align: center; padding: 16px; border: 1px solid #30363d;">

### 5️⃣
**Setup Permissions**

</td>
</tr>
</table>

---

### 1️⃣ Install the App

```bash
cd ~/frappe-bench
bench get-app https://github.com/Suvaidyam/frappe_theme --branch main
bench --site your-site install-app frappe_theme
bench setup requirements
bench build --app frappe_theme
bench restart
```

### 2️⃣ Configure Theme

| Step | Action |
|:---:|:---|
| 1 | Login to your site |
| 2 | Go to **Desk > My Theme** |
| 3 | Set Primary Color: `#3498db` |
| 4 | Set Secondary Color: `#2ecc71` |
| 5 | Set Text Color: `#2c3e50` |
| 6 | **Save** and refresh |

### 3️⃣ Add Heatmap to Workspace

| Step | Action |
|:---:|:---|
| 1 | Go to **Desk > SVAWorkspace Configuration** |
| 2 | Create new configuration |
| 3 | Select workspace (e.g., "Sales") |
| 4 | Set DocType: `Sales Order` |
| 5 | Set Date Field: `transaction_date` |
| 6 | Set Value Field: `grand_total` |
| 7 | **Save** |

### 4️⃣ Add Custom Table to Form

| Step | Action |
|:---:|:---|
| 1 | Go to **Desk > SVADatatable Configuration** |
| 2 | Create new configuration |
| 3 | Set Parent DocType: `Customer` |
| 4 | Set Child DocType: `Sales Order` |
| 5 | Set Link Field: `customer` |
| 6 | Add fields to display |
| 7 | **Save** |

### 5️⃣ Setup Bulk Permissions

| Step | Action |
|:---:|:---|
| 1 | Go to **Desk > Bulk Role Profile Permissions** |
| 2 | Select DocType |
| 3 | Click "**Load Role Profiles**" |
| 4 | Apply preset (e.g., "Full Access") |
| 5 | Click "**Apply Permissions**" |

---

<div align="center">

## 📋 Common Use Cases

</div>

### 🔢 Use Case 1: Add Number Card to Form

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

### 📋 Use Case 2: Custom Datatable with Events

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
            fields.forEach(field => {
                if (field.fieldname === 'internal_field') {
                    field.hidden = 1;
                }
            });
        }
    }
};
```

### ✅ Use Case 3: Add Approval Timeline

```python
# In your DocType's Python file
@frappe.whitelist()
def get_approval_history(name):
    from frappe_theme.apis.approval_timeline import get_timeline
    return get_timeline('Sales Order', name)
```

### 🔐 Use Case 4: Encrypt Sensitive Field

```python
# In Custom Field
{
    "fieldname": "ssn",
    "fieldtype": "Data",
    "label": "SSN",
    "encrypt": 1  # Add this property
}
```

### 📤 Use Case 5: Export Data as JSON

```python
import frappe
from frappe_theme.apis.export_json import export_data

data = export_data(
    doctype='Customer',
    filters={'territory': 'India'},
    fields=['name', 'customer_name', 'email']
)
```

---

<div align="center">

## 🎨 Customization Examples

</div>

### 🌈 Example 1: Custom Theme Colors

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

### 🔥 Example 2: Workspace Heatmap

```javascript
{
    "workspace": "Sales",
    "heatmap_doctype": "Sales Order",
    "date_field": "transaction_date",
    "value_field": "grand_total",
    "color_scheme": "green",
    "start_date": "2024-01-01"
}
```

### 📋 Example 3: Custom Datatable

```javascript
{
    "doctype": "Customer",
    "fields": ["name", "customer_name", "territory",
               "customer_group", "mobile_no", "email_id"],
    "filters": { "disabled": 0, "territory": "India" },
    "page_length": 20,
    "enable_actions": true,
    "custom_actions": [
        { "label": "Send Email", "method": "send_welcome_email", "icon": "mail" }
    ]
}
```

---

<div align="center">

## 🔧 Configuration Checklist

</div>

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 24px; border: 1px solid #30363d;">

### 🚀 Initial Setup
- [ ] Install app
- [ ] Configure theme colors
- [ ] Set up logo and branding
- [ ] Configure encryption key (if needed)

<sub><a href="#1️⃣-install-the-app">→ Installation guide</a></sub>

---

### 🖥️ Workspace Setup
- [ ] Add heatmaps to relevant workspaces
- [ ] Add custom tables
- [ ] Configure number cards
- [ ] Set up quick filters

<sub><a href="DOCUMENTATION.md#2--workspace-enhancements">→ Workspace guide</a></sub>

---

### 📝 Form Enhancements
- [ ] Add number cards to forms
- [ ] Add charts to forms
- [ ] Configure custom datatables
- [ ] Add field comments

<sub><a href="DOCUMENTATION.md#9--form-enhancements">→ Form guide</a></sub>

</td>
<td style="width: 50%; vertical-align: top; padding: 24px; border: 1px solid #30363d;">

### 🔐 Security Setup
- [ ] Configure field encryption
- [ ] Set up data masking rules
- [ ] Configure role-based permissions
- [ ] Enable global sanitizer

<sub><a href="DOCUMENTATION.md#6--security--data-protection">→ Security guide</a></sub>

---

### 🔄 Workflow Setup
- [ ] Configure custom workflow actions
- [ ] Set up approval tracking
- [ ] Configure email notifications

<sub><a href="DOCUMENTATION.md#5--workflow-management">→ Workflow guide</a></sub>

---

### ✅ Testing
- [ ] Test theme customization
- [ ] Verify permissions
- [ ] Test datatables
- [ ] Check mobile responsiveness

<sub><a href="#-quick-troubleshooting">→ Troubleshooting</a></sub>

</td>
</tr>
</table>

---

<div align="center">

## 🐛 Quick Troubleshooting

</div>

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 24px; border: 1px solid #30363d;">

### ❌ Assets not loading

```bash
bench clear-cache
bench build --app frappe_theme --force
bench restart
```

<sub><a href="DOCUMENTATION.md#-troubleshooting">→ More details</a></sub>

---

### ❌ Permission errors

```bash
bench execute frappe_theme.setup.reset_permissions
bench clear-cache
```

<sub><a href="DOCUMENTATION.md#7--permission-management">→ Permission guide</a></sub>

---

### ❌ JavaScript errors

| Step | Action |
|:---:|:---|
| 1 | Check browser console (F12) |
| 2 | `bench build --app frappe_theme --force` |
| 3 | Clear browser cache (Ctrl+Shift+R) |

<sub><a href="DOCUMENTATION.md#-development-guide">→ Dev guide</a></sub>

</td>
<td style="width: 50%; vertical-align: top; padding: 24px; border: 1px solid #30363d;">

### ❌ Theme not applying

| Step | Action |
|:---:|:---|
| 1 | `bench clear-cache` |
| 2 | Check My Theme DocType is saved |
| 3 | Refresh browser (Ctrl+F5) |

<sub><a href="DOCUMENTATION.md#1--theme-customization">→ Theme guide</a></sub>

---

### ❌ Datatable not showing

| Step | Action |
|:---:|:---|
| 1 | Check SVADatatable Configuration |
| 2 | Verify DocType permissions |
| 3 | Check browser console |
| 4 | `bench build --app frappe_theme` |

<sub><a href="DOCUMENTATION.md#4--custom-datatables-svadatatable">→ Datatable guide</a></sub>

---

### ❌ Still having issues?

```bash
# Check error logs
tail -f sites/your-site/logs/error.log
```

📧 Contact: **tech@suvaidyam.com**

<sub><a href="DOCUMENTATION.md#-troubleshooting">→ Full troubleshooting</a></sub>

</td>
</tr>
</table>

---

<div align="center">

## 📞 Need Help?

</div>

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 📖
**[Complete Docs](DOCUMENTATION.md)**
<sub>Detailed technical guide with API reference</sub>

</td>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 📋
**[Features Summary](FEATURES_SUMMARY.md)**
<sub>200+ features with examples</sub>

</td>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 🐛
**[Report Issues](https://github.com/Suvaidyam/frappe_theme/issues)**
<sub>Bug reports and feature requests</sub>

</td>
</tr>
<tr>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 📧
**Email Support**
<sub>tech@suvaidyam.com</sub>

</td>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 💬
**Community**
<sub>Join our discussions</sub>

</td>
<td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #30363d;">

### 🎓
**Training**
<sub>Custom training available</sub>

</td>
</tr>
</table>

---

<div align="center">

**Happy Customizing! 🎉**

**Made with ❤️ by [Suvaidyam](https://suvaidyam.com)**

### 📚 Navigation

<a href="README.md"><img src="https://img.shields.io/badge/🏠_Home-grey?style=flat-square" /></a> · <a href="DOCUMENTATION.md"><img src="https://img.shields.io/badge/📖_Docs-grey?style=flat-square" /></a> · <a href="QUICK_START.md"><img src="https://img.shields.io/badge/⚡_Quick_Start-active-blue?style=flat-square" /></a> · <a href="FEATURES_SUMMARY.md"><img src="https://img.shields.io/badge/📋_Features-grey?style=flat-square" /></a>

**[⬆ Back to Top](#-frappe-theme--quick-start-guide)**

</div>
