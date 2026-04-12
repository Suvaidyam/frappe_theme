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

		// Use Frappe's built-in formatter when available
		try {
			const formatted = frappe.format(value, df, { inline: true }, doc);
			return formatted !== null && formatted !== undefined ? formatted : String(value);
		} catch (_) {
			return String(value);
		}
	},
};

export default FieldsMixin;
