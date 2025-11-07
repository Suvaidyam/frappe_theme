<template>
	<Chart :chart="chart" :type="type" :actions="actions" />
</template>

<script setup>
import Chart from "./components/Chart.vue";
import { ref, onMounted } from "vue";

const actions = ref([{ label: "Refresh", action: "refresh" }]);

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
});
console.log(props.type);
onMounted(() => {
	if (frappe.session.user == "Administrator") {
		actions.value.push({ label: "Edit", action: "edit" });
	}
});
</script>
