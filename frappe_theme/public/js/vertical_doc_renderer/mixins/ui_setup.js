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
		container.appendChild(scrollBox);

		this.wrapper.appendChild(container);
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
