frappe.provide("frappe.background_file");

frappe.background_file = {
	/**
	 * Run any function in the background with notifications.
	 * If a file already exists for the given ref, prompts user to download or regenerate.
	 *
	 * @param {Object} opts
	 * @param {string} opts.fn - Dotted path to Python function
	 * @param {Array} [opts.fn_args=[]] - Positional arguments for the function
	 * @param {Object} [opts.fn_kwargs={}] - Keyword arguments for the function
	 * @param {string} [opts.title="Processing"] - Title for notifications
	 * @param {string} [opts.ref_doctype] - Reference DocType for file attachment & notification
	 * @param {string} [opts.ref_docname] - Reference document name for file attachment & notification
	 */
	run(opts) {
		const title = opts.title || "Processing";
		const ref_doctype = opts.ref_doctype || null;
		const ref_docname = opts.ref_docname || null;

		if (ref_doctype && ref_docname && title) {
			// Check if file already exists
			frappe.call({
				method: "frappe_theme.apis.file_manager.check_existing_file",
				args: { ref_doctype, ref_docname, title },
				callback: (r) => {
					if (r.message) {
						this._show_existing_file_dialog(opts, r.message);
					} else {
						this._enqueue(opts);
					}
				},
			});
		} else {
			this._enqueue(opts);
		}
	},

	_show_existing_file_dialog(opts, existing_file) {
		const title = opts.title || "Processing";
		const ref_doctype = opts.ref_doctype;
		const ref_docname = opts.ref_docname;
		const created_on = frappe.datetime.global_date_format(existing_file.modified);

		const dialog = new frappe.ui.Dialog({
			title: __("{0} Already Exists", [title]),
			indicator: "blue",
			fields: [
				{
					fieldtype: "HTML",
					options: `
						<div class="text-medium" style="line-height: 1.6;">
							<p>${__("A <b>{0}</b> was already generated for <b>{1}: {2}</b> on <b>{3}</b>.", [
								title,
								__(ref_doctype),
								ref_docname,
								created_on,
							])}</p>
							<p>${__("Would you like to download the existing file or generate a new one?")}</p>
						</div>
					`,
				},
			],
			primary_action_label: __("Download Existing"),
			primary_action: () => {
				dialog.hide();
				window.open(existing_file.file_url);
			},
			secondary_action_label: __("Generate New"),
			secondary_action: () => {
				dialog.hide();
				this._enqueue(opts);
			},
		});

		dialog.show();
	},

	_enqueue(opts) {
		const title = opts.title || "Processing";
		frappe.call({
			method: "frappe_theme.apis.file_manager.generate",
			args: {
				method_path: opts.fn,
				fn_args: opts.fn_args || [],
				fn_kwargs: opts.fn_kwargs || {},
				title: title,
				ref_doctype: opts.ref_doctype || null,
				ref_docname: opts.ref_docname || null,
			},
			callback: () => {
				frappe.show_alert(
					{
						message: __(
							"{0} is being processed in the background. Check notifications for the download link.",
							[title]
						),
						indicator: "blue",
					},
					7
				);
			},
		});
	},
};
