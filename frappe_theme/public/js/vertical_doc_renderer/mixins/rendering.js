const RenderingMixin = {
	/**
	 * Top-level render: build table, optional legend, fire afterRender hook.
	 */
	render() {
		if (!this.meta) return;

		this._buildTable();
		if (this.show_legend && this.legend_items && this.legend_items.length) {
			this._buildLegend();
		}

		if (typeof this.events.afterRender === "function") {
			this.events.afterRender(this);
		}
	},

	// ─── Table ──────────────────────────────────────────────────────────────

	_buildTable() {
		const table = document.createElement("table");
		table.className = "sva-vdr-table";
		table.style.cssText = `
			border-collapse: collapse;
			width: 100%;
			min-width: 300px;
			table-layout: auto;
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
		const paramTh = document.createElement("th");
		paramTh.textContent = __("Parameters");
		paramTh.className = "sva-vdr-header-cell sva-vdr-sticky-col";
		this._styleHeaderCell(paramTh);
		paramTh.style.left = "0";
		paramTh.style.zIndex = "3"; // corner: above both sticky-top and sticky-left
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

		// "+" create column — always at the far right (viewport inserts before it)
		if (this.allow_create) {
			this._createTh = this._buildCreateHeaderCell();
			tr.appendChild(this._createTh);
		}

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

		// Delete row — prepended as first row when delete permission is granted
		if (this._canDelete && this._canDelete()) {
			tbody.appendChild(this._buildDeleteRow());
		}

		const fields = this.meta.fields || [];
		const visibleFieldNames = new Set(this.getVisibleFields().map((df) => df.fieldname));

		const SKIP_TYPES = new Set([
			"Column Break", "HTML", "Button", "Fold", "Image",
			"Signature", "Geolocation", "Barcode",
		]);

		fields.forEach((df) => {
			if (SKIP_TYPES.has(df.fieldtype)) return;

			if (df.fieldtype === "Section Break") {
				if (this.show_section_headers && df.label) {
					tbody.appendChild(this._buildSectionRow(df.label));
				}
				return;
			}

			if (df.fieldtype === "Tab Break") {
				if (this.show_section_headers && df.label) {
					tbody.appendChild(this._buildSectionRow(df.label));
				}
				return;
			}

			// Regular field row — only if it passes visibility filters
			if (!visibleFieldNames.has(df.fieldname)) return;

			// Skip empty rows when requested
			if (this.hide_empty_rows && this.isEmptyRow(df)) return;

			tbody.appendChild(this._buildFieldRow(df));
		});

		return tbody;
	},

	// ─── Section header row ──────────────────────────────────────────────────

	_buildSectionRow(label) {
		const tr = document.createElement("tr");
		tr.className = "sva-vdr-section-row";
		const colCount = this.getColumnCount();

		const td = document.createElement("td");
		td.colSpan = colCount;
		td.style.cssText = `
			background: var(--sva-vdr-section-bg, #1a3a5c);
			color: var(--sva-vdr-section-text, #fff);
			font-weight: 600;
			padding: 5px 10px;
			font-size: 13px;
			letter-spacing: 0.3px;
		`;
		td.textContent = label;

		// Developer override
		if (typeof this.events.renderSectionHeader === "function") {
			const result = this.events.renderSectionHeader(label, colCount, tr);
			if (result === true) return tr;
		}

		tr.appendChild(td);
		return tr;
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
			white-space: nowrap;
			border: 1px solid rgba(0,0,0,.06);
			min-width: 140px;
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
		const bgColor = conf.bg_color || "#4472C4";
		const textColor = conf.text_color || "#fff";
		const label = conf.label || doc.name;

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
			min-width: 120px;
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
			min-width: 100px;
			max-width: 280px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			${readOnly
				? "background: var(--sva-vdr-readonly-bg, #f5f5f5); color: var(--sva-vdr-readonly-text, #999);"
				: ""
			}
		`;

		const formatted = this.formatCellValue(doc[df.fieldname], df, doc, colIndex);
		td.innerHTML = formatted;

		// Only attach edit listener when the cell is writable
		if (!readOnly) {
			this.attachEditListener(td, df, doc, colIndex);
		}

		return td;
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
