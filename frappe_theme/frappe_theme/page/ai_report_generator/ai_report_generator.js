frappe.pages["ai-report-generator"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "AI Report Generator",
		single_column: true,
	});

	new AIReportGenerator(page);
};

class AIReportGenerator {
	constructor(page) {
		this.page = page;
		this.state = {
			selected_doctypes: [],
			suggestions: null,
			missing_descriptions: [],
			selected_columns: [],
			selected_filters: [],
			generated: null,
			preview_data: null,
			analyzed: false,
		};
		this.render();
	}

	render() {
		this.page.main.html(`
			<div class="ai-report-generator">
				${this.render_doctype_section()}
				${this.render_describe_section()}
				${this.render_suggestions_section()}
				${this.render_request_section()}
				${this.render_generated_section()}
				${this.render_preview_section()}
				${this.render_save_section()}
			</div>
		`);
		this.$wrapper = this.page.main.find(".ai-report-generator");
		this.bind_events();
	}

	render_doctype_section() {
		return `
			<div class="report-section" data-section="doctypes">
				<div class="section-header">
					<h4>Select DocTypes</h4>
					<p class="text-muted">Choose the DocTypes you want to build a report from.</p>
				</div>
				<div class="section-body">
					<div class="form-group">
						<input type="text" class="form-control doctype-search"
							placeholder="Type to search DocTypes..." autocomplete="off">
						<div class="selected-doctypes" style="margin-top:10px;"></div>
					</div>
					<button class="btn btn-primary btn-sm btn-analyze" style="margin-top:10px;">
						Analyze DocTypes
					</button>
				</div>
			</div>
		`;
	}

	render_describe_section() {
		return `
			<div class="report-section section-disabled" data-section="describe">
				<div class="section-header">
					<h4>Describe DocTypes</h4>
					<p class="text-muted">Help the AI understand your DocTypes by providing descriptions.</p>
				</div>
				<div class="section-body">
					<div class="description-forms"></div>
					<button class="btn btn-primary btn-sm btn-save-descriptions" style="margin-top:10px; display:none;">
						Save Descriptions
					</button>
					<p class="text-muted no-descriptions-msg" style="display:none;">
						All selected DocTypes already have descriptions.
					</p>
				</div>
			</div>
		`;
	}

	render_suggestions_section() {
		return `
			<div class="report-section section-disabled" data-section="suggestions">
				<div class="section-header">
					<h4>Review Suggested Fields</h4>
					<p class="text-muted">Select columns and filters for your report.</p>
				</div>
				<div class="section-body">
					<div class="suggestions-row">
						<div class="suggestions-col">
							<div class="suggestions-col-header">
								<h5>Columns</h5>
								<label class="check-all-label">
									<input type="checkbox" class="check-all-cols" checked> Select All
								</label>
							</div>
							<input type="text" class="form-control form-control-sm suggestion-search"
								data-target="cols" placeholder="Search columns..." style="margin-bottom:8px;">
							<div class="suggested-columns"></div>
						</div>
						<div class="suggestions-col">
							<div class="suggestions-col-header">
								<h5>Filters</h5>
								<label class="check-all-label">
									<input type="checkbox" class="check-all-fils" checked> Select All
								</label>
							</div>
							<input type="text" class="form-control form-control-sm suggestion-search"
								data-target="fils" placeholder="Search filters..." style="margin-bottom:8px;">
							<div class="suggested-filters"></div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	render_request_section() {
		return `
			<div class="report-section section-disabled" data-section="request">
				<div class="section-header">
					<h4>Describe Your Report</h4>
					<p class="text-muted">Tell the AI what you want this report to show, in plain language.</p>
				</div>
				<div class="section-body">
					<div class="form-group">
						<textarea class="form-control user-request" rows="4"
							placeholder="e.g., Show me a report of all Sales Orders grouped by customer with total amount, filtered by date range and status..."></textarea>
					</div>
					<button class="btn btn-primary btn-sm btn-generate" style="margin-top:10px;">
						Generate Report
					</button>
				</div>
			</div>
		`;
	}

	render_generated_section() {
		return `
			<div class="report-section section-disabled" data-section="generated">
				<div class="section-header">
					<h4>Generated Report</h4>
				</div>
				<div class="section-body">
					<div class="generated-content"></div>
				</div>
			</div>
		`;
	}

	render_preview_section() {
		return `
			<div class="report-section section-disabled" data-section="preview">
				<div class="section-header">
					<h4>Preview</h4>
					<p class="text-muted">Preview the report data (limited to 20 rows).</p>
				</div>
				<div class="section-body">
					<div class="preview-filters" style="margin-bottom:10px;"></div>
					<button class="btn btn-default btn-sm btn-run-preview">Run Preview</button>
					<div class="preview-result" style="margin-top:15px;"></div>
				</div>
			</div>
		`;
	}

	render_save_section() {
		return `
			<div class="report-section section-disabled" data-section="save">
				<div class="section-header">
					<h4>Save as Report</h4>
				</div>
				<div class="section-body">
					<div class="form-group">
						<label>Report Name</label>
						<input type="text" class="form-control report-name" placeholder="My Custom Report">
					</div>
					<div class="form-group" style="margin-top:10px;">
						<label>Reference DocType</label>
						<input type="text" class="form-control ref-doctype" readonly>
					</div>
					<div class="form-group" style="margin-top:10px;">
						<label>Description (optional, for future AI Dashboard use)</label>
						<textarea class="form-control report-description" rows="3"></textarea>
					</div>
					<button class="btn btn-primary btn-sm btn-save-report" style="margin-top:10px;">
						Save Report
					</button>
				</div>
			</div>
		`;
	}

	enable_section(name) {
		this.$wrapper.find(`[data-section="${name}"]`).removeClass("section-disabled");
	}

	scroll_to_section(name) {
		const $section = this.$wrapper.find(`[data-section="${name}"]`);
		if ($section.length) {
			$section[0].scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}

	bind_events() {
		const me = this;

		// DocType search autocomplete
		const $search = this.$wrapper.find(".doctype-search");
		frappe.call({
			method: "frappe_theme.ai_report_generator.api.get_all_doctypes",
			callback(r) {
				if (r.message) {
					me.all_doctypes = r.message;
					me.setup_awesomplete($search, r.message);
				}
			},
		});

		// Analyze button
		this.$wrapper.find(".btn-analyze").on("click", () => me.handle_analyze());

		// Save descriptions button
		this.$wrapper.find(".btn-save-descriptions").on("click", () => me.handle_save_descriptions());

		// Generate button
		this.$wrapper.find(".btn-generate").on("click", () => me.handle_generate());

		// Preview button
		this.$wrapper.find(".btn-run-preview").on("click", () => me.run_preview());

		// Save report button
		this.$wrapper.find(".btn-save-report").on("click", () => me.save_report());
	}

	setup_awesomplete($input, items) {
		const me = this;
		const awesomplete = new Awesomplete($input[0], {
			list: items,
			minChars: 1,
			maxItems: 15,
			autoFirst: true,
		});

		$input.on("awesomplete-selectcomplete", function (e) {
			const val = e.originalEvent.text.value || e.originalEvent.text;
			if (val && !me.state.selected_doctypes.includes(val)) {
				me.state.selected_doctypes.push(val);
				me.render_selected_doctypes();
			}
			$input.val("");
		});
	}

	render_selected_doctypes() {
		const $container = this.$wrapper.find(".selected-doctypes");
		$container.html(
			this.state.selected_doctypes
				.map(
					(dt) =>
						`<span class="doctype-tag">${dt} <span class="remove-tag" data-dt="${dt}">&times;</span></span>`
				)
				.join("")
		);
		$container.find(".remove-tag").on("click", (e) => {
			const dt = $(e.currentTarget).data("dt");
			this.state.selected_doctypes = this.state.selected_doctypes.filter(
				(d) => d !== dt
			);
			this.render_selected_doctypes();
		});
	}

	async handle_analyze() {
		if (!this.state.selected_doctypes.length) {
			frappe.msgprint("Please select at least one DocType.");
			return;
		}
		await this.analyze_doctypes();
		this.state.analyzed = true;

		// Enable and populate sections
		this.enable_section("describe");
		this.enable_section("suggestions");
		this.enable_section("request");

		if (this.state.missing_descriptions.length) {
			this.render_description_forms();
			this.$wrapper.find(".btn-save-descriptions").show();
			this.$wrapper.find(".no-descriptions-msg").hide();
			this.scroll_to_section("describe");
		} else {
			this.$wrapper.find(".btn-save-descriptions").hide();
			this.$wrapper.find(".no-descriptions-msg").show();
			this.scroll_to_section("suggestions");
		}

		this.render_suggestions();
	}

	async handle_save_descriptions() {
		await this.save_descriptions();
		frappe.show_alert({ message: "Descriptions saved.", indicator: "green" });
		this.scroll_to_section("suggestions");
	}

	async handle_generate() {
		const request = this.$wrapper.find(".user-request").val().trim();
		if (!request) {
			frappe.msgprint("Please describe what you want the report to show.");
			return;
		}
		this.collect_selections();
		await this.generate_report(request);

		this.enable_section("generated");
		this.enable_section("preview");
		this.enable_section("save");

		this.render_generated();
		this.render_preview_filters();
		this.$wrapper.find(".ref-doctype").val(this.state.selected_doctypes[0]);
		this.scroll_to_section("generated");
	}

	async analyze_doctypes() {
		const me = this;
		this.show_loading("Analyzing DocType schemas...");
		try {
			const r = await frappe.call({
				method: "frappe_theme.ai_report_generator.api.analyze_doctypes",
				args: {
					doctypes: JSON.stringify(me.state.selected_doctypes),
				},
			});
			me.state.suggestions = r.message.suggestions;
			me.state.missing_descriptions = r.message.missing_descriptions;
		} catch (e) {
			frappe.msgprint("Failed to analyze DocTypes.");
		}
		this.hide_loading();
	}

	render_description_forms() {
		const $container = this.$wrapper.find(".description-forms");
		$container.html(
			this.state.missing_descriptions
				.map(
					(dt) => `
				<div class="form-group" style="margin-bottom:15px;">
					<label><strong>${dt}</strong></label>
					<textarea class="form-control dt-description" data-dt="${dt}" rows="3"
						placeholder="Describe what ${dt} represents in your business..."></textarea>
				</div>
			`
				)
				.join("")
		);
	}

	async save_descriptions() {
		const promises = [];
		this.$wrapper.find(".dt-description").each(function () {
			const dt = $(this).data("dt");
			const desc = $(this).val().trim();
			if (desc) {
				promises.push(
					frappe.call({
						method: "frappe_theme.ai_report_generator.api.save_doctype_description",
						args: { doctype: dt, description: desc },
					})
				);
			}
		});
		if (promises.length) {
			this.show_loading("Saving descriptions...");
			await Promise.all(promises);
			this.hide_loading();
		}
	}

	render_suggestions() {
		if (!this.state.suggestions) return;

		// Columns — compact checkbox grid
		const $cols = this.$wrapper.find(".suggested-columns");
		if (this.state.suggestions.columns.length) {
			$cols.html(`
				<div class="suggestion-grid">
					${this.state.suggestions.columns
						.map(
							(c, i) => `
						<label class="suggestion-chip" title="${c.fieldname} (${c.fieldtype}) — ${c.doctype}">
							<input type="checkbox" class="col-check" data-idx="${i}" checked>
							<span class="chip-label">${c.label}</span>
							<span class="chip-meta">${c.doctype}</span>
						</label>`
						)
						.join("")}
				</div>
			`);
		} else {
			$cols.html('<p class="text-muted">No column suggestions.</p>');
		}

		// Bind select-all for columns
		this.$wrapper.find(".check-all-cols").off("change").on("change", function () {
			$cols.find(".col-check").prop("checked", $(this).is(":checked"));
		});

		// Filters — compact checkbox grid
		const $fils = this.$wrapper.find(".suggested-filters");
		if (this.state.suggestions.filters.length) {
			$fils.html(`
				<div class="suggestion-grid">
					${this.state.suggestions.filters
						.map(
							(f, i) => `
						<label class="suggestion-chip" title="${f.fieldname} (${f.fieldtype}) — ${f.doctype}">
							<input type="checkbox" class="fil-check" data-idx="${i}" checked>
							<span class="chip-label">${f.label}</span>
							<span class="chip-meta">${f.doctype}</span>
						</label>`
						)
						.join("")}
				</div>
			`);
		} else {
			$fils.html('<p class="text-muted">No filter suggestions.</p>');
		}

		// Bind select-all for filters
		this.$wrapper.find(".check-all-fils").off("change").on("change", function () {
			$fils.find(".fil-check").prop("checked", $(this).is(":checked"));
		});

		// Bind search inputs
		this.$wrapper.find(".suggestion-search").off("input").on("input", function () {
			const query = $(this).val().toLowerCase();
			const target = $(this).data("target");
			const $grid = target === "cols" ? $cols : $fils;
			$grid.find(".suggestion-chip").each(function () {
				const text = $(this).text().toLowerCase();
				const title = ($(this).attr("title") || "").toLowerCase();
				$(this).toggle(text.includes(query) || title.includes(query));
			});
		});
	}

	collect_selections() {
		this.state.selected_columns = [];
		this.state.selected_filters = [];
		this.$wrapper.find(".col-check:checked").each((_, el) => {
			const idx = $(el).data("idx");
			this.state.selected_columns.push(this.state.suggestions.columns[idx]);
		});
		this.$wrapper.find(".fil-check:checked").each((_, el) => {
			const idx = $(el).data("idx");
			this.state.selected_filters.push(this.state.suggestions.filters[idx]);
		});
	}

	async generate_report(user_request) {
		this.show_loading("Generating report with AI... This may take a moment.");
		try {
			const r = await frappe.call({
				method: "frappe_theme.ai_report_generator.api.generate_report",
				args: {
					doctypes: JSON.stringify(this.state.selected_doctypes),
					user_request: user_request,
				},
			});
			this.state.generated = r.message;
		} catch (e) {
			frappe.msgprint("Failed to generate report. Please try again.");
		}
		this.hide_loading();
	}

	render_generated() {
		const g = this.state.generated;
		if (!g) return;

		const $container = this.$wrapper.find(".generated-content");
		$container.html(`
			${g.explanation ? `<div class="explanation-box">${g.explanation}</div>` : ""}

			<h5 style="margin-top:15px;">SQL Query</h5>
			<textarea class="sql-editor">${g.query}</textarea>

			<div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;">
				<h5>Columns</h5>
				<button class="btn btn-xs btn-default btn-add-col">+ Add Column</button>
			</div>
			<div class="editable-table-scroll">
				<table class="editable-table columns-table">
					<thead><tr><th>Fieldname</th><th>Label</th><th>Type</th><th>Options</th><th>Width</th><th></th></tr></thead>
					<tbody>
						${g.columns.map((c, i) => this.column_row(c, i)).join("")}
					</tbody>
				</table>
			</div>

			<div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;">
				<h5>Filters</h5>
				<button class="btn btn-xs btn-default btn-add-fil">+ Add Filter</button>
			</div>
			<div class="editable-table-scroll">
				<table class="editable-table filters-table">
					<thead><tr><th>Fieldname</th><th>Label</th><th>Type</th><th>Options</th><th>Default</th><th>Reqd</th><th></th></tr></thead>
					<tbody>
						${g.filters.map((f, i) => this.filter_row(f, i)).join("")}
					</tbody>
				</table>
			</div>

			<div style="margin-top:15px;">
				<button class="btn btn-default btn-sm btn-regenerate">Regenerate</button>
			</div>
		`);

		// Bind add/remove/regenerate events
		const me = this;
		$container.find(".btn-add-col").on("click", () => {
			const $tbody = $container.find(".columns-table tbody");
			const idx = $tbody.find("tr").length;
			$tbody.append(me.column_row({ fieldname: "", label: "", fieldtype: "Data", options: "", width: 150 }, idx));
		});
		$container.find(".btn-add-fil").on("click", () => {
			const $tbody = $container.find(".filters-table tbody");
			const idx = $tbody.find("tr").length;
			$tbody.append(me.filter_row({ fieldname: "", label: "", fieldtype: "Data", options: "", default: "", reqd: 0 }, idx));
		});
		$container.on("click", ".remove-row", function () {
			$(this).closest("tr").remove();
		});
		$container.find(".btn-regenerate").on("click", async () => {
			const request = me.$wrapper.find(".user-request").val().trim();
			if (request) {
				await me.generate_report(request);
				me.render_generated();
			}
		});
	}

	column_row(col, idx) {
		return `<tr>
			<td><input type="text" class="col-fieldname" value="${col.fieldname || ""}"></td>
			<td><input type="text" class="col-label" value="${col.label || ""}"></td>
			<td><select class="col-fieldtype">
				${["Data", "Currency", "Int", "Float", "Date", "Datetime", "Link", "Select", "Check", "Duration", "Percent"].map(
					(t) => `<option ${t === col.fieldtype ? "selected" : ""}>${t}</option>`
				).join("")}
			</select></td>
			<td><input type="text" class="col-options" value="${col.options || ""}"></td>
			<td><input type="number" class="col-width" value="${col.width || 150}" style="width:60px;"></td>
			<td class="remove-row">&times;</td>
		</tr>`;
	}

	filter_row(fil, idx) {
		return `<tr>
			<td><input type="text" class="fil-fieldname" value="${fil.fieldname || ""}"></td>
			<td><input type="text" class="fil-label" value="${fil.label || ""}"></td>
			<td><select class="fil-fieldtype">
				${["Data", "Link", "Select", "Date", "Check", "Int", "Float"].map(
					(t) => `<option ${t === fil.fieldtype ? "selected" : ""}>${t}</option>`
				).join("")}
			</select></td>
			<td><input type="text" class="fil-options" value="${fil.options || ""}"></td>
			<td><input type="text" class="fil-default" value="${fil.default || ""}"></td>
			<td><input type="checkbox" class="fil-reqd" ${fil.reqd ? "checked" : ""}></td>
			<td class="remove-row">&times;</td>
		</tr>`;
	}

	collect_edits() {
		const g = this.state.generated;
		// Update query from editor
		g.query = this.$wrapper.find(".sql-editor").val();

		// Collect columns
		g.columns = [];
		this.$wrapper.find(".columns-table tbody tr").each(function () {
			g.columns.push({
				fieldname: $(this).find(".col-fieldname").val(),
				label: $(this).find(".col-label").val(),
				fieldtype: $(this).find(".col-fieldtype").val(),
				options: $(this).find(".col-options").val(),
				width: parseInt($(this).find(".col-width").val()) || 150,
			});
		});

		// Collect filters
		g.filters = [];
		this.$wrapper.find(".filters-table tbody tr").each(function () {
			g.filters.push({
				fieldname: $(this).find(".fil-fieldname").val(),
				label: $(this).find(".fil-label").val(),
				fieldtype: $(this).find(".fil-fieldtype").val(),
				options: $(this).find(".fil-options").val(),
				default: $(this).find(".fil-default").val(),
				reqd: $(this).find(".fil-reqd").is(":checked") ? 1 : 0,
			});
		});
	}

	render_preview_filters() {
		const g = this.state.generated;
		if (!g || !g.filters.length) return;

		const $container = this.$wrapper.find(".preview-filters");
		$container.html(
			g.filters
				.map(
					(f) => `
				<div class="form-group" style="display:inline-block;margin-right:10px;">
					<label>${f.label}</label>
					<input type="text" class="form-control form-control-sm preview-filter-input"
						data-fieldname="${f.fieldname}" value="${f.default || ""}"
						placeholder="${f.fieldname}" style="width:180px;">
				</div>
			`
				)
				.join("")
		);
	}

	async run_preview() {
		this.collect_edits();
		const g = this.state.generated;
		if (!g) return;

		const filters = {};
		this.$wrapper.find(".preview-filter-input").each(function () {
			const fn = $(this).data("fieldname");
			const val = $(this).val();
			if (val) filters[fn] = val;
		});

		const $result = this.$wrapper.find(".preview-result");
		$result.html('<div class="loading-overlay">Running query...</div>');

		try {
			const r = await frappe.call({
				method: "frappe_theme.ai_report_generator.api.preview_query",
				args: {
					query: g.query,
					filters: JSON.stringify(filters),
				},
			});

			const data = r.message;
			if (!data || !data.length) {
				$result.html(
					'<p class="text-muted">No results returned. Try adjusting filters or the query.</p>'
				);
				return;
			}

			const headers = Object.keys(data[0]);
			$result.html(`
				<div class="preview-table-wrapper">
					<table class="preview-table">
						<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
						<tbody>${data
							.map(
								(row) =>
									`<tr>${headers.map((h) => `<td>${row[h] != null ? row[h] : ""}</td>`).join("")}</tr>`
							)
							.join("")}</tbody>
					</table>
				</div>
			`);
		} catch (e) {
			$result.html(
				'<p class="text-danger">Query execution failed. Check the SQL and try again.</p>'
			);
		}
	}

	async save_report() {
		const name = this.$wrapper.find(".report-name").val().trim();
		if (!name) {
			frappe.msgprint("Please enter a report name.");
			return;
		}

		this.collect_edits();
		const g = this.state.generated;
		const ref_doctype =
			this.$wrapper.find(".ref-doctype").val() ||
			this.state.selected_doctypes[0];
		const description = this.$wrapper.find(".report-description").val().trim();

		this.show_loading("Saving report...");
		try {
			const r = await frappe.call({
				method: "frappe_theme.ai_report_generator.api.save_as_report",
				args: {
					report_name: name,
					ref_doctype: ref_doctype,
					query: g.query,
					columns: JSON.stringify(g.columns),
					filters: JSON.stringify(g.filters),
					description: description,
				},
			});

			frappe.msgprint({
				title: "Report Saved",
				message: `Report <a href="${r.message.url}">${r.message.name}</a> created successfully!`,
				indicator: "green",
			});
			// Redirect to the report
			setTimeout(() => frappe.set_route(r.message.url), 1500);
		} catch (e) {
			frappe.msgprint("Failed to save report.");
		}
		this.hide_loading();
	}

	show_loading(msg) {
		this.$wrapper.prepend(
			`<div class="loading-overlay main-loading">${msg}</div>`
		);
	}

	hide_loading() {
		this.$wrapper.find(".main-loading").remove();
	}
}
