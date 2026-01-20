<template>
	<Chart
		v-for="(item, index) in charts"
		:chart="item"
		:filters="filters"
		:key="item.chart_label"
		:frm="frm"
		:delay="index * 200"
		:actions="actions"
	/>
</template>

<script setup>
import Chart from "./components/Chart.vue";
import { ref, onMounted } from "vue";

const actions = ref([
	{ label: "View Table", action: "view_table" },
	{ label: "Refresh", action: "refresh" },
]);

const props = defineProps({
	charts: {
		type: Array,
		default: [],
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
	frm: {
		type: Object,
		default: null,
	},
});
onMounted(() => {
	if (frappe.session.user == "Administrator") {
		actions.value.push({ label: "Edit", action: "edit" });
	}
});
</script>
