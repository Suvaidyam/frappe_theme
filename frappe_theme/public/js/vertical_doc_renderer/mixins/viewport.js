/**
 * ViewportMixin — lazy column loading via IntersectionObserver
 *
 * After the first batch of columns is rendered by render(), this mixin
 * places an invisible sentinel <th> at the far-right edge of the header row.
 * When the sentinel scrolls into view, the next batch of columns is fetched
 * and appended — no more than `column_batch_size` records per API call.
 *
 * Works with all three docs shapes:
 *   object[]  → slices from in-memory _all_inputs (zero API calls)
 *   string[]  → frappe.db.get_list filtered by the next slice of names
 *   null      → frappe.db.get_list with start offset (strict server-side pagination)
 *
 * After each batch is appended:
 *   - resolveLinkTitles() is called to batch-fetch titles for newly added cells.
 *   - _appendDeleteCell() is called for each new doc (if delete is enabled).
 */
const ViewportMixin = {
	/**
	 * Called once after the initial render() completes.
	 * Auto-calculates batch_size from viewport width if column_batch_size = 0.
	 * Places the first IntersectionObserver sentinel.
	 */
	setupViewportLoader() {
		// Auto-calculate batch size when caller did not specify one
		if (!this.column_batch_size) {
			const viewportWidth = this.scrollBox.clientWidth || 600;
			const colWidth = this.column_width || 150;
			this.column_batch_size = Math.max(3, Math.floor(viewportWidth / colWidth));
		}

		this._rendered_count = this.data.length; // already rendered by render()
		this._sentinel = null;
		this._observer = null;
		this._loading_batch = false;

		this._placeSentinel();
	},

	/**
	 * Total number of columns that will ever be shown.
	 * Returns Infinity when docs:null (server decides when to stop).
	 */
	_total_col_count() {
		if (this._all_inputs === null) return Infinity;
		return this._all_inputs.length;
	},

	/**
	 * Place an invisible sentinel <th> at the far-right of the header row.
	 * When it enters the viewport, _loadNextBatch() fires.
	 * If all columns are already rendered, no sentinel is placed.
	 */
	_placeSentinel() {
		// Clean up any previous sentinel + observer
		if (this._sentinel) {
			this._sentinel.remove();
			this._sentinel = null;
		}
		if (this._observer) {
			this._observer.disconnect();
			this._observer = null;
		}

		// All columns have been rendered — nothing left to load
		if (this._rendered_count >= this._total_col_count()) return;

		const sentinel = document.createElement("th");
		sentinel.className = "sva-vdr-sentinel";
		sentinel.style.cssText =
			"width:1px;min-width:1px;padding:0;border:none;background:transparent;";
		this._theadRow.appendChild(sentinel);
		this._sentinel = sentinel;

		this._observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !this._loading_batch) {
					this._loadNextBatch();
				}
			},
			{ root: this.scrollBox, threshold: 0.01 }
		);
		this._observer.observe(sentinel);
	},

	/**
	 * Fetch and render the next batch of columns.
	 * After appending, calls resolveLinkTitles() and _appendDeleteCell()
	 * for each new doc.
	 */
	async _loadNextBatch() {
		this._loading_batch = true;
		this._observer?.disconnect();

		const from = this._rendered_count;
		const batchSize = this.column_batch_size || 10;

		let batchData;
		try {
			batchData = await this._fetchBatchData(from, from + batchSize);
		} catch (e) {
			console.error("SVAVerticalDocRenderer: _loadNextBatch failed", e);
			this._loading_batch = false;
			return;
		}

		if (!batchData || !batchData.length) {
			// Server returned nothing — all records exhausted
			this._loading_batch = false;
			return;
		}

		batchData.forEach((doc, i) => {
			const absIndex = from + i;
			this._appendDocColumn(doc, absIndex);

			// Append delete cell for new column (guard: method may not exist)
			if (this._appendDeleteCell) {
				this._appendDeleteCell(doc);
			}
		});
		this._rendered_count += batchData.length;

		// Batch-fetch link titles for newly added columns (non-blocking)
		if (typeof this.resolveLinkTitles === "function") {
			this.resolveLinkTitles();
		}

		this._loading_batch = false;
		this._placeSentinel(); // watch for the batch after this one
	},

	/**
	 * Fetch data for one batch of columns.
	 *
	 * object[]  → slice from in-memory _all_inputs (no API call)
	 * string[]  → frappe.db.get_list filtered by names[from..to]
	 * null      → frappe.db.get_list with start offset (paginated)
	 *
	 * @param {number} from — first column index (inclusive, 0-based absolute)
	 * @param {number} to   — last column index  (exclusive)
	 * @returns {Promise<object[]>}
	 */
	async _fetchBatchData(from, to) {
		const input = this._all_inputs;
		const batchSize = to - from;
		const fields = this._getDataFields();

		// object[] — data already in memory; no API call
		if (
			input !== null &&
			Array.isArray(input) &&
			input.length > 0 &&
			typeof input[0] === "object"
		) {
			return input.slice(from, to);
		}

		// string[] — fetch the next slice of doc names from the server
		if (input !== null && Array.isArray(input)) {
			const names = input.slice(from, to);
			if (!names.length) return [];
			let data = [];
			try {
				data = await frappe.db.get_list(this.doctype, {
					filters: [["name", "in", names]],
					fields,
					limit: names.length + 1,
				});
			} catch (e) {
				console.error("SVAVerticalDocRenderer: _fetchBatchData failed", e);
				return [];
			}
			// Re-sort to match the caller-specified order
			const nameMap = {};
			data.forEach((d) => (nameMap[d.name] = d));
			return names.map((name) => nameMap[name] || { name });
		}

		// null — paginate by server-side offset
		try {
			return await frappe.db.get_list(this.doctype, {
				filters: this.filters || [],
				fields,
				limit: batchSize,
				start: from,
				...(this.order_by ? { order_by: this.order_by } : {}),
			});
		} catch (e) {
			console.error("SVAVerticalDocRenderer: _fetchBatchData failed", e);
			return [];
		}
	},

	/**
	 * Append one document's column to the already-rendered table.
	 * Called for each doc in a lazy-loaded batch.
	 *
	 * Steps:
	 *   1. Insert <th> before the sentinel in the header row
	 *   2. Append <td> to each tr.sva-vdr-field-row
	 *   3. Increment colSpan on every tr.sva-vdr-section-row td
	 *   4. Sync this.data / this.docs (needed by edit operations)
	 *
	 * @param {object} doc      — document data object
	 * @param {number} absIndex — absolute 0-based column index across all batches
	 */
	_appendDocColumn(doc, absIndex) {
		const conf = (this.column_configs || [])[absIndex] || {};

		// 1. Header cell — insert before _createTh ("+") or sentinel, whichever comes first.
		//    Order in thead: [...doc cols] [+create?] [sentinel?]
		const th = this._buildDocHeaderCell(doc, absIndex, conf);
		const headerInsertBefore = this._createTh || this._sentinel;
		if (headerInsertBefore) {
			this._theadRow.insertBefore(th, headerInsertBefore);
		} else {
			this._theadRow.appendChild(th);
		}

		// 2. Value cell in each field data row
		const fieldRows = this._table.querySelectorAll("tr.sva-vdr-field-row");
		fieldRows.forEach((tr) => {
			const fieldname = tr.dataset.fieldname;
			const df = (this.meta.fields || []).find((f) => f.fieldname === fieldname);
			if (!df) return;
			tr.appendChild(this._buildValueCell(df, doc, absIndex));
		});

		// 3. Extend colspan on every section header row by 1
		this._table.querySelectorAll("tr.sva-vdr-section-row td").forEach((td) => {
			td.colSpan = (td.colSpan || 1) + 1;
		});

		// 4. Keep this.data and this.docs in sync for inline editing
		if (!this.data.find((d) => d.name === doc.name)) {
			this.data.push(doc);
		}
		if (!this.docs.includes(doc.name)) {
			this.docs.push(doc.name);
		}
	},
};

export default ViewportMixin;
