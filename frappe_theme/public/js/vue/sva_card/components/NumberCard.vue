<!-- Used as Button & Heading Control -->
<script setup>
import Skeleton from "./Skeleton.vue";
import { ref, onMounted, inject } from "vue";

const loading = ref(true);
const data = ref({});
const showCard = ref(false);

const props = defineProps({
	card: {
		type: Object,
		default: {},
	},
	delay: {
		type: Number,
		default: 0,
	},
	actions: {
		type: Array,
		default: () => [{ label: "Refresh", action: "refresh" }],
	},
});

// const emit = defineEmits(['action-clicked']);

const handleAction = async (action) => {
	if (action == "refresh") {
		loading.value = true;
		await getCount();
	} else if (action == "edit") {
		frappe.set_route("Form", props.card?.details?.doctype, props.card?.details?.label);
	}
	// emit('action-clicked', action);
};

const getCount = async () => {
	let type = "Report";
	let details = {};
	let report = {};
	if (props?.card?.details?.type == "Report") {
		type = "Report";
		details = props.card.details;
		report = props.card.report;
	} else if (props?.card?.details?.type == "Document Type") {
		type = "Document Type";
		details = props.card.details;
	} else {
		data.value["count"] = 0;
		loading.value = false;
		return;
	}
	try {
		loading.value = true;
		if (props.card.fetch_from == "DocField") {
			data.value["count"] = cur_frm.doc[props.card.field];
			data.value["field_type"] = cur_frm.fields_dict[props.card.field].df.fieldtype;
			setTimeout(() => {
				loading.value = false;
			}, 500);
		} else {
			let res = await frappe.call({
				method: "frappe_theme.dt_api.get_number_card_count",
				args: {
					type: type,
					details: details,
					report: report,
					doctype: cur_frm.doc.doctype,
					docname: cur_frm.doc.name,
				},
			});
			if (res.message) {
				data.value = res.message;
				setTimeout(() => {
					loading.value = false;
				}, 500);
			}
		}
	} catch (error) {
		console.error(error);
		loading.value = false;
	}
};
onMounted(async () => {
	// Initial delay based on card position
	setTimeout(async () => {
		showCard.value = true;
		await getCount();
	}, props.delay);
});
</script>

<template>
	<transition name="fade">
		<div v-if="showCard">
			<Skeleton v-if="loading" />
			<div
				v-else
				class="card mb-2"
				:style="`padding: 8px 8px 8px 12px; background-color: ${card.background_color}`"
			>
				<div class="d-flex justify-content-between">
					<p
						class="text-truncate"
						:style="`font-size: 11px; width: 90%; color: ${card.text_color}`"
						:title="card.card_label"
					>
						{{ card.card_label?.toUpperCase() }}
					</p>
					<div class="dropdown" v-if="actions.length">
						<span
							title="action"
							class="pointer d-flex justify-content-center align-items-center"
							id="dropdownMenuButton"
							data-toggle="dropdown"
							aria-haspopup="true"
							aria-expanded="false"
						>
							...
						</span>
						<div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
							<a
								v-for="action in actions"
								:key="action.action"
								class="dropdown-item"
								@click="handleAction(action.action)"
							>
								{{ action.label }}
							</a>
						</div>
					</div>
				</div>
				<!-- number -->
				<div class="d-flex justify-content-between align-items-center">
					<h4 :style="`color: ${card.value_color}`">
						{{
							data.field_type == "Currency"
								? frappe.utils.format_currency(data.count)
								: data.count ?? 0
						}}
					</h4>
					<span
						v-if="card.icon_value"
						v-html="frappe.utils.icon(card.icon_value)"
					></span>
				</div>
			</div>
		</div>
	</transition>
</template>

<style lang="scss" scoped>
h4 {
	margin-bottom: 0px;
}

.pointer {
	cursor: pointer;
	line-height: 8px;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
