const UISetupMixin = {
	/**
	 * Build the root container inside this.wrapper.
	 * Creates:
	 *   this.container  — outer div (relative, overflow-hidden)
	 *   this.scrollBox  — horizontally scrollable inner div
	 */
	setupWrapper() {
		this.wrapper.innerHTML = "";
		this.wrapper.style.position = "relative";

		const container = document.createElement("div");
		container.className = "sva-vdr-container";
		container.style.cssText = `
			width: 100%;
			overflow: hidden;
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
		scrollBox.style.cssText = `
			width: 100%;
			overflow-x: auto;
		`;
		this.scrollBox = scrollBox;
		container.appendChild(scrollBox);

		this.wrapper.appendChild(container);
	},

	/**
	 * Show a lightweight skeleton / loading overlay inside the scroll box.
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
		sk.textContent = __("Loading…");
		this.scrollBox.appendChild(sk);
	},

	/**
	 * Remove the loading skeleton.
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
};

export default UISetupMixin;
