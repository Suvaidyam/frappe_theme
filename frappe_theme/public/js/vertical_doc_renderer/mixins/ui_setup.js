const UISetupMixin = {
	/**
	 * Build the root container inside this.wrapper.
	 * Creates:
	 *   this.container  — outer div (overflow:visible so sticky children work)
	 *   this.scrollBox  — both-axis scrollable inner div (scroll anchor for sticky)
	 *
	 * Vertical sticky (header row) requires the scrollBox to have overflow:auto
	 * and a bounded max-height; horizontal sticky (params column) requires
	 * overflow:auto on the X axis. Both are set here.
	 */
	setupWrapper() {
		this.wrapper.innerHTML = "";
		this.wrapper.style.position = "relative";

		// Inject shared CSS once per page load (spinner keyframes, etc.)
		this._ensureStyles();

		const container = document.createElement("div");
		container.className = "sva-vdr-container";
		container.style.cssText = `
			width: 100%;
			overflow: visible;
			font-size: 13px;
			margin-bottom: 24px;
		`;
		this.container = container;

		// Header row: title on the left, toolbar (settings/add-more) on the right
		const toolbar = this._buildToolbar();
		if (this.title || toolbar) {
			const headerRow = document.createElement("div");
			headerRow.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 6px;
			`;

			if (this.title) {
				const titleEl = document.createElement("div");
				titleEl.className = "sva-vdr-title";
				titleEl.textContent = this.title;
				titleEl.style.cssText = `
					font-weight: 600;
					font-size: 15px;
					color: var(--text-color, #333);
					flex: 1;
				`;
				headerRow.appendChild(titleEl);
			}

			if (toolbar) {
				// Remove the toolbar's own bottom margin — headerRow handles spacing
				toolbar.style.marginBottom = "0";
				headerRow.appendChild(toolbar);
			}

			container.appendChild(headerRow);
		}

		// scrollWrapper shrinks to the table's natural width but never exceeds
		// the container (max-width:100%). position:relative anchors the "+" overlay
		// so its right:0 stays exactly at the table's right edge.
		// When the table is wider than the container, scrollWrapper is capped at
		// 100% and scrollBox (width:100%) provides horizontal overflow scrolling.
		const scrollWrapper = document.createElement("div");
		scrollWrapper.style.cssText = `
			position: relative;
			width: 100%;
		`;
		this._scrollWrapper = scrollWrapper;

		const scrollBox = document.createElement("div");
		scrollBox.className = "sva-vdr-scroll-box";
		scrollBox.style.cssText = [
			"width: 100%;",
			"overflow: auto;",
			"-webkit-overflow-scrolling: touch;", // iOS momentum scroll
			this.max_height > 0 ? `max-height: ${this.max_height}px;` : "",
		]
			.filter(Boolean)
			.join(" ");
		this.scrollBox = scrollBox;
		scrollWrapper.appendChild(scrollBox);

		// "+" overlay button — top-right corner of the table border
		if (this.allow_create) {
			const createBtn = document.createElement("button");
			createBtn.className = "btn btn-primary btn-xs sva-vdr-create-btn";
			createBtn.title = __("Add new record");
			createBtn.style.cssText = `
				position: absolute;
				top: 0;
				right: 0;
				z-index: 20;
				font-size: 15px;
				font-weight: 700;
				line-height: 1;
				padding: 2px 8px 3px;
				border-radius: 0 0 0 4px;
				border-top: none;
				border-right: none;
			`;
			createBtn.textContent = "+";
			createBtn.addEventListener("click", () => {
				if (!createBtn.disabled) this.openCreateDialog();
			});
			this._createToolbarBtn = createBtn;
			scrollWrapper.appendChild(createBtn);
		}

		container.appendChild(scrollWrapper);

		this.wrapper.appendChild(container);
	},

	/**
	 * Build the toolbar row placed between the title and the scrollBox.
	 * Right side: reload button (always), gear settings (when vdr_field_name is set).
	 * Stores reference in this._toolbar so _renderAddMoreButton() can append to it.
	 *
	 * @returns {HTMLElement}
	 */
	_buildToolbar() {
		const hasSettings = !!this.vdr_field_name;
		const hasAddMore = !!(this.add_more_config && this.add_more_config.allow_add_more_table);
		const hasReload = !this._is_sub_vdr;

		if (!hasSettings && !hasAddMore && !hasReload) return null;

		const toolbar = document.createElement("div");
		toolbar.className = "sva-vdr-toolbar";
		toolbar.style.cssText = `
			display: flex;
			justify-content: flex-end;
			align-items: center;
			gap: 6px;
			margin-bottom: 4px;
		`;

		this._toolbar = toolbar; // stored so _renderAddMoreButton() can append to it

		if (hasSettings && typeof this._buildSettingsButton === "function") {
			toolbar.appendChild(this._buildSettingsButton());
		}

		if (hasReload) {
			const reloadBtn = document.createElement("button");
			reloadBtn.className = "btn btn-default btn-xs sva-vdr-reload-btn";
			reloadBtn.title = __("Reload");
			reloadBtn.style.cssText = `
				font-size: 14px;
				line-height: 1;
				padding: 3px 7px;
				display: flex;
				align-items: center;
			`;
			reloadBtn.innerHTML = `<span class="sva-vdr-reload-icon" style="display:inline-block;">↺</span>`;
			reloadBtn.addEventListener("click", () => {
				if (!reloadBtn.disabled) this.reloadTable();
			});
			this._reloadBtn = reloadBtn;
			toolbar.appendChild(reloadBtn);
		}

		return toolbar;
	},

	/**
	 * Append the "Add More" button to the toolbar (top-right) after the table renders.
	 * Called from _initialize() after render() so data is already visible.
	 * Idempotent — removes any stale button before appending a new one.
	 * No-op when add_more_config is absent or allow_add_more_table is false.
	 */
	_renderAddMoreButton() {
		// Normalise: accept both a pre-parsed object and a JSON string
		let cfg = this.add_more_config;
		if (typeof cfg === "string") {
			try {
				cfg = JSON.parse(cfg);
				this.add_more_config = cfg; // update in place so callers see the object
				console.log("[VDR] _renderAddMoreButton: parsed add_more_config from string", cfg);
			} catch (e) {
				console.warn(
					"[VDR] _renderAddMoreButton: failed to parse add_more_config string",
					e
				);
				cfg = null;
			}
		}
		console.log("[VDR] _renderAddMoreButton called — add_more_config:", cfg);
		if (!cfg || !cfg.allow_add_more_table) {
			console.log(
				"[VDR] _renderAddMoreButton: no-op (add_more_config missing or allow_add_more_table false)"
			);
			return;
		}

		// Remove stale button (safety for future reloadTable() callers that re-invoke this)
		if (this._addMoreBtnEl && this._addMoreBtnEl.parentNode) {
			this._addMoreBtnEl.parentNode.removeChild(this._addMoreBtnEl);
		}

		const label = cfg.add_more_button_label || "Add More";

		const btn = document.createElement("button");
		btn.className = "btn btn-default btn-sm sva-vdr-add-more-btn";
		btn.title = __("Create a new batch of records for each existing column");
		btn.style.cssText = "font-size:12px;display:flex;align-items:center;gap:4px;";
		btn.innerHTML = `<span style="font-size:14px;font-weight:700;line-height:1;">+</span> ${__(
			label
		)}`;

		btn.addEventListener("click", () => {
			if (typeof this._onAddMoreClick === "function") {
				this._onAddMoreClick(cfg);
			} else {
				console.warn("[VDR] _onAddMoreClick not implemented. Batch config:", cfg);
				frappe.show_alert({
					message: __(
						"Add More clicked. Implement _onAddMoreClick() to handle batch creation."
					),
					indicator: "blue",
				});
			}
		});

		this._addMoreBtnEl = btn;

		// Prefer toolbar (top-right) when available; fall back to a footer bar below table
		if (this._toolbar) {
			// Insert before the settings gear so Add More is left of gear: [+ Add More][⚙]
			this._toolbar.insertBefore(btn, this._toolbar.firstChild);
			console.log("[VDR] Add More button added to toolbar");
		} else if (this.container) {
			// No toolbar (no vdr_field_name) — create a minimal footer bar
			let footer = this.container.querySelector(".sva-vdr-add-more-footer");
			if (!footer) {
				footer = document.createElement("div");
				footer.className = "sva-vdr-add-more-footer";
				footer.style.cssText = "display:flex;justify-content:flex-end;margin-top:8px;";
				this.container.appendChild(footer);
			}
			footer.appendChild(btn);
			console.log("[VDR] Add More button added to footer (no toolbar available)");
		} else {
			console.warn("[VDR] _renderAddMoreButton: neither _toolbar nor container is ready");
		}
	},

	/**
	 * Show a skeleton loading table inside the scroll box.
	 */
	showLoading() {
		if (this.scrollBox.querySelector(".sva-vdr-skeleton")) return;

		// _docs_input holds the raw constructor arg (string[] | object[] | null);
		// this.docs is always [] at load time, so use _docs_input for accurate count.
		const inputDocs = this._docs_input;
		const colCount =
			Array.isArray(inputDocs) && inputDocs.length ? Math.min(inputDocs.length, 6) : 4;
		const ROW_COUNT = 7;

		// Bar widths per column to look natural (label col + doc cols)
		const labelWidths = ["75%", "90%", "60%", "85%", "70%", "80%", "65%"];
		const cellWidths = ["55%", "70%", "45%", "60%", "50%", "65%", "40%"];

		const sk = document.createElement("div");
		sk.className = "sva-vdr-skeleton";
		sk.style.cssText = `
			width: 100%;
			border-radius: 6px;
			overflow: hidden;
			border: 1px solid rgba(0,0,0,.06);
		`;

		const table = document.createElement("table");
		table.style.cssText = "width:100%;border-collapse:collapse;table-layout:fixed;";

		// \u2500\u2500 Header row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
		const thead = document.createElement("thead");
		const htr = document.createElement("tr");

		const mkTh = (widthPct) => {
			const th = document.createElement("th");
			th.style.cssText =
				"padding:10px 12px;background:#e9ecef;border:1px solid rgba(0,0,0,.06);";
			th.innerHTML = `<div class="sva-vdr-skel-bar" style="width:${widthPct};height:14px;border-radius:20px;"></div>`;
			return th;
		};

		htr.appendChild(mkTh("65%")); // label column header
		for (let c = 0; c < colCount; c++) {
			const th = mkTh("55%");
			th.querySelector(".sva-vdr-skel-bar").style.margin = "0 auto";
			htr.appendChild(th);
		}
		thead.appendChild(htr);
		table.appendChild(thead);

		// \u2500\u2500 Body rows \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
		const tbody = document.createElement("tbody");
		for (let r = 0; r < ROW_COUNT; r++) {
			const tr = document.createElement("tr");
			const bg = r % 2 === 0 ? "#f8f9fa" : "#fff";

			const mkTd = (widthPct, centered = false) => {
				const td = document.createElement("td");
				td.style.cssText = `padding:9px 12px;background:${bg};border:1px solid rgba(0,0,0,.06);`;
				const bar = document.createElement("div");
				bar.className = "sva-vdr-skel-bar";
				bar.style.cssText = `width:${widthPct};height:12px;border-radius:20px;${
					centered ? "margin:0 auto;" : ""
				}`;
				td.appendChild(bar);
				return td;
			};

			tr.appendChild(mkTd(labelWidths[r % labelWidths.length]));
			for (let c = 0; c < colCount; c++) {
				tr.appendChild(mkTd(cellWidths[(r + c) % cellWidths.length], true));
			}
			tbody.appendChild(tr);
		}
		table.appendChild(tbody);
		sk.appendChild(table);
		this.scrollBox.appendChild(sk);
	},

	/**
	 * Remove the loading indicator.
	 */
	hideLoading() {
		const sk = this.scrollBox.querySelector(".sva-vdr-skeleton");
		if (sk) sk.remove();
	},

	/**
	 * Wire up AbortSignal: clear wrapper content when signal fires.
	 */
	setupAbortHandler() {
		if (!this.signal) return;
		this.signal.addEventListener("abort", () => {
			this.wrapper.innerHTML = "";
		});
	},

	/**
	 * Inject a <style id="sva-vdr-styles"> tag into document.head with CSS
	 * that cannot be expressed inline (keyframe animations, class selectors).
	 * Idempotent — no-op if the tag already exists.
	 */
	_ensureStyles() {
		if (document.getElementById("sva-vdr-styles")) return;
		const style = document.createElement("style");
		style.id = "sva-vdr-styles";
		style.textContent = `
			@keyframes sva-vdr-spin {
				to { transform: rotate(360deg); }
			}
			.sva-vdr-spinner {
				display: inline-block;
				animation: sva-vdr-spin 0.8s linear infinite;
				margin-left: 4px;
			}
			@keyframes sva-vdr-shimmer {
				0%   { background-position: -400px 0; }
				100% { background-position:  400px 0; }
			}
			.sva-vdr-skel-bar {
				background: linear-gradient(90deg, #e0e0e0 25%, #ececec 50%, #e0e0e0 75%);
				background-size: 800px 100%;
				animation: sva-vdr-shimmer 1.4s ease-in-out infinite;
			}
		`;
		document.head.appendChild(style);
	},
};

export default UISetupMixin;
