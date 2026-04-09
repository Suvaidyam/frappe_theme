const TransposeMixin = {
	transposeTable() {
		if (!this.table) return;

		// Handle no data case - create empty transposed structure
		if (this.rows.length === 0) {
			this.table.innerHTML = "";
			const thead = this.table.createTHead();
			const tbody = this.table.createTBody();

			const actionRow = thead.insertRow();

			const settingsTh = document.createElement("th");
			settingsTh.style.cssText =
				"width:150px; text-align:left;position:sticky;left:0px;z-index:1;background-color:#F3F3F3;border-right:1px solid #dee2e6;";
			settingsTh.appendChild(this.createSettingsButton());
			actionRow.appendChild(settingsTh);

			const messageTh = document.createElement("th");
			messageTh.style.backgroundColor = "#F3F3F3";
			messageTh.style.textAlign = "center";
			messageTh.style.width = "400px";
			actionRow.appendChild(messageTh);

			this.columns.forEach((column, index) => {
				const row = tbody.insertRow();
				row.style.maxHeight = "32px";
				row.style.height = "32px";
				row.style.backgroundColor = "#fff";

				const labelCell = row.insertCell();
				labelCell.textContent = column.label || column.fieldname;
				labelCell.style.cssText =
					"height:32px;padding:0px 5px;font-weight:normal;width:150px;min-width:150px;position:sticky;left:0px;z-index:1;background-color:#f8f9fa;border-right:1px solid #dee2e6;";

				if (index === 0) {
					const valueCell = row.insertCell();
					valueCell.innerHTML = `
						<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px 0;">
							<svg class="icon icon-lg" style="stroke: var(--text-light);margin-bottom:15px;">
								<use href="#icon-small-file"></use>
							</svg>
							<p style="margin:0;font-size:14px;">You haven't created a record yet</p>
						</div>
					`;
					valueCell.rowSpan = this.columns.length;
					valueCell.style.cssText = `padding:0px;width:100%;vertical-align:middle;text-align:center;height:${
						this.columns.length * 32 + 30
					}px;line-height:32px;`;
				}
			});

			return;
		}

		// Remove stale action dropdown menus from document.body before rebuilding
		const _dtTableKey = `${this?.doctype || this?.link_report || "unknown"}-${
			this?.connection?.html_field || "unknown"
		}`;
		document.querySelectorAll(".sva-dt-action-dropdown").forEach((menu) => {
			if (menu.dataset.dtTableKey === _dtTableKey) {
				menu.remove();
			}
		});

		// Clear and rebuild entirely from this.rows + this.columns (not from DOM)
		this.table.innerHTML = "";
		const thead = this.table.createTHead();
		const tbody = this.table.createTBody();

		// ── Action row: settings button + one live action dropdown per record ──
		const actionRow = thead.insertRow();

		const settingsTh = document.createElement("th");
		settingsTh.style.position = "sticky";
		settingsTh.style.left = "0px";
		settingsTh.style.zIndex = "3";
		settingsTh.style.backgroundColor = "#F3F3F3";
		settingsTh.style.textAlign = "left";
		settingsTh.style.borderRight = "1px solid #dee2e6";
		settingsTh.appendChild(this.createSettingsButton());
		actionRow.appendChild(settingsTh);

		const hasActionPerms =
			(this.conf_perms.length &&
				(this.conf_perms.includes("read") ||
					this.conf_perms.includes("delete") ||
					this.conf_perms.includes("write"))) ||
			this.childLinks?.length;

		this.rows.forEach((rowData) => {
			const th = document.createElement("th");
			th.style.backgroundColor = "rgb(248, 249, 250)";
			th.style.minWidth = "50px";
			th.style.position = "relative";

			if (this.connection.connection_type === "Report") {
				th.style.display = "none";
			} else if (hasActionPerms) {
				const primaryKey = rowData?.name || rowData?.rowIndex;
				const actionCol = this.createActionColumn(rowData, primaryKey);
				actionCol.style.position = "absolute";
				actionCol.style.right = "4px";
				actionCol.style.top = "50%";
				actionCol.style.transform = "translateY(-50%)";
				th.appendChild(actionCol);
			}

			actionRow.appendChild(th);
		});

		// ── Serial Number row (if enabled) ──
		if (this.options?.serialNumberColumn) {
			const snRow = tbody.insertRow();
			snRow.style.backgroundColor = "#fff";
			snRow.style.maxHeight = "32px";
			snRow.style.height = "32px";

			const snLabelCell = snRow.insertCell();
			snLabelCell.textContent = __("S.No.");
			snLabelCell.style.cssText =
				"height:32px;padding:0px 5px;font-weight:500;width:150px;min-width:150px;position:sticky;left:0px;z-index:1;background-color:#f8f9fa;border-right:1px solid #dee2e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

			this.rows.forEach((_rowData, rowIndex) => {
				const snCell = snRow.insertCell();
				const serialNumber =
					this.page > 1 ? (this.page - 1) * this.limit + (rowIndex + 1) : rowIndex + 1;
				snCell.style.cssText =
					"height:32px;padding:0px 5px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
				this._fillTransposeSnCell(snCell, _rowData, serialNumber);
			});
		}

		// ── Data rows: one row per field, one cell per record ──
		// Built directly from this.rows data — never reads DOM cells,
		// so async field renders (Link titles etc.) can't cause empty cells.
		this.columns.forEach((column, columnIndex) => {
			const col = this.header?.find((h) => h.fieldname === column.fieldname) || null;
			const isWrapped = !!col?.wrap;
			const colWidth = col?.width ? `${Number(col.width) * 50}px` : null;

			const row = tbody.insertRow();
			row.style.backgroundColor = "#fff";
			if (isWrapped) {
				row.style.height = "auto";
			} else {
				row.style.maxHeight = "32px";
				row.style.height = "32px";
			}

			// Sticky label cell (first column = field name)
			const labelCell = row.insertCell();
			labelCell.textContent = column.label || column.fieldname;
			labelCell.style.position = "sticky";
			labelCell.style.left = "0px";
			labelCell.style.zIndex = "2";
			labelCell.style.backgroundColor = "#f8f9fa";
			labelCell.style.fontWeight = "500";
			labelCell.style.borderRight = "1px solid #dee2e6";
			labelCell.style.padding = "0px 5px";
			labelCell.style.textAlign = "left";
			if (isWrapped) {
				labelCell.style.height = "auto";
				labelCell.style.minHeight = "32px";
				labelCell.style.whiteSpace = "normal";
			} else {
				labelCell.style.height = "32px";
				labelCell.style.whiteSpace = "nowrap";
				labelCell.style.overflow = "hidden";
				labelCell.style.textOverflow = "ellipsis";
			}
			if (colWidth) {
				labelCell.style.width = colWidth;
				labelCell.style.minWidth = colWidth;
				labelCell.style.maxWidth = colWidth;
			}

			// One data cell per record — populated via createNonEditableField
			// so formatting (Link titles, Currency, Date, etc.) is correct
			this.rows.forEach((rowData) => {
				const cell = row.insertCell();
				cell.style.padding = "0px 5px";
				cell.style.textAlign = "left";

				if (isWrapped) {
					cell.style.whiteSpace = "normal";
					cell.style.wordBreak = "break-word";
					cell.style.overflowWrap = "break-word";
					cell.style.overflow = "visible";
					cell.style.textOverflow = "unset";
					cell.style.height = "auto";
					cell.style.minHeight = "32px";
				} else {
					cell.style.height = "32px";
					cell.style.whiteSpace = "nowrap";
					cell.style.overflow = "hidden";
					cell.style.textOverflow = "ellipsis";
				}

				if (colWidth) {
					cell.style.width = colWidth;
					cell.style.minWidth = colWidth;
					cell.style.maxWidth = colWidth;
				}
				if (col?.color) cell.style.color = col.color;
				if (col?.bg_color) cell.style.backgroundColor = col.bg_color;

				// Set raw value first, then let the field formatter override it
				cell.textContent = rowData[column.fieldname] ?? "";
				this.createNonEditableField(cell, column, rowData, columnIndex);
			});
		});

		// ── Workflow row: one row for the approval select, one cell per record ──
		if (
			this.workflow &&
			(this.wf_editable_allowed || this.wf_transitions_allowed) &&
			!this.connection?.disable_workflow &&
			this.connection?.connection_type !== "Report"
		) {
			const wfRow = tbody.insertRow();
			wfRow.style.backgroundColor = "#fff";
			wfRow.style.maxHeight = "32px";
			wfRow.style.height = "32px";
			wfRow.dataset.wfRow = "1";

			const wfLabelCell = wfRow.insertCell();
			wfLabelCell.textContent = this.connection?.action_label || __("Approval");
			wfLabelCell.style.cssText =
				"height:32px;padding:0px 5px;font-weight:500;width:150px;min-width:150px;position:sticky;left:0px;z-index:1;background-color:#f8f9fa;border-right:1px solid #dee2e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

			this.rows.forEach((rowData) => {
				const cell = wfRow.insertCell();
				cell.style.cssText = "height:32px;padding:2px 5px;text-align:center;";
				this._createTransposeWorkflowCell(cell, rowData);
			});
		}
	},

	// Rebuild the action row (thead tr) with fresh dropdowns for all current this.rows.
	// Called after expand or shrink so every three-dot button has a live dropdownMenu.
	_refreshActionRow() {
		const actionRow = this.table?.querySelector("thead tr");
		if (!actionRow) return;

		const _dtTableKey = `${this?.doctype || this?.link_report || "unknown"}-${
			this?.connection?.html_field || "unknown"
		}`;

		// Remove all stale dropdown menus for this table from document.body
		document.querySelectorAll(".sva-dt-action-dropdown").forEach((menu) => {
			if (menu.dataset.dtTableKey === _dtTableKey) menu.remove();
		});

		// Remove all record ths (keep settings th at index 0)
		while (actionRow.children.length > 1) {
			actionRow.removeChild(actionRow.lastElementChild);
		}

		const hasActionPerms =
			(this.conf_perms.length &&
				(this.conf_perms.includes("read") ||
					this.conf_perms.includes("delete") ||
					this.conf_perms.includes("write"))) ||
			this.childLinks?.length;

		// Add fresh action th per record for all current rows
		this.rows.forEach((rowData) => {
			const th = document.createElement("th");
			th.style.backgroundColor = "rgb(248, 249, 250)";
			th.style.minWidth = "50px";
			th.style.position = "relative";

			if (this.connection.connection_type === "Report") {
				th.style.display = "none";
			} else if (hasActionPerms) {
				const primaryKey = rowData?.name || rowData?.rowIndex;
				const actionCol = this.createActionColumn(rowData, primaryKey);
				actionCol.style.position = "absolute";
				actionCol.style.right = "4px";
				actionCol.style.top = "50%";
				actionCol.style.transform = "translateY(-50%)";
				th.appendChild(actionCol);
			}
			actionRow.appendChild(th);
		});
	},

	// Append new record columns to an existing transposed table (expand: 10→20/50)
	appendTransposeColumns(oldCount) {
		if (!this.table) return;
		const newRows = this.rows.slice(oldCount);
		if (!newRows.length) return;

		// Rebuild action row with fresh dropdowns for all records (old + new).
		// This ensures previously-loaded records' three-dot buttons stay live.
		this._refreshActionRow();

		const tbodyRows = Array.from(this.table.querySelectorAll("tbody tr"));
		let fieldRowOffset = 0;

		// S.No. row (first tbody row when serialNumberColumn is enabled)
		if (this.options?.serialNumberColumn && tbodyRows.length > 0) {
			const snRow = tbodyRows[0];
			newRows.forEach((_rowData, newIdx) => {
				const absoluteIndex = oldCount + newIdx;
				const serialNumber =
					this.page > 1
						? (this.page - 1) * this.limit + (absoluteIndex + 1)
						: absoluteIndex + 1;
				const snCell = snRow.insertCell();
				snCell.style.cssText =
					"height:32px;padding:0px 5px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
				this._fillTransposeSnCell(snCell, _rowData, serialNumber);
			});
			fieldRowOffset = 1;
		}

		// Field rows — append cells only for the new records
		this.columns.forEach((column, columnIndex) => {
			const row = tbodyRows[fieldRowOffset + columnIndex];
			if (!row) return;

			const col = this.header?.find((h) => h.fieldname === column.fieldname) || null;
			const isWrapped = !!col?.wrap;
			const colWidth = col?.width ? `${Number(col.width) * 50}px` : null;

			newRows.forEach((rowData) => {
				const cell = row.insertCell();
				cell.style.padding = "0px 5px";
				cell.style.textAlign = "left";

				if (isWrapped) {
					cell.style.whiteSpace = "normal";
					cell.style.wordBreak = "break-word";
					cell.style.overflowWrap = "break-word";
					cell.style.overflow = "visible";
					cell.style.textOverflow = "unset";
					cell.style.height = "auto";
					cell.style.minHeight = "32px";
				} else {
					cell.style.height = "32px";
					cell.style.whiteSpace = "nowrap";
					cell.style.overflow = "hidden";
					cell.style.textOverflow = "ellipsis";
				}

				if (colWidth) {
					cell.style.width = colWidth;
					cell.style.minWidth = colWidth;
					cell.style.maxWidth = colWidth;
				}
				if (col?.color) cell.style.color = col.color;
				if (col?.bg_color) cell.style.backgroundColor = col.bg_color;

				cell.textContent = rowData[column.fieldname] ?? "";
				this.createNonEditableField(cell, column, rowData, columnIndex);
			});
		});

		// Workflow row — append cells for new records
		if (
			this.workflow &&
			(this.wf_editable_allowed || this.wf_transitions_allowed) &&
			!this.connection?.disable_workflow &&
			this.connection?.connection_type !== "Report"
		) {
			const wfRow = this.table?.querySelector("tbody tr[data-wf-row='1']");
			if (wfRow) {
				newRows.forEach((rowData) => {
					const cell = wfRow.insertCell();
					cell.style.cssText = "height:32px;padding:2px 5px;text-align:center;";
					this._createTransposeWorkflowCell(cell, rowData);
				});
			}
		}
	},

	// Remove excess record columns from the transposed table (shrink: 20→10)
	trimTransposeColumns(newCount) {
		if (!this.table) return;

		// Trim each tbody row: keep label td (index 0) + newCount record tds
		Array.from(this.table.querySelectorAll("tbody tr")).forEach((row) => {
			while (row.children.length > newCount + 1) {
				row.removeChild(row.lastElementChild);
			}
		});

		// Rebuild action row with fresh dropdowns only for the remaining records.
		// Must happen AFTER this.rows is already sliced to newCount in the caller.
		this._refreshActionRow();
	},

	// In-place data refresh for transpose pagination — no full rebuild, no fade.
	// Reuses existing cells, updates their content, adds/removes columns as needed.
	_refreshTransposeData() {
		if (!this.table) return;
		const tbody = this.table.querySelector("tbody");
		// No existing transposed tbody → fall back to full rebuild
		if (!tbody || !tbody.querySelector("tr")) {
			this.transposeTable();
			return;
		}

		const newCount = this.rows.length;

		// 1. Refresh action-row dropdowns
		this._refreshActionRow();

		const tbodyRows = Array.from(tbody.querySelectorAll("tr"));
		let fieldRowOffset = 0;

		// 2. S.No. row
		if (this.options?.serialNumberColumn && tbodyRows.length > 0) {
			const snRow = tbodyRows[0];
			this._updateTransposeRowCells(snRow, newCount, (cell, rowData, idx) => {
				cell.style.cssText =
					"height:32px;padding:0px 5px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
				const serialNumber =
					this.page > 1 ? (this.page - 1) * this.limit + (idx + 1) : idx + 1;
				this._fillTransposeSnCell(cell, rowData, serialNumber);
			});
			fieldRowOffset = 1;
		}

		// 3. Data rows (one per field)
		this.columns.forEach((column, columnIndex) => {
			const row = tbodyRows[fieldRowOffset + columnIndex];
			if (!row) return;

			const col = this.header?.find((h) => h.fieldname === column.fieldname) || null;
			const isWrapped = !!col?.wrap;
			const colWidth = col?.width ? `${Number(col.width) * 50}px` : null;

			this._updateTransposeRowCells(row, newCount, (cell, rowData) => {
				cell.style.padding = "0px 5px";
				cell.style.textAlign = "left";
				if (isWrapped) {
					cell.style.whiteSpace = "normal";
					cell.style.wordBreak = "break-word";
					cell.style.overflowWrap = "break-word";
					cell.style.overflow = "visible";
					cell.style.textOverflow = "unset";
					cell.style.height = "auto";
					cell.style.minHeight = "32px";
				} else {
					cell.style.height = "32px";
					cell.style.whiteSpace = "nowrap";
					cell.style.overflow = "hidden";
					cell.style.textOverflow = "ellipsis";
				}
				if (colWidth) {
					cell.style.width = colWidth;
					cell.style.minWidth = colWidth;
					cell.style.maxWidth = colWidth;
				}
				if (col?.color) cell.style.color = col.color;
				if (col?.bg_color) cell.style.backgroundColor = col.bg_color;
				cell.textContent = rowData[column.fieldname] ?? "";
				this.createNonEditableField(cell, column, rowData, columnIndex);
			});
		});

		// 4. Workflow row
		if (
			this.workflow &&
			(this.wf_editable_allowed || this.wf_transitions_allowed) &&
			!this.connection?.disable_workflow &&
			this.connection?.connection_type !== "Report"
		) {
			const wfRow = tbody.querySelector("tr[data-wf-row='1']");
			if (wfRow) {
				this._updateTransposeRowCells(wfRow, newCount, (cell, rowData) => {
					cell.style.cssText = "height:32px;padding:2px 5px;text-align:center;";
					this._createTransposeWorkflowCell(cell, rowData);
				});
			}
		}
	},

	// Reuse / add / remove data cells in a transposed row in-place.
	// children[0] is the sticky label — skipped.
	// callback(cell, rowData, idx) populates each data cell.
	_updateTransposeRowCells(row, newCount, callback) {
		const existingDataCells = Array.from(row.children).slice(1);

		this.rows.forEach((rowData, idx) => {
			let cell;
			if (idx < existingDataCells.length) {
				cell = existingDataCells[idx];
				cell.textContent = ""; // clear before re-populating
			} else {
				cell = row.insertCell();
			}
			callback(cell, rowData, idx);
		});

		// Remove surplus cells when this page has fewer records than the last
		while (row.children.length > newCount + 1) {
			row.removeChild(row.lastElementChild);
		}
	},

	// Fills a transpose S.No. cell with a clickable link (or plain text for Reports),
	// mirroring the non-transpose serial-number column behaviour in rendering.js.
	_fillTransposeSnCell(cell, rowData, serialNumber) {
		if (this.frm?.dt_events?.[this.doctype ?? this.link_report]?.formatter?.["#"]) {
			const formatter = this.frm.dt_events[this.doctype ?? this.link_report].formatter["#"];
			cell.innerHTML = formatter(serialNumber, rowData, this);
		} else if (!this.hasNavigableColumn && this.connection?.connection_type !== "Report") {
			const doctype = this.doctype;
			const href = `/app/${encodeURIComponent(
				frappe.router.slug(doctype)
			)}/${encodeURIComponent(rowData.name)}`;
			const linkColor = frappe.boot?.my_theme?.navbar_color || "var(--primary-color)";
			const a = document.createElement("a");
			a.href = href;
			a.dataset.doctype = doctype;
			a.dataset.name = rowData.name;
			a.style.cursor = "pointer";
			a.style.textDecoration = "underline";
			a.style.color = linkColor;
			a.textContent = serialNumber;
			cell.appendChild(a);
		} else {
			const p = document.createElement("p");
			p.dataset.docname = rowData.name;
			p.textContent = serialNumber;
			cell.appendChild(p);
		}
	},

	// Creates a workflow approval select element inside `cell` for the given row data.
	// Mirrors the async workflow column logic from rendering.js createTableRow().
	_createTransposeWorkflowCell(cell, rowData) {
		const primaryKey = rowData?.name || rowData?.rowIndex;
		const workflow_state_field = this.workflow?.workflow_state_field;
		const stateLabel =
			this.workflow_state_map?.[rowData[workflow_state_field]] ||
			rowData[workflow_state_field] ||
			"";
		const bg = this.workflow_state_bg?.find(
			(bg) => bg.name === rowData[workflow_state_field] && bg?.style
		);
		const closureStates = this.workflow?.states
			?.filter((s) => ["Positive", "Negative"].includes(s.custom_closure))
			.map((e) => e.state);
		const isClosed = closureStates.includes(rowData[workflow_state_field]);

		const el = document.createElement("select");
		el.classList.add("form-select", "rounded");
		el.style.width = "100px";
		el.style.maxWidth = "100px";
		el.style.padding = "2px 5px";
		el.classList.add(
			bg ? `bg-${bg.style.toLowerCase()}` : "pl-[20px]",
			...(bg ? ["text-white"] : [])
		);

		// Render the select with current state immediately so the cell is never empty.
		// Transitions (action options) are loaded async below and appended afterwards.
		el.setAttribute("title", __(stateLabel));
		el.innerHTML = `<option value="" style="color:black" selected disabled class="ellipsis">${__(
			stateLabel
		)}</option>`;
		el.disabled = true;

		// Append to DOM immediately — this guarantees visibility regardless of async outcome.
		cell.appendChild(el);

		if (isClosed) {
			el.classList.add("ellipsis");
			el.style["-webkit-appearance"] = "none";
			el.style["-moz-appearance"] = "none";
			el.style["appearance"] = "none";
			el.style["background-color"] = "transparent";
			el.style["text-align"] = "center";
			return;
		}

		// Await the single table-level prefetch promise (populated by createTableBody via
		// get_workflow_transitions_for_table), then do a sync lookup — no per-row API call.
		(async () => {
			try {
				await (this._wfTransitionsReady || Promise.resolve());

				const transitions = this._wfTransitionsByDocname?.[rowData.name] ?? [];

				let initialDisabled =
					(this.connection?.keep_workflow_enabled_form_submission
						? false
						: this.frm?.doc?.docstatus !== 0) ||
					closureStates.includes(rowData[workflow_state_field]) ||
					!this.workflow?.transitions?.some(
						(tr) =>
							frappe.user_roles.includes(tr.allowed) &&
							tr.state === rowData[workflow_state_field]
					);

				const disableByDependsOn = this.connection?.disable_workflow_depends_on
					? frappe.utils.custom_eval(
							this.connection?.disable_workflow_depends_on,
							rowData
					  )
					: false;

				el.disabled = initialDisabled || !transitions?.length || disableByDependsOn;

				// Append transition action options
				el.innerHTML =
					`<option value="" style="color:black" selected disabled class="ellipsis">${__(
						stateLabel
					)}</option>` +
					[...new Set(transitions?.map((e) => e.action))]
						?.map(
							(action) =>
								`<option value="${action}" style="background-color:white; color:black; cursor:pointer;" class="rounded p-1">${__(
									action
								)}</option>`
						)
						.join("");

				el.addEventListener("focus", () => {
					const originalState = el?.getAttribute("title");
					el.value = "";
					el.title = originalState;
				});

				el.addEventListener("change", async (event) => {
					const action = event.target.value;
					const link =
						transitions.find((l) => l.action === action) ||
						this.workflow.transitions.find(
							(l) =>
								l.state == rowData[workflow_state_field] &&
								l.action === action &&
								frappe.user_roles.includes(l.allowed)
						);
					const originalState = el?.getAttribute("title");
					if (link) {
						if (window.onWorkflowStateChange) {
							await window.onWorkflowStateChange(
								this,
								link,
								primaryKey,
								el,
								originalState
							);
						} else {
							try {
								await this.wf_action(link, primaryKey, el, originalState, rowData);
							} catch (error) {
								el.value = "";
								el.title = __(originalState);
							}
						}
						el.value = "";
						el.title = __(originalState);
					}
				});
			} catch (_e) {
				// Leave the select as-is (disabled with current state label) on error.
				console.error("Error loading workflow transitions for row", rowData, _e);
			}
		})();
	},
};

export default TransposeMixin;
