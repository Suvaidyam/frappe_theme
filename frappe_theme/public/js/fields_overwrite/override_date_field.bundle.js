frappe.ui.form.ControlDate = class extends frappe.ui.form.ControlDate {
	make_input() {
		super.make_input();
		// do not call this.make_picker() here; parent already calls it
	}

	make_picker() {
		if (this.df?.date_format && ["month"].includes(this.df?.date_format)) {
			this.make_month_picker();
		} else {
			super.make_picker();
		}
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
