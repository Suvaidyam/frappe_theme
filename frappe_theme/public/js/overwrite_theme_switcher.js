frappe.ui.ThemeSwitcher = class CustomThemeSwitcher extends frappe.ui.ThemeSwitcher {
	constructor() {
		super();
	}

	async fetch_theme_list() {
		const r = await frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Theme", //  "theme_name", "description"
				fields: ["name"],
				limit_page_length: 20,
			},
		});
		return (r.message || []).map((theme) => ({
			name: theme.name,
			label: theme.theme_name || theme.name,
			info: theme.description || "Description is not set",
		}));
	}

	async fetch_themes() {
		console.log("Using custom theme switcher");
		this.themes = await this.fetch_theme_list();
		// Add 'automatic' option if needed
		this.themes.push({
			name: "automatic",
			label: "Automatic",
			info: "Uses system's theme to switch between light and dark mode",
		});
		return this.themes;
	}
};
