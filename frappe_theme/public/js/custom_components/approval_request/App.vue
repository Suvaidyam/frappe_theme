<template>
	<div class="d-flex">
		<div ref="frappeContainer" class="frappe-control-container"></div>
	</div>
	<div ref="sva_datatable"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";

const frappeContainer = ref(null);
const sva_datatable = ref(null);

const props = defineProps({
	frm: {
		type: Object, // ✅ changed from String to Object
		required: true,
	},
});

const optionsMap = ref({});

let moduleValue;

onMounted(async () => {
	moduleValue = frappe.ui.form.make_control({
		parent: $(frappeContainer.value),
		df: {
			label: "Workflow",
			fieldname: "workflow",
			fieldtype: "Autocomplete",
			options: [],
			onchange: async function () {
				const newValue = moduleValue.get_value();
				if (newValue) {
					await showTable(newValue);
				}
			},
		},
		render_input: true,
	});

	frappe.call({
		method: "frappe_theme.api.workflow_doctype_query",
		args: { current_doctype: props.frm.doctype },
		callback: async function (r) {
			if (r.message.options && r.message.options.length) {
				moduleValue.set_data(r.message.options);
				optionsMap.value = r.message.option_map || {};

				const firstOption = r.message.options[0];
				if (firstOption) {
					moduleValue.set_value(firstOption);
				}
			} else {
				frappe.msgprint(__("No workflows found for this doctype."));
			}
		},
	});
});

const showTable = async (document_type) => {
	if (!document_type) {
		console.error("❌ No document type provided");
		return;
	}
	let connection = optionsMap.value[document_type];
	if (!connection) {
		console.error(`❌ ${document_type} is not in SVADatatable Configuration list`);
		return;
	}
	await frappe.require("sva_datatable.bundle.js");
	const frmCopy = Object.assign({}, props.frm);
	let wf_field = await frappe.db.get_value(
		"Workflow",
		{ document_type, is_active: 1 },
		"workflow_state_field"
	);
	wf_field = wf_field?.message?.workflow_state_field;

	frmCopy.sva_dt_instance = new frappe.ui.SvaDataTable({
		wrapper: sva_datatable.value,
		frm: Object.assign(frmCopy, {
			dt_events: {
				...frmCopy?.["dt_events"],
				[document_type]: {
					...frmCopy?.["dt_events"]?.[document_type],
					// before_load: async function (dt) {
					// 	let wf_positive_closure = await frappe.xcall(
					// 		"frappe_theme.utils.get_wf_state_by_closure",
					// 		{
					// 			doctype: document_type,
					// 			closure_type: "Positive",
					// 		}
					// 	);
					// 	let wf_negative_closure = await frappe.xcall(
					// 		"frappe_theme.utils.get_wf_state_by_closure",
					// 		{
					// 			doctype: document_type,
					// 			closure_type: "Negative",
					// 		}
					// 	);

						// if (wf_positive_closure && wf_negative_closure) {
						// 	dt.additional_list_filters = [
						// 		[
						// 			document_type,
						// 			wf_field,
						// 			"not in",
						// 			[wf_positive_closure, wf_negative_closure],
						// 		],
						// 	];
						// }
					// },
					after_workflow_action: async function (dt) {
						try {
							if (dt.frm?.number_table_instance)
								dt.frm.number_table_instance.refresh();
							if (dt.frm?.sva_dt_instance) dt.frm.sva_dt_instance.reloadTable();
						} catch (error) {
							console.error(error, "Error in reload");
						}
					},
				},
			},
		}),
		doctype: document_type,
		connection: Object.assign(connection, {
			crud_permissions: '["read"]',
		}),
	});
};
</script>
