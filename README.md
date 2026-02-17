<div align="center">

# 🎨 Frappe Theme

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frappe](https://img.shields.io/badge/Frappe-Framework-blue)](https://frappeframework.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.5-brightgreen.svg)](https://vuejs.org/)

### **A comprehensive customization app for Frappe Framework**

Transform your Frappe/ERPNext instance with advanced theming, data visualization,  
workflow management, and enterprise-grade security.

**Built by [Suvaidyam](https://suvaidyam.com) | Version 1.0.0**

[📖 Documentation](DOCUMENTATION.md) • [⚡ Quick Start](QUICK_START.md) • [📋 Features](FEATURES_SUMMARY.md) • [🐛 Issues](https://github.com/Suvaidyam/frappe_theme/issues)

</div>

---

## 📚 Documentation Hub

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### [📖 Complete Documentation](DOCUMENTATION.md)
**Detailed technical guide**  
API reference, configuration,  
development guide, and more

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### [⚡ Quick Start Guide](QUICK_START.md)
**Get started in 5 minutes**  
Installation, setup, and  
common use cases

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### [📋 Features Summary](FEATURES_SUMMARY.md)
**200+ features overview**  
Complete feature list with  
statistics and use cases

</td>
</tr>
</table>

---

## ✨ Key Features

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### 🎨 **Advanced Theming**
- Complete UI customization with color schemes
- Custom fonts, logos, and branding
- Real-time theme preview
- CSS injection support

[→ Learn more](DOCUMENTATION.md#1--theme-customization)

### 📊 **Data Visualization**
- **Heatmaps** - Activity tracking and pattern analysis
- **Charts** - Line, Bar, Pie, Donut, Area charts
- **Number Cards** - Real-time KPI metrics
- **Custom Tables** - Configurable datatables with advanced filtering

[→ Learn more](DOCUMENTATION.md#3--data-visualization)

### 🔐 **Security & Data Protection**
- **Field-Level Encryption** - AES-256 encryption for sensitive data
- **Data Masking** - Protect sensitive information in views
- **Global Sanitizer** - XSS protection for all inputs
- **Role-Based Access** - Granular permission control

[→ Learn more](DOCUMENTATION.md#6--security--data-protection)

### 🔄 **Workflow Extensions**
- Custom workflow actions with pre/post hooks
- Approval tracking and timeline
- State-based automation
- Email notifications

[→ Learn more](DOCUMENTATION.md#5--workflow-management)

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### 📋 **Bulk Operations**
- Mass permission management
- Role profile configuration
- Workspace permissions
- Property setters

[→ Learn more](DOCUMENTATION.md#7--permission-management)

### 🌐 **Geographic Data**
- Complete India boundaries (States & Districts)
- GeoJSON format for mapping
- 39 individual district files
- 20+ MB of geographic data

[→ Learn more](DOCUMENTATION.md#14--geographic-data)

### 🤖 **AI Integration**
- OpenAI integration for smart features
- WrenAI custom assistant
- Data analysis and suggestions

[→ Learn more](DOCUMENTATION.md#11--integrations)

### 📱 **Mobile Optimized**
- Responsive design
- Touch-optimized controls
- Mobile-friendly forms

[→ Learn more](DOCUMENTATION.md#15--mobile-enhancements)

</td>
</tr>
</table>

---

## 📸 Screenshots

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Heatmaps in Workspace
![Heatmap](https://github.com/user-attachments/assets/ac26b819-3df2-4697-a74d-3dfae57e6f90)

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Custom Tables in Workspace
![Custom Table](https://github.com/user-attachments/assets/d3b65bbf-bbbe-4fae-a5f8-a19556e5c3b6)

</td>
</tr>
<tr>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Number Cards & Charts in Forms
![Number Cards](https://github.com/user-attachments/assets/93181000-ad65-4a90-84ab-d4ad694ab06c)

</td>
<td style="width: 50%; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Custom Linked Tables in Forms
![Linked Tables](https://github.com/user-attachments/assets/b27bdb58-0e4d-489a-93ef-ec434098eca4)

</td>
</tr>
<tr>
<td colspan="2" style="text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

### Theme Customization
![Theme Colors](https://github.com/user-attachments/assets/f56fca43-229a-4246-9fdb-b0e534df6f8b)

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

- Frappe Framework v14+
- Python 3.10+
- Node.js 18+
- MariaDB 10.6+ / PostgreSQL 13+

### Installation (Stable)

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/Suvaidyam/frappe_theme --branch main
bench install-app frappe_theme
bench setup requirements
bench build --app frappe_theme
bench restart
```

### Installation (Development)

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/Suvaidyam/frappe_theme --branch development
bench install-app frappe_theme
bench setup requirements
```

**→ [Complete setup guide](QUICK_START.md)**

---

## 📚 Documentation

<table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
<tr>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**[📖 Complete Documentation](DOCUMENTATION.md)**  
Detailed technical documentation with API reference, configuration options, and development guide

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**[⚡ Quick Start Guide](QUICK_START.md)**  
Get started in 5 minutes with installation, setup, and common use cases

</td>
<td style="width: 33.33%; text-align: center; vertical-align: top; padding: 16px; border: 1px solid #e1e4e8;">

**[📋 Features Summary](FEATURES_SUMMARY.md)**  
Complete feature list (200+) with statistics and use cases

</td>
</tr>
</table>

### What's Included

- ✅ Detailed feature guides with examples
- ✅ API reference with code samples
- ✅ Configuration options and best practices
- ✅ Development guide and contribution guidelines
- ✅ Troubleshooting tips and solutions
- ✅ Real-world use cases and examples

---

## 🎯 Key Components

### Frontend (Vue.js 3)
- **Custom Components** - Heatmaps, Timeline, Charts, Gallery
- **Field Overrides** - Enhanced Link, Select, Multiselect, Date fields
- **Datatables** - Advanced filtering, sorting, bulk actions
- **Mobile View** - Responsive optimizations

### Backend (Python)
- **40+ DocTypes** - Configuration, permissions, workflow
- **Security Utils** - Encryption, masking, sanitization
- **SQL Builder** - Secure query construction
- **APIs** - Export, approval, AI integration
- **Cron Jobs** - Automated synchronization

### Dependencies
```json
{
  "vue": "^3.5.13",
  "vue-router": "^4.5.0",
  "pinia": "^3.0.2",
  "chart.js": "^4.1.1",
  "vue-chartjs": "^5.3.2",
  "chartjs-plugin-datalabels": "^2.2.0"
}
```

---

## 🛠️ Development

### Setup Development Environment

```bash
# Clone and install
cd apps/frappe_theme
yarn install
pre-commit install

# Build assets
bench build --app frappe_theme

# Watch for changes
bench watch
```

### Code Quality Tools

- **ruff** - Python linting and formatting
- **eslint** - JavaScript linting
- **prettier** - Code formatting
- **pyupgrade** - Python syntax upgrades

### Running Tests

```bash
# Run all tests
bench run-tests --app frappe_theme

# Run with coverage
bench run-tests --app frappe_theme --coverage
```

---

## 📦 What's Included

### 40+ DocTypes
- Theme configuration
- Workspace customization
- Datatable configuration
- Permission management
- Workflow actions
- Approval tracking
- And more...

### 100+ JavaScript Files
- Vue components
- Custom UI elements
- Field overrides
- Datatable system
- Utilities and helpers

### 20+ MB Geographic Data
- India state boundaries
- District boundaries
- GeoJSON format
- Ready for mapping

### Complete API Suite
- Theme API
- Export API
- Approval API
- AI Integration API
- Meta API

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/frappe_theme.git
   cd frappe_theme
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Install pre-commit hooks**
   ```bash
   pre-commit install
   ```

4. **Make your changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests if applicable

5. **Run tests and linting**
   ```bash
   # Python linting
   ruff check .
   ruff format .
   
   # JavaScript linting
   eslint frappe_theme/public/js
   prettier --write "frappe_theme/public/js/**/*.js"
   
   # Run tests
   bench run-tests --app frappe_theme
   ```

6. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```

7. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

8. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Describe your changes

### Contribution Guidelines

- **Code Style**: Follow PEP 8 for Python, ESLint for JavaScript
- **Documentation**: Update docs for new features
- **Tests**: Add tests for bug fixes and new features
- **Commits**: Use clear, descriptive commit messages
- **Issues**: Reference issue numbers in commits and PRs

### Pre-commit Tools

Pre-commit automatically runs these tools:
- **ruff** - Python linting & formatting
- **eslint** - JavaScript linting
- **prettier** - Code formatting
- **pyupgrade** - Python syntax upgrades

### Need Help?

- Check existing [issues](https://github.com/Suvaidyam/frappe_theme/issues)
- Read the [documentation](DOCUMENTATION.md)
- Email us: tech@suvaidyam.com

---

## 📄 License

This project is licensed under the MIT License - see the [license.txt](license.txt) file for details.

---

## 📞 Support

- **Email:** tech@suvaidyam.com
- **GitHub Issues:** [Report bugs or request features](https://github.com/Suvaidyam/frappe_theme/issues)
- **Documentation:** [Full documentation](DOCUMENTATION.md)

---

## 🙏 Acknowledgments

- Frappe Framework team for the excellent framework
- All contributors who have helped improve this app
- The open-source community

---

## 🗺️ Roadmap

- [ ] Advanced analytics dashboard
- [ ] More AI-powered features
- [ ] Mobile app support
- [ ] Real-time collaboration
- [ ] Advanced workflow designer
- [ ] Custom report builder
- [ ] Multi-language support
- [ ] Dark mode enhancements

---

**Made with ❤️ by [Suvaidyam](https://suvaidyam.com)**

---

<div align="center">

### 📚 Navigation

[🏠 Home](README.md) • [📖 Documentation](DOCUMENTATION.md) • [⚡ Quick Start](QUICK_START.md) • [📋 Features](FEATURES_SUMMARY.md)

**[⬆ Back to Top](#-frappe-theme)**

</div>
