const DataMixin = {
	/**
	 * Load DocType meta.
	 * If this._meta_override is set (caller passed a meta object), use it directly.
	 * Otherwise fetch via frappe.get_meta().
	 */
	async fetchMeta() {
		if (this._meta_override) {
			this.meta = this._meta_override;
			return;
		}
		this.meta = await frappe.db.get_meta(this.doctype);
	},

	/**
	 * Fetch all document data for the doc names listed in this.docs.
	 * Builds the field list from meta (all non-layout fieldnames).
	 * Results are stored in this.data, sorted to match this.docs order.
	 */
	async fetchDocs() {
		if (!this.docs || !this.docs.length) {
			this.data = [];
			return;
		}

		// Collect all data-bearing fieldnames from meta
		const LAYOUT_TYPES = new Set([
			"Section Break", "Column Break", "Tab Break",
			"HTML", "Button", "Fold", "Image",
		]);
		const fields = ["name"];
		(this.meta.fields || []).forEach((df) => {
			if (!LAYOUT_TYPES.has(df.fieldtype) && df.fieldname) {
				fields.push(df.fieldname);
			}
		});

		let data = [];
		try {
			data = await frappe.db.get_list(this.doctype, {
				filters: [["name", "in", this.docs]],
				fields,
				limit: this.docs.length + 1,
			});
		} catch (e) {
			console.error("SVAVerticalDocRenderer: fetchDocs failed", e);
		}

		this.data = this.sortDataByDocs(data);
	},
};

export default DataMixin;
