import UISetupMixin from "./mixins/ui_setup.js";
import DataMixin from "./mixins/data.js";
import FieldsMixin from "./mixins/fields.js";
import RenderingMixin from "./mixins/rendering.js";
import EditMixin from "./mixins/edit.js";
import HelpersMixin from "./mixins/helpers.js";

/**
 * SVAVerticalDocRenderer
 * ──────────────────────────────────────────────────────────────────────────
 * Renders multiple documents of a given DocType side-by-side as a comparison
 * table — fields as rows, documents as columns, section breaks as styled
 * header rows.
 *
 * Usage
 * ─────
 *   new SVAVerticalDocRenderer({
 *     wrapper,              // HTMLElement — container
 *     frm,                  // Frappe form object (optional, used for vdr_events)
 *
 *     doctype,              // string | object
 *                           //   string  → DocType name; meta is fetched automatically
 *                           //   object  → pre-built Frappe meta (e.g. frm.meta or frappe.get_meta result)
 *                           //             doctype name is derived from meta.name
 *
 *     docs,                 // string[] — doc names to display as columns (left-to-right)
 *
 *     column_configs,       // [{label, bg_color, text_color}] — per-column header styling
 *                           //   index-aligned to docs array
 *
 *     fields_to_show,       // string[] | null — explicit allowlist; null = show all
 *     fields_to_hide,       // string[]        — fieldnames to exclude
 *
 *     show_section_headers, // boolean (default true)  — render Section/Tab Break labels
 *     show_unit,            // boolean (default false) — show a "Unit" column parsed from field.description
 *     hide_empty_rows,      // boolean (default false) — skip rows where all doc values are empty
 *
 *     title,                // string | null — heading shown above the table
 *     show_legend,          // boolean (default false)
 *     legend_items,         // [{label, bg_color, text_color, description}]
 *
 *     crud_permissions,     // string[] (default ["read"]) — include "write" to enable inline editing
 *     signal,               // AbortSignal — clears the wrapper when aborted
 *   });
 *
 * Events (vdr_events)
 * ───────────────────
 * Set frm.vdr_events to override rendering at any granularity:
 *
 *   frm.vdr_events = {
 *     // Return non-null/undefined to replace default frappe.format() output
 *     formatCell(value, df, doc, colIndex) {},
 *
 *     // Return true to signal that the tr was fully built (skip default cells)
 *     renderRow(df, allDocsData, tr) {},
 *
 *     // Return true to signal the tr was built (skip default td)
 *     renderSectionHeader(label, colCount, tr) {},
 *
 *     // Mutate the th element (no return value needed)
 *     renderColumnHeader(doc, colIndex, th) {},
 *
 *     // Return false to cancel a save operation
 *     beforeSave(df, docName, newValue) {},
 *
 *     afterSave(df, docName, newValue) {},
 *
 *     afterRender(instance) {},
 *   };
 */
class SVAVerticalDocRenderer {
	constructor({
		wrapper,
		frm,
		doctype,
		docs = [],
		column_configs = [],
		fields_to_show = null,
		fields_to_hide = [],
		show_section_headers = true,
		show_unit = false,
		hide_empty_rows = false,
		title = null,
		show_legend = false,
		legend_items = [],
		crud_permissions = ["read"],
		signal = null,
	}) {
		// Branch on doctype type: string = name to fetch, object = pre-built meta
		const isMetaObj = doctype && typeof doctype === "object";

		Object.assign(this, {
			wrapper,
			frm,
			doctype: isMetaObj ? doctype.name : doctype,
			_meta_override: isMetaObj ? doctype : null,
			docs,
			column_configs,
			fields_to_show,
			fields_to_hide,
			show_section_headers,
			show_unit,
			hide_empty_rows,
			title,
			show_legend,
			legend_items,
			crud_permissions,
			signal,
		});

		// Pull vdr_events from the form if set; otherwise empty object
		this.events = (frm && frm.vdr_events) || {};

		this.meta = null;
		this.data = [];

		this._initialize();
	}

	async _initialize() {
		this.setupWrapper();
		this.setupAbortHandler();
		this.showLoading();

		await this.fetchMeta();
		await this.fetchDocs();

		this.hideLoading();
		this.render();
	}
}

Object.assign(
	SVAVerticalDocRenderer.prototype,
	UISetupMixin,
	DataMixin,
	FieldsMixin,
	RenderingMixin,
	EditMixin,
	HelpersMixin
);

export default SVAVerticalDocRenderer;
