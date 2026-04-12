const EditMixin = {
	/**
	 * Field types that get inline (in-cell) editing.
	 * All others open a dialog.
	 */
	getEditableCellTypes() {
		return ["Data", "Int", "Float", "Currency", "Percent", "Date", "Datetime", "Time", "Check", "Select", "Small Text"];
	},

	/**
	 * Entry point: attach a click listener to a value cell so it becomes editable
	 * when write permission is present.
	 *
	 * @param {HTMLElement} cell     — the <td> to make editable
	 * @param {Object}      df       — field descriptor
	 * @param {Object}      doc      — the document row object
	 * @param {number}      colIndex — 0-based column index
	 */
	attachEditListener(cell, df, doc, colIndex) {
		if (!this.crud_permissions.includes("write")) return;
		// Read-only fields
		if (df.read_only) return;

		cell.style.cursor = "pointer";
		cell.title = __("Click to edit");

		cell.addEventListener("click", () => {
			if (cell.dataset.editing === "1") return;
			if (this.getEditableCellTypes().includes(df.fieldtype)) {
				this.renderInlineEditor(cell, df, doc, colIndex);
			} else {
				this.openEditDialog(df, doc, colIndex);
			}
		});
	},

	/**
	 * Replace cell content with a Frappe control + ✓ / ✗ action buttons.
	 */
	renderInlineEditor(cell, df, doc, colIndex) {
		cell.dataset.editing = "1";
		const originalContent = cell.innerHTML;
		cell.innerHTML = "";

		// Wrapper for the control
		const controlWrapper = document.createElement("div");
		controlWrapper.style.cssText = "display:flex;align-items:center;gap:4px;padding:2px;";

		const inputHolder = document.createElement("div");
		inputHolder.style.cssText = "flex:1;min-width:0;";
		controlWrapper.appendChild(inputHolder);

		// ✓ save
		const saveBtn = document.createElement("button");
		saveBtn.className = "btn btn-xs btn-success";
		saveBtn.innerHTML = "✓";
		saveBtn.title = __("Save");
		saveBtn.style.cssText = "padding:1px 5px;line-height:1.4;";

		// ✗ cancel
		const cancelBtn = document.createElement("button");
		cancelBtn.className = "btn btn-xs btn-default";
		cancelBtn.innerHTML = "✗";
		cancelBtn.title = __("Cancel");
		cancelBtn.style.cssText = "padding:1px 5px;line-height:1.4;";

		controlWrapper.appendChild(saveBtn);
		controlWrapper.appendChild(cancelBtn);
		cell.appendChild(controlWrapper);

		// Build Frappe control
		const ctrl = frappe.ui.form.make_control({
			df: { ...df, label: "" },
			parent: inputHolder,
			only_input: df.fieldtype !== "Check",
			render_input: true,
		});
		ctrl.refresh();
		ctrl.set_value(doc[df.fieldname]);
		if (ctrl.$input) ctrl.$input.focus();

		const cancel = () => {
			cell.innerHTML = originalContent;
			delete cell.dataset.editing;
			// Re-attach listener
			this.attachEditListener(cell, df, doc, colIndex);
		};

		cancelBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			cancel();
		});

		saveBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const newValue = ctrl.get_value();
			await this.saveValue(df, doc, newValue, cell, colIndex);
		});
	},

	/**
	 * Open a frappe.ui.Dialog for complex field types.
	 */
	openEditDialog(df, doc, colIndex) {
		const dialog = new frappe.ui.Dialog({
			title: __(df.label),
			fields: [{ ...df, label: df.label, reqd: 0 }],
			primary_action_label: __("Save"),
			primary_action: async ({ [df.fieldname]: newValue }) => {
				dialog.hide();
				await this.saveValue(df, doc, newValue, null, colIndex);
			},
		});
		dialog.set_value(df.fieldname, doc[df.fieldname]);
		dialog.show();
	},

	/**
	 * Persist the new value via frappe.db.set_value, then refresh the cell.
	 *
	 * @param {Object}      df       — field descriptor
	 * @param {Object}      doc      — document row object (mutated on success)
	 * @param {*}           newValue — new value to save
	 * @param {HTMLElement} cell     — cell to refresh (null when called from dialog)
	 * @param {number}      colIndex — column index
	 */
	async saveValue(df, doc, newValue, cell, colIndex) {
		// beforeSave hook — returning false cancels the save
		if (typeof this.events.beforeSave === "function") {
			const proceed = await this.events.beforeSave(df, doc.name, newValue);
			if (proceed === false) {
				if (cell) {
					delete cell.dataset.editing;
				}
				return;
			}
		}

		try {
			await frappe.db.set_value(this.doctype, doc.name, df.fieldname, newValue);
			doc[df.fieldname] = newValue;

			if (cell) {
				delete cell.dataset.editing;
				const formatted = this.formatCellValue(newValue, df, doc, colIndex);
				cell.innerHTML = formatted;
				this.attachEditListener(cell, df, doc, colIndex);
			}

			if (typeof this.events.afterSave === "function") {
				this.events.afterSave(df, doc.name, newValue);
			}
		} catch (err) {
			frappe.msgprint({
				title: __("Error"),
				indicator: "red",
				message: err.message || __("Could not save value"),
			});
			if (cell) {
				// Restore original display
				delete cell.dataset.editing;
				const formatted = this.formatCellValue(doc[df.fieldname], df, doc, colIndex);
				cell.innerHTML = formatted;
				this.attachEditListener(cell, df, doc, colIndex);
			}
		}
	},
};

export default EditMixin;
