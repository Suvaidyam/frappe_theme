/**
 * CreateMixin — "+" column header to create a new doc from within the table
 *
 * Activated by including "create" in crud_permissions:
 *   crud_permissions: ["read", "write", "create"]
 *
 * A "+" <th> is appended after all doc columns (before the sentinel).
 * Clicking it opens a frappe.ui.Dialog pre-populated with visible,
 * non-read-only fields. On save, the new doc is inserted via
 * frappe.db.insert() and immediately appended as a new column.
 *
 * vdr_events hooks:
 *   beforeCreate(values, dialog)  — return false to cancel
 *   afterCreate(newDoc)           — called after successful insert
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
	 * Open a frappe.ui.Dialog with controls for all visible, non-read-only
	 * fields derived from the current meta. On primary action, inserts the
	 * document and appends it as a new column.
	 */
	openCreateDialog() {
		// Build field descriptors for the dialog — visible, writable fields only
		const dialogFields = this.getVisibleFields()
			.filter((df) => !df.read_only)
			.map((df) => ({
				fieldname: df.fieldname,
				label: df.label || df.fieldname,
				fieldtype: df.fieldtype,
				options: df.options || "",
				reqd: df.reqd || 0,
				default: df.default || "",
				description: df.description || "",
			}));

		const dialog = new frappe.ui.Dialog({
			title: __("Create New {0}", [__(this.doctype)]),
			fields: dialogFields,
			primary_action_label: __("Create"),
			primary_action: async (values) => {
				// vdr_events.beforeCreate hook — return false to cancel
				if (typeof this.events.beforeCreate === "function") {
					const result = this.events.beforeCreate(values, dialog);
					if (result === false) return;
				}

				try {
					const newDoc = await frappe.db.insert({
						doctype: this.doctype,
						...values,
					});

					dialog.hide();

					// Append the new document as the next column
					const absIndex = this.docs.length;
					this._appendDocColumn(newDoc, absIndex);
					this._rendered_count = (this._rendered_count || 0) + 1;

					// vdr_events.afterCreate hook
					if (typeof this.events.afterCreate === "function") {
						this.events.afterCreate(newDoc);
					}

					frappe.show_alert({
						message: __("{0} created successfully", [newDoc.name || __("Record")]),
						indicator: "green",
					});
				} catch (e) {
					const msg = (e && (e.message || e.exc_type)) || String(e);
					frappe.msgprint({
						title: __("Create failed"),
						message: msg,
						indicator: "red",
					});
				}
			},
		});

		dialog.show();
	},
};

export default CreateMixin;
