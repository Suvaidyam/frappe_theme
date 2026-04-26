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

		if (this.title) {
			const titleEl = document.createElement("div");
			titleEl.className = "sva-vdr-title";
			titleEl.textContent = this.title;
			titleEl.style.cssText = `
				font-weight: 600;
				font-size: 15px;
				margin-bottom: 8px;
				text-align: center;
				color: var(--text-color, #333);
			`;
			container.appendChild(titleEl);
		}

		// Toolbar (gear settings button only) — only when vdr_field_name is set
		const toolbar = this._buildToolbar();
		if (toolbar) container.appendChild(toolbar);

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
	 * Left side: "+" create button (when allow_create is true).
	 * Right side: gear settings button (when vdr_field_name is set).
	 * Returns null when neither button is needed (pure read-only standalone usage).
	 *
	 * @returns {HTMLElement|null}
	 */
	_buildToolbar() {
		// Toolbar only contains the settings gear button.
		// The "+" create button is an overlay on _scrollWrapper (see setupWrapper).
		if (!this.vdr_field_name) return null;

		const toolbar = document.createElement("div");
		toolbar.className = "sva-vdr-toolbar";
		toolbar.style.cssText = `
			display: flex;
			justify-content: flex-end;
			align-items: center;
			margin-bottom: 4px;
		`;

		if (typeof this._buildSettingsButton === "function") {
			toolbar.appendChild(this._buildSettingsButton());
		}

		return toolbar;
	},

	/**
	 * Show a lightweight loading indicator inside the scroll box.
	 */
	showLoading() {
		if (this.scrollBox.querySelector(".sva-vdr-skeleton")) return;
		const sk = document.createElement("div");
		sk.className = "sva-vdr-skeleton";
		sk.style.cssText = `
			padding: 16px;
			color: var(--text-muted, #888);
			font-size: 13px;
			text-align: center;
		`;
		sk.textContent = __("Loading\u2026");
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
		`;
		document.head.appendChild(style);
	},
};

export default UISetupMixin;
