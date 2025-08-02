import SVAFieldSelect from './field_select.bundle.js';

class SVAFilter {
	constructor(opts) {
		$.extend(this, opts);
		if (this.value === null || this.value === undefined) {
			this.value = "";
		}
		this.dt_filter_fields = opts.dt_filter_fields || []
		this.utils = frappe.ui.filter_utils;
		this.get_filter_fields();
		this.set_conditions();
		this.set_conditions_from_config();
		this.make();
		this.fields = {};
	}

	set_conditions() {
		this.conditions = [
			["=", __("Equals")],
			["!=", __("Not Equals")],
			["like", __("Like")],
			["not like", __("Not Like")],
			["in", __("In")],
			["not in", __("Not In")],
			["is", __("Is")],
			[">", __("Greater Than")],
			["<", __("Less Than")],
			[">=", __("Greater Than Or Equal To")],
			["<=", __("Less Than Or Equal To")],
			["Between", __("Between")],
			["Timespan", __("Timespan")],
		];

		this.nested_set_conditions = [
			["descendants of", __("Descendants Of")],
			["descendants of (inclusive)", __("Descendants Of (inclusive)")],
			["not descendants of", __("Not Descendants Of")],
			["ancestors of", __("Ancestors Of")],
			["not ancestors of", __("Not Ancestors Of")],
		];

		this.conditions.push(...this.nested_set_conditions);

		this.invalid_condition_map = {
			Date: ["like", "not like"],
			Datetime: ["like", "not like", "in", "not in", "=", "!="],
			Data: ["Between", "Timespan"],
			Select: ["like", "not like", "Between", "Timespan"],
			Link: ["Between", "Timespan", ">", "<", ">=", "<="],
			Currency: ["Between", "Timespan"],
			Color: ["Between", "Timespan"],
			Check: this.conditions.map((c) => c[0]).filter((c) => c !== "="),
			Code: ["Between", "Timespan", ">", "<", ">=", "<=", "in", "not in"],
			"HTML Editor": ["Between", "Timespan", ">", "<", ">=", "<=", "in", "not in"],
			"Markdown Editor": ["Between", "Timespan", ">", "<", ">=", "<=", "in", "not in"],
			Password: ["Between", "Timespan", ">", "<", ">=", "<=", "in", "not in"],
			Rating: ["like", "not like", "Between", "in", "not in", "Timespan"],
			Int: ["like", "not like", "Between", "in", "not in", "Timespan"],
			Float: ["like", "not like", "Between", "in", "not in", "Timespan"],
			Percent: ["like", "not like", "Between", "in", "not in", "Timespan"],
		};

		this.special_condition_labels = {
			Date: {
				"<": __("Before"),
				">": __("After"),
				"<=": __("On or Before"),
				">=": __("On or After"),
			},
			Datetime: {
				"<": __("Before"),
				">": __("After"),
				"<=": __("On or Before"),
				">=": __("On or After"),
			},
		};
	}

	set_conditions_from_config() {
		if (frappe.boot.additional_filters_config) {
			this.filters_config = frappe.boot.additional_filters_config;
			for (let key of Object.keys(this.filters_config)) {
				const filter = this.filters_config[key];
				this.conditions.push([key, __(filter.label)]);
				for (let fieldtype of Object.keys(this.invalid_condition_map)) {
					if (!filter.valid_for_fieldtypes.includes(fieldtype)) {
						this.invalid_condition_map[fieldtype].push(key);
					}
				}
			}
		}
	}

	make() {
		this.filter_edit_area = $(
			frappe.render_template("edit_filter", {
				conditions: this.conditions,
			})
		);
		this.parent && this.filter_edit_area.appendTo(this.parent.find(".filter-edit-area"));
		this.set_events();
		this.setup();
	}

	get_filter_fields() {
		// let res = await frappe.call({
		// 	method: "frappe_theme.dt_api.doc_filters",
		// 	args: {
		// 		doctype:this.parent_doctype
		// 	},
		// });
		let { sva_dt, header } = this.dt_filter_fields;
		if (sva_dt?.columns?.length) {
			if (header?.length) {
				this.fields = { [this.parent_doctype]: sva_dt?.columns?.filter(column => header?.includes(column.fieldname) && !["name", "creation", "modified", 'modified_by', 'owner'].includes(column.fieldname)) };
			} else {
				this.fields = { [this.parent_doctype]: sva_dt?.columns?.filter(column => !["name", "creation", "modified", 'modified_by', 'owner'].includes(column.fieldname)) };
			}
		} else {
			this.fields = { [this.parent_doctype]: [] };
		}
	}

	async make_select() {
		this.fieldselect = new SVAFieldSelect({
			parent: this.filter_edit_area.find(".fieldname-select-area"),
			doctype: this.parent_doctype,
			dt_filter_fields: this.dt_filter_fields,
			parent_doctype: this._parent_doctype,
			filter_fields: this.filter_fields,
			input_class: "input-xs",
			fields: this.fields,
			select: (doctype, fieldname) => {
				this.set_field(doctype, fieldname);
			},
		});

		if (this.fieldname) {
			this.fieldselect.set_value(this.doctype, this.fieldname);
		}
	}

	set_events() {
		this.filter_edit_area.find(".remove-filter").on("click", () => {
			this.remove();
			this.on_change(this.get_condition());
		});

		this.filter_edit_area.find(".condition").change(() => {
			if (!this.field) return;

			let condition = this.get_condition();
			let fieldtype = null;

			if (["in", "like", "not in", "not like"].includes(condition)) {
				fieldtype = "Data";
				this.add_condition_help(condition);
			} else {
				this.filter_edit_area.find(".filter-description").empty();
			}

			if (
				["Select", "MultiSelect"].includes(this.field.df.fieldtype) &&
				["in", "not in"].includes(condition)
			) {
				fieldtype = "MultiSelect";
			}
			console.log(this.field, 'this.field')
			this.set_field(this.field.df.parent, this.field.df.fieldname, fieldtype, condition);
		});
	}

	async setup() {
		await this.make_select();
		const fieldname = this.fieldname || "name";
		return this.set_values(this.doctype, fieldname, this.condition, this.value);
	}

	setup_state(is_new) {
		let promise = Promise.resolve();
		if (is_new) {
			this.filter_edit_area.addClass("new-filter");
		} else {
			promise = this.update_filter_tag();
		}

		if (this.hidden) {
			promise.then(() => this.$filter_tag.hide());
		}
	}

	freeze() {
		this.update_filter_tag();
	}

	update_filter_tag() {
		if (this._filter_value_set) {
			return this._filter_value_set.then(() => {
				!this.$filter_tag ? this.make_tag() : this.set_filter_button_text();
				this.filter_edit_area.hide();
			});
		} else {
			return Promise.resolve();
		}
	}

	remove() {
		this.filter_edit_area.remove();
		this.field = null;
	}

	set_values(doctype, fieldname, condition, value) {
		// presents given (could be via tags!)
		if (this.set_field(doctype, fieldname) === false) {
			return;
		}

		if (this.field.df.original_type === "Check") {
			value = value == 1 ? "Yes" : "No";
		}
		if (condition) this.set_condition(condition, true);

		// set value can be asynchronous, so update_filter_tag should happen after field is set
		this._filter_value_set = Promise.resolve();

		if (["in", "not in"].includes(condition) && Array.isArray(value)) {
			value = value.join(",");
		}

		if (Array.isArray(value)) {
			this._filter_value_set = this.field.set_value(value);
		} else if (value !== undefined || value !== null) {
			this._filter_value_set = this.field.set_value((value + "").trim());
		}
		return this._filter_value_set;
	}

	set_field(doctype, fieldname, fieldtype, condition) {
		// set in fieldname (again)
		let cur = {};
		if (this.field) for (let k in this.field.df) cur[k] = this.field.df[k];
		let original_docfield = (this.fieldselect.fields_by_name[doctype] || {})[fieldname];
		if (!original_docfield) {
			console.warn(`Field ${fieldname} is not selectable.`);
			this.remove();
			return false;
		}

		let df = copy_dict(original_docfield);

		// filter field shouldn't be read only or hidden
		df.read_only = 0;
		df.hidden = 0;
		df.is_filter = true;
		delete df.hidden_due_to_dependency;

		let c = condition ? condition : this.utils.get_default_condition(df);
		this.set_condition(c);

		this.utils.set_fieldtype(df, fieldtype, this.get_condition());

		// called when condition is changed,
		// don't change if all is well
		if (
			this.field &&
			cur.fieldname == fieldname &&
			df.fieldtype == cur.fieldtype &&
			df.parent == cur.parent &&
			df.options == cur.options
		) {
			return;
		}

		// clear field area and make field
		this.fieldselect.selected_doctype = doctype;
		this.fieldselect.selected_fieldname = fieldname;

		if (
			this.filters_config &&
			this.filters_config[condition] &&
			this.filters_config[condition].valid_for_fieldtypes.includes(df.fieldtype)
		) {
			let args = {};
			if (this.filters_config[condition].depends_on) {
				const field_name = this.filters_config[condition].depends_on;
				const filter_value = this.filter_list.get_filter_value(field_name);
				args[field_name] = filter_value;
			}
			let setup_field = (field) => {
				df.fieldtype = field.fieldtype;
				df.options = field.options;
				df.fieldname = fieldname;
				this.make_field(df, cur.fieldtype);
			};
			if (this.filters_config[condition].data) {
				let field = this.filters_config[condition].data;
				setup_field(field);
			} else {
				frappe.xcall(this.filters_config[condition].get_field, args).then((field) => {
					this.filters_config[condition].data = field;
					setup_field(field);
				});
			}
		} else {
			this.make_field(df, cur.fieldtype);
		}
	}

	make_field(df, old_fieldtype) {
		let old_text = this.field ? this.field.get_value() : null;
		this.hide_invalid_conditions(df.fieldtype, df.original_type);
		this.set_special_condition_labels(df.original_type);
		this.toggle_nested_set_conditions(df);
		let field_area = this.filter_edit_area.find(".filter-field").empty().get(0);
		df.input_class = "input-xs";
		let f = frappe.ui.form.make_control({
			df: df,
			parent: field_area,
			only_input: true,
		});
		f.refresh();

		this.field = f;
		if (old_text && f.fieldtype === old_fieldtype) {
			this.field.set_value(old_text);
		}

		this.bind_filter_field_events();
	}

	bind_filter_field_events() {
		return;
	}

	get_value() {
		return [
			this.fieldselect.selected_doctype,
			this.field.df.fieldname,
			this.get_condition(),
			this.get_selected_value(),
			this.hidden,
		];
	}

	get_selected_value() {
		return this.utils.get_selected_value(this.field, this.get_condition());
	}

	get_selected_label() {
		return this.utils.get_selected_label(this.field);
	}

	get_condition() {
		return this.filter_edit_area.find(".condition").val();
	}

	set_condition(condition, trigger_change = false) {
		let $condition_field = this.filter_edit_area.find(".condition");
		$condition_field.val(condition);
		if (trigger_change) $condition_field.change();
	}

	add_condition_help(condition) {
		const description = ["in", "not in"].includes(condition)
			? __("values separated by commas")
			: __("use % as wildcard");

		this.filter_edit_area.find(".filter-description").html(description);
	}

	make_tag() {
		if (!this.field) return;
		this.$filter_tag = this.get_filter_tag_element().insertAfter(
			this.parent.find(".active-tag-filters .clear-filters")
		);
		this.set_filter_button_text();
		this.bind_tag();
	}

	bind_tag() {
		this.$filter_tag.find(".remove-filter").on("click", this.remove.bind(this));

		let filter_button = this.$filter_tag.find(".toggle-filter");
		filter_button.on("click", () => {
			filter_button.closest(".tag-filters-area").find(".filter-edit-area").show();
			this.filter_edit_area.toggle();
		});
	}

	set_filter_button_text() {
		this.$filter_tag.find(".toggle-filter").html(this.get_filter_button_text());
	}

	get_filter_button_text() {
		let value = this.utils.get_formatted_value(
			this.field,
			this.get_selected_label() || this.get_selected_value()
		);
		return `${__(this.field.df.label)} ${__(this.get_condition())} ${__(value)}`;
	}

	get_filter_tag_element() {
		return $(`<div class="filter-tag btn-group">
			<button class="btn btn-default btn-xs toggle-filter"
				title="${__("Edit Filter")}">
			</button>
			<button class="btn btn-default btn-xs remove-filter"
				title="${__("Remove Filter")}">
				${frappe.utils.icon("close")}
			</button>
		</div>`);
	}

	hide_invalid_conditions(fieldtype, original_type) {
		let invalid_conditions =
			this.invalid_condition_map[original_type] ||
			this.invalid_condition_map[fieldtype] ||
			[];

		for (let condition of this.conditions) {
			this.filter_edit_area
				.find(`.condition option[value="${condition[0]}"]`)
				.toggle(!invalid_conditions.includes(condition[0]));
		}
	}

	set_special_condition_labels(original_type) {
		let special_conditions = this.special_condition_labels[original_type] || {};
		for (let condition of this.conditions) {
			let special_label = special_conditions[condition[0]];
			if (special_label) {
				this.filter_edit_area
					.find(`.condition option[value="${condition[0]}"]`)
					.text(special_label);
			} else {
				this.filter_edit_area
					.find(`.condition option[value="${condition[0]}"]`)
					.text(__(condition[1]));
			}
		}
	}

	toggle_nested_set_conditions(df) {
		let show_condition =
			df.fieldtype === "Link" && frappe.boot.nested_set_doctypes.includes(df.options);
		this.nested_set_conditions.forEach((condition) => {
			this.filter_edit_area
				.find(`.condition option[value="${condition[0]}"]`)
				.toggle(show_condition);
		});
	}
};

export default SVAFilter;