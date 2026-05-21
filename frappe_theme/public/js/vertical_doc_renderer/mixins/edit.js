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

		// Remove any previously attached handler before adding a new one so
		// repeated calls (e.g. after every save) never stack up listeners.
		if (cell._svaVdrClickHandler) {
			cell.removeEventListener("click", cell._svaVdrClickHandler);
		}

		const _handler = () => {
			if (cell.dataset.editing === "1") return;
			if (df.fieldtype === "Table") {
				this._openTableEditDialog(df, doc, colIndex);
			} else if (this.getEditableCellTypes().includes(df.fieldtype)) {
				this.renderInlineEditor(cell, df, doc, colIndex);
			} else {
				this.openEditDialog(df, doc, colIndex);
			}
		};
		cell._svaVdrClickHandler = _handler;
		cell.addEventListener("click", _handler);
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
		if (ctrl.$input) {
			ctrl.$input.focus();
			// air-datepicker doesn't always open on programmatic focus when a value is
			// already set — call show() explicitly for date/time types.
			// Deferred so the opening click event finishes propagating before show() runs;
			// otherwise air-datepicker's outside-click handler fires during the same tick
			// and immediately closes the picker (visible on second+ clicks on a dated cell).
			if (["Date", "Datetime", "Time"].includes(df.fieldtype)) {
				const dp = ctrl.datepicker || ctrl.$input.data("datepicker");
				if (dp && typeof dp.show === "function") {
					setTimeout(() => {
						if (cell.dataset.editing === "1") dp.show();
					}, 0);
				}
			}
		}

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

			// For Date/Datetime/Time: ctrl.get_value() returns the stale initial value
			// because the standalone control's this.value is never updated by air-datepicker
			// (set_model_value requires a frm/doctype context). Read $input.val() directly
			// and convert from locale display format to ISO using Frappe's datetime util.
			let newValue;
			if (df.fieldtype === "Date") {
				const raw = ctrl.$input.val();
				newValue = raw ? frappe.datetime.user_to_str(raw) : "";
			} else if (df.fieldtype === "Datetime") {
				const raw = ctrl.$input.val();
				newValue = raw ? frappe.datetime.user_to_str(raw, true) : "";
			} else if (df.fieldtype === "Time") {
				newValue = ctrl.$input.val() || "";
			} else {
				newValue = ctrl.get_value();
			}

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
			} else if (["Date", "Datetime", "Time"].includes(df.fieldtype)) {
				// Date picker types: flatpickr fires a native change event after selecting
				// a date, but Frappe's ctrl.value may not be fully settled yet. Defer by
				// one tick so ctrl.get_value() reliably returns the new ISO date string.
				ctrl.$input.on("change", () => setTimeout(triggerSave, 0));
				ctrl.$input.on("keydown", (e) => {
					if (e.key === "Escape") { e.preventDefault(); cancel(); }
				});
			} else {
				// Text-like fields — save when focus leaves the input
				ctrl.$input.on("blur", triggerSave);
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
						} else {
							// No existing location — auto-locate current GPS position and zoom in
							geoCtrl.map.once("locationfound", (e) => {
	geoCtrl.map.setView(e.latlng, 19);
});
geoCtrl.map.locate({ enableHighAccuracy: true });
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

		// getLinkQuery hook — apply get_query filter on the Link control inside the dialog.
		// Must patch ctrl.df too: dialog.show() triggers refresh_fields() → ctrl.refresh()
		// which resets ctrl.get_query from ctrl.df.get_query, overwriting a ctrl-only patch.
		if (df.fieldtype === "Link" && typeof this.events.getLinkQuery === "function") {
			const query = this.events.getLinkQuery(df, doc, this);
			if (query != null) {
				const getQueryFn = typeof query === "function" ? query : () => query;
				const ctrl = dialog.fields_dict[df.fieldname];
				if (ctrl) {
					ctrl.get_query = getQueryFn;
					ctrl.df = { ...ctrl.df, get_query: getQueryFn };
				}
			}
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
				this.events.afterSave(df, doc.name, newValue, this);
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

	// ─── Table fieldtype editing ─────────────────────────────────────────────

	/**
	 * Entry point for Table field clicks.
	 * Ensures child DocType meta is loaded, fetches existing rows if not cached,
	 * then either opens the single-row dialog directly (table_max_rows === 1)
	 * or the row-listing dialog (multi-row mode).
	 */
	_openTableEditDialog(df, doc, colIndex) {
		const me = this;
		const childDt = df.options;
		if (!childDt) return;

		frappe.model.with_doctype(childDt, async () => {
			const childMeta = frappe.get_meta(childDt);
			let rows;
			if (Array.isArray(doc[df.fieldname])) {
				rows = JSON.parse(JSON.stringify(doc[df.fieldname]));
			} else {
				try {
					const fullDoc = await frappe.db.get_doc(me.doctype, doc.name);
					rows = fullDoc[df.fieldname] || [];
					doc[df.fieldname] = rows;
				} catch (_) {
					rows = [];
				}
			}

			// Allow vdr_events to intercept with a custom dialog.
			if (typeof me.events.openTableDialog === "function") {
				const handled = me.events.openTableDialog(df, doc, rows, async (newRows) => {
					doc[df.fieldname] = newRows;
					await me._saveTableValue(df, doc, newRows, colIndex);
				});
				if (handled) return;
			}

			// Single-row mode: skip the listing dialog and open the row editor directly.
			// The row is re-used on every click — existing data pre-fills; saving replaces it.
			if (me.table_max_rows === 1) {
				const rowData = rows[0] ? { ...rows[0] } : {};
				me._openChildRowDialog(df, doc, childMeta, rowData, rows[0] ? 0 : null, async (saved) => {
					const newRows = [saved];
					doc[df.fieldname] = newRows; // keep cache fresh
					await me._saveTableValue(df, doc, newRows, colIndex);
				});
				return;
			}

			me._showTableDialog(df, doc, colIndex, childMeta, rows);
		});
	},

	/**
	 * Build and show the row-listing dialog for a Table field.
	 * Allows adding, editing, and deleting rows before saving.
	 */
	_showTableDialog(df, doc, colIndex, childMeta, rows) {
		const me = this;

		const SYSTEM = new Set([
			"name",
			"doctype",
			"parent",
			"parentfield",
			"parenttype",
			"idx",
			"docstatus",
			"creation",
			"modified",
			"modified_by",
			"owner",
			"__islocal",
			"__unsaved",
		]);

		const buildSummary = (row, i) => {
			const parts = Object.entries(row)
				.filter(([k, v]) => !SYSTEM.has(k) && v !== null && v !== undefined && v !== "")
				.slice(0, 3)
				.map(([k, v]) => {
					const fdf = (childMeta.fields || []).find((f) => f.fieldname === k);
					const label = fdf ? __(fdf.label || k) : k;
					return `<b>${label}:</b> ${String(v).slice(0, 40)}`;
				});
			return parts.join(" &nbsp;|&nbsp; ") || `${__("Row")} ${i + 1}`;
		};

		const buildListHTML = (r) => {
			if (!r.length) {
				return `<p style="color:var(--text-muted,#888);font-size:12px;margin:4px 0;">${__(
					"No rows yet. Click Add Row to begin."
				)}</p>`;
			}
			return r
				.map(
					(row, i) => `
				<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:3px;
					background:var(--control-bg,#f8f9fa);border:1px solid var(--border-color,#d1d8dd);border-radius:4px;">
					<span style="flex:1;font-size:12px;">${buildSummary(row, i)}</span>
					<button class="btn btn-xs btn-secondary sva-tr-edit" data-idx="${i}" style="padding:1px 8px;">${__(
						"Edit"
					)}</button>
					<button class="btn btn-xs btn-danger sva-tr-del" data-idx="${i}" style="padding:1px 8px;">${__(
						"Delete"
					)}</button>
				</div>`
				)
				.join("");
		};

		const atMax = () => me.table_max_rows && rows.length >= me.table_max_rows;

		const dialogFields = [
			{
				fieldname: "row_list",
				fieldtype: "HTML",
				options: `<div class="sva-tr-list" style="max-height:320px;overflow-y:auto;padding:2px 0;">${buildListHTML(
					rows
				)}</div>`,
			},
		];
		if (!atMax()) {
			dialogFields.push({
				fieldname: "add_row_btn",
				fieldtype: "HTML",
				options: `<button class="btn btn-xs btn-primary sva-tr-add" style="margin-top:6px;">+ ${__(
					"Add Row"
				)}</button>`,
			});
		}

		const dialog = new frappe.ui.Dialog({
			title: __(df.label || df.fieldname),
			fields: dialogFields,
			primary_action_label: __("Save"),
			primary_action: async () => {
				dialog.hide();
				await me._saveTableValue(df, doc, rows, colIndex);
			},
		});

		dialog.show();

		const refreshList = () => {
			const listEl = dialog.$wrapper[0].querySelector(".sva-tr-list");
			if (listEl) listEl.innerHTML = buildListHTML(rows);
			wireButtons();
		};

		const wireButtons = () => {
			const w = dialog.$wrapper[0];

			const addBtn = w.querySelector(".sva-tr-add");
			if (addBtn) {
				addBtn.style.display = atMax() ? "none" : "";
				addBtn.onclick = () =>
					me._openChildRowDialog(df, doc, childMeta, {}, null, (newRow) => {
						rows.push(newRow);
						refreshList();
					});
			}

			w.querySelectorAll(".sva-tr-edit").forEach((btn) => {
				btn.onclick = () => {
					const idx = parseInt(btn.dataset.idx);
					me._openChildRowDialog(df, doc, childMeta, { ...rows[idx] }, idx, (updated) => {
						rows[idx] = updated;
						refreshList();
					});
				};
			});

			w.querySelectorAll(".sva-tr-del").forEach((btn) => {
				btn.onclick = () => {
					rows.splice(parseInt(btn.dataset.idx), 1);
					refreshList();
				};
			});
		};

		wireButtons();
	},

	/**
	 * Open a sub-dialog for adding or editing a single child row.
	 * Includes full Geolocation field support (map picker, draw tools, etc.).
	 *
	 * Supports two optional vdr_events hooks for field filtering:
	 *   getTableFields(tableDf, parentDoc, vdrInstance) → string[] | null
	 *     Return an allowlist of fieldnames to show; null = show all.
	 *   filterTableField(tableDf, childFieldDf, parentDoc, vdrInstance) → boolean
	 *     Called per-field; return false to hide that field.
	 * Both hooks support async. filterTableField runs after getTableFields.
	 *
	 * @param {Object}      tableDf   — Table field descriptor from parent meta
	 * @param {Object}      parentDoc — parent VDR document row
	 * @param {Object}      childMeta — meta of the child DocType
	 * @param {Object}      rowData   — existing row values (empty {} for new row)
	 * @param {number|null} rowIdx    — null = new row; number = edit existing
	 * @param {Function}    onSave    — called with merged row data on confirm
	 */
	async _openChildRowDialog(tableDf, parentDoc, childMeta, rowData, rowIdx, onSave) {
		const me = this;
		const SKIP_TYPES = new Set([
			"Column Break",
			"Section Break",
			"Tab Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Barcode",
		]);
		let fields = (childMeta.fields || [])
			.filter((df) => !SKIP_TYPES.has(df.fieldtype) && !df.hidden)
			.map((df) => ({ ...df, reqd: 0 }));

		// getTableFields: allowlist approach — return fieldname[] or null (show all)
		if (typeof me.events.getTableFields === "function") {
			const allowed = await Promise.resolve(me.events.getTableFields(tableDf, parentDoc, me));
			if (Array.isArray(allowed) && allowed.length) {
				const allowedSet = new Set(allowed);
				fields = fields.filter((f) => allowedSet.has(f.fieldname));
			}
		}

		// filterTableField: per-field conditional — return false to hide a field
		if (typeof me.events.filterTableField === "function") {
			const results = await Promise.all(
				fields.map((f) => Promise.resolve(me.events.filterTableField(tableDf, f, parentDoc, me)))
			);
			fields = fields.filter((_, i) => results[i] !== false);
		}

		if (!fields.length) return;

		const subDialog = new frappe.ui.Dialog({
			title: rowIdx === null ? __("Add Row") : __("Edit Row"),
			fields,
			primary_action_label: rowIdx === null ? __("Add") : __("Update"),
			primary_action(values) {
				subDialog.hide();
				onSave({ ...rowData, ...values });
			},
		});

		// Apply the same Geolocation patches used in openEditDialog
		fields.forEach((df) => {
			if (df.fieldtype !== "Geolocation") return;
			const geoCtrl = subDialog.fields_dict[df.fieldname];
			if (!geoCtrl) return;

			geoCtrl.doctype = me.doctype;
			geoCtrl.doc = rowData;
			geoCtrl.bind_leaflet_draw_control = function () {
				if (this.df.read_only) return;
				this.draw_control = this.get_leaflet_controls();
				this.map.addControl(this.draw_control);
			};
			const existingValue = rowData[df.fieldname];
			let mapReady = false;
			const protoMakeMap = Object.getPrototypeOf(geoCtrl).make_map;
			geoCtrl.make_map = (v) => {
				if (mapReady) return;
				mapReady = true;
				protoMakeMap.call(geoCtrl, v !== undefined ? v : existingValue);
				// Delay so Bootstrap animation finishes and container has real dimensions
				setTimeout(() => {
					if (!geoCtrl.map) return;
					geoCtrl.map.invalidateSize();
					const layers = geoCtrl.editableLayers?.getLayers() || [];
					if (layers.length) {
						try {
							geoCtrl.map.fitBounds(geoCtrl.editableLayers.getBounds(), {
								padding: [50, 50],
							});
						} catch (_e) {
							console.warn("Could not fit map bounds:", _e);
						}
					} else {
						geoCtrl.map.once("locationfound", (e) => {
							geoCtrl.map.setView(e.latlng, 19);
						});
						geoCtrl.map.locate({ enableHighAccuracy: true });
					}
				}, 350);
			};
			subDialog.$wrapper.one("hidden.bs.modal", () => subDialog.$wrapper.remove());
		});

		// Populate existing values
		fields.forEach((df) => {
			if (rowData[df.fieldname] !== undefined) {
				try {
					subDialog.set_value(df.fieldname, rowData[df.fieldname]);
				} catch (_e) {
					console.warn("Could not set field value:", _e);
				}
			}
		});

		subDialog.show();
	},

	/**
	 * Fetch the full parent doc, replace the child table field, save, and
	 * refresh the VDR cell.
	 */
	async _saveTableValue(df, doc, rows, colIndex) {
		const me = this;
		const childDt = df.options;

		const processedRows = rows.map((row, i) => ({
			doctype: childDt,
			idx: i + 1,
			...row,
		}));

		try {
			const fullDoc = await frappe.db.get_doc(me.doctype, doc.name);
			fullDoc[df.fieldname] = processedRows;
			const saved = await frappe.xcall("frappe.client.save", { doc: fullDoc });

			doc[df.fieldname] = saved[df.fieldname] || processedRows;

			const cell = me._table?.querySelector(
				`td.sva-vdr-value-cell[data-fieldname="${CSS.escape(
					df.fieldname
				)}"][data-docname="${CSS.escape(doc.name)}"]`
			);
			if (cell) {
				cell.dataset.rawValue = String(rows.length);
				cell.innerHTML = me.formatCellValue(doc[df.fieldname], df, doc, colIndex);
				me.attachEditListener(cell, df, doc, colIndex);
			}

			if (typeof me.clearErrorBanner === "function") me.clearErrorBanner();
			frappe.show_alert({ message: __("Saved"), indicator: "green" });

			if (typeof me.events.afterSave === "function") {
				me.events.afterSave(df, doc.name, doc[df.fieldname], me);
			}
		} catch (err) {
			const errMsg = (err && (err.message || err.exc_type)) || __("Could not save");
			if (typeof me.showErrorBanner === "function") {
				me.showErrorBanner([`${__(df.label || df.fieldname)}: ${errMsg}`]);
			} else {
				frappe.msgprint({ title: __("Save failed"), message: errMsg, indicator: "red" });
			}
		}
	},
};

export default EditMixin;
