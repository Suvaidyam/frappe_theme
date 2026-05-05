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
			// Directly write to frm.doc on selection so Apply always has the value
			this.datepicker.update("onSelect", () => {
				if (this._dashboard_condition === "Between") {
					const dates = this.datepicker.selectedDates;
					if (dates.length === 2) {
						const d1 = moment(dates[0]).format("YYYY-MM-DD");
						const d2 = moment(dates[1]).format("YYYY-MM-DD");
						this.frm.doc[this.df.fieldname] = [d1, d2];
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
				this.datepicker.update("range", false);
				this.datepicker.clear();
				this.frm.doc[this.df.fieldname] = "";
			}
		});

		this.datepicker.$datepicker.prepend($select);
	}

	make_date_range_picker() {
		let lang = frappe.boot?.user?.language;
		let datepicker_options = {
			language: $.fn.datepicker.language?.[lang] ? lang : "en",
			range: true,
			autoClose: true,
			toggleSelected: false,
			firstDay: frappe.datetime.get_first_day_of_the_week_index(),
			dateFormat: frappe.boot.sysdefaults?.date_format || "yyyy-mm-dd",
			onSelect: () => {
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
