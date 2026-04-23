const HelpersMixin = {
	/**
	 * Total column count: label col + optional unit col + one col per doc.
	 */
	getColumnCount() {
		return 1 + (this.show_unit ? 1 : 0) + this.docs.length;
	},

	/**
	 * Re-order fetched doc records to match the order of this.docs.
	 * @param {Array} data — array of objects returned by frappe.db.get_list
	 * @returns {Array} sorted array aligned with this.docs
	 */
	sortDataByDocs(data) {
		const map = {};
		data.forEach((d) => (map[d.name] = d));
		return this.docs.map((name) => map[name] || { name });
	},

	/**
	 * Returns true when every document has a null/empty value for the given field.
	 * Used to skip rows when hide_empty_rows is enabled.
	 * @param {Object} df — field descriptor from meta
	 */
	isEmptyRow(df) {
		return this.data.every((doc) => {
			const v = doc[df.fieldname];
			return v === null || v === undefined || v === "" || v === 0;
		});
	},

	/**
	 * Parse a short unit string from a field's description.
	 * Supports patterns like "in acre", "in year", "(ac)", "(yr)" etc.
	 * Returns empty string if no unit found.
	 * @param {Object} df — field descriptor
	 * @returns {string}
	 */
	getFieldUnit(df) {
		if (!df.description) return "";
		const desc = df.description.trim();

		// "in <unit>" pattern — take the word after "in"
		const inMatch = desc.match(/\bin\s+(\S+)/i);
		if (inMatch) {
			return this._abbreviateUnit(inMatch[1]);
		}

		// "(unit)" pattern — text inside first parentheses
		const parenMatch = desc.match(/\(([^)]+)\)/);
		if (parenMatch) {
			return parenMatch[1].trim();
		}

		return "";
	},

	/**
	 * Map common full unit names to short abbreviations.
	 * @param {string} unit
	 * @returns {string}
	 */
	_abbreviateUnit(unit) {
		const MAP = {
			acre: "ac",
			acres: "ac",
			year: "yr",
			years: "yr",
			hectare: "ha",
			hectares: "ha",
			kilogram: "kg",
			kilograms: "kg",
			meter: "m",
			meters: "m",
			kilometer: "km",
			kilometers: "km",
			litre: "L",
			litres: "L",
			liter: "L",
			liters: "L",
		};
		return MAP[unit.toLowerCase()] || unit;
	},

	/**
	 * Resolve the section_configs entry for a given Section/Tab Break field.
	 * Looks up by fieldname first, then by label (case-sensitive).
	 * Returns null when no config exists for this section.
	 *
	 * @param {Object} df — Section Break or Tab Break field descriptor
	 * @returns {Object|null}
	 */
	_getSectionConfig(df) {
		if (!this.section_configs || typeof this.section_configs !== "object") return null;
		return (
			this.section_configs[df.fieldname] ||
			(df.label ? this.section_configs[df.label] : null) ||
			null
		);
	},

	/**
	 * Return the list of field descriptors that should be rendered as data rows.
	 *
	 * When this.fields_config is set (row settings saved by user or admin), it is
	 * the authoritative ordered+visible field list and overrides fields_to_show /
	 * fields_to_hide. When null, the default meta order + fields_to_show/hide
	 * applies.
	 *
	 * Section Break and Tab Break are NOT filtered here — rendering.js handles
	 * those separately.
	 * @returns {Array}
	 */
	getVisibleFields() {
		const SKIP_TYPES = new Set([
			"Column Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Signature",
			"Geolocation",
			"Barcode",
			"Tab Break",
			"Section Break",
		]);

		const all = (this.meta.fields || []).filter(
			(df) => !SKIP_TYPES.has(df.fieldtype) && !df.hidden
		);

		if (this.fields_config && this.fields_config.length > 0) {
			// fields_config is authoritative: defines both order and visibility
			const map = new Map(all.map((df) => [df.fieldname, df]));
			return this.fields_config.map((fn) => map.get(fn)).filter(Boolean);
		}

		// Default: apply fields_to_show / fields_to_hide in meta order
		return all.filter((df) => {
			if (this.fields_to_hide && this.fields_to_hide.includes(df.fieldname)) return false;
			if (this.fields_to_show && !this.fields_to_show.includes(df.fieldname)) return false;
			return true;
		});
	},
};

export default HelpersMixin;
