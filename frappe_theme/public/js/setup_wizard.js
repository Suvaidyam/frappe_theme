frappe.setup.on("before_load", function () {
	frappe.setup.add_slide({
		name: "theme_colors",
		title: __("Theme Colors"),
		icon: "fa fa-paint-brush",
		fields: [
			{
				fieldname: "navbar_color",
				label: __("Navbar Background Color"),
				fieldtype: "Color",
				description: __("Background color for the top navigation bar"),
			},
			{
				fieldname: "navbar_text_color",
				label: __("Navbar Text Color"),
				fieldtype: "Color",
				description: __("Text color for the top navigation bar"),
			},
			{
				fieldname: "button_background_color",
				label: __("Button Background Color"),
				fieldtype: "Color",
				description: __("Background color for primary buttons"),
			},
			{
				fieldname: "button_text_color",
				label: __("Button Text Color"),
				fieldtype: "Color",
				description: __("Text color for primary buttons"),
			},
			{
				fieldname: "secondary_button_background_color",
				label: __("Secondary Button Background Color"),
				fieldtype: "Color",
				description: __("Background color for secondary buttons"),
			},
			{
				fieldname: "secondary_button_text_color",
				label: __("Secondary Button Text Color"),
				fieldtype: "Color",
				description: __("Text color for secondary buttons"),
			},
		],
	});

	frappe.setup.add_slide({
		name: "theme_features",
		title: __("Theme Features"),
		icon: "fa fa-cog",
		fields: [
			{
				fieldname: "hide_fields_comment",
				label: __("Hide Fields Comment"),
				fieldtype: "Check",
				default: 0,
				description: __("Hide the fields comment sidebar by default"),
			},
			{
				fieldname: "show_comment_count_default",
				label: __("Show Comment Count Always"),
				fieldtype: "Check",
				default: 0,
				description: __("Always show comment count badge on fields"),
			},
		],
	});
});
