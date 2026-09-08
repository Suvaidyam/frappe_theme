const BatchGroupMixin = {
	/**
	 * Returns true when the VDR should render each batch_no as a separate
	 * collapsible table (stacked vertically) instead of one flat column set.
	 *
	 * Activated when add_more_config has both allow_add_more_table and grouping_field.
	 */
	_isBatchGrouped() {
		return !!(
			this.add_more_config &&
			(this.add_more_config.allow_add_more_table ||
				this.add_more_config.enable_batch_config) &&
			this.add_more_config.grouping_field
		);
	},

	/**
	 * Fetch every matching record, group by grouping_field, and call
	 * _addBatchSection() for each group in ascending order.
	 */
	async _renderBatchGroups() {
		const groupField = this.add_more_config.grouping_field;
		const fields = this._getDataFields();

		// Always include batch_row_filter_field so _addBatchSection() can read the
		// per-batch crop/filter value even if the field is excluded from visible rows.
		const batchFilterField = this.add_more_config.batch_row_filter_field;
		if (batchFilterField && !fields.includes(batchFilterField)) {
			fields.push(batchFilterField);
		}

		let allDocs = [];
		try {
			allDocs = await frappe.db.get_list(this.doctype, {
				filters: this.filters || [],
				fields,
				limit: 0,
				order_by: `${groupField} asc${this.order_by ? `, ${this.order_by}` : ""}`,
			});
		} catch (e) {
			console.error("[VDR BatchGroup] Failed to fetch all docs", e);
		}

		// Group docs by batch value, preserving server order within each group
		const groups = new Map();
		allDocs.forEach((doc) => {
			const key = doc[groupField] ?? 0;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(doc);
		});

		if (!this._batchInstances) this._batchInstances = {};

		const sortedKeys = [...groups.keys()].sort((a, b) => Number(a) - Number(b));
		for (const key of sortedKeys) {
			// Apply column_order_rules at parent level so sub-VDR receives pre-sorted docs
			let batchDocs = groups.get(key);
			if (this.column_order_rules && this.column_order_rules.length) {
				const labelField = this.column_label_field;
				batchDocs = [...batchDocs].sort((a, b) => {
					const la = (labelField && a[labelField]) || a.name || "";
					const lb = (labelField && b[labelField]) || b.name || "";
					const ra = this._matchOrderRule(la);
					const rb = this._matchOrderRule(lb);
					const orderDiff =
						(ra ? ra.order ?? Infinity : Infinity) -
						(rb ? rb.order ?? Infinity : Infinity);
					if (orderDiff !== 0) return orderDiff;
					// Secondary: natural sort on label so NF-T1R1 < NF-T1R2 < NF-T2R1
					return la.localeCompare(lb, undefined, { numeric: true, sensitivity: "base" });
				});
			}
			const subVDR = this._addBatchSection(key, batchDocs, false);
			// Wait for sub-VDR to finish initialising (meta + render) before next
			if (subVDR && subVDR._ready) await subVDR._ready;
		}
		// After all sections are rendered, sync delete button and Add More position
		this._syncLastBatchDelBtn();
		this._syncAddMoreBtnPosition();
	},

	/**
	 * Create one collapsible batch section and a sub-VDR inside it.
	 *
	 * @param {number|string} batchNo — grouping field value (e.g. 1, 2, 3)
	 * @param {object[]}      docs    — inline document objects for this batch
	 * @param {boolean}       collapsed — start collapsed?
	 * @returns {SVAVerticalDocRenderer} sub-VDR instance
	 */
	_addBatchSection(batchNo, docs, collapsed = false) {
		const rawPrefix =
			(this.add_more_config && this.add_more_config.batch_title_prefix) || "Batch";
		// Replace {fieldname} placeholders with values from the first doc in this batch.
		// e.g. "Seed Treatment - {crop_name}" → "Seed Treatment - Paddy"
		const firstDoc = docs && docs.length ? docs[0] : null;

		// Extract batch_row_filter_field value — passed to sub-VDR so filterRow hook
		// can vary visible rows per batch (e.g. show Paddy params for batch 2, Ash Gourd for batch 1).
		const batchRowFilterField =
			this.add_more_config && this.add_more_config.batch_row_filter_field;
		const batchFilterValue =
			batchRowFilterField && firstDoc ? firstDoc[batchRowFilterField] ?? null : null;
		const prefix = rawPrefix.replace(/\{(\w+)\}/g, (_, fn) =>
			firstDoc && firstDoc[fn] != null ? String(firstDoc[fn]) : `{${fn}}`
		);
		const label = `${__(prefix)} ${batchNo}`;

		// ── Section wrapper ──────────────────────────────────────────────────
		const section = document.createElement("div");
		section.className = "sva-vdr-batch-section";
		section.dataset.batch = String(batchNo);
		section.style.marginBottom = "6px";

		// ── Collapsible header ───────────────────────────────────────────────
		const header = document.createElement("div");
		header.className = "sva-vdr-batch-header";
		header.style.cssText = `
			background: var(--sva-vdr-section-bg, #1a3a5c);
			color: var(--sva-vdr-section-text, #fff);
			font-weight: 600;
			padding: 7px 14px;
			cursor: pointer;
			user-select: none;
			font-size: 13px;
			border-radius: 4px 4px 0 0;
			display: flex;
			align-items: center;
			gap: 6px;
		`;

		const arrow = document.createElement("span");
		arrow.style.cssText = "font-size:10px;display:inline-block;";
		arrow.textContent = collapsed ? "▶" : "▼";
		header.appendChild(arrow);
		header.appendChild(document.createTextNode(label));

		// ── Delete button (right-aligned, shown when allow_delete_batch) ─────
		// Button is created for every eligible batch but visibility is controlled
		// by _syncLastBatchDelBtn() — only the last batch (highest number) shows it.
		// Batch 1 never gets a delete button (single-batch safety guard).
		const canDeleteBatch =
			this.add_more_config &&
			this.add_more_config.allow_delete_batch &&
			frappe.model.can_delete(this.doctype);

		if (canDeleteBatch) {
			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.className = "sva-vdr-del-batch-btn";
			delBtn.title = __("Delete this batch");
			delBtn.style.cssText = `
				display: none;
				margin-left: auto;
				background: transparent;
				border: 1px solid rgba(255,255,255,0.5);
				border-radius: 3px;
				color: inherit;
				cursor: pointer;
				font-size: 12px;
				padding: 2px 7px;
				line-height: 1.4;
				opacity: 0.85;
			`;
			const delLabel = (
				this.add_more_config.delete_batch_button_label || "Delete Batch"
			).trim();
			delBtn.textContent = "🗑 " + __(delLabel);
			delBtn.addEventListener("click", (e) => {
				e.stopPropagation(); // don't toggle collapse
				this._deleteBatchSection(batchNo, section);
			});
			header.appendChild(delBtn);
		}

		// Mark section with batchNo for _syncLastBatchDelBtn() to query
		section.dataset.batchNo = String(batchNo);

		// ── Content area (holds sub-VDR) ─────────────────────────────────────
		const content = document.createElement("div");
		content.className = "sva-vdr-batch-content";
		if (collapsed) content.style.display = "none";

		header.addEventListener("click", () => {
			const nowHidden = content.style.display === "none";
			content.style.display = nowHidden ? "" : "none";
			arrow.textContent = nowHidden ? "▼" : "▶";
		});

		section.appendChild(header);
		section.appendChild(content);

		// Append directly to the main container (after the empty scrollWrapper)
		this.container.appendChild(section);

		// ── Sub-VDR instance ─────────────────────────────────────────────────
		const VDRClass = frappe.ui && frappe.ui.SVAVerticalDocRenderer;
		if (!VDRClass) {
			console.error("[VDR BatchGroup] frappe.ui.SVAVerticalDocRenderer not found");
			return null;
		}

		const subVDR = new VDRClass({
			wrapper: content,
			frm: this.frm,
			// Pass full meta object so sub-VDR skips the meta API call
			doctype: this.meta,
			docs, // object[] — zero extra API calls
			column_configs: this.column_configs || [],
			column_label_field: this.column_label_field || null,
			column_default_bg: this.column_default_bg || null,
			column_default_text: this.column_default_text || null,
			column_color_rules: this.column_color_rules || [],
			column_order_rules: this.column_order_rules || [],
			fields_to_show: this.fields_to_show || null,
			fields_to_hide: this.fields_to_hide || [],
			fields_config: this.fields_config || null,
			show_section_headers: this.show_section_headers,
			section_configs: this.section_configs || {},
			show_unit: this.show_unit,
			hide_empty_rows: this.hide_empty_rows,
			crud_permissions: (this.crud_permissions || ["read"]).filter((p) => p !== "create"),
			link_title_fields: this.link_title_fields || {},
			column_width: this.column_width || 150,
			label_width: this.label_width || 160,
			max_height: 0, // each batch table expands naturally; no inner scroll cap
			table_max_rows: this.table_max_rows || null,
			signal: this.signal || null,
			child_add_row_labels: this.child_add_row_labels || null,
			// No add_more_config, no vdr_field_name → no nested "Add More" / settings / reload
			_is_sub_vdr: true,
			_parent_vdr: this,
			_batch_no: batchNo,
			_batch_filter_value: batchFilterValue,
		});

		this._batchInstances[batchNo] = subVDR;
		return subVDR;
	},

	/**
	 * Confirm + delete all records for a given batch, then remove the section from DOM.
	 *
	 * @param {number|string} batchNo  — value of the grouping field for this batch
	 * @param {HTMLElement}   section  — the .sva-vdr-batch-section element to remove
	 */
	_deleteBatchSection(batchNo, section) {
		const rawPrefix =
			(this.add_more_config && this.add_more_config.batch_title_prefix) || "Batch";
		// Interpolate {fieldname} using data from the sub-VDR for this batch
		const subVDR = this._batchInstances && this._batchInstances[batchNo];
		const firstDoc = subVDR && subVDR.data && subVDR.data.length ? subVDR.data[0] : null;
		const prefix = rawPrefix.replace(/\{(\w+)\}/g, (_, fn) =>
			firstDoc && firstDoc[fn] != null ? String(firstDoc[fn]) : `{${fn}}`
		);
		const label = `${__(prefix)} ${batchNo}`;

		frappe.confirm(
			__("Are you sure you want to delete all records in {0}? This cannot be undone.", [
				`<strong>${label}</strong>`,
			]),
			async () => {
				// Disable the delete button while deleting
				const delBtn = section.querySelector("button[title]");
				const originalHTML = delBtn ? delBtn.innerHTML : "";
				if (delBtn) {
					delBtn.disabled = true;
					delBtn.style.opacity = "0.5";
					delBtn.innerHTML = `⏳ ${__("Deleting…")}`;
				}

				try {
					const result = await frappe.xcall(
						"frappe_theme.apis.add_more_batch.delete_batch_records",
						{
							doctype: this.doctype,
							filters: JSON.stringify(this.filters || []),
							grouping_field: this.add_more_config.grouping_field,
							batch_value: batchNo,
						}
					);

					// Remove from DOM
					section.remove();

					// Clean up internal instance reference
					if (this._batchInstances) {
						delete this._batchInstances[batchNo];
					}

					// Move delete button and Add More button to the new last batch
					this._syncLastBatchDelBtn();
					this._syncAddMoreBtnPosition();

					frappe.show_alert({
						message: __("{0} record(s) deleted from {1}", [result.deleted, label]),
						indicator: "green",
					});
				} catch (err) {
					if (delBtn) {
						delBtn.disabled = false;
						delBtn.style.opacity = "";
						delBtn.innerHTML = originalHTML;
					}
					frappe.show_alert({
						message: __("Failed to delete batch: {0}", [err.message || String(err)]),
						indicator: "red",
					});
				}
			}
		);
	},
	/**
	 * Move the "Add More" wrapper div so it always appears directly after the last
	 * .sva-vdr-batch-section. Called after every render/add/delete operation.
	 */
	_syncAddMoreBtnPosition() {
		const wrapper = this._addMoreWrapper;
		if (!wrapper || !this.container) return;

		const sections = this.container.querySelectorAll(".sva-vdr-batch-section");
		if (!sections.length) {
			// No batch sections yet — keep at end of container
			this.container.appendChild(wrapper);
			return;
		}

		// Insert wrapper right after the last section
		const lastSection = sections[sections.length - 1];
		lastSection.insertAdjacentElement("afterend", wrapper);
	},

	/**
	 * Show the delete button ONLY on the last batch section (highest batchNo > 1).
	 * Hides the button on all other sections. Called after initial render and after
	 * each batch deletion so the button always tracks the current last batch.
	 */
	_syncLastBatchDelBtn() {
		if (!this.add_more_config || !this.add_more_config.allow_delete_batch) return;

		const sections = this.container.querySelectorAll(".sva-vdr-batch-section");
		if (!sections.length) return;

		// Find the section with the highest batchNo
		let lastSection = null;
		let lastNo = -Infinity;
		sections.forEach((sec) => {
			const no = Number(sec.dataset.batchNo ?? -Infinity);
			if (no > lastNo) {
				lastNo = no;
				lastSection = sec;
			}
		});

		// Hide all delete buttons; then reveal only the last batch's (if batchNo > 1)
		sections.forEach((sec) => {
			const btn = sec.querySelector(".sva-vdr-del-batch-btn");
			if (btn) btn.style.display = "none";
		});

		if (lastSection && lastNo > 1) {
			const btn = lastSection.querySelector(".sva-vdr-del-batch-btn");
			if (btn) btn.style.display = "";
		}
	},
};

export default BatchGroupMixin;
