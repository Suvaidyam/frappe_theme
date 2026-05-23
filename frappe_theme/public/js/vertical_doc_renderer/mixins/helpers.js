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
			return (
				v === null ||
				v === undefined ||
				v === "" ||
				v === 0 ||
				(Array.isArray(v) && !v.length)
			);
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
	 * Match a column header label against this.column_color_rules.
	 * Each rule: { key, bg_color, text_color, priority }
	 *   - key       — case-insensitive substring to match against the label
	 *   - priority  — higher number wins when multiple keys match (default 0)
	 *
	 * Returns the winning rule object, or null when no rule matches.
	 *
	 * @param {string} label — column header label (doc name or column_label_field value)
	 * @returns {object|null}
	 */
	_matchColorRule(label) {
		if (!this.column_color_rules || !this.column_color_rules.length) return null;
		const haystack = String(label || "").toLowerCase();
		let best = null;
		for (const rule of this.column_color_rules) {
			const key = String(rule.key || "").toLowerCase();
			if (key && haystack.includes(key)) {
				if (!best) {
					best = rule;
				} else {
					const bp = best.priority ?? 0;
					const rp = rule.priority ?? 0;
					const bestKey = String(best.key || "").toLowerCase();
					// Higher priority wins; on tie prefer longer key (more specific match)
					if (rp > bp || (rp === bp && key.length > bestKey.length)) {
						best = rule;
					}
				}
			}
		}
		return best;
	},

	/**
	 * Match a column header label against this.column_order_rules.
	 * Each rule: { key, order, priority }
	 *   - key       — case-insensitive substring to match against the label
	 *   - order     — numeric sort position (lower = rendered first)
	 *   - priority  — higher number wins when multiple keys match (default 0)
	 *
	 * Returns the winning rule object, or null when no rule matches.
	 *
	 * @param {string} label
	 * @returns {object|null}
	 */
	_matchOrderRule(label) {
		if (!this.column_order_rules || !this.column_order_rules.length) return null;
		const haystack = String(label || "").toLowerCase();
		let best = null;
		for (const rule of this.column_order_rules) {
			const key = String(rule.key || "").toLowerCase();
			if (key && haystack.includes(key)) {
				if (!best) {
					best = rule;
				} else {
					const bp = best.priority ?? 0;
					const rp = rule.priority ?? 0;
					const bestKey = String(best.key || "").toLowerCase();
					// Higher priority wins; on tie prefer longer key (more specific match)
					if (rp > bp || (rp === bp && key.length > bestKey.length)) {
						best = rule;
					}
				}
			}
		}
		return best;
	},

	/**
	 * Sort this.data (and this.column_configs) according to column_order_rules.
	 * Called once after fetchDocs(), before render().
	 *
	 * For object[] input mode: also sorts this._all_inputs so viewport lazy-loaded
	 * batches maintain the same order.
	 * For string[]/null modes: only the already-fetched data is sorted (known limitation).
	 *
	 * Columns that match no rule are placed at the end (order = Infinity).
	 */
	_sortDataByOrderRules() {
		if (!this.column_order_rules || !this.column_order_rules.length) return;
		if (!this.data || !this.data.length) return;

		const labelField = this.column_label_field;
		const configs = this.column_configs || [];

		const getOrder = (doc, i) => {
			const label = (labelField && doc[labelField]) || configs[i]?.label || doc.name || "";
			const rule = this._matchOrderRule(label);
			return rule ? rule.order ?? Infinity : Infinity;
		};

		// object[] mode — sort full _all_inputs so viewport batches are also ordered
		if (
			this._all_inputs !== null &&
			Array.isArray(this._all_inputs) &&
			this._all_inputs.length > 0 &&
			typeof this._all_inputs[0] === "object"
		) {
			const entries = this._all_inputs.map((doc, i) => ({
				doc,
				conf: configs[i] || {},
				order: getOrder(doc, i),
			}));
			entries.sort((a, b) => a.order - b.order);
			this._all_inputs = entries.map((e) => e.doc);
			this.column_configs = entries.map((e) => e.conf);
			const batchSize = this.data.length;
			this.data = this._all_inputs.slice(0, batchSize);
			this.docs = this.data.map((d) => d.name);
			return;
		}

		// string[] / null mode — sort only the fetched first batch
		const entries = this.data.map((doc, i) => ({
			doc,
			conf: configs[i] || {},
			order: getOrder(doc, i),
		}));
		entries.sort((a, b) => a.order - b.order);
		this.data = entries.map((e) => e.doc);
		this.column_configs = entries.map((e) => e.conf);
		this.docs = this.data.map((d) => d.name);
	},

	/**
	 * Re-sort all already-rendered columns by column_order_rules.
	 * Called after each lazy-loaded batch so cross-batch ordering is correct.
	 * Reorders this.data, this.docs, this.column_configs, and all DOM columns.
	 */
	_reorderColumnsByRules() {
		if (!this.column_order_rules || !this.column_order_rules.length) return;
		if (!this.data || !this.data.length) return;

		const labelField = this.column_label_field;
		const configs = this.column_configs || [];

		const entries = this.data.map((doc, i) => {
			const label = (labelField && doc[labelField]) || configs[i]?.label || doc.name || "";
			const rule = this._matchOrderRule(label);
			return {
				doc,
				conf: configs[i] || {},
				order: rule ? rule.order ?? Infinity : Infinity,
				origIndex: i,
			};
		});
		entries.sort((a, b) => a.order - b.order || a.origIndex - b.origIndex);

		this.data = entries.map((e) => e.doc);
		this.docs = this.data.map((d) => d.name);
		this.column_configs = entries.map((e) => e.conf);

		// Reorder header <th>s — insertBefore sentinel/create keeps them before the controls
		const insertBefore = this._createTh || this._sentinel || null;
		this.data.forEach((doc) => {
			const th = this._theadRow.querySelector(`th[data-docname="${doc.name}"]`);
			if (!th) return;
			if (insertBefore) this._theadRow.insertBefore(th, insertBefore);
			else this._theadRow.appendChild(th);
		});

		// Reorder value <td>s in each field row
		this._table.querySelectorAll("tr.sva-vdr-field-row").forEach((tr) => {
			this.data.forEach((doc) => {
				const td = tr.querySelector(`td[data-docname="${doc.name}"]`);
				if (td) tr.appendChild(td);
			});
		});

		// Reorder delete cells (if delete row exists)
		if (this._deleteRow) {
			this.data.forEach((doc) => {
				const td = this._deleteRow.querySelector(`td[data-docname="${doc.name}"]`);
				if (td) this._deleteRow.appendChild(td);
			});
		}
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
			this.section_configs["*"] ||
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
			"Barcode",
			"Tab Break",
			"Section Break",
		]);

		const all = (this.meta.fields || []).filter(
			(df) => !SKIP_TYPES.has(df.fieldtype) && !df.hidden
		);

		let visible;
		if (this.fields_config && this.fields_config.length > 0) {
			// fields_config is authoritative: defines both order and visibility
			const map = new Map(all.map((df) => [df.fieldname, df]));
			visible = this.fields_config.map((fn) => map.get(fn)).filter(Boolean);
		} else {
			// Default: apply fields_to_show / fields_to_hide in meta order
			visible = all.filter((df) => {
				if (this.fields_to_hide && this.fields_to_hide.includes(df.fieldname))
					return false;
				if (this.fields_to_show && !this.fields_to_show.includes(df.fieldname))
					return false;
				return true;
			});
		}

		// filterRow hook: sync per-field gate; return false to hide a row.
		// Use this to conditionally show/hide VDR rows based on doc values or config.
		// Note: must be synchronous — called inside the rendering loop.
		if (typeof this.events.filterRow === "function") {
			visible = visible.filter((df) => this.events.filterRow(df, this) !== false);
		}

		return visible;
	},
};

export default HelpersMixin;
