const get_wrapper = (block_name)=>{
    return new Promise((rslv, rjct)=>{
        let index = 0;
        let interval = setInterval(() => {
            let wrapper = document.querySelector(`[custom_block_name="${block_name}"]`);
            if (wrapper) {
                rslv(wrapper)
            }
            index++;
            if (wrapper || index == 20) {
                clearInterval(interval);
                if(index == 20 && !wrapper){
                    rjct(false)
                }
            }
        }, 1000);
    });
}

import SVAHeatmap from './custom_components/heatmap.bundle.js';
import SvaDataTable from './datatable/sva_datatable.bundle.js';

if (frappe?.workspace_block.blocks?.custom_block) {
    frappe.workspace_block.blocks.custom_block = class SVACustomBlock extends frappe.workspace_block.blocks.custom_block {
        constructor(...args) {
            super(...args);
            if (this.readOnly) {
                this.render_sva_custom_block()
            }
        }
        async render_sva_custom_block() {
            let page_type = frappe.get_route()[0];
            if (page_type == "Workspaces") {
                let workspace_name = frappe.get_route()[1];
                let workspace_conf = frappe.boot?.sva_workspaces?.[workspace_name];
                let blocks = [
                    ...workspace_conf?.heatmaps.map((heatmap) => {return {...heatmap,'type':"Heatmap"}}),
                    ...workspace_conf?.tables.map((table) => {return {...table,'type':"SVATable"}})
                ]
                if(workspace_conf){
                    let block = blocks.find(block => (block?.custom_block || block?.custom_html_block) == this.data.custom_block_name);
                    let wrapper = await get_wrapper(block?.custom_block || block?.custom_html_block)

                    if(block && wrapper){
                        if(block.type == "Heatmap"){
                            new SVAHeatmap({
                                wrapper: $(wrapper),
                                ...block,
                            })
                        }else if (block.type == 'SVATable') {
                            new SvaDataTable({
                                label: block?.title,
                                wrapper,
                                doctype: block?.link_doctype,
                                connection:block,
                                options:{
                                    serialNumberColumn: true,
                                    editable: false,
                                    style:{height:'237px'}
                                }
                            })
                        }
                    }
                }
            }
        }
    }

}