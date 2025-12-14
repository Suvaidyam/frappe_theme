<template>
	<div
		style="background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
		<div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Workflow States</div>
		<div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 16px;">
			<span @click="onStateClick(item.state)" v-for="(item, index) in data"
				style="width: fit-content; display: flex; align-items: center; gap: 6px; text-decoration: none; cursor: pointer;">
				<span style="min-width: 10px; min-height: 10px; border-radius: 50%;" :class="'bg-' + item.style?.toLowerCase()"
					:style="{ 'background': !item.style?.toLowerCase() && 'gray' }"></span>
				<span style="font-weight: 700; color: #1f2937;">{{ item.count }}</span>
				<span style="color: #6b7280;">{{ item.state }}</span>
				<svg style="width: 14px;" v-if="selectedStates.includes(item.state)" fill="gray" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 444.81"><path fill-rule="nonzero" d="M104.42 183.22c31.76 18.29 52.42 33.49 77.03 60.61C245.27 141.1 314.54 84.19 404.62 3.4l8.81-3.4H512C379.83 146.79 277.36 267.82 185.61 444.81 137.84 342.68 95.26 272.18 0 206.81l104.42-23.59z"/></svg>
				<span v-if="index != (data.length -1)" style="min-width: 2px; min-height: 100%; background-color: gray; margin-left: 5px;"></span>
			</span>
		</div>
	</div>
</template>
<script setup>
import { ref, computed } from "vue";

const selectedStates = ref([]); // ✅ multiple selection

const onStateClick = (state) => {
	const index = selectedStates.value.indexOf(state);
	if (index > -1) {
		selectedStates.value.splice(index, 1);
	} else {
		selectedStates.value.push(state);
	}

	if (selectedStates.value.length === 0) {
		window.parent.postMessage({ type: "RESET_FILTER" }, "*");
	} else {
		window.parent.postMessage(
			{ type: "FILTER_BY_STATE", states: [...selectedStates.value] },
			"*"
		);
	}
};

const data = ref([]);
const props = defineProps({ doctype: { required: true } });

const get_data = async () => {
	const res = await frappe.call({
		method: "frappe_theme.api.get_workflow_count",
		args: { doctype: props.doctype },
	});
	if (res) data.value = res.message;
};
get_data();

// const half = computed(() => Math.ceil(data.value.length / 2));
// const first_half = computed(() => data.value.slice(0, half.value));
// const second_half = computed(() => data.value.slice(half.value));

// const mid = computed(() => Math.ceil(data.value.length / 3));
// const first_part = computed(() => data.value.slice(0, mid.value));
// const second_part = computed(() => data.value.slice(mid.value, mid.value * 2));
// const third_part = computed(() => data.value.slice(mid.value * 2));
</script>
