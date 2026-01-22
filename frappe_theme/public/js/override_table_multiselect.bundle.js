// frappe.ui.form.ControlTableMultiSelect = class SVAControlTableMultiSelect extends (
// 	frappe.ui.form.ControlTableMultiSelect
// ) {
// 	get_link_field() {
// 		if (!this._link_field) {
// 			const meta = frappe.get_meta(this.df.options);
// 			this._link_field =
// 				meta?.fields?.find((df) => df.fieldtype === "Link") ||
// 				this.df?.fields?.find((df) => df.fieldtype === "Link");
// 			if (!this._link_field) {
// 				throw new Error("Table MultiSelect requires a Table with atleast one Link field");
// 			}
// 		}
// 		return this._link_field;
// 	}
// 	set_pill_html(values) {
// 		const html = values.map((value) => this.get_pill_html(value)).join("");
// 		$(this.input_area).find(".tb-selected-value").remove();
// 		$(this.input_area).prepend(html);
// 	}
// };

frappe.form.formatters["TableMultiSelect"] = function (rows, df, options) {
	rows = rows || [];
	const meta = frappe.get_meta(df.options);
	const link_field =
		meta?.fields?.find((df) => df.fieldtype === "Link") ||
		df?.fields?.find((df) => df.fieldtype === "Link");
	const formatted_values = rows.map((row) => {
		const value = row[link_field.fieldname];
		return `<span class="text-nowrap">
				${frappe.format(value, link_field, options, row)}
			</span>`;
	});
	return formatted_values.join(", ");
};
