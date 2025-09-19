// Copyright (c) 2024, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("My Theme", {
   refresh(frm) {
       add_customization_buttons(frm);
    },
});
