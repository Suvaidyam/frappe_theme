<template>
	<Chart
		v-for="(item, index) in charts"
		:chart="item"
		:key="item.chart_label"
		:delay="index * 200"
		:actions="actions"
	/>
</template>

<script setup>
import Chart from "./components/Chart.vue";
import { ref, onMounted } from "vue";

const actions = ref([{ label: "Refresh", action: "refresh" }]);

const props = defineProps({
	charts: {
		type: Array,
		default: [],
	},
});
onMounted(() => {
	if (frappe.session.user == "Administrator") {
		actions.value.push({ label: "Edit", action: "edit" });
	}
});
</script>
