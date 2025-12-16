// Copyright (c) 2025, Suvaidyam and contributors
// For license information, please see license.txt
let module_options = [];
frappe.ui.form.on("Approval Tracker", {
	async refresh(frm) {
		module_options = await frappe.xcall(
			"frappe_theme.api.get_approval_trakcer_module_options"
		);
		if (module_options.length) {
			frm.fields_dict.module.set_data(module_options);
			frm.set_value("module", module_options[0].value);
		}
		let wrapper = $(
			document.querySelector(`#page-${frm.meta.name.replace(/ /g, "\\ ")} .page-head`)
		);
		if (wrapper.length) {
			frappe.create_shadow_element(
				wrapper.get(0),
				`<div style="
					background: white;
					padding: 0 20px;
					height: 50px;
					display: flex;
					align-items: center;
					justify-content: space-between;
					position: sticky;
					top: 0;
					z-index: 100;
					box-shadow: none;
				">
					<div>
						<span style="
							font-size: 20px;
							font-weight: 600;
							color: #1f272e;
						">${__("Approval Tracker")}</span>
						<span style="
							font-size: 13px;
							color: #6c7680;
							margin-left: 8px;
						">${__("")}</span>
					</div>
				</div>`
			);
		}
		show_table(frm, frm.doc.module);
		frm.disable_save();
		setTimeout(() => {
			frm.remove_custom_button("Comments", "");
		}, 500);
		set_pending_on_options(frm);
	},
	onload: function (frm) {
		frm.doc.__unsaved = 0; // Marks the document as saved
	},
	pending_on: (frm) => {
		apply_pending_on_filter(frm);
	},
	module: async function (frm) {
		if (frm.doc.module) {
			await set_pending_on_options(frm);
			show_table(frm, frm.doc.module);
			setTimeout(() => {
				apply_pending_on_filter(frm);
			}, 400);
		} else {
			if (module_options.length) {
				frm.fields_dict.module.set_data(module_options);
				frm.set_value("module", module_options[0].value);
			}
		}
	},
});

const show_table = async (frm, document_type) => {
	let card_wrapper = document.createElement("div");
	frm.set_df_property("state_card", "options", card_wrapper);
	if(!document_type || document_type == "N/A"){
		card_wrapper.innerHTML = `
		<div style="height: 150px; gap: 10px;" id="form-not-saved" class="d-flex flex-column justify-content-center align-items-center p-3 card rounded my-3">
			<svg class="icon icon-xl" style="stroke: var(--text-light);">
				<use href="#icon-small-file"></use>
			</svg>
			${__("Please select a valid Module to view Approval Tracker.")}
		</div>`;
		return;
	}
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

const set_pending_on_options = async (frm) => {
	if (frm.doc.module && frm.doc.module !== "N/A"){
		let pending_on_options = [{ label: "Me", value: "me" }];
		let response = await frappe.xcall("frappe_theme.api.get_workflow_based_users", {
			doctype: frm.doc.module,
		});
		if (response && response.length) {
			pending_on_options = pending_on_options.concat(response);
		}
		frm.fields_dict.pending_on.set_data(pending_on_options);
	}
};
const apply_pending_on_filter = async (frm) => {
	if(frm.doc.module && frm.doc.module !== "N/A"){
		if (frm.doc?.pending_on) {
			const result = await frappe.xcall(
				"frappe_theme.api.get_documents_with_available_transitions",
				{
					doctype: frm.doc.module,
					user: frm.doc?.pending_on != "me" ? frm.doc?.pending_on : null,
				}
			);
			if (result?.length) {
				frm.sva_dt_instance.connection.extend_condition = 1;
				frm.sva_dt_instance.connection.extended_condition = JSON.stringify([
					[frm.doc.module, "name", "in", result],
				]);
			} else {
				frm.sva_dt_instance.connection.extend_condition = 1;
				frm.sva_dt_instance.connection.extended_condition = JSON.stringify([
					[frm.doc.module, "name", "in", [""]],
				]);
			}
			await frm.sva_dt_instance.reloadTable();
		} else {
			frm.sva_dt_instance.connection.extend_condition = 0;
			frm.sva_dt_instance.connection.extended_condition = "[]";
			await frm.sva_dt_instance.reloadTable();
		}
	}
};
