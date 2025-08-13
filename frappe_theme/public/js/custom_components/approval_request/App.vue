<template>
    <div class="d-flex">
        <div ref="frappeContainer" class="frappe-control-container"></div>
    </div>
    <div ref="sva_datatable"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const frappeContainer = ref(null);
const sva_datatable = ref(null);

const props = defineProps({
    frm: {
        type: Object, // ✅ changed from String to Object
        required: true
    }
});

const allowedDocTypes = ref([]);

let moduleValue;

onMounted(async () => {
    if (await frappe.db.exists("SVADatatable Configuration", props.frm.doctype)) {
        let conf_doc = await frappe.db.get_doc("SVADatatable Configuration", props.frm.doctype);
        let found = [];

        for (let key in conf_doc) {
            if (Array.isArray(conf_doc[key]) && conf_doc[key].length && conf_doc[key][0].link_doctype) {
                found.push(...conf_doc[key].map(row => row.link_doctype).filter(Boolean));
            }
        }
        allowedDocTypes.value = [...new Set(found)];
    }

    moduleValue = frappe.ui.form.make_control({
        parent: $(frappeContainer.value),

        df: {
            label: 'Workflow',
            fieldname: 'workflow',
            fieldtype: 'Autocomplete',
            options: [],
            onchange: async function () {
                const newValue = moduleValue.get_value();
                if (newValue) {
                    let doc_type = await frappe.db.get_value(
                        'Workflow',
                        { name: newValue, is_active: 1 },
                        'document_type'
                    );
                    doc_type = doc_type?.message?.document_type;

                    if (allowedDocTypes.value.includes(doc_type)) {
                        await showTable(doc_type);
                    } else {
                        console.warn(`❌ ${doc_type} is not in SVADatatable Configuration list`);
                    }
                }
            }
        },
        render_input: true
    });

    frappe.call({
        method: "frappe_theme.api.workflow_doctype_query",
        args: { current_doctype: props.frm.doctype },
        callback: function (r) {
            if (Array.isArray(r.message) && r.message.length) {
                const workflowNames = r.message.map(row => row.name);
                moduleValue.set_data(workflowNames);
            } else {
                moduleValue.set_data([]); // Clear options if no workflows
            }
        }
    });

    if (allowedDocTypes.value.includes(props.frm.doctype)) {
        await showTable(props.frm.doctype);
    }
});


const showTable = async (document_type) => {
    await frappe.require('sva_datatable.bundle.js');
    const frmCopy = Object.assign({}, props.frm);
    let wf_field = await frappe.db.get_value('Workflow', { document_type, is_active: 1 }, 'workflow_state_field');
    wf_field = wf_field?.message?.workflow_state_field;

    frmCopy.sva_dt_instance = new frappe.ui.SvaDataTable({
        wrapper: sva_datatable.value,
        frm: Object.assign(frmCopy, {
            dt_events: {
                [document_type]: {
                    before_load: async function (dt) {
                        let wf_positive_closure = await frappe.xcall('frappe_theme.utils.get_wf_state_by_closure', {
                            doctype: document_type,
                            closure_type: 'Positive'
                        });
                        let wf_negative_closure = await frappe.xcall('frappe_theme.utils.get_wf_state_by_closure', {
                            doctype: document_type,
                            closure_type: 'Negative'
                        });

                        if (wf_positive_closure && wf_negative_closure) {
                            dt.additional_list_filters = [
                                [document_type, wf_field, 'not in', [wf_positive_closure, wf_negative_closure]]
                            ];
                        }
                    },
                    after_workflow_action: async function (dt) {
                        try {
                            if (dt.frm?.number_table_instance) dt.frm.number_table_instance.refresh();
                            if (dt.frm?.sva_dt_instance) dt.frm.sva_dt_instance.reloadTable();
                        } catch (error) {
                            console.error(error, 'Error in reload');
                        }
                    }
                }
            }
        }),
        doctype: document_type,
        connection: {
            connection_type: 'Unfiltered',
            unfiltered: 1,
            crud_permissions: '["read"]'
        }
    });
};

</script>