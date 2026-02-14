if (frappe.ui?.FileUploader) {
	frappe.ui.FileUploader = class CustomFileUploader extends frappe.ui?.FileUploader {
		constructor(options = {}) {
			// Override or enforce disable_file_browser
			options.disable_file_browser = true;
			// Call parent constructor with modified options

			/* Other available flags
			make_attachments_public,
			allow_web_link,
			allow_take_photo,
			allow_toggle_private,
			allow_toggle_optimize,

			*/
			super(options);
		}
	};
}

import { get_parent_section_field_by_fieldname } from "./utils.bundle.js";
import Loader from "./loader-element.js";
import SvaDataTable from "./datatable/sva_datatable.bundle.js";
import SVAHeatmap from "./custom_components/heatmap.bundle.js";
import SVADashboardManager from "./sva_dashboard_manager.bundle.js";
import SVAEmailComponent from "./custom_components/communication.bundle.js";
import SVAGalleryComponent from "./custom_components/gallery/gallery.bundle.js";
import SVALinkedUser from "./custom_components/linked_users.bundle.js";
import SVANotesManager from "./custom_components/note.bundle.js";
import SVAmGrantTask from "./custom_components/task.bundle.js";
import SVATimelineGenerator from "./custom_components/timeline.bundle.js";
import CustomApprovalRequest from "./custom_components/approval_request/approval_request.bundle.js";
import CustomDynamicHtml from "./custom_components/dynamic_html/dynamic_html.bundle.js";
import SVACarousel from "./sva_carousel.bundle.js";
import FilterRibbon from "./custom_components/filters_ribbon.bundle.js";
import SVASDGWheel from "./custom_components/sdg_wheel.bundle.js";
// Vue components
import NumberCardSkeleton from "./vue/sva_card/components/Skeleton.vue";
import ChartSkeleton from "./vue/sva_chart/components/Skeleton.vue";
import { h, createApp } from "vue";

frappe.ui.form.Form = class CustomForm extends frappe.ui.form.Form {
	constructor(...args) {
		super(...args);
		this.activeComponents = new Set();
		this.pendingRequests = new Map();
		this.currentTabField = null;
		this.dts = {};
		this.mountedComponents = new Map(); // Track mounted components and their cleanup functions
		this.sva_db = new SVAHTTP();
	}
	refresh(docname) {
		try {
			super.refresh(docname);
			if (!window.sva_datatable_configuration) {
				window.sva_datatable_configuration = {};
			}
			this.setupHandlers();
		} catch (error) {
			console.error("Error in refresh:", error);
			frappe.show_alert({
				message: __("Error in form refresh"),
				indicator: "red",
			});
		}
	}
	async handleDTHeader(frm) {
		try {
			let header_html_block = frm.meta.header_html;
			if (header_html_block) {
				let html = await frappe.db.get_doc("Custom HTML Block", header_html_block);
				let wrapper = $(
					document.querySelector(
						`#page-${frm.meta.name.replace(/ /g, "\\ ")} .page-head`
					)
				);
				if (wrapper.length && html) {
					frappe.create_shadow_element(
						wrapper.get(0),
						html.html,
						html.style,
						html.script
					);
				}
			}
		} catch (error) {
			console.error("Error in handleDTHeader:", error);
		}
	}
	custom_onload(frm) {
		this.handleDTHeader(frm);
		this.dashboard_header_handlers(frm);
		this.dashboard_form_events_handler(frm);
	}
	setupHandlers() {
		if (!frappe.ui.form.handlers[this.doctype]) {
			frappe.ui.form.handlers[this.doctype] = {
				onload: [this.custom_onload.bind(this)],
				refresh: [this.custom_refresh.bind(this)],
				on_tab_change: [this._activeTab.bind(this)],
				after_save: [this.custom_after_save.bind(this)],
				onload_post_render: [this.custom_onload_post_render.bind(this)],
			};
			return;
		}

		// Setup custom setup handlers
		if (!frappe.ui.form.handlers[this.doctype].onload) {
			frappe.ui.form.handlers[this.doctype].onload = [this.custom_onload.bind(this)];
		} else if (
			!frappe.ui.form.handlers[this.doctype].onload.includes(this.custom_onload.bind(this))
		) {
			frappe.ui.form.handlers[this.doctype].onload.push(this.custom_onload.bind(this));
		}

		// Setup refresh handlers
		if (!frappe.ui.form.handlers[this.doctype].refresh) {
			frappe.ui.form.handlers[this.doctype].refresh = [this.custom_refresh.bind(this)];
		} else if (
			!frappe.ui.form.handlers[this.doctype].refresh.includes(this.custom_refresh.bind(this))
		) {
			frappe.ui.form.handlers[this.doctype].refresh.push(this.custom_refresh.bind(this));
		}

		// Setup tab change handlers
		if (!frappe.ui.form.handlers[this.doctype].on_tab_change) {
			frappe.ui.form.handlers[this.doctype].on_tab_change = [this._activeTab.bind(this)];
		} else if (
			!frappe.ui.form.handlers[this.doctype].on_tab_change.includes(
				this._activeTab.bind(this)
			)
		) {
			frappe.ui.form.handlers[this.doctype].on_tab_change.push(this._activeTab.bind(this));
		}

		// Setup custom after save handlers
		if (!frappe.ui.form.handlers[this.doctype].after_save) {
			frappe.ui.form.handlers[this.doctype].after_save = [this.custom_after_save.bind(this)];
		} else if (
			!frappe.ui.form.handlers[this.doctype].after_save.includes(
				this.custom_after_save.bind(this)
			)
		) {
			frappe.ui.form.handlers[this.doctype].after_save.push(
				this.custom_after_save.bind(this)
			);
		}

		// Setup custom after save handlers
		if (!frappe.ui.form.handlers[this.doctype].onload_post_render) {
			frappe.ui.form.handlers[this.doctype].onload_post_render = [
				this.custom_onload_post_render.bind(this),
			];
		} else if (
			!frappe.ui.form.handlers[this.doctype].onload_post_render.includes(
				this.custom_onload_post_render.bind(this)
			)
		) {
			frappe.ui.form.handlers[this.doctype].onload_post_render.push(
				this.custom_onload_post_render.bind(this)
			);
		}
	}
	custom_onload_post_render(frm) {
		this.goToCommentButton(frm);
	}
	async custom_refresh(frm) {
		try {
			// frm.page.add_menu_item(__("Export Excel"), () => {
			// 	try {
			// 		let url = `/api/method/frappe_theme.apis.export_json.export_excel?doctype=${frm.doctype}&docname=${frm.docname}`;
			// 		window.open(url);
			// 	} catch (e) {
			// 		console.error(e);
			// 	}
			// });
			setupFieldComments(frm);
			this.goToCommentButton(frm);
			if (frm.doctype == "DocType") {
				frm.add_custom_button("Set Property", () => {
					this.set_properties(frm.doc.name);
				});
			}

			let dropdown = frm?.page?.btn_secondary?.parent();
			if (dropdown) {
				dropdown.find('.dropdown-menu li:contains("Jump to field")')?.remove();
				dropdown.find('.dropdown-menu li:contains("Print")')?.remove();
			}
			if (frappe?.boot?.my_theme?.hide_form_comment) {
				$(".comment-input-wrapper").hide();
				$(".new-timeline").hide();
			} else {
				$(".comment-input-wrapper").show();
				$(".new-timeline").show();
			}
			if (frappe?.boot?.my_theme?.hide_print_icon) {
				frm.page.hide_icon_group("print");
			} else {
				frm.page.show_icon_group("print");
			}
			const dt_props = await this.getPropertySetterData(frm.doc.doctype);
			let field_events = {};
			let props = dt_props?.filter((prop) =>
				["filter_by", "link_filter"].includes(prop.property)
			);
			if (props?.length) {
				for (const prop of props) {
					if (prop?.value) {
						const [valueField, filterField] = prop.value.split("->");
						field_events[valueField] = function (frm) {
							this.apply_custom_filter(
								prop.field_name,
								filterField,
								frm,
								frm.doc[valueField]
							);
							frm.set_value(prop.field_name, "");
						}.bind(this);
						this.apply_custom_filter(
							prop.field_name,
							filterField,
							frm,
							frm.doc[valueField]
						);
					}
				}
			}
			if (Object.keys(field_events)?.length) {
				frappe.ui.form.on(frm.doctype, field_events);
			}

			const sva_db = new SVAHTTP();
			if (!window.sva_datatable_configuration?.[frm.doc.doctype]) {
				const { message } = await sva_db.call({
					method: "frappe_theme.dt_api.get_sva_dt_settings",
					doctype: frm.doc.doctype,
				});
				if (message) {
					this.dts = message;
					window.sva_datatable_configuration = {
						[frm.doc.doctype]: this.dts,
					};
				}
			} else {
				this.dts = window.sva_datatable_configuration?.[frm.doc.doctype];
			}
			this.setupDTTriggers(frm);
			const tab_field = frm.get_active_tab()?.df?.fieldname;
			await this.tabContent(frm, tab_field);
		} catch (error) {
			console.error("Error in custom_refresh:", error);
		}
	}
	dashboard_header_handlers(frm) {
		try {
			if (frm?.meta?.issingle && frm?.meta?.is_dashboard) {
				frm.disable_save();
				if (!frm.meta.header_html) {
					let wrapper = $(
						document.querySelector(
							`#page-${frm.meta.name.replace(/ /g, "\\ ")} .page-head`
						)
					);
					if (wrapper.length) {
						let header_element = document.createElement("div");
						header_element.id = "dashboard-header-element";
						header_element.style =
							"width: 100%; padding: 10px 14px;display:flex; justify-content: space-between; align-items: center;";

						let title_element = document.createElement("h4");
						title_element.id = "dashboard-header-title";
						title_element.style = "margin:0px; padding:0px;";
						title_element.innerText = __(frm.doctype || frm.meta.name);

						let refresh_button = document.createElement("button");
						refresh_button.id = "dashboard-refresh_button";
						refresh_button.classList.add(
							"text-muted",
							"btn",
							"btn-default",
							"icon-btn"
						);
						refresh_button.innerHTML = `
							<svg class="es-icon es-line icon-sm" style="" aria-hidden="true">
								<use class="" href="#es-line-reload"></use>
							</svg>
						`;
						refresh_button.onclick = function () {
							if (Object.entries(frm.sva_ft_instances).length) {
								for (const [key, instance] of Object.entries(
									frm.sva_ft_instances
								)) {
									if (
										instance.refresh &&
										typeof instance.refresh === "function"
									) {
										instance.refresh();
									} else if (
										instance.reloadTable &&
										typeof instance.reloadTable === "function"
									) {
										instance.reloadTable();
									}
								}
							}
						};
						wrapper.get(0).innerHTML = "";
						if (!header_element.querySelector("#dashboard-header-title")) {
							header_element.appendChild(title_element);
						}
						if (!header_element.querySelector("#dashboard-refresh_button")) {
							header_element.appendChild(refresh_button);
						}
						if (!wrapper.get(0).querySelector("#dashboard-header-element")) {
							wrapper.get(0).appendChild(header_element);
						}
					}
				}
			}
		} catch (error) {
			console.error("Error in dashboard_header_handlers:", error);
		}
	}
	async dashboard_form_events_handler(frm) {
		function apply_dashboard_filters(frm, fields, apply_button_field) {
			let filters = {};
			fields.forEach((field) => {
				if (Array.isArray(frm.doc[field.fieldname])) {
					if (frm.doc[field.fieldname].length > 0) {
						let field_dict = frm.fields_dict?.[field.fieldname];
						let link_field = field_dict?._link_field || field_dict?.getLinkField();
						filters[field.fieldname] = link_field
							? frm.doc[field.fieldname]?.map((i) => i[link_field.fieldname])
							: frm.doc[field.fieldname];
					} else {
						return;
					}
				} else if (frm.doc[field.fieldname]) {
					filters[field.fieldname] = frm.doc[field.fieldname];
				}
			});
			if (Object.keys(filters).length) {
				let parent_section_field = get_parent_section_field_by_fieldname(
					frm,
					apply_button_field.fieldname
				);
				if (parent_section_field) {
					if (!frm?.filters_ribbon?.[parent_section_field.fieldname]) {
						let wrapper = frm.$wrapper.find(
							`[data-fieldname='${parent_section_field.fieldname}']`
						);
						if (wrapper.length) {
							let ribbon_instance = new FilterRibbon({
								wrapper: wrapper[0],
								filters: filters,
								frm: frm,
							});
							if (!frm?.filters_ribbon) {
								frm["filters_ribbon"] = {};
							}
							frm["filters_ribbon"][parent_section_field.fieldname] =
								ribbon_instance;
						}
					} else {
						frm.filters_ribbon[parent_section_field.fieldname].updateFilters(filters);
					}
				}
				for (let key in frm.sva_ft_instances) {
					let instance = frm.sva_ft_instances[key];
					if (instance?.connection) {
						let _filters = [];
						for (let f in filters) {
							_filters.push([
								instance.doctype || instance.linked_report || "RN",
								f,
								"=",
								filters[f],
							]);
						}
						instance.additional_list_filters = _filters;
						instance.reloadTable();
						continue;
					} else {
						instance.setFilters(filters);
						continue;
					}
				}
				if (!frm["sva_active_filters"]) {
					frm["sva_active_filters"] = {};
				}
				frm["sva_active_filters"][apply_button_field.fieldname] = filters;
			} else {
				return;
			}
		}

		function reset_dashboard_filters(frm, fields, apply_button_field) {
			if (!frm?.["sva_active_filters"]?.[apply_button_field.fieldname]) {
				return;
			}
			fields.forEach((field) => {
				if (field.fieldtype == "Link") {
					frm.set_value(field.fieldname, "");
				} else if (field.fieldtype == "Table MultiSelect") {
					frm.set_value(field.fieldname, []);
				}
				return;
			});
			for (let key in frm.sva_ft_instances) {
				let instance = frm.sva_ft_instances[key];
				if (instance?.connection) {
					instance.additional_list_filters = [];
					instance.reloadTable();
					continue;
				} else {
					instance.setFilters({});
					continue;
				}
			}

			if (frm?.["sva_active_filters"]?.[apply_button_field.fieldname]) {
				delete frm["sva_active_filters"][apply_button_field.fieldname];
			}
			let parent_section_field = get_parent_section_field_by_fieldname(
				frm,
				apply_button_field.fieldname
			);
			if (parent_section_field) {
				if (frm?.filters_ribbon?.[parent_section_field.fieldname]) {
					frm.filters_ribbon[parent_section_field.fieldname].destroy();
				}
			}
		}
		if (frm?.meta?.issingle && frm?.meta?.is_dashboard) {
			let active_tab = await frm.get_active_tab();
			let tab_fields = await this.getTabFieldsJSON(
				frm,
				active_tab?.df?.fieldname || "__details"
			);
			let apply_button = tab_fields.find(
				(f) => f.fieldtype == "Button" && f?.is_apply_button
			);

			if (apply_button) {
				let apply_button_field = frm.get_field(apply_button.fieldname);
				apply_button_field.apply_action = () => {
					apply_dashboard_filters(frm, tab_fields, apply_button_field?.df);
				};

				apply_button_field.reset_action = () => {
					reset_dashboard_filters(frm, tab_fields, apply_button_field?.df);
				};
			}
		}
	}
	async custom_after_save(frm) {
		if (frm?.sva_dt_prev_route && frm?.sva_dt_prev_route.length) {
			frappe.set_route(frm.sva_dt_prev_route);
			frm.sva_dt_prev_route = null;
		}
	}
	async set_properties(doctype) {
		let res = await frappe.db.get_list("Property Setter", {
			filters: {
				doc_type: doctype,
			},
		});

		let list = new frappe.ui.Dialog({
			title: "Set Property",
			fields: [
				{
					label: "List of Properties",
					fieldname: "property_name",
					fieldtype: "Autocomplete",
					options: res.map((d) => d.name),
					depends_on: `eval: ${JSON.stringify(res.length)} > 0`,
				},
				{
					label: "New Property Value",
					fieldname: "property_value",
					fieldtype: "Data",
					mandatory_depends_on: "eval: !doc.property_name ",
					depends_on: "eval: !doc.property_name",
				},
			],
			primary_action_label: "Set",
			primary_action: async function () {
				let property_value = list.fields_dict.property_value.get_value();
				list.hide();
				this.add_properties(doctype, property_value);
			}.bind(this),
		});
		list.show();
	}
	async add_properties(doctype, new_property) {
		let fields = await this.sva_db.call({
			method: "frappe_theme.api.get_meta_fields",
			doctype: "Property Setter",
		});
		let add = new frappe.ui.Dialog({
			title: "Add Property",
			fields: fields.message.map((d) => {
				return {
					label: d.label,
					fieldname: d.fieldname,
					fieldtype: d.fieldtype,
					options: d.options,
					default: d.fieldname == "property" ? new_property : "",
					reqd: d.reqd,
					read_only: d.fieldname == "property" ? 1 : 0,
				};
			}),
			primary_action_label: "Add",
			primary_action: async function () {
				let res = await this.sva_db.call({
					method: "frappe.desk.form.save.savedocs",
					args: {
						doc: {
							doctype: "Property Setter",
							doc_type: doctype,
							doctype_or_field: add.fields_dict.doctype_or_field.get_value(),
							property: new_property,
							row_name: add.fields_dict.row_name.get_value(),
							module: add.fields_dict.module.get_value(),
							value: add.fields_dict.value.get_value(),
							property_type: add.fields_dict.property_type.get_value(),
							default_value: add.fields_dict.default_value.get_value(),
						},
						action: "Save",
					},
				});
				if (res?.docs?.length > 0) {
					frappe.msgprint("Property set successfully");
					add.hide();
				}
			},
		});
		add.show();
	}

	setupDTTriggers(frm) {
		if (!frm.dt_events) {
			frm["dt_events"] = {};
		}
		if (this.dts?.triggers?.length) {
			for (const trigger of this.dts.triggers) {
				let targets = JSON.parse(trigger.targets || "[]");
				if (!targets.length) continue;
				if (trigger.table_type == "Custom Design") {
					this.bindCustomDesignActionEvents(frm, trigger, targets);
				} else {
					this.bindDTActionEvents(frm, trigger, targets);
				}
			}
		}
	}
	bindDTActionEvents(frm, trigger, targets) {
		let dt = trigger.ref_doctype;
		let action = trigger.action;
		if (!frm.dt_events?.[dt]) {
			frm.dt_events[dt] = {};
		}
		if (action == "Create") {
			if (!frm.dt_events[dt]["after_insert"]) {
				frm.dt_events[dt]["after_insert"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
		if (action == "Update") {
			if (!frm.dt_events[dt]["after_update"]) {
				frm.dt_events[dt]["after_update"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
		if (action == "Delete") {
			if (!frm.dt_events[dt]["after_delete"]) {
				frm.dt_events[dt]["after_delete"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
		if (action == "Workflow Action") {
			if (!frm.dt_events[dt]["after_workflow_action"]) {
				frm.dt_events[dt]["after_workflow_action"] = (dt, action) => {
					let states_for_action = JSON.parse(trigger?.workflow_states || "[]");
					if (
						states_for_action.length &&
						states_for_action.includes(action?.next_state)
					) {
						this.triggerTargets(targets);
					}
				};
			}
		}
	}
	bindCustomDesignActionEvents(frm, trigger, targets) {
		let dt;
		switch (trigger.custom_design) {
			case "Tasks":
				dt = "ToDo";
				break;
			case "Linked Users":
				dt = "SVA User";
				break;
			default:
				dt = null;
		}
		if (!dt) return;
		let action = trigger.action;
		if (!frm.dt_events?.[dt]) {
			frm.dt_events[dt] = {};
		}
		if (action == "Create") {
			if (!frm.dt_events[dt]["after_insert"]) {
				frm.dt_events[dt]["after_insert"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
		if (action == "Update") {
			if (!frm.dt_events[dt]["after_update"]) {
				frm.dt_events[dt]["after_update"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
		if (action == "Delete") {
			if (!frm.dt_events[dt]["after_delete"]) {
				frm.dt_events[dt]["after_delete"] = () => {
					this.triggerTargets(targets);
				};
			}
		}
	}
	triggerTargets(targets) {
		for (const target of targets) {
			if (target.type == "Data Table") {
				if (this.frm?.["sva_tables"]?.[target.name]) {
					this.frm["sva_tables"][target.name].reloadTable();
				}
			}
			if (target.type == "Number Card") {
				if (this.frm?.["sva_cards"]?.[target.name]) {
					this.frm["sva_cards"][target.name].refresh();
				}
			}
			if (target.type == "Chart") {
				if (this.frm?.["sva_charts"]?.[target.name]) {
					this.frm["sva_charts"][target.name].refresh();
				}
			}
		}
	}
	createRequestController(tabField) {
		if (this.pendingRequests.has(tabField)) {
			this.pendingRequests.get(tabField).abort();
			this.pendingRequests.delete(tabField);
		}

		const controller = new AbortController();
		this.pendingRequests.set(tabField, controller);
		return controller;
	}

	async makeRequest(requestFn, signal) {
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(new DOMException("Aborted", "AbortError"));
				return;
			}

			signal.addEventListener("abort", () => {
				reject(new DOMException("Aborted", "AbortError"));
			});

			Promise.resolve(requestFn()).then(resolve).catch(reject);
		});
	}

	getDataElement = (fieldname) => {
		return new Promise((resolve) => {
			const element = document.querySelector(`[data-fieldname="${fieldname}"]`);
			if (element) {
				resolve(element);
				return;
			}

			const TIMEOUT = 5000;
			const INTERVAL = 500;
			let elapsed = 0;

			const interval = setInterval(() => {
				const element = document.querySelector(`[data-fieldname="${fieldname}"]`);
				elapsed += INTERVAL;

				if (element || elapsed >= TIMEOUT) {
					clearInterval(interval);
					resolve(element || null);
				}
			}, INTERVAL);
		});
	};

	async tabContent(frm, tab_field) {
		const controller = this.createRequestController(tab_field);
		const signal = controller.signal;
		try {
			const tab_fields = this.getTabFields(frm, tab_field);
			const { dtFields, vm_fields, vm_all_fields } = this.processConfigurationFields(
				this.dts,
				tab_fields
			);
			const relevant_html_fields = [...dtFields.map((f) => f.html_field), ...vm_fields];
			this.clearOtherMappedFields(this.dts, relevant_html_fields, vm_all_fields, frm);
			await this.handleBlocks(frm, tab_fields, signal);
			await this.initializeDashboards(this.dts, frm, tab_fields, signal);
			await this.processDataTables(dtFields, frm, this.dts, signal);
			if (frm?.events?.after_sva_dt_load) {
				frm.events.after_sva_dt_load(frm);
			}
		} catch (error) {
			if (error.name === "AbortError") {
				console.error("Request aborted due to tab switch");
			} else {
				console.error("Error in tabContent:", error);
				frappe.show_alert({
					message: __("Error loading tab content"),
					indicator: "red",
				});
			}
		}
	}

	getTabFields(frm, tab_field) {
		if (!tab_field) {
			return (
				frm?.meta?.fields
					?.filter((f) => f.fieldtype === "HTML")
					?.map((f) => f.fieldname) || []
			);
		}
		const tab_fields = [];
		const tab_field_index =
			tab_field === "__details"
				? 0
				: frm?.meta?.fields?.findIndex((f) => f.fieldname === tab_field);

		if (tab_field_index === -1 || tab_field_index + 1 > frm?.meta?.fields.length) {
			return tab_fields;
		}

		for (let i = tab_field_index + 1; i < frm?.meta?.fields.length; i++) {
			const f = frm?.meta?.fields[i];
			if (f.fieldtype === "Tab Break") break;
			if (f.fieldtype === "HTML") tab_fields.push(f.fieldname);
		}
		return tab_fields;
	}

	getTabFieldsJSON(frm, tab_field) {
		if (!tab_field) {
			return (
				frm?.meta?.fields
					?.filter((f) => ["Link", "Table MultiSelect", "Button"].includes(f.fieldtype))
					?.map((f) => f) || []
			);
		}
		const tab_fields = [];
		const tab_field_index =
			tab_field === "__details"
				? 0
				: frm?.meta?.fields?.findIndex((f) => f.fieldname === tab_field);

		if (tab_field_index === -1 || tab_field_index + 1 > frm?.meta?.fields.length) {
			return tab_fields;
		}

		for (let i = tab_field_index + 1; i < frm?.meta?.fields.length; i++) {
			const f = frm?.meta?.fields[i];
			if (f.fieldtype === "Tab Break") break;
			if (["Link", "Table MultiSelect", "Button"].includes(f.fieldtype)) tab_fields.push(f);
		}
		return tab_fields;
	}

	processConfigurationFields(dts, tab_fields) {
		const dtFields =
			dts.child_doctypes?.filter(
				(f) => tab_fields.includes(f.html_field) && !f.hide_table
			) || [];

		const cards_fields = (
			dts?.number_cards?.filter((f) => tab_fields.includes(f.html_field)) || []
		).map((f) => f.html_field);
		const charts_fields = (
			dts?.charts?.filter((f) => tab_fields.includes(f.html_field)) || []
		).map((f) => f.html_field);
		const vm_fields = [...cards_fields, ...charts_fields];
		const vm_all_fields = [
			...(dts?.number_cards?.map((f) => f.html_field) || []),
			...(dts?.charts?.map((f) => f.html_field) || []),
		];
		return { dtFields, vm_fields, vm_all_fields };
	}

	clearOtherMappedFields(dts, relevant_html_fields, vm_all_fields, frm) {
		const other_mapped_fields = [
			...(
				dts.child_doctypes?.filter((f) => !relevant_html_fields.includes(f.html_field)) ||
				[]
			).map((f) => f.html_field),
			...vm_all_fields.filter((f) => !relevant_html_fields.includes(f)),
		];

		other_mapped_fields.forEach((field) => {
			frm.set_df_property(field, "options", "");
		});
	}
	async handleBlocks(frm, tab_fields, signal = null) {
		frm.sva_ft_instances = {};
		const custom_blocks = frm.meta.fields
			.filter((f) => tab_fields.includes(f.fieldname))
			?.filter((f) => f.sva_ft)
			?.filter((f) => {
				try {
					return JSON.parse(f.sva_ft);
				} catch (error) {
					return false;
				}
			});
		let promises = [];
		for (const field of custom_blocks) {
			let f = { ...field, sva_ft: JSON.parse(field.sva_ft) };
			promises.push(this.renderCustomBlock(frm, f, signal));
		}
		await Promise.all(promises);
	}
	renderCustomBlock = async (frm, field, signal = null) => {
		let wrapper = document.createElement("div");
		frm.set_df_property(field.fieldname, "options", wrapper);
		switch (field.sva_ft.property_type) {
			case "Custom HTML Block":
				if (field.sva_ft.html_block) {
					let html = await frappe.db.get_doc(
						"Custom HTML Block",
						field.sva_ft.html_block
					);
					if (html) {
						frappe.create_shadow_element(wrapper, html.html, html.style, html.script);
					}
				}
				break;
			case "Number Card":
				if (field.sva_ft.number_card) {
					createApp({
						render: () => h(NumberCardSkeleton),
					}).mount(wrapper);
					let card_doc = await frappe.db.get_doc(
						"Number Card",
						field.sva_ft.number_card
					);
					if (card_doc.type == "Report" && card_doc.report_name) {
						card_doc.report = await frappe.db.get_doc("Report", card_doc.report_name);
					}
					let item = {
						html_field: field.fieldname,
						fetch_from: "Number Card",
						number_card: field.sva_ft.number_card,
						card_label: field.sva_ft.label || card_doc.label || "Untitled",
						details: card_doc,
						listview_settings: field.sva_ft.listview_settings || null,
						report: card_doc.report || null,
						icon_value: field.sva_ft.icon || null,
						icon_color: field.sva_ft.icon_color || null,
						background_color: field.sva_ft.background_color || null,
						hover_background_color: field.sva_ft.card_hover_background_color || null,
						hover_text_color: field.sva_ft.card_hover_text_color || null,
						hover_value_color: field.sva_ft.card_hover_value_color || null,
						text_color: field.sva_ft.text_color || null,
						value_color: field.sva_ft.value_color || null,
						border_color: field.sva_ft.border_color || null,
					};
					let { _wrapper, ref } = new SVADashboardManager({
						wrapper,
						frm,
						numberCards: [item],
						signal,
					});
					frm.sva_ft_instances[field.fieldname] = ref;
					wrapper._dashboard = _wrapper;
				}
				break;

			case "Dashboard Chart":
				if (field.sva_ft.chart) {
					createApp({
						render: () => h(ChartSkeleton),
					}).mount(wrapper);
					let chart_doc = await frappe.db.get_doc("Dashboard Chart", field.sva_ft.chart);
					let report_doc = null;
					if (chart_doc.chart_type === "Report" && chart_doc.report_name) {
						report_doc = await frappe.db.get_doc("Report", chart_doc.report_name);
					}
					let item = {
						...field.sva_ft,
						fetch_from: "Dashboard Chart",
						chart_label: field.sva_ft.label || chart_doc.chart_name,
						details: chart_doc,
						report: report_doc,
						html_field: field.fieldname,
					};
					let { _wrapper, ref } = new SVADashboardManager({
						wrapper,
						frm,
						charts: [item],
						signal,
					});
					frm.sva_ft_instances[field.fieldname] = ref;
					wrapper._dashboard = _wrapper;
				}
				break;
			case "DocType (Direct)":
			case "DocType (Indirect)":
			case "DocType (Referenced)":
			case "DocType (Unfiltered)":
			case "Report":
			case "Is Custom Design":
				if (field.sva_ft.property_type === "Is Custom Design") {
					field.sva_ft["connection_type"] = "Is Custom Design";
				}
				if (!field.sva_ft?.connection_type || field.sva_ft?.hide_table) break;
				field.sva_ft["html_field"] = field.fieldname;
				field.sva_ft["configuration_basis"] = "Property Setter";
				if (frm.is_new()) {
					await this.renderLocalFormMessage(field.sva_ft, frm);
				} else {
					await this.renderSavedFormContent(field.sva_ft, frm, field.sva_ft, signal);
				}
				break;
			case "Heatmap (India Map)":
				field.sva_ft["report"] = field.sva_ft["heatmap_report"];
				frm.sva_ft_instances[field.fieldname] = new SVAHeatmap({
					wrapper: $(wrapper),
					...(field?.sva_ft || {}),
					html_field: field.fieldname,
					frm,
				});
				break;
			case "Carousel":
				frm.sva_ft_instances[field.fieldname] = new SVACarousel({
					wrapper: $(wrapper),
					conf: field?.sva_ft || {},
					html_field: field.fieldname,
					frm,
				});
				break;
			case "SDG Wheel":
				frm.sva_ft_instances[field.fieldname] = new SVASDGWheel({
					wrapper: wrapper,
					conf: field?.sva_ft || {},
					html_field: field.fieldname,
					frm,
				});
				break;
		}
	};
	async initializeDashboards(dts, frm, currentTabFields, signal) {
		const initDashboard = async (item, type) => {
			if (!currentTabFields.includes(item.html_field)) return;

			const wrapper = document.createElement("div");
			const wrapperId = `${item.html_field}-wrapper`;
			wrapper.id = wrapperId;
			this.activeComponents.add(wrapperId);

			frm.set_df_property(item.html_field, "options", wrapper);
			let { _wrapper, ref } = new SVADashboardManager({
				wrapper,
				frm,
				numberCards: type === "card" ? [item] : [],
				charts: type === "chart" ? [item] : [],
				signal,
			});
			if (item.parentfield == "number_cards") {
				if (!frm.sva_cards) {
					frm.sva_cards = {};
				}
				frm.sva_cards[item.number_card] = ref;
			}
			if (item.parentfield == "charts") {
				if (!frm.sva_charts) {
					frm.sva_charts = {};
				}
				frm.sva_charts[item.chart] = ref;
			}
			wrapper._dashboard = _wrapper;
		};

		// let loader = new Loader(this.wrapper);
		// loader.show();
		await Promise.all([
			...(dts?.number_cards || []).map((card) => initDashboard(card, "card")),
			...(dts?.charts || []).map((chart) => initDashboard(chart, "chart")),
		]);
		// loader.hide();
	}

	async processDataTables(dtFields, frm, dts, signal) {
		if (!this.sva_tables) {
			this.sva_tables = {};
		}
		for (const field of dtFields) {
			try {
				if (signal.aborted) break;

				if (frm.is_new()) {
					await this.renderLocalFormMessage(field, frm);
				} else {
					await this.renderSavedFormContent(field, frm, dts, signal);
				}
			} catch (error) {
				if (error.name === "AbortError") throw error;
				console.error(`Error processing datatable for field ${field.html_field}:`, error);
			}
		}
	}

	async renderLocalFormMessage(field, frm) {
		const element = await this.getDataElement(field.html_field);
		if (!element?.querySelector("#form-not-saved")) {
			const message = __(
				`Save ${__(frm.doctype)} to add ${__(
					field?.connection_type === "Is Custom Design"
						? field?.template
						: ["Direct", "Unfiltered", "Indirect"].includes(field.connection_type)
						? field.link_doctype
						: field.referenced_link_doctype
				)} items`
			);
			element.innerHTML = `
                <div style="height: 150px; gap: 10px;" id="form-not-saved" class="d-flex flex-column justify-content-center align-items-center p-3 card rounded my-3">
                    <svg class="icon icon-xl" style="stroke: var(--text-light);">
					    <use href="#icon-small-file"></use>
				    </svg>
                    ${message}
                </div>`;
		}
	}

	async renderSavedFormContent(field, frm, dts, signal) {
		const element = await this.getDataElement(field.html_field);
		element?.querySelector("#form-not-saved")?.remove();

		if (field?.connection_type === "Is Custom Design") {
			await this.renderCustomComponent(frm, field.html_field, field.template, field, signal);
		} else {
			await this.initializeSvaDataTable(field, frm, dts, signal);
		}
	}

	getComponentClass(template) {
		const componentMap = {
			Gallery: SVAGalleryComponent,
			Email: SVAEmailComponent,
			Tasks: SVAmGrantTask,
			Timeline: SVATimelineGenerator,
			Notes: SVANotesManager,
			"Linked Users": SVALinkedUser,
			"Approval Request": CustomApprovalRequest,
			"HTML View From API": CustomDynamicHtml,
		};
		return componentMap[template];
	}

	// Continuing from handleFieldEvent...
	handleFieldEvent = (eventType) => (e) => {
		if (e && window?.[eventType]) {
			const attrs = ["dt", "dn", "fieldname", "fieldtype", "value"];
			const obj = attrs.reduce((acc, attr) => {
				const value = e?.target?.getAttribute(`data-${attr}`);
				if (value) acc[attr] = value;
				return acc;
			}, {});
			window[eventType](obj);
		}
	};

	apply_custom_filter(field_name, filter_on, frm, filter_value) {
		frm.fields_dict[field_name].get_query = () => ({
			filters: {
				[filter_on]:
					filter_value || frm.doc[filter_on] || __(`please select ${filter_on}`),
			},
			page_length: 1000,
		});
	}

	getPropertySetterData = async (dt) => {
		try {
			const response = await this.sva_db.call({
				method: "frappe_theme.api.get_property_set",
				doctype: dt,
			});
			return response?.message || [];
		} catch (error) {
			console.error("Error fetching property setter data:", error);
			return [];
		}
	};

	goToCommentButton = (frm) => {
		const buttonHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
            <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"/>
        </svg>`;
		frappe.db.get_single_value("My Theme", "hide_form_comment").then((value) => {
			if (value) {
				frm.remove_custom_button(buttonHTML);
			} else {
				frm.add_custom_button(buttonHTML, () => {
					let commentSection = $(frm.$wrapper).find(".form-footer");
					commentSection?.get(0).scrollIntoView({ behavior: "smooth", block: "center" });
				});
			}
		});
	};

	clearPreviousComponents() {
		try {
			// Clean up mounted components
			this.mountedComponents.forEach((cleanup, componentId) => {
				try {
					if (typeof cleanup === "function") {
						cleanup();
					}
					const element = document.getElementById(componentId);
					if (element) {
						if (element._dashboard) {
							element._dashboard.cleanup && element._dashboard.cleanup();
							delete element._dashboard;
						}
						element.replaceWith(element.cloneNode(false));
						element.innerHTML = "";
					}
				} catch (err) {
					console.error(`Error cleaning up component ${componentId}:`, err);
				}
			});

			// Clear tracking maps and sets
			this.mountedComponents.clear();
			this.activeComponents.clear();

			// Clear global event listeners
			this.clearGlobalEventListeners();

			// Reset workflow dialog flag if frm is available
			if (this.frm) {
				this.frm._workflow_dialog_open = false;
			}

			// Clear remaining fields only if frm is available
			// if (this.frm && this.frm.meta) {
			//     this.clearRemainingFields();
			// }
		} catch (error) {
			console.error("Error in clearPreviousComponents:", error);
		}
	}

	clearGlobalEventListeners() {
		try {
			if (window.onFieldClick) window.onFieldClick = null;
			if (window.onFieldValueChange) window.onFieldValueChange = null;
		} catch (error) {
			console.error("Error clearing global event listeners:", error);
		}
	}

	clearRemainingFields() {
		try {
			if (!this.frm?.meta?.fields) return;

			const htmlFields = this.frm.meta.fields.filter((f) => f.fieldtype === "HTML");
			htmlFields.forEach((field) => {
				try {
					const element = document.querySelector(
						`[data-fieldname="${field.fieldname}"]`
					);
					if (element) {
						element.innerHTML = "";
						if (this.frm.set_df_property) {
							this.frm.set_df_property(field.fieldname, "options", "");
						}
					}
				} catch (err) {
					console.error(`Error clearing field ${field.fieldname}:`, err);
				}
			});
		} catch (error) {
			console.error("Error in clearRemainingFields:", error);
		}
	}

	async renderCustomComponent(frm, fieldname, template, conf, signal) {
		const el = document.createElement("div");
		const componentId = `custom-component-${fieldname}`;
		el.id = componentId;

		// Register component before mounting
		this.activeComponents.add(componentId);

		frm.set_df_property(fieldname, "options", el);

		const loader = new Loader(el, componentId);
		try {
			loader.show();
			if (signal.aborted) return;
			const ComponentClass = this.getComponentClass(template);
			let instance = new ComponentClass(frm, el, conf, { signal });
			frm.sva_ft_instances[fieldname] = instance;
			// Store cleanup function
			this.mountedComponents.set(componentId, () => {
				if (instance.cleanup) {
					instance.cleanup();
				}
				if (instance.destroy) {
					instance.destroy();
				}
				if (instance.unmount) {
					instance.unmount();
				}
			});
		} catch (error) {
			if (error.name !== "AbortError") {
				console.error(`Error rendering component ${template}:`, error);
				el.innerHTML = `<div class="error-message">Error loading component</div>`;
			}
		} finally {
			loader.hide();
		}
	}

	async initializeSvaDataTable(field, frm, dts, signal) {
		const childLinks =
			dts?.child_confs?.filter((f) => f.parent_doctype === field.link_doctype) || [];
		const wrapper = document.createElement("div");
		const wrapperId = `sva-datatable-wrapper-${field.html_field}`;
		wrapper.id = wrapperId;

		let loader = new Loader(wrapper);
		loader.show();

		// Register component
		this.activeComponents.add(wrapperId);

		frm.set_df_property(field.html_field, "options", wrapper);

		const instance = new SvaDataTable({
			label:
				field?.title ||
				frm.meta?.fields?.find((f) => f.fieldname === field.html_field)?.label,
			wrapper,
			doctype: ["Direct", "Unfiltered", "Indirect"].includes(field.connection_type)
				? field.link_doctype
				: field.referenced_link_doctype,
			frm,
			connection: field,
			childLinks,
			options: {
				serialNumberColumn: true,
				editable: false,
			},
			signal,
			loader,
			onFieldClick: this.handleFieldEvent("onFieldClick"),
			onFieldValueChange: this.handleFieldEvent("onFieldValueChange"),
		});
		frm.sva_ft_instances[field.html_field] = instance;
		if (!frm.sva_tables) {
			frm.sva_tables = {};
		}
		frm.sva_tables[
			["Direct", "Unfiltered"].includes(field.connection_type)
				? field.link_doctype
				: field.referenced_link_doctype || field.link_report
		] = instance;
		// Store cleanup function
		this.mountedComponents.set(wrapperId, () => {
			if (instance.cleanup) {
				instance.cleanup();
			}
			if (instance.destroy) {
				instance.destroy();
			}
			// Clear any datatable specific resources
			if (instance.datatable) {
				instance.datatable.destroy();
			}
		});

		return instance;
	}

	async _activeTab(frm) {
		try {
			this.dashboard_form_events_handler(frm);
			frm["sva_cards"] = {};
			frm["sva_charts"] = {};
			frm["sva_tables"] = {};
			const newTabField = frm?.get_active_tab()?.df?.fieldname;
			if (!newTabField || newTabField === this.currentTabField) return;

			// Cancel pending requests from previous tab
			if (this.currentTabField && this.pendingRequests.has(this.currentTabField)) {
				this.pendingRequests.get(this.currentTabField).abort("User navigated away");
				this.pendingRequests.delete(this.currentTabField);
			}

			// Assign frm before clearing components
			this.frm = frm;

			// Clean up previous components
			this.clearPreviousComponents();

			// Update current tab
			this.currentTabField = newTabField;

			if (this.currentTabField) {
				await this.tabContent(frm, this.currentTabField);
			}
		} catch (error) {
			if (error.name === "AbortError") {
				console.error("Tab switch cancelled previous requests");
			} else {
				console.error("Error in _activeTab:", error);
			}
		}
	}

	// When the form is being destroyed or navigated away from
	cleanup() {
		this.clearPreviousComponents();
		this.pendingRequests.forEach((controller) => controller.abort());
		this.pendingRequests.clear();
		this.currentTabField = null;
	}
};
