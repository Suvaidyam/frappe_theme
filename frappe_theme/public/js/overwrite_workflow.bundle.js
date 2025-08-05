frappe.ui.form.States = class SVAFormStates extends frappe.ui.form.States {
	show_actions() {
		var added = false;
		var me = this;

		// if the loaded doc is dirty, don't show workflow buttons
		if (this.frm.doc.__unsaved === 1) {
			return;
		}

		function has_approval_access(transition) {
			let approval_access = false;
			const user = frappe.session.user;
			if (
				user === "Administrator" ||
				transition.allow_self_approval ||
				user !== me.frm.doc.owner
			) {
				approval_access = true;
			}
			return approval_access;
		}

		frappe.workflow.get_transitions(this.frm.doc).then((transitions) => {
			this.frm.page.clear_actions_menu();
			transitions.forEach((d) => {
				if (frappe.user_roles.includes(d.allowed) && has_approval_access(d)) {
					added = true;
					me.frm.page.add_action_item(__(d.action), async function () {
						// set the workflow_action for use in form scripts
						let wf_dialog_fields = JSON.parse(d.custom_selected_fields || "[]");
						let fields = [];
						let action = d.action;
						if (wf_dialog_fields?.length) {
							fields = me.frm.meta?.fields
								.filter((field) => {
									return wf_dialog_fields.some(
										(f) => f.fieldname == field.fieldname
									);
								})
								.map((field) => {
									let field_obj = wf_dialog_fields.find(
										(f) => f.fieldname == field.fieldname
									);
									let field_data = me.frm.doc[field.fieldname];
									let _field = {
										label: field.label,
										fieldname: field.fieldname,
										fieldtype: field.fieldtype,
										default:
											(field_obj?.read_only || field_obj?.fetch_if_exists) &&
											field_data,
										read_only: field_obj?.read_only,
										reqd: field_obj?.read_only ? 0 : field_obj?.reqd,
										options: field.options,
									};
									if (
										!field_obj?.reqd &&
										["Attach", "Attach Image", "Attach File"].includes(
											field.fieldtype
										)
									) {
										if (
											field_data?.startsWith("/private/") ||
											field_data?.startsWith("/files/")
										) {
											_field.label = "";
											_field.fieldtype = "HTML";
											_field.options = `${field.label} :  <a href="${
												window.location.origin + field_data
											}" target="_blank"><i>${field_data}</i></a>`;
											_field.default = "";
											_field.read_only = true;
											_field.reqd = 0;
										}
									}
									return _field;
								});
						} else {
							fields = me.frm.meta?.fields
								?.filter((field) => {
									return field?.wf_state_field == action;
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
						if (fields?.length) {
							try {
								let workflow_state_bg = await frappe.db.get_list(
									"Workflow State",
									{
										fields: ["name", "style"],
									}
								);
								const bg = workflow_state_bg?.find(
									(bg) => bg.name === action && bg.style
								);

								const popupFields = [
									{
										label: "Action Test",
										fieldname: "action_test",
										fieldtype: "HTML",
										options: `<p>Action:  <span style="padding: 4px 8px; border-radius: 100px; color:white;  font-size: 12px; font-weight: 400;" class="bg-${
											bg?.style?.toLowerCase() || "secondary"
										}">${action}</span></p>`,
									},
									...(fields ? fields : []),
								];
								let title = __(me.frm.doctype);
								let dailog = new frappe.ui.Dialog({
									title: title,
									fields: popupFields,
									primary_action_label: __(action),
									secondary_action_label: __("Cancel"),
									secondary_action: () => {
										dailog.hide();
									},
									primary_action: (values) => {
										frappe.dom.freeze();
										// Apply workflow after a small delay to ensure values are set
										frappe
											.xcall("frappe.model.workflow.apply_workflow", {
												doc: {
													...me.frm.doc,
													wf_dialog_fields: values ? values : {},
												},
												action: action,
											})
											.then((doc) => {
												frappe.model.sync(doc);
												me.frm.refresh();
												action = null;
												me.frm.script_manager.trigger(
													"after_workflow_action"
												);
											})
											.finally(() => {
												dailog.hide();
												frappe.dom.unfreeze();
											});
									},
								});

								dailog.show();
							} catch (error) {
								console.error("Error in workflow action handler:", error);
							}
						} else {
							frappe.dom.freeze();
							me.frm.selected_workflow_action = d.action;
							me.frm.script_manager.trigger("before_workflow_action").then(() => {
								frappe
									.xcall("frappe.model.workflow.apply_workflow", {
										doc: me.frm.doc,
										action: d.action,
									})
									.then((doc) => {
										frappe.model.sync(doc);
										me.frm.refresh();
										me.frm.selected_workflow_action = null;
										me.frm.script_manager.trigger("after_workflow_action");
									})
									.finally(() => {
										frappe.dom.unfreeze();
									});
							});
						}
					});
				}
			});

			this.setup_btn(added);
		});
	}
};
