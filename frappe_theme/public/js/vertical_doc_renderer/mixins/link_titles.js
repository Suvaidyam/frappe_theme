/**
 * LinkTitlesMixin — batch-fetch display titles for Link fields
 *
 * After the first render (and after each lazy-loaded viewport batch), this
 * mixin collects all unique Link field values grouped by linked DocType, then
 * issues ONE frappe.db.get_list per DocType — never one call per cell.
 *
 * Title discovery uses frappe.boot.link_title_doctypes, which Frappe populates
 * at boot time (e.g. { "Customer": "customer_name", "Item": "item_name" }).
 * If a DocType is not listed there, the raw "name" is used as display text.
 *
 * Results are cached in this._linkTitles so subsequent calls (from viewport
 * batches) only fetch newly-uncached values.
 *
 * Cell update:
 *   - cell.textContent  → resolved display title
 *   - cell.title attr   → raw document name (shown as tooltip)
 *   - cell.dataset.rawValue (set by rendering.js) is the lookup key
 */
const LinkTitlesMixin = {
	/**
	 * Batch-fetch and apply link titles for all currently loaded docs.
	 * Safe to call multiple times — subsequent calls only fetch new values.
	 */
	async resolveLinkTitles() {
		if (!this._table || !this.meta) return;

		if (!this._linkTitles) this._linkTitles = {};

		const linkFields = (this.meta.fields || []).filter(
			(df) => df.fieldtype === "Link" && df.options
		);
		if (!linkFields.length) return;

		const linkTitleMap = (frappe.boot && frappe.boot.link_title_doctypes) || {};
		const toFetch = {}; // { linkedDoctype: Set<rawName> } — only uncached

		linkFields.forEach((df) => {
			const ldt = df.options;
			if (!this._linkTitles[ldt]) this._linkTitles[ldt] = {};

			this.data.forEach((doc) => {
				const val = doc[df.fieldname];
				if (val && this._linkTitles[ldt][val] === undefined) {
					if (!toFetch[ldt]) toFetch[ldt] = new Set();
					toFetch[ldt].add(val);
				}
			});
		});

		if (!Object.keys(toFetch).length) {
			// Everything already cached — just repaint cells
			this._applyLinkTitles();
			return;
		}

		// One frappe.db.get_list per linked DocType
		await Promise.all(
			Object.entries(toFetch).map(async ([ldt, namesSet]) => {
				// Primary: frappe.boot.link_title_doctypes (set when show_title_field_in_link = 1)
				// Fallback: frappe.get_meta() in-memory cache (available if meta was loaded this session)
				let titleField = linkTitleMap[ldt];
				if (!titleField) {
					try {
						const cachedMeta = frappe.get_meta(ldt);
						if (cachedMeta && cachedMeta.title_field) {
							titleField = cachedMeta.title_field;
						}
					} catch (_) {
						// meta not cached — no title field known
					}
				}
				const fields = titleField ? ["name", titleField] : ["name"];
				const names = [...namesSet];

				try {
					const records = await frappe.db.get_list(ldt, {
						filters: [["name", "in", names]],
						fields,
						limit: names.length + 1,
					});

					records.forEach((r) => {
						this._linkTitles[ldt][r.name] =
							(titleField && r[titleField]) || r.name;
					});

					// Mark any names the server didn't return (deleted/permissioned out)
					names.forEach((n) => {
						if (this._linkTitles[ldt][n] === undefined) {
							this._linkTitles[ldt][n] = n; // fall back to raw name
						}
					});
				} catch (e) {
					console.error(
						"SVAVerticalDocRenderer: link title fetch failed for",
						ldt,
						e
					);
					// Fall back: use raw names so cells aren't left blank
					names.forEach((n) => {
						this._linkTitles[ldt][n] = n;
					});
				}
			})
		);

		this._applyLinkTitles();
	},

	/**
	 * Update every rendered Link-field cell with its resolved display title.
	 * Reads data-raw-value (stamped by rendering.js _buildValueCell) as the
	 * cache lookup key. Sets textContent to title and title attribute to raw name.
	 */
	_applyLinkTitles() {
		if (!this._table || !this._linkTitles) return;

		const linkFields = (this.meta.fields || []).filter(
			(df) => df.fieldtype === "Link" && df.options
		);

		linkFields.forEach((df) => {
			const ldt = df.options;
			const cache = this._linkTitles[ldt];
			if (!cache) return;

			this._table
				.querySelectorAll(
					`td.sva-vdr-value-cell[data-fieldname="${df.fieldname}"]`
				)
				.forEach((td) => {
					const rawName = td.dataset.rawValue;
					if (!rawName) return;
					const title = cache[rawName];
					if (title && title !== rawName) {
						td.setAttribute("title", rawName); // tooltip shows raw doc name
						td.textContent = title;
					}
				});
		});
	},
};

export default LinkTitlesMixin;
