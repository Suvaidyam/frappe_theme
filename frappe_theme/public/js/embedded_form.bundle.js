/**
 * frappe_theme.embedded_form
 *
 * Renders a complete linked DocType form inline inside an HTML field of the
 * parent DocType — callable from any Frappe Client Script without a SvaDataTable.
 *
 * Usage:
 *   frappe.ui.form.on("Test New", {
 *       async refresh(frm) {
 *           if (frm.doc.employee) {
 *               await frappe_theme.embedded_form.render({
 *                   parent_frm: frm,
 *                   target_doctype: "Employee",
 *                   target_docname: frm.doc.employee,
 *                   html_field: "test",
 *               });
 *           }
 *       },
 *       async employee(frm) {
 *           await frappe_theme.embedded_form.render({
 *               parent_frm: frm,
 *               target_doctype: "Employee",
 *               target_docname: frm.doc.employee,
 *               html_field: "test",
 *           });
 *       },
 *   });
 *
 * After render, references are stored on parent_frm keyed by DocType:
 *   frm.sva_dt_frm["Employee"]       → full frm-compatible object (use for Client Scripts)
 *   frm.embedded_form["Employee"]     → dialog-compatible proxy (same as dt.form_dialog)
 *   frm.embedded_frm["Employee"]      → alias to sva_dt_frm["Employee"]
 *   frm.embedded_controls["Employee"] → fg.fields_dict (direct field access)
 *
 * dt_events work identically to FormDialogMixin — same hook names, same signatures.
 */

import EmbeddedFormMixin from "./datatable/mixins/embedded_form.js";

frappe.provide("frappe_theme.embedded_form");

/**
 * Main public API. All options are required except `mode` (defaults to "write").
 *
 * @param {Object}      options
 * @param {Object}      options.parent_frm      - The Frappe form object (frm)
 * @param {string}      options.target_doctype  - DocType to render inline
 * @param {string|null} options.target_docname  - Document name (null for create mode)
 * @param {string}      options.html_field      - Fieldname of the HTML field to render into
 * @param {string}      [options.mode="write"]  - "create" | "write" | "view"
 */
frappe_theme.embedded_form.render = async function ({
	parent_frm,
	target_doctype,
	target_docname,
	html_field,
	mode = "write",
} = {}) {
	if (!parent_frm || !target_doctype || !html_field) {
		console.warn("[embedded_form] parent_frm, target_doctype, and html_field are required");
		return;
	}

	// Resolve wrapper element from the HTML field control
	const field_ctrl = parent_frm.fields_dict?.[html_field];
	if (!field_ctrl) {
		console.warn(
			`[embedded_form] HTML field '${html_field}' not found on ${parent_frm.doctype}`
		);
		return;
	}

	// frappe.ui.HTMLControl places content in .html-field-value or directly in wrapper
	const wrapper_el =
		field_ctrl.$wrapper?.[0]?.querySelector(".html-field-value") ||
		field_ctrl.wrapper?.querySelector(".html-field-value") ||
		field_ctrl.$wrapper?.[0] ||
		field_ctrl.wrapper;

	if (!wrapper_el) {
		console.warn(`[embedded_form] Cannot resolve wrapper for field '${html_field}'`);
		return;
	}

	// Initialize per-doctype storage maps lazily
	if (!parent_frm.sva_dt_frm)        parent_frm.sva_dt_frm       = {};
	if (!parent_frm.embedded_form)      parent_frm.embedded_form     = {};
	if (!parent_frm.embedded_frm)       parent_frm.embedded_frm      = {};
	if (!parent_frm.embedded_controls)  parent_frm.embedded_controls  = {};

	// Build a SvaDataTable-compatible dt_proxy so EmbeddedFormMixin methods work
	// and dt_events callbacks receive a proper `dt` as first argument.
	const dt_proxy = {
		frm: parent_frm,
		doctype: target_doctype,
		sva_db: new SVAHTTP(),
		isAsync: (fn) => fn?.constructor?.name === "AsyncFunction",
		rows: [],
		connection: null,
		form_dialog: null,
		updateTableBody: () => {},
		onFieldValueChange: () => {},
	};
	Object.assign(dt_proxy, EmbeddedFormMixin);

	// Render the embedded form — sets dt_proxy.form_dialog
	const form_proxy = await dt_proxy.createEmbeddedForm(
		target_doctype,
		target_docname || null,
		wrapper_el,
		mode
	);
	if (!form_proxy) return;

	const fg = form_proxy._fg;

	// Reuse the doc already fetched by createEmbeddedForm — avoids a second API call
	const embedded_doc = dt_proxy._embedded_doc || {};

	// Build the comprehensive frm-compatible object for this embedded DocType.
	// Keys mirror what frappe.ui.form.Form exposes so Client Scripts written for
	// the target DocType can call set_value, refresh_field, add_custom_button etc.
	const embedded_frm_obj = _buildEmbeddedFrm({
		doctype: target_doctype,
		docname: target_docname || "",
		doc: embedded_doc,
		fg,
		parent_frm,
		dt_proxy,
		form_proxy,
		wrapper_el,
		html_field,
	});

	// Store all references keyed by DocType so multiple embeds coexist
	parent_frm.sva_dt_frm[target_doctype]       = embedded_frm_obj;
	parent_frm.embedded_form[target_doctype]     = form_proxy;
	parent_frm.embedded_frm[target_doctype]      = embedded_frm_obj;
	parent_frm.embedded_controls[target_doctype] = fg?.fields_dict || {};

	// Attach ScriptManager and run lifecycle events for the embedded DocType.
	// This allows existing Client Scripts registered via frappe.ui.form.on("Employee", ...)
	// to run with the embedded frm context.
	if (frappe.ui.form.ScriptManager) {
		try {
			embedded_frm_obj.script_manager = new frappe.ui.form.ScriptManager({
				frm: embedded_frm_obj,
			});
			// Lifecycle order mirrors Frappe Form: setup → onload → refresh
			await _safeScriptTrigger(embedded_frm_obj.script_manager, "setup");
			await _safeScriptTrigger(embedded_frm_obj.script_manager, "onload");
			await _safeScriptTrigger(embedded_frm_obj.script_manager, "refresh");
		} catch (e) {
			console.warn("[embedded_form] ScriptManager init failed:", e);
		}
	}

	return embedded_frm_obj;
};

/**
 * Builds the comprehensive frm-compatible object for the embedded DocType.
 * All properties and methods that common Client Scripts and ScriptManager need
 * are implemented. UI-only stubs (page, toolbar, dashboard) are no-op objects.
 */
function _buildEmbeddedFrm({
	doctype,
	docname,
	doc,
	fg,
	parent_frm,
	dt_proxy,
	form_proxy,
	wrapper_el,
	html_field,
}) {
	// Place embedded doc in frappe.model.locals so field dependencies resolve correctly
	if (docname && doc) {
		if (!frappe.model.locals[doctype]) {
			frappe.model.locals[doctype] = {};
		}
		frappe.model.locals[doctype][docname] = doc;
	}

	const embedded_frm = {
		// ── Identity ─────────────────────────────────────────────────────────────
		doctype,
		docname,
		doc,
		meta: frappe.get_meta(doctype),
		perm: frappe.perm.get_perm(doctype),

		// ── Field access (FieldGroup is Layout — fields_dict is fully compatible) ─
		fields_dict: fg?.fields_dict || {},
		fields: fg?.fields_list || [],
		layout: fg,

		// ── Value methods ─────────────────────────────────────────────────────────
		set_value(fieldname, value) {
			if (typeof fieldname === "object") {
				// Support: frm.set_value({ field1: val1, field2: val2 })
				return fg?.set_values(fieldname);
			}
			if (doc) doc[fieldname] = value;
			return fg?.set_value(fieldname, value);
		},
		get_value(fieldname) {
			return fg?.get_value(fieldname);
		},
		get_field(fieldname) {
			return fg?.fields_dict?.[fieldname];
		},
		refresh_field(fieldname) {
			fg?.fields_dict?.[fieldname]?.refresh();
		},
		refresh_fields() {
			Object.values(fg?.fields_dict || {}).forEach((f) => f?.refresh?.());
		},
		get_values(ignore_errors, check_invalid) {
			return fg?.get_values();
		},
		set_df_property(fieldname, property, value) {
			fg?.set_df_property?.(fieldname, property, value);
		},
		toggle_display(fieldnames, show) {
			const fns = Array.isArray(fieldnames) ? fieldnames : [fieldnames];
			fns.forEach((fn) => {
				const f = fg?.fields_dict?.[fn];
				if (f) f.df.hidden = show ? 0 : 1, f.refresh?.();
			});
		},
		toggle_enable(fieldnames, enable) {
			const fns = Array.isArray(fieldnames) ? fieldnames : [fieldnames];
			fns.forEach((fn) => {
				const f = fg?.fields_dict?.[fn];
				if (f) f.df.read_only = enable ? 0 : 1, f.refresh?.();
			});
		},
		toggle_reqd(fieldnames, reqd) {
			const fns = Array.isArray(fieldnames) ? fieldnames : [fieldnames];
			fns.forEach((fn) => {
				const f = fg?.fields_dict?.[fn];
				if (f) f.df.reqd = reqd ? 1 : 0, f.refresh?.();
			});
		},
		set_query(fieldname, opt_or_query, query) {
			// Support both: frm.set_query(fn, query) and frm.set_query(fn, parent, query)
			const qfn = typeof opt_or_query === "function" ? opt_or_query : query;
			const f = fg?.fields_dict?.[fieldname];
			if (f) f.get_query = qfn;
		},
		add_fetch(link_field, source_field, target_field) {
			// add_fetch is wired per-field in frappe.model; register via fg if possible
			fg?.add_fetch?.(link_field, source_field, target_field);
		},
		get_formatted(fieldname) {
			const f = fg?.fields_dict?.[fieldname];
			return f ? frappe.format(f.get_value(), f.df, { only_value: true }, doc) : "";
		},

		// ── State ─────────────────────────────────────────────────────────────────
		is_new: () => !docname,
		is_dirty: () => false,
		dirty: () => {},
		read_only: false,
		save_disabled: false,

		// ── Script hooks (populated by ScriptManager) ─────────────────────────────
		events: {},
		cscript: {},

		// ── Server communication ──────────────────────────────────────────────────
		call(opts, args, callback) {
			if (typeof opts === "string") {
				return frappe.call({ method: opts, args: args || {}, callback });
			}
			return frappe.call(opts);
		},
		has_perm(ptype) {
			return frappe.perm.has_perm(doctype, 0, ptype);
		},
		get_perm(permlevel, access_type) {
			return frappe.perm.get_perm(doctype, permlevel, access_type);
		},

		// ── Custom buttons ────────────────────────────────────────────────────────
		custom_buttons: {},
		add_custom_button(label, fn, group) {
			// Render button in the embedded form footer area
			const btn_area = wrapper_el?.querySelector(".embedded-form-footer");
			if (!btn_area) return $("<button>");
			const btn = document.createElement("button");
			btn.className = "btn btn-default btn-sm";
			btn.textContent = __(label);
			btn.addEventListener("click", fn);
			btn_area.prepend(btn);
			this.custom_buttons[label] = $(btn);
			return $(btn);
		},
		remove_custom_button(label, group) {
			this.custom_buttons[label]?.remove();
			delete this.custom_buttons[label];
		},
		clear_custom_buttons() {
			Object.values(this.custom_buttons).forEach((btn) => btn?.remove());
			this.custom_buttons = {};
		},
		set_intro(text, color) {
			// Render intro text above the embedded form
			let intro_el = wrapper_el?.querySelector(".embedded-form-intro");
			if (!intro_el) {
				intro_el = document.createElement("div");
				intro_el.className = "embedded-form-intro alert";
				wrapper_el?.prepend(intro_el);
			}
			intro_el.className = `embedded-form-intro alert alert-${color || "info"}`;
			intro_el.textContent = text || "";
		},

		// ── Save ─────────────────────────────────────────────────────────────────
		async save() {
			const form_proxy_ref = parent_frm.embedded_form?.[doctype];
			const fg_ref = form_proxy_ref?._fg;
			if (fg_ref) {
				await dt_proxy._saveEmbeddedForm(
					doctype,
					docname || null,
					"write",
					form_proxy_ref,
					fg_ref
				);
			}
		},

		// ── Trigger ───────────────────────────────────────────────────────────────
		async trigger(event, dt, dn) {
			// Fire dt_events for this doctype then ScriptManager handlers
			if (parent_frm?.["dt_events"]?.[doctype]?.[event]) {
				const change = parent_frm["dt_events"][doctype][event];
				dt_proxy.isAsync(change)
					? await change(dt_proxy, "write", null, docname)
					: change(dt_proxy, "write", null, docname);
			}
			if (this.script_manager) {
				await _safeScriptTrigger(this.script_manager, event, dt, dn);
			}
		},

		// ── Refresh ───────────────────────────────────────────────────────────────
		async refresh() {
			await frappe_theme.embedded_form.render({
				parent_frm,
				target_doctype: doctype,
				target_docname: docname,
				html_field: html_field || _resolveHtmlField(parent_frm, wrapper_el),
				mode: "write",
			});
		},

		// ── UI stubs — enough for common Client Script patterns ───────────────────
		page: {
			set_title: () => {},
			set_title_sub: () => {},
			set_indicator: () => {},
			add_inner_button: (label, fn) => {
				// Delegate to add_custom_button so buttons appear in embedded footer
				return embedded_frm.add_custom_button(label, fn);
			},
			remove_inner_button: (label) => embedded_frm.remove_custom_button(label),
			clear_inner_toolbar: () => embedded_frm.clear_custom_buttons(),
			clear_primary_action: () => {},
			set_primary_action: () => {},
			show_menu: () => {},
			hide_menu: () => {},
			add_action_icon: () => {},
			change_inner_button_type: () => {},
			btn_primary: $("<button>"),
			btn_secondary: $("<button>"),
			main: $(wrapper_el),
			wrapper: $(wrapper_el),
		},
		toolbar: {
			current_status: null,
			refresh: () => {},
			set_primary_action: () => {},
		},
		dashboard: {
			refresh: () => {},
			add_section: () => {},
			reset: () => {},
			show: () => {},
			set_headline: () => {},
			set_headline_alert: () => {},
			clear_headline: () => {},
			add_comment: () => {},
			add_transactions: () => {},
			show_progress: () => {},
			hide_progress: () => {},
			after_refresh: () => {},
		},
		timeline: null,
		sidebar: null,
		footer: null,
		attachments: { max_attachments: 0, get_attachments: () => [] },

		// ── ScriptManager — set after construction ─────────────────────────────────
		script_manager: null,

		// ── Internal — not part of public API ────────────────────────────────────
		_dt_proxy: dt_proxy,
		_fg: fg,
		_form_proxy: form_proxy,
	};

	return embedded_frm;
}

/**
 * Resolves the html_field name from the parent_frm given a wrapper element.
 * Used by embedded_frm.refresh() to re-render in the same slot.
 */
function _resolveHtmlField(parent_frm, wrapper_el) {
	for (const [fn, ctrl] of Object.entries(parent_frm.fields_dict || {})) {
		const ctrl_wrapper =
			ctrl.$wrapper?.[0]?.querySelector(".html-field-value") ||
			ctrl.wrapper?.querySelector(".html-field-value") ||
			ctrl.$wrapper?.[0] ||
			ctrl.wrapper;
		if (ctrl_wrapper === wrapper_el) return fn;
	}
	return null;
}

/**
 * Triggers a ScriptManager event safely, catching any errors that stem from
 * the fake frm not fully implementing the Frappe Form interface.
 */
async function _safeScriptTrigger(script_manager, event, doctype, docname) {
	try {
		await script_manager.trigger(event, doctype, docname);
	} catch (e) {
		// ScriptManager may access frm properties (status, toolbar, etc.) that
		// are stubs; log but do not rethrow so rendering continues.
		console.warn(`[embedded_form] ScriptManager.trigger("${event}") error:`, e);
	}
}
