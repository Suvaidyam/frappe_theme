/**
 * ValidationMixin — per-cell depends_on evaluation + error banner
 *
 * Evaluates Frappe field expressions (depends_on, mandatory_depends_on,
 * read_only_depends_on) independently for each document column, enabling
 * per-cell hidden/required/readonly states in the comparison table.
 *
 * Uses frappe.utils.custom_eval (same evaluator as SVADatatable) with a
 * fallback to direct eval for resilience.
 *
 * Also owns the sticky dismissible error banner shown above the table.
 */
const ValidationMixin = {
	/**
	 * Evaluate a Frappe depends_on expression against a document.
	 * Handles "eval:" prefix. Returns false on any error.
	 *
	 * @param {string} expr — e.g. "eval:doc.status=='Active'" or "status"
	 * @param {object} doc  — document data object
	 * @returns {boolean}
	 */
	_evaluateDepends(expr, doc) {
		if (!expr) return false;
		try {
			if (typeof frappe.utils.custom_eval === "function") {
				return !!frappe.utils.custom_eval(expr, doc);
			}
			// Fallback: strip "eval:" prefix and evaluate with doc bound
			const code = expr.replace(/^eval:/, "");
			// eslint-disable-next-line no-new-func
			const fn = new Function("doc", `try { return !!(${code}); } catch(e) { return false; }`);
			return fn(doc);
		} catch (_) {
			return false;
		}
	},

	/**
	 * Returns true when the field should be hidden for the given document.
	 * Hidden when: df.hidden is set, OR depends_on evaluates to false.
	 *
	 * @param {object} df  — field descriptor from meta
	 * @param {object} doc — document data object
	 * @returns {boolean}
	 */
	isFieldHidden(df, doc) {
		if (df.hidden) return true;
		if (df.depends_on) return !this._evaluateDepends(df.depends_on, doc);
		return false;
	},

	/**
	 * Returns true when the field should be read-only for the given document.
	 *
	 * @param {object} df  — field descriptor from meta
	 * @param {object} doc — document data object
	 * @returns {boolean}
	 */
	isFieldReadOnly(df, doc) {
		if (df.read_only) return true;
		if (df.read_only_depends_on) return this._evaluateDepends(df.read_only_depends_on, doc);
		return false;
	},

	/**
	 * Returns true when the field is required for the given document.
	 *
	 * @param {object} df  — field descriptor from meta
	 * @param {object} doc — document data object
	 * @returns {boolean}
	 */
	isFieldRequired(df, doc) {
		if (df.reqd) return true;
		if (df.mandatory_depends_on) return this._evaluateDepends(df.mandatory_depends_on, doc);
		return false;
	},

	/**
	 * Validate a value before saving.
	 * Returns an array of error message strings (empty = valid).
	 *
	 * @param {object} df       — field descriptor
	 * @param {object} doc      — document data object
	 * @param {*}      newValue — the value being saved
	 * @returns {string[]}
	 */
	validateBeforeSave(df, doc, newValue) {
		const errors = [];
		if (this.isFieldRequired(df, doc)) {
			const isEmpty =
				newValue === null ||
				newValue === undefined ||
				newValue === "" ||
				newValue === 0;
			if (isEmpty) {
				const label = __(df.label || df.fieldname);
				errors.push(__("'{0}' is required for {1}", [label, doc.name]));
			}
		}
		return errors;
	},

	/**
	 * Show a dismissible red error banner above the table.
	 * Replaces any existing banner. Does nothing when errors is empty.
	 *
	 * @param {string[]} errors — list of error messages
	 */
	showErrorBanner(errors) {
		this.clearErrorBanner();
		if (!errors || !errors.length) return;

		const banner = document.createElement("div");
		banner.className = "sva-vdr-error-banner";
		banner.style.cssText = `
			background: #fce8e8;
			border: 1px solid #f5c6cb;
			border-radius: 4px;
			padding: 8px 36px 8px 12px;
			margin-bottom: 6px;
			position: relative;
			color: #721c24;
			font-size: 12px;
			line-height: 1.6;
		`;

		const closeBtn = document.createElement("button");
		closeBtn.innerHTML = "&times;";
		closeBtn.title = __("Dismiss");
		closeBtn.style.cssText = `
			position: absolute;
			top: 4px;
			right: 8px;
			border: none;
			background: none;
			cursor: pointer;
			font-size: 18px;
			line-height: 1;
			color: inherit;
			padding: 0 4px;
		`;
		closeBtn.addEventListener("click", () => this.clearErrorBanner());
		banner.appendChild(closeBtn);

		errors.forEach((msg) => {
			const row = document.createElement("div");
			row.textContent = "\u26a0 " + msg;
			banner.appendChild(row);
		});

		this._errorBanner = banner;
		// Insert before the scroll box (below title if any)
		this.container.insertBefore(banner, this.scrollBox);
	},

	/**
	 * Remove the error banner from the DOM if it exists.
	 */
	clearErrorBanner() {
		if (this._errorBanner) {
			this._errorBanner.remove();
			this._errorBanner = null;
		}
	},
};

export default ValidationMixin;
