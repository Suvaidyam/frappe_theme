const FieldsMixin = {
	/**
	 * Format a cell value for display.
	 * Checks vdr_events.formatCell first; falls back to frappe.format().
	 *
	 * @param {*}      value    — raw value from the document
	 * @param {Object} df       — field descriptor from meta
	 * @param {Object} doc      — full document row
	 * @param {number} colIndex — 0-based index of this doc column
	 * @returns {string} HTML or text to place into the cell
	 */
	formatCellValue(value, df, doc, colIndex) {
		// Developer override — return null to fall through to default
		if (typeof this.events.formatCell === "function") {
			const override = this.events.formatCell(value, df, doc, colIndex);
			if (override !== null && override !== undefined) {
				return override;
			}
		}

		// Table: always route here — handles null/empty with 📋 placeholder
		if (df.fieldtype === "Table") {
			return this._formatTable(value, df);
		}

		if (value === null || value === undefined || value === "") {
			return "";
		}

		// Geolocation: parse GeoJSON and show human-readable coordinates / type summary
		if (df.fieldtype === "Geolocation") {
			return this._formatGeolocation(value);
		}

		// Use Frappe's built-in formatter when available
		try {
			const formatted = frappe.format(value, df, { inline: true }, doc);
			return formatted !== null && formatted !== undefined ? formatted : String(value);
		} catch (_) {
			return String(value);
		}
	},

	/**
	 * Render a Geolocation field value compactly for the comparison table.
	 *
	 * - Single Point  → "📍 lat, lng" as a Google Maps link
	 * - Polygon/Line/mixed → "🗺 <type> (<n> features)" label
	 *
	 * GeoJSON coordinates are stored as [longitude, latitude]; display is lat, lng.
	 *
	 * @param {string|object} value — raw field value (GeoJSON string or object)
	 * @returns {string} safe HTML string
	 */
	/**
	 * Format a Table (child table) field value as "FieldLabel(value), ..." per field.
	 *
	 * For each non-empty field in each row shows "Label(formatted_value)":
	 *   - Geolocation  → "P1(🗺 Polygon)" using geometry type
	 *   - Other fields → "FieldName(raw_value)"
	 *
	 * Uses child DocType meta from Frappe's in-memory cache (frappe.get_meta).
	 * Falls back to "(row1), (row2)..." when meta is not yet cached.
	 * Returns 📋 when value is null / not yet loaded.
	 *
	 * @param {*}      value — raw field value (array of row objects, or null)
	 * @param {Object} df    — Table field descriptor (df.options = child DocType name)
	 */
	_formatTable(value, df) {
		// frappe.db.get_list may return a numeric row count for Table fields instead of
		// the actual rows — show a count badge so the cell isn't misleadingly empty.
		if (typeof value === "number" && value > 0) {
			return `<span style="color:var(--text-muted,#aaa);font-size:13px;" title="${__(
				"Child table — click to view/edit"
			)}">📋 ${value}</span>`;
		}
		if (!Array.isArray(value) || !value.length) {
			return `<span style="color:var(--text-muted,#aaa);font-size:13px;" title="${__(
				"Child table — click to view/edit"
			)}">📋</span>`;
		}

		const SYSTEM = new Set([
			"name",
			"doctype",
			"parent",
			"parentfield",
			"parenttype",
			"idx",
			"docstatus",
			"creation",
			"modified",
			"modified_by",
			"owner",
			"__islocal",
			"__unsaved",
		]);

		// Use cached child meta when available
		const childMeta = df && df.options ? frappe.get_meta(df.options) : null;
		const childFields = childMeta ? childMeta.fields || [] : null;

		const parts = [];

		value.forEach((row) => {
			Object.entries(row)
				.filter(
					([k, v]) =>
						!SYSTEM.has(k) && v !== null && v !== undefined && v !== "" && v !== 0
				)
				.forEach(([k, v]) => {
					const fdf = childFields && childFields.find((f) => f.fieldname === k);
					const label = fdf ? __(fdf.label || k) : k;

					let displayVal;
					if (fdf && fdf.fieldtype === "Geolocation") {
						displayVal = this._getGeoTypeSummary(v);
					} else if (childFields) {
						displayVal = String(v).slice(0, 30);
					} else {
						// Meta not loaded yet — show raw value truncated
						displayVal = String(v).slice(0, 20);
					}

					if (displayVal) {
						parts.push(
							`<span style="white-space:nowrap;">${label}(${displayVal})</span>`
						);
					}
				});
		});

		if (!parts.length) {
			return `<span style="color:var(--text-muted,#aaa);font-size:13px;">📋</span>`;
		}

		return parts.join(",&nbsp;");
	},

	/**
	 * Extract the geometry type label from a GeoJSON value — used for compact
	 * child-table Geolocation summaries, e.g. "🗺 Polygon", "📍 Point".
	 */
	_getGeoTypeSummary(value) {
		try {
			const geo = typeof value === "string" ? JSON.parse(value) : value;
			if (!geo || !Array.isArray(geo.features) || !geo.features.length) return "";
			const types = [...new Set(geo.features.map((f) => f.geometry?.type).filter(Boolean))];
			if (!types.length) return "";
			const icon = types.includes("Point") && types.length === 1 ? "📍" : "🗺";
			return `${icon} ${types.join("/")}`;
		} catch (_) {
			return "";
		}
	},

	_formatGeolocation(value) {
		try {
			const geo = typeof value === "string" ? JSON.parse(value) : value;
			if (!geo || !Array.isArray(geo.features) || !geo.features.length) return "";

			const geomTypes = [
				...new Set(geo.features.map((f) => f.geometry?.type).filter(Boolean)),
			];
			if (!geomTypes.length) return "";

			// Single Point — show coordinates and link to Google Maps
			if (geomTypes.length === 1 && geomTypes[0] === "Point") {
				const [lng, lat] = geo.features[0].geometry.coordinates;
				const latF = parseFloat(lat).toFixed(6);
				const lngF = parseFloat(lng).toFixed(6);
				return (
					`<a href="https://www.google.com/maps?q=${latF},${lngF}" ` +
					`target="_blank" rel="noopener" title="${latF}, ${lngF}" ` +
					`style="white-space:nowrap;text-decoration:none;font-size:12px;">` +
					`📍 ${latF}, ${lngF}</a>`
				);
			}

			// Polygon, LineString, or mixed — show a compact label
			const count = geo.features.length;
			const typeLabel = geomTypes.join(" / ");
			return (
				`<span title="Geolocation: ${typeLabel}" ` +
				`style="white-space:nowrap;color:var(--text-muted,#888);font-size:12px;">` +
				`🗺 ${typeLabel}${count > 1 ? ` (${count})` : ""}` +
				`</span>`
			);
		} catch (_) {
			return String(value);
		}
	},
};

export default FieldsMixin;
