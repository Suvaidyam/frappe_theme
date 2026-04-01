frappe.format = function (value, df, options, doc) {
	let mask_readonly = false;
	if (df?.parent) {
		const mask_fields = frappe.get_meta(df.parent)?.masked_fields;
		mask_readonly = mask_fields?.includes(df.fieldname);
	}

	if (!df || mask_readonly) df = { fieldtype: "Data" };
	if (df.fieldname == "_user_tags") df = { ...df, fieldtype: "Tag" };
	var fieldtype = df.fieldtype || "Data";

	// format Dynamic Link as a Link
	if (fieldtype === "Dynamic Link") {
		fieldtype = "Link";
		df._options = doc ? doc[df.options] : null;
	}

	var formatter = df.formatter || frappe.form.get_formatter(fieldtype);

	var formatted = formatter(value, df, options, doc);

	if (typeof formatted == "string") formatted = frappe.dom.remove_script_and_style(formatted);

	return formatted;
};

frappe.ui.form.on("Workflow", {
	refresh(frm) {
		let states = frm.doc.states || [];
		let state_names = states?.map((state) => state.state);
		frm.set_query("custom_positive_state", "transitions", function () {
			return {
				filters: {
					workflow_state_name: ["in", state_names],
				},
			};
		});
		frm.set_query("custom_negative_state", "transitions", function () {
			return {
				filters: {
					workflow_state_name: ["in", state_names],
				},
			};
		});
	},
});

frappe.ui.form.on("Workflow Transition", {
	custom_setup_fields: function (frm, cdt, cdn) {
		const child = locals[cdt][cdn];
		const doctype = frm.doc.document_type;

		if (!doctype) {
			frappe.msgprint("Please select Document Type first.");
			return;
		}

		frappe.model.with_doctype(doctype, () => {
			const meta = frappe.get_meta(doctype);

			const fields = meta.fields
				.filter(
					(df) => frappe.model.is_value_type(df.fieldtype) || df.fieldtype === "Table"
				)
				.map((df) => ({
					label: df.label || df.fieldname,
					fieldname: df.fieldname,
				}));

			if (fields.length === 0) {
				frappe.msgprint("No fields found to select.");
				return;
			}

			// Parse saved JSON field selections
			let pre_selected_fields = [];
			try {
				if (child.custom_selected_fields) {
					pre_selected_fields = JSON.parse(child.custom_selected_fields);
				}
			} catch (e) {
				console.warn("Invalid JSON in custom_selected_fields");
			}

			// Create a map for quick access (regular fields only)
			const pre_selected_map = {};
			pre_selected_fields.forEach((item) => {
				if (item.fieldname) {
					pre_selected_map[item.fieldname] = item;
				}
			});

			// Build ordered list: saved items (fields + layout breaks) in order, then unselected fields
			const selected_fieldnames = pre_selected_fields
				.filter((i) => i.fieldname)
				.map((i) => i.fieldname);

			// orderedItems = interleaved list of {type: "field"|"layout", ...}
			const orderedItems = [];
			pre_selected_fields.forEach((item) => {
				if (item.fieldtype === "Section Break" || item.fieldtype === "Column Break") {
					orderedItems.push({
						type: "layout",
						fieldtype: item.fieldtype,
						label: item.label || "",
						hide_border: item.hide_border || false,
					});
				} else if (item.fieldname) {
					const found = fields.find((f) => f.fieldname === item.fieldname);
					if (found) orderedItems.push({ type: "field", ...found });
				}
			});
			// Append unselected regular fields at the end
			fields.forEach((f) => {
				if (!selected_fieldnames.includes(f.fieldname)) {
					orderedItems.push({ type: "field", ...f });
				}
			});

			// Helper: build layout break row HTML
			function layoutBreakRowHtml(fieldtype, label, idx, hide_border) {
				const row_bg = idx % 2 === 0 ? "var(--control-bg)" : "var(--bg-light-gray)";
				const isSection = fieldtype === "Section Break";
				const badge_color = isSection ? "var(--blue-100)" : "var(--gray-200)";
				const badge_text_color = isSection ? "var(--blue-700)" : "var(--gray-700)";
				return `
                    <div class="field-row layout-break-row" data-fieldtype="${fieldtype}" style="
                        display: grid;
                        grid-template-columns: 24px 1fr 70px 70px 70px 28px;
                        gap: 0;
                        align-items: center;
                        padding: 4px 12px;
                        background: ${row_bg};
                        border-bottom: 1px solid var(--border-color);
                        font-size: 13px;
                    ">
                        <span class="drag-handle" style="cursor: grab; color: var(--gray-500); display: flex; align-items: center; justify-content: center;">
                            ${frappe.utils.icon("drag", "xs", "", "", "sortable-handle ")}
                        </span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="
                                background: ${badge_color};
                                color: ${badge_text_color};
                                font-size: 11px;
                                font-weight: 600;
                                padding: 2px 8px;
                                border-radius: 10px;
                                white-space: nowrap;
                            ">${fieldtype}</span>
                            ${
								isSection
									? `<input type="text" class="section-label-input" placeholder="Label (optional)" value="${frappe.utils.escape_html(
											label
									  )}" style="
                                border: 1px solid var(--border-color);
                                border-radius: 3px;
                                padding: 2px 6px;
                                font-size: 12px;
                                background: var(--control-bg);
                                color: var(--text-color);
                                flex: 1;
                                min-width: 0;
                            ">
                            <label style="display:flex; align-items:center; gap:4px; margin-bottom:0; font-size:12px; color:var(--text-muted); white-space:nowrap; cursor:pointer;">
                                <input type="checkbox" class="section-hide-border" ${
									hide_border ? "checked" : ""
								} style="width:13px; height:13px; margin:0;">
                                Hide Border
                            </label>`
									: ""
							}
                        </div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <button class="remove-layout-row btn btn-xs" title="Remove" style="
                            padding: 0 4px;
                            line-height: 1.4;
                            font-size: 14px;
                            color: var(--gray-600);
                            background: transparent;
                            border: none;
                            cursor: pointer;
                        ">×</button>
                    </div>
                `;
			}

			// Build compact, Frappe-style layout
			let html = `
                <div style="
                    max-height: 340px;
                    overflow-y: auto;
                    padding: 0;
                    background: var(--control-bg);
                    border-radius: 3px;
                    border: 1px solid var(--border-color);
                ">
                    <div style="
                        display: grid;
                        grid-template-columns: 24px 1fr 70px 70px 70px 28px;
                        gap: 0;
                        align-items: center;
                        padding: 6px 12px;
                        background: var(--control-bg);
                        font-weight: 600;
                        color: var(--text-color);
                        border-bottom: 1px solid var(--border-color);
                        font-size: 13px;
                    ">
                        <div></div>
                        <div>Field Name</div>
                        <div style="text-align: center;">Read Only</div>
                        <div style="text-align: center;">Required</div>
                        <div style="text-align: center;">Fetch If Exists</div>
                        <div></div>
                    </div>
                    <div id="sortable-fields">
            `;

			orderedItems.forEach((item, idx) => {
				const row_bg = idx % 2 === 0 ? "var(--control-bg)" : "var(--bg-light-gray)";

				if (item.type === "layout") {
					html += layoutBreakRowHtml(item.fieldtype, item.label, idx, item.hide_border);
					return;
				}

				// Regular field row
				const saved = pre_selected_map[item.fieldname];
				const is_included = !!saved;
				const is_read_only = saved?.read_only ? "checked" : "";
				const is_required = saved?.reqd ? "checked" : "";
				const is_fetch_if_exists = saved?.fetch_if_exists ? "checked" : "";
				const disabled = is_included ? "" : "disabled";
				const fetch_disabled = is_included && !saved?.read_only ? "" : "disabled";

				html += `
                    <div class="field-row" data-fieldname="${item.fieldname}" style="
                        display: grid;
                        grid-template-columns: 24px 1fr 70px 70px 70px 28px;
                        gap: 0;
                        align-items: center;
                        padding: 4px 12px;
                        background: ${row_bg};
                        border-bottom: 1px solid var(--border-color);
                        font-size: 13px;
                    ">
                        <span class="drag-handle" style="cursor: grab; color: var(--gray-500); display: flex; align-items: center; justify-content: center;">
                            ${frappe.utils.icon("drag", "xs", "", "", "sortable-handle ")}
                        </span>
                        <label style="
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            cursor: pointer;
                            font-weight: 400;
                            color: var(--text-color);
                            margin-bottom: 0;
                        ">
                            <input type="checkbox"
                                class="field-include"
                                data-fieldname="${item.fieldname}"
                                ${is_included ? "checked" : ""}
                                style="width: 14px; height: 14px; margin: 0;"
                            >
                            <span class="field-label" style="font-size: 13px;">${item.label}</span>
                        </label>
                        <div style="text-align: center;">
                            <label style="display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 0;">
                                <input type="checkbox"
                                    class="field-readonly"
                                    data-fieldname="${item.fieldname}"
                                    ${is_read_only}
                                    ${disabled}
                                    style="width: 14px; height: 14px; margin: 0;"
                                >
                            </label>
                        </div>
                        <div style="text-align: center;">
                            <label style="display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 0;">
                                <input type="checkbox"
                                    class="field-required"
                                    data-fieldname="${item.fieldname}"
                                    ${is_required}
                                    ${disabled}
                                    style="width: 14px; height: 14px; margin: 0;"
                                >
                            </label>
                        </div>
                        <div style="text-align: center;">
                            <label style="display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 0;">
                                <input type="checkbox"
                                    class="field-fetch-if-exists"
                                    data-fieldname="${item.fieldname}"
                                    ${is_fetch_if_exists}
                                    ${fetch_disabled}
                                    style="width: 14px; height: 14px; margin: 0;"
                                >
                            </label>
                        </div>
                        <div></div>
                    </div>
                `;
			});

			html += `</div></div>`;

			const dialog = new frappe.ui.Dialog({
				title: `Select Fields from ${doctype}`,
				size: "large",
				fields: [
					{
						fieldname: "search_field",
						fieldtype: "Data",
						label: "Search Fields",
						placeholder: "Type to search fields...",
						onchange: function () {
							const searchTerm = this.value?.toLowerCase() || "";
							$(dialog.fields_dict.field_checkboxes.wrapper)
								.find(".field-row")
								.each(function () {
									// Always show layout break rows during search
									if ($(this).hasClass("layout-break-row")) {
										$(this).show();
										return;
									}
									const fieldLabel = $(this)
										.find(".field-label")
										.text()
										.toLowerCase();
									if (fieldLabel.includes(searchTerm)) {
										$(this).show();
									} else {
										$(this).hide();
									}
								});
						},
						reqd: 0,
						input_class: "search-input-left",
					},
					{ fieldtype: "Column Break" },
					{
						fieldname: "layout_buttons",
						fieldtype: "HTML",
						options: `<div style="display:flex; gap:8px; justify-content:flex-end; padding-top:20px;">
							<button class="btn btn-xs btn-default add-section-break-btn" style="font-size:12px;">+ Section Break</button>
							<button class="btn btn-xs btn-default add-column-break-btn" style="font-size:12px;">+ Column Break</button>
						</div>`,
					},
					{ fieldtype: "Column Break" },
					{ fieldtype: "Section Break" },
					{
						fieldname: "field_checkboxes",
						fieldtype: "HTML",
					},
				],
				primary_action_label: "Save Selection",
				primary_action() {
					const selected_fields = [];
					// Use the order of .field-row in the DOM
					$(dialog.fields_dict.field_checkboxes.wrapper)
						.find("#sortable-fields .field-row")
						.each(function () {
							const fieldtype = $(this).data("fieldtype");

							// Layout break row
							if (fieldtype === "Section Break" || fieldtype === "Column Break") {
								const label = $(this).find(".section-label-input").val() || "";
								const hide_border = $(this)
									.find(".section-hide-border")
									.is(":checked");
								selected_fields.push({
									fieldtype,
									...(label ? { label } : {}),
									...(hide_border ? { hide_border: true } : {}),
								});
								return;
							}

							// Regular field row
							const fieldname = $(this).data("fieldname");
							const label =
								fields.find((f) => f.fieldname === fieldname)?.label || fieldname;
							const include = $(this).find(".field-include").is(":checked");
							if (!include) return;
							const read_only = $(this).find(".field-readonly").is(":checked");
							const reqd = $(this).find(".field-required").is(":checked");
							const fetch_if_exists = $(this)
								.find(".field-fetch-if-exists")
								.is(":checked");
							selected_fields.push({
								fieldname,
								label,
								read_only,
								reqd,
								fetch_if_exists,
							});
						});
					frappe.model.set_value(
						cdt,
						cdn,
						"custom_selected_fields",
						JSON.stringify(selected_fields)
					);
					frappe.show_alert({
						message: __("Fields saved successfully"),
						indicator: "green",
					});
					dialog.hide();
				},
				secondary_action_label: "Cancel",
				secondary_action() {
					dialog.hide();
				},
			});

			// After dialog is shown, initialize SortableJS
			dialog.show();
			dialog.fields_dict.field_checkboxes.$wrapper.html(html);
			frappe.require("assets/frappe/js/lib/sortable.min.js", () => {
				new Sortable(
					dialog.fields_dict.field_checkboxes.$wrapper.find("#sortable-fields")[0],
					{
						handle: ".drag-handle",
						animation: 150,
						ghostClass: "sortable-ghost",
					}
				);
			});

			// Add Section Break / Column Break buttons
			setTimeout(() => {
				const $wrapper = $(dialog.fields_dict.field_checkboxes.wrapper);
				const $sortable = $wrapper.find("#sortable-fields");

				$(dialog.body)
					.find(".add-section-break-btn")
					.on("click", function () {
						const idx = $sortable.find(".field-row").length;
						$sortable.prepend(layoutBreakRowHtml("Section Break", "", idx));
					});
				$(dialog.body)
					.find(".add-column-break-btn")
					.on("click", function () {
						const idx = $sortable.find(".field-row").length;
						$sortable.prepend(layoutBreakRowHtml("Column Break", "", idx));
					});

				// Remove layout row
				$sortable.on("click", ".remove-layout-row", function () {
					$(this).closest(".field-row").remove();
				});

				// On open: ensure required and fetch_if_exists are disabled if readonly is checked
				$wrapper.find(".field-row:not(.layout-break-row)").each(function () {
					const $readonly = $(this).find(".field-readonly");
					const $required = $(this).find(".field-required");
					const $fetchIfExists = $(this).find(".field-fetch-if-exists");
					if ($readonly.is(":checked")) {
						$required.prop("checked", false);
						$required.prop("disabled", true);
						$fetchIfExists.prop("checked", false);
						$fetchIfExists.prop("disabled", true);
					}
				});

				// Add event listener to enable/disable read_only and required checkboxes
				$wrapper.find(".field-include").on("change", function () {
					const fieldname = $(this).data("fieldname");
					const checked = $(this).is(":checked");
					const $readonly = $wrapper.find(
						`.field-readonly[data-fieldname='${fieldname}']`
					);
					const $required = $wrapper.find(
						`.field-required[data-fieldname='${fieldname}']`
					);
					const $fetchIfExists = $wrapper.find(
						`.field-fetch-if-exists[data-fieldname='${fieldname}']`
					);
					$readonly.prop("disabled", !checked);
					$required.prop("disabled", !checked || $readonly.is(":checked"));
					$fetchIfExists.prop("disabled", !checked || $readonly.is(":checked"));
					if (!checked) {
						$required.prop("checked", false);
						$readonly.prop("checked", false);
						$fetchIfExists.prop("checked", false);
					}
				});
				$wrapper.find(".field-readonly").on("change", function () {
					const fieldname = $(this).data("fieldname");
					const checked = $(this).is(":checked");
					const $required = $wrapper.find(
						`.field-required[data-fieldname='${fieldname}']`
					);
					const $fetchIfExists = $wrapper.find(
						`.field-fetch-if-exists[data-fieldname='${fieldname}']`
					);
					if (checked) {
						$required.prop("checked", false);
						$required.prop("disabled", true);
						$fetchIfExists.prop("checked", false);
						$fetchIfExists.prop("disabled", true);
					} else {
						const $include = $wrapper.find(
							`.field-include[data-fieldname='${fieldname}']`
						);
						$required.prop("disabled", !$include.is(":checked"));
						$fetchIfExists.prop("disabled", !$include.is(":checked"));
					}
				});
			}, 0);
		});
	},
	custom_select_role_profile: async function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];

		let existing_values = [];
		if (row.custom_selected_role_profile) {
			try {
				existing_values = JSON.parse(row.custom_selected_role_profile);
			} catch (e) {
				console.warn("Invalid JSON in custom_selected_role_profile");
			}
		}
		let user_role_profile_fields = await frappe.xcall("frappe_theme.dt_api.get_meta_fields", {
			doctype: "User Role Profile",
			_type: "Direct",
		});
		const dialog = new frappe.ui.Dialog({
			title: "Select Role Profiles",
			size: "medium",
			fields: [
				{
					fieldname: "role_profiles",
					label: "Role Profiles",
					options: "User Role Profile",
					fieldtype: "Table MultiSelect",
					fields: user_role_profile_fields,
					reqd: 0,
				},
			],
			primary_action_label: "Save Selection",
			primary_action(values) {
				const selected = values.role_profiles || [];
				frappe.model.set_value(
					cdt,
					cdn,
					"custom_selected_role_profile",
					JSON.stringify(selected)
				);

				frappe.show_alert({
					message: __("Role Profiles saved"),
					indicator: "green",
				});
				dialog.hide();
			},
			secondary_action_label: "Clear Selection",
			secondary_action() {
				frappe.model.set_value(cdt, cdn, "custom_selected_role_profile", "");
				frappe.show_alert({
					message: __("Role Profiles cleared"),
					indicator: "green",
				});
				dialog.hide();
			},
		});

		dialog.show();
		dialog.set_value("role_profiles", existing_values);
	},
});
