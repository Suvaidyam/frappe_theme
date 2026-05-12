<template>
	<div class="sva-dl-overlay" @click.self="close">
		<div class="sva-dl-drawer">
			<div class="sva-dl-header">
				<span>{{ __("Deletion History") }}</span>
				<button class="sva-dl-close-btn" @click="close">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="sva-dl-tabs">
				<button :class="{ active: filter === 'all' }" @click="setFilter('all')">
					{{ __("All") }}
				</button>
				<button
					:class="{ active: filter === 'last_7_days' }"
					@click="setFilter('last_7_days')"
				>
					{{ __("Last 7 Days") }}
				</button>
			</div>

			<div class="sva-dl-body">
				<div v-if="loading" class="sva-dl-loading">
					<svg
						class="sva-dl-spinner"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#6b7280"
						stroke-width="2"
					>
						<path
							d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
						/>
					</svg>
					<span>{{ __("Loading...") }}</span>
				</div>

				<div v-else-if="!records.length" class="sva-dl-empty">
					<svg
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#d1d5db"
						stroke-width="1.5"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14H6L5 6" />
						<path d="M10 11v6M14 11v6" />
						<path d="M9 6V4h6v2" />
					</svg>
					<p>{{ __("No deleted records found") }}</p>
				</div>

				<div v-else>
					<div
						v-for="item in records"
						:key="item.deleted_name + item.creation"
						:class="['sva-dl-item', item.is_parent ? 'sva-dl-item--parent' : '']"
					>
						<!-- Header row: always visible -->
						<div class="sva-dl-item-header">
							<div
								:class="[
									'sva-dl-avatar',
									item.is_parent ? 'sva-dl-avatar--parent' : '',
								]"
							>
								{{ avatarLetter(item.deleted_by) }}
							</div>
							<div class="sva-dl-info">
								<div class="sva-dl-docname">
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#ef4444"
										stroke-width="2"
										style="flex-shrink: 0"
									>
										<polyline points="3 6 5 6 21 6" />
										<path d="M19 6l-1 14H6L5 6" />
										<path d="M10 11v6M14 11v6" />
										<path d="M9 6V4h6v2" />
									</svg>
									{{ __(item.deleted_doctype) }} &mdash; {{ item.deleted_name }}
									<span
										v-if="item.is_parent"
										class="sva-dl-tag sva-dl-tag--parent"
										>{{ __("This Document") }}</span
									>
									<span v-if="item.restored" class="sva-dl-tag">{{
										__("Restored")
									}}</span>
								</div>
								<div class="sva-dl-meta">
									{{ item.deleted_by || __("Unknown") }} &middot;
									{{ formatDate(item.creation) }}
								</div>
							</div>

							<!-- Expand / collapse toggle -->
							<button
								v-if="item.summary && item.summary.length"
								class="sva-dl-toggle"
								@click="toggleExpand(item)"
								:title="item._expanded ? __('Collapse') : __('Show details')"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									:style="{
										transform: item._expanded
											? 'rotate(180deg)'
											: 'rotate(0deg)',
										transition: 'transform 0.2s',
									}"
								>
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</button>
						</div>

						<!-- Collapsed preview: first 3 fields as inline pills -->
						<div
							v-if="!item._expanded && item.summary && item.summary.length"
							class="sva-dl-preview"
						>
							<span
								v-for="f in item.summary.slice(0, 3)"
								:key="f.label"
								class="sva-dl-pill"
							>
								<span class="sva-dl-pill-label">{{ f.label }}:</span>
								<span class="sva-dl-pill-value">{{ f.value }}</span>
							</span>
							<button
								v-if="item.summary.length > 3"
								class="sva-dl-show-more"
								@click="toggleExpand(item)"
							>
								+{{ item.summary.length - 3 }} {{ __("more") }}
							</button>
						</div>

						<!-- Expanded: full table -->
						<table
							v-if="item._expanded && item.summary && item.summary.length"
							class="sva-dl-table"
						>
							<thead>
								<tr>
									<th>{{ __("Field") }}</th>
									<th>{{ __("Value at Deletion") }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="f in item.summary" :key="f.label">
									<td>{{ f.label }}</td>
									<td>{{ f.value }}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from "vue";

const props = defineProps({ frm: { required: true } });

const filter = ref("all");
const records = ref([]);
const loading = ref(false);

const instance = getCurrentInstance();

const close = () => {
	instance.proxy.$el.dispatchEvent(new CustomEvent("dl-close", { bubbles: true }));
};

const fetchData = async () => {
	loading.value = true;
	try {
		const res = await frappe.call({
			method: "frappe_theme.api.get_deletion_log",
			args: {
				dt: props.frm.doctype,
				dn: props.frm.docname,
				date_filter: filter.value,
			},
		});
		// Add reactive _expanded flag to each record
		records.value = (res.message || []).map((r) => ({ ...r, _expanded: false }));
	} catch (e) {
		records.value = [];
	} finally {
		loading.value = false;
	}
};

const setFilter = (val) => {
	filter.value = val;
	fetchData();
};

const toggleExpand = (item) => {
	item._expanded = !item._expanded;
};

const avatarLetter = (name) => (name || "?")[0].toUpperCase();
const formatDate = (d) => frappe.datetime.global_date_format(d);

onMounted(fetchData);
</script>

<style scoped>
.sva-dl-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.35);
	z-index: 1050;
	display: flex;
	justify-content: flex-end;
}

.sva-dl-drawer {
	width: 440px;
	max-width: 100vw;
	background: #fff;
	height: 100vh;
	display: flex;
	flex-direction: column;
	box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
	animation: sva-dl-slide-in 0.25s ease;
}

@keyframes sva-dl-slide-in {
	from {
		transform: translateX(100%);
	}
	to {
		transform: translateX(0);
	}
}

.sva-dl-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 16px 20px;
	border-bottom: 1px solid #e5e7eb;
	font-weight: 600;
	font-size: 0.95rem;
	color: #111827;
}

.sva-dl-close-btn {
	background: none;
	border: none;
	cursor: pointer;
	color: #6b7280;
	display: flex;
	align-items: center;
	padding: 4px;
	border-radius: 4px;
	transition: background 0.15s;
}
.sva-dl-close-btn:hover {
	background: #f3f4f6;
	color: #111827;
}

.sva-dl-tabs {
	display: flex;
	gap: 8px;
	padding: 12px 20px;
	border-bottom: 1px solid #e5e7eb;
}

.sva-dl-tabs button {
	padding: 5px 16px;
	border-radius: 20px;
	border: 1px solid #e5e7eb;
	cursor: pointer;
	font-size: 0.8rem;
	background: #f3f4f6;
	color: #374151;
	transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.sva-dl-tabs button:hover {
	background: #e5e7eb;
}
.sva-dl-tabs button.active {
	background: #4f46e5;
	color: #fff;
	border-color: #4f46e5;
}

.sva-dl-body {
	flex: 1;
	overflow-y: auto;
	padding: 16px 20px;
}

.sva-dl-loading,
.sva-dl-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	color: #9ca3af;
	padding: 60px 0;
	font-size: 0.875rem;
}

@keyframes sva-dl-spin {
	to {
		transform: rotate(360deg);
	}
}
.sva-dl-spinner {
	animation: sva-dl-spin 1s linear infinite;
}

.sva-dl-item {
	border: 1px solid #e5e7eb;
	border-left: 3px solid #ef4444;
	border-radius: 8px;
	padding: 12px 14px;
	margin-bottom: 12px;
	background: #fff;
}
.sva-dl-item--parent {
	border-left-color: #7c3aed;
	background: #faf5ff;
}
.sva-dl-avatar--parent {
	background: #7c3aed;
}
.sva-dl-tag--parent {
	background: #ede9fe;
	color: #7c3aed;
	font-size: 0.7rem;
	padding: 1px 7px;
	border-radius: 4px;
	font-weight: 500;
}

.sva-dl-item-header {
	display: flex;
	gap: 10px;
	align-items: flex-start;
}

.sva-dl-avatar {
	width: 32px;
	height: 32px;
	background: #ef4444;
	color: #fff;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 0.85rem;
	flex-shrink: 0;
}

.sva-dl-info {
	flex: 1;
	min-width: 0;
}

.sva-dl-docname {
	display: flex;
	align-items: center;
	gap: 5px;
	font-weight: 600;
	font-size: 0.85rem;
	color: #111827;
	flex-wrap: wrap;
}

.sva-dl-meta {
	color: #6b7280;
	font-size: 0.76rem;
	margin-top: 3px;
}

.sva-dl-tag {
	background: #dcfce7;
	color: #16a34a;
	font-size: 0.7rem;
	padding: 1px 7px;
	border-radius: 4px;
	font-weight: 500;
}

/* Expand / collapse chevron button */
.sva-dl-toggle {
	background: none;
	border: none;
	cursor: pointer;
	color: #9ca3af;
	padding: 2px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	border-radius: 4px;
	transition: color 0.15s, background 0.15s;
	align-self: flex-start;
	margin-top: 2px;
}
.sva-dl-toggle:hover {
	color: #4f46e5;
	background: #f3f4f6;
}

/* Collapsed preview pills */
.sva-dl-preview {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 10px;
}

.sva-dl-pill {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	background: #f3f4f6;
	border-radius: 4px;
	padding: 3px 8px;
	font-size: 0.75rem;
	max-width: 100%;
}
.sva-dl-pill-label {
	color: #6b7280;
	white-space: nowrap;
}
.sva-dl-pill-value {
	color: #111827;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 160px;
}

.sva-dl-show-more {
	background: none;
	border: 1px dashed #d1d5db;
	border-radius: 4px;
	padding: 3px 8px;
	font-size: 0.75rem;
	color: #4f46e5;
	cursor: pointer;
	white-space: nowrap;
}
.sva-dl-show-more:hover {
	background: #eef2ff;
}

/* Expanded full table */
.sva-dl-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.78rem;
	margin-top: 10px;
}
.sva-dl-table th,
.sva-dl-table td {
	padding: 5px 8px;
	border: 1px solid #e5e7eb;
	text-align: left;
}
.sva-dl-table th {
	background: #f9fafb;
	font-weight: 600;
	color: #374151;
}
.sva-dl-table td {
	color: #4b5563;
}
</style>
