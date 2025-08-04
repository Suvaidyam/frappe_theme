frappe.ui.form.on("Workflow", {
	refresh(frm) {
		// 		console.log('workflow')
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
				.filter((df) => frappe.model.is_value_type(df.fieldtype))
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

			// Create a map for quick access
			const pre_selected_map = {};
			pre_selected_fields.forEach((field) => {
				pre_selected_map[field.fieldname] = field;
			});

			// Reorder fields: selected fields at top in saved order, then unselected
			const selected_fieldnames = pre_selected_fields.map((f) => f.fieldname);
			const selectedFields = [];
			const unselectedFields = [];
			selected_fieldnames.forEach((fname) => {
				const found = fields.find((f) => f.fieldname === fname);
				if (found) selectedFields.push(found);
			});
			fields.forEach((f) => {
				if (!selected_fieldnames.includes(f.fieldname)) unselectedFields.push(f);
			});
			const orderedFields = [...selectedFields, ...unselectedFields];

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
                        grid-template-columns: 24px 1fr 70px 70px 70px;
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
                    </div>
                    <div id="sortable-fields">
            `;

			orderedFields.forEach((field, idx) => {
				const saved = pre_selected_map[field.fieldname];
				const is_included = !!saved;
				const is_read_only = saved?.read_only ? "checked" : "";
				const is_required = saved?.reqd ? "checked" : "";
				const is_fetch_if_exists = saved?.fetch_if_exists ? "checked" : "";
				const row_bg = idx % 2 === 0 ? "var(--control-bg)" : "var(--bg-light-gray)";
				const disabled = is_included ? "" : "disabled";
				// Fix: fetch_if_exists should be disabled if field is not included OR if it's read-only
				const fetch_disabled = is_included && !saved?.read_only ? "" : "disabled";

				html += `
                    <div class="field-row" data-fieldname="${field.fieldname}" style="
                        display: grid;
                        grid-template-columns: 24px 1fr 70px 70px 70px;
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
                                data-fieldname="${field.fieldname}"
                                ${is_included ? "checked" : ""}
                                style="width: 14px; height: 14px; margin: 0;"
                            >
                            <span class="field-label" style="font-size: 13px;">${
								field.label
							}</span>
                        </label>
                        <div style="text-align: center;">
                            <label style="display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 0;">
                                <input type="checkbox"
                                    class="field-readonly"
                                    data-fieldname="${field.fieldname}"
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
                                    data-fieldname="${field.fieldname}"
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
                                    data-fieldname="${field.fieldname}"
                                    ${is_fetch_if_exists}
                                    ${fetch_disabled}
                                    style="width: 14px; height: 14px; margin: 0;"
                                >
                            </label>
                        </div>
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

			// On open: ensure required and fetch_if_exists are disabled if readonly is checked
			$(dialog.fields_dict.field_checkboxes.wrapper)
				.find(".field-row")
				.each(function () {
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
			setTimeout(() => {
				$(dialog.fields_dict.field_checkboxes.wrapper)
					.find(".field-include")
					.on("change", function () {
						const fieldname = $(this).data("fieldname");
						const checked = $(this).is(":checked");
						const $readonly = $(dialog.fields_dict.field_checkboxes.wrapper).find(
							`.field-readonly[data-fieldname='${fieldname}']`
						);
						const $required = $(dialog.fields_dict.field_checkboxes.wrapper).find(
							`.field-required[data-fieldname='${fieldname}']`
						);
						const $fetchIfExists = $(dialog.fields_dict.field_checkboxes.wrapper).find(
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
				$(dialog.fields_dict.field_checkboxes.wrapper)
					.find(".field-readonly")
					.on("change", function () {
						const fieldname = $(this).data("fieldname");
						const checked = $(this).is(":checked");
						const $required = $(dialog.fields_dict.field_checkboxes.wrapper).find(
							`.field-required[data-fieldname='${fieldname}']`
						);
						const $fetchIfExists = $(dialog.fields_dict.field_checkboxes.wrapper).find(
							`.field-fetch-if-exists[data-fieldname='${fieldname}']`
						);
						if (checked) {
							$required.prop("checked", false);
							$required.prop("disabled", true);
							$fetchIfExists.prop("checked", false);
							$fetchIfExists.prop("disabled", true);
						} else {
							// Only enable if the field is included
							const $include = $(dialog.fields_dict.field_checkboxes.wrapper).find(
								`.field-include[data-fieldname='${fieldname}']`
							);
							$required.prop("disabled", !$include.is(":checked"));
							$fetchIfExists.prop("disabled", !$include.is(":checked"));
						}
					});
			}, 0);
		});
	},
});
