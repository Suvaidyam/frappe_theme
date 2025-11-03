// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Contact Us", {
	// refresh(frm) {

	// },
	after_save: function (frm) {
		let prev_route = frappe.get_prev_route();
		frappe.set_route(prev_route);
	},
});
