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
							...
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
				<div class="w-100 pt-2" v-if="props.chart.labels.length">
					<Bar
						v-if="props?.type === 'bar'"
						:data="props.chart"
						:options="options"
						:height="300"
					/>
					<Line
						v-if="props?.type === 'line'"
						:data="props.chart"
						:options="options"
						:height="300"
					/>
					<Pie v-if="props?.type === 'pie'" :data="props.chart" :options="options" />
					<Doughnut
						v-if="props?.type === 'donut'"
						:data="props.chart"
						:options="options"
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
import { ref } from "vue";
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
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "vue-chartjs";

// Register ChartJS components
ChartJS.register(
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	ArcElement,
	PointElement,
	LineElement
);

const loading = ref(true);
const showChart = ref(false);

const options = ref({
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		legend: {
			position: "bottom",
		},
	},
});

const props = defineProps({
	chart: {
		type: Object,
		default: {
			labels: [],
			datasets: [{ data: [] }],
		},
	},
	type: {
		type: String,
		default: "bar",
	},
	actions: {
		type: Array,
		default: () => [{ label: "Refresh", action: "refresh" }],
	},
});

// const emit = defineEmits(['action-clicked']);

const handleAction = async (action) => {
	if (action == "refresh") {
		loading.value = true;
		await getCount();
	} else if (action == "edit") {
		frappe.set_route("Form", props.chart?.details?.doctype, props.chart?.details?.name);
	}
};
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
