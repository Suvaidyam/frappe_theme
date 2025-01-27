
const getData = async (dt) => {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe_theme.api.get_property_set",
            args: {
                doctype: dt
            },
            callback: function (r) {
                if (r && r.message) {
                    resolve(r.message);
                } else {
                    reject("Error fetching data");
                }
            }
        });
    });
};
function apply_filter(field_name, filter_on, frm, filter_value) {
    frm.fields_dict[field_name].get_query = () => {
        return {
            filters: {
                [filter_on]: filter_value || frm.doc[filter_on] || `please select ${filter_on}`,
            },
            page_length: 1000
        };
    }
}

const tabContent = async (frm, tab_field) => {
    // console.log("tabContent", frm.events);

    // debugger
    if (await frappe.db.exists('SVADatatable Configuration', frm.doc.doctype) || (await frappe.db.exists('Number Card Mapper', { doctype_field: frm.doc.doctype }) && await frappe.db.count('Number Card Mapper', { doctype_field: frm.doc.doctype }) > 0)) {
        let dts = await frappe.db.get_doc('SVADatatable Configuration', frm.doc.doctype);
        let tab_fields = []
        let tab_field_index = frm.meta?.fields?.findIndex(f => f.fieldname == tab_field)
        if ((tab_field_index + 1) > frm.meta?.fields.length) {
            return;
        }
        for (let i = (tab_field_index + 1); i < frm.meta?.fields.length; i++) {
            let f = frm.meta?.fields[i]
            if (f.fieldtype == 'Tab Break') {
                break;
            }
            if (f.fieldtype == 'HTML') {
                tab_fields.push(f.fieldname)
            }
        }
        let dtFields = dts.child_doctypes?.filter(f => tab_fields.includes(f.html_field))
        let numberCardFields = tab_fields.filter(f => !dts?.child_doctypes?.map(d => d.html_field).includes(f))
        for (let fld of numberCardFields) {
            if (await frappe.db.exists('Number Card Mapper', { doctype_field: frm.doc.doctype, wrapper_field: fld })) {
                let nc = await frappe.db.get_list('Number Card Mapper', {
                    filters: {
                        doctype_field: frm.doc.doctype,
                        wrapper_field: fld
                    },
                    pluck: 'name',
                    limit: 1
                });
                if (nc.length > 0) {
                    let numberCardMapper = await frappe.db.get_doc('Number Card Mapper', nc[0]);
                    let numberCards = numberCardMapper?.cards?.map(f => f.number_card);
                    new SVANumberCard({
                        wrapper: document.querySelector(`[data-fieldname="${fld}"]`),
                        frm: frm,
                        numberCards: numberCards
                    });
                }
            } else {
                console.log('Number Card Mapper does not exist');
            }
        }
        for (let _f of dtFields) {
            if (frm.doc.__islocal) {
                if (!document.querySelector(`[data-fieldname="${_f.html_field}"]`).querySelector('#form-not-saved')) {
                    document.querySelector(`[data-fieldname="${_f.html_field}"]`).innerHTML = `<div id="form-not-saved" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px; padding: 10px; border: 1px solid #525252; border-radius: 4px; margin: 10px 0;">
                        <img width='50px' src='/assets/frappe_theme/images/form-not-saved.png'/>
                        Save ${frm.doctype} to add ${_f?.connection_type == "Is Custom Design" ? _f?.template : (_f.connection_type == "Direct" ? _f.link_doctype : _f.referenced_link_doctype)} items.
                    </div>`;
                }
            } else {
                if (document.querySelector(`[data-fieldname="${_f.html_field}"]`).querySelector('#form-not-saved')) {
                    document.querySelector(`[data-fieldname="${_f.html_field}"]`).querySelector('#form-not-saved').remove();
                }
                if (_f?.connection_type == "Is Custom Design") {
                    if (_f?.template == "Gallery") {
                        gallery_image(frm, _f.html_field);
                    }
                    if (_f?.template == "Email") {
                        communication(frm, _f.html_field);
                    }
                    if (_f?.template == "Tasks") {
                        getTaskList(frm, _f.html_field);
                    }
                    if (_f?.template == "Timeline") {
                        showTimelines(frm, _f.html_field);
                    }
                    if (_f?.template == "Notes") {
                        await render_note(frm, _f.html_field);
                    }
                } else {
                    let childLinks = dts.child_confs.filter(f => f.parent_doctype == _f.link_doctype)
                    // if (document.querySelector(`[data-fieldname="${_f.html_field}"]`).children.length > 0) {
                    //     document.querySelector(`[data-fieldname="${_f.html_field}"]`).ch;
                    // }

                    new SvaDataTable({
                        label:frm.meta?.fields?.find(f=> f.fieldname == _f.html_field)?.label,
                        wrapper: document.querySelector(`[data-fieldname="${_f.html_field}"]`), // Wrapper element   // Pass your data
                        doctype: _f.connection_type == "Direct" ? _f.link_doctype : _f.referenced_link_doctype, // Doctype name
                        frm: frm,       // Pass the current form object (optional)
                        connection: _f,
                        childLinks: childLinks,
                        options: {
                            serialNumberColumn: true, // Enable serial number column (optional)
                            editable: false,      // Enable editing (optional),
                        },
                        onFieldClick: (e) => {
                            if (e && window?.onFieldClick) {
                                let obj = {
                                    dt: e?.target?.getAttribute('data-dt'),
                                    dn: e?.target?.getAttribute('data-dn'),
                                    fieldname: e?.target?.getAttribute('data-fieldname')
                                }
                                window?.onFieldClick(obj);
                            }
                        },
                        onFieldValueChange:function(e,b,c,d,f){
                            if(e && window?.onFieldValueChange){
                                let obj = {
                                    dt:e?.target?.getAttribute('data-dt'),
                                    dn:e?.target?.getAttribute('data-dn'),
                                    fieldtype:e?.target?.getAttribute('data-fieldtype'),
                                    fieldname:e?.target?.getAttribute('data-fieldname'),
                                    value:e?.target?.value
                                }
                                window?.onFieldValueChange(obj);
                            }
                        }
                    });
                }
            }
        }
    }
}
const mapEvents = (props) => {
    let obj = {};
    if (props.length) {
        for (let prop of props) {
            if (prop) {
                let abc = prop.value.split("->")
                obj[abc[0]] = function (frm) {
                    apply_filter(prop.field_name, abc[0], frm, frm.doc[abc[1]]);
                    frm.set_value(prop.field_name, "");
                }
            }
        }
    }
    return {
        onload(frm) {
        },
        refresh: async function (frm) {
            if (!frm.doc.__islocal) {
                frm.add_custom_button(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
                                            <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"/>
                                        </svg>`,
                    () => {
                        const commentSection = document.querySelector('.comment-box');
                        if (commentSection) {
                            commentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                );
            }
            if (props.length) {
                for (let prop of props) {
                    if (prop) {
                        let abc = prop.value.split("->")
                        apply_filter(prop.field_name, abc[0], frm, frm.doc[abc[1]]);
                    }
                }
            }
            // if (!frm.__tabEventAttached) {
            let tab_field = frm.get_active_tab()?.df?.fieldname;
            // console.log("tab_field",tab_field);
            tabContent(frm, tab_field)
            $('a[data-toggle="tab"]').on('shown.bs.tab', async function (e) {
                let tab_field = frm.get_active_tab()?.df?.fieldname;
                tabContent(frm, tab_field);
            });
            //     frm.__tabEventAttached = true;
            // }
        },
        onload_post_render: async function (frm) {
        },
        ...obj
    }
}
async function setDynamicProperties() {
    if (cur_frm) {
        try {
            if (cur_frm.doc.doctype == "DocType") {
                cur_frm.add_custom_button('Set Property', () => {
                    set_properties(cur_frm.doc.name);
                });
            }
            let props = await getData(cur_frm.doc.doctype);
            frappe.ui.form.on(cur_frm.doc.doctype, mapEvents(props ?? []));
            frappe.ui.form.trigger(cur_frm.doc.doctype, 'refresh', cur_frm);
        } catch (error) {
            console.error("Error setting dynamic properties:", error);
        }
    }
}
frappe.router.on('change', async () => {
    window.onFieldClick = undefined
    window.onFieldValueChange = undefined
    let interval;
    let elapsedTime = 0;
    const checkInterval = 500; // Check every 500 ms
    const maxTime = 10000; // 10 seconds in milliseconds
    // console.log(window.location.pathname,cur_frm);

    interval = setInterval(async function () {
        elapsedTime += checkInterval;

        // Condition: Stop if the desired value exists in cur_frm
        if ((cur_frm) || elapsedTime >= maxTime) {
            // $('.layout-side-section').remove();
            clearInterval(interval);
            // console.log("route:chnage");
            await setDynamicProperties();
            return;
        }
    }, checkInterval);
});

const set_properties = async (doctype) => {
    let res = await frappe.db.get_list('Property Setter', {
        filters: {
            doc_type: doctype
        }
    })

    let list = new frappe.ui.Dialog({
        title: 'Set Property',
        fields: [
            {
                label: 'List of Properties',
                fieldname: 'property_name',
                fieldtype: 'Autocomplete',
                options: res.map(d => d.name),
                depends_on: `eval: ${JSON.stringify(res.length)} > 0`,
            },
            {
                label: 'New Property Value',
                fieldname: 'property_value',
                fieldtype: 'Data',
                mandatory_depends_on: 'eval: !doc.property_name ',
                depends_on: 'eval: !doc.property_name'
            }
        ],
        primary_action_label: 'Set',
        primary_action: async function () {
            let property_value = list.fields_dict.property_value.get_value()
            list.hide();
            add_properties(doctype, property_value);
        }
    })
    list.show();
}
const add_properties = async (doctype, new_property) => {
    let fields = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: 'Property Setter' });
    let add = new frappe.ui.Dialog({
        title: 'Add Property',
        fields: fields.message.map(d => {
            return {
                label: d.label,
                fieldname: d.fieldname,
                fieldtype: d.fieldtype,
                options: d.options,
                default: d.fieldname == 'property' ? new_property : '',
                reqd: d.reqd,
                read_only: d.fieldname == 'property' ? 1 : 0,
            }
        }),
        primary_action_label: 'Add',
        primary_action: async function () {
            let res = await frappe.call({
                method: 'frappe.desk.form.save.savedocs',
                args: {
                    doc: {
                        doctype: 'Property Setter',
                        doc_type: doctype,
                        doctype_or_field: add.fields_dict.doctype_or_field.get_value(),
                        property: new_property,
                        row_name: add.fields_dict.row_name.get_value(),
                        module: add.fields_dict.module.get_value(),
                        value: add.fields_dict.value.get_value(),
                        property_type: add.fields_dict.property_type.get_value(),
                        default_value: add.fields_dict.default_value.get_value(),
                    },
                    action: 'Save',
                }
            });
            if (res.docs.length > 0) {
                frappe.msgprint('Property set successfully');
                add.hide();
            }
        }
    })
    add.show();
}