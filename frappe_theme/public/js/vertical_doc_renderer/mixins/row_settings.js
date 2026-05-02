/**
 * RowSettingsMixin — gear button + dialog to configure which field rows are
 * visible and in what order (listview-settings equivalent for VDR rows).
 *
 * Activated when `vdr_field_name` is passed to the constructor (i.e. the VDR
 * was configured via the no-code Custom Property Setter dialog). Without it,
 * the toolbar button is not rendered and settings are session-only.
 *
 * Persistence:
 *   Administrator  → frappe_theme.dt_api.update_sva_ft_property
 *                    (updates "vdr_fields_config" key inside the sva_ft JSON)
 *   Other users    → frappe_theme.dt_api.setup_user_list_settings
 *                    (stored in SVADT User Listview Settings)
 *
 * this.fields_config — string[] of fieldnames in display order, or null
 *   null  → use default meta order + fields_to_show/hide
 *   set   → authoritative ordered+visible field list (replaces fields_to_show/hide)
 */
const RowSettingsMixin = {
	/**
	 * Build and return the gear settings button for the toolbar.
	 * @returns {HTMLElement}
	 */
	_buildSettingsButton() {
		const btn = document.createElement("button");
		btn.className = "btn btn-secondary btn-xs sva-vdr-settings-btn";
		btn.title = __("Configure row settings");
		btn.style.cssText = `
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			font-size: 12px;
			${this._has_user_settings ? "color: var(--primary, #4285f4);" : ""}
		`;
		btn.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
				<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.901-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
			</svg>
			${__("Settings")}
		`;

		btn.addEventListener("click", () => {
			if (btn.disabled) return;
			this.openRowSettingsDialog();
		});

		this._settingsBtn = btn;
		return btn;
	},

	/**
	 * Open a dialog listing all non-layout, non-hidden meta fields with
	 * drag-to-reorder and check/uncheck for visibility.
	 */
	openRowSettingsDialog() {
		const me = this;

		// Build the candidate field list (all non-layout, non-hidden fields)
		const SKIP_TYPES = new Set([
			"Column Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Barcode",
			"Tab Break",
			"Section Break",
		]);
		const allFields = (this.meta.fields || []).filter(
			(df) => !SKIP_TYPES.has(df.fieldtype) && !df.hidden
		);

		// Determine initial ordered+visible set
		let orderedFields;
		if (this.fields_config && this.fields_config.length > 0) {
			const map = new Map(allFields.map((df) => [df.fieldname, df]));
			// Fields in config (visible), then remaining (hidden)
			const configSet = new Set(this.fields_config);
			orderedFields = [
				...this.fields_config
					.map((fn) => map.get(fn))
					.filter(Boolean)
					.map((df) => ({ df, checked: true })),
				...allFields
					.filter((df) => !configSet.has(df.fieldname))
					.map((df) => ({ df, checked: false })),
			];
		} else {
			// No config — use meta order, all visible
			const hiddenSet = new Set(this.fields_to_hide || []);
			const showSet = this.fields_to_show ? new Set(this.fields_to_show) : null;
			orderedFields = allFields.map((df) => ({
				df,
				checked: !hiddenSet.has(df.fieldname) && (!showSet || showSet.has(df.fieldname)),
			}));
		}

		// Build dialog HTML
		const listHtml = orderedFields
			.map(
				({ df, checked }) => `
				<div class="sva-vdr-field-item sortable" data-fieldname="${df.fieldname}" style="
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 6px 8px;
					margin-bottom: 2px;
					background: var(--control-bg, #f8f9fa);
					border: 1px solid var(--border-color, #d1d8dd);
					border-radius: 4px;
					cursor: grab;
					user-select: none;
				">
					<span class="sva-vdr-sort-handle" style="color: var(--text-muted, #888); font-size: 14px; cursor: grab;">≡</span>
					<input type="checkbox" class="sva-vdr-field-check" ${checked ? "checked" : ""}
						style="margin: 0; cursor: pointer; width: 14px; height: 14px; flex-shrink: 0;"
					/>
					<span style="font-size: 13px; color: var(--text-color, #333);">${__(
						df.label || df.fieldname
					)}</span>
					<span style="font-size: 11px; color: var(--text-muted, #888); margin-left: auto;">${
						df.fieldtype
					}</span>
				</div>`
			)
			.join("");

		const dialog = new frappe.ui.Dialog({
			title: __("Configure Field Rows"),
			fields: [
				{
					fieldname: "hint",
					fieldtype: "HTML",
					options: `<p style="color:var(--text-muted,#888);font-size:12px;margin:0 0 8px;">
						${__("Drag ≡ to reorder. Uncheck to hide a field row.")}
					</p>`,
				},
				{
					fieldname: "field_list",
					fieldtype: "HTML",
					options: `<div class="sva-vdr-field-list" style="max-height:420px;overflow-y:auto;padding:2px 0;">${listHtml}</div>`,
				},
			],
			primary_action_label: __("Save Settings"),
			primary_action() {
				me._saveRowSettings(dialog);
			},
			secondary_action_label: __("Reset to Default"),
			secondary_action() {
				me._resetRowSettings(dialog);
			},
		});

		dialog.show();

		// Initialize Sortable.js on the list container
		const listEl = dialog.$wrapper[0].querySelector(".sva-vdr-field-list");
		if (listEl && typeof Sortable !== "undefined") {
			new Sortable(listEl, {
				handle: ".sva-vdr-sort-handle",
				draggable: ".sortable",
				animation: 120,
			});
		}
	},

	/**
	 * Read the dialog's current field order and checked state, persist to
	 * server, update this.fields_config, rebuild tbody.
	 *
	 * @param {frappe.ui.Dialog} dialog
	 */
	async _saveRowSettings(dialog) {
		const listEl = dialog.$wrapper[0].querySelector(".sva-vdr-field-list");
		if (!listEl) return;

		// Collect checked fieldnames in current DOM order
		const newConfig = [];
		listEl.querySelectorAll(".sva-vdr-field-item").forEach((row) => {
			const cb = row.querySelector(".sva-vdr-field-check");
			if (cb && cb.checked) {
				newConfig.push(row.dataset.fieldname);
			}
		});

		if (newConfig.length === 0) {
			frappe.msgprint({
				message: __("Select at least one field to display."),
				indicator: "red",
			});
			return;
		}

		// Disable primary button while saving
		const primaryBtn = dialog.$wrapper[0].querySelector(".btn-primary");
		if (primaryBtn) primaryBtn.disabled = true;

		try {
			await this._persistRowSettings(newConfig);
		} catch (e) {
			if (primaryBtn) primaryBtn.disabled = false;
			frappe.msgprint({
				title: __("Save failed"),
				message: String(e?.message || e),
				indicator: "red",
			});
			return;
		}

		this.fields_config = newConfig;
		this._has_user_settings = frappe.session.user !== "Administrator";

		// Refresh settings button tint
		if (this._settingsBtn) {
			this._settingsBtn.style.color = this._has_user_settings
				? "var(--primary, #4285f4)"
				: "";
		}

		dialog.hide();
		this._rebuildRows();

		frappe.show_alert({ message: __("Row settings saved"), indicator: "green" });
	},

	/**
	 * Delete user-specific settings and revert to the initial config
	 * (the value passed at construction time, reflecting the admin config).
	 *
	 * @param {frappe.ui.Dialog} dialog
	 */
	async _resetRowSettings(dialog) {
		if (this.frm && this.vdr_field_name && frappe.session.user !== "Administrator") {
			try {
				await frappe.xcall("frappe_theme.dt_api.delete_user_list_settings", {
					parent_id: `${this.frm.doctype}-${this.vdr_field_name}`,
					child_dt: this.doctype,
				});
			} catch (_) {
				// Ignore — might not exist
			}
		}

		this.fields_config = this._initial_fields_config ? [...this._initial_fields_config] : null;
		this._has_user_settings = false;

		if (this._settingsBtn) {
			this._settingsBtn.style.color = "";
		}

		dialog.hide();
		this._rebuildRows();

		frappe.show_alert({ message: __("Row settings reset to default"), indicator: "blue" });
	},

	/**
	 * Call the appropriate server API to persist the new fields config.
	 * Administrator → update_sva_ft_property (updates the sva_ft JSON on the Property Setter)
	 * Others        → setup_user_list_settings (per-user override in SVADT User Listview Settings)
	 *
	 * If frm / vdr_field_name are not available, settings are session-only (no server call).
	 *
	 * @param {string[]} newConfig — ordered fieldname array
	 */
	async _persistRowSettings(newConfig) {
		if (!this.frm || !this.vdr_field_name) return; // standalone usage — session only

		if (frappe.session.user === "Administrator") {
			await frappe.xcall("frappe_theme.dt_api.update_sva_ft_property", {
				doctype: this.frm.doctype,
				fieldname: this.vdr_field_name,
				key: "vdr_fields_config",
				value: JSON.stringify(newConfig),
			});
		} else {
			await frappe.xcall("frappe_theme.dt_api.setup_user_list_settings", {
				parent_id: `${this.frm.doctype}-${this.vdr_field_name}`,
				child_dt: this.doctype,
				listview_settings: JSON.stringify(newConfig),
			});
		}
	},

	/**
	 * Check for a non-admin user's saved row settings override.
	 * Called once during _initialize(), after fetchMeta() and before render().
	 * No-op for Administrator (always uses the sva_ft value passed at construction).
	 */
	async _loadUserRowSettings() {
		if (!this.frm || !this.vdr_field_name) return;
		if (frappe.session.user === "Administrator") return;

		try {
			const result = await frappe.xcall("frappe_theme.dt_api.get_user_list_settings", {
				parent_id: `${this.frm.doctype}-${this.vdr_field_name}`,
				child_dt: this.doctype,
			});
			if (result) {
				this.fields_config = JSON.parse(result);
				this._has_user_settings = true;
			}
		} catch (_) {
			// If the API call fails, fall back to the constructor-supplied config
		}
	},

	/**
	 * Rebuild just the <tbody> after fields_config changes.
	 * The <thead> (doc columns) is unchanged.
	 * Works correctly because _buildTbody() iterates this.data (all loaded docs).
	 */
	_rebuildRows() {
		if (!this._table) return;
		const oldTbody = this._table.getElementsByTagName("tbody")[0];
		if (!oldTbody) return;
		oldTbody.replaceWith(this._buildTbody());
	},
};

export default RowSettingsMixin;
