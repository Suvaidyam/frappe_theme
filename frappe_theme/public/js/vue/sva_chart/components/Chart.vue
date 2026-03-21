<template>
	<transition name="fade">
		<div v-if="showChart">
			<Skeleton v-if="loading" />
			<div v-else class="card mb-2" style="padding: 8px 8px 8px 12px; min-height: 344px">
				<div class="d-flex justify-content-between align-items-center">
					{{ chart?.label || chart?.details?.chart_name }}
					<div class="dropdown" v-if="actions.length">
						<span
							title="action"
							class="pointer d-flex justify-content-center align-items-center"
							id="dropdownMenuButton"
							data-toggle="dropdown"
							aria-haspopup="true"
							aria-expanded="false"
						>
							<svg class="icon icon-sm">
								<use href="#icon-dot-horizontal"></use>
							</svg>
						</span>
						<div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
							<a
								v-for="action in actions"
								:key="action.action"
								class="dropdown-item"
								@click="handleAction(action.action)"
							>
								{{ action.label }}
							</a>
						</div>
					</div>
				</div>
				<div class="w-100 pt-2" v-if="data.labels.length">
					<Bar
						v-if="chart?.details?.type === 'Bar'"
						:data="data"
						:options="{ ...options, ...data?.options }"
						:height="400"
					/>
					<Line
						v-if="chart?.details?.type === 'Line'"
						:data="data"
						:options="{ ...options, ...data?.options }"
						:height="400"
					/>
					<Pie
						v-if="chart?.details?.type === 'Pie'"
						:data="data"
						:options="{ ...options, ...data?.options }"
						:height="370"
						:style="{ padding: '15px 25px' }"
					/>
					<Doughnut
						v-if="chart?.details?.type === 'Donut'"
						:data="data"
						:options="{ ...options, ...data?.options }"
						:height="370"
						:style="{ padding: '15px 25px' }"
					/>
				</div>
				<div class="frappe-theme-no-data" v-else>No data</div>
			</div>
		</div>
		<Placeholder v-else />
	</transition>
</template>
<!-- Used as Button & Heading Control -->
<script setup>
import Skeleton from "./Skeleton.vue";
import Placeholder from "./Placeholder.vue";
import Loader from "../../../loader-element.js";
import SvaDataTable from "../../../datatable/sva_datatable.bundle.js";

import { ref, onMounted, inject, computed } from "vue";
import {
	Chart as ChartJS,
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	ArcElement,
	PointElement,
	LineElement,
	Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Line, Pie, Doughnut } from "vue-chartjs";

ChartJS.register(
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	ArcElement,
	PointElement,
	LineElement,
	Filler,
	ChartDataLabels
);

const props = defineProps({
	chart: {
		type: Object,
		default: {},
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
	delay: {
		type: Number,
		default: 0,
	},
	actions: {
		type: Array,
		default: () => [{ label: "Refresh", action: "refresh" }],
	},
	frm: {
		type: Object,
		default: null,
	},
});

const loading = ref(true);
const showChart = ref(true);
const data = ref({
	labels: [],
	datasets: [{ data: [] }],
});

const shorten_number = computed(() => {
	return props?.chart?.show_full_number ? false : true;
});

function getBWColor(hex) {
	if (!hex) return "#000";

	hex = hex.replace("#", "");

	// handle short hex (#fff)
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}

	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);

	// Relative luminance (WCAG)
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

	// threshold can be tuned (140–160 is sweet spot)
	return luminance > 150 ? "#000000" : "#ffffff";
}

const options = ref({
	indexAxis: props.chart?.details?.custom_enable_row ? "y" : "x",
	scales: {
		y: {
			display: ["Pie", "Donut"].includes(props.chart?.details?.type) ? false : true,
			...(props.chart?.details?.custom_enable_row
				? {
						ticks: {
							minRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
							maxRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
							autoSkip: false,
							callback: function (value, index, ticks) {
								const label = this.getLabelForValue(value);
								if (typeof label !== "string") return label;

								// Get chart width and calculate available space per label
								const chartWidth = this.chart.width || 800;
								const labelCount = ticks.length || 1;
								const availableWidth = chartWidth / labelCount;

								// Calculate max characters based on available width
								// Approximate: 8px per character at default font size
								const maxChars = Math.floor(availableWidth / 8) - 2;

								// Dynamic truncation based on screen size
								if (label.length > maxChars && maxChars > 10) {
									return label.substring(0, maxChars - 3) + "...";
								}

								return label;
							},
							maxTicksLimit: 20,
						},
				  }
				: {
						min: props.chart?.details?.custom_ymin || 0,
						max: props.chart?.details?.custom_ymax || undefined,
						stacked:
							props.chart?.details?.custom_stack &&
							!props.chart?.details?.custom_overlap
								? true
								: false,
						ticks: {
							callback: function (value) {
								return shorten_number.value
									? frappe.utils.shorten_number(
											value,
											frappe.sys_defaults.country
									  )
									: format_number(value || 0, null, 0);
							},
						},
				  }),
		},
		x: {
			display: ["Pie", "Donut"].includes(props.chart?.details?.type) ? false : true,
			...(props.chart?.details?.custom_enable_row
				? {
						min: props.chart?.details?.custom_ymin || 0,
						max: props.chart?.details?.custom_ymax || undefined,
						stacked:
							props.chart?.details?.custom_stack &&
							!props.chart?.details?.custom_overlap
								? true
								: false,
						ticks: {
							callback: function (value) {
								return shorten_number.value
									? frappe.utils.shorten_number(
											value,
											frappe.sys_defaults.country
									  )
									: format_number(value || 0, null, 0);
							},
						},
				  }
				: {
						ticks: {
							minRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
							maxRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
							autoSkip: false,
							callback: function (value, index, ticks) {
								const label = this.getLabelForValue(value);
								if (typeof label !== "string") return label;

								// Get chart width and calculate available space per label
								const chartWidth = this.chart.width || 800;
								const labelCount = ticks.length || 1;
								const availableWidth = chartWidth / labelCount;

								// Calculate max characters based on available width
								// Approximate: 8px per character at default font size
								const maxChars = Math.floor(availableWidth / 8) - 2;

								// Dynamic truncation based on screen size
								if (label.length > maxChars && maxChars > 10) {
									return label.substring(0, maxChars - 3) + "...";
								}

								return label;
							},
							maxTicksLimit: 20,
						},
				  }),
		},
	},
	elements: {
		...(props.chart?.details?.type == "Line" && props.chart?.details?.custom__curved_area
			? {
					line: {
						tension: 0.4,
						cubicInterpolationMode: "monotone",
					},
			  }
			: {}),
		...(props.chart?.details?.type == "Bar" && props.chart?.details?.custom_overlap
			? {
					bar: {
						barPercentage: 0.5,
						categoryPercentage: 0.5,
					},
			  }
			: {}),
	},
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		legend: {
			display: true,
			position: props.chart?.details?.custom_legend_position?.toLowerCase() || "bottom",
			labels: {
				usePointStyle: true,
				pointStyle: "rectRounded",
				...(props.chart?.details?.type == "Line" && props.chart?.details?.custom_show_area
					? {
							generateLabels: function (chart) {
								const labels =
									Chart.defaults.plugins.legend.labels.generateLabels(chart);
								labels.forEach((label) => {
									const dataset = chart.data.datasets[label.datasetIndex];
									label.fillStyle =
										dataset.borderColor || dataset.backgroundColor;
									label.strokeStyle =
										dataset.borderColor || dataset.backgroundColor;
									label.lineWidth = 0;
								});
								return labels;
							},
					  }
					: {}),
			},
		},
		tooltip: {
			callbacks: {
				label: (ctx) => {
					const isPieOrDonut = ["Pie", "Donut"].includes(props.chart?.details?.type);

					// For pie/donut charts, extract value and meta differently
					let value, meta;
					if (isPieOrDonut) {
						// Pie charts have value directly on ctx.raw
						const rawData = ctx.raw;
						meta = typeof rawData === "object" && rawData.meta ? rawData.meta : {};
						value =
							typeof rawData === "object" && rawData.y !== undefined
								? rawData.y
								: rawData;
					} else {
						// Bar/Line charts have structured data with y and meta
						meta = ctx.raw.meta || {};
						value = ctx?.raw?.y || 0;
					}

					if (meta && meta.fieldtype) {
						if (meta.fieldtype === "Currency") {
							return `${meta.label}: ${frappe.utils.format_currency(
								value,
								props.chart?.details?.currency,
								shorten_number.value
							)}`;
						} else if (meta.fieldtype === "Int" || meta.fieldtype === "Float") {
							return `${meta.label}: ${
								shorten_number.value
									? frappe.utils.shorten_number(
											value,
											frappe.sys_defaults.country
									  )
									: format_number(value || 0, null, 0)
							}`;
						}
					}
					return shorten_number.value
						? frappe.utils.shorten_number(
								value || 0,
								frappe.sys_defaults.country,
								null,
								0
						  )
						: format_number(value || 0, null, 0);
				},
			},
		},
		datalabels: {
			display: props.chart?.details?.custom_show_data_labels == 1 ? true : false,
			anchor: "center",
			align: "center",
			formatter: (v) => {
				const isPieOrDonut = ["Pie", "Donut"].includes(props.chart?.details?.type);

				// For pie/donut charts, extract value and meta differently
				let value, meta;
				if (isPieOrDonut) {
					// Pie charts have value directly
					meta = typeof v === "object" && v.meta ? v.meta : {};
					value = typeof v === "object" && v.y !== undefined ? v.y : v;
				} else {
					// Bar/Line charts have structured data with y and meta
					meta = v.meta || {};
					value = v?.y || 0;
				}

				if (meta && meta.fieldtype) {
					if (meta.fieldtype === "Currency") {
						return `${frappe.utils.format_currency(
							value,
							props.chart?.details?.currency,
							shorten_number.value
						)}`;
					} else if (meta.fieldtype === "Int" || meta.fieldtype === "Float") {
						return `${
							shorten_number.value
								? frappe.utils.shorten_number(value, frappe.sys_defaults.country)
								: format_number(value || 0, null, 0)
						}`;
					}
				}
				return shorten_number.value
					? frappe.utils.shorten_number(value || 0, frappe.sys_defaults.country, null, 0)
					: format_number(value || 0, null, 0);
			},
			color: (ctx) => {
				const dataset = ctx.chart.data.datasets[ctx.datasetIndex];
				const bg = Array.isArray(dataset.backgroundColor)
					? dataset.backgroundColor[ctx.dataIndex]
					: dataset.backgroundColor;

				return getBWColor(bg);
			},
		},
	},
});

const handleAction = async (action) => {
	if (action == "refresh") {
		loading.value = true;
		await getCount();
	} else if (action == "edit") {
		frappe.set_route("Form", props.chart?.details?.doctype, props.chart?.details?.name);
	} else if (action == "view_table") {
		const wrapper = document.createElement("div");
		let loader = new Loader(wrapper);
		loader.show();

		let pre_filters = {};
		if (props.frm) {
			if (
				props.frm?.["dt_events"]?.[props.chart?.details?.name]?.get_filters ||
				props.frm?.["dt_events"]?.[props?.chart?.html_field]?.get_filters
			) {
				let get_filters =
					props.frm?.["dt_events"]?.[props.chart?.details?.name]?.get_filters ||
					props.frm?.["dt_events"]?.[props?.chart?.html_field]?.get_filters;
				pre_filters =
					(await get_filters(
						props.chart?.details,
						props.frm || {},
						props?.chart?.html_field
					)) || {};
			}
		}

		let table_options = {
			label: "",
			wrapper,
			doctype: "",
			frm: Object.assign(
				{
					dt_events: {},
				},
				props.frm || cur_frm
			),
			connection: {
				crud_permissions: JSON.stringify(["read"]),
			},
			childLinks: [],
			options: {
				serialNumberColumn: true,
				editable: false,
			},
			loader,
		};

		if (props?.chart?.html_field) {
			table_options.connection["html_field"] = props.chart.html_field;
			table_options.connection["configuration_basis"] = "Property Setter";
		}

		if (props.chart?.listview_settings) {
			table_options.connection["listview_settings"] = props.chart.listview_settings;
		}

		if (props.chart?.details?.chart_type == "Report") {
			table_options.connection["link_report"] = props.chart.details?.report_name;
			table_options.connection["connection_type"] = "Report";
			table_options.frm.dt_events = {
				[props.chart.details?.report_name]: {
					get_filters: () => {
						return { ...(props.filters || {}), ...pre_filters };
					},
				},
			};
		} else {
			table_options.doctype = props.chart.details?.document_type;
			if (cur_frm.doctype) {
				let confs = await frappe.xcall("frappe_theme.dt_api.get_connection_type_confs", {
					doctype: props.chart.details?.document_type,
					ref_doctype: cur_frm.doctype,
				});
				if (confs) {
					Object.assign(table_options.connection, confs);
				} else {
					table_options.connection["connection_type"] = "Unfiltered";
				}
			} else {
				table_options.connection["connection_type"] = "Unfiltered";
			}
			table_options.frm.dt_events = {
				[props.chart.details?.document_type]: {
					get_filters: () => {
						return { ...(props.filters || {}) };
					},
				},
			};
		}

		let dialog = new frappe.ui.Dialog({
			title:
				props.chart?.details?.report_name ||
				props.chart?.details?.document_type ||
				"Data Table",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "data_table_html",
					options: `<div>Table Loading...</div>`,
				},
			],
			size: "extra-large",
			primary_action_label: "Close",
			primary_action: function () {
				dialog.hide();
			},
		});
		dialog.show();
		dialog.set_df_property("data_table_html", "options", wrapper);

		new SvaDataTable(table_options);
	}
};

const getCount = async () => {
	let type = "Report";
	let details = {};
	let report = {};
	if (props.chart.report) {
		type = "Report";
		details = props.chart.details;
		report = props.chart.report;
	} else {
		type = "Document Type";
		details = props.chart.details;
	}
	let pre_filters = {};
	if (props.frm) {
		if (
			props.frm?.["dt_events"]?.[details?.name]?.get_filters ||
			props.frm?.["dt_events"]?.[props?.chart?.html_field]?.get_filters
		) {
			let get_filters =
				props.frm?.["dt_events"]?.[details.name]?.get_filters ||
				props.frm?.["dt_events"]?.[props?.chart?.html_field]?.get_filters;
			pre_filters =
				(await get_filters(details, props.frm || {}, props?.chart?.html_field)) || {};
		}
	}
	try {
		loading.value = true;
		let res = await frappe.call({
			method: "frappe_theme.dt_api.get_chart_data",
			args: {
				type: type,
				details: details,
				report: report,
				doctype: cur_frm?.doc?.doctype,
				docname: cur_frm?.doc?.name,
				filters: { ...(props.filters || {}), ...pre_filters },
			},
		});
		if (res.message) {
			data.value = res.message.data;
			setTimeout(() => {
				loading.value = false;
			}, 500);
		}
	} catch (error) {
		console.error(error);
		loading.value = false;
	}
};

onMounted(async () => {
	// Initial delay based on card position
	setTimeout(async () => {
		showChart.value = props?.chart?.is_permitted ? true : false;
		if (showChart.value) {
			await getCount();
		}
	}, props.delay);
});
</script>
<style lang="scss" scoped>
h4 {
	margin-bottom: 0px;
}

.pointer {
	cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.frappe-theme-no-data {
	height: 398px;
	color: #6c757d;
	background-color: #f8f9fa;
	margin-top: 10px;
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>
