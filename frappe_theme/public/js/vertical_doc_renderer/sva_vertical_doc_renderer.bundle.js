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
import RowSettingsMixin from "./mixins/row_settings.js";
import AddMoreMixin from "./mixins/add_more.js";
import BatchGroupMixin from "./mixins/batch_group.js";

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
		column_label_field = null, // fieldname on source DocType to use as column header label
		column_default_bg = null, // default bg_color for all columns (overridden by column_configs[i].bg_color)
		column_default_text = null, // default text_color for all columns (overridden by column_configs[i].text_color)
		column_color_rules = [], // [{key, bg_color, text_color, priority}] — key-based color matching
		// key is matched (case-insensitive substring) against column header label
		// highest priority wins when multiple keys match
		column_order_rules = [], // [{key, order, priority}] — key-based column ordering
		// order: numeric sort position (lower = rendered first)
		// priority: higher wins when multiple keys match (default 0)
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
		label_width = 160,
		vdr_label_width = null, // alias for label_width (matches Custom Property Setter field name)
		max_height = 600,
		signal = null,
		vdr_field_name = null, // HTML field name hosting this VDR — enables server-side settings save
		fields_config = null, // string[] of fieldnames in display order, or null for default
		section_configs = {}, // object keyed by section fieldname or label:
		//   { [fieldname|label]: { label, bg_color, text_color, collapsed, hidden } }
		//   collapsed: true  → section starts collapsed; click header to toggle
		//   hidden:    true  → entire section (header + fields) is not rendered
		link_title_fields = {}, // { [LinkedDocType]: fieldname } — explicit display-field override
		//   e.g. { "Block": "block_name", "District": "district_name" }
		//   Takes priority over frappe.boot.link_title_doctypes and title_field meta
		table_max_rows = null, // null = unlimited rows per Table field; 1 = single-row mode (no listing dialog)
		vdr_table_max_rows = null, // alias for table_max_rows (matches Custom Property Setter field name)
		add_more_config = null, // batch config from vdr_batch_config property setter field
		//   { allow_add_more_table, add_more_button_label, add_more_doctype,
		//     grouping_field, plot_link_field, default_collapsed_new_table, batch_title_prefix }
		child_add_row_labels = null, // { [fieldname]: "Custom Label" } — per child-table "Add Row" label
		_is_sub_vdr = false, // true when instantiated as a batch child — suppresses reload button
	}) {
		// Branch on doctype type: string = name to fetch, object = pre-built/mimicked meta
		const isMetaObj = doctype && typeof doctype === "object";

		Object.assign(this, {
			wrapper,
			frm,
			doctype: isMetaObj ? doctype.name : doctype,
			_meta_override: isMetaObj ? doctype : null,
			_docs_input: docs, // raw input — data.js and viewport.js branch on this
			docs: [], // names of currently rendered columns (grows as batches load)
			column_configs,
			column_label_field,
			column_default_bg,
			column_default_text,
			column_color_rules,
			column_order_rules,
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
			label_width: vdr_label_width ? Number(vdr_label_width) : label_width,
			max_height,
			signal,
			vdr_field_name,
			fields_config,
			section_configs,
			link_title_fields,
			table_max_rows: vdr_table_max_rows ? Number(vdr_table_max_rows) : table_max_rows,
			add_more_config,
			child_add_row_labels,
			_is_sub_vdr,
			_initial_fields_config: fields_config ? [...fields_config] : null,
			_has_user_settings: false,
		});

		// Pull vdr_events from the form if set; otherwise empty object
		this.events = (frm && frm.vdr_events) || {};

		this.meta = null;
		this.data = [];

		// _ready resolves when _initialize() fully completes.
		// Used by batch_group.js to await sub-VDR render before starting the next.
		this._ready = this._initialize();
	}

	async _initialize() {
		this.setupWrapper();
		this.setupAbortHandler();
		this.showLoading();

		await this.fetchMeta();
		await this._loadUserRowSettings();

		if (this._isBatchGrouped && this._isBatchGrouped()) {
			// ── Batched mode: one collapsible table per batch_no ──────────────
			await this._renderBatchGroups();
			this.hideLoading();
			this._renderAddMoreButton();
		} else {
			// ── Standard mode ─────────────────────────────────────────────────
			await this.fetchDocs();
			this._sortDataByOrderRules();
			this.hideLoading();
			this.render();
			this._renderAddMoreButton();
			this.resolveLinkTitles();
			this.setupViewportLoader();
		}
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
	DeleteMixin,
	RowSettingsMixin,
	AddMoreMixin,
	BatchGroupMixin
);

export default SVAVerticalDocRenderer;
frappe.ui.SVAVerticalDocRenderer = SVAVerticalDocRenderer;
