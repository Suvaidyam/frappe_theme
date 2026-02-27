<template>
	<transition name="fade">
		<div v-if="showCard">
			<Skeleton v-if="loading" />
			<div v-else class="card mb-2 number-card" :style="getCardStyles">
				<div class="d-flex justify-content-between">
					<p
						class="text-truncate card-label"
						:style="`font-size: 11px; width: 90%; color: ${card.text_color}`"
						:title="card.card_label"
					>
						{{ card.card_label }}
					</p>
					<span
						class="card-icon"
						v-if="card.icon_value"
						v-html="frappe.utils.icon(card.icon_value)"
					></span>
				</div>
				<!-- number -->
				<div class="d-flex justify-content-between align-items-center">
					<h4
						@dblclick="handleAction('view_table')"
						class="card-value"
						style="cursor: pointer"
						:style="`color: ${card.value_color}`"
					>
						{{ get_formatted_value(data) }}
					</h4>
				</div>
			</div>
		</div>
		<Placeholder v-else :label="card.card_label" />
	</transition>
</template>

<script setup>
import Skeleton from "./Skeleton.vue";
import Placeholder from "./Placeholder.vue";
import SvaDataTable from "../../../datatable/sva_datatable.bundle.js";
import Loader from "../../../loader-element.js";
import { ref, onMounted, inject, computed } from "vue";

const loading = ref(true);
const data = ref({});
const showCard = ref(false);

const props = defineProps({
	card: {
		type: Object,
		default: {},
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
	delay: {
		type: Number,
		default: 0,
	},
	actions: {
		type: Array,
		default: () => [{ label: "Refresh", action: "refresh" }],
	},
	frm: {
		type: Object,
		default: () => ({}),
	},
});

// const emit = defineEmits(['action-clicked']);

const getCardStyles = computed(() => {
	const styles = {
		padding: "12px 12px 12px 12px",
		backgroundColor: props.card.background_color || "white",
		"--text-color": props.card.text_color || "inherit",
		"--hover-bg-color":
			props.card.hover_background_color || props.card.background_color || "white",
		"--hover-text-color": props.card.hover_text_color || props.card.text_color || "#525252",
		"--hover-value-color": props.card.hover_value_color || props.card.value_color || "inherit",
	};
	return Object.entries(styles)
		.map(([key, value]) => {
			// Convert camelCase to kebab-case for CSS properties, but keep CSS custom properties as-is
			const cssKey = key.startsWith("--")
				? key
				: key.replace(/([A-Z])/g, "-$1").toLowerCase();
			return `${cssKey}: ${value}`;
		})
		.join("; ");
});

const handleAction = async (action) => {
	if (action == "refresh") {
		loading.value = true;
		await getCount();
	} else if (action == "edit") {
		frappe.set_route("Form", props.card?.details?.doctype, props.card?.details?.label);
	} else if (action == "view_table") {
		if (props.card.fetch_from == "DocField" && props.card.field) {
			props.frm.scroll_to_field(props.card.field);
			return;
		}
		const wrapper = document.createElement("div");
		let loader = new Loader(wrapper);
		loader.show();

		let table_options = {
			label: "",
			wrapper,
			doctype: "",
			frm: props.frm || cur_frm,
			connection: {
				crud_permissions: JSON.stringify(["read"]),
			},
			childLinks: [],
			options: {
				serialNumberColumn: true,
				editable: false,
			},
			loader,
		};

		if (props?.card?.html_field) {
			table_options.connection["html_field"] = props.card.html_field;
			table_options.connection["configuration_basis"] = "Property Setter";
		}

		if (props.card?.listview_settings) {
			table_options.connection["listview_settings"] = props.card.listview_settings;
		}

		if (props.card?.details?.type == "Report") {
			table_options.connection["link_report"] = props.card.details?.report_name;
			if (props.card?.details?.report_field) {
				table_options.connection["highlighted_columns"] = [
					props.card.details?.report_field,
				];
			}
			table_options.connection["connection_type"] = "Report";
		} else if (props.card?.details?.type == "Document Type") {
			table_options.doctype = props.card.details?.document_type;
			if (cur_frm.doctype) {
				let confs = await frappe.xcall("frappe_theme.dt_api.get_connection_type_confs", {
					doctype: props.card.details?.document_type,
					ref_doctype: cur_frm.doctype,
				});
				if (confs) {
					Object.assign(table_options.connection, confs);
				} else {
					table_options.connection["connection_type"] = "Unfiltered";
				}
			} else {
				table_options.connection["connection_type"] = "Unfiltered";
			}
		}

		let dialog = new frappe.ui.Dialog({
			title:
				props.card?.details?.report_name ||
				props.card?.details?.document_type ||
				"Data Table",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "data_table_html",
					options: `<div>Table Loading...</div>`,
				},
			],
			size: "extra-large",
			primary_action_label: "Close",
			primary_action: function () {
				dialog.hide();
			},
		});
		dialog.show();
		dialog.set_df_property("data_table_html", "options", wrapper);

		new SvaDataTable(table_options);
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
	} else if (props.card.fetch_from != "DocField") {
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
			let pre_filters = {};
			if (props.frm) {
				if (
					props.frm?.["dt_events"]?.[details.name]?.get_filters ||
					props.frm?.["dt_events"]?.[props?.card?.html_field]?.get_filters
				) {
					let get_filters =
						props.frm?.["dt_events"]?.[details.name]?.get_filters ||
						props.frm?.["dt_events"]?.[props?.card?.html_field]?.get_filters;
					pre_filters =
						(await get_filters(details, props.frm || {}, props?.card?.html_field)) ||
						{};
				}
			}
			let res = await frappe.call({
				method: "frappe_theme.dt_api.get_number_card_count",
				args: {
					type: type,
					details: details,
					report: report,
					doctype: cur_frm.doc.doctype,
					docname: cur_frm.doc.name,
					filters: { ...(props.filters || {}), ...pre_filters },
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
		showCard.value = props.card.is_permitted ? true : false;
		await getCount();
	}, props.delay);
});

const get_formatted_value = (data) => {
	switch (data?.column?.fieldtype) {
		case "Currency":
			return frappe.utils.format_currency(data.count || 0);
		case "Float":
			return frappe.utils.shorten_number(
				data.count || 0,
				frappe.sys_defaults.country,
				null,
				data?.column?.precision || 2
			);
		case "Int":
			return frappe.utils.shorten_number(
				data.count || 0,
				frappe.sys_defaults.country,
				null,
				0
			);
		case "Percent":
			return `${format_number(data.count || 0, null, data?.column?.precision || 2)}%`;
		default:
			return frappe.utils.shorten_number(
				data.count || 0,
				frappe.sys_defaults.country,
				null,
				0
			);
	}
};
</script>

<style lang="scss" scoped>
h4 {
	margin-bottom: 0px;
}

.pointer {
	cursor: pointer;
	line-height: 8px;
}

.number-card {
	transition: background-color 0.3s ease;

	&:hover {
		background-color: var(--hover-bg-color) !important;
		transition: transform 0.3s ease;
		transform: scale(1.01);
		.card-label {
			color: var(--hover-text-color) !important;
		}

		.card-value {
			color: var(--hover-value-color) !important;
		}

		.card-icon {
			:deep(svg),
			:deep(svg *),
			:deep(svg use) {
				transition: stroke 0.1s ease;
				stroke: var(--hover-text-color) !important;
			}
		}
	}
}

.card-label {
	transition: color 0.3s ease;
}

.card-value {
	transition: color 0.3s ease;
}

.card-icon {
	:deep(svg),
	:deep(svg *),
	:deep(svg use) {
		stroke: var(--text-color) !important;
	}
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
