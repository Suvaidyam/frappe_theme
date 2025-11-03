frappe.Chart = class _Chart extends frappe.Chart {
	constructor(wrapper, data) {
		super(wrapper, data);
		setTimeout(() => {
			if (this.legendArea) {
				let s = this.legendArea.ownerSVGElement,
					b = this.legendArea.getBBox();
				this.legendArea.setAttribute(
					"transform",
					`translate(${(s.clientWidth - b.width) / 2}, ${
						this.legendArea.transform.baseVal.getItem(0).matrix.f
					})`
				);
			}
		}, 1000);
	}
};

frappe.widget.widget_factory.chart = class ExtendedChart extends (
	frappe.widget.widget_factory.chart
) {
	constructor(opts) {
		super(opts);
	}
	get_chart_args() {
		let colors = this.get_chart_colors();
		let fieldtype, options;
		const chart_type_map = {
			Line: "line",
			Bar: "bar",
			Percentage: "percentage",
			Pie: "pie",
			Donut: "donut",
			Heatmap: "heatmap",
		};

		let max_slices = ["Pie", "Donut"].includes(this.chart_doc.type) ? 6 : 9;
		let chart_args = {
			data: this.data,
			type: chart_type_map[this.chart_doc.type],
			colors: colors,
			height: this.height,
			maxSlices: this.chart_doc.number_of_groups || max_slices,
			axisOptions: {
				xIsSeries: this.chart_doc.timeseries,
				shortenYAxisNumbers: 1,
			},
		};

		if (this.chart_doc.document_type) {
			let doctype_meta = frappe.get_meta(this.chart_doc.document_type);
			let field = doctype_meta.fields.find(
				(x) => x.fieldname == this.chart_doc.value_based_on
			);
			fieldtype = field?.fieldtype;
			options = field?.options;
		}
		if (this.chart_doc.chart_type == "Report" && this.report_result?.chart?.fieldtype) {
			fieldtype = this.report_result.chart.fieldtype;
			options = this.report_result.chart.options;
		}
		if (
			this.report_result?.columns?.find((x) =>
				["Currency", "Float", "Int", "Percent"].includes(x.fieldtype)
			)
		) {
			fieldtype = this.report_result?.columns?.find((x) =>
				["Currency", "Float", "Int", "Percent"].includes(x.fieldtype)
			).fieldtype;
		}

		if (this.chart_doc.chart_type == "Custom" && this.chart_doc.custom_options) {
			let chart_options = JSON.parse(this.chart_doc.custom_options);
			fieldtype = chart_options.fieldtype;
			options = chart_options.options;
		}
		chart_args.tooltipOptions = {
			formatTooltipY: (value) => {
				if (fieldtype == "Currency") {
					return frappe.utils.format_currency(value);
				} else if (fieldtype == "Float" || fieldtype == "Int") {
					return frappe.utils.shorten_number(value || 0, undefined, 2);
				} else if (fieldtype == "Percent") {
					return `${frappe.utils.shorten_number(value || 0, undefined, 2)}%`;
				} else {
					return frappe.format(
						value,
						{ fieldtype, options },
						{ always_show_decimals: true, inline: true }
					);
				}
			},
		};

		if (this.chart_doc.type == "Heatmap") {
			const heatmap_year = parseInt(
				this.selected_heatmap_year ||
					this.chart_settings.heatmap_year ||
					this.chart_doc.heatmap_year
			);
			chart_args.data.start = new Date(`${heatmap_year}-01-01`);
			chart_args.data.end = new Date(`${heatmap_year + 1}-01-01`);
		}

		let set_options = (options) => {
			let custom_options = JSON.parse(options);
			for (let key in custom_options) {
				if (
					typeof chart_args[key] === "object" &&
					typeof custom_options[key] === "object"
				) {
					chart_args[key] = Object.assign(chart_args[key], custom_options[key]);
				} else {
					chart_args[key] = custom_options[key];
				}
			}
		};

		if (this.custom_options) {
			set_options(this.custom_options);
		}

		if (this.chart_doc.custom_options) {
			set_options(this.chart_doc.custom_options);
		}

		return chart_args;
	}
};
