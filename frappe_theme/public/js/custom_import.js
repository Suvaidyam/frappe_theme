class CustomListView {
	constructor({ frm, connection }) {
		this.frm = frm;
		this.connection = connection;
		console.log(this.frm, this.connection);
	}
	custom_import() {
		console.log(this);
		// frappe.desk.form.save.savedocs
		let cus_popup = new frappe.ui.Dialog({
			title: __("Data Import"),
			fields: [
				{
					fieldname: "import_type",
					label: __("Import Type"),
					fieldtype: "Select",
					options: ["", "Insert New Records", "Update Existing Records"],
					reqd: 1,
					onchange: () => {
						let importType = cus_popup.get_value("import_type");
						if (importType) {
							frappe.db
								.insert({
									doctype: "Data Import",
									import_type: importType,
									reference_doctype: this.frm.link_doctype,
									user: frappe.session.user,
									status: "Pending",
									docstatus: 0,
								})
								.then((doc) => {
									cus_popup.set_value("name", doc.name);
									frappe.show_alert({
										message: __("Data Import ready to csv upload file"),
										indicator: "green",
									});
								});
						}
					},
				},
				{
					fieldname: "download_template",
					label: __("Download Template"),
					fieldtype: "Button",
					depends_on: "eval: doc.import_type",
					click: () => {
						let importType = cus_popup.get_value("import_type");
						if (importType) {
							frappe.require("data_import_tools.bundle.js", () => {
								new frappe.data_import.DataExporter(
									this.frm.link_doctype,
									importType
								);
							});
						}
					},
				},
				{
					fieldname: "import_file",
					label: __("Import File"),
					fieldtype: "Attach",
					depends_on: "eval: doc.import_type",
					mandatory_depends_on: "eval: doc.import_type",
					onchange: () => {
						let import_file = cus_popup.get_value("import_file");
						let name = cus_popup.get_value("name");
						frappe.db.set_value("Data Import", name, "import_file", import_file);
						if (import_file) {
							this.import_file(import_file, name, cus_popup);
						}
					},
				},
				{
					fieldname: "name",
					label: __("Name"),
					fieldtype: "Data",
					reqd: 1,
					hidden: 1,
				},
				{
					fieldname: "template_options",
					label: __("Template Options"),
					fieldtype: "Code",
					hidden: 1,
				},
				{
					fieldname: "template_warnings",
					label: __("Template Warning"),
					fieldtype: "Code",
					hidden: 1,
				},
				{
					fieldname: "import_warnings",
					label: __("Import Warnings"),
					fieldtype: "HTML",
				},
				{
					fieldname: "tab_import_preview",
					label: __(""),
					fieldtype: "Section Break",
				},
				{
					fieldname: "import_preview",
					label: __("Import Data"),
					fieldtype: "HTML",
				},
			],
			primary_action_label: __("Start Import"),
			primary_action: (values) => {
				frappe
					.call({
						method: "frappe.core.doctype.data_import.data_import.form_start_import",
						args: {
							data_import: values.name,
						},
					})
					.then((r) => {
						frappe.show_alert({
							message: __("Data Import started"),
							indicator: "green",
						});
						// cus_popup.hide();
					});
			},
		});
		cus_popup.show();
	}
	//
	import_file(import_file, name, cus_popup) {
		frappe
			.call({
				method: "frappe.core.doctype.data_import.data_import.get_preview_from_template",
				args: {
					data_import: name,
					import_file: import_file,
				},
				error_handlers: {
					TimestampMismatchError() {
						// ignore this error
					},
				},
			})
			.then((r) => {
				let preview_data = r.message;
				this.preview_data(preview_data, preview_data.import_log, cus_popup);
				this.show_import_warnings(cus_popup, preview_data);
			});
	}
	//
	preview_data(preview_data, import_log = [], frm) {
		frappe.require("data_import_tools.bundle.js", () => {
			frappe.data_import.ImportPreview = class CustomImportPreview extends (
				frappe.data_import.ImportPreview
			) {
				add_actions() {
					let actions = [
						{
							label: __("Map Columns"),
							handler: "show_column_mapper",
							condition: this.frm.get_value("status") !== "Success",
						},
						{
							label: __("Export Errored Rows"),
							handler: "export_errored_rows",
							condition: this.import_log.filter((log) => !log.success).length > 0,
						},
						{
							label: __("Show Warnings"),
							handler: "show_warnings",
							condition: this.preview_data.warnings.length > 0,
						},
					];
					let html = actions
						.filter((action) => action.condition)
						.map((action) => {
							return `<button class="btn btn-sm btn-default" data-action="${action.handler}">
                  ${action.label}
                </button>
              `;
						});
					this.wrapper.find(".table-actions").html(html);
				}
				show_warnings() {
					this.frm
						.get_field("import_warnings")
						.$wrapper[0].scrollIntoView({ behavior: "smooth", block: "center" });
				}
				show_column_warning(_, $target) {
					let $warning = this.frm
						.get_field("import_warnings")
						.$wrapper.find(`[data-col=${$target.data("col")}]`);
					frappe.utils.scroll_to($warning, true, 30);
				}
				show_column_mapper() {
					let column_picker_fields = get_columns_for_picker(this.frm.link_doctype);
					let changed = [];
					let fields = this.preview_data.columns.map((col, i) => {
						let df = col.df;
						if (col.header_title === "Sr. No") return [];
						let fieldname;
						if (!df) {
							fieldname = null;
						} else if (col.map_to_field) {
							fieldname = col.map_to_field;
						} else if (col.is_child_table_field) {
							fieldname = `${col.child_table_df.fieldname}.${df.fieldname}`;
						} else {
							fieldname = df.fieldname;
						}
						return [
							{
								label: "",
								fieldtype: "Data",
								default: col.header_title,
								fieldname: `Column ${i}`,
								read_only: 1,
							},
							{
								fieldtype: "Column Break",
							},
							{
								fieldtype: "Autocomplete",
								fieldname: i,
								label: "",
								max_items: Infinity,
								options: [
									{
										label: __("Don't Import"),
										value: "Don't Import",
									},
								].concat(
									get_fields_as_options(
										this.frm.link_doctype,
										column_picker_fields
									)
								),
								default: fieldname || "Don't Import",
								change() {
									changed.push(i);
								},
							},
							{
								fieldtype: "Section Break",
							},
						];
					});
					fields = fields.reduce((acc, curr) => [...acc, ...curr]);
					let file_name = (this.frm.get_value.import_file || "").split("/").pop();
					let parts = [file_name.bold(), this.frm.link_doctype.bold()];
					fields = [
						{
							fieldtype: "HTML",
							fieldname: "heading",
							options: `
                  <div class="margin-top text-muted">
                  ${__("Map columns from {0} to fields in {1}", parts)}
                  </div>
                `,
						},
						{
							fieldtype: "Section Break",
						},
					].concat(fields);
					let dialog = new frappe.ui.Dialog({
						title: __("Map Columns"),
						fields,
						primary_action: (values) => {
							let changed_map = {};
							changed.map((i) => {
								let header_row_index = i - 1;
								changed_map[header_row_index] = values[i];
							});
							if (changed.length > 0) {
								this.events.remap_column(changed_map);
							}
							dialog.hide();
						},
					});
					dialog.$body.addClass("map-columns");
					dialog.show();
				}
			};

			new frappe.data_import.ImportPreview({
				wrapper: frm.fields_dict.import_preview.$wrapper,
				doctype: this.frm.link_doctype,
				preview_data,
				import_log,
				frm,
				events: {
					remap_column: function (changed_map) {
						let template_options = JSON.parse("{}");
						template_options.column_to_field_map =
							template_options.column_to_field_map || {};
						Object.assign(template_options.column_to_field_map, changed_map);
						frm.set_value("template_options", JSON.stringify(template_options));
						frappe.db.set_value(
							"Data Import",
							frm.get_value("name"),
							"template_options",
							JSON.stringify(template_options)
						);
						// frm.save().then(() => frm.trigger("import_file"));
						this.import_file(frm.get_value("import_file"), frm.get_value("name"), frm);
					}.bind(this),
				},
			});
		});
	}
	//
	show_import_warnings(frm, preview_data) {
		let columns = preview_data.columns;
		let warnings = JSON.parse(frm.get_value("template_warnings") || "[]");
		warnings = warnings.concat(preview_data.warnings || []);

		// frm.toggle_display("import_warnings_section", warnings.length > 0);
		if (warnings.length === 0) {
			frm.fields_dict.import_warnings.$wrapper.html("");
			return;
		}

		// group warnings by row
		let warnings_by_row = {};
		let other_warnings = [];
		for (let warning of warnings) {
			if (warning.row) {
				warnings_by_row[warning.row] = warnings_by_row[warning.row] || [];
				warnings_by_row[warning.row].push(warning);
			} else {
				other_warnings.push(warning);
			}
		}

		let html = "";
		html += Object.keys(warnings_by_row)
			.map((row_number) => {
				let message = warnings_by_row[row_number]
					.map((w) => {
						if (w.field) {
							let label =
								w.field.label +
								(w.field.parent !== frm.doc.reference_doctype
									? ` (${w.field.parent})`
									: "");
							return `<li>${label}: ${w.message}</li>`;
						}
						return `<li>${w.message}</li>`;
					})
					.join("");
				return `
                <div class="warning" data-row="${row_number}">
                    <h5 class="text-uppercase">${__("Row {0}", [row_number])}</h5>
                    <div class="body"><ul>${message}</ul></div>
                </div>
            `;
			})
			.join("");

		html += other_warnings
			.map((warning) => {
				let header = "";
				if (columns && warning.col) {
					let column_number = `<span class="text-uppercase">${__("Column {0}", [
						warning.col,
					])}</span>`;
					let column_header = columns[warning.col].header_title;
					header = `${column_number} (${column_header})`;
				}
				return `
                    <div class="warning" data-col="${warning.col}">
                        <h5>${header}</h5>
                        <div class="body">${warning.message}</div>
                    </div>
                `;
			})
			.join("");
		frm.fields_dict.import_warnings.$wrapper.html(`
            <div class="row">
                <div class="col-sm-10 warnings">${html}</div>
            </div>
        `);
	}
}

function get_columns_for_picker(doctype) {
	let out = {};
	const exportable_fields = (df) => {
		let keep = true;
		if (frappe.model.no_value_type.includes(df.fieldtype)) {
			keep = false;
		}
		if (["lft", "rgt"].includes(df.fieldname)) {
			keep = false;
		}
		if (df.is_virtual) {
			keep = false;
		}
		return keep;
	};
	let doctype_fields = frappe.meta.get_docfields(doctype).filter(exportable_fields);
	out[doctype] = [
		{
			label: __("ID"),
			fieldname: "name",
			fieldtype: "Data",
			reqd: 1,
		},
	].concat(doctype_fields);
	const table_fields = frappe.meta.get_table_fields(doctype);
	table_fields.forEach((df) => {
		const cdt = df.options;
		const child_table_fields = frappe.meta.get_docfields(cdt).filter(exportable_fields);
		out[df.fieldname] = [
			{
				label: __("ID"),
				fieldname: "name",
				fieldtype: "Data",
				reqd: 1,
			},
		].concat(child_table_fields);
	});
	return out;
}
function get_fields_as_options(doctype, column_map) {
	let keys = [doctype];
	frappe.meta.get_table_fields(doctype).forEach((df) => {
		keys.push(df.fieldname);
	});
	return [].concat(
		...keys.map((key) => {
			return column_map[key].map((df) => {
				let label = __(df.label, null, df.parent);
				let value = df.fieldname;
				if (doctype !== key) {
					let table_field = frappe.meta.get_docfield(doctype, key);
					label = `${__(df.label, null, df.parent)} (${__(table_field.label)})`;
					value = `${table_field.fieldname}.${df.fieldname}`;
				}
				return {
					label,
					value,
					description: value,
				};
			});
		})
	);
}
