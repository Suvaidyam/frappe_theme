frappe.ui.form.ControlDate = class extends frappe.ui.form.ControlDate {
	make_input() {
		super.make_input();
		// do not call this.make_picker() here; parent already calls it
		if (this?.frm?.meta?.issingle && this.frm?.meta?.is_dashboard) {
			this.$wrapper.find(".form-control").css({
				"background-color": "white",
				outline: "none",
				border: "1px solid #dcdcdc",
				"border-radius": "6px",
				"box-shadow": "none",
				cursor: "pointer",
			});
			this.$wrapper.find("div.clearfix").remove();
		}
	}

	make_picker() {
		if (this.df?.sva_date_range) {
			this.make_date_range_picker();
		} else if (this.df?.date_format && ["month"].includes(this.df?.date_format)) {
			this.make_month_picker();
		} else {
			super.make_picker();
		}
	}

	set_datepicker() {
		super.set_datepicker();
		if (
			this?.frm?.meta?.issingle &&
			this.frm?.meta?.is_dashboard &&
			!this.df?.sva_date_range
		) {
			this._dashboard_condition = "=";
			this._date_ranges = []; // stores additional Between ranges for multi-range OR filter
			// Directly write to frm.doc on selection so Apply always has the value
			this.datepicker.update("onSelect", () => {
				if (this._dashboard_condition === "Between") {
					const dates = this.datepicker.selectedDates;
					if (dates.length === 2) {
						const d1 = moment(dates[0]).format("YYYY-MM-DD");
						const d2 = moment(dates[1]).format("YYYY-MM-DD");
						this.frm.doc[this.df.fieldname] = [d1, d2];
						this._show_add_range_button();
					}
				} else {
					const raw = this.get_input_value();
					if (raw) {
						const parsed = this.parse(raw);
						if (parsed) {
							this.frm.doc[this.df.fieldname] = parsed;
						}
					}
				}
			});
			this._inject_operator_into_picker();
		}
	}

	_show_add_range_button() {
		if (this.$wrapper.find(".sva-add-range-btn").length) return;
		const $btn = $("<button>")
			.attr("type", "button")
			.addClass("sva-add-range-btn")
			.css({
				flexShrink: "0",
				background: "white",
				border: "1px solid #ced4da",
				borderRadius: "50%",
				width: "22px",
				height: "22px",
				padding: "0",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				cursor: "pointer",
				fontSize: "14px",
				fontWeight: "700",
				color: "#495057",
			})
			.text("+");
		$btn.on("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this._add_date_range();
		});

		// Wrap input + "+" in a flex row so they sit side-by-side
		const $inputWrapper = this.$wrapper.find(".control-input-wrapper");
		$inputWrapper.css({ position: "" }); // clear any previously set position
		if (!this.$wrapper.find(".sva-date-range-row").length) {
			$inputWrapper.wrap(
				$("<div>").addClass("sva-date-range-row").css({
					display: "flex",
					alignItems: "center",
					gap: "6px",
				})
			);
		}
		this.$wrapper.find(".sva-date-range-row").append($btn);
	}

	_hide_add_range_button() {
		this.$wrapper.find(".sva-add-range-btn").remove();
		this.$wrapper.find(".sva-date-range-row .control-input-wrapper").unwrap();
	}

	_add_date_range() {
		const val = this.frm.doc[this.df.fieldname];
		if (!Array.isArray(val) || val.length !== 2) return;
		this._date_ranges.push([val[0], val[1]]);
		this.frm.doc[this.df.fieldname] = [];
		this.datepicker.clear();
		this.$input.val("");
		this._render_range_chips();
	}

	_render_range_chips() {
		let $area = this.$wrapper.find(".sva-range-chips-area");
		if (!$area.length) {
			$area = $("<div>").addClass("sva-range-chips-area").css({
				display: "flex",
				flexWrap: "wrap",
				gap: "4px",
				marginTop: "4px",
			});
			const $row = this.$wrapper.find(".sva-date-range-row");
			($row.length ? $row : this.$wrapper.find(".control-input-wrapper")).after($area);
		}
		$area.empty();

		this._date_ranges.forEach((range, idx) => {
			const [from, to] = range;
			let fromDisplay = from,
				toDisplay = to;
			try {
				fromDisplay = frappe.datetime.str_to_user(from);
				toDisplay = frappe.datetime.str_to_user(to);
			} catch (e) {
				// keep raw values
			}
			const $chip = $("<span>")
				.addClass("badge badge-light sva-range-chip")
				.css({ fontSize: "11px", padding: "3px 8px", cursor: "default" })
				.html(
					`${fromDisplay} – ${toDisplay} <span class="sva-remove-range" data-idx="${idx}" style="cursor:pointer;margin-left:3px;font-weight:bold;">&times;</span>`
				);
			$chip.find(".sva-remove-range").on("click", (e) => {
				const i = parseInt($(e.currentTarget).data("idx"), 10);
				this._date_ranges.splice(i, 1);
				this._render_range_chips();
				if (this._date_ranges.length === 0) {
					// Only remove "+" if the current input also has no range selected
					const currentVal = this.frm.doc[this.df.fieldname];
					const inputHasRange = Array.isArray(currentVal) && currentVal.length === 2;
					if (!inputHasRange) {
						this._hide_add_range_button();
					}
				}
			});
			$area.append($chip);
		});

		if (this._date_ranges.length === 0) {
			$area.remove();
		}
	}

	_inject_operator_into_picker() {
		const conditions = [
			["=", __("Equals"), "="],
			["!=", __("Not Equals"), "≠"],
			["<", __("Before"), "<"],
			[">", __("After"), ">"],
			["<=", __("On or Before"), "≤"],
			[">=", __("On or After"), "≥"],
			["Between", __("Between"), "↔"],
		];

		const $select = $("<select>").addClass("sva-date-op-select").css({
			width: "100%",
			"background-color": "white",
			border: "1px solid #dcdcdc",
			"border-radius": "6px",
			padding: "4px 8px",
			height: "30px",
			"font-size": "12px",
			"margin-bottom": "8px",
			cursor: "pointer",
			outline: "none",
			display: "block",
			appearance: "none",
			"-webkit-appearance": "none",
			"-moz-appearance": "none",
		});

		conditions.forEach(([val, label]) => {
			$select.append($("<option>").val(val).text(label));
		});

		// Badge shown on the right side of the input
		const $badge = $("<span>").addClass("sva-date-op-badge").text("=").css({
			position: "absolute",
			right: "8px",
			top: "50%",
			transform: "translateY(-50%)",
			"font-size": "11px",
			"font-weight": "600",
			color: "#6c757d",
			"pointer-events": "none",
			"line-height": "1",
		});

		this.$wrapper.find(".control-input-wrapper").css({ position: "relative" }).append($badge);

		// Pad input right so text doesn't overlap the badge
		this.$wrapper.find(".form-control").css({ "padding-right": "24px" });

		$select.on("change", () => {
			const val = $select.val();
			this._dashboard_condition = val;
			const symbol = conditions.find(([v]) => v === val)?.[2] || "=";
			$badge.text(symbol);

			if (val === "Between") {
				this.datepicker.update("range", true);
				this.datepicker.update("toggleSelected", false);
			} else {
				// Clear any saved multi-ranges when leaving Between mode
				this._date_ranges = [];
				this._render_range_chips();
				this._hide_add_range_button();

				this.datepicker.update("range", false);
				this.datepicker.clear();
				this.frm.doc[this.df.fieldname] = "";
			}
		});

		this.datepicker.$datepicker.prepend($select);
	}

	make_date_range_picker() {
		this._date_ranges = []; // multi-range storage
		let lang = frappe.boot?.user?.language;
		let datepicker_options = {
			language: $.fn.datepicker.language?.[lang] ? lang : "en",
			range: true,
			autoClose: true,
			toggleSelected: false,
			firstDay: frappe.datetime.get_first_day_of_the_week_index(),
			dateFormat: frappe.boot.sysdefaults?.date_format || "yyyy-mm-dd",
			onSelect: () => {
				const dates = this.datepicker.selectedDates;
				if (dates.length === 2) {
					this._show_add_range_button();
				} else {
					this._hide_add_range_button();
				}
				this.$input.trigger("change");
			},
		};
		this.$input.datepicker(datepicker_options);
		this.datepicker = this.$input.data("datepicker");

		this.$input.on("change", () => {
			let parsed = this._parse_date_range(this.$input.val());
			if (parsed) {
				this.set_value(parsed);
			} else {
				this.set_value(null);
				this._hide_add_range_button();
			}
		});
	}

	_parse_date_range(value) {
		if (!value) return null;
		const to = __("{0} to {1}").replace("{0}", "").replace("{1}", "");
		value = value.replace(to, ",");
		if (value.includes(",")) {
			let vals = value.split(",");
			let from_date = moment(frappe.datetime.user_to_obj(vals[0].trim())).format(
				"YYYY-MM-DD"
			);
			let to_date = moment(frappe.datetime.user_to_obj(vals[vals.length - 1].trim())).format(
				"YYYY-MM-DD"
			);
			return [from_date, to_date];
		}
		return null;
	}

	make_month_picker() {
		// Store the original input reference
		const originalInput = this.$input;

		// Create new month input element
		const monthInput = $("<input>", {
			type: "month",
			class: originalInput.attr("class") + " month-picker-input",
			id: originalInput.attr("id"),
			name: originalInput.attr("name"),
			placeholder: this.df.placeholder || "Select Month",
			required: this.df.reqd || false,
		});

		// Set default value if exists
		if (this.value) {
			// Accept values like YYYY-MM or YYYY-MM-DD or a Date
			let monthValue = this.value;
			if (typeof monthValue === "string") {
				if (/^\d{4}-\d{2}-\d{2}$/.test(monthValue)) {
					monthInput.val(monthValue.slice(0, 7));
				} else if (/^\d{4}-\d{2}$/.test(monthValue)) {
					monthInput.val(monthValue);
				} else {
					try {
						const sys = frappe.datetime.user_to_str(monthValue, false);
						if (/^\d{4}-\d{2}-\d{2}$/.test(sys)) {
							monthInput.val(sys.slice(0, 7));
						}
					} catch (e) {
						console.error(e);
					}
				}
			} else if (monthValue instanceof Date && !isNaN(monthValue)) {
				const year = monthValue.getFullYear();
				const month = String(monthValue.getMonth() + 1).padStart(2, "0");
				monthInput.val(`${year}-${month}`);
			} else {
				// Fallback: try to parse as Date
				const date = new Date(monthValue);
				if (!isNaN(date)) {
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, "0");
					monthInput.val(`${year}-${month}`);
				}
			}
		}

		// Replace the original input with the new month input
		originalInput.replaceWith(monthInput);
		this.$input = monthInput;

		// Bind change event
		this.$input.on("change", () => {
			const selectedValue = this.$input.val(); // e.g. "2025-08"
			if (selectedValue) {
				if (this.df?.date_format === "month") {
					const parts = selectedValue.split("-");
					const year = parseInt(parts[0], 10);
					const month = parseInt(parts[1], 10); // 1-12
					if (!isNaN(year) && !isNaN(month)) {
						const lastDay = new Date(year, month, 0);
						const yyyy = String(lastDay.getFullYear());
						const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
						const dd = String(lastDay.getDate()).padStart(2, "0");
						const lastDayStr = `${yyyy}-${mm}-${dd}`;
						this.set_value(lastDayStr);
						return;
					}
				}
				this.set_value(selectedValue);
			} else {
				this.set_value("");
			}
		});
	}

	set_formatted_input(value) {
		if (this.df?.sva_date_range) {
			if (Array.isArray(value) && value.length === 2) {
				let v1 = frappe.datetime.str_to_user(value[0], false, true);
				let v2 = frappe.datetime.str_to_user(value[1], false, true);
				this.$input && this.$input.val(__("{0} to {1}", [v1, v2]));
			} else {
				this.$input && this.$input.val("");
			}
			return;
		}
		if (this.df?.date_format === "month") {
			let monthStr = "";
			if (typeof value === "string") {
				if (/^\d{4}-\d{2}$/.test(value)) {
					monthStr = value;
				} else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
					monthStr = value.slice(0, 7);
				} else {
					try {
						const sys = frappe.datetime.user_to_str(value, false);
						if (/^\d{4}-\d{2}-\d{2}$/.test(sys)) {
							monthStr = sys.slice(0, 7);
						}
					} catch (e) {
						console.error(e);
					}
				}
			} else if (value instanceof Date && !isNaN(value)) {
				const year = value.getFullYear();
				const month = String(value.getMonth() + 1).padStart(2, "0");
				monthStr = `${year}-${month}`;
			}

			if (!monthStr && value) {
				const date = new Date(value);
				if (!isNaN(date)) {
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, "0");
					monthStr = `${year}-${month}`;
				}
			}

			this.$input && this.$input.val(monthStr || "");
			// skip parent logic to avoid setting non-conforming values
			return;
		}
		return super.set_formatted_input(value);
	}
	validate(value) {
		if (this.df?.sva_date_range) {
			return value; // range values are arrays, skip string validation
		}
		if (this.df?.date_format != "month" && value && !frappe.datetime.validate(value)) {
			let sysdefaults = frappe.sys_defaults;
			let date_format =
				sysdefaults && sysdefaults.date_format ? sysdefaults.date_format : "yyyy-mm-dd";
			frappe.msgprint(__("Date {0} must be in format: {1}", [value, date_format]));
			return "";
		}
		// remove day, we need only yyyy-mm for month mode
		// if (this.df?.date_format == 'month' && value) {
		//     value = value.slice(0, 7);
		// }
		return value;
	}
};
