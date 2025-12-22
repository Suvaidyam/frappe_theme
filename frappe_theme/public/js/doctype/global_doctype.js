function open_approval_timeline_dialog(doctype, referenceName, documentTitle) {
	const dialog = new frappe.ui.Dialog({
		title: __("Approval Timeline"),
		size: "extra-large",
		fields: [
			{
				fieldname: "approval_timeline",
				fieldtype: "HTML",
				options: "",
			},
		],
		primary_action_label: __("Close"),
		primary_action() {
			dialog.hide();
		},
	});

	let approval_timeline_html = document.createElement("div");
	dialog.set_df_property("approval_timeline", "options", approval_timeline_html);

	frappe.require("approval_timeline.bundle.js").then(() => {
		new frappe.ui.CustomApprovalTimeline({
			wrapper: approval_timeline_html,
			doctype: doctype,
			referenceName: referenceName,
			documentTitle: documentTitle,
		});
	});

	dialog.show();
}

// Check if doctype has an active workflow
async function has_active_workflow(doctype) {
	try {
		const result = await frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Workflow",
				filters: {
					document_type: doctype,
					is_active: 1,
				},
				fields: ["name"],
				limit_page_length: 1,
			},
		});

		return result.message && result.message.length > 0;
	} catch (error) {
		console.error("Error checking workflow:", error);
		return false;
	}
}

frappe.ui.form.on("*", {
	async validate(frm) {
		const regex_props = await frappe.call(
			"frappe_theme.apis.sva_property_setter.get_regex_validation",
			{
				doctype: frm.doctype,
			}
		);
		for (let prop of regex_props?.message) {
			if (!prop.value) continue;

			let config = (() => {
				try {
					return JSON.parse(prop.value);
				} catch {
					return prop.value;
				}
			})();
			if (!config) continue;
			let fieldname = prop.field_name;
			let regex = new RegExp(config);
			let field_value = frm.doc[fieldname];
			if (frm.fields_dict[fieldname] && field_value) {
				if (!regex.test(field_value)) {
					field_label = await frappe.meta.get_label(frm.doctype, fieldname);
					frappe.throw(
						__("Invalid value entered in '{0}'. Please enter a valid input.", [
							field_label,
						])
					);
				}
			}
		}
	},
	async refresh(frm) {
		// Check if doctype has an active workflow before adding the menu item
		const hasWorkflow = await has_active_workflow(frm.doctype);

		if (hasWorkflow) {
			frm.page.add_menu_item(__("Approval Timeline"), () => {
				open_approval_timeline_dialog(
					frm.doctype,
					frm.doc.name,
					frm.doc.title || frm.doc.name
				);
			});
		}
	},
});
