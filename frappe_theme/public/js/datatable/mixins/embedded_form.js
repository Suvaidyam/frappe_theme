/**
 * EmbeddedFormMixin — renders a linked DocType's complete form inline inside
 * an HTML field wrapper (instead of a modal dialog).
 *
 * All dt_events hooks fire with the same signature as FormDialogMixin so that
 * existing event handlers work in both rendering modes without changes.
 *
 * this.form_dialog is set to a frappe.ui.Dialog-compatible proxy so that
 * after_render hooks can call dt.form_dialog.set_value(), get_value(), etc.
 */
const EmbeddedFormMixin = {
	/**
	 * Opens an inline form panel below the datatable (instead of a modal dialog).
	 * Triggered by the "Add row" or "Edit" buttons when use_embedded_form is enabled.
	 *
	 * Configuration (either location works):
	 *   connection.use_embedded_form = true
	 *   options.use_embedded_form    = true
	 *
	 * @param {string}      doctype - Target DocType to render
	 * @param {string|null} name    - Document name (null = create mode)
	 * @param {string}      mode    - "create" | "write" | "view"
	 */
	async showEmbeddedFormPanel(doctype, name = null, mode = "create") {
		// Find or create the panel container below the datatable wrapper
		let panel = this.wrapper.querySelector(".sva-embedded-form-panel");
		if (!panel) {
			panel = document.createElement("div");
			panel.className = "sva-embedded-form-panel card p-3 mt-2";
			this.wrapper.appendChild(panel);
		}

		// Reset panel content
		panel.innerHTML = "";
		panel.style.display = "block";

		// Header with title and collapse button
		const header = document.createElement("div");
		header.className = "d-flex justify-content-between align-items-center mb-3";
		header.innerHTML = `
			<strong>${__(name ? "Edit" : "Add")} ${__(doctype)}</strong>
			<button class="btn btn-xs btn-default sva-panel-close" style="padding:2px 8px">✕</button>
		`;
		header.querySelector(".sva-panel-close").addEventListener("click", () => {
			panel.style.display = "none";
			panel.innerHTML = "";
		});
		panel.appendChild(header);

		// Content wrapper for FieldGroup
		const content = document.createElement("div");
		content.className = "sva-embedded-form-content";
		panel.appendChild(content);

		// After save: reload table data and collapse panel
		const onAfterSave = async () => {
			panel.style.display = "none";
			panel.innerHTML = "";
			await this.reloadTable();
		};

		await this.createEmbeddedForm(doctype, name, content, mode, onAfterSave);

		// Scroll panel into view
		panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
	},

	/**
	 * Main entry point. Renders the DocType form inline into `wrapper_el`.
	 *
	 * @param {string}      doctype       - Target DocType to render
	 * @param {string|null} name          - Document name (null for create mode)
	 * @param {HTMLElement} wrapper_el    - DOM element to render into
	 * @param {string}      mode          - "create" | "write" | "view"
	 * @param {Function}    onAfterSave   - Optional callback fired after successful save
	 * @returns {Object} dialog-compatible proxy (also stored as this.form_dialog)
	 */
	async createEmbeddedForm(
		doctype,
		name = null,
		wrapper_el,
		mode = "write",
		onAfterSave = null
	) {
		if (!wrapper_el) {
			console.warn("[embedded_form] wrapper_el is required");
			return null;
		}

		// Fetch field metadata — include_tabs:1 so Tab Breaks come back and we
		// convert them to Section Breaks (FieldGroup doesn't support native tabs)
		let res = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			doctype: doctype,
			include_tabs: 1,
		});
		let fields = res?.message;
		if (!fields || !fields.length) {
			console.warn(`[embedded_form] No fields returned for doctype: ${doctype}`);
			return null;
		}

		// Tab Breaks are kept as-is; they are used as boundaries when splitting
		// fields into per-tab FieldGroup instances below.

		// SVADialog early-exit hook (same as FormDialogMixin)
		if (window?.SVADialog?.[doctype]) {
			window?.SVADialog?.[doctype](mode, fields);
			return null;
		}

		// SVAHandleParentFieldProps hook
		if (window?.SVAHandleParentFieldProps) {
			let f = window?.SVAHandleParentFieldProps(fields, doctype, name, mode);
			if (f) fields = [...f];
		}

		// dt_events: customize_form_fields
		if (this.frm?.["dt_events"]?.[doctype]?.["customize_form_fields"]) {
			let customize = this.frm["dt_events"][doctype]["customize_form_fields"];
			let customized = this.isAsync(customize)
				? await customize(this, fields, mode, false, name)
				: customize(this, fields, mode, false, name);
			if (customized) fields = customized;
		}
		if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
			let customize = this.frm["dt_global_events"]["customize_form_fields"];
			let customized = this.isAsync(customize)
				? await customize(this, fields, mode, false, name)
				: customize(this, fields, mode, false, name);
			if (customized) fields = customized;
		}

		// Fetch document for edit / view modes, store on instance for callers to reuse
		let doc = {};
		if (name && mode !== "create") {
			try {
				doc = await this.sva_db.get_doc(doctype, name);
			} catch (e) {
				console.warn(`[embedded_form] Could not fetch doc ${doctype}/${name}:`, e);
			}
		}
		this._embedded_doc = doc;

		// fg_holder allows get_query closures to reference the FieldGroup before it exists
		const fg_holder = { instance: null };

		// Field preparation — mirrors FormDialogMixin's create/write path exactly
		if (mode === "create" || mode === "write") {
			await this._prepareEmbeddedFieldsWriteMode(
				doctype,
				name,
				doc,
				fields,
				mode,
				fg_holder
			);
		} else {
			// view mode — all fields read_only
			await this._prepareEmbeddedFieldsViewMode(doctype, name, doc, fields, mode);
		}

		// Split fields into tab groups at Tab Break boundaries
		const { tabGroups, hasTabs } = this._splitFieldsByTabs(fields);

		// Clear wrapper
		wrapper_el.innerHTML = "";

		const allFgs = [];
		const allFieldsDict = {};

		if (hasTabs) {
			// Render Bootstrap tab nav header
			this._renderEmbeddedTabs(wrapper_el, tabGroups, allFgs, allFieldsDict);
		} else {
			// No tabs — single FieldGroup (original behavior)
			const fg0 = new frappe.ui.FieldGroup({
				fields: tabGroups[0].fields,
				body: wrapper_el,
			});
			fg0.make();
			allFgs.push(fg0);
			Object.assign(allFieldsDict, fg0.fields_dict);
		}

		// Refresh grids (same pattern as FormDialogMixin line 735-739)
		for (const fg0 of allFgs) {
			Object.values(fg0.fields_dict).forEach((field) => {
				if (field?.grid) field.grid.refresh();
			});
		}

		// Composite proxy — works across all tab FieldGroups so dt.form_dialog
		// calls like set_value / get_value / fields_dict work regardless of tab count
		const form_proxy = this._buildCompositeProxy(allFgs, allFieldsDict, wrapper_el);
		this.form_dialog = form_proxy;

		// Point fg_holder at the composite so link-filter get_query closures resolve correctly
		fg_holder.instance = form_proxy;

		// Save / Cancel footer (same UX pattern as FormDialogMixin)
		// form_proxy is passed as the fg argument — composite exposes get_values() / fields_list
		if (["create", "write"].includes(mode)) {
			this._renderEmbeddedFormFooter(
				wrapper_el,
				doctype,
				name,
				mode,
				form_proxy,
				form_proxy,
				onAfterSave
			);
		}

		// after_render dt_events (same args as FormDialogMixin lines 765-782)
		if (this.frm?.["dt_events"]?.[doctype]?.["after_render"]) {
			let change = this.frm["dt_events"][doctype]["after_render"];
			if (this.isAsync(change)) {
				await change(this, mode, false, name);
			} else {
				change(this, mode, false, name);
			}
		}
		if (this.frm?.["dt_global_events"]?.["after_render"]) {
			let change = this.frm["dt_global_events"]["after_render"];
			if (this.isAsync(change)) {
				await change(this, mode, false, name);
			} else {
				change(this, mode, false, name);
			}
		}

		return form_proxy;
	},

	/**
	 * Field preparation for create / write modes.
	 * Mirrors FormDialogMixin lines 45-413 exactly.
	 */
	async _prepareEmbeddedFieldsWriteMode(doctype, name, doc, fields, mode, fg_holder) {
		const has_doc = name && doc && Object.keys(doc).length;

		if (has_doc) {
			// Edit existing document — same as FormDialogMixin lines 46-413
			for (const f of fields) {
				f.default = "";
				if (f.hidden === "0") f.hidden = 0;
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
					if (mode === "write") {
						// Editing an existing record — field is locked unconditionally
						f.read_only = 1;
					} else if (doc[f.fieldname]) {
						f.default = doc[f.fieldname];
						f.read_only = 1;
					} else {
						f.reqd = 0;
						f.hidden = 1;
					}
				}

				if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
					let tableRes = await this.sva_db.call({
						method: "frappe_theme.dt_api.get_meta_fields",
						doctype: f.options,
					});
					let tableFields = tableRes?.message || [];

					if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
						let customize = this.frm["dt_events"][f.options]["customize_form_fields"];
						let customized = this.isAsync(customize)
							? await customize(this, tableFields, mode, false, name)
							: customize(this, tableFields, mode, false, name);
						if (customized) tableFields = customized;
					}
					if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
						let customize = this.frm["dt_global_events"]["customize_form_fields"];
						let customized = this.isAsync(customize)
							? await customize(this, tableFields, mode, false, name)
							: customize(this, tableFields, mode, false, name);
						if (customized) tableFields = customized;
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
									const [parentfield, filter_key] = tf.link_filter.split("->");
									filters.push([
										tf.options,
										filter_key,
										"=",
										fg_holder.instance?.get_value(parentfield) ||
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
					continue;
				}

				if (["Attach", "Attach Image"].includes(f.fieldtype)) {
					if (f.read_only) {
						if (doc[f.fieldname]) {
							f.fieldtype = "HTML";
							f.options = `
								<div class="form-group horizontal">
									<div class="clearfix">
										<label class="control-label" style="padding-right: 0px;">${f.label}</label>
										<span class="help"></span>
									</div>
									<div class="control-input-wrapper">
										<div class="control-input" style="display: none;"></div>
										<div class="control-value like-disabled-input ellipsis">
											<svg class="es-icon es-line icon-sm" aria-hidden="true">
												<use href="#es-line-link"></use>
											</svg>
											<a href="${doc[f.fieldname]}" target="_blank">${doc[f.fieldname]}</a>
										</div>
										<div class="help-box small text-extra-muted hide"></div>
									</div>
								</div>`;
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
						if (this.frm?.["dt_filters"]?.[doctype]?.[f.fieldname]) {
							filters.push(...this.frm["dt_filters"][doctype][f.fieldname]);
						}
						if (f.link_filter) {
							const [parentfield, filter_key] = f.link_filter.split("->");
							filters.push([
								f.options,
								filter_key,
								"=",
								fg_holder.instance?.get_value(parentfield) ||
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
			// Create new document — same as FormDialogMixin create path
			for (const f of fields) {
				f.onchange = this.onFieldValueChange?.bind(this);
				if (f.hidden === "0") f.hidden = 0;

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

				// Set parent doctype field as default + read_only for connection context
				if (this.frm?.parentRow?.[f.fieldname]) {
					if (f.fieldname !== "workflow_state") {
						f.default = this.frm.parentRow[f.fieldname];
						f.read_only = 1;
					}
				}
				if (this.frm?.doctype === f.options) {
					f.default = this.frm?.doc?.name;
					f.read_only = 1;
				}

				if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
					let tableRes = await this.sva_db.call({
						method: "frappe_theme.dt_api.get_meta_fields",
						doctype: f.options,
					});
					let tableFields = tableRes?.message || [];

					if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
						let customize = this.frm["dt_events"][f.options]["customize_form_fields"];
						let customized = this.isAsync(customize)
							? await customize(this, tableFields, mode, false, null)
							: customize(this, tableFields, mode, false, null);
						if (customized) tableFields = customized;
					}
					for (let tf of tableFields) {
						if (this.frm?.["dt_events"]?.[f.options]?.[tf.fieldname]) {
							let change = this.frm["dt_events"][f.options][tf.fieldname];
							tf.onchange = change.bind(this, this, mode, tf, name);
						}
						if (this.frm?.["dt_global_events"]?.[tf.fieldname]) {
							let change = this.frm["dt_global_events"][tf.fieldname];
							tf.onchange = change.bind(this, this, mode, tf, name);
						}
					}
					f.fields = tableFields;
					continue;
				}

				if (f.fieldtype === "Link") {
					f.get_query = () => {
						const filters = [];
						if (this.frm?.["dt_filters"]?.[doctype]?.[f.fieldname]) {
							filters.push(...this.frm["dt_filters"][doctype][f.fieldname]);
						}
						if (f.link_filter) {
							const [parentfield, filter_key] = f.link_filter.split("->");
							filters.push([
								f.options,
								filter_key,
								"=",
								fg_holder.instance?.get_value(parentfield) ||
									`Please select ${parentfield}`,
							]);
						}
						return { filters };
					};
				}
			}
		}
	},

	/**
	 * Field preparation for view mode.
	 * Mirrors FormDialogMixin lines 415-533 exactly.
	 */
	async _prepareEmbeddedFieldsViewMode(doctype, name, doc, fields, mode) {
		for (const f of fields) {
			if (f.hidden === "0") f.hidden = 0;

			if (["Table", "Table MultiSelect"].includes(f.fieldtype)) {
				let tableRes = await this.sva_db.call({
					method: "frappe_theme.dt_api.get_meta_fields",
					doctype: f.options,
				});
				let tableFields = tableRes?.message || [];

				if (this.frm?.["dt_events"]?.[f.options]?.["customize_form_fields"]) {
					let customize = this.frm["dt_events"][f.options]["customize_form_fields"];
					let customized = this.isAsync(customize)
						? await customize(this, tableFields, mode, false, name)
						: customize(this, tableFields, mode, false, name);
					if (customized) tableFields = customized;
				}
				if (this.frm?.["dt_global_events"]?.["customize_form_fields"]) {
					let customize = this.frm["dt_global_events"]["customize_form_fields"];
					let customized = this.isAsync(customize)
						? await customize(this, tableFields, mode, false, name)
						: customize(this, tableFields, mode, false, name);
					if (customized) tableFields = customized;
				}

				f.fields = tableFields.map((tf) => ({ ...tf, read_only: 1 }));
				f.cannot_add_rows = 1;
				f.cannot_delete_rows = 1;
				f.read_only = 1;

				if (doc[f.fieldname]?.length) {
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
								<label class="control-label" style="padding-right: 0px;">${f.label}</label>
								<span class="help"></span>
							</div>
							<div class="control-input-wrapper">
								<div class="control-input" style="display: none;"></div>
								<div class="control-value like-disabled-input ellipsis">
									<svg class="es-icon es-line icon-sm" aria-hidden="true">
										<use href="#es-line-link"></use>
									</svg>
									<a href="${doc[f.fieldname]}" target="_blank">${doc[f.fieldname]}</a>
								</div>
								<div class="help-box small text-extra-muted hide"></div>
							</div>
						</div>`;
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
	},

	/**
	 * Renders the Save footer below the embedded form.
	 * onAfterSave is called after all dt_events hooks complete (e.g. to hide a panel).
	 */
	_renderEmbeddedFormFooter(
		wrapper_el,
		doctype,
		name,
		mode,
		form_proxy,
		fg,
		onAfterSave = null
	) {
		const footer = document.createElement("div");
		footer.className = "embedded-form-footer d-flex justify-content-end gap-2 mt-3 pb-2";

		const saveBtn = document.createElement("button");
		saveBtn.className = "btn btn-primary btn-sm";
		saveBtn.textContent = name ? __("Update") : __("Create");

		saveBtn.addEventListener("click", async () => {
			try {
				saveBtn.disabled = true;
				saveBtn.innerHTML =
					'<span class="spinner-border spinner-border-sm" style="width:.75rem;height:.75rem"></span> ' +
					(name ? __("Updating") : __("Creating"));
				await this._saveEmbeddedForm(doctype, name, mode, form_proxy, fg, onAfterSave);
			} finally {
				// only restore button state if onAfterSave didn't remove/hide the panel
				if (saveBtn.isConnected) {
					saveBtn.disabled = false;
					saveBtn.textContent = name ? __("Update") : __("Create");
				}
			}
		});

		footer.appendChild(saveBtn);
		wrapper_el.appendChild(footer);
	},

	/**
	 * Save flow — mirrors FormDialogMixin primary_action exactly.
	 * Fires: validate → insert/set_value → after_insert/after_update → after_save
	 * onAfterSave is called last (e.g. to reload table and hide the inline panel).
	 */
	async _saveEmbeddedForm(doctype, name, mode, form_proxy, fg, onAfterSave = null) {
		let values = fg.get_values();
		if (!values) return;

		// validate hook
		if (this.frm?.["dt_events"]?.[doctype]?.["validate"]) {
			let change = this.frm["dt_events"][doctype]["validate"];
			if (this.isAsync(change)) {
				await change(this, mode, values, false);
			} else {
				change(this, mode, values, false);
			}
			values = fg.get_values();
		}
		if (this.frm?.["dt_global_events"]?.["validate"]) {
			let change = this.frm["dt_global_events"]["validate"];
			if (this.isAsync(change)) {
				await change(this, mode, values, false);
			} else {
				change(this, mode, values, false);
			}
			values = fg.get_values();
		}

		if (!name) {
			// insert
			let response = await frappe.xcall("frappe.client.insert", {
				doc: { doctype, ...values },
			});
			if (response) {
				frappe.show_alert({
					message: __("Successfully created {0}", [__(doctype)]),
					indicator: "success",
				});
				if (this.frm?.["dt_events"]?.[doctype]?.["after_insert"]) {
					let change = this.frm["dt_events"][doctype]["after_insert"];
					this.isAsync(change) ? await change(this, response) : change(this, response);
				}
				if (this.frm?.["dt_global_events"]?.["after_insert"]) {
					let change = this.frm["dt_global_events"]["after_insert"];
					this.isAsync(change) ? await change(this, response) : change(this, response);
				}
			}
		} else {
			// set_value (update)
			let fields_to_update = fg.fields_list
				.filter(
					(f) =>
						!["Section Break", "Column Break", "HTML", "Button", "Tab Break"].includes(
							f.df.fieldtype
						) && !f.df.set_only_once
				)
				.map((f) => f.df.fieldname);

			let updated_values = {};
			for (let key of fields_to_update) {
				let val = values[key];
				if (Array.isArray(val)) {
					updated_values[key] = val.map((item) =>
						item.old_name ? { ...item, name: item.old_name } : item
					);
				} else {
					updated_values[key] = val ?? "";
				}
			}

			let response = await frappe.xcall("frappe.client.set_value", {
				doctype,
				name,
				fieldname: updated_values,
			});
			if (response) {
				frappe.show_alert({
					message: __("Successfully updated {0}", [__(doctype)]),
					indicator: "success",
				});
				if (this.frm?.["dt_events"]?.[doctype]?.["after_update"]) {
					let change = this.frm["dt_events"][doctype]["after_update"];
					this.isAsync(change) ? await change(this, response) : change(this, response);
				}
				if (this.frm?.["dt_global_events"]?.["after_update"]) {
					let change = this.frm["dt_global_events"]["after_update"];
					this.isAsync(change) ? await change(this, response) : change(this, response);
				}
			}
		}

		// after_save hook
		if (this.frm?.["dt_events"]?.[doctype]?.["after_save"]) {
			let change = this.frm["dt_events"][doctype]["after_save"];
			this.isAsync(change) ? await change(this, mode, values) : change(this, mode, values);
		}
		if (this.frm?.["dt_global_events"]?.["after_save"]) {
			let change = this.frm["dt_global_events"]["after_save"];
			this.isAsync(change) ? await change(this, mode, values) : change(this, mode, values);
		}

		// Panel / caller teardown (e.g. hide inline panel and reload table)
		if (typeof onAfterSave === "function") {
			await onAfterSave();
		}
	},

	// ── Routing helper ───────────────────────────────────────────────────────────

	/**
	 * Routes Create / Edit / View to either the inline panel or the modal dialog
	 * depending on the use_embedded_form flag on connection or options.
	 *
	 * Usage:
	 *   this._openForm(doctype, name, "write")   // edit
	 *   this._openForm(doctype, null, "create")  // add row
	 *   this._openForm(doctype, name, "view")    // view
	 */
	_openForm(doctype, name, mode) {
		if (this.connection?.use_embedded_form || this.options?.use_embedded_form) {
			return this.showEmbeddedFormPanel(doctype, name, mode);
		}
		return this.createFormDialog(doctype, name, mode);
	},

	// ── Tab helpers ──────────────────────────────────────────────────────────────

	/**
	 * Splits a flat fields array into groups at each Tab Break boundary.
	 * Returns { tabGroups: [{ label, fields }], hasTabs: bool }
	 */
	_splitFieldsByTabs(fields) {
		const tabGroups = [];
		let currentLabel = __("Details");
		let currentFields = [];
		let hasTabs = false;

		for (const f of fields) {
			if (f.fieldtype === "Tab Break") {
				hasTabs = true;
				tabGroups.push({ label: currentLabel, fields: currentFields });
				currentLabel = f.label || `Tab ${tabGroups.length + 1}`;
				currentFields = [];
			} else {
				currentFields.push(f);
			}
		}
		tabGroups.push({ label: currentLabel, fields: currentFields });

		return { tabGroups, hasTabs };
	},

	/**
	 * Renders Bootstrap nav-tabs + per-tab FieldGroups.
	 * Populates allFgs and allFieldsDict in-place.
	 */
	_renderEmbeddedTabs(wrapper_el, tabGroups, allFgs, allFieldsDict) {
		// Nav tabs header
		const nav = document.createElement("ul");
		nav.className = "nav nav-tabs sva-ef-tabs";
		nav.style.cssText =
			"border-bottom:1px solid var(--border-color);flex-wrap:wrap;margin-bottom:0;";
		wrapper_el.appendChild(nav);

		// Content container
		const contentWrap = document.createElement("div");
		contentWrap.className = "sva-ef-tab-content";
		contentWrap.style.cssText =
			"border:1px solid var(--border-color);border-top:none;padding:12px 8px 4px;";
		wrapper_el.appendChild(contentWrap);

		let renderedCount = 0;

		tabGroups.forEach((group, i) => {
			// Skip groups with no fields (the implicit empty group before the first Tab Break)
			if (group.fields.length === 0) return;

			const isFirst = renderedCount === 0;

			// Nav item
			const li = document.createElement("li");
			li.className = "nav-item";

			const a = document.createElement("a");
			a.className = `nav-link sva-ef-tab-link${isFirst ? " active" : ""}`;
			a.href = "#";
			a.textContent = __(group.label);
			a.style.cssText = "font-size:12px;padding:6px 14px;color:var(--text-color);";
			li.appendChild(a);
			nav.appendChild(li);

			// Tab panel
			const panel = document.createElement("div");
			panel.className = "sva-ef-tab-panel";
			panel.setAttribute("data-tab", renderedCount);
			if (!isFirst) panel.style.display = "none";
			contentWrap.appendChild(panel);

			renderedCount++;

			// Tab switch handler
			a.addEventListener("click", (e) => {
				e.preventDefault();
				nav.querySelectorAll(".sva-ef-tab-link").forEach((l) =>
					l.classList.remove("active")
				);
				contentWrap.querySelectorAll(".sva-ef-tab-panel").forEach((p) => {
					p.style.display = "none";
				});
				a.classList.add("active");
				panel.style.display = "block";
			});

			// FieldGroup for this tab's fields
			if (group.fields.length > 0) {
				const tabFg = new frappe.ui.FieldGroup({
					fields: group.fields,
					body: panel,
				});
				tabFg.make();
				allFgs.push(tabFg);
				Object.assign(allFieldsDict, tabFg.fields_dict);
			}
		});
	},

	/**
	 * Builds a frappe.ui.Dialog-compatible proxy that aggregates
	 * across all tab FieldGroups so dt_events can call
	 * dt.form_dialog.set_value(), get_value(), fields_dict etc.
	 * Also exposes fields_list (used by _saveEmbeddedForm).
	 */
	_buildCompositeProxy(allFgs, allFieldsDict, wrapper_el) {
		const getValueFromAny = (fn) => {
			for (const fg of allFgs) {
				const val = fg.get_value(fn);
				if (val !== undefined && val !== null && val !== "") return val;
				if (fn in (fg.fields_dict || {})) return fg.get_value(fn);
			}
			return undefined;
		};

		const setValueInAny = (fn, val) => {
			for (const fg of allFgs) {
				if (fn in (fg.fields_dict || {})) {
					return fg.set_value(fn, val);
				}
			}
		};

		const getAllValues = () => {
			let merged = {};
			for (const fg of allFgs) {
				Object.assign(merged, fg.get_values() || {});
			}
			return merged;
		};

		return {
			fields_dict: allFieldsDict,
			fields_list: allFgs.flatMap((fg) => fg.fields_list || []),
			get_value: getValueFromAny,
			set_value: setValueInAny,
			get_values: getAllValues,
			$wrapper: $(wrapper_el),
			clear: () => allFgs.forEach((fg) => fg.set_values({})),
			hide: () => {},
			show: () => {},
			_fg: allFgs[0] || null,
			_fgs: allFgs,
		};
	},
};

export default EmbeddedFormMixin;
