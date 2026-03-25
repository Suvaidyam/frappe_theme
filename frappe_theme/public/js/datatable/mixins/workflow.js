import { add_custom_approval_assignments_fields } from "../../utils.bundle.js";

const WorkflowMixin = {
	// ================================ Workflow Action  Logic ================================
	async wf_action(selected_state_info, docname, wf_select_el, prevState, doc) {
		let me = this;
		let workflowFormValue;
		let firstAttempt = true;
		let wf_dialog_fields = JSON.parse(selected_state_info.custom_selected_fields || "[]");
		let dialog;
		if (this.frm?.["dt_events"]?.[this.doctype]?.["before_workflow_action"]) {
			let change = this.frm["dt_events"][this.doctype]["before_workflow_action"];
			if (this.isAsync(change)) {
				await change(me, selected_state_info, docname, prevState, doc);
			} else {
				change(me, selected_state_info, docname, prevState, doc);
			}
		}
		if (this.frm?.["dt_global_events"]?.["before_workflow_action"]) {
			let change = this.frm["dt_global_events"]["before_workflow_action"];
			if (this.isAsync(change)) {
				await change(me, selected_state_info, docname, prevState, doc);
			} else {
				change(me, selected_state_info, docname, prevState, doc);
			}
		}

		const bg = me.workflow_state_bg?.find(
			(bg) => bg.name === selected_state_info.next_state && bg?.style
		);
		let meta = await this.sva_db.call({
			method: "frappe_theme.api.get_meta",
			doctype: me.doctype,
		});
		let fields = [];
		if (wf_dialog_fields?.length) {
			fields = meta?.message?.fields
				.filter((field) => {
					return wf_dialog_fields.some((f) => f.fieldname == field.fieldname);
				})
				.map((field) => {
					let field_obj = wf_dialog_fields.find((f) => f.fieldname == field.fieldname);
					return {
						label: field.label,
						fieldname: field.fieldname,
						fieldtype: field.fieldtype,
						default:
							(field_obj?.read_only || field_obj?.fetch_if_exists) &&
							doc[field.fieldname],
						reqd: field_obj?.read_only ? 0 : field_obj?.reqd,
						read_only: field_obj?.read_only,
						options: field.options,
						...(["Table MultiSelect", "Table"].includes(field.fieldtype)
							? {
									data: field_data,
									cannot_add_rows: field_obj?.read_only,
									cannot_delete_rows: field_obj?.read_only,
							  }
							: {}),
					};
				});
		} else {
			fields = meta?.message?.fields
				?.filter((field) => {
					return field?.wf_state_field == selected_state_info.action;
				})
				?.map((field) => {
					return {
						label: field.label,
						fieldname: field.fieldname,
						fieldtype: field.fieldtype,
						reqd: 1,
						mandatory_depends_on: field.mandatory_depends_on,
						depends_on: field.depends_on,
						options: field.options,
					};
				});
		}
		// Add custom fields that don't exist in meta fields
		const customFields = await add_custom_approval_assignments_fields(selected_state_info);
		const popupFields = [
			{
				label: "Action Test",
				fieldname: "action_test",
				fieldtype: "HTML",
				options: `<p>Action:  <span style="padding: 4px 8px; border-radius: 100px; color:white;  font-size: 12px; font-weight: 400;" class="bg-${
					bg?.style?.toLowerCase() || "secondary"
				}">${selected_state_info.action}</span></p>`,
			},
			...(customFields || []),
			...(fields ? fields : []),
		];
		if (!this.skip_workflow_confirmation) {
			workflowFormValue = await new Promise((resolve, reject) => {
				dialog = new frappe.ui.Dialog({
					title: "Confirm",
					size: frappe.utils.get_dialog_size(popupFields),
					fields: popupFields,
					primary_action_label: "Proceed",
					primary_action: (values) => {
						frappe.dom.freeze("Processing...");
						$(me["workflow_dialog"].get_primary_btn()).prop("disabled", true);
						$(me["workflow_dialog"].get_primary_btn()).html(
							'<span style="width: 0.75rem !important; height: 0.75rem !important;" class="spinner-border spinner-border-sm "></span> ' +
								(me["workflow_dialog"].primary_action_label || "Proceed")
						);
						if (firstAttempt) {
							resolve(values);
							firstAttempt = false;
						} else {
							take_action(values);
						}
					},
					secondary_action_label: "Cancel",
					secondary_action: () => {
						dialog.hide();
						reject(false);
						wf_select_el.value = ""; // Reset dropdown value
						wf_select_el.title = prevState;
						frappe.show_alert({
							message: `${selected_state_info.action} Action has been cancelled.`,
							indicator: "orange",
						});
					},
				});
				me["workflow_dialog"] = dialog;
				dialog.show();
				if (this.frm?.["dt_events"]?.[this.doctype]?.["after_workflow_dialog_render"]) {
					let change =
						this.frm["dt_events"][this.doctype]["after_workflow_dialog_render"];
					change(me, selected_state_info, docname, prevState);
				}
				if (this.frm?.["dt_global_events"]?.["after_workflow_dialog_render"]) {
					let change = this.frm["dt_global_events"]["after_workflow_dialog_render"];
					change(me, selected_state_info, docname, prevState);
				}
			});
		}
		async function take_action(values = undefined) {
			try {
				let skip_workflow_values = {};
				if (me?.skip_workflow_confirmation) {
					for (let field of popupFields) {
						skip_workflow_values[field.fieldname] =
							me.form_dialog.get_value(field.fieldname) ||
							me.form_dialog?.fields_dict?.[field.fieldname]?.last_value ||
							"";
					}
				}
				const updateFields = {
					...doc,
					...(values ? values : workflowFormValue && workflowFormValue),
					wf_dialog_fields: {
						...(me.skip_workflow_confirmation
							? skip_workflow_values
							: values
							? values
							: workflowFormValue && workflowFormValue),
					},
					doctype: me.doctype,
				};
				frappe
					.xcall("frappe.model.workflow.apply_workflow", {
						doc: updateFields,
						action: selected_state_info.action,
						is_custom_transition: selected_state_info.is_custom_transition || 0,
						is_comment_required: selected_state_info.is_comment_required || 0,
						custom_comment:
							selected_state_info.is_comment_required == 1
								? values?.wf_comment || ""
								: "",
					})
					.then(async (doc) => {
						const row = me.rows.find((r) => r.name === docname);
						updateFields[me.workflow.workflow_state_field] =
							selected_state_info.next_state;
						if (row) {
							Object.assign(row, updateFields);
							me.rows[row.rowIndex] = doc;
						}
						me.updateTableBody();
						if (!me.skip_workflow_confirmation) {
							frappe.show_alert({
								message: "Action completed successfully",
								indicator: "success",
							});
						}
						frappe.dom.unfreeze();
						if (dialog) {
							$(dialog.get_primary_btn()).prop("disabled", false);
							$(dialog.get_primary_btn()).html(
								dialog?.primary_action_label || "Proceed"
							);
							dialog?.hide();
						}
						if (me?.frm?.["dt_events"]?.[me.doctype]?.["after_workflow_action"]) {
							let change = me.frm["dt_events"][me.doctype]["after_workflow_action"];
							if (me.isAsync(change)) {
								await change(me, selected_state_info, docname, prevState, doc);
							} else {
								change(me, selected_state_info, docname, prevState, doc);
							}
						}
						if (me?.frm?.["dt_global_events"]?.["after_workflow_action"]) {
							let change = me.frm["dt_global_events"]["after_workflow_action"];
							if (me.isAsync(change)) {
								await change(me, selected_state_info, docname, prevState, doc);
							} else {
								change(me, selected_state_info, docname, prevState, doc);
							}
						}
					})
					.finally(() => {
						frappe.dom.unfreeze();
						if (dialog) {
							$(dialog.get_primary_btn()).prop("disabled", false);
							$(dialog.get_primary_btn()).html(
								dialog?.primary_action_label || "Proceed"
							);
						}
					});
			} catch (error) {
				frappe.dom.unfreeze();
				if (dialog) {
					$(dialog.get_primary_btn()).prop("disabled", false);
					$(dialog.get_primary_btn()).html(dialog?.primary_action_label || "Proceed");
				}
				if (error.message) {
					frappe.throw({
						title: "Error",
						message: error.message,
					});
				}
			}
		}
		take_action();
	},
};

export default WorkflowMixin;
