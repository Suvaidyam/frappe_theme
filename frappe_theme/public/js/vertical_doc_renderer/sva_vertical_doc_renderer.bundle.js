import UISetupMixin from "./mixins/ui_setup.js";
import DataMixin from "./mixins/data.js";
import FieldsMixin from "./mixins/fields.js";
import RenderingMixin from "./mixins/rendering.js";
import EditMixin from "./mixins/edit.js";
import HelpersMixin from "./mixins/helpers.js";
import ViewportMixin from "./mixins/viewport.js";
import CreateMixin from "./mixins/create.js";
import ValidationMixin from "./mixins/validation.js";
import LinkTitlesMixin from "./mixins/link_titles.js";
import DeleteMixin from "./mixins/delete.js";

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
 *                           //   object  → pre-built/mimicked meta {name, fields[]}
 *                           //             doctype name is derived from meta.name
 *
 *     docs,                 // string[] | object[] | null
 *                           //   string[]  → doc names; data fetched in batches as user scrolls
 *                           //   object[]  → inline data; zero API calls; lazy-loaded from memory
 *                           //   null      → frappe.db.get_list with start+limit pagination
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
 *     crud_permissions,     // string[] (default ["read"])
 *                           //   "write"  → inline cell auto-sync editing
 *                           //   "create" → "+" column header to create new docs
 *                           //   "delete" → 🗑 icon row to delete doc columns
 *
 *     filters,              // frappe.db.get_list filter array — used when docs: null
 *     order_by,             // string — e.g. "creation desc" — used when docs: null
 *     column_batch_size,    // number (default 0 = auto from viewport width)
 *     column_width,         // number px (default 150) — used for auto batch-size calculation
 *     max_height,           // number px (default 600) — scrollBox max-height for vertical sticky
 *                           //   0 = no limit (header sticks to browser viewport via window scroll)
 *
 *     signal,               // AbortSignal — clears the wrapper when aborted
 *   });
 *
 * Events (vdr_events)
 * ───────────────────
 * Set frm.vdr_events to override rendering at any granularity:
 *
 *   frm.vdr_events = {
 *     formatCell(value, df, doc, colIndex) {},      // return non-null to replace frappe.format() output
 *     renderRow(df, allDocsData, tr) {},            // return true = custom row fully built
 *     renderSectionHeader(label, colCount, tr) {},  // return true = custom header fully built
 *     renderColumnHeader(doc, colIndex, th) {},     // mutate th directly
 *     beforeSave(df, docName, newValue) {},         // return false to cancel save
 *     afterSave(df, docName, newValue) {},
 *     beforeCreate(values, dialog) {},              // return false to cancel create
 *     afterCreate(newDoc) {},
 *     afterRender(instance) {},
 *   };
 */
class SVAVerticalDocRenderer {
	constructor({
		wrapper,
		frm,
		doctype,
		docs = null,
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
		filters = [],
		order_by = null,
		column_batch_size = 0,
		column_width = 150,
		max_height = 600,
		signal = null,
	}) {
		// Branch on doctype type: string = name to fetch, object = pre-built/mimicked meta
		const isMetaObj = doctype && typeof doctype === "object";

		Object.assign(this, {
			wrapper,
			frm,
			doctype: isMetaObj ? doctype.name : doctype,
			_meta_override: isMetaObj ? doctype : null,
			_docs_input: docs,   // raw input — data.js and viewport.js branch on this
			docs: [],            // names of currently rendered columns (grows as batches load)
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
			allow_create: crud_permissions.includes("create"),
			allow_delete: crud_permissions.includes("delete"),
			filters,
			order_by,
			column_batch_size,
			column_width,
			max_height,
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
		await this.fetchDocs();     // loads first batch only

		this.hideLoading();
		this.render();              // renders first-batch columns

		// Batch-fetch link display titles (non-blocking — updates cells asynchronously)
		this.resolveLinkTitles();

		this.setupViewportLoader(); // IntersectionObserver watches for scroll-right
	}
}

Object.assign(
	SVAVerticalDocRenderer.prototype,
	UISetupMixin,
	DataMixin,
	FieldsMixin,
	RenderingMixin,
	EditMixin,
	HelpersMixin,
	ViewportMixin,
	CreateMixin,
	ValidationMixin,
	LinkTitlesMixin,
	DeleteMixin
);

export default SVAVerticalDocRenderer;
