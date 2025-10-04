frappe.ui.ThemeSwitcher = class CustomThemeSwitcher extends frappe.ui.ThemeSwitcher {
	constructor() {
		super();
	}

	async fetch_theme_list() {
		const r = await frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Theme",
				fields: ["name"],
				limit_page_length: 20,
			},
		});
		return (r.message || []).map((theme) => ({
			name: theme.name,
			label: theme.name,
			info: "Custom theme",
		}));
	}

	async fetch_themes() {
		console.log("Using custom theme switcher");
		// Default themes
		this.themes = [
			{
				name: "light",
				label: "Light",
				info: "Default light theme",
			},
			{
				name: "dark",
				label: "Dark",
				info: "Default dark theme",
			},
			{
				name: "automatic",
				label: "Automatic",
				info: "Uses system's theme to switch between light and dark mode",
			},
		];
		// Add custom themes
		const customThemes = await this.fetch_theme_list();
		this.themes = this.themes.concat(customThemes);
		return this.themes;
	}
};
