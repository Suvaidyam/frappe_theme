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
