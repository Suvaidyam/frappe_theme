import SVAFilterGroup from "./filter_list.bundle.js";

class SVAFilterArea {
	constructor({ wrapper, doctype, on_change, dt_filter_fields = [] }) {
		this.wrapper = wrapper;
		this.doctype = doctype;
		this.on_change = on_change;
		this.dt_filter_fields = dt_filter_fields;

		this.filter_component = $('<div class="filter-section flex">').appendTo(this.wrapper);
		this.setup();
	}

	setup() {
		let me = this;
		me.make_filter_list();
	}

	async make_standard_filters() {
		this.standard_filters_wrapper = this.dt_filter_fields.sva_dt.wrapper.querySelector(
			"#standard_filters_wrapper"
		);
		if (!this.standard_filters_wrapper) {
			return;
		}
		if (this.standard_filters_wrapper.children.length) {
			return;
		}
		let { sva_dt } = this.dt_filter_fields;
		let columns = sva_dt?.meta?.fields || sva_dt?.columns;
		if (!columns?.length) {
			return;
		}
		let list_filters = JSON.parse(sva_dt?.connection?.list_filters || "[]");
		if (!list_filters.length) {
			return;
		}
		let list_filter_fieldnames = list_filters.map((d) => d.fieldname);
		let fields = [];
		const title_field = sva_dt?.meta?.title_field;

		fields = fields.concat(
			columns
				.filter(
					(df) =>
						df.fieldname === title_field ||
						(list_filter_fieldnames.includes(df.fieldname) &&
							frappe.model.is_value_type(df.fieldtype))
				)
				.map((df) => {
					let options = df.options;
					let condition = "=";
					let fieldtype = df.fieldtype;
					if (
						[
							"Text",
							"Small Text",
							"Text Editor",
							"HTML Editor",
							"Data",
							"Code",
							"Phone",
							"JSON",
							"Read Only",
						].includes(fieldtype)
					) {
						fieldtype = "Data";
						condition = "like";
					}
					if (df.fieldtype == "Select" && df.options) {
						options = df.options.split("\n");
						if (options.length > 0 && options[0] != "") {
							options.unshift("");
							options = options.join("\n");
						}
					}
					if (
						df.fieldtype == "Link" &&
						df.options &&
						frappe.boot.treeviews.includes(df.options)
					) {
						condition = "descendants of (inclusive)";
					}

					return {
						fieldtype: fieldtype,
						label: __(df.label, null, df.parent),
						options: options,
						fieldname: df.fieldname,
						condition: condition,
						onchange: () => this.on_change(this.get_standard_filters() || [], true),
						ignore_link_validation: fieldtype === "Dynamic Link",
						is_filter: 1,
					};
				})
		);
		fields.map((df) => {
			this.dt_filter_fields.sva_dt.add_field(df, this.standard_filters_wrapper);
		});
	}

	get_standard_filters() {
		const filters = [];
		const fields_dict = this.dt_filter_fields.sva_dt.standard_filters_fields_dict;
		for (let key in fields_dict) {
			let field = fields_dict[key];
			let value = field.get_value();
			if (value) {
				if (field.df.condition === "like" && !value.includes("%")) {
					value = "%" + value + "%";
				}
				filters.push([
					field.df.doctype || this.doctype,
					field.df.fieldname,
					field.df.condition || "=",
					value,
				]);
			}
		}
		return filters;
	}

	get() {
		let filters = this.filter_list.get_filters();
		return filters;
	}
	// set(filters) {
	// 	// use to method to set filters without triggering refresh
	// 	this.trigger_refresh = false;

	// 	return this.add(filters, false).then(() => {
	// 		this.trigger_refresh = false;
	// 		this.filter_list.update_filter_button();
	// 	});
	// }

	// add(filters, refresh = false) {
	// 	if (!filters || (Array.isArray(filters) && filters.length === 0)) return Promise.resolve();
	// 	if (typeof filters[0] === "string") {
	// 		// passed in the format of doctype, field, condition, value
	// 		const filter = Array.from(arguments);
	// 		filters = [filter];
	// 	}

	// 	filters = filters.filter((f) => !this.exists(f));
	// 	// console.log(filters)
	// 	// standard filters = filters visible on list view
	// 	// non-standard filters = filters set by filter button

	// 	const { non_standard_filters, promise } = this.set_standard_filter(filters);

	// 	return promise
	// 		.then(() => {
	// 			return (
	// 				non_standard_filters.length > 0 &&
	// 				this.filter_list.add_filters(non_standard_filters)
	// 			);
	// 		})
	// 		.then(() => {
	// 			refresh && this.dt_filter_fields.sva_dt.reloadTable(true);
	// 		});
	// }
	// exists(f) {
	// 	let exists = false;
	// 	// check in standard filters
	// 	const fields_dict = this.dt_filter_fields.sva_dt.standard_filters_fields_dict;
	// 	if (f[2] === "=" && f[1] in fields_dict) {
	// 		const value = fields_dict[f[1]].get_value();
	// 		if (value) {
	// 			exists = true;
	// 		}
	// 	}

	// 	// check in filter area
	// 	if (!exists) {
	// 		exists = this.filter_list.filter_exists(f);
	// 	}

	// 	return exists;
	// }

	// set_standard_filter(filters) {
	// 	if (filters.length === 0) {
	// 		return {
	// 			non_standard_filters: [],
	// 			promise: Promise.resolve(),
	// 		};
	// 	}

	// 	const fields_dict = this.dt_filter_fields.sva_dt.standard_filters_fields_dict;
	// 	console.log(fields_dict,'fields_dict')

	// 	return filters.reduce((out, filter) => {
	// 		const [dt, fieldname, condition, value] = filter;
	// 		out.promise = out.promise || Promise.resolve();
	// 		out.non_standard_filters = out.non_standard_filters || [];

	// 		// set in list view area if filters are present
	// 		// don't set like filter on link fields (gets reset)
	// 		if (
	// 			fields_dict[fieldname] &&
	// 			(condition === "=" ||
	// 				(condition === "like" && fields_dict[fieldname]?.df?.fieldtype != "Link") ||
	// 				(condition === "descendants of (inclusive)" &&
	// 					fields_dict[fieldname]?.df?.fieldtype == "Link"))
	// 		) {
	// 			// standard filter
	// 			out.promise = out.promise.then(() => fields_dict[fieldname].set_value(value));
	// 		} else {
	// 			// filter out non standard filters
	// 			out.non_standard_filters.push(filter);
	// 		}
	// 		return out;
	// 	}, {});
	// }

	make_filter_list() {
		$(`<div class="filter-selector">
			<div class="btn-group">
				<button class="btn btn-default btn-sm filter-button">
					<span class="filter-icon">
						${frappe.utils.icon("es-line-filter")}
					</span>
					<span class="button-label hidden-xs">
					${__("Filter")}
					<span>
				</button>
				<button class="btn btn-default btn-sm filter-x-button" title="${__("Clear all filters")}">
					<span class="filter-icon">
						${frappe.utils.icon("es-small-close")}
					</span>
				</button>
			</div>
		</div>`).appendTo(this.filter_component);

		this.filter_button = this.filter_component.find(".filter-button");
		this.filter_x_button = this.filter_component.find(".filter-x-button");
		this.filter_list = new SVAFilterGroup({
			parent: this.filter_component,
			doctype: this.doctype,
			filter_button: this.filter_button,
			filter_x_button: this.filter_x_button,
			dt_filter_fields: this.dt_filter_fields,
			default_filters: [],
			on_change: () => this.on_change(this.get()),
		});
	}
}

export default SVAFilterArea;
