const AddMoreMixin = {
	/**
	 * Handle the "Add More" button click.
	 *
	 * Calls the backend to:
	 *   1. Find the latest batch (max grouping_field value) for this parent
	 *   2. Duplicate every record in that batch with grouping_field = max + 1
	 *
	 * After success the table is reloaded so the new batch appears immediately.
	 *
	 * Config keys used from add_more_config:
	 *   add_more_doctype  — child DocType to duplicate (defaults to this.doctype)
	 *   grouping_field    — field that identifies batches (e.g. "batch_no") [required]
	 *   plot_link_field   — field that links to the item/plot (passed to backend for reference)
	 *
	 * @param {object} cfg — add_more_config object from the constructor
	 */
	async _onAddMoreClick(cfg) {
		const doctype = cfg.add_more_doctype || this.doctype;
		const groupingField = cfg.grouping_field;
		const linkField = cfg.plot_link_field || null;

		if (!groupingField) {
			frappe.show_alert({
				message: __("Add More: grouping_field is not configured"),
				indicator: "red",
			});
			return;
		}

		// ── Disable button + show spinner ────────────────────────────────────
		const btn = this._addMoreBtnEl;
		const originalHTML = btn ? btn.innerHTML : "";
		if (btn) {
			btn.disabled = true;
			btn.style.opacity = "0.6";
			btn.innerHTML = `<span class="sva-vdr-spinner">⏳</span> ${__("Creating…")}`;
		}

		try {
			const result = await frappe.xcall("frappe_theme.apis.add_more_batch.add_more_batch", {
				doctype,
				filters: JSON.stringify(this.filters || []),
				grouping_field: groupingField,
				link_field: linkField,
			});

			if (!result || result.created === 0) {
				frappe.show_alert({
					message: __("No records found to duplicate"),
					indicator: "orange",
				});
				return;
			}

			// ── Fetch full data for the newly created records ─────────────────
			const fields = this._getDataFields ? this._getDataFields() : ["name"];
			let newDocs = [];
			try {
				const fetched = await frappe.db.get_list(doctype, {
					filters: [["name", "in", result.names]],
					fields,
					limit: result.names.length + 1,
				});
				const nameMap = {};
				fetched.forEach((d) => (nameMap[d.name] = d));
				newDocs = result.names.map((n) => nameMap[n] || { name: n });
			} catch (fetchErr) {
				console.error("[VDR AddMore] failed to fetch new docs", fetchErr);
				newDocs = result.names.map((n) => ({ name: n }));
			}

			// ── Batched mode: add a new collapsible table section ─────────────
			if (this._isBatchGrouped && this._isBatchGrouped()) {
				const collapsed = !!(
					this.add_more_config && this.add_more_config.default_collapsed_new_table
				);
				const subVDR = this._addBatchSection(result.next_batch, newDocs, collapsed);
				if (subVDR && subVDR._ready) await subVDR._ready;

				// Scroll new section into view
				const newSection = this.container.querySelector(
					`.sva-vdr-batch-section[data-batch="${result.next_batch}"]`
				);
				if (newSection) {
					newSection.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			} else {
				// ── Standard mode: append columns to the flat table ───────────
				newDocs.forEach((doc) => {
					const absIndex = this.data.length;
					this._appendDocColumn(doc, absIndex);
				});

				this._rendered_count = this.data.length;

				if (Array.isArray(this._docs_input)) {
					this._docs_input = [...this._docs_input, ...result.names];
					this._all_inputs = this._docs_input;
				}

				if (typeof this._placeSentinel === "function") {
					this._placeSentinel();
				}

				if (typeof this.resolveLinkTitles === "function") {
					this.resolveLinkTitles();
				}
			}

			frappe.show_alert({
				message: __("{0} records created for Batch {1}", [
					result.created,
					result.next_batch,
				]),
				indicator: "green",
			});
		} catch (err) {
			frappe.show_alert({
				message: __("Failed to create batch: {0}", [err.message || String(err)]),
				indicator: "red",
			});
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.style.opacity = "";
				btn.innerHTML = originalHTML;
			}
		}
	},
};

export default AddMoreMixin;
