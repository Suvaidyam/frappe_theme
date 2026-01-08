<template>
	<NumberCard
		v-for="(item, index) in cards"
		:card="item"
		:filters="filters"
		:key="item.card_label"
		:delay="index * 200"
		:actions="actions"
	/>
</template>

<script setup>
import NumberCard from "./components/NumberCard.vue";
import { ref, onMounted } from "vue";

const actions = ref([
	{ label: "View Table", action: "view_table" },
	{ label: "Refresh", action: "refresh" },
]);

const props = defineProps({
	cards: {
		type: Array,
		default: [],
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
});
onMounted(() => {
	if (frappe.session.user == "Administrator") {
		actions.value.push({ label: "Edit", action: "edit" });
	}
});
</script>
