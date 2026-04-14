/**
 * CreateMixin — "+" toolbar button to create a new doc from within the table
 *
 * Activated by including "create" in crud_permissions:
 *   crud_permissions: ["read", "write", "create"]
 *
 * The "+" button is rendered in the toolbar (top-left corner above the table)
 * by ui_setup._buildToolbar(). No <th> column is added to the thead.
 * Clicking it adds a "draft" column immediately — no dialog opens.
 * The draft column shows inline input controls for all simple editable fields.
 * Complex field types (Link, Text, Attach, etc.) show a "—" placeholder that
 * opens a small dialog when clicked to set the value.
 * Clicking "Create" in the draft header calls frappe.db.insert() with the
 * collected values and replaces the draft column with the real column.
 * Clicking "Cancel" removes the draft column without any server call.
 *
 * vdr_events hooks:
 *   beforeCreate(values, null)  — return false to cancel
 *   afterCreate(newDoc)         — called after successful insert
 */
const CreateMixin = {
	/**
	 * Build the "+" <th> column header cell.
	 * Called by rendering.js _buildThead() when allow_create is true.
	 * @returns {HTMLElement}
	 */
	_buildCreateHeaderCell() {
		const th = document.createElement("th");
		th.className = "sva-vdr-header-cell sva-vdr-create-col";
		th.title = __("Add new record");
		th.style.cssText = `
			background: var(--sva-vdr-header-bg, #1a3a5c);
			color: var(--sva-vdr-header-text, #fff);
			font-weight: 700;
			font-size: 20px;
			padding: 2px 14px;
			text-align: center;
			white-space: nowrap;
			border: 1px solid rgba(0,0,0,.08);
			cursor: pointer;
			min-width: 48px;
			user-select: none;
			transition: opacity .15s;
		`;
		th.textContent = "+";

		th.addEventListener("mouseenter", () => (th.style.opacity = "0.75"));
		th.addEventListener("mouseleave", () => (th.style.opacity = "1"));
		th.addEventListener("click", () => this.openCreateDialog());

		return th;
	},

	/**
	 * Add a draft column to the table immediately — no dialog, no DB call.
	 * The user fills in values inline and clicks "Create" to persist.
	 */
	openCreateDialog() {
		// Prevent multiple draft columns
		if (this._hasDraftColumn) return;

		// vdr_events.beforeCreate hook — return false to cancel
		if (typeof this.events.beforeCreate === "function") {
			const result = this.events.beforeCreate({}, null);
			if (result === false) return;
		}

		this._hasDraftColumn = true;
		this._draftValues = {};

		const absIndex = this.docs.length;

		// 1. Draft header cell (with Create / Cancel buttons)
		const th = this._buildDraftHeaderCell(absIndex);
		const insertBefore = this._sentinel;
		if (insertBefore) {
			this._theadRow.insertBefore(th, insertBefore);
		} else {
			this._theadRow.appendChild(th);
		}

		// 2. Draft value cells in each field row
		const fieldRows = this._table.querySelectorAll("tr.sva-vdr-field-row");
		fieldRows.forEach((tr) => {
			const fieldname = tr.dataset.fieldname;
			const df = (this.meta.fields || []).find((f) => f.fieldname === fieldname);
			if (!df) return;
			tr.appendChild(this._buildDraftValueCell(df));
		});

		// 3. Widen section header rows by 1
		this._table.querySelectorAll("tr.sva-vdr-section-row td").forEach((td) => {
			td.colSpan = (td.colSpan || 1) + 1;
		});
	},

	/**
	 * Build the draft column header with "New Record" label and
	 * "Create" + "Cancel" buttons.
	 *
	 * @param {number} absIndex — column index used when committing
	 * @returns {HTMLElement}
	 */
	_buildDraftHeaderCell(absIndex) {
		const th = document.createElement("th");
		th.className = "sva-vdr-header-cell sva-vdr-doc-header sva-vdr-draft-header";
		th.dataset.docname = "__draft__";
		th.style.cssText = `
			background: #6c757d;
			color: #fff;
			font-weight: 600;
			padding: 4px 8px;
			text-align: center;
			white-space: nowrap;
			border: 1px solid rgba(0,0,0,.08);
			min-width: 120px;
			position: sticky;
			top: 0;
			z-index: 2;
		`;

		const label = document.createElement("div");
		label.textContent = __("New Record");
		label.style.cssText = "font-size: 12px; margin-bottom: 4px;";
		th.appendChild(label);

		const btnRow = document.createElement("div");
		btnRow.style.cssText = "display: flex; gap: 4px; justify-content: center;";

		const saveBtn = document.createElement("button");
		saveBtn.className = "btn btn-xs btn-success";
		saveBtn.textContent = __("Create");
		saveBtn.addEventListener("click", () => this._commitDraftColumn(absIndex, th));

		const cancelBtn = document.createElement("button");
		cancelBtn.className = "btn btn-xs btn-default";
		cancelBtn.textContent = __("Cancel");
		cancelBtn.addEventListener("click", () => this._removeDraftColumn());

		btnRow.appendChild(saveBtn);
		btnRow.appendChild(cancelBtn);
		th.appendChild(btnRow);

		return th;
	},

	/**
	 * Build a single draft value cell.
	 * Simple field types (Data, Int, Select, etc.) show an inline control
	 * immediately. Complex types (Link, Text, Attach, etc.) show a "—"
	 * placeholder that opens a small dialog on click.
	 *
	 * @param {Object} df — field descriptor
	 * @returns {HTMLElement}
	 */
	_buildDraftValueCell(df) {
		const td = document.createElement("td");
		td.className = "sva-vdr-value-cell sva-vdr-draft-cell";
		td.dataset.fieldname = df.fieldname;
		td.dataset.docname = "__draft__";
		td.style.cssText = `
			padding: 4px 6px;
			border: 1px solid rgba(0,0,0,.06);
			vertical-align: middle;
			min-width: 100px;
			max-width: 280px;
		`;

		if (df.read_only) {
			td.style.background = "var(--sva-vdr-readonly-bg, #f5f5f5)";
			td.style.color = "var(--sva-vdr-readonly-text, #999)";
			td.textContent = "—";
			return td;
		}

		const simpleTypes = this.getEditableCellTypes
			? this.getEditableCellTypes()
			: [
					"Data",
					"Int",
					"Float",
					"Currency",
					"Percent",
					"Date",
					"Datetime",
					"Time",
					"Check",
					"Select",
					"Small Text",
			  ];

		if (simpleTypes.includes(df.fieldtype)) {
			// Inline control — always visible, no click needed
			const inputHolder = document.createElement("div");
			inputHolder.style.cssText = "min-width: 0; width: 100%;";
			td.appendChild(inputHolder);

			const ctrl = frappe.ui.form.make_control({
				df: { ...df, label: "" },
				parent: inputHolder,
				only_input: df.fieldtype !== "Check",
				render_input: true,
			});
			ctrl.refresh();

			const defaultVal = df.default || "";
			ctrl.set_value(defaultVal);
			if (defaultVal) this._draftValues[df.fieldname] = defaultVal;

			const storeValue = () => {
				this._draftValues[df.fieldname] = ctrl.get_value();
			};

			if (ctrl.$input) {
				ctrl.$input.on("change blur", storeValue);
			}
		} else {
			// Complex type — show placeholder, open dialog on click
			td.style.cursor = "pointer";
			td.style.color = "#adb5bd";
			td.title = __("Click to set");
			td.textContent = "—";

			td.addEventListener("click", () => this._openDraftFieldDialog(df, td));
		}

		return td;
	},

	/**
	 * Open a small dialog to set a complex-type field value on the draft column.
	 *
	 * @param {Object}      df — field descriptor
	 * @param {HTMLElement} td — the draft cell to update after selection
	 */
	_openDraftFieldDialog(df, td) {
		const dialog = new frappe.ui.Dialog({
			title: __(df.label || df.fieldname),
			fields: [{ ...df, label: df.label, reqd: 0 }],
			primary_action_label: __("Set"),
			primary_action: (values) => {
				const val = values[df.fieldname];
				this._draftValues[df.fieldname] = val;
				td.textContent = val || "—";
				td.style.color = val ? "" : "#adb5bd";
				dialog.hide();
			},
		});
		dialog.set_value(df.fieldname, this._draftValues[df.fieldname] || "");
		dialog.show();
	},

	/**
	 * Commit the draft column: call frappe.db.insert() with collected values,
	 * remove the draft column, then append the real column.
	 *
	 * @param {number}      absIndex — column index for config lookup
	 * @param {HTMLElement} th       — draft header cell (for button state)
	 */
	async _commitDraftColumn(absIndex, th) {
		const valuesToInsert = { ...this._draftValues };

		const saveBtn = th.querySelector(".btn-success");
		const cancelBtn = th.querySelector(".btn-default");
		if (saveBtn) {
			saveBtn.disabled = true;
			saveBtn.textContent = __("Saving…");
		}
		if (cancelBtn) cancelBtn.disabled = true;

		try {
			const newDoc = await frappe.db.insert({
				doctype: this.doctype,
				...valuesToInsert,
			});

			this._removeDraftColumn();

			this._appendDocColumn(newDoc, absIndex);
			this._rendered_count = (this._rendered_count || 0) + 1;

			if (typeof this.events.afterCreate === "function") {
				this.events.afterCreate(newDoc);
			}

			frappe.show_alert({
				message: __("{0} created successfully", [newDoc.name || __("Record")]),
				indicator: "green",
			});
		} catch (e) {
			if (saveBtn) {
				saveBtn.disabled = false;
				saveBtn.textContent = __("Create");
			}
			if (cancelBtn) cancelBtn.disabled = false;

			const msg = (e && (e.message || e.exc_type)) || String(e);
			frappe.msgprint({
				title: __("Create failed"),
				message: msg,
				indicator: "red",
			});
		}
	},

	/**
	 * Remove the draft column from the DOM and reset draft state.
	 */
	_removeDraftColumn() {
		// Remove draft header
		this._theadRow?.querySelector("th[data-docname='__draft__']")?.remove();

		// Remove all draft value cells
		this._table?.querySelectorAll("td[data-docname='__draft__']").forEach((td) => td.remove());

		// Shrink section header colspans
		this._table?.querySelectorAll("tr.sva-vdr-section-row td").forEach((td) => {
			if ((td.colSpan || 1) > 1) td.colSpan -= 1;
		});

		this._hasDraftColumn = false;
		this._draftValues = {};
	},
};

export default CreateMixin;
