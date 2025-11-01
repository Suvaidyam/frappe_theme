<template>
	<div class="skeleton-card mb-2">
		<div class="skeleton-card-header">
			<div class="skeleton-card-header-title shimmer"></div>
			<div class="skeleton-card-header-actions shimmer"></div>
		</div>
		<div class="skeleton-card-body">
			<div class="skeleton-line shimmer"></div>
		</div>
	</div>
</template>

<script setup>
// Component logic can be added here if needed
</script>

<style scoped>
.skeleton-card {
	width: 100%;
	min-height: 66px;
	background-color: #ffffff;
	border: 1px solid #e0e0e0;
	border-radius: 10px;
	padding: 8px 8px 8px 12px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.skeleton-card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
}

.skeleton-card-header-title {
	width: 60%;
	height: 12px;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-card-header-actions {
	width: 30%;
	height: 12px;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-card-body {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.skeleton-line {
	width: 100%;
	height: 14px;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-line:nth-child(2) {
	width: 80%;
}

.skeleton-line:nth-child(3) {
	width: 90%;
}

@keyframes shimmer {
	0% {
		background-position: -1000px 0;
	}
	100% {
		background-position: 1000px 0;
	}
}

.shimmer {
	background: linear-gradient(to right, #f0f0f0 4%, #e0e0e0 25%, #f0f0f0 36%);
	background-size: 1000px 100%;
	animation: shimmer 2s infinite linear;
}
</style>
