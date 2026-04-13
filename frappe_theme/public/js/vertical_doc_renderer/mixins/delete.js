/**
 * DeleteMixin — trash-icon row for removing document columns
 *
 * Activated by including "delete" in crud_permissions AND the current user
 * having frappe.model.can_delete(doctype) permission.
 *
 * A <tr class="sva-vdr-delete-row"> is inserted as the first row of <tbody>.
 * Each doc column gets a 🗑 <button> in that row. The buttons are hidden by
 * default (opacity 0) and revealed when the user hovers the corresponding
 * document <th> in the header.
 *
 * CSS cross-section selectors (thead:hover → tbody td) don't work, so hover
 * is wired via JS mouseenter/mouseleave with a 150ms hide debounce that lets
 * the user move the mouse from the header to the button without it disappearing.
 *
 * Hover identification uses doc.name (not column index) so that remaining
 * columns continue to work correctly after a column is deleted and indices shift.
 *
 * Delete flow:
 *   frappe.confirm → frappe.xcall("frappe.client.delete")
 *     → _removeColumn(docName) (DOM cleanup + data arrays)
 */
const DeleteMixin = {
	/**
	 * Returns true when delete is both in crud_permissions and allowed by RPM.
	 * @returns {boolean}
	 */
	_canDelete() {
		return (
			this.crud_permissions.includes("delete") &&
			frappe.model.can_delete(this.doctype)
		);
	},

	/**
	 * Build the <tr> that holds one 🗑 button per document column.
	 * Stores the row as this._deleteRow so viewport can append to it later.
	 * @returns {HTMLElement} <tr>
	 */
	_buildDeleteRow() {
		const tr = document.createElement("tr");
		tr.className = "sva-vdr-delete-row";
		this._deleteRow = tr;

		// Sticky label-column spacer
		const labelTd = document.createElement("td");
		labelTd.className = "sva-vdr-sticky-col";
		labelTd.style.cssText = `
			position: sticky;
			left: 0;
			z-index: 1;
			background: var(--sva-vdr-label-bg, #dce6f1);
			border: 1px solid rgba(0,0,0,.06);
			min-width: 140px;
			padding: 2px 10px;
		`;
		tr.appendChild(labelTd);

		// Optional Unit column spacer
		if (this.show_unit) {
			const unitTd = document.createElement("td");
			unitTd.style.cssText = `border: 1px solid rgba(0,0,0,.06); padding: 2px 8px;`;
			tr.appendChild(unitTd);
		}

		// One delete button cell per already-rendered doc
		this.data.forEach((doc) => {
			tr.appendChild(this._buildDeleteCell(doc));
		});

		// "+" column spacer (stays at far right; viewport inserts before it)
		if (this.allow_create) {
			const createTd = document.createElement("td");
			createTd.style.cssText = `border: 1px solid rgba(0,0,0,.06); padding: 2px 6px;`;
			tr.appendChild(createTd);
		}

		return tr;
	},

	/**
	 * Build a single <td> containing the 🗑 button for one document column.
	 * Uses doc.name as the identifier so hover/delete work correctly even
	 * after other columns are deleted and indices shift.
	 *
	 * @param {object} doc — document data object (must have .name)
	 * @returns {HTMLElement} <td>
	 */
	_buildDeleteCell(doc) {
		const td = document.createElement("td");
		td.className = "sva-vdr-delete-cell";
		td.dataset.docname = doc.name;
		td.style.cssText = `
			text-align: center;
			padding: 2px 6px;
			border: 1px solid rgba(0,0,0,.06);
			vertical-align: middle;
		`;

		const btn = document.createElement("button");
		btn.className = "btn btn-xs btn-danger sva-vdr-delete-btn";
		btn.textContent = "\uD83D\uDDD1"; // 🗑
		btn.title = __("Delete {0}", [doc.name]);
		btn.style.cssText = `
			opacity: 0;
			pointer-events: none;
			transition: opacity .15s;
			padding: 1px 6px;
			line-height: 1.4;
			cursor: pointer;
			font-size: 12px;
		`;

		btn.addEventListener("mouseenter", () => {
			// Cancel any pending hide when mouse moves onto the button
			clearTimeout(this._deleteHideTimer);
		});
		btn.addEventListener("mouseleave", () => {
			this._hideDeleteIcon(doc.name);
		});
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.deleteDoc(doc.name);
		});

		td.appendChild(btn);
		return td;
	},

	/**
	 * Append a delete cell for a newly viewport-loaded document column.
	 * Called by viewport.js after _appendDocColumn().
	 * @param {object} doc — document data object
	 */
	_appendDeleteCell(doc) {
		if (!this._deleteRow) return;

		const newCell = this._buildDeleteCell(doc);

		// Insert before the "+" spacer td (last child) if create is enabled
		if (this.allow_create) {
			const last = this._deleteRow.lastElementChild;
			this._deleteRow.insertBefore(newCell, last);
		} else {
			this._deleteRow.appendChild(newCell);
		}
	},

	/**
	 * Show the 🗑 button for the column identified by docName.
	 * Cancels any pending hide timer.
	 * @param {string} docName
	 */
	_showDeleteIcon(docName) {
		clearTimeout(this._deleteHideTimer);
		const btn = this._getDeleteBtnByDocName(docName);
		if (btn) {
			btn.style.opacity = "1";
			btn.style.pointerEvents = "auto";
		}
	},

	/**
	 * Hide the 🗑 button for the column identified by docName after 150ms.
	 * The debounce lets the user move the mouse from the header to the button.
	 * @param {string} docName
	 */
	_hideDeleteIcon(docName) {
		clearTimeout(this._deleteHideTimer);
		this._deleteHideTimer = setTimeout(() => {
			const btn = this._getDeleteBtnByDocName(docName);
			if (btn) {
				btn.style.opacity = "0";
				btn.style.pointerEvents = "none";
			}
		}, 150);
	},

	/**
	 * Locate the 🗑 button in the delete row for a given document name.
	 * @param {string} docName
	 * @returns {HTMLElement|null}
	 */
	_getDeleteBtnByDocName(docName) {
		if (!this._deleteRow) return null;
		const td = this._deleteRow.querySelector(`td[data-docname="${docName}"]`);
		return td ? td.querySelector(".sva-vdr-delete-btn") : null;
	},

	/**
	 * Show a confirm dialog, then delete the document via frappe.xcall and
	 * remove its column from the DOM.
	 * @param {string} docName
	 */
	deleteDoc(docName) {
		frappe.confirm(
			__("Are you sure you want to delete <b>{0}</b>?", [docName]),
			async () => {
				try {
					await frappe.xcall("frappe.client.delete", {
						doctype: this.doctype,
						name: docName,
					});
					this._removeColumn(docName);
					frappe.show_alert({
						message: __("{0} deleted successfully", [docName]),
						indicator: "green",
					});
				} catch (e) {
					const msg = (e && (e.message || e.exc_type)) || String(e);
					frappe.msgprint({
						title: __("Delete failed"),
						message: msg,
						indicator: "red",
					});
				}
			}
		);
	},

	/**
	 * Remove a document's column from the DOM and sync all data arrays.
	 * All lookups are by docName so indices don't need to be maintained.
	 * @param {string} docName — document name to remove
	 */
	_removeColumn(docName) {
		if (!this._table) return;

		// 1. Header <th>
		const headerTh = this._theadRow.querySelector(`th[data-docname="${docName}"]`);
		if (headerTh) headerTh.remove();

		// 2. Value cells in every field row
		this._table
			.querySelectorAll(`td.sva-vdr-value-cell[data-docname="${docName}"]`)
			.forEach((td) => td.remove());

		// 3. Delete row cell
		if (this._deleteRow) {
			const deleteTd = this._deleteRow.querySelector(
				`td[data-docname="${docName}"]`
			);
			if (deleteTd) deleteTd.remove();
		}

		// 4. Decrement colSpan on all section-header rows
		this._table
			.querySelectorAll("tr.sva-vdr-section-row td")
			.forEach((td) => {
				if (td.colSpan > 1) td.colSpan -= 1;
			});

		// 5. Sync data arrays
		this.data = this.data.filter((d) => d.name !== docName);
		this.docs = this.docs.filter((n) => n !== docName);

		if (Array.isArray(this._all_inputs)) {
			this._all_inputs = this._all_inputs.filter((item) => {
				const name = typeof item === "object" ? item.name : item;
				return name !== docName;
			});
		}

		if (typeof this._rendered_count === "number") {
			this._rendered_count = Math.max(0, this._rendered_count - 1);
		}
	},
};

export default DeleteMixin;
