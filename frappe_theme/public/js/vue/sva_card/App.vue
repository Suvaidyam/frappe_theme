<template>
	<NumberCard
		v-for="(item, index) in cards"
		:card="item"
		:key="item.card_label"
		:delay="index * 200"
		:actions="actions"
	/>
</template>

<script setup>
import NumberCard from "./components/NumberCard.vue";
import { ref, onMounted } from "vue";

const actions = ref([{ label: "Refresh", action: "refresh" }]);

const props = defineProps({
	cards: {
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
