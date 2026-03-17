import SVASortSelector from "../sva_sort_selector.bundle.js";
import SVAListSettings from "../list_settings.bundle.js";
import SVAFilterArea from "../filters/filter_area.bundle.js";
import DTAction from "../../vue/dt_action/dt.action.bundle.js";

const UISetupMixin = {
	async setupHeader() {
		let has_list_filters = JSON.parse(this.connection?.list_filters || "[]").length > 0;

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
		label_wrapper.innerHTML = `<span id="dt-title" style="font-weight:bold;max-width:200px !important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${
			this.label ? this.label : " "
		}</span>`;

		// Actions container (right side)
		let title_actions = document.createElement("div");
		title_actions.id = "title-actions";
		title_actions.style = `
			display: flex;
			align-items: center;
			gap: ${!has_list_filters ? "5" : "10"}px;
			${!has_list_filters ? "margin-left: -5px !important;" : ""}
		`;

		// Custom Button Section
		let custom_button_section = document.createElement("div");
		custom_button_section.id = "custom-button-section";
		custom_button_section.style = `
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
		title_actions.appendChild(custom_button_section);
		if (!this.connection?.hide_refresh_button) {
			title_actions.appendChild(refresh_button);
		}
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
			report_filters = message || [];
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
									? report_filters?.filter(
											(f) => f.options != this.frm?.doc?.doctype
									  )
									: report_filters || [],
						  })
						: this,
				header:
					this.connection.connection_type == "Report"
						? report_filters.map((field) => field.fieldname)
						: this.header.map((field) => field.fieldname),
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
		if (!this.connection?.hide_filter) {
			filter_controls.appendChild(list_filter);
		}
		if (!this.connection?.hide_sorting) {
			filter_controls.appendChild(sva_sort_selector);
		}

		// Add to filter row
		filter_row.appendChild(standard_filters_wrapper);
		filter_row.appendChild(filter_controls);

		// Add both rows to header element
		if (has_list_filters) {
			header_element.appendChild(title_row);
			header_element.appendChild(filter_row);
		} else {
			standard_filters_wrapper.append(label_wrapper);
			filter_controls.append(title_actions);
			header_element.appendChild(filter_row);
		}

		return header_element;
	},
	add_custom_button(label, click, style = "secondary") {
		let button = document.createElement("button");
		button.classList.add("btn", `btn-${style}`, "btn-sm");
		button.innerHTML = label;
		button.onclick = click.bind(this);
		let wrapper = this.header_element.querySelector("div#custom-button-section");
		let existingButton = Array.from(wrapper.children).find(
			(btn) => btn.tagName === "BUTTON" && btn.textContent === button.textContent
		);
		if (existingButton) {
			return;
		}
		wrapper.appendChild(button);
	},
	async setupWrapper(wrapper) {
		wrapper.style = `max-width:${this.options?.style?.width || "100%"}; width:${
			this.options?.style?.width || "100%"
		};margin:0px !important; ${
			this.connection?.enable_card_view
				? "padding: 10px 10px 5px 10px; border-radius: 10px;border: 1px solid #dcdcdc;"
				: ""
		}`;
		if (!wrapper.querySelector("div#header-element")) {
			wrapper.appendChild(await this.setupHeader());
		}
		return wrapper;
	},
	createSettingsButton() {
		let list_view_settings = document.createElement("button");
		list_view_settings.id = "list_view_settings";
		list_view_settings.classList.add("btn", "btn-secondary", "btn-sm");
		list_view_settings.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="color: ${
			this.user_has_list_settings
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
	},
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
							if (
								this.connection?.configuration_basis == "Property Setter" &&
								this.frm?.doctype
							) {
								await this.sva_db.call({
									method: "frappe_theme.dt_api.update_sva_ft_property",
									doctype: this.frm.doctype,
									fieldname: this.connection.html_field,
									key: "listview_settings",
									value: JSON.stringify(listview_settings ?? []),
								});
							} else if (this.connection.doctype && this.connection.name) {
								await this.sva_db.call({
									method: "frappe.client.set_value",
									doctype: this.connection.doctype,
									name: this.connection.name,
									fieldname: "listview_settings",
									value: JSON.stringify(listview_settings ?? []),
								});
							}
						} else {
							await this.sva_db.call({
								method: "frappe_theme.dt_api.setup_user_list_settings",
								parent_id:
									this.connection.parent ||
									`${this.doctype || this.link_report}-${
										this.connection.html_field
									}`,
								child_dt: this.doctype || this.link_report,
								listview_settings: JSON.stringify(listview_settings ?? []),
							});
							this.user_has_list_settings = true;
						}
					} else {
						await this.sva_db.call({
							method: "frappe_theme.dt_api.delete_user_list_settings",
							parent_id:
								this.connection.parent ||
								`${this.doctype || this.link_report}-${
									this.connection.html_field
								}`,
							child_dt: this.doctype || this.link_report,
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
	},
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
	},

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
		let is_addable = this.connection?.disable_add_depends_on
			? !frappe.utils.custom_eval(
					this.connection?.disable_add_depends_on,
					this?.frm?.doc || {}
			  )
			: true;
		if (
			this.crud.create &&
			(this.frm ? this.frm?.doc?.docstatus == 0 : true) &&
			this.conf_perms.length &&
			this.conf_perms.includes("create") &&
			is_addable
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
		if (this.total > this.limit && !this.isTransposed) {
			if (
				!wrapper
					.querySelector("div#footer-element")
					?.querySelector("div#pagination-element")
			) {
				wrapper.querySelector("div#footer-element").appendChild(this.setupPagination());
			}
		}
	},
};

export default UISetupMixin;
