<template>
	<transition name="fade">
		<div v-if="showChart">
			<Skeleton v-if="loading" />
			<div v-else class="card mb-2" style="padding: 8px 8px 8px 12px; min-height: 344px">
				<div class="d-flex justify-content-between align-items-center">
					{{ chart.details.chart_name }}
					<div class="dropdown" v-if="actions.length">
						<span title="action" class="pointer d-flex justify-content-center align-items-center"
							id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
							...
						</span>
						<div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
							<a v-for="action in actions" :key="action.action" class="dropdown-item"
								@click="handleAction(action.action)">
								{{ action.label }}
							</a>
						</div>
					</div>
				</div>
				<div class="w-100 pt-2" v-if="data.labels.length">
					<Bar v-if="chart?.details?.type === 'Bar'" :data="data" :options="{ ...options, ...data?.options }"
						:height="400" />
					<Line v-if="chart?.details?.type === 'Line'" :data="data"
						:options="{ ...options, ...data?.options }" :height="400" />
					<Pie v-if="chart?.details?.type === 'Pie'" :data="data" :options="{ ...options, ...data?.options }"
						:height="400" />
					<Doughnut v-if="chart?.details?.type === 'Donut'" :data="data"
						:options="{ ...options, ...data?.options }" :height="400" />
				</div>
				<div class="frappe-theme-no-data" v-else>No data</div>
			</div>
		</div>
	</transition>
</template>
<!-- Used as Button & Heading Control -->
<script setup>
import Skeleton from "./Skeleton.vue";
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
	Filler
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import zoomPlugin from 'chartjs-plugin-zoom';
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
);

const props = defineProps({
	chart: {
		type: Object,
		default: {},
	},
	delay: {
		type: Number,
		default: 0,
	},
	actions: {
		type: Array,
		default: () => [{ label: "Refresh", action: "refresh" }],
	},
});

if (props.chart?.details?.custom_show_data_labels) {
	ChartJS.register(ChartDataLabels);
}

const loading = ref(true);
const showChart = ref(false);
const data = ref({
	labels: [],
	datasets: [{ data: [] }],
});

const options = ref({
	indexAxis: props.chart?.details?.custom_enable_row ? "y" : "x",
	scales: {
		y: {
			display: ["Pie", "Donut"].includes(props.chart?.details?.type) ? false : true,
			...(props.chart?.details?.custom_enable_row
				? {
					ticks: {
						minRotation: parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
						maxRotation: parseInt(props.chart?.details?.custom_rotate_values || 0) || 0
					}
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
							return frappe.utils.shorten_number(value);
						}
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
							return frappe.utils.shorten_number(value);
						}
					},
				}
				: {
					ticks: {
						minRotation: parseInt(props.chart?.details?.custom_rotate_values || 0) || 0,
						maxRotation: parseInt(props.chart?.details?.custom_rotate_values || 0) || 0
					}
				}),
		},
	},
	elements: {
		...(props.chart?.details?.type == "Line" && props.chart?.details?.custom__curved_area
			? {
				line: {
					tension: 0.4,
					cubicInterpolationMode: 'monotone',
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
			position: (props.chart?.details?.custom_legend_position?.toLowerCase() || "bottom"),
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
							return `${meta.label}: ${frappe.utils.shorten_number(value)}`;
						}
					}
				},
			},
		},
	},
});
console.log(options.value, 'options')
// const emit = defineEmits(['action-clicked']);

const handleAction = async (action) => {
	if (action == "refresh") {
		loading.value = true;
		await getCount();
	} else if (action == "edit") {
		frappe.set_route("Form", props.chart?.details?.doctype, props.chart?.details?.name);
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
