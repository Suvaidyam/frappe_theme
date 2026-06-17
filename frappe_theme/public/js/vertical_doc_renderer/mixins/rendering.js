const RenderingMixin = {
	/**
	 * Return label column width capped for narrow viewports so the params column
	 * never pushes all data columns off-screen on mobile.
	 * On screens wider than 768 px the configured value is returned unchanged.
	 */
	_responsiveLabelWidth() {
		const raw = this.label_width || 160;
		const vw = window.innerWidth || 375;
		if (vw >= 768) return raw;
		// Cap at 42 % of viewport, min 100 px, so at least one data column peeks in.
		return Math.min(raw, Math.max(100, Math.floor(vw * 0.42)));
	},

	/**
	 * Top-level render: build table, optional legend, fire afterRender hook.
	 */
	render() {
		if (!this.meta) return;

		if (!this.data || this.data.length === 0) {
			this._buildEmptyState();
			if (typeof this.events.afterRender === "function") {
				this.events.afterRender(this);
			}
			return;
		}

		this._buildTable();
		if (this.show_legend && this.legend_items && this.legend_items.length) {
			this._buildLegend();
		}

		if (typeof this.events.afterRender === "function") {
			this.events.afterRender(this);
		}
	},

	/**
	 * Render a clean "No records found" empty state into the scrollBox.
	 */
	_buildEmptyState() {
		const wrapper = document.createElement("div");
		wrapper.className = "sva-vdr-empty-state";
		wrapper.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 48px 24px;
			border: 1px solid rgba(0,0,0,.08);
			border-radius: 6px;
			background: var(--card-bg, #fff);
			color: var(--text-muted, #8d99a6);
			text-align: center;
		`;

		const icon = document.createElement("div");
		icon.style.cssText = `
			font-size: 40px;
			margin-bottom: 12px;
			opacity: 0.45;
			line-height: 1;
		`;
		icon.textContent = "🗂";

		const msg = document.createElement("div");
		msg.style.cssText = `
			font-size: 14px;
			font-weight: 500;
			color: var(--text-muted, #8d99a6);
		`;
		msg.textContent = __("No records found");

		wrapper.appendChild(icon);
		wrapper.appendChild(msg);
		this.scrollBox.appendChild(wrapper);
	},

	// ─── Table ──────────────────────────────────────────────────────────────

	_buildTable() {
		const table = document.createElement("table");
		table.className = "sva-vdr-table";

		// Calculate minimum pixel width so the table overflows the scroll container
		// on narrow screens instead of squishing columns. CSS min-width overrides
		// width:100% when the calculated minimum is larger (e.g. on mobile).
		// Updated incrementally in _appendDocColumn() as viewport loads more batches.
		const minTableW = this._calcTableMinWidth(this.data.length || 0);

		table.style.cssText = `
			border-collapse: collapse;
			width: 100%;
			min-width: ${minTableW}px;
			table-layout: fixed;
		`;
		this._table = table;

		table.appendChild(this._buildThead());
		table.appendChild(this._buildTbody());

		this.scrollBox.appendChild(table);
	},

	// ─── Header ─────────────────────────────────────────────────────────────

	_buildThead() {
		const thead = document.createElement("thead");
		const tr = document.createElement("tr");
		this._theadRow = tr; // stored so viewport + delete mixins can append columns

		// "Parameters" sticky label column — highest z-index (corner cell)
		const labelW = this._responsiveLabelWidth();
		const paramTh = document.createElement("th");
		paramTh.textContent = __("Parameters");
		paramTh.className = "sva-vdr-header-cell sva-vdr-sticky-col";
		this._styleHeaderCell(paramTh);
		paramTh.style.left = "0";
		paramTh.style.zIndex = "3"; // corner: above both sticky-top and sticky-left
		paramTh.style.minWidth = `${labelW}px`;
		paramTh.style.width = `${labelW}px`;
		tr.appendChild(paramTh);

		// Optional "Unit" column
		if (this.show_unit) {
			const unitTh = document.createElement("th");
			unitTh.textContent = __("Unit");
			unitTh.className = "sva-vdr-header-cell";
			this._styleHeaderCell(unitTh);
			tr.appendChild(unitTh);
		}

		// One column per doc — first batch; viewport mixin appends the rest
		this.data.forEach((doc, i) => {
			const conf = (this.column_configs && this.column_configs[i]) || {};
			tr.appendChild(this._buildDocHeaderCell(doc, i, conf));
		});

		// "+" is rendered as a floating button outside the table (see ui_setup._buildToolbar)
		this._createTh = null;

		thead.appendChild(tr);
		return thead;
	},

	/**
	 * Shared style for all header <th> cells.
	 * z-index is intentionally NOT set here — callers set it per their role:
	 *   paramTh corner  → z-index 3
	 *   doc headers     → z-index 2  (set in _buildDocHeaderCell)
	 *   unit header     → inherits from sticky-top, no extra z-index needed
	 */
	_styleHeaderCell(th) {
		th.style.cssText = `
			background: var(--sva-vdr-header-bg, #1a3a5c);
			color: var(--sva-vdr-header-text, #fff);
			font-weight: 600;
			padding: 6px 10px;
			text-align: left;
			white-space: nowrap;
			border: 1px solid rgba(0,0,0,.08);
			position: sticky;
			top: 0;
		`;
	},

	// ─── Body ────────────────────────────────────────────────────────────────

	_buildTbody() {
		const tbody = document.createElement("tbody");

		if (this._canDelete && this._canDelete()) {
			tbody.appendChild(this._buildDeleteRow());
		}

		const allMetaFields = this.meta.fields || [];
		const visibleFields = this.getVisibleFields();
		const visibleFieldNames = new Set(visibleFields.map((df) => df.fieldname));

		const SKIP_TYPES = new Set([
			"Column Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Barcode",
		]);

		if (this.fields_config && this.fields_config.length > 0) {
			// fields_config is active — render in user-defined order.
			// Build a map of fieldname → owning section break from meta so we can
			// still emit section headers in the right place.
			const fieldToSection = new Map();
			let curSection = null;
			allMetaFields.forEach((df) => {
				if (df.fieldtype === "Section Break" || df.fieldtype === "Tab Break") {
					curSection = df;
				} else if (!SKIP_TYPES.has(df.fieldtype)) {
					fieldToSection.set(df.fieldname, curSection);
				}
			});

			let lastSectionDf = undefined; // undefined = "not yet seen any section"
			visibleFields.forEach((df) => {
				if (this.hide_empty_rows && this.isEmptyRow(df)) return;

				const sectionDf = fieldToSection.get(df.fieldname) || null;

				// Emit a section header when we cross into a new section
				if (sectionDf !== lastSectionDf) {
					lastSectionDf = sectionDf;
					if (sectionDf) {
						const sconf = this._getSectionConfig(sectionDf);
						if (
							!(sconf && sconf.hidden) &&
							this.show_section_headers &&
							sectionDf.label
						) {
							tbody.appendChild(this._buildSectionRow(sectionDf.label, sconf));
						}
					}
				}

				const sectionConf = sectionDf ? this._getSectionConfig(sectionDf) : null;
				if (sectionConf && sectionConf.hidden) return;

				const fieldRow = this._buildFieldRow(df);
				if (sectionConf && sectionConf.collapsed) fieldRow.style.display = "none";
				tbody.appendChild(fieldRow);
			});

			return tbody;
		}

		// Default path: meta order with section tracking
		let sectionHidden = false;
		let currentSectionConfig = null;

		allMetaFields.forEach((df) => {
			if (SKIP_TYPES.has(df.fieldtype)) return;

			if (df.fieldtype === "Section Break" || df.fieldtype === "Tab Break") {
				currentSectionConfig = this._getSectionConfig(df);
				sectionHidden = !!(currentSectionConfig && currentSectionConfig.hidden);

				if (this.show_section_headers && df.label && !sectionHidden) {
					tbody.appendChild(this._buildSectionRow(df.label, currentSectionConfig));
				}
				return;
			}

			if (sectionHidden) return;
			if (!visibleFieldNames.has(df.fieldname)) return;
			if (this.hide_empty_rows && this.isEmptyRow(df)) return;

			const fieldRow = this._buildFieldRow(df);
			if (currentSectionConfig && currentSectionConfig.collapsed) {
				fieldRow.style.display = "none";
			}
			tbody.appendChild(fieldRow);
		});

		return tbody;
	},

	// ─── Section header row ──────────────────────────────────────────────────

	/**
	 * Build a section header <tr>.
	 *
	 * @param {string} label        — field label from meta
	 * @param {object|null} conf    — section_configs entry (may contain label, bg_color,
	 *                                text_color, collapsed, hidden)
	 */
	_buildSectionRow(label, conf = null) {
		const tr = document.createElement("tr");
		tr.className = "sva-vdr-section-row";
		const colCount = this.getColumnCount();

		const isCollapsible = conf !== null && conf.collapsed !== undefined;
		const initiallyCollapsed = !!(conf && conf.collapsed);

		// Track collapsed state on the element for _toggleSection
		tr.dataset.collapsed = initiallyCollapsed ? "true" : "false";

		// Developer override — fires first so the hook can replace the entire row.
		// Collapse toggling is still wired below even when the hook takes over.
		if (typeof this.events.renderSectionHeader === "function") {
			const result = this.events.renderSectionHeader(label, colCount, tr);
			if (result === true) {
				if (isCollapsible) {
					tr.style.cursor = "pointer";
					tr.addEventListener("click", () => this._toggleSection(tr));
				}
				return tr;
			}
		}

		// Default rendering
		const displayLabel = (conf && conf.label) || label;
		const bgColor = conf && conf.bg_color;
		const textColor = conf && conf.text_color;

		const td = document.createElement("td");
		td.colSpan = colCount;
		td.style.cssText = `
			background: ${bgColor || "var(--sva-vdr-section-bg, #1a3a5c)"};
			color: ${textColor || "var(--sva-vdr-section-text, #fff)"};
			font-weight: 600;
			padding: 5px 10px;
			font-size: 13px;
			letter-spacing: 0.3px;
			${isCollapsible ? "cursor: pointer; user-select: none;" : ""}
		`;

		if (isCollapsible) {
			// Toggle arrow prefix
			const arrow = document.createElement("span");
			arrow.className = "sva-vdr-section-arrow";
			arrow.style.cssText =
				"display:inline-block;margin-right:6px;font-size:10px;vertical-align:middle;";
			arrow.textContent = initiallyCollapsed ? "▶" : "▼";
			td.appendChild(arrow);
			td.appendChild(document.createTextNode(displayLabel));
			tr.addEventListener("click", () => this._toggleSection(tr));
		} else {
			td.textContent = displayLabel;
		}

		tr.appendChild(td);
		return tr;
	},

	/**
	 * Toggle the collapsed state of a section header row.
	 * Shows/hides all sibling field rows until the next section row.
	 *
	 * @param {HTMLElement} sectionTr — the section header <tr>
	 */
	_toggleSection(sectionTr) {
		const nowCollapsed = sectionTr.dataset.collapsed === "true";
		const willCollapse = !nowCollapsed;
		sectionTr.dataset.collapsed = willCollapse ? "true" : "false";

		// Update the arrow indicator (if present)
		const arrow = sectionTr.querySelector(".sva-vdr-section-arrow");
		if (arrow) arrow.textContent = willCollapse ? "▶" : "▼";

		// Walk subsequent siblings — toggle field rows; stop at next section row
		let next = sectionTr.nextElementSibling;
		while (next && !next.classList.contains("sva-vdr-section-row")) {
			if (next.classList.contains("sva-vdr-field-row")) {
				next.style.display = willCollapse ? "none" : "";
			}
			next = next.nextElementSibling;
		}
	},

	// ─── Field data row ──────────────────────────────────────────────────────

	_buildFieldRow(df) {
		const tr = document.createElement("tr");
		tr.className = "sva-vdr-field-row";
		tr.dataset.fieldname = df.fieldname;

		// Developer override for entire row
		if (typeof this.events.renderRow === "function") {
			const result = this.events.renderRow(df, this.data, tr);
			if (result === true) return tr; // fully custom row
		}

		tr.style.cssText = "transition: background .1s;";
		tr.addEventListener("mouseenter", () => {
			tr.style.background = "var(--sva-vdr-row-hover, #f0f4ff)";
		});
		tr.addEventListener("mouseleave", () => {
			tr.style.background = "";
		});

		// Label cell — sticky left, highest z-index among tbody cells
		const labelTd = document.createElement("td");
		labelTd.className = "sva-vdr-label-cell sva-vdr-sticky-col";
		labelTd.style.cssText = `
			position: sticky;
			left: 0;
			z-index: 1;
			background: var(--sva-vdr-label-bg, #dce6f1);
			color: var(--sva-vdr-label-text, #1a3a5c);
			font-weight: 500;
			padding: 4px 10px;
			white-space: normal;
			word-break: break-word;
			overflow-wrap: break-word;
			border: 1px solid rgba(0,0,0,.06);
			min-width: ${this._responsiveLabelWidth()}px;
			width: ${this._responsiveLabelWidth()}px;
			max-width: ${this._responsiveLabelWidth()}px;
		`;
		labelTd.textContent = __(df.label || df.fieldname);
		tr.appendChild(labelTd);

		// Unit column
		if (this.show_unit) {
			const unitTd = document.createElement("td");
			unitTd.className = "sva-vdr-unit-cell";
			unitTd.style.cssText = `
				padding: 4px 8px;
				text-align: center;
				color: var(--text-muted, #888);
				font-size: 11px;
				border: 1px solid rgba(0,0,0,.06);
				white-space: nowrap;
			`;
			unitTd.textContent = this.getFieldUnit(df);
			tr.appendChild(unitTd);
		}

		// One value cell per document — first batch only; viewport mixin appends the rest
		this.data.forEach((doc, colIndex) => {
			tr.appendChild(this._buildValueCell(df, doc, colIndex));
		});

		return tr;
	},

	// ─── Reusable column/cell builders (also called by ViewportMixin) ────────

	/**
	 * Build a single <th> for one document column header.
	 * Adds hover listeners for the delete icon when delete is permitted.
	 *
	 * @param {object} doc      — document data object (must have .name)
	 * @param {number} colIndex — 0-based absolute column index
	 * @param {object} conf     — column config {label, bg_color, text_color}
	 * @returns {HTMLElement}
	 */
	_buildDocHeaderCell(doc, colIndex, conf) {
		const label =
			(this.column_label_field && doc[this.column_label_field]) || conf.label || doc.name;

		// Priority: explicit column_configs[i] > color_rules match > column_default > fallback
		const rule = !conf.bg_color && this._matchColorRule ? this._matchColorRule(label) : null;
		const bgColor =
			conf.bg_color || (rule && rule.bg_color) || this.column_default_bg || "#4472C4";
		const textColor =
			conf.text_color || (rule && rule.text_color) || this.column_default_text || "#fff";

		const th = document.createElement("th");
		th.className = "sva-vdr-header-cell sva-vdr-doc-header";
		th.dataset.docname = doc.name;
		th.style.cssText = `
			background: ${bgColor};
			color: ${textColor};
			font-weight: 600;
			padding: 6px 10px;
			text-align: center;
			white-space: nowrap;
			border: 1px solid rgba(0,0,0,.08);
			position: sticky;
			top: 0;
			z-index: 2;
		`;
		th.textContent = label;

		if (typeof this.events.renderColumnHeader === "function") {
			this.events.renderColumnHeader(doc, colIndex, th);
		}

		// Wire hover listeners for delete icon reveal (keyed by doc.name, not index,
		// so they remain correct after other columns are deleted)
		if (this._canDelete && this._canDelete()) {
			th.addEventListener("mouseenter", () => this._showDeleteIcon(doc.name));
			th.addEventListener("mouseleave", () => this._hideDeleteIcon(doc.name));
		}

		return th;
	},

	/**
	 * Build a single <td> for one document's value in a field row.
	 * Applies per-cell validation state (hidden / read-only).
	 * Stamps data-raw-value for link title resolution.
	 *
	 * @param {object} df       — field descriptor from meta
	 * @param {object} doc      — document data object
	 * @param {number} colIndex — 0-based absolute column index
	 * @returns {HTMLElement}
	 */
	_buildValueCell(df, doc, colIndex) {
		const td = document.createElement("td");
		td.className = "sva-vdr-value-cell";
		td.dataset.fieldname = df.fieldname;
		td.dataset.docname = doc.name;
		// Store raw value as data attribute for link title lookup
		td.dataset.rawValue = String(doc[df.fieldname] ?? "");

		// Per-cell visibility (depends_on evaluated for this specific doc)
		if (this.isFieldHidden && this.isFieldHidden(df, doc)) {
			td.style.cssText = `
				padding: 4px 10px;
				border: 1px solid rgba(0,0,0,.06);
				visibility: hidden;
			`;
			return td; // no content, no edit listener
		}

		// Per-cell read-only state
		const readOnly = this.isFieldReadOnly && this.isFieldReadOnly(df, doc);

		td.style.cssText = `
			padding: 4px 10px;
			border: 1px solid rgba(0,0,0,.06);
			text-align: left;
			vertical-align: middle;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			${
				readOnly
					? "background: var(--sva-vdr-readonly-bg, #f5f5f5); color: var(--sva-vdr-readonly-text, #999);"
					: ""
			}
		`;

		const formatted = this.formatCellValue(doc[df.fieldname], df, doc, colIndex);
		td.innerHTML = formatted;

		// Empty Link cell + write permission → show a subtle dropdown hint
		if (
			!formatted &&
			!readOnly &&
			df.fieldtype === "Link" &&
			this.crud_permissions &&
			this.crud_permissions.includes("write")
		) {
			td.innerHTML = `<span style="color:#bbb;font-size:12px;user-select:none;" title="${__(
				"Click to select"
			)}">▾</span>`;
		}

		// Only attach edit listener when the cell is writable
		if (!readOnly) {
			this.attachEditListener(td, df, doc, colIndex);
		}

		return td;
	},

	// ─── Helpers ────────────────────────────────────────────────────────────

	/**
	 * Minimum table width in pixels for a given column count.
	 * Used to set/update table min-width so the table scrolls horizontally on
	 * narrow viewports instead of squishing columns.
	 *
	 * @param {number} colCount — number of document columns currently rendered
	 * @returns {number}
	 */
	_calcTableMinWidth(colCount) {
		const labelW = this._responsiveLabelWidth();
		const colW = this.column_width || 150;
		const unitW = this.show_unit ? 60 : 0;
		return labelW + unitW + colCount * colW;
	},

	// ─── Legend ─────────────────────────────────────────────────────────────

	_buildLegend() {
		const legend = document.createElement("div");
		legend.className = "sva-vdr-legend";
		legend.style.cssText = `
			margin-top: 8px;
			font-size: 11px;
			color: var(--text-muted, #666);
			display: flex;
			flex-wrap: wrap;
			gap: 4px 12px;
		`;

		this.legend_items.forEach((item) => {
			const span = document.createElement("span");
			span.style.cssText = `display:inline-flex;align-items:center;gap:4px;`;

			const dot = document.createElement("span");
			dot.style.cssText = `
				display: inline-block;
				width: 10px;
				height: 10px;
				border-radius: 2px;
				background: ${item.bg_color || "#4472C4"};
				flex-shrink: 0;
			`;

			const text = document.createElement("span");
			text.style.color = item.text_color || "inherit";
			text.textContent = `${item.label}: ${item.description || ""}`;

			span.appendChild(dot);
			span.appendChild(text);
			legend.appendChild(span);
		});

		this.container.appendChild(legend);
	},
};

export default RenderingMixin;
