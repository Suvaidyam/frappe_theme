// Copyright (c) 2026, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("SVA Ticket", {
	refresh(frm) {
		if (frm.doc.status === "Closed") {
			frm.set_read_only();
		}
	},
});
