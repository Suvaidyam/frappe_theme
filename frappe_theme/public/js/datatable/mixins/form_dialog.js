const FormDialogMixin = {
	async createFormDialog(
		doctype,
		name = undefined,
		mode = "create",
		additional_action = null,
		data = null,
		primary_action = null
	) {
		let res = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			doctype: doctype,
		});
		let fields = res?.message;
		if (window?.SVADialog?.[doctype]) {
			window?.SVADialog?.[doctype](mode, fields);
			return;
		}
		if (window?.SVAHandleParentFieldProps) {
			let f = window?.SVAHandleParentFieldProps(fields, doctype, name, mode);
			if (f) {
				fields = [...f];
			}
		}
		if (this.frm?.["dt_events"]?.[doctype]?.["customize_form_fields"]) {
			let customize = this.frm?.["dt_events"]?.[doctype]?.["customize_form_fields"];
			let has_additional_action = additional_action ? true : false;
			let customized_fields = this.isAsync(customize)
				? await customize(this, fields, mode, has_additional_action, name)
				: customize(this, fields, mode, has_additional_action, name);
			if (customized_fields) {
				fields = customized_fields;
			}
		}
		if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
			let customize = this.frm?.["dt_global_events"]?.["customize_form_fields"];
			let has_additional_action = additional_action ? true : false;
			let customized_fields = this.isAsync(customize)
				? await customize(this, fields, mode, has_additional_action, name)
				: customize(this, fields, mode, has_additional_action, name);
			if (customized_fields) {
				fields = customized_fields;
			}
		}
		if (mode === "create" || mode === "write") {
			if (name) {
				let doc = {};
				if (data) {
					doc = data;
				} else {
					doc = await this.sva_db.get_doc(doctype, name);
				}
				for (const f of fields) {
					f.default = "";
					if (f.hidden === "0") {
						f.hidden = 0;
					}
					f.onchange = this.onFieldValueChange?.bind(this);
					if (this.frm?.["dt_events"]?.[doctype]?.[f.fieldname]) {
						let change = this.frm["dt_events"][doctype][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f, name);
						} else {
							f.onchange = change.bind(this, this, mode, f, name);
						}
					}
					if (this.frm?.["dt_global_events"]?.[f.fieldname]) {
						let change = this.frm["dt_global_events"][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f, name);
						} else {
							f.onchange = change.bind(this, this, mode, f, name);
						}
					}
					if (f.set_only_once) {
						if (doc[f.fieldname]) {
							f.default = doc[f.fieldname];
							f.read_only = 1;
						} else {
							f.reqd = 0;
							f.hidden = 1;
						}
					}
					if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
						let res = await this.sva_db.call({
							method: "frappe_theme.dt_api.get_meta_fields",
							doctype: f.options,
						});
						let tableFields = res?.message;
						if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
							let customize =
								this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"];
							let has_additional_action = additional_action ? true : false;
							let customizedTableFields = this.isAsync(customize)
								? await customize(
										this,
										tableFields,
										mode,
										has_additional_action,
										name
								  )
								: customize(this, tableFields, mode, has_additional_action, name);
							if (customizedTableFields) {
								tableFields = customizedTableFields;
							}
						}
						if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
							let customize =
								this.frm?.["dt_global_events"]?.["customize_form_fields"];
							let has_additional_action = additional_action ? true : false;
							let customizedTableFields = this.isAsync(customize)
								? await customize(
										this,
										tableFields,
										mode,
										has_additional_action,
										name
								  )
								: customize(this, tableFields, mode, has_additional_action, name);
							if (customizedTableFields) {
								tableFields = customizedTableFields;
							}
						}
						for (let tf of tableFields) {
							if (tf.fieldtype === "Link") {
								tf.get_query = () => {
									const filters = [];
									if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
										filters.push(
											...this.frm["dt_filters"][f.options][tf.fieldname]
										);
									}
									if (tf.link_filter) {
										const [parentfield, filter_key] =
											tf.link_filter.split("->");
										filters.push([
											tf.options,
											filter_key,
											"=",
											dialog.fields_dict[parentfield]?.value ||
												`Please select ${parentfield}`,
										]);
									}
									return { filters };
								};
							}
							if (this.frm?.["dt_events"]?.[f.options]?.[tf.fieldname]) {
								let change = this.frm["dt_events"][f.options][tf.fieldname];
								tf.onchange = this.isAsync(change)
									? await change.bind(this, this, mode, tf, name)
									: change.bind(this, this, mode, tf, name);
							}
							if (this.frm?.["dt_global_events"]?.[tf.fieldname]) {
								let change = this.frm["dt_global_events"][tf.fieldname];
								tf.onchange = this.isAsync(change)
									? await change.bind(this, this, mode, tf, name)
									: change.bind(this, this, mode, tf, name);
							}
						}
						f.fields = tableFields;
						if (doc[f.fieldname]?.length) {
							f.data = doc[f.fieldname]?.map((row) => {
								let old_name = row.name;
								delete row.name;
								return { ...row, old_name };
							});
						}
					}
					if (["Attach", "Attach Image"].includes(f.fieldtype)) {
						if (f.read_only) {
							if (doc[f.fieldname]) {
								f.fieldtype = "HTML";
								f.options = `
                                    <div class="form-group horizontal">
                                        <div class="clearfix">
                                            <label class="control-label" style="padding-right: 0px;">${
												f.label
											}</label>
                                            <span class="help"></span>
                                        </div>
                                        <div class="control-input-wrapper">
                                        <div class="control-input" style="display: none;"></div>
                                        <div class="control-value like-disabled-input ellipsis">
                                            <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                                                <use class="" href="#es-line-link"></use>
                                            </svg>
                                                <a href="${doc[f.fieldname]}" target="_blank">${
									doc[f.fieldname]
								}</a>
                                            </div>
                                            <div class="help-box small text-extra-muted hide"></div>
                                        </div>
                                    </div>
                                `;
							} else {
								f.default = "";
								f.hidden = 1;
							}
						} else if (f.hidden) {
							f.fieldtype = "Data";
						} else if (doc[f.fieldname]) {
							f.default = doc[f.fieldname];
						}
						continue;
					}
					if (doc[f.fieldname]) {
						f.default = doc[f.fieldname];
					}
					if (f.fieldtype === "Link") {
						f.get_query = () => {
							const filters = [];
							if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
								filters.push(...this.frm["dt_filters"][f.options][tf.fieldname]);
							}
							if (this.uniqueness.column.length) {
								if (this.uniqueness.column.includes(f.fieldname)) {
									let existing_options = this.rows?.map(
										(item) => item[f.fieldname]
									);
									filters.push([f.options, "name", "not in", existing_options]);
								}
							}
							if (f.link_filter) {
								const [parentfield, filter_key] = f.link_filter.split("->");
								filters.push([
									f.options,
									filter_key,
									"=",
									dialog.fields_dict[parentfield]?.value ||
										`Please select ${parentfield}`,
								]);
							}
							return { filters };
						};
					}
					if (
						!["Check", "Button", "Table", "Table MultiSelect", "Currency"].includes(
							f.fieldtype
						) &&
						f.read_only &&
						!doc[f.fieldname]
					) {
						if (!f.depends_on) {
							f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
						} else {
							f.hidden = 1;
						}
						continue;
					}
				}
			} else {
				for (const f of fields) {
					f.onchange = this.onFieldValueChange?.bind(this);
					if (f.hidden === "0") {
						f.hidden = 0;
					}
					if (["Attach", "Attach Image"].includes(f.fieldtype)) {
						if (f.hidden) {
							f.fieldtype = "Data";
							f.hidden = 1;
							continue;
						}
					}
					if (this.frm?.["dt_events"]?.[doctype]?.[f.fieldname]) {
						let change = this.frm["dt_events"][doctype][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f, name);
						} else {
							f.onchange = change.bind(this, this, mode, f, name);
						}
					}
					if (this.frm?.["dt_global_events"]?.[f.fieldname]) {
						let change = this.frm["dt_global_events"][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f, name);
						} else {
							f.onchange = change.bind(this, this, mode, f, name);
						}
					}
					if (this.frm?.parentRow) {
						if (this.frm?.parentRow[f.fieldname]) {
							if (f.fieldname == "workflow_state") {
								continue;
							}
							f.default = this.frm?.parentRow[f.fieldname];
							f.read_only = 1;
						}
					}
					if (this.frm?.doctype === f.options) {
						f.default = this.frm?.doc.name;
						f.read_only = 1;
					}
					if (this.connection?.connection_type === "Referenced") {
						if (f.fieldname === this.connection.dt_reference_field) {
							f.default = this.frm?.doc.doctype;
							f.read_only = 1;
						}
						if (f.fieldname === this.connection.dn_reference_field) {
							f.default = this.frm?.doc.name;
							f.read_only = 1;
						}
					}
					if (this.connection?.connection_type === "Direct") {
						if (f.fieldname === this.connection.link_fieldname) {
							f.default = this.frm?.doc.name;
							f.read_only = 1;
						}
					}

					if (f.fieldtype === "Link") {
						f.get_query = () => {
							const filters = [];
							if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
								filters.push(...this.frm["dt_filters"][f.options][tf.fieldname]);
							}
							if (this.uniqueness.column.length) {
								if (this.uniqueness.column.includes(f.fieldname)) {
									let existing_options = this.rows?.map(
										(item) => item[f.fieldname]
									);
									filters.push([f.options, "name", "not in", existing_options]);
								}
							}
							if (f.link_filter) {
								const [parentfield, filter_key] = f.link_filter.split("->");
								filters.push([
									f.options,
									filter_key,
									"=",
									dialog.fields_dict[parentfield]?.value ||
										`Please select ${parentfield}`,
								]);
							}
							return { filters };
						};
					}
					if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
						let res = await this.sva_db.call({
							method: "frappe_theme.dt_api.get_meta_fields",
							doctype: f.options,
						});
						let tableFields = res?.message;
						if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
							let customize =
								this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"];
							let has_additional_action = additional_action ? true : false;
							let customizedTableFields = this.isAsync(customize)
								? await customize(this, tableFields, mode, has_additional_action)
								: customize(this, tableFields, mode, has_additional_action);
							if (customizedTableFields) {
								tableFields = customizedTableFields;
							}
						}
						if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
							let customize = this.frm["dt_global_events"]["customize_form_fields"];
							let has_additional_action = additional_action ? true : false;
							let customizedTableFields = this.isAsync(customize)
								? await customize(this, tableFields, mode, has_additional_action)
								: customize(this, tableFields, mode, has_additional_action);
							if (customizedTableFields) {
								tableFields = customizedTableFields;
							}
						}
						for (let tf of tableFields) {
							if (tf.fieldtype === "Link") {
								tf.get_query = () => {
									const filters = [];
									if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
										filters.push(
											...this.frm["dt_filters"][f.options][tf.fieldname]
										);
									}
									if (tf.link_filter) {
										const [parentfield, filter_key] =
											tf.link_filter.split("->");
										filters.push([
											tf.options,
											filter_key,
											"=",
											dialog.fields_dict[parentfield]?.value ||
												`Please select ${parentfield}`,
										]);
									}
									return { filters };
								};
							}
							if (this.frm?.["dt_events"]?.[f.options]?.[tf.fieldname]) {
								let change = this.frm["dt_events"][f.options][tf.fieldname];
								tf.onchange = change.bind(this, this, mode, tf);
							}
							if (this.frm?.["dt_global_events"]?.[tf.fieldname]) {
								let change = this.frm["dt_global_events"][tf.fieldname];
								tf.onchange = change.bind(this, this, mode, tf);
							}
						}
						f.fields = tableFields;
						continue;
					}
					if (
						!["Check", "Button", "Table", "Table MultiSelect", "Currency"].includes(
							f.fieldtype
						) &&
						f.read_only &&
						!f.default
					) {
						if (!f.depends_on) {
							f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
						} else {
							f.hidden = 1;
						}
						continue;
					}
				}
			}
		} else {
			let doc;
			if (data) {
				doc = data;
			} else {
				doc = await this.sva_db.get_doc(doctype, name);
			}
			for (const f of fields) {
				if (f.hidden === "0") {
					f.hidden = 0;
				}

				if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
					let res = await this.sva_db.call({
						method: "frappe_theme.dt_api.get_meta_fields",
						doctype: f.options,
					});
					let tableFields = res?.message;
					if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
						let customize =
							this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"];
						let has_additional_action = additional_action ? true : false;
						let customizedTableFields = this.isAsync(customize)
							? await customize(this, tableFields, mode, has_additional_action, name)
							: customize(this, tableFields, mode, has_additional_action, name);
						if (customizedTableFields) {
							tableFields = customizedTableFields;
						}
					}
					if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
						let customize = this.frm["dt_global_events"]["customize_form_fields"];
						let has_additional_action = additional_action ? true : false;
						let customizedTableFields = this.isAsync(customize)
							? await customize(this, tableFields, mode, has_additional_action, name)
							: customize(this, tableFields, mode, has_additional_action, name);
						if (customizedTableFields) {
							tableFields = customizedTableFields;
						}
					}
					f.fields = tableFields.map((f) => {
						return { ...f, read_only: 1 };
					});
					f.cannot_add_rows = 1;
					f.cannot_delete_rows = 1;
					f.read_only = 1;

					if (doc[f.fieldname].length) {
						if (f.fieldtype === "Table MultiSelect") {
							f.default = doc[f.fieldname];
						} else {
							f.data = doc[f.fieldname];
						}
					}
					continue;
				}
				if (["Attach", "Attach Image"].includes(f.fieldtype)) {
					if (doc[f.fieldname]) {
						f.fieldtype = "HTML";
						f.options = `
                            <div class="form-group horizontal">
                                <div class="clearfix">
                                    <label class="control-label" style="padding-right: 0px;">${
										f.label
									}</label>
                                    <span class="help"></span>
                                </div>
                                <div class="control-input-wrapper">
                                <div class="control-input" style="display: none;"></div>
                                <div class="control-value like-disabled-input ellipsis">
                                    <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                                        <use class="" href="#es-line-link"></use>
                                    </svg>
                                        <a href="${doc[f.fieldname]}" target="_blank">${
							doc[f.fieldname]
						}</a>
                                    </div>
                                    <div class="help-box small text-extra-muted hide"></div>
                                </div>
                            </div>
                        `;
					} else {
						f.hidden = 1;
					}
					continue;
				}
				if (f.fieldtype === "Button") {
					if (this.frm?.["dt_events"]?.[doctype]?.[f.fieldname]) {
						let change = this.frm["dt_events"][doctype][f.fieldname];
						f.click = change.bind(this, this, mode, f, name);
					}
					if (this.frm?.["dt_global_events"]?.[f.fieldname]) {
						let change = this.frm["dt_global_events"][f.fieldname];
						f.click = change.bind(this, this, mode, f, name);
					}
					continue;
				}
				if (
					!["Check", "Button", "Table", "Table MultiSelect", "Currency"].includes(
						f.fieldtype
					) &&
					f.read_only &&
					!doc[f.fieldname]
				) {
					if (!f.depends_on) {
						f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
					} else {
						f.hidden = 1;
					}
					continue;
				}
				if (doc[f.fieldname]) {
					f.default = doc[f.fieldname];
					f.read_only = 1;
				} else {
					f.default = "";
					f.read_only = 1;
				}
			}
		}
		const dialog = new frappe.ui.Dialog({
			title: __(
				`${mode == "view" ? "View" : mode == "create" ? "Create" : "Update"} ${__(
					this.connection?.title || doctype
				)}`
			),
			size: frappe.utils.get_dialog_size(fields), // Available sizes: 'small', 'medium', 'large', 'extra-large'
			fields: fields || [],
			primary_action_label: name ? "Update" : "Create",
			primary_action: async (values) => {
				try {
					$(dialog.get_primary_btn()).prop("disabled", true);
					$(dialog.get_primary_btn()).html(
						'<span style="width: 0.75rem !important; height: 0.75rem !important;" class="spinner-border spinner-border-sm "></span> ' +
							(dialog.primary_action_label || "Save")
					);
					if (["create", "write"].includes(mode)) {
						if (this.frm?.["dt_events"]?.[doctype]?.["validate"]) {
							let change = this.frm["dt_events"][doctype]["validate"];
							let has_aditional_action = additional_action ? true : false;
							if (this.isAsync(change)) {
								await change(this, mode, values, has_aditional_action);
								values = dialog.get_values(true, false);
							} else {
								change(this, mode, values, has_aditional_action);
								values = dialog.get_values(true, false);
							}
						}
						if (this.frm?.["dt_global_events"]?.["validate"]) {
							let change = this.frm["dt_global_events"]["validate"];
							let has_aditional_action = additional_action ? true : false;
							if (this.isAsync(change)) {
								await change(this, mode, values, has_aditional_action);
								values = dialog.get_values(true, false);
							} else {
								change(this, mode, values, has_aditional_action);
								values = dialog.get_values(true, false);
							}
						}
						if (primary_action != null) {
							if (this.isAsync(primary_action)) {
								await primary_action(values, this, mode, name);
							} else {
								primary_action(values, this, mode, name);
							}
						} else {
							if (!name) {
								let response = await frappe.xcall("frappe.client.insert", {
									doc: {
										doctype: doctype,
										...values,
									},
								});
								if (response) {
									if (this.rows.length == this.limit) {
										this.rows.pop();
									}
									this.rows = [response, ...this.rows];
									// this.rows.push(response);
									this.updateTableBody();
									frappe.show_alert({
										message: `Successfully created ${__(
											this.connection?.title || doctype
										)}`,
										indicator: "success",
									});
									if (this.frm?.["dt_events"]?.[doctype]?.["after_insert"]) {
										let change =
											this.frm["dt_events"][doctype]["after_insert"];
										if (this.isAsync(change)) {
											await change(this, response);
										} else {
											change(this, response);
										}
									}
									if (this.frm?.["dt_global_events"]?.["after_insert"]) {
										let change = this.frm["dt_global_events"]["after_insert"];
										if (this.isAsync(change)) {
											await change(this, response);
										} else {
											change(this, response);
										}
									}
								}
							} else {
								let value_fields = fields.filter(
									(f) =>
										![
											"Section Break",
											"Column Break",
											"HTML",
											"Button",
											"Tab Break",
										].includes(f.fieldtype)
								);
								let updated_values = {};
								for (let field of value_fields) {
									let key = field.fieldname;
									if (Array.isArray(values[key])) {
										updated_values[key] = values[key].map((item) => {
											if (item.old_name) {
												return { ...item, name: item.old_name };
											}
											return item;
										});
									} else {
										updated_values[key] = values[key] || "";
									}
								}
								let response = await frappe.xcall("frappe.client.set_value", {
									doctype: doctype,
									name,
									fieldname: updated_values,
								});
								if (response) {
									let rowIndex = this.rows.findIndex((r) => r.name === name);
									this.rows[rowIndex] = response;
									this.updateTableBody();
									frappe.show_alert({
										message: `Successfully updated ${__(
											this.connection?.title || doctype
										)}`,
										indicator: "success",
									});
									if (this.frm?.["dt_events"]?.[doctype]?.["after_update"]) {
										let change =
											this.frm["dt_events"][doctype]["after_update"];
										if (this.isAsync(change)) {
											await change(this, response);
										} else {
											change(this, response);
										}
									}
									if (this.frm?.["dt_global_events"]?.["after_update"]) {
										let change = this.frm["dt_global_events"]["after_update"];
										if (this.isAsync(change)) {
											await change(this, response);
										} else {
											change(this, response);
										}
									}
								}
							}
							if (this.frm?.["dt_events"]?.[doctype]?.["after_save"]) {
								let change = this.frm["dt_events"][doctype]["after_save"];
								if (this.isAsync(change)) {
									await change(this, mode, values);
								} else {
									change(this, mode, values);
								}
							}
							if (this.frm?.["dt_global_events"]?.["after_save"]) {
								let change = this.frm["dt_global_events"]["after_save"];
								if (this.isAsync(change)) {
									await change(this, mode, values);
								} else {
									change(this, mode, values);
								}
							}
						}
					}
					if (additional_action) {
						additional_action(true);
					}
					try {
						dialog.clear();
					} catch (error) {
						console.error("error in dialog.clear", error);
					}
					dialog.hide();
				} catch (error) {
					console.error("error in primary action", error);
				} finally {
					$(dialog.get_primary_btn()).prop("disabled", false);
					$(dialog.get_primary_btn()).html(dialog?.primary_action_label || "Save");
				}
			},
			secondary_action_label: ["create", "write"].includes(mode) ? "Cancel" : "Close",
			secondary_action: () => {
				if (additional_action) {
					additional_action(false);
				}
				try {
					dialog.clear();
				} catch (error) {
					console.error("error in dialog.clear", error);
				}
				dialog.hide();
			},
		});
		if (["create", "write"].includes(mode)) {
			dialog.get_primary_btn().show();
		} else {
			dialog.get_primary_btn().hide();
		}
		this.form_dialog = dialog;
		if (this?.connection?.full_screen_dialog) {
			frappe.utils.make_dialog_fullscreen(dialog);
		}
		dialog.show();
		for (let [fieldname, field] of Object.entries(dialog.fields_dict)?.filter(
			([fieldname, field]) => field.df.fieldtype == "Date"
		)) {
			if (field?.df?.min_max_depends_on) {
				let splitted = field.df.min_max_depends_on.split("->");
				let fn = splitted[0].split(".")[0];
				let doctype = splitted[0].split(".")[1];
				let min_field = splitted[1];
				let max_field = splitted[2] ? splitted[2] : "";
				if (dialog.get_value(fieldname)) {
					if (this.sva_db.exists(doctype, dialog.get_value(fn))) {
						let doc = await this.sva_db.get_doc(doctype, dialog.get_value(fn));
						let option = {};
						if (min_field && doc[min_field]) {
							option["minDate"] = new Date(doc[min_field]);
						}
						if (max_field && doc[max_field]) {
							option["maxDate"] = new Date(doc[max_field]);
						}
						dialog.fields_dict[fieldname].$input.datepicker(option);
					}
				}
			}
		}
		if (this.frm?.["dt_events"]?.[doctype]?.["after_render"]) {
			let change = this.frm["dt_events"][doctype]["after_render"];
			let has_aditional_action = additional_action ? true : false;
			if (this.isAsync(change)) {
				await change(this, mode, has_aditional_action, name);
			} else {
				change(this, mode, has_aditional_action, name);
			}
		}
		if (this.frm?.["dt_global_events"]?.["after_render"]) {
			let change = this.frm["dt_global_events"]["after_render"];
			let has_aditional_action = additional_action ? true : false;
			if (this.isAsync(change)) {
				await change(this, mode, has_aditional_action, name);
			} else {
				change(this, mode, has_aditional_action, name);
			}
		}
		return dialog;
	},
	async deleteRecord(doctype, name) {
		frappe.confirm(
			`Are you sure you want to delete this ${__(this.connection?.title || doctype)}?`,
			async () => {
				await frappe.xcall("frappe.client.delete", { doctype, name });
				let rowIndex = this.rows.findIndex((r) => r.name === name);
				this.rows.splice(rowIndex, 1);
				this.updateTableBody();
				frappe.show_alert({
					message: `Successfully deleted ${__(this.connection?.title || doctype)}`,
					indicator: "success",
				});
				if (this.frm?.["dt_events"]?.[doctype]?.["after_delete"]) {
					let change = this.frm["dt_events"][doctype]["after_delete"];
					if (this.isAsync(change)) {
						await change(this, name);
					} else {
						change(this, name);
					}
				}
				if (this.frm?.["dt_global_events"]?.["after_delete"]) {
					let change = this.frm["dt_global_events"]["after_delete"];
					if (this.isAsync(change)) {
						await change(this, name);
					} else {
						change(this, name);
					}
				}
			}
		);
	},
	async childTableDialog(doctype, primaryKeyValue, parentRow, link) {
		const dialog = new frappe.ui.Dialog({
			title: __(link?.title || doctype),
			size: "extra-large", // small, large, extra-large
			fields: [
				{
					fieldname: "table",
					fieldtype: "HTML",
					options: `<div id = "${
						doctype?.split(" ").length > 1
							? doctype?.split(" ")?.join("-")?.toLowerCase()
							: doctype.toLowerCase()
					}" ></div > `,
				},
			],
		});
		dialog.onhide = async function () {
			let updated_doc = await this.sva_db.get_doc(this.doctype, parentRow.name);
			let idx = this.rows.findIndex((r) => r.name === parentRow.name);
			this.rows[idx] = updated_doc;
			this.updateTableBody();
		}.bind(this);
		$(dialog.$wrapper).on("show.bs.modal", function () {
			$(this).removeAttr("aria-hidden");
		});
		$(dialog.$wrapper).on("hidden.bs.modal", function () {
			$(this).attr("aria-hidden", "true");
		});
		if (link?.full_screen_dialog) {
			frappe.utils.make_dialog_fullscreen(dialog);
		}
		dialog.show();
		// Use frappe.ui.SvaDataTable to avoid circular imports
		new frappe.ui.SvaDataTable({
			wrapper: dialog.body.querySelector(
				`#${
					doctype?.split(" ").length > 1
						? doctype?.split(" ")?.join("-")?.toLowerCase()
						: doctype.toLowerCase()
				}`
			), // Wrapper element
			doctype: doctype,
			connection: link,
			frm: {
				doctype: this.doctype,
				parent_frm: this.frm,
				doc: { name: primaryKeyValue, docstatus: parentRow.docstatus },
				parentRow,
				dt_events: this.frm?.dt_events,
				dt_global_events: this.frm?.dt_global_events,
			},
			options: {
				serialNumberColumn: true,
				editable: false,
			},
		});
	},
};

export default FormDialogMixin;
