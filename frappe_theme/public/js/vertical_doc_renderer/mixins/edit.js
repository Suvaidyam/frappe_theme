/**
 * EditMixin — inline editing with Excel-like auto-sync on focus-out
 *
 * Behaviour:
 *   - Clicking an editable cell opens a Frappe control inline (no dialog).
 *   - For instant-change types (Check, Select): saves on the `change` event.
 *   - For text-like types: saves automatically when the input loses focus (blur).
 *   - ESC cancels and reverts the cell to its original content.
 *   - While saving: cell opacity drops to 0.5 and a spinner appears.
 *   - On failure: cell reverts to original content and an error banner is shown.
 *   - On success: error banner is cleared (if any).
 *
 * Complex field types (Link, Text, Attach, etc.) still use a frappe.ui.Dialog
 * with an explicit Save button, since those controls don't fit well inline.
 */
const EditMixin = {
	/**
	 * Field types rendered inline (blur/change auto-save).
	 * All others open a dialog.
	 */
	getEditableCellTypes() {
		return [
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
	},

	/**
	 * Field types that fire `change` immediately (no need to wait for blur).
	 */
	_getInstantSaveTypes() {
		return ["Check", "Select"];
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
		if (df.read_only) return;
		// Also respect dynamic read_only_depends_on
		if (this.isFieldReadOnly && this.isFieldReadOnly(df, doc)) return;

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
	 * Replace cell content with a Frappe control.
	 * Auto-saves on blur (text fields) or change (Check/Select).
	 * ESC cancels and reverts.
	 *
	 * @param {HTMLElement} cell
	 * @param {Object}      df
	 * @param {Object}      doc
	 * @param {number}      colIndex
	 */
	renderInlineEditor(cell, df, doc, colIndex) {
		cell.dataset.editing = "1";
		// Preserve original HTML so we can revert on failure or ESC
		cell.dataset.originalContent = cell.innerHTML;
		cell.innerHTML = "";
		cell.style.cursor = "default";
		cell.title = "";

		// Control wrapper (fills the cell width)
		const inputHolder = document.createElement("div");
		inputHolder.style.cssText = "min-width: 0; width: 100%;";
		cell.appendChild(inputHolder);

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

		// ── cancel: revert cell to its pre-edit state ──────────────────────
		const cancel = () => {
			const orig = cell.dataset.originalContent || "";
			cell.innerHTML = orig;
			delete cell.dataset.editing;
			delete cell.dataset.originalContent;
			// Re-attach click listener
			this.attachEditListener(cell, df, doc, colIndex);
		};

		// ── triggerSave: validate → show spinner → persist → clean up ──────
		const triggerSave = async () => {
			if (cell.dataset.saving === "1") return;

			const newValue = ctrl.get_value();

			// Set saving visual state
			cell.dataset.saving = "1";
			cell.style.opacity = "0.5";
			const spinner = document.createElement("span");
			spinner.className = "sva-vdr-spinner";
			spinner.textContent = "\u21BB"; // ↻
			cell.appendChild(spinner);

			await this.saveValue(df, doc, newValue, cell, colIndex);

			// saveValue has already updated cell.innerHTML (success) or
			// reverted it (failure). Just clean up the saving state.
			delete cell.dataset.saving;
			cell.style.opacity = "";
			// spinner element was removed when saveValue replaced innerHTML
		};

		// ── wire events based on field type ───────────────────────────────
		if (ctrl.$input) {
			if (this._getInstantSaveTypes().includes(df.fieldtype)) {
				// Check, Select — save immediately on change
				ctrl.$input.on("change", triggerSave);
			} else {
				// Text-like fields — save when focus leaves the input
				ctrl.$input.on("blur", triggerSave);
				// ESC → cancel without saving
				ctrl.$input.on("keydown", (e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						cancel();
					}
				});
			}
		}
	},

	/**
	 * Open a frappe.ui.Dialog for complex field types (Link, Text, Attach, etc.).
	 * Dialog retains an explicit "Save" button — auto-sync doesn't apply here.
	 *
	 * @param {Object}  df
	 * @param {Object}  doc
	 * @param {number}  colIndex
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

		if (df.fieldtype === "Geolocation") {
			const geoCtrl = dialog.fields_dict[df.fieldname];
			if (geoCtrl) {
				geoCtrl.doctype = this.doctype;
				geoCtrl.doc = doc;

				// bind_leaflet_draw_control() gates draw tools on
				// frappe.perm.has_perm(this.doctype, this.df.permlevel, "write", this.doc).
				// This silently fails for connected/child doctypes that lack an explicit
				// Frappe write-permission role entry, even when VDR crud_permissions
				// includes "write". We already verified write permission in attachEditListener,
				// so bypass the Frappe perm check and respect only df.read_only.
				geoCtrl.bind_leaflet_draw_control = function () {
					if (this.df.read_only) return;
					this.draw_control = this.get_leaflet_controls();
					this.map.addControl(this.draw_control);
				};

				// Frappe's dialog path registers a frappe.ui.Dialog:shown handler every
				// time set_disp_area() is called (dialog init + set_value both call it).
				// Multiple handlers → multiple make_map() calls → Leaflet "Map container
				// already initialized". Also, make_map() is called without value in that
				// path, so existing geo data never renders.
				// Fix: gate make_map() to run once and supply the existing value.
				// Always call the prototype method directly so chained instance patches
				// (if geoCtrl is ever reused across dialog opens) don't no-op the call.
				const existingValue = doc[df.fieldname];
				let mapReady = false;
				const protoMakeMap = Object.getPrototypeOf(geoCtrl).make_map;
				geoCtrl.make_map = (v) => {
					if (mapReady) return;
					mapReady = true;
					protoMakeMap.call(geoCtrl, v !== undefined ? v : existingValue);
				};

				// After Bootstrap's show animation completes, re-invalidate map size.
				// Without this, fitBounds() (called during make_map with existingValue)
				// runs while the container is still animating → Leaflet calculates a 0px
				// viewport → tiles never load → blank white map on reopen after a save.
				dialog.$wrapper.one("shown.bs.modal", () => {
					if (geoCtrl.map) {
						geoCtrl.map.invalidateSize();
						const layers = geoCtrl.editableLayers?.getLayers() || [];
						if (layers.length) {
							try {
								geoCtrl.map.fitBounds(geoCtrl.editableLayers.getBounds(), {
									padding: [50, 50],
								});
							} catch (e) {
								console.warn("Could not fit map bounds:", e);
							}
						}
					}
				});
			}

			// Remove the wrapper only after Bootstrap finishes its hide animation
			// (hidden.bs.modal fires after animation; onhide fires before it).
			// Removing mid-animation corrupts Bootstrap's modal stack so
			// $(document).trigger("frappe.ui.Dialog:shown") never fires for the next
			// dialog, leaving the map container blank on every reopen after a save.
			dialog.$wrapper.one("hidden.bs.modal", () => dialog.$wrapper.remove());
		}

		dialog.set_value(df.fieldname, doc[df.fieldname]);
		dialog.show();
	},

	/**
	 * Validate and persist a new value via frappe.db.set_value.
	 * On success: updates cell content, clears error banner.
	 * On failure: reverts cell to original content, shows error banner.
	 *
	 * @param {Object}           df       — field descriptor
	 * @param {Object}           doc      — document row (mutated on success)
	 * @param {*}                newValue — new value to save
	 * @param {HTMLElement|null} cell     — cell to update (null when called from dialog)
	 * @param {number}           colIndex — column index
	 */
	async saveValue(df, doc, newValue, cell, colIndex) {
		// ── client-side mandatory validation ────────────────────────────────
		if (typeof this.validateBeforeSave === "function") {
			const errors = this.validateBeforeSave(df, doc, newValue);
			if (errors.length) {
				if (typeof this.showErrorBanner === "function") {
					this.showErrorBanner(errors);
				}
				if (cell) {
					// Revert immediately — don't make the API call
					const orig = cell.dataset.originalContent;
					cell.innerHTML =
						orig !== undefined
							? orig
							: this.formatCellValue(doc[df.fieldname], df, doc, colIndex);
					delete cell.dataset.editing;
					delete cell.dataset.originalContent;
					this.attachEditListener(cell, df, doc, colIndex);
				}
				return;
			}
		}

		// ── beforeSave hook ─────────────────────────────────────────────────
		if (typeof this.events.beforeSave === "function") {
			const proceed = await this.events.beforeSave(df, doc.name, newValue);
			if (proceed === false) {
				if (cell) {
					delete cell.dataset.editing;
					delete cell.dataset.originalContent;
				}
				return;
			}
		}

		// ── persist ─────────────────────────────────────────────────────────
		try {
			const dt = doc.doctype || this.doctype;
			await frappe.db.set_value(dt, doc.name, df.fieldname, newValue);
			// await frappe.db.set_value(this.doctype, doc.name, df.fieldname, newValue);
			doc[df.fieldname] = newValue;

			if (cell) {
				delete cell.dataset.editing;
				delete cell.dataset.originalContent;
				// Update raw-value stamp so link title re-resolution works
				cell.dataset.rawValue = String(newValue ?? "");
				const formatted = this.formatCellValue(newValue, df, doc, colIndex);
				cell.innerHTML = formatted;
				this.attachEditListener(cell, df, doc, colIndex);

				// Re-resolve link titles if the saved field is a Link
				if (df.fieldtype === "Link" && typeof this.resolveLinkTitles === "function") {
					this.resolveLinkTitles();
				}
			} else {
				// Dialog path (cell === null): find the cell and refresh it
				const savedCell = this._table?.querySelector(
					`td.sva-vdr-value-cell[data-fieldname="${CSS.escape(
						df.fieldname
					)}"][data-docname="${CSS.escape(doc.name)}"]`
				);
				if (savedCell) {
					savedCell.dataset.rawValue = String(newValue ?? "");
					// Invalidate cache so resolveLinkTitles re-fetches the new value's display name
					if (df.fieldtype === "Link" && this._linkTitles?.[df.options]) {
						delete this._linkTitles[df.options][String(newValue ?? "")];
					}
					const formatted = this.formatCellValue(newValue, df, doc, colIndex);
					savedCell.innerHTML = formatted;
					this.attachEditListener(savedCell, df, doc, colIndex);
					if (df.fieldtype === "Link" && typeof this.resolveLinkTitles === "function") {
						this.resolveLinkTitles();
					}
				}
			}

			// Clear any error banner on success
			if (typeof this.clearErrorBanner === "function") {
				this.clearErrorBanner();
			}

			if (typeof this.events.afterSave === "function") {
				this.events.afterSave(df, doc.name, newValue);
			}
		} catch (err) {
			// ── failure: revert + show banner ───────────────────────────────
			const errMsg = (err && (err.message || err.exc_type)) || __("Could not save value");
			const label = __(df.label || df.fieldname);
			if (typeof this.showErrorBanner === "function") {
				this.showErrorBanner([`${label}: ${errMsg}`]);
			}

			if (cell) {
				// Revert to original HTML (preserves resolved link titles etc.)
				const orig = cell.dataset.originalContent;
				cell.innerHTML =
					orig !== undefined
						? orig
						: this.formatCellValue(doc[df.fieldname], df, doc, colIndex);
				delete cell.dataset.editing;
				delete cell.dataset.originalContent;
				this.attachEditListener(cell, df, doc, colIndex);
			}
		}
	},
};

export default EditMixin;
