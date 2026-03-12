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
		this.current_step = 1;
		this.total_steps = 7;
		this.state = {
			selected_doctypes: [],
			suggestions: null,
			missing_descriptions: [],
			selected_columns: [],
			selected_filters: [],
			generated: null,
			preview_data: null,
		};
		this.render();
	}

	render() {
		this.page.main.html(`
			<div class="ai-report-generator">
				<div class="step-indicator">${this.render_step_dots()}</div>
				<div class="wizard-body">
					${this.render_step_1()}
					${this.render_step_2()}
					${this.render_step_3()}
					${this.render_step_4()}
					${this.render_step_5()}
					${this.render_step_6()}
					${this.render_step_7()}
				</div>
				<div class="wizard-actions">
					<button class="btn btn-default btn-back" style="display:none;">Back</button>
					<span></span>
					<button class="btn btn-primary btn-next">Next</button>
				</div>
			</div>
		`);
		this.$wrapper = this.page.main.find(".ai-report-generator");
		this.show_step(1);
		this.bind_events();
	}

	render_step_dots() {
		const labels = [
			"DocTypes",
			"Describe",
			"Suggestions",
			"Request",
			"Generate",
			"Preview",
			"Save",
		];
		return labels
			.map(
				(label, i) =>
					`<div class="step-dot" data-step="${i + 1}" title="${label}">${i + 1}</div>`
			)
			.join("");
	}

	render_step_1() {
		return `
			<div class="wizard-step" data-step="1">
				<h4>Step 1: Select DocTypes</h4>
				<p class="text-muted">Choose the DocTypes you want to build a report from.</p>
				<div class="form-group">
					<input type="text" class="form-control doctype-search"
						placeholder="Type to search DocTypes..." autocomplete="off">
					<div class="selected-doctypes" style="margin-top:10px;"></div>
				</div>
			</div>
		`;
	}

	render_step_2() {
		return `
			<div class="wizard-step" data-step="2">
				<h4>Step 2: Describe DocTypes</h4>
				<p class="text-muted">Help the AI understand your DocTypes by providing descriptions.</p>
				<div class="description-forms"></div>
			</div>
		`;
	}

	render_step_3() {
		return `
			<div class="wizard-step" data-step="3">
				<h4>Step 3: Review Suggested Fields</h4>
				<p class="text-muted">Select columns and filters for your report.</p>
				<div>
					<h5>Columns</h5>
					<div class="suggested-columns"></div>
				</div>
				<div style="margin-top:15px;">
					<h5>Filters</h5>
					<div class="suggested-filters"></div>
				</div>
			</div>
		`;
	}

	render_step_4() {
		return `
			<div class="wizard-step" data-step="4">
				<h4>Step 4: Describe Your Report</h4>
				<p class="text-muted">Tell the AI what you want this report to show, in plain language.</p>
				<div class="form-group">
					<textarea class="form-control user-request" rows="6"
						placeholder="e.g., Show me a report of all Sales Orders grouped by customer with total amount, filtered by date range and status..."></textarea>
				</div>
			</div>
		`;
	}

	render_step_5() {
		return `
			<div class="wizard-step" data-step="5">
				<h4>Step 5: Generated Report</h4>
				<div class="generated-content"></div>
			</div>
		`;
	}

	render_step_6() {
		return `
			<div class="wizard-step" data-step="6">
				<h4>Step 6: Preview</h4>
				<p class="text-muted">Preview the report data (limited to 20 rows).</p>
				<div class="preview-filters" style="margin-bottom:10px;"></div>
				<button class="btn btn-sm btn-default btn-run-preview">Run Preview</button>
				<div class="preview-result" style="margin-top:15px;"></div>
			</div>
		`;
	}

	render_step_7() {
		return `
			<div class="wizard-step" data-step="7">
				<h4>Step 7: Save as Report</h4>
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
			</div>
		`;
	}

	show_step(step) {
		this.current_step = step;
		this.$wrapper.find(".wizard-step").removeClass("active");
		this.$wrapper.find(`.wizard-step[data-step="${step}"]`).addClass("active");

		// Update step dots
		this.$wrapper.find(".step-dot").each(function () {
			const s = parseInt($(this).data("step"));
			$(this)
				.toggleClass("active", s === step)
				.toggleClass("completed", s < step);
		});

		// Button visibility
		this.$wrapper.find(".btn-back").toggle(step > 1);
		const $next = this.$wrapper.find(".btn-next");
		if (step === 5) {
			$next.text("Preview");
		} else if (step === 7) {
			$next.text("Save as Report");
		} else {
			$next.text("Next");
		}
		$next.toggle(step <= this.total_steps);
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

		// Next button
		this.$wrapper.find(".btn-next").on("click", () => me.handle_next());
		this.$wrapper.find(".btn-back").on("click", () => me.handle_back());

		// Preview button
		this.$wrapper.find(".btn-run-preview").on("click", () => me.run_preview());
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

	async handle_next() {
		const step = this.current_step;

		if (step === 1) {
			if (!this.state.selected_doctypes.length) {
				frappe.msgprint("Please select at least one DocType.");
				return;
			}
			await this.analyze_doctypes();
			// Skip step 2 if no missing descriptions
			if (!this.state.missing_descriptions.length) {
				this.show_step(3);
				this.render_suggestions();
			} else {
				this.show_step(2);
				this.render_description_forms();
			}
		} else if (step === 2) {
			await this.save_descriptions();
			this.show_step(3);
			this.render_suggestions();
		} else if (step === 3) {
			this.collect_selections();
			this.show_step(4);
		} else if (step === 4) {
			const request = this.$wrapper.find(".user-request").val().trim();
			if (!request) {
				frappe.msgprint("Please describe what you want the report to show.");
				return;
			}
			await this.generate_report(request);
			this.show_step(5);
			this.render_generated();
		} else if (step === 5) {
			this.collect_edits();
			this.show_step(6);
			this.render_preview_filters();
		} else if (step === 6) {
			this.show_step(7);
			this.$wrapper
				.find(".ref-doctype")
				.val(this.state.selected_doctypes[0]);
		} else if (step === 7) {
			await this.save_report();
		}
	}

	handle_back() {
		if (this.current_step === 3 && !this.state.missing_descriptions.length) {
			this.show_step(1);
		} else {
			this.show_step(this.current_step - 1);
		}
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
		const me = this;
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

		// Columns
		const $cols = this.$wrapper.find(".suggested-columns");
		if (this.state.suggestions.columns.length) {
			$cols.html(`
				<table class="suggestion-table">
					<thead><tr>
						<th><input type="checkbox" class="check-all-cols" checked></th>
						<th>Field</th><th>Label</th><th>Type</th><th>DocType</th>
					</tr></thead>
					<tbody>
						${this.state.suggestions.columns
							.map(
								(c, i) => `
							<tr>
								<td><input type="checkbox" class="col-check" data-idx="${i}" checked></td>
								<td>${c.fieldname}</td>
								<td>${c.label}</td>
								<td>${c.fieldtype}</td>
								<td>${c.doctype}</td>
							</tr>`
							)
							.join("")}
					</tbody>
				</table>
			`);
			$cols.find(".check-all-cols").on("change", function () {
				$cols.find(".col-check").prop("checked", $(this).is(":checked"));
			});
		} else {
			$cols.html('<p class="text-muted">No column suggestions available.</p>');
		}

		// Filters
		const $fils = this.$wrapper.find(".suggested-filters");
		if (this.state.suggestions.filters.length) {
			$fils.html(`
				<table class="suggestion-table">
					<thead><tr>
						<th><input type="checkbox" class="check-all-fils" checked></th>
						<th>Field</th><th>Label</th><th>Type</th><th>DocType</th>
					</tr></thead>
					<tbody>
						${this.state.suggestions.filters
							.map(
								(f, i) => `
							<tr>
								<td><input type="checkbox" class="fil-check" data-idx="${i}" checked></td>
								<td>${f.fieldname}</td>
								<td>${f.label}</td>
								<td>${f.fieldtype}</td>
								<td>${f.doctype}</td>
							</tr>`
							)
							.join("")}
					</tbody>
				</table>
			`);
			$fils.find(".check-all-fils").on("change", function () {
				$fils.find(".fil-check").prop("checked", $(this).is(":checked"));
			});
		} else {
			$fils.html(
				'<p class="text-muted">No filter suggestions available.</p>'
			);
		}
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
			<table class="editable-table columns-table">
				<thead><tr><th>Fieldname</th><th>Label</th><th>Type</th><th>Options</th><th>Width</th><th></th></tr></thead>
				<tbody>
					${g.columns.map((c, i) => this.column_row(c, i)).join("")}
				</tbody>
			</table>

			<div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;">
				<h5>Filters</h5>
				<button class="btn btn-xs btn-default btn-add-fil">+ Add Filter</button>
			</div>
			<table class="editable-table filters-table">
				<thead><tr><th>Fieldname</th><th>Label</th><th>Type</th><th>Options</th><th>Default</th><th>Reqd</th><th></th></tr></thead>
				<tbody>
					${g.filters.map((f, i) => this.filter_row(f, i)).join("")}
				</tbody>
			</table>

			<div style="margin-top:15px;">
				<button class="btn btn-default btn-regenerate">Regenerate</button>
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
		this.$wrapper
			.find(".wizard-body")
			.prepend(
				`<div class="loading-overlay main-loading">${msg}</div>`
			);
	}

	hide_loading() {
		this.$wrapper.find(".main-loading").remove();
	}
}
