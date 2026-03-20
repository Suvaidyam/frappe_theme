const RenderingMixin = {
	createTableRow(row, rowIndex) {
		const tr = document.createElement("tr");
		tr.style.maxHeight = "32px";
		tr.style.height = "32px";
		tr.style.backgroundColor = "#fff";
		tr.setAttribute("data-row-index", rowIndex);
		tr.setAttribute("data-docname", row.name);

		let primaryKey = row?.name || row?.rowIndex || rowIndex?.id || rowIndex;

		// Serial Number Column
		if (this.options.serialNumberColumn) {
			const serialTd = document.createElement("td");
			serialTd.style.minWidth = "40px";
			serialTd.style.textAlign = "center";
			serialTd.style.position = "sticky";
			serialTd.style.left = "0px";
			serialTd.style.backgroundColor = "#fff";

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
				serialTd.innerHTML = `<a href="${href}" data-doctype="${doctype}" data-name="${row.name}" style="cursor:pointer; text-decoration:underline; color:${linkColor};">${serialNumber}</a>`;
			} else {
				serialTd.innerHTML = `<p data-docname="${row.name}">${serialNumber}</p>`;
			}
			if (
				this.frm?.dt_events?.[this.doctype || this.link_report]?.columnEvents?.["#"]?.click
			) {
				this.bindColumnEvents(serialTd, serialNumber, { fieldname: "#" }, row);
			}

			tr.appendChild(serialTd);
		}

		// Data Columns
		let left = 0;
		let freezeColumnsAtLeft = this.options.serialNumberColumn ? 1 : 0; // Adjust for serial column
		this.columns.forEach((column, columnIndex) => {
			const td = document.createElement("td");
			td.style = this.getCellStyle(column, freezeColumnsAtLeft, left);
			if (this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft) {
				left += column.width;
				freezeColumnsAtLeft++;
			}

			td.textContent = row[column.fieldname] || "";
			if (this.options.editable) {
				this.createEditableField(td, column, row);
			} else {
				this.createNonEditableField(td, column, row, columnIndex);
			}
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

		// Action Column
		if (
			(this.conf_perms.length &&
				(this.conf_perms.includes("read") ||
					this.conf_perms.includes("delete") ||
					this.conf_perms.includes("write"))) ||
			this.childLinks?.length
		) {
			const actionTd = document.createElement("td");
			actionTd.style.minWidth = "50px";
			actionTd.style.textAlign = "center";
			actionTd.style.position = "sticky";
			actionTd.style.right = "0px";
			actionTd.style.backgroundColor = "#fff";
			actionTd.appendChild(this.createActionColumn(row, primaryKey));

			tr.appendChild(actionTd);
		}

		// Add hover effect
		tr.addEventListener("mouseover", () => {
			tr.style.backgroundColor = "#f5f5f5";
			tr.querySelectorAll(".sva-dt-serial-number-column").forEach((td) => {
				td.style.backgroundColor = "#f5f5f5";
			});
			tr.querySelectorAll(".sva-dt-action-column").forEach((td) => {
				td.style.backgroundColor = "#f5f5f5";
			});
		});
		tr.addEventListener("mouseleave", () => {
			tr.style.backgroundColor = "#fff";
			tr.querySelectorAll(".sva-dt-serial-number-column").forEach((td) => {
				td.style.backgroundColor = "#fff";
			});
			tr.querySelectorAll(".sva-dt-action-column").forEach((td) => {
				td.style.backgroundColor = "#fff";
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

		// Auto transpose if enabled for reports
		if (
			this.connection?.enable_auto_transpose &&
			this.connection?.connection_type === "Report"
		) {
			this.isTransposed = true;
			setTimeout(async () => {
				this.rows = await this.getDocList();
				this.table.replaceChild(this.createTableBody(), this.table.querySelector("tbody"));
				this.transposeTable();
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

		if (this.options.serialNumberColumn) {
			const serialTh = document.createElement("th");
			serialTh.textContent = __("S.No.");
			serialTh.title = __("Serial Number");
			serialTh.style =
				"width:40px;text-align:center;position:sticky;left:0px;background-color:#F3F3F3;";
			tr.appendChild(serialTh);
		}

		let left = 0;
		let freezeColumnsAtLeft = 1;
		this.columns.forEach((column) => {
			const th = document.createElement("th");
			let col = this.header.find((h) => h.fieldname === column.fieldname);
			if (col?.width) {
				th.style = `min-width:${Number(col?.width) * 50}px !important;max-width:${
					Number(col?.width) * 50
				}px !important;width:${
					Number(col?.width) * 50
				}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
			}
			th.textContent = __(strip_html(column.label) || column.fieldname);
			th.title = __(strip_html(column.label) || column.fieldname);

			if (column.sortable) {
				this.createSortingIcon(th, column); // Create the sorting dropdown
				if (col?.width) {
					th.style = `min-width:${Number(col?.width) * 50}px !important;max-width:${
						Number(col?.width) * 50
					}px !important;width:${
						Number(col?.width) * 50
					}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;cursor:pointer;`;
				} else {
					th.style = `cursor:pointer;`;
				}
			}

			if (
				this.options.freezeColumnsAtLeft &&
				this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft
			) {
				if (col?.width) {
					th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${
						column.sortable ? "pointer" : "default"
					};min-width:${Number(col?.width) * 50}px !important;max-width:${
						Number(col?.width) * 50
					}px !important;width:${
						Number(col?.width) * 50
					}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
				} else {
					th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${
						column.sortable ? "pointer" : "default"
					}`;
				}
				left += column.width;
				freezeColumnsAtLeft++;
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
			"width:5px; text-align:center;position:sticky;right:0px;background-color:#F3F3F3;";
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
				tr.style.maxHeight = "32px";
				tr.style.height = "32px";
				tr.style.backgroundColor = "#fff";

				// Serial Number Column
				if (this.options.serialNumberColumn) {
					const serialTd = document.createElement("td");
					serialTd.classList.add("sva-dt-serial-number-column");
					serialTd.style.minWidth = "40px";
					serialTd.style.textAlign = "center";
					serialTd.style.position = "sticky";
					serialTd.style.left = "0px";
					serialTd.style.backgroundColor = "#fff";
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
						serialTd.innerHTML = `<a href="${href}" data-doctype="${doctype}" data-name="${row.name}" style="cursor:pointer; text-decoration:underline; color:${linkColor};">${serialNumber}</a>`;
					} else {
						serialTd.innerHTML = `<p data-docname="${row.name}">${serialNumber}</p>`;
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

				let left = 0;
				let freezeColumnsAtLeft = 1;
				this.columns.forEach((column, columnIndex) => {
					const td = document.createElement("td");
					td.style = this.getCellStyle(column, freezeColumnsAtLeft, left);
					if (this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft) {
						left += column.width;
						freezeColumnsAtLeft++;
					}

					td.textContent = row[column.fieldname] || "";
					if (this.options.editable) {
						this.createEditableField(td, column, row);
					} else {
						this.createNonEditableField(td, column, row, columnIndex);
					}
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
							let { message: transitions } = await this.sva_db.call({
								method: "frappe.model.workflow.get_transitions",
								doc: { ...row, doctype: this.doctype },
							});
							el.disabled =
								el.disabled ||
								transitions.length === 0 ||
								(this.connection?.disable_workflow_depends_on
									? frappe.utils.custom_eval(
											this.connection?.disable_workflow_depends_on,
											row
									  )
									: false);
							el.setAttribute(
								"title",
								__(
									this.workflow_state_map?.[row[workflow_state_field]] ||
										row[workflow_state_field]
								)
							);
							el.innerHTML =
								`<option value="" style="color:black" selected disabled class="ellipsis">${__(
									this.workflow_state_map?.[row[workflow_state_field]] ||
										row[workflow_state_field]
								)}</option>` +
								[...new Set(transitions?.map((e) => e.action))]
									?.map(
										(action) =>
											`<option value="${action}" style="background-color:white; color:black; cursor:pointer;" class="rounded p-1">${__(
												action
											)}</option>`
									)
									.join("");
							el.addEventListener("focus", (event) => {
								const originalState = el?.getAttribute("title");
								el.value = "";
								el.title = originalState;
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
											await this.wf_action(
												link,
												primaryKey,
												el,
												originalState,
												row
											);
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
				}
				// ========================= Workflow End ===================
				if (
					(this.conf_perms.length &&
						(this.conf_perms.includes("read") ||
							this.conf_perms.includes("delete") ||
							this.conf_perms.includes("write"))) ||
					this.childLinks?.length
				) {
					const actionTd = document.createElement("td");
					actionTd.classList.add("sva-dt-action-column");
					actionTd.style.minWidth = "50px";
					actionTd.style.textAlign = "center";
					actionTd.style.position = "sticky";
					actionTd.style.right = "0px";
					actionTd.style.backgroundColor = "#fff";
					actionTd.appendChild(this.createActionColumn(row, primaryKey));

					tr.appendChild(actionTd);
				}

				// Add hover effect
				tr.addEventListener("mouseover", () => {
					tr.style.backgroundColor = "#f5f5f5";
					tr.querySelectorAll(".sva-dt-serial-number-column").forEach((td) => {
						td.style.backgroundColor = "#f5f5f5";
					});
					tr.querySelectorAll(".sva-dt-action-column").forEach((td) => {
						td.style.backgroundColor = "#f5f5f5";
					});
				});
				tr.addEventListener("mouseleave", () => {
					tr.style.backgroundColor = "#fff";
					tr.querySelectorAll(".sva-dt-serial-number-column").forEach((td) => {
						td.style.backgroundColor = "#fff";
					});
					tr.querySelectorAll(".sva-dt-action-column").forEach((td) => {
						td.style.backgroundColor = "#fff";
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
		return tbody;
	},

	updateTableBody() {
		if (this.rows.length === 0) {
			this.table.replaceChild(this.createNoDataFoundPage(), this.tBody);
			return;
		}
		const oldTbody = this.table.querySelector("tbody");
		const newTbody = this.createTableBody();
		this.table.replaceChild(
			newTbody,
			oldTbody || this.table.querySelector("#noDataFoundPage")
		); // Replace old tbody with new sorted tbody

		// Reapply transpose if it was previously transposed
		if (this.isTransposed) {
			setTimeout(() => this.transposeTable(), 0);
		}
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
