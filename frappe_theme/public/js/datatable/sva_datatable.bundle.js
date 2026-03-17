// Mixin imports
import RenderingMixin from "./mixins/rendering.js";
import FieldsMixin from "./mixins/fields.js";
import ActionColumnMixin from "./mixins/action_column.js";
import FormDialogMixin from "./mixins/form_dialog.js";
import WorkflowMixin from "./mixins/workflow.js";
import PaginationMixin from "./mixins/pagination.js";
import UISetupMixin from "./mixins/ui_setup.js";
import DataMixin from "./mixins/data.js";
import HelpersMixin from "./mixins/helpers.js";
import TransposeMixin from "./mixins/transpose.js";

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

	isAsync = (fn) => fn?.constructor?.name === "AsyncFunction";

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
		onFieldClick = () => {},
		onFieldValueChange = () => {},
		signal = null,
	}) {
		this.signal = signal;
		this.sva_db = new SVAHTTP(signal);
		this.label = __(label);
		wrapper.innerHTML = "";
		this.wrapper = wrapper;
		this.rows = rows;
		this.columns = columns;
		this.highlighted_columns = connection?.highlighted_columns || [];

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
		this.workflow_state_map = {};
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
		this.title_field = null;
		this.isTransposed = false; // Track transpose state
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
		if (this.frm?.["dt_events"]?.[this.doctype ?? this.link_report]?.["before_load"]) {
			let change = this.frm["dt_events"][this.doctype ?? this.link_report]["before_load"];
			if (this.isAsync(change)) {
				await change(this);
			} else {
				change(this);
			}
		}
		if (this.frm?.["dt_global_events"]?.["before_load"]) {
			let change = this.frm["dt_global_events"]["before_load"];
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
				if (
					!this.connection?.disable_workflow &&
					this.connection.connection_type !== "Report"
				) {
					let exists = await this.sva_db.exists("Workflow", {
						document_type: this.doctype,
						is_active: 1,
					});
					if (exists) {
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
								filters: {
									workflow_state_name: [
										"IN",
										this.workflow?.states?.map((e) => e.state),
									],
								},
								limit_page_length: 100,
							});
							this.wf_editable_allowed = this.workflow?.states?.some((tr) =>
								frappe.user_roles.includes(tr?.allow_edit)
							);
							this.wf_transitions_allowed = this.workflow?.transitions?.some((tr) =>
								frappe.user_roles.includes(tr?.allowed)
							);
						}
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
					this.meta = response?.meta || {};
					if (this.meta?.title_field) {
						this.title_field = this.meta.title_field;
					}
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
						if (this.connection.connection_type === "Report") {
							this.columns = columns;
						} else {
							this.columns = [...columns.filter((f) => f.in_list_view)];
						}
					}
					if (this.frm?.["dt_events"]?.[this.doctype]?.["before_table_load"]) {
						let change = this.frm["dt_events"][this.doctype]["before_table_load"];
						if (this.isAsync(change)) {
							await change(this);
						} else {
							change(this);
						}
					}
					if (this.frm?.["dt_global_events"]?.["before_table_load"]) {
						let change = this.frm["dt_global_events"]["before_table_load"];
						if (this.isAsync(change)) {
							await change(this);
						} else {
							change(this);
						}
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
		if (this.frm?.["dt_global_events"]?.["after_load"]) {
			let change = this.frm["dt_global_events"]["after_load"];
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
				if (this.frm?.["dt_global_events"]?.["after_row_update"]) {
					let change = this.frm["dt_global_events"]["after_row_update"];
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
}

// Attach all mixin methods to the prototype
Object.assign(
	SvaDataTable.prototype,
	RenderingMixin,
	FieldsMixin,
	ActionColumnMixin,
	FormDialogMixin,
	WorkflowMixin,
	PaginationMixin,
	UISetupMixin,
	DataMixin,
	HelpersMixin,
	TransposeMixin
);

frappe.provide("frappe.ui");
frappe.ui.SvaDataTable = SvaDataTable;
export default SvaDataTable;
