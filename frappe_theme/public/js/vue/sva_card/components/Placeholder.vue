<template>
	<div
		class="card mb-2 number-card placeholder-card"
		:style="getCardStyles"
		title="You do not have permission to view this data"
	>
		<div class="d-flex justify-content-between">
			<p
				class="text-truncate card-label"
				:style="`font-size: 11px; width: 90%; color: #999999`"
				:about="label"
			>
				{{ label }}
			</p>
			<span class="card-icon lock-icon" v-html="frappe.utils.icon('lock')"></span>
		</div>
		<div class="d-flex align-items-center" style="gap: 8px">
			<h4 class="card-value na-text">NA</h4>
			<span class="no-access-badge">No Access</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	label: {
		type: String,
		default: "Card Label",
	},
});
const getCardStyles = computed(() => {
	const styles = {
		padding: "12px",
		backgroundColor: "white",
	};
	return Object.entries(styles)
		.map(([key, value]) => {
			const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
			return `${cssKey}: ${value}`;
		})
		.join("; ");
});
</script>

<style scoped>
h4 {
	margin-bottom: 0px;
}

.placeholder-card {
	opacity: 0.8;
}

.na-text {
	color: #999999;
	letter-spacing: 1px;
}

.card-label {
	color: #999999;
}

.no-access-badge {
	background-color: #f8f9fa;
	color: #999999;
	font-size: 10px;
	padding: 2px 8px;
	border-radius: 999px;
	border: 1px solid #e0e0e0;
}

.lock-icon :deep(svg),
.lock-icon :deep(svg *),
.lock-icon :deep(svg use) {
	stroke: #999999 !important;
}
</style>
