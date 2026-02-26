<template>
	<div
		class="card mb-2 placeholder-chart"
		style="padding: 8px 8px 8px 12px; min-height: 344px"
		title="You do not have permission to view this data"
	>
		<div class="d-flex justify-content-between align-items-center">
			<span class="chart-title">No access</span>
			<span class="lock-icon" v-html="frappe.utils.icon('lock')"></span>
		</div>
		<div class="placeholder-body">
			<h4 class="na-text">NA</h4>
		</div>
	</div>
</template>
<script setup></script>
<style scoped>
h4 {
	margin-bottom: 0;
}

.placeholder-chart {
	opacity: 0.8;
}

.chart-title {
	font-size: 13px;
	color: #999999;
}

.lock-icon :deep(svg),
.lock-icon :deep(svg *),
.lock-icon :deep(svg use) {
	stroke: #999999 !important;
}

.placeholder-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 8px;
	height: 297px;
	background-color: #f8f9fa;
	margin-top: 10px;
}

.na-text {
	color: #999999;
	letter-spacing: 1px;
	font-size: 1.5rem;
}
</style>
