/**
 * List View Column Width & Sticky Override
 * Adds "Width" and "Sticky" config to each field in Frappe's List View Settings popup.
 * Width: multiplier value × 50px. Sticky: pins column to the left.
 * Stored in List View Settings → fields JSON array.
 */

const WIDTH_MULTIPLIER = 50;

function toPixels(value) {
	return (Number(value) || 2) * WIDTH_MULTIPLIER;
}

// Get width & sticky maps from list_view_settings.fields JSON
function getFieldConfigFromSettings(list_view_settings) {
	const widths = {};
	const sticky = {};
	if (!list_view_settings?.fields) return { widths, sticky };
	try {
		const fields = JSON.parse(list_view_settings.fields);
		fields.forEach((f) => {
			if (f.width) widths[f.fieldname] = f.width;
			if (f.sticky) sticky[f.fieldname] = true;
		});
	} catch {}
	return { widths, sticky };
}

const overrideListView = () => {
	const OriginalListView = frappe.views.ListView;

	frappe.views.ListView = class ColumnWidthListView extends OriginalListView {
		constructor(opts) {
			super(opts);
			this.saved_column_widths = {};
			this.saved_sticky_cols = {};
		}

		setup_columns() {
			super.setup_columns();
			const config = getFieldConfigFromSettings(this.list_view_settings);
			this.saved_column_widths = config.widths;
			this.saved_sticky_cols = config.sticky;
		}

		// Calculate left offset for sticky columns
		_getStickyInfo() {
			const stickyFields = [];
			let left = 0;

			for (const col of this.columns) {
				const fieldname = col.df?.fieldname || (col.type === "Status" ? "status_field" : null);
				if (!fieldname) continue;

				if (this.saved_sticky_cols[fieldname]) {
					const widthMultiplier = this.saved_column_widths[fieldname];
					const widthPx = widthMultiplier ? toPixels(widthMultiplier) : 150;
					stickyFields.push({ fieldname, left, widthPx });
					left += widthPx;
				}
			}
			return stickyFields;
		}

		_getStickyStyle(fieldname) {
			if (!this.saved_sticky_cols[fieldname]) return "";
			const stickyInfo = this._getStickyInfo();
			const info = stickyInfo.find((s) => s.fieldname === fieldname);
			if (!info) return "";
			return `position: sticky; left: ${info.left}px; z-index: 2;`;
		}

		get_header_html() {
			if (!this.columns) return;

			const subject_field = this.columns[0].df;
			let subject_html = `
				<span class="level-item select-like">
					<input class="list-header-checkbox list-check-all" type="checkbox" title="${__("Select All")}">
				</span>
				<span class="level-item" data-sort-by="${subject_field.fieldname}"
					title="${__("Click to sort by {0}", [subject_field.label])}">
					${__(subject_field.label)}
				</span>
			`;

			let $columns = this.columns
				.map((col) => {
					const fieldname = col.df?.fieldname || (col.type === "Status" ? "status_field" : null);
					let classes = [
						"list-row-col ellipsis",
						col.type == "Subject" ? "list-subject level" : "hidden-xs",
						col.type == "Tag" ? "tag-col hide" : "",
						frappe.model.is_numeric_field(col.df) ? "text-right" : "",
						col.df?.fieldname || "",
					].join(" ");

					let html = "";
					if (col.type === "Subject") {
						html = subject_html;
					} else {
						const label = __(col.df?.label || col.type, null, col.df?.parent);
						const title = __("Click to sort by {0}", [label]);
						const attrs = fieldname && col.type !== "Status"
							? `data-sort-by="${fieldname}" title="${title}"`
							: "";
						html = `<span ${attrs}>${label}</span>`;
					}

					// Build inline style: width + sticky
					let styles = [];
					const savedMultiplier = fieldname ? this.saved_column_widths[fieldname] : null;
					if (savedMultiplier) {
						const widthPx = toPixels(savedMultiplier);
						styles.push(`width:${widthPx}px; min-width:${widthPx}px; max-width:${widthPx}px; flex: 0 0 ${widthPx}px`);
					}
					const stickyCSS = fieldname ? this._getStickyStyle(fieldname) : "";
					if (stickyCSS) {
						styles.push(stickyCSS);
						classes += " sva-sticky-col";
					}
					const styleAttr = styles.length ? `style="${styles.join("; ")}"` : "";

					return `<div class="${classes}" ${styleAttr} data-col-fieldname="${fieldname || ""}">${html}</div>`;
				})
				.join("");

			if (this.settings.button) {
				$columns += `<div class="list-row-col hidden-xs"></div>`;
			}
			if (this.settings.dropdown_button) {
				$columns += `<div class="list-row-col hidden-xs"></div>`;
			}

			const right_html = `
				<span class="list-count" style=""></span>
				<span class="level-item list-liked-by-me hidden-xs">
					<span title="${__("Liked by me")}">
						<svg class="icon icon-sm like-icon">
							<use href="#icon-heart"></use>
						</svg>
					</span>
				</span>
			`;

			return this.get_header_html_skeleton($columns, right_html);
		}

		get_header_html_skeleton(left = "", right = "") {
			const hasSticky = Object.keys(this.saved_sticky_cols || {}).length > 0;
			const levelLeftClass = hasSticky ? "level-left list-header-subject" : "level-left list-header-subject";
			return `
			<div class="list-row-container">
				<header class="level list-row-head text-muted">
					<div class="${levelLeftClass}">
						${left}
					</div>
					<div class="level-left checkbox-actions">
						<div class="level list-subject">
							<span class="level-item select-like">
								<input class="list-header-checkbox list-check-all" type="checkbox" title="${__("Select All")}">
							</span>
							<span class="level-item list-header-meta"></span>
						</div>
					</div>
					<div class="level-right">
						${right}
					</div>
				</header>
			</div>
			`;
		}

		get_list_row_html_skeleton(left = "", right = "") {
			const hasSticky = Object.keys(this.saved_sticky_cols || {}).length > 0;
			// Remove 'ellipsis' from level-left when sticky columns exist
			// because .ellipsis sets overflow:hidden which breaks position:sticky
			const levelLeftClass = hasSticky ? "level-left" : "level-left ellipsis";
			return `
				<div class="list-row-container" tabindex="1">
					<div class="level list-row">
						<div class="${levelLeftClass}">
							${left}
						</div>
						<div class="level-right text-muted ellipsis">
							${right}
						</div>
					</div>
				</div>
			`;
		}

		get_column_html(col, doc, is_mobile) {
			const html = super.get_column_html(col, doc, is_mobile);
			const fieldname = col.df?.fieldname || (col.type === "Status" ? "status_field" : null);
			if (!fieldname) return html;

			const savedMultiplier = this.saved_column_widths[fieldname];
			const isSticky = this.saved_sticky_cols[fieldname];

			if (savedMultiplier || isSticky) {
				const $wrapper = $("<div>").html(html);
				const $el = $wrapper.children().first();
				if (savedMultiplier) {
					const widthPx = toPixels(savedMultiplier);
					$el.css({ width: widthPx, "min-width": widthPx, "max-width": widthPx, flex: `0 0 ${widthPx}px` });
				}
				if (isSticky) {
					const stickyInfo = this._getStickyInfo();
					const info = stickyInfo.find((s) => s.fieldname === fieldname);
					if (info) {
						$el.css({ position: "sticky", left: info.left, "z-index": 2 });
						$el.addClass("sva-sticky-col");
					}
				}
				$el.attr("data-col-fieldname", fieldname);
				return $wrapper.html();
			}

			return html;
		}

		apply_column_widths() {
			if (this.list_view_settings?.disable_scrolling) return;

			const saved = this.saved_column_widths || {};

			Object.entries(this.column_max_widths).forEach(([fieldname, width]) => {
				const hasSaved = saved[fieldname];
				const finalWidth = hasSaved ? toPixels(saved[fieldname]) : width;
				const isSticky = this.saved_sticky_cols[fieldname];
				const stickyCSS = isSticky ? this._getStickyStyle(fieldname) : "";

				const $els = $(`.list-view .frappe-list .result .level-left .list-row-col.${fieldname}`);
				$els.css({
					width: finalWidth,
					"min-width": hasSaved ? finalWidth : "",
					"max-width": hasSaved ? finalWidth : "",
					flex: hasSaved ? `0 0 ${finalWidth}px` : `1 0 ${finalWidth}px`,
				});
				if (isSticky) {
					const info = this._getStickyInfo().find((s) => s.fieldname === fieldname);
					if (info) {
						$els.css({
							position: "sticky",
							left: info.left,
							"z-index": 2,
													});
					}
				}
			});

			Object.entries(saved).forEach(([fieldname, multiplier]) => {
				if (!this.column_max_widths[fieldname]) {
					const widthPx = toPixels(multiplier);
					const $els = $(`.list-view .frappe-list .result .level-left [data-col-fieldname="${fieldname}"]`);
					$els.css({
						width: widthPx,
						"min-width": widthPx,
						"max-width": widthPx,
						flex: `0 0 ${widthPx}px`,
					});
					if (this.saved_sticky_cols[fieldname]) {
						const info = this._getStickyInfo().find((s) => s.fieldname === fieldname);
						if (info) {
							$els.css({
								position: "sticky",
								left: info.left,
								"z-index": 2,
															});
						}
					}
				}
			});
		}
	};
};

/**
 * Patch ListSettings to add Width and Sticky inputs to each field row.
 */
const patchListSettings = () => {
	const OriginalListView = frappe.views.ListView;
	const originalShowListSettings = OriginalListView.prototype.show_list_settings;

	OriginalListView.prototype.show_list_settings = function () {
		const me = this;

		frappe.model.with_doctype(this.doctype, () => {
			frappe.model.with_doctype("List View Settings", () => {
				const settings = me.list_view_settings || {};
				const doctype = me.doctype;
				const meta = frappe.get_meta(doctype);

				// Parse existing fields
				let fields_data = [];
				if (settings.fields) {
					try { fields_data = JSON.parse(settings.fields); } catch {}
				}

				// Build config maps from existing data
				const widthMap = {};
				const stickyMap = {};
				fields_data.forEach((f) => {
					if (f.width) widthMap[f.fieldname] = f.width;
					if (f.sticky) stickyMap[f.fieldname] = true;
				});

				// If no fields saved, build from meta
				if (!fields_data.length) {
					if (meta.title_field) {
						const tf = frappe.meta.get_docfield(doctype, meta.title_field.trim());
						if (tf) fields_data.push({ fieldname: tf.fieldname, label: __(tf.label, null, doctype) });
					} else {
						fields_data.push({ fieldname: "name", label: __("ID") });
					}
					if (frappe.has_indicator(doctype)) {
						fields_data.push({ fieldname: "status_field", label: __("Status"), type: "Status" });
					}
					meta.fields.forEach((field) => {
						if (
							field.in_list_view &&
							!frappe.model.no_value_type.includes(field.fieldtype) &&
							field.fieldname !== (meta.title_field || "").trim()
						) {
							fields_data.push({ fieldname: field.fieldname, label: __(field.label, null, doctype) });
						}
					});
				}

				// Create dialog
				let list_view_settings_meta = frappe.get_meta("List View Settings");
				let dialog = new frappe.ui.Dialog({
					title: __("{0} List View Settings", [__(doctype)]),
					fields: list_view_settings_meta.fields,
				});
				dialog.set_values(settings);

				// Render fields with width + sticky inputs
				const renderFields = () => {
					let fields_html_field = dialog.get_field("fields_html");
					let wrapper = fields_html_field.$wrapper[0];

					function is_status_field(field) {
						return field.fieldname === "status_field";
					}

					let fieldsHtml = ``;
					const max_fields = 50;

					for (let idx = 0; idx < fields_data.length && idx < max_fields; idx++) {
						let is_sortable = idx == 0 ? `` : `sortable`;
						let show_sortable_handle = idx == 0 ? `hide` : ``;
						let can_remove = idx == 0 || is_status_field(fields_data[idx]) ? `hide` : ``;
						let currentWidth = widthMap[fields_data[idx].fieldname] || 0;
						let isSticky = stickyMap[fields_data[idx].fieldname] ? "checked" : "";

						fieldsHtml += `
							<div class="control-input flex align-center form-control fields_order ${is_sortable}"
								style="display: block; margin-bottom: 5px;" data-fieldname="${fields_data[idx].fieldname}"
								data-label="${fields_data[idx].label}" data-type="${fields_data[idx].type || ""}">

								<div class="row" style="align-items: center;">
									<div class="col-1">
										${frappe.utils.icon("drag", "xs", "", "", "sortable-handle " + show_sortable_handle)}
									</div>
									<div class="col-5" style="padding-left:0px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
										${__(fields_data[idx].label, null, doctype)}
									</div>
									<div class="col-2" style="padding-left:0px;">
										<input type="number" class="form-control input-xs sva-field-width"
											data-fieldname="${fields_data[idx].fieldname}"
											value="${currentWidth}"
											placeholder="0"
											min="0"
											style="height: 26px; font-size: 12px; text-align: center;"
											title="${__("Width (× 50px)")}">
									</div>
									<div class="col-2" style="text-align: center;">
										<input type="checkbox" class="sva-field-sticky"
											data-fieldname="${fields_data[idx].fieldname}"
											${isSticky}
											title="${__("Sticky column")}">
									</div>
									<div class="col-1 ${can_remove}" style="text-align: center;">
										<a class="text-muted remove-field" data-fieldname="${fields_data[idx].fieldname}">
											${frappe.utils.icon("delete", "xs")}
										</a>
									</div>
								</div>
							</div>`;
					}

					fields_html_field.html(`
						<div class="form-group">
							<div class="clearfix">
								<label class="control-label" style="padding-right: 0px;">${__("Fields")}</label>
								<label class="text-extra-muted float-right">
									<a class="add-new-fields text-muted">
										${__("+ Add / Remove Fields")}
									</a>
								</label>
							</div>
							<div class="row" style="padding: 0 15px; margin-bottom: 5px;">
								<div class="col-1"></div>
								<div class="col-5 text-muted" style="padding-left:0px; font-size: 11px;">${__("Field")}</div>
								<div class="col-2 text-muted" style="padding-left:0px; font-size: 11px;">${__("Width")}</div>
								<div class="col-2 text-muted" style="text-align: center; font-size: 11px;">${__("Sticky")}</div>
								<div class="col-1"></div>
							</div>
							<div class="control-input-wrapper">
							${fieldsHtml}
							</div>
						</div>
					`);

					new Sortable(wrapper.getElementsByClassName("control-input-wrapper")[0], {
						handle: ".sortable-handle",
						draggable: ".sortable",
						onUpdate: () => {
							updateFieldsData();
							renderFields();
							setupRemoveFields();
							setupAddNewFields();
						},
					});
				};

				// Update fields_data from DOM
				const updateFieldsData = () => {
					let fields_html_field = dialog.get_field("fields_html");
					let wrapper = fields_html_field.$wrapper[0];
					let fields_order = wrapper.getElementsByClassName("fields_order");

					const newFields = [];
					for (let idx = 0; idx < fields_order.length; idx++) {
						const el = fields_order.item(idx);
						const fn = el.getAttribute("data-fieldname");
						const widthInput = el.querySelector(".sva-field-width");
						const stickyInput = el.querySelector(".sva-field-sticky");
						const w = widthInput ? parseInt(widthInput.value) : 0;
						const s = stickyInput ? stickyInput.checked : false;

						const fieldObj = {
							fieldname: fn,
							label: __(el.getAttribute("data-label")),
						};
						const type = el.getAttribute("data-type");
						if (type) fieldObj.type = type;
						if (w > 0) {
							fieldObj.width = w;
							widthMap[fn] = w;
						} else {
							delete widthMap[fn];
						}
						if (s) {
							fieldObj.sticky = 1;
							stickyMap[fn] = true;
						} else {
							delete stickyMap[fn];
						}
						newFields.push(fieldObj);
					}
					fields_data = newFields;
					dialog.set_value("fields", JSON.stringify(fields_data));
				};

				// Setup remove field handlers
				const setupRemoveFields = () => {
					let fields_html_field = dialog.get_field("fields_html");
					let remove_fields = fields_html_field.$wrapper[0].getElementsByClassName("remove-field");

					for (let idx = 0; idx < remove_fields.length; idx++) {
						remove_fields.item(idx).onclick = () => {
							const fn = remove_fields.item(idx).getAttribute("data-fieldname");
							const existingFieldnames = fields_data.map((f) => f.fieldname);
							fields_data = fields_data.filter((f) => f.fieldname !== fn);
							delete widthMap[fn];
							delete stickyMap[fn];

							if (!dialog._removed_fields) dialog._removed_fields = [];
							const newFieldnames = fields_data.map((f) => f.fieldname);
							existingFieldnames.forEach((c) => {
								if (!newFieldnames.includes(c) && c !== "status_field") {
									dialog._removed_fields.push(c);
								}
							});

							dialog.set_value("fields", JSON.stringify(fields_data));
							renderFields();
							setupRemoveFields();
							setupAddNewFields();
						};
					}
				};

				// Setup add new fields
				const setupAddNewFields = () => {
					let fields_html_field = dialog.get_field("fields_html");
					let addBtn = fields_html_field.$wrapper[0].getElementsByClassName("add-new-fields")[0];
					if (!addBtn) return;

					addBtn.onclick = () => {
						const currentFieldnames = fields_data.map((f) => f.fieldname);
						let multiselect_fields = [];

						meta.fields.forEach((field) => {
							if (!frappe.model.no_value_type.includes(field.fieldtype)) {
								multiselect_fields.push({
									label: __(field.label, null, field.doctype),
									value: field.fieldname,
									checked: currentFieldnames.includes(field.fieldname),
								});
							}
						});

						let d = new frappe.ui.Dialog({
							title: __("{0} Fields", [__(doctype)]),
							fields: [
								{
									label: __("Select Fields"),
									fieldtype: "MultiCheck",
									fieldname: "fields",
									options: multiselect_fields,
									columns: 2,
								},
							],
						});

						d.set_primary_action(__("Save"), () => {
							let values = d.get_values().fields;
							const existingFieldnames = fields_data.map((f) => f.fieldname);

							if (!dialog._removed_fields) dialog._removed_fields = [];
							existingFieldnames.forEach((c) => {
								if (!values.includes(c) && c !== "status_field" && c !== (meta.title_field || "").trim() && c !== "name") {
									dialog._removed_fields.push(c);
								}
							});

							const newFieldsData = [];
							newFieldsData.push(fields_data[0]);
							const statusField = fields_data.find((f) => f.fieldname === "status_field");
							if (statusField) newFieldsData.push(statusField);

							values.forEach((val) => {
								if (val === (fields_data[0]?.fieldname)) return;
								const existing = fields_data.find((f) => f.fieldname === val);
								if (existing) {
									newFieldsData.push(existing);
								} else {
									const field = frappe.meta.get_docfield(doctype, val);
									if (field) {
										newFieldsData.push({
											label: __(field.label, null, doctype),
											fieldname: field.fieldname,
										});
									}
								}
							});

							fields_data = newFieldsData;
							dialog.set_value("fields", JSON.stringify(fields_data));
							d.hide();
							renderFields();
							setupRemoveFields();
							setupAddNewFields();
						});
						d.show();
					};
				};

				// Save handler
				dialog.set_primary_action(__("Save"), () => {
					updateFieldsData();
					let values = dialog.get_values();
					values.fields = JSON.stringify(fields_data);

					frappe.show_alert({ message: __("Saving"), indicator: "green" });

					frappe.call({
						method: "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings",
						args: {
							doctype: doctype,
							listview_settings: values,
							removed_listview_fields: dialog._removed_fields || [],
						},
						callback: function (r) {
							me.refresh_columns(r.message.meta, r.message.listview_settings);
							const config = getFieldConfigFromSettings(r.message.listview_settings);
							me.saved_column_widths = config.widths;
							me.saved_sticky_cols = config.sticky;
							dialog.hide();
						},
					});
				});

				renderFields();
				setupRemoveFields();
				setupAddNewFields();

				if (!dialog.get_value("total_fields")) {
					let field_count = fields_data.length;
					if (field_count < 4) field_count = 4;
					else if (field_count > 10) field_count = 10;
					dialog.set_value("total_fields", settings.total_fields || field_count);
				}

				dialog.show();
			});
		});
	};
};

// CSS for sticky columns to work properly
const injectStickyStyles = () => {
	const style = document.createElement("style");
	style.textContent = `
		/* Allow sticky to work inside level-left */
		.list-view .frappe-list .result .list-row .level-left {
			overflow: visible !important;
		}
		/* Sticky body cells — match page background */
		.list-row .level-left .sva-sticky-col {
			background-color: var(--fg-color, #fff);
		}
		/* Sticky body cells — match hover background */
		.list-row:hover:not(.list-row-head) .level-left .sva-sticky-col {
			background-color: var(--highlight-color);
		}
		/* Sticky header cells — match header background */
		.list-row-head .level-left .sva-sticky-col {
			background-color: var(--subtle-fg, #f4f5f6);
		}
	`;
	document.head.appendChild(style);
};

injectStickyStyles();
patchListSettings();
overrideListView();
