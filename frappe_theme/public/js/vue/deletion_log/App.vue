<template>
	<div class="sva-dl-overlay" @click.self="close" :style="{ '--dl-primary': primaryColor }">
		<div class="sva-dl-drawer">
			<!-- ── Header ─────────────────────────────────────────────────── -->
			<div class="sva-dl-header">
				<div class="sva-dl-header-left">
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#ef4444"
						stroke-width="2.2"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14H6L5 6" />
						<path d="M10 11v6M14 11v6" />
						<path d="M9 6V4h6v2" />
					</svg>
					<span>{{ __("Deletion History") }}</span>
				</div>
				<button class="sva-dl-close-btn" @click="close">
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- ── Purge warning banner ──────────────────────────────────── -->
			<div v-if="!alwaysShow" class="sva-dl-purge-banner">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="flex-shrink: 0; margin-top: 1px"
				>
					<path
						d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
					/>
					<line x1="12" y1="9" x2="12" y2="13" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
				<span>{{ __("Deleted records are automatically purged after 180 days.") }}</span>
			</div>

			<!-- ── Date filter ────────────────────────────────────────────── -->
			<div class="sva-dl-date-bar">
				<button
					:class="['sva-dl-date-btn', { active: dateFilter === 'all' }]"
					@click="setDateFilter('all')"
				>
					{{ __("All Time") }}
				</button>
				<button
					:class="['sva-dl-date-btn', { active: dateFilter === 'last_7_days' }]"
					@click="setDateFilter('last_7_days')"
				>
					{{ __("Last 7 Days") }}
				</button>
				<button
					class="sva-dl-refresh-btn"
					:class="{ spinning: loading }"
					:disabled="loading"
					@click="fetchData"
					:title="__('Refresh')"
				>
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="23 4 23 10 17 10" />
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
			</div>

			<!-- ── Doctype chips ──────────────────────────────────────────── -->
			<div class="sva-dl-chips-bar">
				<Transition name="dl-fade" mode="out-in">
					<!-- Skeleton chips while loading -->
					<div v-if="loading" key="chips-skel" class="sva-dl-chips-scroll">
						<div v-for="i in 5" :key="i" class="sva-dl-skel sva-dl-skel-chip"></div>
					</div>
					<!-- Real chips -->
					<div v-else key="chips-real" class="sva-dl-chips-scroll">
						<button
							:class="['sva-dl-chip', { active: doctypeFilter === '' }]"
							@click="setDoctypeFilter('')"
						>
							{{ __("All Records") }}
							<span class="sva-dl-chip-badge">{{ allRecords.length }}</span>
						</button>
						<button
							v-for="(d, idx) in doctypes.filter(
								(d) => (countByDoctype[d.value] || 0) > 0
							)"
							:key="d.value"
							:class="['sva-dl-chip', { active: doctypeFilter === d.value }]"
							:style="
								doctypeFilter === d.value
									? {
											background: chipColor(idx),
											borderColor: chipColor(idx),
											color: '#fff',
									  }
									: {}
							"
							@click="setDoctypeFilter(d.value)"
						>
							{{ __(d.label) }}
							<span class="sva-dl-chip-badge">{{
								countByDoctype[d.value] || 0
							}}</span>
						</button>
					</div>
				</Transition>
			</div>

			<!-- ── Body ──────────────────────────────────────────────────── -->
			<div ref="bodyEl" class="sva-dl-body" @scroll.passive="onBodyScroll">
				<Transition name="dl-fade" mode="out-in">
					<!-- Skeleton cards while loading -->
					<div v-if="loading" key="body-skel" class="sva-dl-skeletons">
						<div v-for="i in 6" :key="i" class="sva-dl-skel-card">
							<div class="sva-dl-skel-card-top">
								<div class="sva-dl-skel sva-dl-skel-avatar"></div>
								<div class="sva-dl-skel-lines">
									<div
										class="sva-dl-skel sva-dl-skel-line"
										style="width: 62%"
									></div>
									<div
										class="sva-dl-skel sva-dl-skel-line"
										style="width: 38%; margin-top: 7px"
									></div>
								</div>
							</div>
							<div class="sva-dl-skel-pills-row">
								<div class="sva-dl-skel sva-dl-skel-pill-sm"></div>
								<div class="sva-dl-skel sva-dl-skel-pill-sm"></div>
								<div class="sva-dl-skel sva-dl-skel-pill-sm"></div>
							</div>
						</div>
					</div>

					<!-- Empty -->
					<div v-else-if="!records.length" key="body-empty" class="sva-dl-empty">
						<div class="sva-dl-empty-icon">
							<svg
								width="36"
								height="36"
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
						</div>
						<p>{{ __("No deleted records found") }}</p>
					</div>

					<!-- Date-grouped records -->
					<div v-else key="body-content">
						<div
							v-for="group in groupedRecords"
							:key="group.date"
							class="sva-dl-date-group"
						>
							<!-- Date section header -->
							<div class="sva-dl-date-header">
								<div class="sva-dl-date-label">
									{{ group.displayDate }}
									<span v-if="group.isRecent" class="sva-dl-recent-dot"
										>· {{ __("Recent") }}</span
									>
								</div>
								<span class="sva-dl-group-count">
									{{ group.items.length }}&thinsp;{{
										group.items.length === 1 ? __("deletion") : __("deletions")
									}}
								</span>
							</div>

							<!-- Cards -->
							<div
								v-for="(item, idx) in group.items"
								:key="item.deleted_name + item.creation"
								class="sva-dl-card"
								:style="{
									borderLeftColor: cardBorderColor(item),
									'--dl-i': cardIndexMap[item.deleted_name + item.creation],
								}"
							>
								<!-- Top row: avatar + info + toggle -->
								<div class="sva-dl-card-top">
									<div
										class="sva-dl-avatar"
										:style="{ background: cardBorderColor(item) }"
									>
										{{ avatarLetter(item.deleted_by) }}
									</div>

									<div class="sva-dl-card-main">
										<!-- Title -->
										<div class="sva-dl-card-title">
											<!-- Deleted badge (all types) -->
											<span class="sva-dl-del-badge">
												<svg
													width="9"
													height="9"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
												>
													<polyline points="3 6 5 6 21 6" />
													<path d="M19 6l-1 14H6L5 6" />
												</svg>
												{{ __("DELETED") }}
											</span>
											<strong class="sva-dl-dt-name">{{
												__(item.deleted_doctype)
											}}</strong>
											<span class="sva-dl-sep">·</span>
											<span class="sva-dl-doc-id">{{
												item.deleted_name
											}}</span>
											<span
												v-if="item.is_parent"
												class="sva-dl-tag sva-dl-tag--parent"
												>{{ __("This Document") }}</span
											>
											<span
												v-if="item.restored"
												class="sva-dl-tag sva-dl-tag--restored"
												>{{ __("Restored") }}</span
											>
										</div>

										<!-- Meta: user · clock · date · ago -->
										<div class="sva-dl-card-meta">
											<span class="sva-dl-user-name">{{
												item.deleted_by || __("Unknown")
											}}</span>
											<span class="sva-dl-meta-dot">·</span>
											<svg
												width="11"
												height="11"
												viewBox="0 0 24 24"
												fill="none"
												stroke="#9ca3af"
												stroke-width="2"
												style="flex-shrink: 0; margin-top: 1px"
											>
												<circle cx="12" cy="12" r="10" />
												<polyline points="12 6 12 12 16 14" />
											</svg>
											<span class="sva-dl-meta-time">{{
												formatDate(item.creation)
											}}</span>
											<span class="sva-dl-meta-dot">·</span>
											<span class="sva-dl-meta-ago">{{
												timeAgo(item.creation)
											}}</span>
										</div>
									</div>

									<!-- Collapse / Details toggle -->
									<button
										v-if="item._summary === null || item._summary.length > 0"
										:class="[
											'sva-dl-toggle-btn',
											{ 'is-expanded': item._expanded },
											{ 'is-loading': item._loadingDetail },
										]"
										:disabled="item._loadingDetail"
										@click="toggleExpand(item)"
									>
										<svg
											v-if="item._loadingDetail"
											class="sva-dl-detail-spin"
											width="11"
											height="11"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<path
												d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
											/>
										</svg>
										<span v-if="!item._loadingDetail">{{
											item._expanded ? __("Collapse") : __("Details")
										}}</span>
										<svg
											v-if="!item._loadingDetail"
											width="11"
											height="11"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											:style="{
												transform: item._expanded
													? 'rotate(180deg)'
													: 'rotate(0deg)',
												transition: 'transform .2s',
											}"
										>
											<polyline points="6 9 12 15 18 9" />
										</svg>
									</button>
								</div>

								<!-- Reason box (if summary has a "reason" field) -->
								<div v-if="reasonOf(item)" class="sva-dl-reason-box">
									<span class="sva-dl-reason-label">{{ __("Reason") }}</span>
									<span class="sva-dl-reason-sep">·</span>
									<span class="sva-dl-reason-text">{{ reasonOf(item) }}</span>
								</div>

								<!-- Content preview block (Text Editor / HTML fields) -->
								<div v-if="contentPreviewOf(item)" class="sva-dl-content-preview">
									{{ contentPreviewOf(item) }}
								</div>

								<!-- Collapsed: field pills (excludes content-preview fields) -->
								<div
									v-if="!item._expanded && pillsOf(item).length"
									class="sva-dl-pills"
								>
									<span
										v-for="f in pillsOf(item).slice(0, 4)"
										:key="f.label"
										class="sva-dl-pill"
									>
										<span class="sva-dl-pill-label">{{ f.label }}</span>
										<span class="sva-dl-pill-value">{{ f.value }}</span>
									</span>
									<button
										v-if="pillsOf(item).length > 4"
										class="sva-dl-more-btn"
										@click="toggleExpand(item)"
									>
										+ {{ pillsOf(item).length - 4 }}&nbsp;{{
											__("more fields")
										}}
									</button>
								</div>

								<!-- Expanded: full table -->
								<table
									v-if="item._expanded && item._summary && item._summary.length"
									class="sva-dl-table"
								>
									<thead>
										<tr>
											<th>{{ __("Field") }}</th>
											<th>{{ __("Value at Deletion") }}</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="f in item._summary" :key="f.label">
											<td>{{ f.label }}</td>
											<td>{{ f.value }}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
						<!-- Load-more trigger -->
						<div class="sva-dl-load-more">
							<div v-if="loadingMore" class="sva-dl-load-more-spinner">
								<svg
									class="sva-dl-lm-spin"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="#9ca3af"
									stroke-width="2"
								>
									<path
										d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
									/>
								</svg>
								<span>{{ __("Loading more…") }}</span>
							</div>
							<button
								v-else-if="hasMore"
								class="sva-dl-load-more-btn"
								@click="loadMore"
							>
								{{ __("Load More") }}
							</button>
						</div>
					</div>
				</Transition>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from "vue";

const props = defineProps({ frm: { required: true } });

const primaryColor = computed(() => frappe.boot?.my_theme?.navbar_color || "#111827");

const PAGE_LENGTH = 30;

const dateFilter = ref("all");
const doctypeFilter = ref("");
const doctypes = ref([]);
const allRecords = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const cursor = ref("");
const loadingDoctypes = ref(true);
const alwaysShow = ref(true);
const bodyEl = ref(null);

const instance = getCurrentInstance();

const close = () => {
	instance.proxy.$el.dispatchEvent(new CustomEvent("dl-close", { bubbles: true }));
};

// ── Derived ────────────────────────────────────────────────────────────────

const records = computed(() =>
	doctypeFilter.value
		? allRecords.value.filter((r) => r.deleted_doctype === doctypeFilter.value)
		: allRecords.value
);

const countByDoctype = computed(() => {
	const m = {};
	for (const r of allRecords.value) m[r.deleted_doctype] = (m[r.deleted_doctype] || 0) + 1;
	return m;
});

const groupedRecords = computed(() => {
	const groups = {};
	for (const item of records.value) {
		const date = item.creation.substring(0, 10);
		(groups[date] ??= []).push(item);
	}
	const today = new Date().toISOString().substring(0, 10);
	return Object.entries(groups)
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, items]) => ({
			date,
			displayDate: formatGroupDate(date),
			isRecent: date === today,
			items,
		}));
});

// Global card index for stagger delay (mirrors list_view.js idx * 35ms)
const cardIndexMap = computed(() => {
	const m = {};
	let i = 0;
	for (const group of groupedRecords.value) {
		for (const item of group.items) {
			m[item.deleted_name + item.creation] = i++;
		}
	}
	return m;
});

// ── Colors ─────────────────────────────────────────────────────────────────

const PALETTE = ["#991b1b", "#92400e", "#065f46", "#1e40af", "#b45309", "#0e7490", "#5b21b6"];

const cardBorderColor = (item) => {
	if (item.deleted_doctype === "File") return "#0284c7";
	if (item.deleted_doctype === "Notes") return "#059669";
	if (item.is_parent) return primaryColor.value;
	const idx = doctypes.value.findIndex((d) => d.value === item.deleted_doctype);
	return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
};

const chipColor = (idx) => PALETTE[idx % PALETTE.length];

// ── Summary helpers ─────────────────────────────────────────────────────────

/** Extract the "reason" field value from summary (case-insensitive label match). */
const reasonOf = (item) => {
	if (!item._summary) return null;
	const f = item._summary.find((f) => /reason/i.test(f.label));
	return f ? f.value : null;
};

const _HTML_FIELD_TYPES = new Set(["Text Editor", "HTML Editor", "Long Text", "Small Text"]);

/**
 * Return the first rich-text / HTML field value from summary for inline preview.
 * The backend already strips HTML tags, so this is plain text.
 */
const contentPreviewOf = (item) => {
	if (!item._summary) return null;
	const f = item._summary.find((f) => _HTML_FIELD_TYPES.has(f.fieldtype));
	return f ? f.value : null;
};

/** All summary fields excluding reason and content-preview fields (shown separately). */
const pillsOf = (item) => {
	if (!item._summary) return [];
	return item._summary.filter(
		(f) => !/reason/i.test(f.label) && !_HTML_FIELD_TYPES.has(f.fieldtype)
	);
};

// ── API ─────────────────────────────────────────────────────────────────────

const fetchDoctypes = async () => {
	loadingDoctypes.value = true;
	try {
		const res = await frappe.call({
			method: "frappe_theme.apis.deletion_log.get_deletion_log_doctypes",
			args: { dt: props.frm.doctype },
		});
		const msg = res.message || {};
		doctypes.value = msg.doctypes || [];
		alwaysShow.value = msg.always_show !== false;
	} catch {
		doctypes.value = [];
		alwaysShow.value = true;
	} finally {
		loadingDoctypes.value = false;
	}
};

const _mapRecord = (r) => ({ ...r, _expanded: false, _summary: null, _loadingDetail: false });

const fetchData = async (reset = true) => {
	if (reset) {
		loading.value = true;
		cursor.value = "";
		allRecords.value = [];
	} else {
		loadingMore.value = true;
	}
	try {
		const res = await frappe.call({
			method: "frappe_theme.apis.deletion_log.get_deletion_log",
			args: {
				dt: props.frm.doctype,
				dn: props.frm.docname,
				date_filter: dateFilter.value,
				doctype_filter: "",
				page_length: PAGE_LENGTH,
				cursor: cursor.value,
			},
		});
		const msg = res.message || {};
		const newRecords = (msg.records || []).map(_mapRecord);
		if (reset) {
			allRecords.value = newRecords;
		} else {
			allRecords.value.push(...newRecords);
		}
		hasMore.value = msg.has_more || false;
		cursor.value = msg.cursor || "";
	} catch {
		if (reset) allRecords.value = [];
		hasMore.value = false;
	} finally {
		loading.value = false;
		loadingMore.value = false;
	}
};

const loadMore = () => {
	if (!loadingMore.value && hasMore.value) fetchData(false);
};

const onBodyScroll = () => {
	if (!bodyEl.value || !hasMore.value || loadingMore.value || loading.value) return;
	const el = bodyEl.value;
	if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) loadMore();
};

const setDateFilter = (val) => {
	dateFilter.value = val;
	fetchData(true);
};
const setDoctypeFilter = (val) => {
	doctypeFilter.value = val;
};
const toggleExpand = async (item) => {
	if (item._expanded) {
		item._expanded = false;
		return;
	}
	if (item._summary !== null) {
		item._expanded = true;
		return;
	}
	item._loadingDetail = true;
	try {
		const res = await frappe.call({
			method: "frappe_theme.apis.deletion_log.get_deletion_log_detail",
			args: {
				name: item.dd_name,
				deleted_doctype: item.deleted_doctype,
				fields_to_skip: JSON.stringify(item.fields_to_skip || []),
			},
		});
		item._summary = res.message || [];
	} catch {
		item._summary = [];
	} finally {
		item._loadingDetail = false;
		item._expanded = true;
	}
};

// ── Formatters ────────────────────────────────────────────────────────────

const avatarLetter = (name) => (name || "?")[0].toUpperCase();
const formatDate = (d) => frappe.datetime.global_date_format(d);

const timeAgo = (d) => {
	const diff = Math.floor((Date.now() - new Date(d)) / 1000);
	if (diff < 60) return __("just now");
	if (diff < 3600) return Math.floor(diff / 60) + " " + __("minutes ago");
	if (diff < 86400) return Math.floor(diff / 3600) + " " + __("hours ago");
	if (diff < 604800) return Math.floor(diff / 86400) + " " + __("days ago");
	if (diff < 2592000) return Math.floor(diff / 604800) + " " + __("weeks ago");
	if (diff < 31536000) return Math.floor(diff / 2592000) + " " + __("months ago");
	return Math.floor(diff / 31536000) + " " + __("years ago");
};

const formatGroupDate = (dateStr) => {
	const d = new Date(dateStr + "T00:00:00");
	const day = d.getDate();
	const month = d.toLocaleDateString("en-GB", { month: "long" });
	const year = d.getFullYear();
	const sfx = ["th", "st", "nd", "rd"];
	const v = day % 100;
	const suffix = sfx[(v - 20) % 10] || sfx[v] || sfx[0];
	return `${day}${suffix} ${month} ${year}`;
};

onMounted(async () => {
	loading.value = true;
	await fetchDoctypes();
	await fetchData();
});

onUnmounted(() => {
	if (bodyEl.value) bodyEl.value.removeEventListener("scroll", onBodyScroll);
});
</script>

<style scoped>
/* ── Overlay & Drawer ─────────────────────────────────────────────────────── */
.sva-dl-overlay {
	position: fixed;
	inset: 0;
	background: rgba(15, 15, 25, 0.35);
	z-index: 1050;
	display: flex;
	justify-content: flex-end;
}
.sva-dl-drawer {
	width: 620px;
	max-width: 100vw;
	background: #f3f4f6;
	height: 100vh;
	display: flex;
	flex-direction: column;
	box-shadow: -8px 0 40px rgba(0, 0, 0, 0.16);
	animation: dl-slide 0.26s cubic-bezier(0.22, 0.68, 0, 1.2);
}
@keyframes dl-slide {
	from {
		transform: translateX(100%);
		opacity: 0;
	}
	to {
		transform: translateX(0);
		opacity: 1;
	}
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.sva-dl-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 13px 20px;
	background: #fff;
	border-bottom: 1px solid #e5e7eb;
}
.sva-dl-header-left {
	display: flex;
	align-items: center;
	gap: 7px;
	font-weight: 700;
	font-size: 0.9rem;
	color: #111827;
}
.sva-dl-close-btn {
	background: none;
	border: none;
	cursor: pointer;
	color: #9ca3af;
	padding: 5px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	transition: background 0.15s, color 0.15s;
}
.sva-dl-close-btn:hover {
	background: #f3f4f6;
	color: #374151;
}

/* ── Date filter bar ─────────────────────────────────────────────────────── */
.sva-dl-date-bar {
	display: flex;
	gap: 6px;
	padding: 9px 20px;
	background: #fff;
	border-bottom: 1px solid #e5e7eb;
}
.sva-dl-date-btn {
	padding: 4px 14px;
	border-radius: 20px;
	border: 1px solid #e5e7eb;
	cursor: pointer;
	font-size: 0.77rem;
	font-weight: 500;
	background: #f9fafb;
	color: #374151;
	transition: all 0.15s;
}
.sva-dl-date-btn:hover {
	background: #f3f4f6;
}
.sva-dl-date-btn.active {
	background: var(--dl-primary);
	color: #fff;
	border-color: var(--dl-primary);
}
.sva-dl-refresh-btn {
	margin-left: auto;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	border-radius: 6px;
	border: 1px solid #e5e7eb;
	background: #f9fafb;
	color: #6b7280;
	cursor: pointer;
	flex-shrink: 0;
	transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.sva-dl-refresh-btn:hover:not(:disabled) {
	background: #f3f4f6;
	color: #111827;
	border-color: #d1d5db;
}
.sva-dl-refresh-btn:disabled {
	cursor: not-allowed;
	opacity: 0.5;
}
.sva-dl-refresh-btn.spinning svg {
	animation: dl-spin 0.7s linear infinite;
}

/* ── Purge warning banner ─────────────────────────────────────────────────── */
.sva-dl-purge-banner {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	padding: 9px 20px;
	background: #fffbeb;
	border-bottom: 1px solid #fde68a;
	color: #92400e;
	font-size: 0.76rem;
	line-height: 1.5;
}
.sva-dl-purge-banner svg {
	color: #d97706;
	margin-top: 1px;
}
.sva-dl-purge-banner strong {
	font-weight: 700;
}

/* ── Chips bar ───────────────────────────────────────────────────────────── */
.sva-dl-chips-bar {
	padding: 9px 20px;
	background: #fff;
	border-bottom: 1px solid #e5e7eb;
}
.sva-dl-chips-scroll {
	display: flex;
	gap: 6px;
	overflow-x: auto;
	scrollbar-width: none;
}
.sva-dl-chips-scroll::-webkit-scrollbar {
	display: none;
}

.sva-dl-chip {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 12px;
	border-radius: 20px;
	border: 1px solid #e5e7eb;
	cursor: pointer;
	font-size: 0.77rem;
	font-weight: 500;
	background: #f9fafb;
	color: #374151;
	white-space: nowrap;
	flex-shrink: 0;
	transition: all 0.15s;
}
.sva-dl-chip:hover {
	background: #f3f4f6;
	border-color: #d1d5db;
}
.sva-dl-chip.active {
	background: var(--dl-primary);
	color: #fff;
	border-color: var(--dl-primary);
}

.sva-dl-chip-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 18px;
	height: 18px;
	padding: 0 5px;
	border-radius: 10px;
	font-size: 0.68rem;
	font-weight: 700;
	background: rgba(0, 0, 0, 0.09);
	color: inherit;
}
.sva-dl-chip.active .sva-dl-chip-badge {
	background: rgba(255, 255, 255, 0.22);
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.sva-dl-body {
	flex: 1;
	overflow-y: auto;
	padding: 14px 16px 28px;
}

/* ── Vue transitions ─────────────────────────────────────────────────────── */
.dl-fade-enter-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}
.dl-fade-leave-active {
	transition: opacity 0.12s ease, transform 0.12s ease;
}
.dl-fade-enter-from {
	opacity: 0;
	transform: translateY(6px);
}
.dl-fade-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

/* Card entrance — staggered via --dl-i CSS variable (mirrors list_view.js idx*35ms) */
@keyframes dl-card-in {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.dl-fade-enter-active .sva-dl-card {
	animation: dl-card-in 0.25s ease both;
	animation-delay: min(calc(var(--dl-i, 0) * 35ms), 400ms);
}

/* ── Skeleton shimmer ─────────────────────────────────────────────────────── */
@keyframes dl-shimmer {
	0% {
		background-position: -600px 0;
	}
	100% {
		background-position: 600px 0;
	}
}
.sva-dl-skel {
	background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%);
	background-size: 1200px 100%;
	animation: dl-shimmer 1.4s ease-in-out infinite;
	border-radius: 6px;
	flex-shrink: 0;
}

/* Chip skeleton — widths mirror real chip label lengths */
.sva-dl-skel-chip {
	height: 32px;
	width: 110px;
	border-radius: 20px;
}
.sva-dl-skel-chip:nth-child(2) {
	width: 72px;
}
.sva-dl-skel-chip:nth-child(3) {
	width: 190px;
}
.sva-dl-skel-chip:nth-child(4) {
	width: 130px;
}
.sva-dl-skel-chip:nth-child(5) {
	width: 90px;
}

/* Card skeletons */
.sva-dl-skeletons {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.sva-dl-skel-card {
	background: #fff;
	border: 1px solid #e5e7eb;
	border-left: 4px solid #e5e7eb;
	border-radius: 10px;
	padding: 14px 16px 12px;
}
.sva-dl-skel-card-top {
	display: flex;
	gap: 11px;
	align-items: flex-start;
}
.sva-dl-skel-avatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
}
.sva-dl-skel-lines {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.sva-dl-skel-line {
	height: 13px;
}
.sva-dl-skel-pills-row {
	display: flex;
	gap: 6px;
	margin-top: 12px;
	padding-top: 10px;
	border-top: 1px solid #f3f4f6;
}
.sva-dl-skel-pill-sm {
	height: 26px;
	width: 90px;
	border-radius: 6px;
}
.sva-dl-skel-pill-sm:nth-child(2) {
	width: 110px;
}
.sva-dl-skel-pill-sm:nth-child(3) {
	width: 75px;
}

/* ── Empty ───────────────────────────────────────────────────────────────── */
.sva-dl-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	color: #9ca3af;
	padding: 64px 0;
	font-size: 0.84rem;
}
.sva-dl-empty-icon {
	width: 60px;
	height: 60px;
	background: #f3f4f6;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sva-dl-empty p {
	margin: 0;
}
@keyframes dl-spin {
	to {
		transform: rotate(360deg);
	}
}

/* ── Date group ──────────────────────────────────────────────────────────── */
.sva-dl-date-group {
	margin-bottom: 6px;
}

.sva-dl-date-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 6px 6px;
}
.sva-dl-date-label {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 0.84rem;
	font-weight: 700;
	color: #1f2937;
}
.sva-dl-recent-dot {
	color: #9ca3af;
	font-weight: 400;
	font-size: 0.78rem;
}
.sva-dl-group-count {
	font-size: 0.72rem;
	color: #9ca3af;
	font-weight: 500;
}

/* ── Card ────────────────────────────────────────────────────────────────── */
.sva-dl-card {
	background: #fff;
	border: 1px solid #e5e7eb;
	border-left: 4px solid #ef4444;
	border-radius: 10px;
	padding: 14px 16px 12px;
	margin-bottom: 10px;
	transition: box-shadow 0.15s;
}
.sva-dl-card:hover {
	box-shadow: 0 3px 14px rgba(0, 0, 0, 0.08);
}

/* ── Card top row ────────────────────────────────────────────────────────── */
.sva-dl-card-top {
	display: flex;
	gap: 11px;
	align-items: flex-start;
}

.sva-dl-avatar {
	width: 36px;
	height: 36px;
	background: #ef4444;
	color: #fff;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 0.88rem;
	flex-shrink: 0;
}

.sva-dl-card-main {
	flex: 1;
	min-width: 0;
}

.sva-dl-card-title {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 5px;
	margin-bottom: 5px;
}

.sva-dl-del-badge {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	background: #fee2e2;
	color: #dc2626;
	font-size: 0.64rem;
	font-weight: 700;
	padding: 2px 7px;
	border-radius: 4px;
	letter-spacing: 0.05em;
	flex-shrink: 0;
}

.sva-dl-dt-name {
	font-size: 0.84rem;
	font-weight: 700;
	color: #111827;
}
.sva-dl-sep {
	color: #9ca3af;
	font-size: 0.8rem;
}
.sva-dl-doc-id {
	font-size: 0.82rem;
	color: #374151;
	font-weight: 500;
	font-family: ui-monospace, monospace;
}

.sva-dl-tag {
	font-size: 0.65rem;
	font-weight: 600;
	padding: 2px 7px;
	border-radius: 4px;
}
.sva-dl-tag--parent {
	background: color-mix(in srgb, var(--dl-primary) 12%, transparent);
	color: var(--dl-primary);
}
.sva-dl-tag--restored {
	background: #dcfce7;
	color: #15803d;
}

/* Meta row */
.sva-dl-card-meta {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px;
	font-size: 0.74rem;
	color: #6b7280;
}
.sva-dl-user-name {
	font-weight: 600;
	color: #374151;
}
.sva-dl-meta-dot {
	color: #d1d5db;
}
.sva-dl-meta-time {
	white-space: nowrap;
}
.sva-dl-meta-ago {
	white-space: nowrap;
	color: #9ca3af;
}

/* Toggle button */
.sva-dl-toggle-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 5px 12px;
	border-radius: 6px;
	border: 1px solid #e5e7eb;
	background: #f9fafb;
	color: #374151;
	font-size: 0.76rem;
	font-weight: 500;
	cursor: pointer;
	flex-shrink: 0;
	align-self: flex-start;
	transition: all 0.15s;
}
.sva-dl-toggle-btn:hover {
	background: #f3f4f6;
}
.sva-dl-toggle-btn.is-expanded {
	background: color-mix(in srgb, var(--dl-primary) 10%, transparent);
	border-color: color-mix(in srgb, var(--dl-primary) 40%, transparent);
	color: var(--dl-primary);
}
.sva-dl-toggle-btn.is-loading {
	opacity: 0.7;
	cursor: wait;
}
.sva-dl-detail-spin {
	animation: dl-spin 0.7s linear infinite;
}

/* ── Content preview (Text Editor / HTML fields) ─────────────────────────── */
.sva-dl-content-preview {
	margin-top: 10px;
	padding: 8px 12px;
	background: #f9fafb;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	font-size: 0.78rem;
	color: #4b5563;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-word;
	font-style: italic;
}

/* ── Reason box ──────────────────────────────────────────────────────────── */
.sva-dl-reason-box {
	display: flex;
	align-items: baseline;
	gap: 6px;
	margin: 10px 0 0;
	padding: 8px 12px;
	background: #f9fafb;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	font-size: 0.78rem;
	color: #4b5563;
	line-height: 1.5;
}
.sva-dl-reason-label {
	font-weight: 600;
	color: #374151;
	flex-shrink: 0;
}
.sva-dl-reason-sep {
	color: #d1d5db;
	flex-shrink: 0;
}
.sva-dl-reason-text {
	font-style: italic;
}

/* ── Pills ───────────────────────────────────────────────────────────────── */
.sva-dl-pills {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px solid #f3f4f6;
}

.sva-dl-pill {
	display: inline-flex;
	align-items: stretch;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	overflow: hidden;
	font-size: 0.74rem;
	max-width: 220px;
}
.sva-dl-pill-label {
	padding: 3px 8px;
	background: #f3f4f6;
	color: #6b7280;
	font-weight: 500;
	white-space: nowrap;
	border-right: 1px solid #e5e7eb;
	display: flex;
	align-items: center;
}
.sva-dl-pill-value {
	padding: 3px 8px;
	background: #fff;
	color: #111827;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 130px;
	display: flex;
	align-items: center;
}

.sva-dl-more-btn {
	display: inline-flex;
	align-items: center;
	padding: 3px 10px;
	border: 1px dashed #d1d5db;
	border-radius: 6px;
	font-size: 0.74rem;
	color: var(--dl-primary);
	background: none;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s;
}
.sva-dl-more-btn:hover {
	background: color-mix(in srgb, var(--dl-primary) 8%, transparent);
	border-color: color-mix(in srgb, var(--dl-primary) 50%, transparent);
}

/* ── Load more ───────────────────────────────────────────────────────────── */
.sva-dl-load-more {
	display: flex;
	justify-content: center;
	padding: 16px 0 8px;
}
.sva-dl-load-more-btn {
	padding: 7px 22px;
	border-radius: 20px;
	border: 1px solid #e5e7eb;
	background: #f9fafb;
	color: #374151;
	font-size: 0.8rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sva-dl-load-more-btn:hover {
	background: var(--dl-primary);
	border-color: var(--dl-primary);
	color: #fff;
}
.sva-dl-load-more-spinner {
	display: flex;
	align-items: center;
	gap: 7px;
	color: #9ca3af;
	font-size: 0.78rem;
}
.sva-dl-lm-spin {
	animation: dl-spin 0.8s linear infinite;
}

/* ── Expanded table ──────────────────────────────────────────────────────── */
.sva-dl-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.78rem;
	margin-top: 10px;
	border-top: 1px solid #f3f4f6;
}
.sva-dl-table th,
.sva-dl-table td {
	padding: 6px 10px;
	border-bottom: 1px solid #f3f4f6;
	text-align: left;
}
.sva-dl-table th {
	background: #f9fafb;
	font-weight: 600;
	color: #374151;
}
.sva-dl-table th:first-child,
.sva-dl-table td:first-child {
	white-space: nowrap;
	width: 1%;
}
.sva-dl-table td {
	color: #4b5563;
}
.sva-dl-table tbody tr:last-child td {
	border-bottom: none;
}
.sva-dl-table tbody tr:hover td {
	background: #fafafa;
}
</style>
