// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Approval Tracker", {
	refresh(frm) {
		if (frm.doc.document_type) {
			show_table(frm, frm.doc.document_type);
		} else {
			show_table(frm, "Fund Request");
		}
		frm.disable_save();
		setTimeout(() => {
			frm.remove_custom_button("Comments", "");
		}, 500);
	},
	onload: function (frm) {
		frm.doc.__unsaved = 0; // Marks the document as saved
	},
	pending_on_me: async (frm) => {
		if (frm.doc?.pending_on_me){
			const result = await frappe.xcall("frappe_theme.api.get_documents_with_available_transitions", {
				doctype: frm.doc.document_type || "Fund Request",
			});
			if (result?.length){
				frm.sva_dt_instance.connection.extend_condition = 1;
				frm.sva_dt_instance.connection.extended_condition = JSON.stringify([
					[frm.doc.document_type || "Fund Request", "name", "in", result],
				])
			}else{
				frm.sva_dt_instance.connection.extend_condition = 1;
				frm.sva_dt_instance.connection.extended_condition = JSON.stringify([
					[frm.doc.document_type || "Fund Request", "name", "in", [""]],
				])
			}
			await frm.sva_dt_instance.reloadTable();
		}else{
			frm.sva_dt_instance.connection.extend_condition = 0;
			frm.sva_dt_instance.connection.extended_condition = "[]";
			await frm.sva_dt_instance.reloadTable();
		}
	},
	module: function (frm) {
		if (frm.doc.document_type) {
			show_table(frm, frm.doc.document_type);
		} else {
			show_table(frm, "Fund Request");
		}
	},
});

const show_table = async (frm, document_type) => {
	let card_wrapper = document.createElement("div");
	frm.set_df_property("state_card", "options", card_wrapper);
	await frappe.require("approval_tracker.bundle.js");

	frm["number_table_instance"] = new frappe.ui.CustomApprovalTracker({
		wrapper: card_wrapper,
		doctype: document_type,
	});

	let wrapper = document.createElement("div");
	frm.set_df_property("approval_tracker", "options", wrapper);

	let wf_field = await frappe.db.get_value(
		"Workflow",
		{ document_type, is_active: 1 },
		"workflow_state_field"
	);
	wf_field = wf_field?.message?.workflow_state_field;

	await frappe.require("sva_datatable.bundle.js");

	frm["sva_dt_instance"] = new frappe.ui.SvaDataTable({
		wrapper: wrapper,
		frm: Object.assign(frm, {
			dt_events: {
				[document_type]: {
					before_load: async function (dt) {
						let wf_positive_closure = await frappe.xcall(
							"frappe_theme.utils.get_wf_state_by_closure",
							{
								doctype: document_type,
								closure_type: "Positive",
							}
						);
						let wf_negative_closure = await frappe.xcall(
							"frappe_theme.utils.get_wf_state_by_closure",
							{
								doctype: document_type,
								closure_type: "Negative",
							}
						);

						if (!frm._custom_state_filter) {
							// Default behavior if no custom filter is set
							dt.additional_list_filters = [
								[
									document_type,
									wf_field,
									"not in",
									[wf_positive_closure, wf_negative_closure],
								],
							];
						} else {
							// Remove default filtering when a specific filter is applied
							dt.additional_list_filters = [
								[document_type, wf_field, "in", frm._custom_state_filter],
							];
						}
					},
					after_workflow_action: async function (dt) {
						try {
							if (dt.frm?.number_table_instance)
								dt.frm.number_table_instance.refresh();
							if (dt.frm?.sva_dt_instance) dt.frm.sva_dt_instance.reloadTable();
						} catch (error) {
							console.error(error, "Error in reload");
						}
					},
				},
			},
		}),
		doctype: document_type,
		connection: {
			connection_type: "Unfiltered",
			unfiltered: 1,
			crud_permissions: '["read"]',
		},
	});

	window.addEventListener("message", async function (event) {
		if (event.data?.type === "FILTER_BY_STATE") {
			const selectedStates = event.data.states;
			frm._custom_state_filter = selectedStates;

			if (frm.sva_dt_instance) {
				await frm.sva_dt_instance.reloadTable();
			}
		}

		if (event.data?.type === "RESET_FILTER") {
			frm._custom_state_filter = null;

			if (frm.sva_dt_instance) {
				await frm.sva_dt_instance.reloadTable();
			}
		}
	});
};
