# Frappe Theme - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install the App

```bash
cd ~/frappe-bench
bench get-app https://github.com/your-repo/frappe_theme --branch main
bench --site your-site install-app frappe_theme
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

### Initial Setup
- [ ] Install app
- [ ] Configure theme colors
- [ ] Set up logo and branding
- [ ] Configure encryption key (if using encryption)

### Workspace Setup
- [ ] Add heatmaps to relevant workspaces
- [ ] Add custom tables
- [ ] Configure number cards
- [ ] Set up quick filters

### Form Enhancements
- [ ] Add number cards to forms
- [ ] Add charts to forms
- [ ] Configure custom datatables
- [ ] Add field comments

### Security Setup
- [ ] Configure field encryption
- [ ] Set up data masking rules
- [ ] Configure role-based permissions
- [ ] Enable global sanitizer

### Workflow Setup
- [ ] Configure custom workflow actions
- [ ] Set up approval tracking
- [ ] Configure email notifications

---

## 🐛 Quick Troubleshooting

### Issue: Assets not loading
```bash
bench clear-cache
bench build --app frappe_theme --force
bench restart
```

### Issue: Permission errors
```bash
bench execute frappe_theme.setup.reset_permissions
bench clear-cache
```

### Issue: JavaScript errors
1. Check browser console (F12)
2. Rebuild assets: `bench build --app frappe_theme --force`
3. Clear browser cache (Ctrl+Shift+R)

### Issue: Theme not applying
1. Clear cache: `bench clear-cache`
2. Check My Theme DocType is saved
3. Refresh browser (Ctrl+F5)

### Issue: Datatable not showing
1. Check SVADatatable Configuration
2. Verify DocType permissions
3. Check browser console for errors
4. Rebuild: `bench build --app frappe_theme`

---

## 📞 Need Help?

- **Documentation:** [DOCUMENTATION.md](DOCUMENTATION.md)
- **Email:** tech@suvaidyam.com
- **GitHub Issues:** [Report a bug](https://github.com/your-repo/frappe_theme/issues)

---

**Happy Customizing! 🎉**
