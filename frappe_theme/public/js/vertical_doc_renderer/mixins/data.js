const DataMixin = {
	/**
	 * Build the list of data-bearing fieldnames from meta (no layout fields).
	 * Used by fetchDocs() and viewport._fetchBatchData() to request consistent fields.
	 */
	_getDataFields() {
		// Table and Table MultiSelect are child tables — no column in the parent DB table,
		// so they must never be included in frappe.db.get_list() fields (causes SQL error).
		// Their values are fetched separately via _fetchTableMultiSelectData().
		const LAYOUT_TYPES = new Set([
			"Section Break",
			"Column Break",
			"Tab Break",
			"HTML",
			"Button",
			"Fold",
			"Image",
			"Table",
			"Table MultiSelect",
		]);
		const fields = ["name"];
		(this.meta.fields || []).forEach((df) => {
			if (!LAYOUT_TYPES.has(df.fieldtype) && df.fieldname) {
				fields.push(df.fieldname);
			}
		});
		return fields;
	},

	/**
	 * Fetch child table rows for all Table MultiSelect fields in this.meta
	 * and merge them into the provided docs array.
	 *
	 * frappe.db.get_list cannot return child table data, so this makes one
	 * extra get_list call per Table MultiSelect field, filtering by parent.
	 *
	 * Frappe convention: child doctype's link fieldname == parent fieldname (df.fieldname).
	 *
	 * @param {object[]} docs — array of document objects to enrich
	 */
	async _fetchTableMultiSelectData(docs) {
		if (!docs || !docs.length || !this.meta) return;

		const msFields = (this.meta.fields || []).filter(
			(df) => df.fieldtype === "Table MultiSelect" && df.options && df.fieldname
		);
		if (!msFields.length) return;

		// frappe.db.get_doc guarantees child table data is included.
		// Docs are fetched in parallel — for the typical VDR of 3-10 columns this is fast.
		await Promise.all(
			docs.map(async (doc) => {
				try {
					const fullDoc = await frappe.db.get_doc(this.doctype, doc.name);
					msFields.forEach((df) => {
						doc[df.fieldname] = fullDoc[df.fieldname] || [];
					});
				} catch (e) {
					console.warn(
						`SVAVerticalDocRenderer: _fetchTableMultiSelectData failed for ${doc.name}`,
						e
					);
					msFields.forEach((df) => {
						if (!Array.isArray(doc[df.fieldname])) doc[df.fieldname] = [];
					});
				}
			})
		);
	},

	/**
	 * Load DocType meta.
	 * If this._meta_override is set (caller passed a meta object), use it directly.
	 *
	 * Otherwise uses frappe_theme.dt_api.get_meta_fields with meta_attached=1,
	 * which returns { fields: [...], meta: {...full frappe meta...} }.
	 * This mirrors the exact pattern used by SVADatatable.
	 *
	 * frappe.xcall is used (instead of frappe.call) because it resolves to the
	 * message payload directly, just like SVAHTTP.call does in the datatable.
	 */
	async fetchMeta() {
		if (this._meta_override) {
			this.meta = this._meta_override;
			return;
		}
		try {
			// response = { fields: [...filtered fields (no Tab Break)...], meta: {...} }
			const response = await frappe.xcall("frappe_theme.dt_api.get_meta_fields", {
				doctype: this.doctype,
				_type: "Direct",
				meta_attached: 1,
			});
			// Spread full Frappe meta dict so all properties are available,
			// then override fields with the filtered list (no Tab Break) and
			// set name explicitly from this.doctype.
			this.meta = {
				...(response?.meta || {}),
				name: this.doctype,
				fields: response?.fields || [],
			};
		} catch (e) {
			console.error("SVAVerticalDocRenderer: fetchMeta failed", e);
			this.meta = { name: this.doctype, fields: [] };
		}
	},

	/**
	 * Fetch the first batch of document data.
	 *
	 * Three input shapes for this._docs_input:
	 *
	 *   object[]  → data is already provided inline; no network call; sliced to batch_size
	 *   string[]  → fetch the first batch of doc names from the server
	 *   null      → paginated frappe.db.get_list (start=0, limit=column_batch_size)
	 *
	 * After this call:
	 *   this.data        = first-batch records (array of plain objects)
	 *   this.docs        = first-batch doc names (aligned with this.data)
	 *   this._all_inputs = full input array (for viewport.js to slice on scroll)
	 *                      OR null when docs:null (unknown total; keep fetching until server returns empty)
	 */
	async fetchDocs() {
		const input = this._docs_input;
		const batchSize = this.column_batch_size || 10;

		// Guard: mimicked/custom meta object + docs:null is unsupported — we can't
		// call frappe.db.get_list against a name that has no real DB table.
		if (input === null && this._meta_override) {
			console.warn(
				"SVAVerticalDocRenderer: docs: null is not supported when doctype is a " +
					"mimicked meta object. Pass docs as an array of objects instead."
			);
			this._all_inputs = null;
			this.data = [];
			this.docs = [];
			return;
		}

		// ── object[] — inline data, zero network calls ───────────────────────
		if (Array.isArray(input) && input.length > 0 && typeof input[0] === "object") {
			this._all_inputs = input;
			const batch = input.slice(0, batchSize);
			this.data = batch;
			this.docs = batch.map((d) => d.name);
			await this._fetchTableMultiSelectData(this.data);
			return;
		}

		const fields = this._getDataFields();

		// ── string[] — names known; fetch first batch from server ────────────
		if (Array.isArray(input)) {
			this._all_inputs = input;
			const names = input.slice(0, batchSize);
			if (!names.length) {
				this.data = [];
				this.docs = [];
				return;
			}
			let data = [];
			try {
				data = await frappe.db.get_list(this.doctype, {
					filters: [["name", "in", names]],
					fields,
					limit: names.length + 1,
				});
			} catch (e) {
				console.error("SVAVerticalDocRenderer: fetchDocs failed", e);
			}
			// Re-sort to match the caller-specified order
			const nameMap = {};
			data.forEach((d) => (nameMap[d.name] = d));
			this.data = names.map((name) => nameMap[name] || { name });
			this.docs = this.data.map((d) => d.name);
			await this._fetchTableMultiSelectData(this.data);
			return;
		}

		// ── null — paginated API (start=0, limit=batchSize) ──────────────────
		// this._all_inputs stays null to signal "unknown total; keep paginating
		// until server returns fewer records than batchSize".
		this._all_inputs = null;
		let data = [];
		try {
			data = await frappe.db.get_list(this.doctype, {
				filters: this.filters || [],
				fields,
				limit: batchSize,
				start: 0,
				...(this.order_by ? { order_by: this.order_by } : {}),
			});
		} catch (e) {
			console.error("SVAVerticalDocRenderer: fetchDocs failed", e);
		}
		this.data = data;
		this.docs = data.map((d) => d.name);
		await this._fetchTableMultiSelectData(this.data);
	},
};

export default DataMixin;
