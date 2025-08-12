<template>
    <div class="d-flex">
        <div ref="frappeContainer" class="frappe-control-container"></div>
    </div>
    <div ref="sva_datatable"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const frappeContainer = ref(null);
const ref_doctype = ref(null);
const sva_datatable = ref(null);

const props = defineProps({
    frm: {
        type: Object, // ✅ changed from String to Object
        required: true
    }
});

onMounted(async () => { // ✅ made async
    // Frappe control
    let moduleValue = frappe.ui.form.make_control({
        parent: $(frappeContainer.value),
        df: {
            label: 'Module',
            fieldname: 'module',
            fieldtype: 'Link',
            options: 'Workflow',
            onchange: async function () {
                const newValue = moduleValue.get_value();
                if (newValue) {
                    let doc_type = await frappe.db.get_value('Workflow', { 'name':newValue, is_active: 1 }, 'document_type');
                    doc_type = doc_type?.message?.document_type;
                    await showTable(doc_type);
                }
            }
        },
        render_input: true
    });

    await showTable('Fund Request'); // ✅ default table

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
}
</script>
