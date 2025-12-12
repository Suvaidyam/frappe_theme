// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.query_reports["APPROVAL TRACKER"] = {
	filters: [
		{
			"fieldname": "module",
			"label": __("Document Type"),
			"fieldtype": "Link",
			"options": "DocType"
		},
	],
};
