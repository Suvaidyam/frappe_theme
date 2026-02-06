<template>
	<transition name="fade">
		<div v-if="showChart">
			<Skeleton v-if="loading" />
			<div v-else class="card mb-2" style="padding: 8px 8px 8px 12px; min-height: 344px">
				<div class="d-flex justify-content-between align-items-center">
					{{ chart.details.chart_name }}
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
	</transition>
</template>
<!-- Used as Button & Heading Control -->
<script setup>
import Skeleton from "./Skeleton.vue";

import Loader from "../../../loader-element.js";
import SvaDataTable from "../../../datatable/sva_datatable.bundle.js";

import { ref, onMounted, inject } from "vue";
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
const showChart = ref(false);
const data = ref({
	labels: [],
	datasets: [{ data: [] }],
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
								return frappe.utils.shorten_number(
									value,
									frappe.sys_defaults.country
								);
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
								return frappe.utils.shorten_number(
									value,
									frappe.sys_defaults.country
								);
							},
						},
				  }
				: {
						ticks: {
							minRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
							maxRotation:
								parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
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
					let meta = ctx.raw.meta || {};
					let value = ctx?.raw?.y || 0;
					if (meta) {
						if (meta.fieldtype === "Currency") {
							return `${meta.label}: ${frappe.utils.format_currency(
								value,
								props.chart?.details?.currency
							)}`;
						} else if (meta.fieldtype === "Int" || meta.fieldtype === "Float") {
							return `${meta.label}: ${frappe.utils.shorten_number(
								value,
								frappe.sys_defaults.country
							)}`;
						}
					} else {
						return value;
					}
				},
			},
		},
		datalabels: {
			display: props.chart?.details?.custom_show_data_labels == 1 ? true : false,
			anchor: "center",
			align: "center",
			formatter: (v) => {
				let meta = v.meta || {};
				let value = v?.y || 0;
				if (meta) {
					if (meta.fieldtype === "Currency") {
						return `${frappe.utils.format_currency(
							value,
							props.chart?.details?.currency
						)}`;
					} else if (meta.fieldtype === "Int" || meta.fieldtype === "Float") {
						return `${frappe.utils.shorten_number(
							value,
							frappe.sys_defaults.country
						)}`;
					}
				} else {
					return value;
				}
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
// console.log(options.value, "options");
// const emit = defineEmits(['action-clicked']);

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

		let table_options = {
			label: "",
			wrapper,
			doctype: "",
			frm: props.frm || cur_frm,
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
			props.frm?.["dt_events"]?.[details.name]?.get_filters ||
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
				doctype: cur_frm.doc.doctype,
				docname: cur_frm.doc.name,
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
		showChart.value = true;
		await getCount();
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
	height: 297px;
	color: #6c757d;
	background-color: #f8f9fa;
	margin-top: 10px;
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>
