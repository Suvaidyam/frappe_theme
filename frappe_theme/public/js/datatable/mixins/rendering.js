const RenderingMixin = {
	createTableRow(row, rowIndex) {
		const tr = document.createElement("tr");
		tr.style.backgroundColor = "#fff";
		tr.setAttribute("data-row-index", rowIndex);
		tr.setAttribute("data-docname", row.name);

		const hasWrapColumn = this.header?.some((h) => h.wrap);
		if (!hasWrapColumn) {
			tr.style.maxHeight = "32px";
			tr.style.height = "32px";
		}

		let primaryKey = row?.name || row?.rowIndex || rowIndex?.id || rowIndex;

		// Serial Number Column
		if (this.options.serialNumberColumn) {
			const serialTd = document.createElement("td");
			serialTd.style.minWidth = "48px";
			serialTd.style.width = "48px";
			serialTd.style.maxWidth = "48px";
			serialTd.style.textAlign = "center";
			serialTd.style.position = "sticky";
			serialTd.style.left = "0px";
			serialTd.style.backgroundColor = "#fff";
			serialTd.style.zIndex = "4";
			serialTd.style.boxShadow = "inset -1px 0 0 0 #d1d8dd";
			serialTd.style.setProperty("padding", "0px", "important");

			const serialNumber =
				this.page > 1 ? (this.page - 1) * this.limit + (rowIndex + 1) : rowIndex + 1;
			if (this.frm?.dt_events?.[this.doctype ?? this.link_report]?.formatter?.["#"]) {
				let formatter =
					this.frm.dt_events[this.doctype ?? this.link_report].formatter["#"];
				serialTd.innerHTML = formatter(serialNumber, row, this);
			} else if (!this.hasNavigableColumn && this.connection?.connection_type !== "Report") {
				const doctype = this.doctype;
				const href = `/app/${encodeURIComponent(
					frappe.router.slug(doctype)
				)}/${encodeURIComponent(row.name)}`;
				const linkColor = frappe.boot?.my_theme?.navbar_color || "var(--primary-color)";
				const a = document.createElement("a");
				a.href = href;
				a.dataset.doctype = doctype;
				a.dataset.name = row.name;
				a.style.cursor = "pointer";
				a.style.textDecoration = "underline";
				a.style.color = linkColor;
				a.textContent = serialNumber;
				serialTd.appendChild(a);
			} else {
				const p = document.createElement("p");
				p.dataset.docname = row.name;
				p.textContent = serialNumber;
				serialTd.appendChild(p);
			}
			if (
				this.frm?.dt_events?.[this.doctype || this.link_report]?.columnEvents?.["#"]?.click
			) {
				this.bindColumnEvents(serialTd, serialNumber, { fieldname: "#" }, row);
			}

			tr.appendChild(serialTd);
		}

		// Data Columns
		let left = this.options.serialNumberColumn ? 48 : 0;
		const lastStickyIdx = this.columns.reduce((last, col, idx) => {
			let h = this.header?.find((hh) => hh.fieldname === col.fieldname);
			return h?.sticky ? idx : last;
		}, -1);
		this.columns.forEach((column, columnIndex) => {
			const td = document.createElement("td");
			let col = this.header?.find((h) => h.fieldname === column.fieldname);
			const fieldMeta =
				this.meta?.fields?.find((f) => f.fieldname === column.fieldname) || column;
			const isSticky = !!col?.sticky;
			const isLastSticky = columnIndex === lastStickyIdx;
			td.style = this.getCellStyle(column, isSticky, left, isLastSticky);
			if (isSticky) {
				td.classList.add("sva-dt-sticky-column");
				left += (Number(col?.width) || 2) * 50;
			}

			td.textContent = row[column.fieldname] || "";
			if (this.options.editable && column.fieldtype !== "Select") {
				this.createEditableField(td, column, row);
			} else {
				this.createNonEditableField(td, column, row, columnIndex);
			}
			if (col?.wrap) {
				td.style.whiteSpace = "normal";
				td.style.wordBreak = "break-word";
				td.style.overflowWrap = "break-word";
				td.style.overflow = "visible";
				td.style.textOverflow = "unset";
				td.style.height = "auto";
				td.style.minHeight = "32px";
			}
			if (col?.color && fieldMeta?.fieldtype !== "Percent") td.style.color = col.color;
			if (col?.bg_color) td.style.backgroundColor = col.bg_color;
			tr.appendChild(td);
		});

		// Workflow Column
		if (this.workflow && (this.wf_editable_allowed || this.wf_transitions_allowed)) {
			let workflow_state_field = this.workflow?.workflow_state_field;
			const bg = this.workflow_state_bg?.find(
				(bg) => bg.name === row[workflow_state_field] && bg.style
			);
			const closureStates = this.workflow?.states
				?.filter((s) => ["Positive", "Negative"].includes(s.custom_closure))
				.map((e) => e.state);
			const isClosed = closureStates.includes(row[workflow_state_field]);
			const wfActionTd = document.createElement("td");
			const el = document.createElement("select");
			el.classList.add("form-select", "rounded");

			el.setAttribute("title", __(row[workflow_state_field]));
			el.style.width = "100px";
			el.style.minWidth = "100px";
			el.style.padding = "2px 5px";
			el.classList.add(
				bg ? `bg-${bg.style.toLowerCase()}` : "pl-[20px]",
				...(bg ? ["text-white"] : [])
			);

			if (isClosed) {
				el.disabled = true;
				el.classList.add("ellipsis");
				el.setAttribute("title", __(row[workflow_state_field]));
				el.innerHTML = `<option value="" style="color:black" selected disabled>${__(
					row[workflow_state_field]
				)}</option>`;
				el.style["-webkit-appearance"] = "none";
				el.style["-moz-appearance"] = "none";
				el.style["appearance"] = "none";
				el.style["background-color"] = "transparent";
				el.style["text-align"] = "center";
				wfActionTd.appendChild(el);
			} else {
				el.disabled =
					(this.connection?.keep_workflow_enabled_form_submission
						? false
						: this.frm?.doc?.docstatus !== 0) ||
					closureStates.includes(row[workflow_state_field]) ||
					!this.workflow?.transitions?.some(
						(tr) =>
							frappe.user_roles.includes(tr.allowed) &&
							tr.state === row[workflow_state_field]
					);

				// Note: We'll need to handle the async workflow transitions loading
				el.innerHTML = `<option value="" style="color:black" selected disabled class="ellipsis">${__(
					row[workflow_state_field]
				)}</option>`;

				el.addEventListener("focus", (event) => {
					const originalState = el?.getAttribute("title");
					el.value = "";
					el.title = __(originalState);
				});

				el.addEventListener("change", async (event) => {
					const action = event.target.value;
					const link = this.workflow.transitions.find(
						(l) =>
							l.state == row[workflow_state_field] &&
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
								await this.wf_action(link, primaryKey, el, originalState, row);
							} catch (error) {
								el.value = ""; // Reset dropdown value
								el.title = __(originalState);
							}
						}
						el.value = "";
						el.title = __(originalState);
					}
				});

				wfActionTd.appendChild(el);
			}
			wfActionTd.style.textAlign = "center";
			tr.appendChild(wfActionTd);
		}

		// Action Column (always visible to match settings header)
		const actionTd = document.createElement("td");
		actionTd.classList.add("sva-dt-action-column");
		actionTd.style.minWidth = "50px";
		actionTd.style.textAlign = "center";
		actionTd.style.position = "sticky";
		actionTd.style.right = "0px";
		actionTd.style.zIndex = "3";
		actionTd.style.backgroundColor = "#fff";
		if (
			(this.conf_perms.length &&
				(this.conf_perms.includes("read") ||
					this.conf_perms.includes("delete") ||
					this.conf_perms.includes("write"))) ||
			this.childLinks?.length
		) {
			actionTd.appendChild(this.createActionColumn(row, primaryKey));
		}
		tr.appendChild(actionTd);

		// Add hover effect
		tr.addEventListener("mouseover", () => {
			tr.style.transition = "background-color 0.15s ease";
			tr.style.backgroundColor = "#f5f5f5";
			tr.querySelectorAll("td").forEach((td) => {
				td.style.transition = "background-color 0.15s ease";
				if (!td.dataset.originalBg)
					td.dataset.originalBg = window.getComputedStyle(td).backgroundColor || "#fff";
				td.style.backgroundColor = "#f5f5f5";
			});
		});
		tr.addEventListener("mouseleave", () => {
			tr.style.transition = "background-color 0.15s ease";
			tr.style.backgroundColor = "#fff";
			tr.querySelectorAll("td").forEach((td) => {
				td.style.transition = "background-color 0.15s ease";
				td.style.backgroundColor = td.dataset.originalBg || "#fff";
			});
		});

		return tr;
	},

	createTable() {
		const el = document.createElement("div");
		el.id = "sva_table_wrapper";
		el.classList.add("form-grid-container", "form-grid");
		let height = this.options?.style?.height
			? `min-height:${this.options?.style?.height};`
			: "";
		el.style = `overflow:auto; ${height}`;
		this.table = document.createElement("table");
		this.table.classList.add("table", "table-bordered");
		this.table.style =
			"width:100%;height:auto; font-size:13px; margin-top:0px !important;margin-bottom: 0px;";
		this.table.appendChild(this.createTableHead());
		el.appendChild(this.table);
		this.table.appendChild(this.createTableBody());

		// Auto transpose if enabled — hide immediately to prevent flash of normal table
		if (
			this.connection?.enable_auto_transpose &&
			["Direct", "Indirect", "Referenced", "Unfiltered", "Report"].includes(
				this.connection?.connection_type
			)
		) {
			this.isTransposed = true;
			this.table.style.visibility = "hidden";
			setTimeout(() => {
				this.transposeTable();
				this.table.style.visibility = "";
			}, 0);
		}

		return el;
	},

	createTableHead() {
		const thead = document.createElement("thead");
		if (this.options?.additionalTableHeader) {
			thead.innerHTML = this.options?.additionalTableHeader?.join("") || "";
		}
		thead.style = `
            color:${this.options?.style?.tableHeader?.color || "#525252"};
            font-size:${this.options?.style?.tableHeader?.fontSize || "12px"};
            font-weight:${this.options?.style?.tableHeader?.fontWeight || "normal"};
            z-index:3; font-weight:200 !important;white-space: nowrap;`;
		const tr = document.createElement("tr");
		tr.style.backgroundColor = "rgb(248, 249, 250)";

		if (this.options.serialNumberColumn) {
			const serialTh = document.createElement("th");
			serialTh.textContent = __("S.No.");
			serialTh.title = __("Serial Number");
			serialTh.style =
				"width:48px;min-width:48px;max-width:48px;text-align:center;position:sticky;left:0px;z-index:4;background-color:#F3F3F3;box-shadow: inset -1px 0 0 0 #d1d8dd;padding: 0px !important;";
			tr.appendChild(serialTh);
		}

		let left = this.options.serialNumberColumn ? 48 : 0;
		const lastStickyHeadIdx = this.columns.reduce((last, col, idx) => {
			let h = this.header?.find((hh) => hh.fieldname === col.fieldname);
			return h?.sticky ? idx : last;
		}, -1);
		this.columns.forEach((column, columnIndex) => {
			const th = document.createElement("th");
			let col = this.header.find((h) => h.fieldname === column.fieldname);
			const colWidth = (Number(col?.width) || 2) * 50;
			const isLastSticky = columnIndex === lastStickyHeadIdx;

			if (col?.sticky) {
				th.style = `position:sticky; left:${left}px; z-index:2; background-color:rgb(248, 249, 250);cursor:${
					column.sortable ? "pointer" : "default"
				};min-width:${colWidth}px !important;max-width:${colWidth}px !important;width:${colWidth}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;${
					isLastSticky ? "box-shadow: inset -2px 0 0 0 #d1d8dd;" : ""
				}`;
				left += colWidth;
			} else if (col?.width) {
				th.style = `min-width:${colWidth}px !important;max-width:${colWidth}px !important;width:${colWidth}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;${
					column.sortable ? "cursor:pointer;" : ""
				}`;
			} else if (column.sortable) {
				th.style = `cursor:pointer;`;
			}

			th.textContent = __(strip_html(column.label) || column.fieldname);
			th.title = __(strip_html(column.label) || column.fieldname);

			if (column.sortable) {
				this.createSortingIcon(th, column);
			}

			tr.appendChild(th);
		});
		// ========================= Workflow Logic ======================
		if (!this.connection?.disable_workflow && this.connection.connection_type !== "Report") {
			if (this.workflow && (this.wf_editable_allowed || this.wf_transitions_allowed)) {
				const addColumn = document.createElement("th");
				addColumn.textContent = this.connection.action_label
					? this.connection.action_label
					: "Approval";
				addColumn.title = this.connection.action_label
					? this.connection.action_label
					: "Approval";
				addColumn.style =
					"text-align:center;max-width: 120px !important; width: 120px !important;";
				tr.appendChild(addColumn);
			}
		}
		// ========================= Workflow End ======================

		// ========================= Action Column ======================
		const action_th = document.createElement("th");
		action_th.style =
			"width:5px; text-align:center;position:sticky;right:0px;z-index:3;background-color:#F3F3F3;";
		action_th.appendChild(this.createSettingsButton());
		action_th.title = __("Settings");
		tr.appendChild(action_th);
		// ========================= Action Column End ======================
		thead.appendChild(tr);
		return thead;
	},

	createSortingIcon(th, column) {
		const sortIcon = document.createElement("span");
		sortIcon.className = "sort-icon";
		sortIcon.style = "margin-left:5px; cursor:pointer;";
		sortIcon.innerHTML =
			this?.currentSort?.direction == "desc" && this?.currentSort?.column == column.fieldname
				? "&darr;"
				: "&uarr;"; // Default icon (up arrow)
		th.appendChild(sortIcon);
		th.addEventListener("click", () => {
			const direction =
				this.currentSort?.column === column.fieldname &&
				this.currentSort?.direction === "asc"
					? "desc"
					: "asc";
			this.sortByColumn(column, direction);
			if (direction === "asc") {
				sortIcon.innerHTML = "&uarr;"; // Up arrow for ascending
			} else {
				sortIcon.innerHTML = "&darr;"; // Down arrow for descending
			}
		});
	},

	createTotalRow() {
		if (!this.connection?.add_total_row) return null;
		const tr = document.createElement("tr");
		tr.classList.add("sva-dt-total-row");
		tr.style.fontWeight = "bold";
		tr.style.backgroundColor = "#f9f9f9";
		tr.style.borderTop = "2px solid #d1d8dd";
		const totalRowHeight = "32px";
		tr.style.minHeight = totalRowHeight;
		tr.style.height = totalRowHeight;

		if (this.options.serialNumberColumn) {
			const td = document.createElement("td");
			td.style =
				"position:sticky;left:0;z-index:2;background-color:#f9f9f9;text-align:center;min-width:48px;font-weight:bold;";
			td.style.height = totalRowHeight;
			td.style.minHeight = totalRowHeight;
			td.textContent = __("Total");
			tr.appendChild(td);
		}

		const summableTypes = ["Currency", "Int", "Float", "Percent"];
		let left = this.options.serialNumberColumn ? 48 : 0;
		const lastStickyIdx = this.columns.reduce((last, col, idx) => {
			let h = this.header?.find((hh) => hh.fieldname === col.fieldname);
			return h?.sticky ? idx : last;
		}, -1);

		this.columns.forEach((column, columnIndex) => {
			const td = document.createElement("td");
			let col = this.header?.find((h) => h.fieldname === column.fieldname);
			const fieldMeta =
				this.meta?.fields?.find((f) => f.fieldname === column.fieldname) || column;
			const colWidth = (Number(col?.width) || 2) * 50;
			const isSticky = !!col?.sticky;
			const isLastSticky = columnIndex === lastStickyIdx;
			td.style.height = totalRowHeight;
			td.style.minHeight = totalRowHeight;

			if (isSticky) {
				td.style.position = "sticky";
				td.style.left = `${left}px`;
				td.style.zIndex = "2";
				td.style.backgroundColor = col?.bg_color || "#f9f9f9";
				td.style.minWidth = `${colWidth}px`;
				td.style.maxWidth = `${colWidth}px`;
				if (isLastSticky) td.style.boxShadow = "inset -2px 0 0 0 #d1d8dd";
				left += colWidth;
			}

			const ftype = fieldMeta.fieldtype || column.fieldtype;
			if (summableTypes.includes(ftype)) {
				const sum = this.rows.reduce(
					(acc, row) => acc + (parseFloat(row[column.fieldname]) || 0),
					0
				);
				if (ftype === "Currency") {
					const currency = fieldMeta.options || frappe.sys_defaults?.currency || "INR";
					td.textContent = formatCurrency(sum, currency);
				} else if (ftype === "Percent") {
					const visibleRowLength = this.rows?.length || 0;
					const avg = sum / (visibleRowLength || 1); // Average across visible rows
					td.innerHTML = this.percentageCell(avg, col?.color || "#2E7D32");
				} else {
					td.textContent = sum.toLocaleString("en-US", {
						minimumFractionDigits: 0,
						maximumFractionDigits: 2,
					});
				}
				td.style.textAlign = "right";
				td.style.padding = "4px 8px";
			} else {
				td.textContent = "-";
				td.style.textAlign = "center";
				td.style.padding = "4px 8px";
				td.style.color = "var(--text-muted)";
			}

			if (col?.color && ftype !== "Percent") td.style.color = col.color;
			if (col?.bg_color) td.style.backgroundColor = col.bg_color;

			tr.appendChild(td);
		});

		const actionTd = document.createElement("td");
		actionTd.style =
			"position:sticky;right:0;z-index:3;background-color:#f9f9f9;min-width:50px;";
		actionTd.style.height = totalRowHeight;
		actionTd.style.minHeight = totalRowHeight;
		tr.appendChild(actionTd);

		return tr;
	},

	createTableBody() {
		if (this.rows?.length === 0) {
			return this.createNoDataFoundPage();
		}

		const tbody = document.createElement("tbody");
		this.tBody = tbody;
		let rowIndex = 0;
		const batchSize = this.options?.pageLimit || 30;
		tbody.style.whiteSpace = "nowrap";

		if (this.currentSort) {
			this.sortByColumn(this.currentSort.column, this.currentSort.direction, false);
		}

		const renderBatch = async () => {
			const fragment = document.createDocumentFragment(); // Use a document fragment to batch DOM changes

			for (let i = 0; i < batchSize && rowIndex < this.rows.length; i++) {
				const row = this.rows[rowIndex];
				row.rowIndex = rowIndex;
				const tr = document.createElement("tr");
				let primaryKey = row?.name || row?.rowIndex || rowIndex?.id || rowIndex;
				const hasWrapColumn = this.header?.some((h) => h.wrap);
				if (!hasWrapColumn) {
					tr.style.maxHeight = "32px";
					tr.style.height = "32px";
				}
				tr.style.backgroundColor = "#fff";

				// Serial Number Column
				if (this.options.serialNumberColumn) {
					const serialTd = document.createElement("td");
					serialTd.classList.add("sva-dt-serial-number-column");
					serialTd.style.minWidth = "48px";
					serialTd.style.width = "48px";
					serialTd.style.maxWidth = "48px";
					serialTd.style.textAlign = "center";
					serialTd.style.position = "sticky";
					serialTd.style.left = "0px";
					serialTd.style.backgroundColor = "#fff";
					serialTd.style.zIndex = "4";
					serialTd.style.boxShadow = "inset -1px 0 0 0 #d1d8dd";
					serialTd.style.setProperty("padding", "0px", "important");
					const serialNumber =
						this.page > 1
							? (this.page - 1) * this.limit + (rowIndex + 1)
							: rowIndex + 1;
					if (
						this.frm?.dt_events?.[this.doctype ?? this.link_report]?.formatter?.["#"]
					) {
						let formatter =
							this.frm.dt_events[this.doctype ?? this.link_report].formatter["#"];
						serialTd.innerHTML = formatter(serialNumber, row, this);
					} else if (
						!this.hasNavigableColumn &&
						this.connection?.connection_type !== "Report"
					) {
						const doctype = this.doctype;
						const href = `/app/${encodeURIComponent(
							frappe.router.slug(doctype)
						)}/${encodeURIComponent(row.name)}`;
						const linkColor =
							frappe.boot?.my_theme?.navbar_color || "var(--primary-color)";
						const a = document.createElement("a");
						a.href = href;
						a.dataset.doctype = doctype;
						a.dataset.name = row.name;
						a.style.cursor = "pointer";
						a.style.textDecoration = "underline";
						a.style.color = linkColor;
						a.textContent = serialNumber;
						serialTd.appendChild(a);
					} else {
						const p = document.createElement("p");
						p.dataset.docname = row.name;
						p.textContent = serialNumber;
						serialTd.appendChild(p);
					}

					if (
						this.frm?.dt_events?.[this.doctype || this.link_report]?.columnEvents?.[
							"#"
						]?.click
					) {
						this.bindColumnEvents(serialTd, serialNumber, { fieldname: "#" }, row);
					}

					tr.appendChild(serialTd);
				}

				let left = this.options.serialNumberColumn ? 48 : 0;
				const lastStickyIdx = this.columns.reduce((last, col, idx) => {
					let h = this.header?.find((hh) => hh.fieldname === col.fieldname);
					return h?.sticky ? idx : last;
				}, -1);
				this.columns.forEach((column, columnIndex) => {
					const td = document.createElement("td");
					let col = this.header?.find((h) => h.fieldname === column.fieldname);
					const fieldMeta =
						this.meta?.fields?.find((f) => f.fieldname === column.fieldname) || column;
					const isSticky = !!col?.sticky;
					const isLastSticky = columnIndex === lastStickyIdx;
					td.style = this.getCellStyle(column, isSticky, left, isLastSticky);
					if (isSticky) {
						td.classList.add("sva-dt-sticky-column");
						left += (Number(col?.width) || 2) * 50;
					}

					td.textContent = row[column.fieldname] || "";
					if (this.options.editable && column.fieldtype !== "Select") {
						this.createEditableField(td, column, row);
					} else {
						this.createNonEditableField(td, column, row, columnIndex);
					}
					if (col?.wrap) {
						td.style.whiteSpace = "normal";
						td.style.wordBreak = "break-word";
						td.style.overflowWrap = "break-word";
						td.style.overflow = "visible";
						td.style.textOverflow = "unset";
						td.style.height = "auto";
						td.style.minHeight = "32px";
					}
					if (col?.color && fieldMeta?.fieldtype !== "Percent")
						td.style.color = col.color;
					if (col?.bg_color) td.style.backgroundColor = col.bg_color;
					tr.appendChild(td);
				});

				// ========================= Workflow Logic ===================
				if (
					!this.connection?.disable_workflow &&
					this.connection.connection_type !== "Report"
				) {
					if (
						this.workflow &&
						(this.wf_editable_allowed || this.wf_transitions_allowed)
					) {
						let workflow_state_field = this.workflow?.workflow_state_field;
						const bg = this.workflow_state_bg?.find(
							(bg) => bg.name === row[workflow_state_field] && bg.style
						);
						const closureStates = this.workflow?.states
							?.filter((s) => ["Positive", "Negative"].includes(s.custom_closure))
							.map((e) => e.state);
						const isClosed = closureStates.includes(row[workflow_state_field]);
						const wfActionTd = document.createElement("td");
						const el = document.createElement("select");
						el.classList.add("form-select", "rounded");
						el.style.width = "100px";
						el.style.maxWidth = "100px";
						el.style.padding = "2px 5px";
						el.classList.add(
							bg ? `bg-${bg.style.toLowerCase()}` : "pl-[20px]",
							...(bg ? ["text-white"] : [])
						);
						if (isClosed) {
							el.disabled = true;
							el.classList.add("ellipsis");
							el.setAttribute(
								"title",
								__(
									this.workflow_state_map?.[row[workflow_state_field]] ||
										row[workflow_state_field]
								)
							);
							el.innerHTML = `<option value="" style="color:black" selected disabled">${__(
								this.workflow_state_map?.[row[workflow_state_field]] ||
									row[workflow_state_field]
							)}</option>`;
							el.style["-webkit-appearance"] = "none";
							el.style["-moz-appearance"] = "none";
							el.style["appearance"] = "none";
							el.style["background-color"] = "transparent";
							el.style["text-align"] = "center";
							wfActionTd.appendChild(el);
						} else {
							// Render immediately with placeholder — rows appear without
							// waiting for get_transitions API. Transitions load in background.
							const stateLabel =
								this.workflow_state_map?.[row[workflow_state_field]] ||
								row[workflow_state_field] ||
								"";
							el.setAttribute("title", __(stateLabel));
							el.innerHTML = `<option value="" style="color:black" selected disabled class="ellipsis">${__(
								stateLabel
							)}</option>`;
							el.disabled = true;
							wfActionTd.appendChild(el);

							// Background load — frappe.xcall so concurrent per-row calls
							// do NOT cancel each other (sva_db.call aborts the previous request).
							(async () => {
								try {
									const initialDisabled =
										(this.connection?.keep_workflow_enabled_form_submission
											? false
											: this.frm?.doc?.docstatus !== 0) ||
										closureStates.includes(row[workflow_state_field]) ||
										!this.workflow?.transitions?.some(
											(tr) =>
												frappe.user_roles.includes(tr.allowed) &&
												tr.state === row[workflow_state_field]
										);

									const transitions = await frappe.xcall(
										"frappe.model.workflow.get_transitions",
										{ doc: { ...row, doctype: this.doctype } }
									);

									const disableByDependsOn = this.connection
										?.disable_workflow_depends_on
										? frappe.utils.custom_eval(
												this.connection?.disable_workflow_depends_on,
												row
										  )
										: false;

									el.disabled =
										initialDisabled ||
										!transitions?.length ||
										disableByDependsOn;

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
													l.state == row[workflow_state_field] &&
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
													await this.wf_action(
														link,
														primaryKey,
														el,
														originalState,
														row
													);
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
									// Leave as disabled with current state label on error
									console.error(
										"Error loading workflow transitions for row",
										row,
										_e
									);
								}
							})();
						}
						wfActionTd.style.textAlign = "center";
						tr.appendChild(wfActionTd);
					}
				}
				// ========================= Workflow End ===================
				const actionTd = document.createElement("td");
				actionTd.classList.add("sva-dt-action-column");
				actionTd.style.minWidth = "50px";
				actionTd.style.textAlign = "center";
				actionTd.style.position = "sticky";
				actionTd.style.right = "0px";
				actionTd.style.zIndex = "3";
				actionTd.style.backgroundColor = "#fff";
				if (
					(this.conf_perms.length &&
						(this.conf_perms.includes("read") ||
							this.conf_perms.includes("delete") ||
							this.conf_perms.includes("write"))) ||
					this.childLinks?.length
				) {
					actionTd.appendChild(this.createActionColumn(row, primaryKey));
				}
				tr.appendChild(actionTd);

				// Add hover effect
				tr.addEventListener("mouseover", () => {
					tr.style.transition = "background-color 0.15s ease";
					tr.style.backgroundColor = "#f5f5f5";
					tr.querySelectorAll("td").forEach((td) => {
						td.style.transition = "background-color 0.15s ease";
						if (!td.dataset.originalBg)
							td.dataset.originalBg =
								window.getComputedStyle(td).backgroundColor || "#fff";
						td.style.backgroundColor = "#f5f5f5";
					});
				});
				tr.addEventListener("mouseleave", () => {
					tr.style.transition = "background-color 0.15s ease";
					tr.style.backgroundColor = "#fff";
					tr.querySelectorAll("td").forEach((td) => {
						td.style.transition = "background-color 0.15s ease";
						td.style.backgroundColor = td.dataset.originalBg || "#fff";
					});
				});

				fragment.appendChild(tr);
				rowIndex++;
			}

			tbody.appendChild(fragment); // Append all rows at once to minimize reflows
		};

		const handleScroll = () => {
			const scrollTop = this.table_wrapper.scrollTop;
			if (
				scrollTop > this.lastScrollTop &&
				this.table_wrapper.scrollTop + this.table_wrapper.clientHeight >=
					this.table_wrapper.scrollHeight
			) {
				renderBatch();
			}
			this.lastScrollTop = scrollTop;
		};

		this.table_wrapper.addEventListener("scroll", handleScroll);
		renderBatch();

		const totalRow = this.createTotalRow();
		if (totalRow) tbody.appendChild(totalRow);

		return tbody;
	},

	updateTableBody() {
		if (this.rows.length === 0) {
			const currentChild =
				this.table.querySelector("tbody") || this.table.querySelector("#noDataFoundPage");
			if (currentChild) {
				this.table.replaceChild(this.createNoDataFoundPage(), currentChild);
			} else {
				this.table.appendChild(this.createNoDataFoundPage());
			}
			return;
		}

		// When transposed: update cells in-place for smooth pagination (no flash/rebuild).
		if (this.isTransposed) {
			this._refreshTransposeData();
			return;
		}

		const oldTbody = this.table.querySelector("tbody");
		const newTbody = this.createTableBody();
		this.table.replaceChild(
			newTbody,
			oldTbody || this.table.querySelector("#noDataFoundPage")
		);
		this.tBody = newTbody;
	},

	createNoDataFoundPage() {
		const tr = document.createElement("tr");
		tr.id = "noDataFoundPage";
		tr.style.height = "200px";
		tr.style.fontSize = "20px";
		const td = document.createElement("td");
		td.colSpan =
			(this.columns?.length ?? 3) +
			((this.options?.serialNumberColumn ? 1 : 0) +
				(this.conf_perms.includes("write") || this.conf_perms.includes("delete") ? 1 : 0) +
				(this.wf_transitions_allowed || this.wf_editable_allowed ? 1 : 0));

		td.innerHTML = `
                <div class="msg-box no-border">
                    <div class="mb-4">
                        <svg class="icon icon-xl" style="stroke: var(--text-light);">
                            <use href="#icon-small-file"></use>
                        </svg>
                    </div>
                    <p>You haven't created a record yet</p>
                </div>
        `;
		tr.appendChild(td);

		const tbody = document.createElement("tbody");
		tbody.appendChild(tr);
		return tbody;
	},

	createSkeletonLoader(reLoad = false) {
		const overlay = document.createElement("div");
		overlay.id = "skeleton-loader-overlay";
		overlay.style = `
            width: 100%;
            height: inherit;
            z-index: 1000;
            display: flex;
            background: transparent;
            flex-direction: column;
            margin-bottom: 20px;
        `;

		// Create header skeleton
		const headerSkeleton = document.createElement("div");
		headerSkeleton.style = `
            display: ${reLoad ? "none" : "flex"};
            justify-content: space-between;
            background: white;
            margin-bottom: 20px;
        `;

		const leftHeader = document.createElement("div");
		leftHeader.style = `
            width: 200px;
            height: 20px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        `;

		const rightHeader = document.createElement("div");
		rightHeader.style = `
            width: 150px;
            height: 20px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        `;

		headerSkeleton.appendChild(leftHeader);
		headerSkeleton.appendChild(rightHeader);
		overlay.appendChild(headerSkeleton);

		// Create table skeleton
		const tableSkeleton = document.createElement("div");
		tableSkeleton.style = `
            width: 100%;
            border: 1px solid #e0e0e0;
            background: white;
            border-radius: 4px;
            flex: 1;
        `;

		// Create table header skeleton
		const theadSkeleton = document.createElement("div");
		theadSkeleton.style = `
            display: flex;
            border-bottom: 1px solid #e0e0e0;
            padding: 10px;
        `;

		// Add 5 header cells
		for (let i = 0; i < 5; i++) {
			const thSkeleton = document.createElement("div");
			thSkeleton.style = `
                width: 100%;
                height: 20px;
                margin-right: 20px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
                border-radius: 4px;
            `;
			theadSkeleton.appendChild(thSkeleton);
		}
		tableSkeleton.appendChild(theadSkeleton);

		// Create table body skeleton with 5 rows
		for (let i = 0; i < 5; i++) {
			const rowSkeleton = document.createElement("div");
			rowSkeleton.style = `
                display: flex;
                padding: 10px;
                border-bottom: 1px solid #e0e0e0;
            `;

			// Add 5 cells per row
			for (let j = 0; j < 5; j++) {
				const tdSkeleton = document.createElement("div");
				tdSkeleton.style = `
                    width: 100%;
                    height: 20px;
                    margin-right: 20px;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 4px;
                `;
				rowSkeleton.appendChild(tdSkeleton);
			}
			tableSkeleton.appendChild(rowSkeleton);
		}

		overlay.appendChild(tableSkeleton);

		// Add shimmer animation style
		const style = document.createElement("style");
		style.textContent = `
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
		overlay.appendChild(style);

		return overlay;
	},
};

export default RenderingMixin;
