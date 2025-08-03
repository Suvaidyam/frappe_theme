import SVASortSelector from "./sva_sort_selector.bundle.js";
import SVAListSettings from "./list_settings.bundle.js";
import SVAFilterArea from "./filters/filter_area.bundle.js";
import DTAction from "../vue/dt_action/dt.action.bundle.js";

class SvaDataTable {
	/**
	 * Constructor for initializing the table with provided options.
	 *
	 * @param {Object} params - Configuration parameters for the table.
	 * @param {HTMLElement} params.wrapper - The wrapper element to contain the table.
	 * @param {Array} params.columns - Array of column definitions.
	 * @param {Array} params.rows - Array of row data.
	 * @param {Object} params.options - Additional options for table configuration.
	 * @param {Object} params.frm - Form object related to the table.
	 * @param {string} params.cdtfname - Field name for the child table.
	 * @param {Object} params.options - Options to customize the table behavior and appearance.
	 * @param {boolean} params.options.serialNumberColumn - Whether to include a serial number column in the table.
	 * @param {Object} params.options.defaultSort - Default sorting configuration for the table.
	 * @param {string} params.options.defaultSort.column - Default column to sort by.
	 * @param {string} params.options.defaultSort.direction - Default sorting direction ('asc' or 'desc').
	 * @param {number} params.options.freezeColumnsAtLeft - Number of columns to freeze on the left side of the table.
	 * @param {number} params.options.pageLimit - Limit for the number of rows per page.
	 * @param {boolean} params.options.editable - Whether the table rows are editable.
	 * @param {Object} params.options.style - Inline styles to apply to the table.
	 * @param {string} params.options.style.width - Width of the table (e.g., '100%').
	 * @param {string} params.options.style.height - Height of the table (e.g., '700px').
	 * @param {Array<string>} params.options.additionalTableHeader - Additional HTML table headers to be added.
	 */

	constructor({
		label = "",
		wrapper,
		columns = [],
		rows = [],
		limit = 10,
		childLinks = [],
		connection,
		options = {
			serialNumberColumn: true,
			editable: false,
		},
		frm,
		cdtfname,
		doctype,
		render_only = false,
		onFieldClick = () => { },
		onFieldValueChange = () => { },
		signal = null,
	}) {
		this.signal = signal;
		this.sva_db = new SVAHTTP(signal);
		this.label = __(label);
		wrapper.innerHTML = "";
		this.wrapper = wrapper;
		this.rows = rows;
		this.columns = columns;

		// pagination
		this.page = 1;
		this.limit = limit;
		this.total = this.rows.length;
		// pagination

		this.options = options;
		this.currentSort = this?.options?.defaultSort || null; // Track sort state
		this.frm = frm;
		this.doctype = doctype;
		this.link_report = connection?.link_report || null;
		this.childTableFieldName = cdtfname;
		this.connection = connection;
		this.conf_perms = JSON.parse(this.connection?.crud_permissions ?? "[]");
		this.header = JSON.parse(this.connection?.listview_settings ?? "[]");
		this.childLinks = childLinks;
		this.user_has_list_settings = false;
		// this.wrapper = this.setupWrapper(wrapper);
		this.uniqueness = this.options?.uniqueness || { row: [], column: [] };
		this.table_wrapper = document.createElement("div");
		this.table_wrapper.id = "table_wrapper";
		this.table = null;
		this.permissions = [];
		this.workflow = null;
		this.wf_positive_closure = "";
		this.wf_negative_closure = "";
		this.wf_editable_allowed = false;
		this.wf_transitions_allowed = false;
		this.skip_workflow_confirmation = false;
		this.workflow_state_bg = [];
		this.render_only = render_only;
		this.additional_list_filters = [];
		this.onFieldValueChange = onFieldValueChange;
		this.onFieldClick = onFieldClick;
		this.sort_by = "modified";
		this.sort_order = "desc";
		this.header_element = null;
		this.footer_element = null;
		this.skeletonLoader = null;
		this.standard_filters_fields_dict = {};
		// Initialize crud permissions before reloadTable so crudHandler can modify them
		this.crud = {
			read: true,
			create: true,
			write: true,
			delete: true,
			export: true,
			import: true,
			print: true,
		};
		this.filter_area = null;
		this.reloadTable();
		// return this.wrapper;
	}
	async reloadTable(reset = false) {
		await this.setupWrapper(this.wrapper);
		let reLoad = this.wrapper.children.length > 1;
		this.showSkeletonLoader(reLoad);
		if (this.frm?.["dt_events"]?.[this.doctype]?.["before_load"]) {
			let change = this.frm["dt_events"][this.doctype]["before_load"];
			if (this.isAsync(change)) {
				await change(this);
			} else {
				change(this);
			}
		}
		if (!this.render_only) {
			if (this.conf_perms.length && this.conf_perms.includes("read")) {
				this.permissions = await this.get_permissions(this.doctype || this.link_report);
				if (frappe.session.user != "Administrator") {
					let user_wise_list_settings = await this.getUserWiseListSettings();
					if (user_wise_list_settings) {
						this.header = JSON.parse(user_wise_list_settings || "[]");
						this.user_has_list_settings = true;
					}
				}
				// ================================ Workflow Logic  ================================
				if (!this.connection?.disable_workflow) {
					let workflow = await this.sva_db.get_value("Workflow", {
						document_type: this.doctype,
						is_active: 1,
					});
					if (workflow) {
						this.workflow = await this.sva_db.get_doc("Workflow", workflow);
						if (this.workflow.states?.length) {
							this.wf_positive_closure = this.workflow.states.find(
								(tr) => tr.custom_closure === "Positive"
							)?.state;
							this.wf_negative_closure = this.workflow.states.find(
								(tr) => tr.custom_closure === "Negative"
							)?.state;
						}
						this.workflow_state_bg = await this.sva_db.get_list("Workflow State", {
							fields: ["name", "style"],
						});
						this.wf_editable_allowed = this.workflow?.states?.some((tr) =>
							frappe.user_roles.includes(tr?.allow_edit)
						);
						this.wf_transitions_allowed = this.workflow?.transitions?.some((tr) =>
							frappe.user_roles.includes(tr?.allowed)
						);
					}
				}
				// ================================ Workflow End ================================
				if (this.permissions?.length && this.permissions.includes("read")) {
					let { message: response } = await this.sva_db.call({
						method: "frappe_theme.dt_api.get_meta_fields",
						doctype: this.doctype || this.link_report,
						_type: this.connection.connection_type,
						meta_attached: true,
					});
					let columns = response.fields;
					this.meta = response.meta;
					if (this.filter_area) {
						this.filter_area.make_standard_filters();
					}
					if (this.header.length) {
						this.columns = [];
						let ft = {
							name: { fieldtype: "Data" },
							creation: { fieldtype: "Date" },
							owner: { fieldtype: "Link", options: "User" },
							modified: { fieldtype: "Date" },
							modified_by: { fieldtype: "Link", options: "User" },
						};
						for (let h of this.header) {
							if (
								["name", "creation", "owner", "modified", "modified_by"].includes(
									h.fieldname
								)
							) {
								this.columns.push({
									fieldname: h.fieldname,
									label: h.label,
									...ft[h.fieldname],
								});
								continue;
							} else {
								let field = columns.find((f) => f.fieldname === h.fieldname);
								if (field) {
									this.columns.push(field);
								}
							}
						}
					} else {
						this.columns = [...columns.filter((f) => f.in_list_view)];
					}
					this.rows = await this.getDocList();
					this.table_element = this.createTable();
					if (!this.table_wrapper.querySelector("div#sva_table_wrapper") && !reset) {
						this.table_wrapper.appendChild(this.table_element);
					} else {
						this.table_wrapper
							.querySelector("div#sva_table_wrapper")
							.replaceWith(this.table_element);
					}
					this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
					if (!this.wrapper.querySelector("#table_wrapper") && !reset) {
						this.wrapper.appendChild(this.table_wrapper);
					} else {
						this.wrapper
							.querySelector("#table_wrapper")
							.replaceWith(this.table_wrapper);
					}
					this.tBody = this.table.querySelector("tbody");
					this.setupFooter(this.wrapper);
				} else {
					this.handleNoPermission();
				}
			} else {
				this.handleNoPermission();
				console.error("Permission issues", this.doctype);
			}
		} else {
			this.table_element = this.createTable();
			if (!this.table_wrapper.querySelector("table")) {
				this.table_wrapper.appendChild(this.table_element);
			}
			this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
			if (!this.wrapper.querySelector("#table_wrapper")) {
				this.wrapper.appendChild(this.table_wrapper);
			}
			this.tBody = this.table.querySelector("tbody");
		}

		this.hideSkeletonLoader(reLoad);
		if (this.frm?.["dt_events"]?.[this.doctype]?.["after_load"]) {
			let change = this.frm["dt_events"][this.doctype]["after_load"];
			if (this.isAsync(change)) {
				await change(this);
			} else {
				change(this);
			}
		}
	}

	/**
	 * Reloads a specific row in the table without reloading the entire table
	 * @param {string|Object} docname_or_updated_doc - Document name or updated document object
	 * @param {boolean} fetch_from_server - Whether to fetch fresh data from server (default: false)
	 * @returns {Promise<boolean>} - Returns true if row was updated, false if not found
	 */
	async reloadRow(docname_or_updated_doc, fetch_from_server = false) {
		try {
			let docname, updated_doc;

			// Determine if input is docname (string) or updated_doc (object)
			if (typeof docname_or_updated_doc === "string") {
				docname = docname_or_updated_doc;
				if (fetch_from_server) {
					// Fetch fresh data from server
					updated_doc = await this.sva_db.get_doc(this.doctype, docname);
				} else {
					// Use existing row data
					updated_doc = this.rows.find((row) => row.name === docname);
					if (!updated_doc) {
						console.warn(`Row with docname ${docname} not found in table`);
						return false;
					}
				}
			} else {
				// Input is already an updated document object
				updated_doc = docname_or_updated_doc;
				docname = updated_doc.name;
			}

			if (!updated_doc || !docname) {
				console.warn("Invalid document data provided to reloadRow");
				return false;
			}

			// Find the row index in the data array
			const rowIndex = this.rows.findIndex((row) => row.name === docname);
			if (rowIndex === -1) {
				console.warn(`Row with docname ${docname} not found in table data`);
				return false;
			}

			// Update the row data
			this.rows[rowIndex] = { ...this.rows[rowIndex], ...updated_doc };

			// Find the actual DOM row element using enhanced detection
			const domRowIndex = this.findDOMRowByDocname(docname, rowIndex);

			if (domRowIndex === -1) {
				console.warn(
					`DOM row for docname ${docname} not found, updating table body completely`
				);
				// If we can't find the specific row, update the entire table body
				this.updateTableBody();
				return true;
			}

			// Update the specific DOM row
			const tableRows = this.tBody.querySelectorAll("tr");
			const oldRow = tableRows[domRowIndex];
			const newRow = this.createTableRow(updated_doc, rowIndex);

			if (oldRow && newRow) {
				oldRow.replaceWith(newRow);

				// Trigger any after row update events
				if (this.frm?.["dt_events"]?.[this.doctype]?.["after_row_update"]) {
					let change = this.frm["dt_events"][this.doctype]["after_row_update"];
					if (this.isAsync(change)) {
						await change(this, updated_doc, rowIndex);
					} else {
						change(this, updated_doc, rowIndex);
					}
				}

				return true;
			}

			return false;
		} catch (error) {
			console.error("Error in reloadRow:", error);
			return false;
		}
	}

	/**
	 * Creates a single table row element
	 * @param {Object} row - Row data object
	 * @param {number} rowIndex - Index of the row in the data array
	 * @returns {HTMLElement} - Table row element
	 */
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

			serialTd.innerHTML = `<p style="cursor: pointer; text-decoration:underline;" data-docname="${row.name}">${serialNumber}</p>`;
			serialTd.querySelector("p").addEventListener("click", () => {
				let route = frappe.get_route();
				frappe
					.set_route(
						"Form",
						this.connection.connection_type == "Report"
							? this.connection.report_ref_dt
							: this.doctype,
						row.name
					)
					.then(() => {
						cur_frm.add_custom_button("Back", () => {
							frappe.set_route(route);
						});
					});
			});

			tr.appendChild(serialTd);
		}

		// Data Columns
		let left = 0;
		let freezeColumnsAtLeft = this.options.serialNumberColumn ? 1 : 0; // Adjust for serial column
		this.columns.forEach((column) => {
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
				this.createNonEditableField(td, column, row);
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
			const titleText = this.workflow.transitions
				.filter(
					(link) =>
						frappe.user_roles.includes(link.allowed) &&
						link.state === row[workflow_state_field]
				)
				.map((e) => `${e.action} by ${e.allowed}`)
				.join("\n");

			el.setAttribute("title", titleText);
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
				el.setAttribute("title", row[workflow_state_field]);
				el.innerHTML = `<option value="" style="color:black" selected disabled">${row[workflow_state_field]}</option>`;
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
				el.innerHTML = `<option value="" style="color:black" selected disabled class="ellipsis">${row[workflow_state_field]}</option>`;

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
								await this.wf_action(link, primaryKey, el, originalState, row);
							} catch (error) {
								el.value = ""; // Reset dropdown value
								el.title = originalState;
							}
						}
						el.value = "";
						el.title = originalState;
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

		return tr;
	}

	/**
	 * Enhanced method to find DOM row by document name with multiple strategies
	 * @param {string} docname - Document name to search for
	 * @param {number} rowIndex - Expected row index in data array
	 * @returns {number} - DOM row index, -1 if not found
	 */
	findDOMRowByDocname(docname, rowIndex) {
		const tableRows = this.tBody.querySelectorAll("tr");

		for (let i = 0; i < tableRows.length; i++) {
			const row = tableRows[i];

			// Strategy 1: Check if row has data-docname attribute
			if (row.getAttribute("data-docname") === docname) {
				return i;
			}

			// Strategy 2: Check if any cell contains the document name
			const nameCell =
				row.querySelector('td[data-docname="' + docname + '"]') ||
				row.querySelector('td:first-child p[data-docname="' + docname + '"]') ||
				row.querySelector('td a[href*="' + docname + '"]');

			if (nameCell) {
				return i;
			}

			// Strategy 3: Check serial number if serialNumberColumn is enabled
			if (this.options.serialNumberColumn) {
				const serialCell = row.querySelector("td:first-child p");
				if (serialCell) {
					const expectedSerial =
						this.page > 1
							? (this.page - 1) * this.limit + (rowIndex + 1)
							: rowIndex + 1;
					if (parseInt(serialCell.textContent) === expectedSerial) {
						return i;
					}
				}
			}

			// Strategy 4: Check by position/index when serialNumberColumn is disabled
			if (!this.options.serialNumberColumn && i === rowIndex) {
				return i;
			}

			// Strategy 5: Check for document name in any text content
			const rowText = row.textContent || "";
			if (rowText.includes(docname)) {
				// Additional verification: check if it's actually a document name cell
				const cells = row.querySelectorAll("td");
				for (let cell of cells) {
					if (cell.textContent && cell.textContent.trim() === docname) {
						return i;
					}
				}
			}
		}

		return -1;
	}

	setTitle(label) {
		this.label = label;
		this.header_element.querySelector("span#dt-title").textContent = `${this.label ? this.label : " "
			}`;
	}
	hideSkeletonLoader(reLoad = false) {
		if (this.skeletonLoader) {
			this.skeletonLoader.remove();
			this.skeletonLoader = null;
			this.table_wrapper?.querySelector("div#sva_table_wrapper")?.classList.remove("hidden");
			if (!reLoad) {
				this.header_element?.classList.remove("hidden");
				this.footer_element?.classList.remove("hidden");
			}
		}
	}
	showSkeletonLoader(reLoad = false) {
		const existingSkeleton = this.wrapper.querySelector("#skeleton-loader-overlay");
		if (existingSkeleton) {
			existingSkeleton.remove();
		}
		this.table_wrapper?.querySelector("div#sva_table_wrapper")?.classList.add("hidden");
		if (!reLoad) {
			this.header_element?.classList.add("hidden");
			this.footer_element?.classList.add("hidden");
		}
		this.skeletonLoader = this.createSkeletonLoader(reLoad);
		if (!reLoad) {
			this.wrapper.appendChild(this.skeletonLoader);
		} else {
			this.table_wrapper.appendChild(this.skeletonLoader);
		}
	}
	async getUserWiseListSettings() {
		let res = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_user_list_settings",
			parent_id: this.connection.parent,
			child_dt: this.doctype || this.link_report,
		});
		return res.message;
	}
	async setupHeader() {
		let header_element = document.createElement("div");
		header_element.id = "header-element";
		header_element.classList.add("sva-header-element");

		header_element.style = `
			display: flex;
			flex-direction: column;
			gap: 5px;
			margin-bottom: 10px;
		`;
		this.header_element = header_element;

		// ===== TITLE ROW =====
		let title_row = document.createElement("div");
		title_row.id = "title-row";
		title_row.style = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
			padding-bottom: 5px;
			border-bottom: 1px solid var(--border-color)
		`;

		// Title/Label (left side)
		let label_wrapper = document.createElement("div");
		label_wrapper.id = "label-wrapper";
		label_wrapper.innerHTML = `<span id="dt-title" style="font-weight:bold;max-width:200px !important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.label ? this.label : " "
			}</span>`;

		// Actions container (right side)
		let title_actions = document.createElement("div");
		title_actions.id = "title-actions";
		title_actions.style = `
			display: flex;
			align-items: center;
			gap: 10px;
		`;

		// Refresh button
		let refresh_button = document.createElement("button");
		refresh_button.id = "refresh_button";
		refresh_button.classList.add("text-muted", "btn", "btn-default", "icon-btn");
		refresh_button.innerHTML = `
			<svg class="es-icon es-line icon-sm" style="" aria-hidden="true">
				<use class="" href="#es-line-reload"></use>
			</svg>
		`;
		refresh_button.onclick = () => {
			this.reloadTable(true);
		};

		// Action button with dropdown
		let action_button = document.createElement("div");
		action_button.id = "action_button";
		new DTAction({
			wrapper: action_button,
			dt: this,
		});

		// Add to title actions
		title_actions.appendChild(refresh_button);
		title_actions.appendChild(action_button);

		// Add to title row
		title_row.appendChild(label_wrapper);
		title_row.appendChild(title_actions);

		// ===== FILTER ROW =====
		let filter_row = document.createElement("div");
		filter_row.id = "filter-row";
		filter_row.style = `
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
			gap: 10px;
		`;

		// Standard filters (left side)
		let standard_filters_wrapper = document.createElement("div");
		standard_filters_wrapper.id = "standard_filters_wrapper";
		standard_filters_wrapper.style = `
			display: flex;
			align-items: center;
			gap: 10px;
			max-width: 70%;
		`;

		// Filter controls container (right side)
		let filter_controls = document.createElement("div");
		filter_controls.id = "filter-controls";
		filter_controls.style = `
			display: flex;
			align-items: center;
			gap: 10px;
		`;

		// Get report filters if needed
		let report_filters = [];
		if (this.connection.connection_type == "Report") {
			let { message } = await this.sva_db.call({
				method: "frappe_theme.dt_api.get_report_filters",
				doctype: this.link_report,
			});
			report_filters = message;
		}

		// List filter
		let list_filter = document.createElement("div");
		list_filter.id = "list_filter";
		list_filter.style = `
			display: flex;
			align-items: center;
		`;
		this.filter_area = new SVAFilterArea({
			wrapper: list_filter,
			doctype: this.doctype || this.link_report,
			dt_filter_fields: {
				sva_dt:
					this.connection.connection_type == "Report"
						? Object.assign(this, {
							columns: this.frm
								? report_filters.filter(
									(f) => f.options != this.frm?.doc?.doctype
								)
								: report_filters,
						})
						: this,
				header:
					this.connection.connection_type == "Report"
						? report_filters.map((field) => field.fieldname)
						: this.header.map((field) => field.fieldname)
			},
			on_change: (filters) => {
				if (filters.length == 0) {
					if (this.additional_list_filters.length) {
						this.additional_list_filters = [];
						this.reloadTable(true);
					}
				} else {
					this.additional_list_filters = filters;
					this.reloadTable(true);
				}
			},
		});

		// Sort selector
		let sva_sort_selector = document.createElement("div");
		sva_sort_selector.id = "sva_sort_selector";
		if (this.connection.connection_type != "Report") {
			this.sort_selector = new SVASortSelector({
				parent: $(sva_sort_selector),
				doctype: this.doctype,
				sorting_fields: this.header,
				args: {
					sort_by: this.sort_by,
					sort_order: this.sort_order,
				},
				onchange: (sort_by, sort_order) => {
					if (this.sort_by != sort_by || this.sort_order != sort_order) {
						this.sort_by = sort_by || "modified";
						this.sort_order = sort_order || "desc";
						this.reloadTable(true);
					}
				},
			});
		}

		// Add to filter controls
		filter_controls.appendChild(list_filter);
		filter_controls.appendChild(sva_sort_selector);

		// Add to filter row
		filter_row.appendChild(standard_filters_wrapper);
		filter_row.appendChild(filter_controls);

		// Add both rows to header element
		header_element.appendChild(title_row);
		header_element.appendChild(filter_row);

		return header_element;
	}
	async setupWrapper(wrapper) {
		wrapper.style = `max-width:${this.options?.style?.width || "100%"}; width:${this.options?.style?.width || "100%"
			};margin:0px !important;`;
		if (!wrapper.querySelector("div#header-element")) {
			wrapper.appendChild(await this.setupHeader());
		}
		return wrapper;
	}
	createSettingsButton() {
		let list_view_settings = document.createElement("button");
		list_view_settings.id = "list_view_settings";
		list_view_settings.classList.add("btn", "btn-secondary", "btn-sm");
		list_view_settings.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="color: ${this.user_has_list_settings
				? frappe.boot?.my_theme?.button_background_color || "#2196F3"
				: "currentColor"
			}">
            <path fill="none" stroke="currentColor" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>`;
		list_view_settings.onclick = async () => {
			list_view_settings.disabled = true;
			await this.setupListviewSettings();
			list_view_settings.disabled = false;
		};
		return list_view_settings;
	}
	async setupListviewSettings() {
		let dtmeta = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			doctype: this.doctype || this.link_report,
			_type: this.connection.connection_type,
		});
		new SVAListSettings({
			doctype: this.doctype || this.link_report,
			meta: dtmeta.message,
			connection_type: this.connection.connection_type,
			settings: { ...this.connection, listview_settings: JSON.stringify(this.header) },
			sva_dt: this,
			dialog_primary_action: async (listview_settings, reset = false) => {
				try {
					if (!reset) {
						if (frappe.session.user == "Administrator") {
							await this.sva_db.call({
								method: "frappe.client.set_value",
								doctype: this.connection.doctype,
								name: this.connection.name,
								fieldname: "listview_settings",
								value: JSON.stringify(listview_settings ?? []),
							});
						} else {
							await this.sva_db.call({
								method: "frappe_theme.dt_api.setup_user_list_settings",
								parent_id: this.connection.parent,
								child_dt: this.doctype || this.link_report,
								listview_settings: JSON.stringify(listview_settings ?? []),
							});
							this.user_has_list_settings = true;
						}
					} else {
						await this.sva_db.call({
							method: "frappe_theme.dt_api.delete_user_list_settings",
							parent_id: this.connection.parent,
							child_dt: this.doctype,
						});
						this.user_has_list_settings = false;
					}
					frappe.show_alert({
						message: __("Listview settings updated"),
						indicator: "success",
					});
				} catch (error) {
					console.error("Error in setupListviewSettings", error);
				} finally {
					this.header = listview_settings;
					if (window.sva_datatable_configuration?.[this.connection.parent]) {
						let target = window.sva_datatable_configuration?.[
							this.connection.parent
						]?.child_doctypes.find((item) => item.name == this.connection.name);
						let target_child = window.sva_datatable_configuration?.[
							this.connection.parent
						]?.child_confs.find((item) => item.name == this.connection.name);
						if (target) {
							target.listview_settings = JSON.stringify(listview_settings ?? []);
						} else if (target_child) {
							target_child.listview_settings = JSON.stringify(
								listview_settings ?? []
							);
						}
					}
					this.reloadTable(true);
				}
			},
		});
	}
	setupTableWrapper(tableWrapper) {
		tableWrapper.style = `
            max-width: ${this.options?.style?.width || "100%"};
            width: ${this.options?.style?.width || "100%"};
            height: auto;
            margin-bottom: 10px;
            margin-top: 0px;
            margin-left: 0px;
            margin-right: 0px;
            padding: 0;
            box-sizing: border-box;
            border-spacing: none;
        `;

		// Add CSS to overwrite Bootstrap's table styles
		const style = document.createElement("style");
		style.innerHTML = `
            .table-bordered thead th,
            .table-bordered thead td {
                border-bottom-width: 2px;
                padding-top: 0px !important;
                padding-bottom: 0px !important;
                vertical-align: middle;
                min-height: 32px !important;
                height: 32px;
                max-height: 32px !important;
            }
            .table th,
            .table td {
                padding: 0px 8px !important;
                vertical-align: middle;
            }
        `;
		if (!tableWrapper.querySelector("style")) {
			tableWrapper.appendChild(style);
		}
		return tableWrapper;
	}

	async setupFooter(wrapper) {
		let footer = document.createElement("div");
		footer.id = "footer-element";
		footer.style = "display:flex;width:100%;height:fit-content;justify-content:space-between;";
		this.footer_element = footer;
		if (!wrapper.querySelector("div#footer-element")) {
			wrapper.appendChild(footer);
		}
		let buttonContainer = document.createElement("div");
		buttonContainer.id = "create-button-container";
		if (
			!wrapper
				.querySelector("div#footer-element")
				.querySelector("div#create-button-container")
		) {
			wrapper.querySelector("div#footer-element").appendChild(buttonContainer);
		}

		if (
			this.crud.create &&
			(this.frm ? this.frm?.doc?.docstatus == 0 : true) &&
			this.conf_perms.length &&
			this.conf_perms.includes("create")
		) {
			if (this.permissions?.length && this.permissions.includes("create")) {
				if (
					!wrapper
						.querySelector("div#footer-element")
						.querySelector("div#create-button-container")
						.querySelector("button#create")
				) {
					const create_button = document.createElement("button");
					create_button.id = "create";
					create_button.textContent = this.connection?.add_row_button_label || "Add row";
					create_button.classList.add("btn", "btn-secondary", "btn-sm");
					create_button.style =
						"width:fit-content;height:fit-content; margin-bottom:10px;";
					let add_row_handler = this.frm?.["dt_events"]?.[this.doctype]?.add_row_handler;
					if (!(add_row_handler && typeof add_row_handler === "function")) {
						add_row_handler = async () => {
							if (
								this.connection?.redirect_to_main_form ||
								this.connection?.connection_type === "Report"
							) {
								let params = {};
								if (this.connection?.connection_type === "Referenced") {
									params[this.connection.dt_reference_field] =
										this.frm?.doc.doctype;
									params[this.connection.dn_reference_field] =
										this.frm?.doc.name;
								} else if (this.connection?.connection_type === "Direct") {
									params[this.connection.link_fieldname] = this.frm?.doc.name;
								}
								let route = frappe.get_route();
								frappe
									.new_doc(this.doctype || this.connection.report_ref_dt, params)
									.then(() => {
										cur_frm["sva_dt_prev_route"] = route;
									});
							} else {
								await this.createFormDialog(this.doctype);
							}
						};
					}
					create_button.addEventListener("click", add_row_handler);
					wrapper
						.querySelector("div#footer-element")
						.querySelector("div#create-button-container")
						.appendChild(create_button);
				}
			}
		}
		if (this.total > this.limit) {
			if (
				!wrapper
					.querySelector("div#footer-element")
					?.querySelector("div#pagination-element")
			) {
				wrapper.querySelector("div#footer-element").appendChild(this.setupPagination());
			}
		}
	}
	setupPagination() {
		let pagination = document.createElement("div");
		pagination.id = "pagination-element";
		pagination.setAttribute("aria-label", "Page navigation");
		pagination.setAttribute("style", "font-size:12px !important;height:30px !important;");

		let paginationList = document.createElement("ul");
		paginationList.classList.add("pagination", "justify-content-center");

		// First button
		let firstBtnItem = document.createElement("li");
		firstBtnItem.id = "firstBtnItem";
		firstBtnItem.classList.add("page-item");
		let firstBtn = document.createElement("button");
		firstBtn.classList.add("page-link");
		firstBtn.textContent = "<<";
		firstBtn.addEventListener("click", async () => {
			if (this.page > 1) {
				this.page = 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		firstBtnItem.appendChild(firstBtn);
		paginationList.appendChild(firstBtnItem);

		// Previous button
		let prevBtnItem = document.createElement("li");
		prevBtnItem.id = "prevBtnItem";
		prevBtnItem.classList.add("page-item");
		let prevBtn = document.createElement("button");
		prevBtn.classList.add("page-link");
		prevBtn.textContent = "<";
		prevBtn.addEventListener("click", async () => {
			if (this.page > 1) {
				this.page -= 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		prevBtnItem.appendChild(prevBtn);
		paginationList.appendChild(prevBtnItem);

		// Page numbers container
		this.pageButtonsContainer = paginationList;
		this.updatePageButtons();

		// Next button
		let nextBtnItem = document.createElement("li");
		nextBtnItem.id = "nextBtnItem";
		nextBtnItem.classList.add("page-item");
		let nextBtn = document.createElement("button");
		nextBtn.classList.add("page-link");
		nextBtn.textContent = ">";
		nextBtn.addEventListener("click", async () => {
			if (this.page < Math.ceil(this.total / this.limit)) {
				this.page += 1;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		nextBtnItem.appendChild(nextBtn);
		paginationList.appendChild(nextBtnItem);

		// Last button
		let lastBtnItem = document.createElement("li");
		lastBtnItem.id = "lastBtnItem";
		lastBtnItem.classList.add("page-item");
		let lastBtn = document.createElement("button");
		lastBtn.classList.add("page-link");
		lastBtn.textContent = ">>";
		lastBtn.addEventListener("click", async () => {
			let lastPage = Math.ceil(this.total / this.limit);
			if (this.page < lastPage) {
				this.page = lastPage;
				this.rows = await this.getDocList();
				this.updateTableBody();
				this.updatePageButtons();
			}
		});
		lastBtnItem.appendChild(lastBtn);
		paginationList.appendChild(lastBtnItem);

		pagination.appendChild(paginationList);
		return pagination;
	}

	updatePageButtons() {
		// Clear existing page buttons (except first, prev, next, last)
		this.pageButtonsContainer
			.querySelectorAll(
				".page-item:not(#firstBtnItem):not(#prevBtnItem):not(#nextBtnItem):not(#lastBtnItem)"
			)
			.forEach((el) => el.remove());

		// Update button states
		let totalPages = Math.ceil(this.total / this.limit);

		// First button state
		if (this.page === 1) {
			this.pageButtonsContainer.querySelector("#firstBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#firstBtnItem")?.classList.remove("disabled");
		}

		// Previous button state
		if (this.page === 1) {
			this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.remove("disabled");
		}

		// Next button state
		if (this.page === totalPages) {
			this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.remove("disabled");
		}

		// Last button state
		if (this.page === totalPages) {
			this.pageButtonsContainer.querySelector("#lastBtnItem")?.classList.add("disabled");
		} else {
			this.pageButtonsContainer.querySelector("#lastBtnItem")?.classList.remove("disabled");
		}

		let currentPage = this.page;
		let pagesToShow = [];

		// Always show first page
		pagesToShow.push(1);

		// Calculate range around current page
		let startPage = Math.max(2, currentPage - 1);
		let endPage = Math.min(totalPages - 1, currentPage + 1);

		// Add pages around current page
		if (startPage > 2) {
			pagesToShow.push("...");
		}
		for (let i = startPage; i <= endPage; i++) {
			pagesToShow.push(i);
		}
		if (endPage < totalPages - 1) {
			pagesToShow.push("...");
		}

		// Always show last page if there is more than one page
		if (totalPages > 1) {
			pagesToShow.push(totalPages);
		}

		// Create page buttons
		pagesToShow.forEach((pageNum) => {
			let pageItem = document.createElement("li");
			pageItem.classList.add("page-item");

			if (pageNum === "...") {
				pageItem.classList.add("disabled");
				let ellipsis = document.createElement("span");
				ellipsis.classList.add("page-link");
				ellipsis.textContent = "...";
				pageItem.appendChild(ellipsis);
			} else {
				if (pageNum === currentPage) {
					pageItem.classList.add("active");
				}
				let pageBtn = document.createElement("button");
				pageBtn.classList.add("page-link");
				pageBtn.textContent = pageNum;
				pageBtn.addEventListener("click", async () => {
					if (pageNum !== currentPage) {
						this.page = pageNum;
						this.rows = await this.getDocList();
						this.updateTableBody();
						this.updatePageButtons();
					}
				});
				pageItem.appendChild(pageBtn);
			}

			// Insert before the Next button
			this.pageButtonsContainer.insertBefore(
				pageItem,
				this.pageButtonsContainer.querySelector("#nextBtnItem")
			);
		});
	}
	get_permissions(doctype) {
		if (this.connection.connection_type === "Report") {
			return this.conf_perms ? this.conf_perms : ["read"];
		} else {
			return new Promise((rslv, rjct) => {
				frappe.call({
					method: "frappe_theme.api.get_permissions",
					args: { doctype: doctype, _type: this.connection.connection_type },
					callback: function (response) {
						rslv(response.message);
					},
					error: (err) => {
						rjct(err);
					},
				});
			});
		}
	}
	isAsync = (fn) => fn?.constructor?.name === "AsyncFunction";
	async createFormDialog(doctype, name = undefined, mode = "create", additional_action = null) {
		let res = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_meta_fields",
			doctype: this.doctype,
		});
		let fields = res?.message;
		if (window?.SVADialog?.[this.doctype]) {
			window?.SVADialog?.[this.doctype](mode, fields);
			return;
		}
		if (window?.SVAHandleParentFieldProps) {
			let f = window?.SVAHandleParentFieldProps(fields, doctype, name, mode);
			if (f) {
				fields = [...f];
			}
		}
		if (mode === "create" || mode === "write") {
			if (name) {
				let doc = await this.sva_db.get_doc(doctype, name);
				for (const f of fields) {
					f.default = "";
					if (f.hidden === "0") {
						f.hidden = 0;
					}
					f.onchange = this.onFieldValueChange?.bind(this);
					if (this.frm?.["dt_events"]?.[this.doctype]?.[f.fieldname]) {
						let change = this.frm["dt_events"][this.doctype][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f);
						} else {
							f.onchange = change.bind(this, this, mode, f);
						}
					}
					if (f.set_only_once) {
						if (doc[f.fieldname]) {
							f.default = doc[f.fieldname];
							f.read_only = 1;
						} else {
							f.reqd = 0;
							f.hidden = 1;
						}
					}
					if (f.fieldtype === "Table") {
						let res = await this.sva_db.call({
							method: "frappe_theme.dt_api.get_meta_fields",
							doctype: f.options,
						});
						let tableFields = res?.message;
						for (let tf of tableFields) {
							if (tf.fieldtype === "Link") {
								tf.get_query = () => {
									const filters = [];
									if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
										filters.push(
											...this.frm["dt_filters"][f.options][tf.fieldname]
										);
									}
									if (tf.link_filter) {
										const [parentfield, filter_key] =
											tf.link_filter.split("->");
										filters.push([
											tf.options,
											filter_key,
											"=",
											dialog.fields_dict[parentfield]?.value ||
											`Please select ${parentfield}`,
										]);
									}
									return { filters };
								};
							}
							if (this.frm?.["dt_events"]?.[f.options]?.[tf.fieldname]) {
								let change = this.frm["dt_events"][f.options][tf.fieldname];
								tf.onchange = change.bind(this, this, mode, tf);
							}
						}
						f.fields = tableFields;
						if (doc[f.fieldname].length) {
							f.data = doc[f.fieldname].map((row) => {
								let old_name = row.name;
								delete row.name;
								return { ...row, old_name };
							});
						}
					}
					if (["Attach", "Attach Image"].includes(f.fieldtype)) {
						if (f.read_only) {
							if (doc[f.fieldname]) {
								f.fieldtype = "HTML";
								f.options = `
                                    <div class="form-group horizontal">
                                        <div class="clearfix">
                                            <label class="control-label" style="padding-right: 0px;">${f.label
									}</label>
                                            <span class="help"></span>
                                        </div>
                                        <div class="control-input-wrapper">
                                        <div class="control-input" style="display: none;"></div>
                                        <div class="control-value like-disabled-input ellipsis">
                                            <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                                                <use class="" href="#es-line-link"></use>
                                            </svg>
                                                <a href="${doc[f.fieldname]}" target="_blank">${doc[f.fieldname]
									}</a>
                                            </div>
                                            <div class="help-box small text-extra-muted hide"></div>
                                        </div>
                                    </div>
                                `;
							} else {
								f.default = "";
								f.hidden = 1;
							}
						} else if (f.hidden) {
							f.fieldtype = "Data";
						} else if (doc[f.fieldname]) {
							f.default = doc[f.fieldname];
						}
						continue;
					}
					if (doc[f.fieldname]) {
						f.default = doc[f.fieldname];
					}
					if (f?.fetch_from) {
						if (!f.default) {
							let fetch_from = f.fetch_from.split(".");
							let [parentfield, fieldname] = fetch_from;
							let parentf = fields.find((f) => f.fieldname === parentfield);
							if (parentf?.options && parentf?.default) {
								let doc = await this.sva_db.get_doc(
									parentf?.options,
									parentf?.default
								);
								f.default = doc[fieldname];
							}
						}
						f.read_only = 1;
					}
					if (f.fieldtype === "Link") {
						f.get_query = () => {
							const filters = [];
							if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
								filters.push(...this.frm["dt_filters"][f.options][tf.fieldname]);
							}
							if (this.uniqueness.column.length) {
								if (this.uniqueness.column.includes(f.fieldname)) {
									let existing_options = this.rows?.map(
										(item) => item[f.fieldname]
									);
									filters.push([f.options, "name", "not in", existing_options]);
								}
							}
							if (f.link_filter) {
								const [parentfield, filter_key] = f.link_filter.split("->");
								filters.push([
									f.options,
									filter_key,
									"=",
									dialog.fields_dict[parentfield]?.value ||
									`Please select ${parentfield}`,
								]);
							}
							return { filters };
						};
					}
					if (
						!["Check", "Button", "Table", "Table MultiSelect"].includes(f.fieldtype) &&
						f.read_only &&
						!doc[f.fieldname]
					) {
						if (!f.depends_on) {
							f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
						} else {
							f.hidden = 1;
						}
						continue;
					}
				}
			} else {
				for (const f of fields) {
					f.onchange = this.onFieldValueChange?.bind(this);
					if (f.hidden === "0") {
						f.hidden = 0;
					}
					if (["Attach", "Attach Image"].includes(f.fieldtype)) {
						if (f.hidden) {
							f.fieldtype = "Data";
							f.hidden = 1;
							continue;
						}
					}
					if (this.frm?.["dt_events"]?.[this.doctype]?.[f.fieldname]) {
						let change = this.frm["dt_events"][this.doctype][f.fieldname];
						if (f.fieldtype === "Button") {
							f.click = change.bind(this, this, mode, f);
						} else {
							f.onchange = change.bind(this, this, mode, f);
						}
					}
					if (this.frm?.parentRow) {
						if (this.frm?.parentRow[f.fieldname]) {
							if (f.fieldname == "workflow_state") {
								continue;
							}
							f.default = this.frm?.parentRow[f.fieldname];
							f.read_only = 1;
						}
					}
					if (this.frm?.doctype === f.options) {
						f.default = this.frm?.doc.name;
						f.read_only = 1;
					}
					if (this.connection?.connection_type === "Referenced") {
						if (f.fieldname === this.connection.dt_reference_field) {
							f.default = this.frm?.doc.doctype;
							f.read_only = 1;
						}
						if (f.fieldname === this.connection.dn_reference_field) {
							f.default = this.frm?.doc.name;
							f.read_only = 1;
						}
					}
					if (this.connection?.connection_type === "Direct") {
						if (f.fieldname === this.connection.link_fieldname) {
							f.default = this.frm?.doc.name;
							f.read_only = 1;
						}
					}

					if (f.fieldtype === "Link") {
						f.get_query = () => {
							const filters = [];
							if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
								filters.push(...this.frm["dt_filters"][f.options][tf.fieldname]);
							}
							if (this.uniqueness.column.length) {
								if (this.uniqueness.column.includes(f.fieldname)) {
									let existing_options = this.rows?.map(
										(item) => item[f.fieldname]
									);
									filters.push([f.options, "name", "not in", existing_options]);
								}
							}
							if (f.link_filter) {
								const [parentfield, filter_key] = f.link_filter.split("->");
								filters.push([
									f.options,
									filter_key,
									"=",
									dialog.fields_dict[parentfield]?.value ||
									`Please select ${parentfield}`,
								]);
							}
							return { filters };
						};
					}
					if (f.fieldtype === "Table") {
						let res = await this.sva_db.call({
							method: "frappe_theme.dt_api.get_meta_fields",
							doctype: f.options,
						});
						let tableFields = res?.message;
						for (let tf of tableFields) {
							if (tf.fieldtype === "Link") {
								tf.get_query = () => {
									const filters = [];
									if (this.frm?.["dt_filters"]?.[f.options]?.[tf.fieldname]) {
										filters.push(
											...this.frm["dt_filters"][f.options][tf.fieldname]
										);
									}
									if (tf.link_filter) {
										const [parentfield, filter_key] =
											tf.link_filter.split("->");
										filters.push([
											tf.options,
											filter_key,
											"=",
											dialog.fields_dict[parentfield]?.value ||
											`Please select ${parentfield}`,
										]);
									}
									return { filters };
								};
							}
							if (this.frm?.["dt_events"]?.[f.options]?.[tf.fieldname]) {
								let change = this.frm["dt_events"][f.options][tf.fieldname];
								tf.onchange = change.bind(this, this, mode, tf);
							}
						}
						f.fields = tableFields;
						continue;
					}
					if (f?.fetch_from) {
						let fetch_from = f.fetch_from.split(".");
						let [parentfield, fieldname] = fetch_from;
						let parentf = fields.find((f) => f.fieldname === parentfield);
						if (parentf?.options && parentf?.default) {
							let doc = await this.sva_db.get_doc(
								parentf?.options,
								parentf?.default
							);
							f.default = doc[fieldname];
						}
						f.read_only = 1;
					}
					if (
						!["Check", "Button", "Table", "Table MultiSelect"].includes(f.fieldtype) &&
						f.read_only &&
						!f.default
					) {
						if (!f.depends_on) {
							f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
						} else {
							f.hidden = 1;
						}
						continue;
					}
				}
			}
		} else {
			let doc = await this.sva_db.get_doc(doctype, name);
			for (const f of fields) {
				if (f.fieldtype === "Table MultiSelect") {
					continue;
				}
				if (f.hidden === "0") {
					f.hidden = 0;
				}

				if (f.fieldtype === "Table") {
					let res = await this.sva_db.call({
						method: "frappe_theme.dt_api.get_meta_fields",
						doctype: f.options,
					});
					let tableFields = res?.message;
					f.fields = tableFields.map((f) => {
						return { ...f, read_only: 1 };
					});
					f.cannot_add_rows = 1;
					f.cannot_delete_rows = 1;
					if (doc[f.fieldname].length) {
						f.data = doc[f.fieldname];
					}
					continue;
				}
				if (["Attach", "Attach Image"].includes(f.fieldtype)) {
					if (doc[f.fieldname]) {
						f.fieldtype = "HTML";
						f.options = `
                            <div class="form-group horizontal">
                                <div class="clearfix">
                                    <label class="control-label" style="padding-right: 0px;">${f.label
							}</label>
                                    <span class="help"></span>
                                </div>
                                <div class="control-input-wrapper">
                                <div class="control-input" style="display: none;"></div>
                                <div class="control-value like-disabled-input ellipsis">
                                    <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                                        <use class="" href="#es-line-link"></use>
                                    </svg>
                                        <a href="${doc[f.fieldname]}" target="_blank">${doc[f.fieldname]
							}</a>
                                    </div>
                                    <div class="help-box small text-extra-muted hide"></div>
                                </div>
                            </div>
                        `;
					} else {
						f.hidden = 1;
					}
					continue;
				}
				if (
					!["Check", "Button", "Table", "Table MultiSelect"].includes(f.fieldtype) &&
					f.read_only &&
					!doc[f.fieldname]
				) {
					if (!f.depends_on) {
						f.depends_on = `eval:(doc?.${f.fieldname} != null || doc?.${f.fieldname} != undefined)`;
					} else {
						f.hidden = 1;
					}
					continue;
				}
				if (doc[f.fieldname]) {
					f.default = doc[f.fieldname];
					f.read_only = 1;
				} else {
					f.default = "";
					f.read_only = 1;
				}
			}
		}
		const dialog = new frappe.ui.Dialog({
			title: __(
				`${mode == "view" ? "View" : mode == "create" ? "Create" : "Update"} ${__(
					this.connection?.title || doctype
				)}`
			),
			size: this.getDialogSize(fields), // Available sizes: 'small', 'medium', 'large', 'extra-large'
			fields: fields || [],
			primary_action_label: name ? "Update" : "Create",
			primary_action: async (values) => {
				if (["create", "write"].includes(mode)) {
					if (this.frm?.["dt_events"]?.[this.doctype]?.["validate"]) {
						let change = this.frm["dt_events"][this.doctype]["validate"];
						let has_aditional_action = additional_action ? true : false;
						if (this.isAsync(change)) {
							await change(this, mode, values, has_aditional_action);
							values = dialog.get_values(true, false);
						} else {
							change(this, mode, values, has_aditional_action);
							values = dialog.get_values(true, false);
						}
					}
					if (!name) {
						let response = await frappe.xcall("frappe.client.insert", {
							doc: {
								doctype: doctype,
								...values,
							},
						});
						if (response) {
							if (this.rows.length == this.limit) {
								this.rows.pop();
							}
							this.rows = [response, ...this.rows];
							// this.rows.push(response);
							this.updateTableBody();
							frappe.show_alert({
								message: `Successfully created ${__(
									this.connection?.title || doctype
								)}`,
								indicator: "success",
							});
							if (this.frm?.["dt_events"]?.[this.doctype]?.["after_insert"]) {
								let change = this.frm["dt_events"][this.doctype]["after_insert"];
								if (this.isAsync(change)) {
									await change(this, response);
								} else {
									change(this, response);
								}
							}
						}
					} else {
						let value_fields = fields.filter(
							(f) =>
								![
									"Section Break",
									"Column Break",
									"HTML",
									"Button",
									"Tab Break",
								].includes(f.fieldtype)
						);
						let updated_values = {};
						for (let field of value_fields) {
							let key = field.fieldname;
							if (Array.isArray(values[key])) {
								updated_values[key] = values[key].map((item) => {
									if (item.old_name) {
										return { ...item, name: item.old_name };
									}
									return item;
								});
							} else {
								updated_values[key] = values[key] || "";
							}
						}
						let response = await frappe.xcall("frappe.client.set_value", {
							doctype: doctype,
							name,
							fieldname: updated_values,
						});
						if (response) {
							let rowIndex = this.rows.findIndex((r) => r.name === name);
							this.rows[rowIndex] = response;
							this.updateTableBody();
							frappe.show_alert({
								message: `Successfully updated ${__(
									this.connection?.title || doctype
								)}`,
								indicator: "success",
							});
							if (this.frm?.["dt_events"]?.[this.doctype]?.["after_update"]) {
								let change = this.frm["dt_events"][this.doctype]["after_update"];
								if (this.isAsync(change)) {
									await change(this, response);
								} else {
									change(this, response);
								}
							}
						}
					}
					if (this.frm?.["dt_events"]?.[this.doctype]?.["after_save"]) {
						let change = this.frm["dt_events"][this.doctype]["after_save"];
						if (this.isAsync(change)) {
							await change(this, mode, values);
						} else {
							change(this, mode, values);
						}
					}
				}
				if (additional_action) {
					additional_action(true);
				}
				dialog.clear();
				dialog.hide();
			},
			secondary_action_label: ["create", "write"].includes(mode) ? "Cancel" : "Close",
			secondary_action: () => {
				if (additional_action) {
					additional_action(false);
				}
				if (mode != "view") {
					dialog.clear();
				}
				dialog.hide();
			},
		});
		if (["create", "write"].includes(mode)) {
			dialog.get_primary_btn().show();
		} else {
			dialog.get_primary_btn().hide();
		}
		this.form_dialog = dialog;
		if (this?.connection?.full_screen_dialog) {
			frappe.utils.make_dialog_fullscreen(dialog);
		}
		dialog.show();
		for (let [fieldname, field] of Object.entries(dialog.fields_dict)?.filter(
			([fieldname, field]) => field.df.fieldtype == "Date"
		)) {
			if (field?.df?.min_max_depends_on) {
				let splitted = field.df.min_max_depends_on.split("->");
				let fn = splitted[0].split(".")[0];
				let doctype = splitted[0].split(".")[1];
				let min_field = splitted[1];
				let max_field = splitted[2] ? splitted[2] : "";
				if (dialog.get_value(fieldname)) {
					if (this.sva_db.exists(doctype, dialog.get_value(fn))) {
						let doc = await this.sva_db.get_doc(doctype, dialog.get_value(fn));
						let option = {};
						if (min_field && doc[min_field]) {
							option["minDate"] = new Date(doc[min_field]);
						}
						if (max_field && doc[max_field]) {
							option["maxDate"] = new Date(doc[max_field]);
						}
						dialog.fields_dict[fieldname].$input.datepicker(option);
					}
				}
			}
		}
		if (this.frm?.["dt_events"]?.[this.doctype]?.["after_render"]) {
			let change = this.frm["dt_events"][this.doctype]["after_render"];
			let has_aditional_action = additional_action ? true : false;
			if (this.isAsync(change)) {
				await change(this, mode, has_aditional_action);
			} else {
				change(this, mode, has_aditional_action);
			}
		}
	}
	async deleteRecord(doctype, name) {
		frappe.confirm(
			`Are you sure you want to delete this ${__(this.connection?.title || doctype)}?`,
			async () => {
				await frappe.xcall("frappe.client.delete", { doctype, name });
				let rowIndex = this.rows.findIndex((r) => r.name === name);
				this.rows.splice(rowIndex, 1);
				this.updateTableBody();
				frappe.show_alert({
					message: `Successfully deleted ${__(this.connection?.title || doctype)}`,
					indicator: "success",
				});
				if (this.frm?.["dt_events"]?.[this.doctype]?.["after_delete"]) {
					let change = this.frm["dt_events"][this.doctype]["after_delete"];
					if (this.isAsync(change)) {
						await change(this, name);
					} else {
						change(this, name);
					}
				}
			}
		);
	}
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
		return el;
	}

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
			serialTh.textContent = __("#");
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
				th.style = `min-width:${Number(col?.width) * 50}px !important;max-width:${Number(col?.width) * 50
					}px !important;width:${Number(col?.width) * 50
					}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
			}
			th.textContent = __(column.label || column.name);

			if (column.sortable) {
				this.createSortingIcon(th, column); // Create the sorting dropdown
				if (col?.width) {
					th.style = `min-width:${Number(col?.width) * 50}px !important;max-width:${Number(col?.width) * 50
						}px !important;width:${Number(col?.width) * 50
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
					th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${column.sortable ? "pointer" : "default"
						};min-width:${Number(col?.width) * 50}px !important;max-width:${Number(col?.width) * 50
						}px !important;width:${Number(col?.width) * 50
						}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
				} else {
					th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${column.sortable ? "pointer" : "default"
						}`;
				}
				left += column.width;
				freezeColumnsAtLeft++;
			}

			tr.appendChild(th);
		});
		// ========================= Workflow Logic ======================
		if (!this.connection?.disable_workflow) {
			if (this.workflow && (this.wf_editable_allowed || this.wf_transitions_allowed)) {
				const addColumn = document.createElement("th");
				addColumn.textContent = this.connection.action_label
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
		tr.appendChild(action_th);
		// ========================= Action Column End ======================
		thead.appendChild(tr);
		return thead;
	}

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
	}
	createActionColumn(row, primaryKey) {
		const dropdown = document.createElement("div");
		dropdown.classList.add("dropdown");

		const dropdownBtn = document.createElement("span");
		dropdownBtn.classList.add("h4");
		dropdownBtn.innerHTML = "&#8942;";
		if (this.connection.connection_type != "Report") {
			dropdownBtn.style.cursor = "pointer";
			dropdownBtn.setAttribute("data-toggle", "dropdown");
		} else {
			dropdownBtn.style.cursor = "not-allowed";
			dropdownBtn.setAttribute("disabled", "disabled");
			dropdownBtn.setAttribute("title", "This action is not allowed for reports");
		}

		const dropdownMenu = document.createElement("div");
		dropdownMenu.classList.add("dropdown-menu");
		dropdownMenu.style.position = "fixed";
		dropdownMenu.style.zIndex = "9999";
		dropdownMenu.style.display = "none";

		const appendDropdownOption = (text, onClickHandler) => {
			const option = document.createElement("a");
			option.classList.add("dropdown-item");
			option.innerHTML = text;
			option.addEventListener("click", onClickHandler);
			dropdownMenu.appendChild(option);
		};

		// View Button
		if (
			this.crud.read &&
			this.conf_perms.length &&
			this.permissions.length &&
			this.permissions.includes("read")
		) {
			appendDropdownOption(`${frappe.utils.icon("view", "sm")} View`, async () => {
				if (this.connection?.redirect_to_main_form) {
					let route = frappe.get_route();
					frappe.set_route("Form", this.doctype, primaryKey).then(() => {
						cur_frm.add_custom_button("Back", () => {
							frappe.set_route(route);
						});
					});
				} else {
					await this.createFormDialog(this.doctype, primaryKey, "view");
				}
			});
		}

		// Edit and Delete Buttons
		if (
			!["1", "2"].includes(row.docstatus) &&
			(this.frm ? this.frm?.doc?.docstatus == 0 : true)
		) {
			let wf_editable_roles = this?.workflow?.states
				?.filter((s) => s.state == row[this?.workflow?.workflow_state_field])
				?.map((s) => s.allow_edit);
			let wf_editable = this.workflow
				? wf_editable_roles?.some((role) => frappe.user_roles.includes(role))
				: true;
			let is_editable = this.connection?.disable_edit_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_edit_depends_on, row)
				: true;
			if (
				this.crud.write &&
				wf_editable &&
				this.permissions.includes("write") &&
				this.conf_perms.includes("write") &&
				is_editable
			) {
				if (
					(this.wf_positive_closure || this.wf_negative_closure) &&
					row["workflow_state"]
				) {
					if (
						![this.wf_positive_closure, this.wf_negative_closure].includes(
							row["workflow_state"]
						)
					) {
						appendDropdownOption(
							`${frappe.utils.icon("edit", "sm")} Edit`,
							async () => {
								if (this.connection?.redirect_to_main_form) {
									let route = frappe.get_route();
									frappe.set_route("Form", this.doctype, primaryKey).then(() => {
										cur_frm["sva_dt_prev_route"] = route;
									});
								} else {
									await this.createFormDialog(this.doctype, primaryKey, "write");
								}
							}
						);
					}
				} else {
					appendDropdownOption(`${frappe.utils.icon("edit", "sm")} Edit`, async () => {
						if (this.connection?.redirect_to_main_form) {
							let route = frappe.get_route();
							frappe.set_route("Form", this.doctype, primaryKey).then(() => {
								cur_frm["sva_dt_prev_route"] = route;
							});
						} else {
							await this.createFormDialog(this.doctype, primaryKey, "write");
						}
					});
				}
			}
			let is_deletable = this.connection?.disable_delete_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_delete_depends_on, row)
				: true;
			if (
				this.crud.delete &&
				wf_editable &&
				this.permissions.includes("delete") &&
				this.conf_perms.includes("delete") &&
				is_deletable
			) {
				if (
					(this.wf_positive_closure || this.wf_negative_closure) &&
					row["workflow_state"]
				) {
					if (
						![this.wf_positive_closure, this.wf_negative_closure].includes(
							row["workflow_state"]
						)
					) {
						appendDropdownOption(
							`${frappe.utils.icon("delete", "sm")} Delete`,
							async () => {
								await this.deleteRecord(this.doctype, primaryKey);
							}
						);
					}
				} else {
					appendDropdownOption(
						`${frappe.utils.icon("delete", "sm")} Delete`,
						async () => {
							await this.deleteRecord(this.doctype, primaryKey);
						}
					);
				}
			}
		}
		// ========================= Print Button ======================
		if (this.permissions.includes("print")) {
			appendDropdownOption(`${frappe.utils.icon("printer", "sm")} Print`, () => {
				frappe.utils.print(
					this.doctype,
					primaryKey,
					this.meta?.default_print_format || "Standard",
					"No Letterhead",
					frappe.boot?.lang || "en"
				);
			});
		}

		// Child Links
		if (this.childLinks?.length) {
			this.childLinks.forEach(async (link) => {
				appendDropdownOption(
					`${frappe.utils.icon("external-link", "sm")} ${link?.title || link.link_doctype
					}`,
					async () => {
						await this.childTableDialog(link.link_doctype, primaryKey, row, link);
					}
				);
			});
		}

		dropdown.appendChild(dropdownBtn);
		if (this.connection.connection_type != "Report") {
			document.body.appendChild(dropdownMenu);
		}

		const toggleDropdown = (event) => {
			event.stopPropagation();
			const rect = dropdownBtn.getBoundingClientRect();
			const dropdownWidth = dropdownMenu.offsetWidth || 150; // Default width in case offsetWidth is 0
			dropdownMenu.style.top = `${rect.bottom}px`;
			dropdownMenu.style.left = `${rect.left - dropdownWidth}px`; // Adjust position for left-side popup
			dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "block" : "none";
		};

		dropdownBtn.addEventListener("click", toggleDropdown);

		// Close dropdown when clicking outside
		document.addEventListener("click", () => {
			dropdownMenu.style.display = "none";
		});

		return dropdown;
	}

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
					serialTd.style.minWidth = "40px";
					serialTd.style.textAlign = "center";
					serialTd.style.position = "sticky";
					serialTd.style.left = "0px";
					serialTd.style.backgroundColor = "#fff";

					const serialNumber =
						this.page > 1
							? (this.page - 1) * this.limit + (rowIndex + 1)
							: rowIndex + 1;

					serialTd.innerHTML = `<p style="cursor: pointer; text-decoration:underline;">${serialNumber}</p>`;
					serialTd.querySelector("p").addEventListener("click", () => {
						let route = frappe.get_route();
						frappe
							.set_route(
								"Form",
								this.connection.connection_type == "Report"
									? this.connection.report_ref_dt
									: this.doctype,
								row.name
							)
							.then(() => {
								cur_frm.add_custom_button("Back", () => {
									frappe.set_route(route);
								});
							});
					});

					tr.appendChild(serialTd);
				}

				let left = 0;
				let freezeColumnsAtLeft = 1;
				this.columns.forEach((column) => {
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
						this.createNonEditableField(td, column, row);
					}
					tr.appendChild(td);
				});

				// ========================= Workflow Logic ===================
				if (!this.connection?.disable_workflow) {
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
						const titleText = this.workflow.transitions
							.filter(
								(link) =>
									frappe.user_roles.includes(link.allowed) &&
									link.state === row[workflow_state_field]
							)
							.map((e) => `${e.action} by ${e.allowed}`)
							.join("\n");

						el.setAttribute("title", titleText);
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
							el.setAttribute("title", row[workflow_state_field]);
							el.innerHTML = `<option value="" style="color:black" selected disabled">${row[workflow_state_field]}</option>`;
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
							el.innerHTML =
								`<option value="" style="color:black" selected disabled class="ellipsis">${row[workflow_state_field]}</option>` +
								[...new Set(transitions?.map((e) => e.action))]
									?.map(
										(action) =>
											`<option value="${action}" style="background-color:white; color:black; cursor:pointer;" class="rounded p-1">${action}</option>`
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
											el.title = originalState;
										}
									}
									el.value = "";
									el.title = originalState;
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
					actionTd.style.minWidth = "50px";
					actionTd.style.textAlign = "center";
					actionTd.style.position = "sticky";
					actionTd.style.right = "0px";
					actionTd.style.backgroundColor = "#fff";
					actionTd.appendChild(this.createActionColumn(row, primaryKey));

					tr.appendChild(actionTd);
				}

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
	}

	// ================================ Workflow Action  Logic ================================
	async wf_action(selected_state_info, docname, wf_select_el, prevState, doc) {
		let me = this;
		let workflowFormValue;
		let firstAttempt = true;
		let wf_dialog_fields = JSON.parse(selected_state_info.custom_selected_fields || "[]");
		let dialog;
		if (this.frm?.["dt_events"]?.[this.doctype]?.["before_workflow_action"]) {
			let change = this.frm["dt_events"][this.doctype]["before_workflow_action"];
			if (this.isAsync(change)) {
				await change(me, selected_state_info, docname, prevState, doc);
			} else {
				change(me, selected_state_info, docname, prevState, doc);
			}
		}

		const bg = me.workflow_state_bg?.find(
			(bg) => bg.name === selected_state_info.next_state && bg?.style
		);
		let meta = await this.sva_db.call({
			method: "frappe_theme.api.get_meta",
			doctype: me.doctype,
		});
		let fields = [];
		if (wf_dialog_fields?.length) {
			fields = meta?.message?.fields
				.filter((field) => {
					return wf_dialog_fields.some((f) => f.fieldname == field.fieldname);
				})
				.map((field) => {
					let field_obj = wf_dialog_fields.find((f) => f.fieldname == field.fieldname);
					return {
						label: field.label,
						fieldname: field.fieldname,
						fieldtype: field.fieldtype,
						default: field_obj?.read_only && doc[field.fieldname],
						reqd: field_obj?.read_only ? 0 : field_obj?.reqd,
						read_only: field_obj?.read_only,
						options: field.options,
					};
				});
		} else {
			fields = meta?.message?.fields
				?.filter((field) => {
					return field?.wf_state_field == selected_state_info.action;
				})
				?.map((field) => {
					return {
						label: field.label,
						fieldname: field.fieldname,
						fieldtype: field.fieldtype,
						reqd: 1,
						mandatory_depends_on: field.mandatory_depends_on,
						depends_on: field.depends_on,
						options: field.options,
					};
				});
		}
		const popupFields = [
			{
				label: "Action Test",
				fieldname: "action_test",
				fieldtype: "HTML",
				options: `<p>Action:  <span style="padding: 4px 8px; border-radius: 100px; color:white;  font-size: 12px; font-weight: 400;" class="bg-${bg?.style?.toLowerCase() || "secondary"
					}">${selected_state_info.action}</span></p>`,
			},
			...(fields ? fields : []),
		];
		if (!this.skip_workflow_confirmation) {
			workflowFormValue = await new Promise(async (resolve, reject) => {
				dialog = new frappe.ui.Dialog({
					title: "Confirm",
					size: this.getDialogSize(popupFields),
					fields: popupFields,
					primary_action_label: "Proceed",
					primary_action: (values) => {
						if (firstAttempt) {
							resolve(values);
							firstAttempt = false;
						} else {
							take_action(values);
						}
					},
					secondary_action_label: "Cancel",
					secondary_action: () => {
						dialog.hide();
						reject(false);
						wf_select_el.value = ""; // Reset dropdown value
						wf_select_el.title = prevState;
						frappe.show_alert({
							message: `${selected_state_info.action} Action has been cancelled.`,
							indicator: "orange",
						});
					},
				});
				me["workflow_dialog"] = dialog;
				dialog.show();
				if (this.frm?.["dt_events"]?.[this.doctype]?.["after_workflow_dialog_render"]) {
					let change =
						this.frm["dt_events"][this.doctype]["after_workflow_dialog_render"];
					if (this.isAsync(change)) {
						await change(me, selected_state_info, docname, prevState);
					} else {
						change(me, selected_state_info, docname, prevState);
					}
				}
			});
		}
		async function take_action(values = undefined) {
			try {
				let skip_workflow_values = {};
				if (me?.skip_workflow_confirmation) {
					for (let field of popupFields) {
						skip_workflow_values[field.fieldname] =
							me.form_dialog.get_value(field.fieldname) ||
							me.form_dialog?.fields_dict?.[field.fieldname]?.last_value ||
							"";
					}
				}
				const updateFields = {
					...doc,
					...(values ? values : workflowFormValue && workflowFormValue),
					wf_dialog_fields: {
						...(me.skip_workflow_confirmation
							? skip_workflow_values
							: values
								? values
								: workflowFormValue && workflowFormValue),
					},
					doctype: me.doctype,
				};
				frappe
					.xcall("frappe.model.workflow.apply_workflow", {
						doc: updateFields,
						action: selected_state_info.action,
					})
					.then((doc) => {
						const row = me.rows.find((r) => r.name === docname);
						updateFields[me.workflow.workflow_state_field] =
							selected_state_info.next_state;
						Object.assign(row, updateFields);
						me.rows[row.rowIndex] = row;
						me.updateTableBody();
						if (!me.skip_workflow_confirmation) {
							frappe.show_alert({
								message: "Action completed successfully",
								indicator: "success",
							});
						}
						if (dialog) {
							dialog?.hide();
						}
					});
			} catch (error) {
				if (error.message) {
					frappe.throw({
						title: "Error",
						message: error.message,
					});
				}
			}
			if (me.frm?.["dt_events"]?.[me.doctype]?.["after_workflow_action"]) {
				let change = me.frm["dt_events"][me.doctype]["after_workflow_action"];
				if (me.isAsync(change)) {
					await change(me, selected_state_info, docname, prevState, doc);
				} else {
					change(me, selected_state_info, docname, prevState, doc);
				}
			}
		}
		take_action();
	}

	// ================================ Workflow Action End ================================
	async childTableDialog(doctype, primaryKeyValue, parentRow, link) {
		const dialog = new frappe.ui.Dialog({
			title: __(link?.title || doctype),
			size: "extra-large", // small, large, extra-large
			fields: [
				{
					fieldname: "table",
					fieldtype: "HTML",
					options: `<div id = "${doctype?.split(" ").length > 1
						? doctype?.split(" ")?.join("-")?.toLowerCase()
						: doctype.toLowerCase()
						}" ></div > `,
				},
			],
		});
		dialog.onhide = async function () {
			let updated_doc = await this.sva_db.get_doc(this.doctype, parentRow.name);
			let idx = this.rows.findIndex((r) => r.name === parentRow.name);
			this.rows[idx] = updated_doc;
			this.updateTableBody();
		}.bind(this);
		$(dialog.$wrapper).on("show.bs.modal", function () {
			$(this).removeAttr("aria-hidden");
		});
		$(dialog.$wrapper).on("hidden.bs.modal", function () {
			$(this).attr("aria-hidden", "true");
		});
		// let dialog_width = await frappe.db.get_single_value('My Theme', 'dialog_width');
		// $(dialog.$wrapper).find('.modal-dialog').css('max-width', dialog_width ?? '70%');
		if (link?.full_screen_dialog) {
			frappe.utils.make_dialog_fullscreen(dialog);
		}
		dialog.show();
		new SvaDataTable({
			wrapper: dialog.body.querySelector(
				`#${doctype?.split(" ").length > 1
					? doctype?.split(" ")?.join("-")?.toLowerCase()
					: doctype.toLowerCase()
				}`
			), // Wrapper element
			doctype: doctype,
			connection: link,
			frm: {
				doctype: this.doctype,
				doc: { name: primaryKeyValue, docstatus: parentRow.docstatus },
				parentRow,
				dt_events: this.frm?.dt_events,
			},
			options: {
				serialNumberColumn: true,
				editable: false,
			},
		});
	}
	sortByColumn(column, direction, updateTable = true) {
		const columnName = column.fieldname || column;
		let sorted_rows = this.rows.sort((a, b) => {
			const valueA = a[columnName];
			const valueB = b[columnName];
			if (valueA === valueB) return 0;
			if (Number.isInteger(parseFloat(valueA)) && Number.isInteger(parseFloat(valueB))) {
				return direction === "asc"
					? Number(valueA) - Number(valueB)
					: Number(valueB) - Number(valueA);
			}
			if (direction === "asc") {
				return valueA > valueB ? 1 : -1;
			} else {
				return valueA < valueB ? 1 : -1;
			}
		});

		this.currentSort = { column: columnName, direction };
		if (updateTable) {
			this.updateTableBody();
		} else {
			return sorted_rows;
		}
	}

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
	}

	getCellStyle(column, freezeColumnsAtLeft, left) {
		return this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft
			? `position: sticky; left:${left} px; z-index: 2; background-color: white; min-width:${column.width} px; max-width:${column.width} px; padding: 0px`
			: `min-width:${column.width || 150} px; max-width:${column.width || 200
			} px; padding: 0px !important;`;
	}

	createEditableField(td, column, row) {
		const frm = this.frm;
		const childTableFieldName = this.childTableFieldName;
		td.textContent = "";
		let columnField = {
			...column,
			onchange: function () {
				let changedValue = control.get_input_value();
				if (column.fieldtype === "Percent") {
					changedValue = parseFloat(changedValue);
				}
				if (row[column.fieldname] !== changedValue) {
					let rowIndex = frm.doc[childTableFieldName].findIndex(
						(r) => r.name === row.name
					);
					frm.doc[childTableFieldName][rowIndex][column.fieldname] =
						control.get_input_value();
					frm.dirty();
				}
			},
		};

		columnField.get_query = () => {
			const filters = [];
			if (column.additional_filters) {
				filters.push(...column.additional_filters);
			}
			if (column.link_filter) {
				const [parentfield, filter_key] = column.link_filter.split("->");
				let rowIndex = frm.doc[childTableFieldName].findIndex((r) => r.name === row.name);
				filters.push([
					column.options,
					filter_key,
					"=",
					frm.doc[childTableFieldName][rowIndex][parentfield],
				]);
			}
			if (column.doc_link_filters) {
				filters.push(...JSON.parse(column.doc_link_filters));
			}
			let keys = this.uniqueness?.row?.find((r) => r.includes(column.fieldname));
			if (keys) {
				let rowIndex = frm.doc[childTableFieldName].findIndex((r) => r.name === row.name);
				let _row = frm.doc[childTableFieldName][rowIndex];
				filters.push([
					column.options,
					"name",
					"not in",
					keys.map((k) => _row[k]).filter((k) => k && k != columnField.fieldname),
				]);
			}
			return { filters };
		};

		const control = frappe.ui.form.make_control({
			parent: td,
			df: columnField,
			render_input: true,
			only_input: true,
		});

		$(control.input).css({
			width: "100%",
			height: "32px",
			backgroundColor: "white",
			margin: "0px",
			boxShadow: "none",
		});
		if (row[column.fieldname]) {
			control.set_value(row[column.fieldname]);
		}
		control.refresh();
	}

	createNonEditableField(td, column, row) {
		let col = this.header.find((h) => h.fieldname === column.fieldname);
		td.textContent = "";
		let columnField = {
			...column,
			read_only: 1,
			description: "",
		};
		if (column.fieldtype === "Link") {
			let spanElement;
			if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
				let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
				if (frappe.utils.get_link_title(column.options, row[column.fieldname])) {
					td.innerHTML = formatter(
						frappe.utils.get_link_title(column.options, row[column.fieldname]),
						column,
						row,
						this
					);
					td.title =
						frappe.utils.get_link_title(column.options, row[column.fieldname]) || "";
				} else {
					try {
						frappe.utils
							.fetch_link_title(column.options, row[column.fieldname])
							.then((res) => {
								td.innerHTML = formatter(res || "", column, row, this);
								td.title = res || "";
							});
					} catch (error) {
						td.innerHTML = formatter(row[column.fieldname] || "", column, row, this);
						td.title = row[column.fieldname] || "";
					}
				}
			} else {
				if (frappe.utils.get_link_title(column.options, row[column.fieldname])) {
					spanElement = document.createElement("span");
					spanElement.textContent = frappe.utils.get_link_title(
						column.options,
						row[column.fieldname]
					);
					td.appendChild(spanElement);
					td.title =
						frappe.utils.get_link_title(column.options, row[column.fieldname]) || "";
				} else {
					spanElement = document.createElement("span");
					td.appendChild(spanElement);
					try {
						frappe.utils
							.fetch_link_title(column.options, row[column.fieldname])
							.then((res) => {
								spanElement.textContent = res || "";
								td.title = res || "";
							});
					} catch (error) {
						spanElement.textContent = row[column.fieldname] || "";
						td.title = row[column.fieldname] || "";
					}
				}

				// Apply CSS styles
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}

			this.bindColumnEvents(
				td.firstElementChild || spanElement,
				row[column.fieldname],
				column,
				row
			);
			return;
		}
		if (column.fieldtype == "Select") {
			let edit_level1 =
				["1", "2"].includes(row.docstatus) &&
				(this.frm ? this.frm?.doc?.docstatus == 0 : true);
			let wf_editable_roles = this?.workflow?.states
				?.filter((s) => s.state == row[this?.workflow?.workflow_state_field])
				?.map((s) => s.allow_edit);
			let wf_editable = this.workflow
				? wf_editable_roles?.some((role) => frappe.user_roles.includes(role))
				: true;
			let is_editable = this.connection?.disable_edit_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_edit_depends_on, row)
				: true;
			let editable =
				!edit_level1 &&
				this.crud.write &&
				wf_editable &&
				this.permissions.includes("write") &&
				this.conf_perms.includes("write") &&
				is_editable;
			if (col?.inline_edit && editable) {
				let me = this;
				const control = frappe.ui.form.make_control({
					parent: td,
					df: {
						...column,
						onchange: async function () {
							let changedValue = control.get_input_value();
							if (row[column.fieldname] && row[column.fieldname] != changedValue) {
								try {
									let response = await me.sva_db.set_value(
										me.doctype,
										row.name,
										column.fieldname,
										changedValue
									);
									if (response) {
										me.reloadRow(response);
										frappe.show_alert({
											message: `${column?.label || column.fieldname
												} updated successfully`,
											indicator: "success",
										});
									}
								} catch (error) {
									frappe.show_alert({
										message: `Error updating ${column?.label || column.fieldname
											}`,
										indicator: "danger",
									});
								}
							} else {
								try {
									let response = await me.sva_db.set_value(
										me.doctype,
										row.name,
										column.fieldname,
										row[column.fieldname]
									);
									if (response) {
										me.reloadRow(response);
										frappe.show_alert({
											message: `${column?.label || column.fieldname
												} updated successfully`,
											indicator: "success",
										});
									}
								} catch (error) {
									frappe.show_alert({
										message: `Error updating ${column?.label || column.fieldname
											}`,
										indicator: "danger",
									});
								}
							}
						},
					},
					value: row[column.fieldname] || "",
					render_input: true,
					only_input: true,
				});
				$(control.input).css({
					width: "100%",
					height: "25px",
					marginTop: "5px",
					fontSize: "12px",
					color: "black",
				});
				$(td).css({ height: "25px !important", padding: "0px 5px" });
				control.refresh();
			} else {
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
					let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					td.innerHTML = `<span>${row[column.fieldname] || ""}</span>`;
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					}
				}
			}
			return;
		}
		if (["HTML"].includes(columnField.fieldtype)) {
			const control = frappe.ui.form.make_control({
				parent: td,
				df: columnField,
				render_input: true,
				only_input: true,
			});
			$(control.input).css({
				width: "100%",
				height: "32px",
				backgroundColor: "white",
				margin: "0px",
				fontSize: "12px",
				color: "black",
				boxShadow: "none",
				padding: "0px 5px",
				cursor: "normal",
			});
			$(td).css({ height: "32px !important" });
			if (row[column.fieldname]) {
				control.set_value(row[column.fieldname]);
			}
			control.refresh();
			return;
		} else {
			if (columnField?.has_link) {
				let [doctype, link_field] = columnField.has_link.split("->");
				td.addEventListener("click", async () => {
					await this.childTableDialog(doctype, link_field, row?.name, row);
				});
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
						cursor: "pointer",
						color: "blue",
					});
				}
			} else {
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}
			if (columnField.fieldtype === "Currency") {
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
					let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					td.innerHTML = `<span>${formatCurrency(
						row[column.fieldname],
						frappe.sys_defaults.currency
					)}</span>`;
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span") || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (columnField.fieldtype === "Attach") {
				if (row[column.fieldname]) {
					td.innerHTML = `<a href = "${row[column.fieldname]}" target = "_blank" >${row[column.fieldname]
						}</a> `;
				} else {
					td.innerHTML = "";
				}
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
				return;
			}
			if (columnField.fieldtype === "Attach Image") {
				if (row[column.fieldname]) {
					td.innerHTML = `<img src = "${row[column.fieldname]
						}" style = "width:30px;border-radius:50%;height:30px;object-fit:cover;" /> `;
					return;
				}
			}
			if (["Int", "Float"].includes(columnField.fieldtype)) {
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
					let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					td.innerHTML = `<span>${row[column.fieldname].toLocaleString("en-US", {
						minimumFractionDigits: 0,
						maximumFractionDigits: 2,
					}) || 0
						}</span>`;
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span") || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (["Percent"].includes(columnField.fieldtype)) {
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
					let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					td.innerHTML = `<span>${row[column.fieldname].toLocaleString("en-US", {
						minimumFractionDigits: 0,
						maximumFractionDigits: 2,
					}) || 0
						}%</span>`;
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (["Date"].includes(columnField.fieldtype)) {
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
					let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					td.innerHTML = `<span>${row[column.fieldname] ? formaDate(row[column.fieldname]) : ""
						}</span>`;
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					}
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
				return;
			}
			if (["name", this.meta?.title_field].includes(columnField.fieldname)) {
				td.innerHTML = `<p style="cursor: pointer; text-decoration:underline;">${row[column.fieldname]
					}</p>`;
				td.querySelector("p").addEventListener("click", () => {
					let route = frappe.get_route();
					frappe.set_route("Form", this.doctype, row["name"]).then(() => {
						cur_frm.add_custom_button("Back", () => {
							frappe.set_route(route);
						});
					});
				});
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
				return;
			}
			if (columnField.fieldtype == "Button") {
				let btn = document.createElement("button");
				btn.classList.add("btn", "btn-secondary", "btn-sm");
				btn.setAttribute("data-dt", this.doctype);
				btn.setAttribute("data-dn", row.name);
				btn.setAttribute("data-fieldname", columnField.fieldname);
				btn.onclick = this.onFieldClick;
				btn.textContent = columnField.label;
				if (this.frm?.dt_events?.[this.doctype]?.formatter?.[columnField.fieldname]) {
					let formatter =
						this.frm.dt_events[this.doctype].formatter[columnField.fieldname];
					btn = formatter(btn, column, row, this);
				}
				td.appendChild(btn);
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						padding: "0px 5px",
					});
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
				return;
			}
			if (this.frm?.dt_events?.[this.doctype]?.formatter?.[column.fieldname]) {
				let formatter = this.frm.dt_events[this.doctype].formatter[column.fieldname];
				td.innerHTML = formatter(row[column.fieldname], column, row, this);
			} else {
				td.innerHTML = `<span>${row[column.fieldname] || ""}</span>`;
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}
			this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
			td.title = row[column.fieldname] || "";
		}
	}
	bindColumnEvents(element, value, column, row) {
		if (this.frm?.dt_events?.[this.doctype]?.columnEvents?.[column.fieldname]) {
			let events = this.frm.dt_events[this.doctype].columnEvents[column.fieldname];
			for (let event in events) {
				element.addEventListener(event, () =>
					events[event](element, value, column, row, this)
				);
			}
		}
	}
	async getDocList() {
		try {
			let filters = [];
			if (this.connection?.extend_condition && this.connection?.extended_condition) {
				try {
					let cond = JSON.parse(this.connection.extended_condition);
					if (Array.isArray(cond) && cond?.length) {
						cond = cond?.map((e) => {
							if (
								e.length > 3 &&
								e[3] &&
								!Array.isArray(e[3]) &&
								isNaN(e[3]) &&
								e[3]?.toLowerCase() == "today"
							) {
								e[3] = new Date().toISOString().split("T")[0];
							}
							return e;
						});
						filters = filters.concat(cond);
					}
				} catch (error) {
					console.error("Exception: while parsing extended_condition", error);
				}
			}
			if (this.connection?.connection_type === "Referenced") {
				filters.push([
					this.doctype,
					this.connection.dt_reference_field,
					"=",
					this.frm?.doc.doctype,
				]);
				filters.push([
					this.doctype,
					this.connection.dn_reference_field,
					"=",
					this.frm?.doc.name,
				]);
			} else if (this.connection?.connection_type === "Direct") {
				filters.push([
					this.doctype,
					this.connection.link_fieldname,
					"=",
					this.frm?.doc.name,
				]);
			} else if (this.connection?.connection_type === "Indirect") {
				filters.push([
					this.doctype,
					this.connection.foreign_field,
					"=",
					this.frm?.doc?.[this.connection.local_field],
				]);
			} else if (this.connection.link_fieldname) {
				filters.push([
					this.doctype,
					this.connection.link_fieldname,
					"=",
					this.frm?.doc.name,
				]);
			}

			// this.total = await frappe.db.count(this.doctype, { filters: [...filters, ...this.additional_list_filters] });
			let { message } = await this.sva_db.call({
				method: "frappe_theme.dt_api.get_dt_count",
				doctype: this.doctype || this.link_report,
				doc: this.frm?.doc?.name,
				ref_doctype: this.frm?.doc?.doctype,
				filters: [...filters, ...this.additional_list_filters],
				_type: this.connection.connection_type,
				unfiltered: this.connection?.unfiltered,
			});
			if (message) {
				this.total = message;
			}
			// Update pagination after getting total count
			if (this.total > this.limit) {
				if (
					!this.wrapper
						.querySelector("div#footer-element")
						?.querySelector("div#pagination-element")
				) {
					this.setupPagination();
				} else {
					this.updatePageButtons();
				}
			} else {
				// Remove pagination if not needed
				let paginationElement = this.wrapper
					.querySelector("div#footer-element")
					?.querySelector("div#pagination-element");
				if (paginationElement) {
					paginationElement.remove();
				}
			}
			let res = await this.sva_db.call({
				method: "frappe_theme.dt_api.get_dt_list",
				doctype: this.doctype || this.link_report,
				doc: this.frm?.doc?.name,
				ref_doctype: this.frm?.doc?.doctype,
				filters: [...filters, ...this.additional_list_filters],
				fields: this.fields || ["*"],
				limit_page_length: this.limit,
				order_by: `${this.sort_by} ${this.sort_order}`,
				limit_start: this.page > 0 ? (this.page - 1) * this.limit : 0,
				_type: this.connection.connection_type,
				unfiltered: this.connection?.unfiltered,
			});
			return res.message;
		} catch (error) {
			return [];
		}
	}
	createNoDataFoundPage() {
		const tr = document.createElement("tr");
		tr.id = "noDataFoundPage";
		tr.style.height = "200px"; // Use viewport height to set a more responsive height
		tr.style.fontSize = "20px";
		const td = document.createElement("td");
		td.colSpan =
			(this.columns?.length ?? 3) +
			((this.options?.serialNumberColumn ? 1 : 0) +
				(this.conf_perms.includes("write") || this.conf_perms.includes("delete") ? 1 : 0) +
				(this.wf_transitions_allowed || this.wf_editable_allowed ? 1 : 0)); // Ensure columns are defined properly

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
		return tr;
	}
	handleNoPermission() {
		let noPermissionPage = document.createElement("div");
		noPermissionPage.id = "noPermissionPage";
		noPermissionPage.style.height = "100%";
		noPermissionPage.style.fontSize = "20px";
		noPermissionPage.style.textAlign = "center";
		noPermissionPage.style.paddingTop = "50px";
		noPermissionPage.style.color = "grey";
		noPermissionPage.textContent =
			"You do not have permission through role permission to access this resource.";
		if (!this.wrapper.querySelector("#noPermissionPage")) {
			this.wrapper.appendChild(noPermissionPage);
		}
	}
	getDialogSize(fields) {
		let hasChildTable = fields.some((field) => field.fieldtype === "Table");
		let hasMultipleColumns = false;

		let currentColumnCount = 0; // Track columns in a section
		for (let field of fields) {
			if (field.fieldtype === "Section Break") {
				currentColumnCount = 0; // Reset column count on new section
			} else if (field.fieldtype === "Column Break") {
				currentColumnCount++; // Increase column count
			}

			if (currentColumnCount >= 1) {
				// At least one column break = 2 columns
				hasMultipleColumns = true;
			}
		}

		if (hasChildTable) {
			return "extra-large"; // Child tables require more space
		} else if (hasMultipleColumns) {
			return "large"; // Sections with 2+ columns need a larger dialog
		} else {
			return "small"; // Default size
		}
	}

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
	}
	// Helper function to get the fields from the meta
	add_field(df, parent) {
		if (!df.placeholder) {
			df.placeholder = df.label;
		}

		df.input_class = "input-xs";

		var f = frappe.ui.form.make_control({
			df: df,
			parent: parent || this.page_form,
			only_input: df.fieldtype == "Check" ? false : true,
		});
		this.standard_filters_fields_dict[df.fieldname] = f;
		f.refresh();
		$(f.wrapper)
			.attr("title", __(df.label, null, df.parent))
			.tooltip({
				delay: { show: 600, hide: 100 },
				trigger: "hover",
			});
		this.restyle_field(f);
		// html fields in toolbar are only for display
		if (df.fieldtype == "HTML") {
			return;
		}

		// hidden fields dont have $input
		if (!f.$input) f.make_input();

		f.$input.attr("placeholder", __(df.label, null, df.parent));

		if (df.fieldtype === "Check") {
			$(f.wrapper).find(":first-child").removeClass("col-md-offset-4 col-md-8");
		}

		if (df.fieldtype == "Button") {
			$(f.wrapper).find(".page-control-label").html("&nbsp;");
			f.$input.addClass("btn-xs").css({ width: "100%", "margin-top": "-1px" });
		}
		return f;
	}
	restyle_field(f) {
		$(f.wrapper).css("margin", "0px");

		$(f.wrapper).find("select").css("width", "140px");
		$(f.wrapper).find(".select-icon").css("top", "2px");
	}
}

frappe.provide("frappe.ui");
frappe.ui.SvaDataTable = SvaDataTable;
export default SvaDataTable;
