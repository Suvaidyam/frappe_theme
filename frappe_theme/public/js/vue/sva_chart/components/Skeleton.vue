<template>
	<div class="skeleton-card mb-2">
		<div class="skeleton-card-header">
			<div class="skeleton-card-header-title shimmer"></div>
			<div class="skeleton-card-header-actions shimmer"></div>
		</div>
		<div class="skeleton-card-body">
			<div class="skeleton-graph-container">
				<div class="skeleton-y-axis shimmer"></div>
				<div class="skeleton-graph-content">
					<div class="skeleton-graph-bars">
						<div class="skeleton-bar shimmer" v-for="n in 5" :key="n"></div>
					</div>
					<div class="skeleton-x-axis shimmer"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
// Component logic can be added here if needed
</script>

<style scoped>
.skeleton-card {
	width: 100%;
	min-height: 400px;
	background-color: #ffffff;
	border: 1px solid #e0e0e0;
	border-radius: 10px;
	padding: 16px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.skeleton-card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 24px;
}

.skeleton-card-header-title {
	width: 40%;
	height: 16px;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-card-header-actions {
	width: 20%;
	height: 16px;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-card-body {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.skeleton-graph-container {
	display: flex;
	gap: 16px;
	height: 270px;
}

.skeleton-y-axis {
	width: 2px;
	height: 100%;
	background-color: #f0f0f0;
	border-radius: 2px;
}

.skeleton-graph-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.skeleton-graph-bars {
	flex: 1;
	display: flex;
	align-items: flex-end;
	gap: 12px;
	padding-bottom: 8px;
}

.skeleton-bar {
	flex: 1;
	height: 80%;
	background-color: #f0f0f0;
	border-radius: 4px;
}

.skeleton-x-axis {
	width: 100%;
	height: 2px;
	background-color: #f0f0f0;
	border-radius: 2px;
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
