class SvaDataTable {
    /**
     * Constructor for initializing the table with provided options.
     *
     * @param {Object} params - Configuration parameters for the table.
     * @param {HTMLElement} params.wrapper - The wrapper element to contain the table.
     * @param {Array} params.columns - Array of column definitions.
     * @param {Array} params.rows - Array of row data.
     * @param {Object} params.options - Additional options for table configuration.
     * @param {Object} params.frm - Form object related to the table.
     * @param {string} params.cdtfname - Field name for the child table.
     * @param {Object} params.options - Options to customize the table behavior and appearance.
     * @param {boolean} params.options.serialNumberColumn - Whether to include a serial number column in the table.
     * @param {Object} params.options.defaultSort - Default sorting configuration for the table.
     * @param {string} params.options.defaultSort.column - Default column to sort by.
     * @param {string} params.options.defaultSort.direction - Default sorting direction ('asc' or 'desc').
     * @param {number} params.options.freezeColumnsAtLeft - Number of columns to freeze on the left side of the table.
     * @param {number} params.options.pageLimit - Limit for the number of rows per page.
     * @param {boolean} params.options.editable - Whether the table rows are editable.
     * @param {Object} params.options.style - Inline styles to apply to the table.
     * @param {string} params.options.style.width - Width of the table (e.g., '100%').
     * @param {string} params.options.style.height - Height of the table (e.g., '700px').
     * @param {Array<string>} params.options.additionalTableHeader - Additional HTML table headers to be added.
     */

    constructor({
        label = "",
        wrapper, columns = [], rows = [], limit = 10,
        childLinks = [], connection, options,
        frm, cdtfname, doctype, render_only = false,
        onFieldClick = () => { }, onFieldValueChange = () => { },
        signal = null,
    }) {
        this.signal = signal;
        this.sva_db = new SVAHTTP(signal)
        // console.log("SVA DataTable constructor",doctype);
        this.label = label
        wrapper.innerHTML = '';
        this.wrapper = wrapper;
        this.rows = rows;
        this.columns = columns;

        // pagination
        this.page = 1;
        this.limit = limit;
        this.total = this.rows.length;
        // pagination

        this.options = options;
        this.currentSort = this?.options?.defaultSort || null; // Track sort state
        this.frm = frm;
        this.doctype = doctype;
        this.childTableFieldName = cdtfname;
        this.connection = connection;
        this.conf_perms = JSON.parse(this.connection?.crud_permissions ?? '[]');
        this.header = JSON.parse(this.connection?.listview_settings ?? '[]');
        this.childLinks = childLinks;
        // this.wrapper = this.setupWrapper(wrapper);
        this.uniqueness = this.options?.uniqueness || { row: [], column: [] };
        this.table_wrapper = document.createElement('div');
        this.table_wrapper.id = 'table_wrapper';
        this.table = null;
        this.permissions = [];
        this.mgrant_settings = frappe.boot.mgrant_settings || null;
        this.workflow = []
        this.wf_editable_allowed = false;
        this.wf_transitions_allowed = false;
        this.workflow_state_bg = []
        this.render_only = render_only;
        this.additional_list_filters = [];
        this.onFieldValueChange = onFieldValueChange;
        this.onFieldClick = onFieldClick;
        this.reloadTable();
        // return this.wrapper;
    }
    async reloadTable(reset = false) {
        let loader = new Loader(this.wrapper);
        loader.show();
        await this.setupWrapper(this.wrapper)
        if (!this.render_only) {
            if (this.conf_perms.length && this.conf_perms.includes('read')) {
                this.permissions = await this.get_permissions(this.doctype);
                // ================================ Workflow Logic  ================================
                let workflow = await this.sva_db.get_value("Workflow", { "document_type": this.doctype })
                if (workflow) {
                    this.workflow = await this.sva_db.get_doc("Workflow", workflow)
                    this.workflow_state_bg = await this.sva_db.get_list("Workflow State", {
                        fields: ['name', 'style']
                    });
                    this.wf_editable_allowed = this.workflow?.states?.some(tr => frappe.user_roles.includes(tr?.allow_edit));
                    this.wf_transitions_allowed = this.workflow?.transitions?.some(tr => frappe.user_roles.includes(tr?.allowed));
                }
                // ================================ Workflow End ================================
                try {
                    if (this.mgrant_settings != null && this.frm.doctype == "Grant" && await this.sva_db.exists("mGrant Settings Grant Wise", this.frm.doc.name)) {
                        let msgw = await this.sva_db.get_doc("mGrant Settings Grant Wise", this.frm.doc.name)
                        if (msgw) {
                            this.mgrant_settings = msgw
                        }
                    }
                } catch (e) {
                    this.mgrant_settings = {}
                    console.log(e)
                }

                if (this.permissions.length && this.permissions.includes('read')) {
                    let columns = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: this.doctype });
                    if (this.header.length) {
                        this.columns = [];
                        let ft = {
                            'name': { fieldtype: 'Data' },
                            'creation': { fieldtype: 'Date' },
                            'owner': { fieldtype: 'Link', options: 'User' },
                            'modified': { fieldtype: 'Date' },
                            'modified_by': { fieldtype: 'Link', options: 'User' }
                        }
                        for (let h of this.header) {
                            if (['name', 'creation', 'owner', 'modified', 'modified_by'].includes(h.fieldname)) {
                                this.columns.push({ fieldname: h.fieldname, label: h.label, ...ft[h.fieldname] });
                                continue;
                            } else {
                                let field = columns.message.find(f => f.fieldname === h.fieldname);
                                if (field) {
                                    this.columns.push(field);
                                }
                            }
                        }
                    } else {
                        this.columns = [...columns.message.filter(f => f.in_list_view)];
                    }
                    this.rows = await this.getDocList();
                    this.table_element = this.createTable();
                    if (!this.table_wrapper.querySelector('table') && !reset) {
                        this.table_wrapper.appendChild(this.table_element);
                    } else {
                        this.table_wrapper.querySelector('table').replaceWith(this.table_element);
                    }
                    this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
                    if (!this.wrapper.querySelector('#table_wrapper') && !reset) {
                        this.wrapper.appendChild(this.table_wrapper);
                    } else {
                        this.wrapper.querySelector('#table_wrapper').replaceWith(this.table_wrapper);
                    }
                    this.tBody = this.table.querySelector('tbody');
                    this.setupFooter(this.wrapper);
                } else {
                    this.handleNoPermission();
                }
            } else {
                console.log("Permission issues", this.doctype);
            }
        } else {
            this.table_element = this.createTable();
            if (!this.table_wrapper.querySelector('table')) {
                this.table_wrapper.appendChild(this.table_element);
            }
            this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
            if (!this.wrapper.querySelector('#table_wrapper')) {
                this.wrapper.appendChild(this.table_wrapper);
            }
            this.tBody = this.table.querySelector('tbody');
        }
        loader.hide();
    }
    setupHeader() {
        let row = document.createElement('div');
        row.id = 'header-element';
        row.style = `
            display: flex;
            justify-content: space-between; /* Ensures left and right alignment */
            width: 100%;
        `
        let leftColStyle = `
            display: flex;
            justify-content: flex-start; /* Aligns items to the left */
            gap: 10px;
        `
        let rightColStyle = `
            display: flex;
            justify-content: flex-end; /* Aligns items to the right */
            gap: 10px;
        `;
        // add button to import data
        // if (this.permissions?.length && this.permissions.includes('create')) {
        // let import_button = document.createElement('button');
        // import_button.id = 'import_button';
        // import_button.classList.add('btn', 'btn-secondary', 'btn-sm');
        // import_button.textContent = 'Import';
        // import_button.style = 'margin-bottom:10px; margin-left: auto; margin-right: 14px;';

        // import_button.onclick = async () => {
        //     let dialog = new CustomListView({
        //         frm: this.frm,
        //         connection: this.connection
        //     });
        //     dialog.custom_import();
        // }
        // row.appendChild(import_button);
        // }
        let leftAlignedColumns = [];
        let rightAlignedColumns = [];

        let label_wrapper = document.createElement('div');
        label_wrapper.id = 'label-wrapper';
        label_wrapper.innerHTML = `<p style="font-weight:bold;">${this.label ? this.label : ' '}</p>`
        leftAlignedColumns.push(label_wrapper)

        let list_filter = document.createElement('div');
        list_filter.id = 'list_filter';
        list_filter.style = `
            padding-bottom: 10px;
        `;
        new CustomFilterArea({
            wrapper: list_filter,
            doctype: this.doctype,
            on_change: (filters) => {
                if (filters.length == 0) {
                    if (this.additional_list_filters.length) {
                        this.additional_list_filters = []
                        this.reloadTable(true);
                    }
                } else {
                    this.additional_list_filters = filters
                    this.reloadTable(true);
                }
            }
        })
        let options_wrapper = document.createElement('div');

        options_wrapper.id = 'options-wrapper';
        options_wrapper.appendChild(list_filter);

        rightAlignedColumns.push(options_wrapper);
        for (let e of leftAlignedColumns) {
            e.style = leftColStyle;
            row.appendChild(e)
        }
        for (let e of rightAlignedColumns) {
            e.style = rightColStyle;
            row.appendChild(e)
        }

        return row;
    }
    async setupWrapper(wrapper) {
        wrapper.style = `max-width:${this.options?.style?.width || '100%'}; width:${this.options?.style?.width || '100%'};};margin:0px !important;`;
        if (!wrapper.querySelector('div#header-element')) {
            wrapper.appendChild(this.setupHeader())
        }
        return wrapper;
    }
    createSettingsButton() {
        let list_view_settings = document.createElement('button');
        list_view_settings.id = 'list_view_settings';
        list_view_settings.classList.add('btn', 'btn-secondary', 'btn-sm');
        list_view_settings.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/>
        </svg>`;
        list_view_settings.onclick = async () => {
            list_view_settings.disabled = true;
            await this.setupListviewSettings();
            list_view_settings.disabled = false;
        }
        return list_view_settings;
    }
    async setupListviewSettings() {
        let dtmeta = await frappe.call({
            method: 'frappe_theme.api.get_meta',
            args: { doctype: this.doctype },
        });
        new ListSettings({
            doctype: this.doctype,
            meta: dtmeta.message,
            settings: { ...this.connection, listview_settings: JSON.stringify(this.header) },
            dialog_primary_action: async (listview_settings) => {
                await frappe.xcall('frappe.client.set_value', {
                    doctype: this.connection.doctype,
                    name: this.connection.name,
                    fieldname: 'listview_settings',
                    value: JSON.stringify(listview_settings ?? []),
                });
                this.header = listview_settings;
                this.reloadTable(true);
                frappe.show_alert({ message: __('Listview settings updated'), indicator: 'green' });
            }
        });
    }
    setupTableWrapper(tableWrapper) {
        tableWrapper.style = `
            max-width: ${this.options?.style?.width || '100%'};
            width: ${this.options?.style?.width || '100%'};
            height: auto;
            margin-bottom: 10px;
            margin-top: 0px;
            margin-left: 0px;
            margin-right: 0px;
            padding: 0;
            box-sizing: border-box;
            border-spacing: none;
        `;

        // Add CSS to overwrite Bootstrap's table styles
        const style = document.createElement('style');
        style.innerHTML = `
            .table-bordered thead th,
            .table-bordered thead td {
                border-bottom-width: 2px;
                padding-top: 0px !important;
                padding-bottom: 0px !important;
                vertical-align: middle;
                min-height: 32px !important;
                height: 32px;
                max-height: 32px !important;
            }
            .table th,
            .table td {
                padding: 0px 8px !important;
                vertical-align: middle;
            }
        `;
        tableWrapper.appendChild(style);

        return tableWrapper;
    }

    async setupFooter(wrapper) {
        let footer = document.createElement('div');
        footer.id = 'footer-element';
        footer.style = 'display:flex;width:100%;height:fit-content;justify-content:space-between;';
        if (!wrapper.querySelector('div#footer-element')) {
            wrapper.appendChild(footer);
        }
        let buttonContainer = document.createElement('div');
        buttonContainer.id = 'create-button-container';
        if (!wrapper.querySelector('div#footer-element').querySelector('div#create-button-container')) {
            wrapper.querySelector('div#footer-element').appendChild(buttonContainer);
        }
        if (this.frm.doc.docstatus == 0 && this.conf_perms.length && this.conf_perms.includes('create')) {
            if (this.permissions.length && this.permissions.includes('create')) {
                if (!wrapper.querySelector('div#footer-element').querySelector('div#create-button-container').querySelector('button#create')) {
                    const create_button = document.createElement('button');
                    create_button.id = 'create';
                    create_button.textContent = "Add row";
                    create_button.classList.add('btn', 'btn-secondary', 'btn-sm');
                    create_button.style = 'width:fit-content;height:fit-content; margin-bottom:10px;';
                    create_button.addEventListener('click', async () => {
                        await this.createFormDialog(this.doctype);
                    });
                    wrapper.querySelector('div#footer-element').querySelector('div#create-button-container').appendChild(create_button);
                }
            }
        }
        if (this.total > this.limit) {
            if (!wrapper.querySelector('div#footer-element').querySelector('div#pagination-element')) {
                wrapper.querySelector('div#footer-element').appendChild(this.setupPagination());
            }
        }
    }
    setupPagination() {
        let pagination = document.createElement('div');
        pagination.id = 'pagination-element';
        pagination.setAttribute('aria-label', 'Page navigation');
        pagination.setAttribute('style', 'font-size:12px !important;height:30px !important;');

        let paginationList = document.createElement('ul');
        paginationList.classList.add('pagination', 'justify-content-center');
        // Previous button
        let prevBtnItem = document.createElement('li');
        prevBtnItem.id = 'prevBtnItem';
        prevBtnItem.classList.add('page-item');
        let prevBtn = document.createElement('button');
        prevBtn.classList.add('page-link');
        prevBtn.textContent = 'Prev';
        prevBtn.addEventListener('click', async () => {
            if (this.page > 1) {
                this.page -= 1;
                this.rows = await this.getDocList();
                this.updateTableBody();
                this.updatePageButtons();
            }
        });
        prevBtnItem.appendChild(prevBtn);
        paginationList.appendChild(prevBtnItem);

        // Page numbers container
        this.pageButtonsContainer = paginationList;
        this.updatePageButtons();

        // Next button
        let nextBtnItem = document.createElement('li');
        nextBtnItem.id = 'nextBtnItem';
        nextBtnItem.classList.add('page-item');
        let nextBtn = document.createElement('button');
        nextBtn.classList.add('page-link');
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', async () => {
            if (this.page < Math.ceil(this.total / this.limit)) {
                this.page += 1;
                this.rows = await this.getDocList();
                this.updateTableBody();
                this.updatePageButtons();
            }
        });
        nextBtnItem.appendChild(nextBtn);
        paginationList.appendChild(nextBtnItem);

        pagination.appendChild(paginationList);
        return pagination;
    }

    updatePageButtons() {
        // Clear existing page buttons
        this.pageButtonsContainer.querySelectorAll('.page-item:not(:first-child):not(:last-child)').forEach(el => el.remove());
        if (this.page !== 1) {
            this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.remove('disabled');  // Disable if on first page
        } else {
            this.pageButtonsContainer.querySelector("#prevBtnItem")?.classList.add('disabled');  // Disable if on first page
        }
        if (this.page === Math.ceil(this.total / this.limit)) {
            this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.add('disabled');  // Disable if on last page
        } else {
            this.pageButtonsContainer.querySelector("#nextBtnItem")?.classList.remove('disabled');  // Disable if on last page
        }
        let totalPages = Math.ceil(this.total / this.limit);
        for (let i = 1; i <= totalPages; i++) {
            let pageItem = document.createElement('li');
            pageItem.classList.add('page-item');
            if (i === this.page) {
                pageItem.classList.add('active');
            }
            let pageBtn = document.createElement('button');
            pageBtn.classList.add('page-link');
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', async () => {
                if (i !== this.page) {
                    this.page = i;
                    this.rows = await this.getDocList();
                    this.updateTableBody();
                    this.updatePageButtons();
                }
            });
            pageItem.appendChild(pageBtn);
            this.pageButtonsContainer.insertBefore(pageItem, this.pageButtonsContainer.children[i]);
        }
    }
    get_permissions(doctype) {
        return new Promise((rslv, rjct) => {
            frappe.call({
                method: 'frappe_theme.api.get_permissions',
                args: { doctype },
                callback: function (response) {
                    rslv(response.message)
                },
                error: (err) => {
                    rjct(err);
                }
            });
        });
    }
    
    async createFormDialog(doctype, name = undefined, mode = 'create') {
        let res = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: this.doctype });
        let fields = res?.message;
        if (window?.SVADialog?.[this.doctype]) {
            window?.SVADialog?.[this.doctype](mode, fields);
            return;
        }
        if (window?.SVAHandleParentFieldProps) {
            let f = window?.SVAHandleParentFieldProps(fields, doctype, name, mode);
            if (f) {
                fields = [...f];
            }
        }
        if (mode === 'create' || mode === 'write') {
            if (name) {
                let doc = await this.sva_db.get_doc(doctype, name);
                for (const f of fields) {
                    f.onchange = this.onFieldValueChange?.bind(this)
                    if(this.frm?.['dt_events']?.[this.doctype]?.[f.fieldname]){
                        let change = this.frm['dt_events'][this.doctype][f.fieldname]
                        f.onchange = change.bind(this,this,mode,f);
                    }
                    if(f.set_only_once){
                        if(doc[f.fieldname]){
                            f.default = doc[f.fieldname];
                            f.read_only = 1;
                        }else{
                            f.reqd = 0;
                            f.hidden = 1;
                        }
                    }
                    if (f.fieldtype === "Table") {
                        let res = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: f.options });
                        let tableFields = res?.message;
                        for(let tf of tableFields){
                            if(this.frm?.['dt_events']?.[f.options]?.[tf.fieldname]){
                                let change = this.frm['dt_events'][f.options][tf.fieldname]
                                tf.onchange = change.bind(this,this,mode,tf);
                            }
                        }
                        f.fields = tableFields;
                        if (doc[f.fieldname].length) {
                            f.data = doc[f.fieldname].map((row) => {
                                let old_name = row.name;
                                delete row.name;
                                return { ...row, old_name };
                            });
                        }
                    }
                    if (doc[f.fieldname]) {
                        f.default = doc[f.fieldname];
                    }
                    if (f?.fetch_from) {
                        if (!f.default) {
                            let fetch_from = f.fetch_from.split('.');
                            let [parentfield, fieldname] = fetch_from;
                            let parentf = fields.find(f => f.fieldname === parentfield);
                            if (parentf?.options && parentf?.default) {
                                let doc = await this.sva_db.get_doc(parentf?.options, parentf?.default);
                                f.default = doc[fieldname];
                            }
                        }
                        f.read_only = 1;
                    }
                    if (f.fieldtype === 'Link') {
                        f.get_query = () => {
                            const filters = [];
                            if (this.uniqueness.column.length) {
                                if (this.uniqueness.column.includes(f.fieldname)) {
                                    let existing_options = this.rows?.map((item) => item[f.fieldname]);
                                    filters.push([f.options, 'name', 'not in', existing_options]);
                                }
                            }
                            if (f.link_filter) {
                                const [parentfield, filter_key] = f.link_filter.split("->");
                                filters.push([
                                    f.options,
                                    filter_key,
                                    '=',
                                    dialog.fields_dict[parentfield]?.value || `Please select ${parentfield}`,
                                ]);
                            }
                            return { filters };
                        };
                    }
                }
            } else {
                for (const f of fields) {
                    f.onchange = this.onFieldValueChange?.bind(this)
                    if(this.frm?.['dt_events']?.[this.doctype]?.[f.fieldname]){
                        let change = this.frm['dt_events'][this.doctype][f.fieldname]
                        f.onchange = change.bind(this,this,mode,f);
                    }
                    if (this.frm.parentRow) {
                        if (this.frm.parentRow[f.fieldname]) {
                            if (f.fieldname == "workflow_state") {
                                continue;
                            }
                            f.default = this.frm.parentRow[f.fieldname];
                            f.read_only = 1;
                        }
                    }
                    if (this.frm.doctype === f.options) {
                        f.default = this.frm.doc.name;
                        f.read_only = 1;
                    }
                    if (this.connection?.connection_type === 'Referenced') {
                        if (f.fieldname === this.connection.dt_reference_field) {
                            f.default = this.frm.doc.doctype;
                            f.read_only = 1;
                        }
                        if (f.fieldname === this.connection.dn_reference_field) {
                            f.default = this.frm.doc.name;
                            f.read_only = 1;
                        }
                    }
                    if (this.connection?.connection_type === 'Direct') {
                        if (f.fieldname === this.connection.link_fieldname) {
                            f.default = this.frm.doc.name;
                            f.read_only = 1;
                        }
                    }

                    if (f.fieldtype === 'Link') {
                        f.get_query = () => {
                            const filters = [];
                            if (this.uniqueness.column.length) {
                                if (this.uniqueness.column.includes(f.fieldname)) {
                                    let existing_options = this.rows?.map((item) => item[f.fieldname]);
                                    filters.push([f.options, 'name', 'not in', existing_options]);
                                }
                            }
                            if (f.link_filter) {
                                const [parentfield, filter_key] = f.link_filter.split("->");
                                filters.push([
                                    f.options,
                                    filter_key,
                                    '=',
                                    dialog.fields_dict[parentfield]?.value || `Please select ${parentfield}`,
                                ]);
                            }
                            return { filters };
                        };
                    }
                    if (f.fieldtype === "Table") {
                        let res = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: f.options });
                        let tableFields = res?.message;
                        for(let tf of tableFields){
                            if(this.frm?.['dt_events']?.[f.options]?.[tf.fieldname]){
                                let change = this.frm['dt_events'][f.options][tf.fieldname]
                                tf.onchange = change.bind(this,this,mode,tf);
                            }
                        }
                        f.fields = tableFields;
                        continue;
                    }
                    if (f?.fetch_from) {
                        let fetch_from = f.fetch_from.split('.');
                        let [parentfield, fieldname] = fetch_from;
                        let parentf = fields.find(f => f.fieldname === parentfield);
                        if (parentf?.options && parentf?.default) {
                            let doc = await this.sva_db.get_doc(parentf?.options, parentf?.default);
                            f.default = doc[fieldname];
                        }
                        f.read_only = 1;
                    }
                }
            }
        } else {
            let doc = await this.sva_db.get_doc(doctype, name);
            for (const f of fields) {
                if (f.fieldtype === 'Table MultiSelect') {
                    continue;
                }
                if (f.fieldtype === "Table") {
                    let res = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: f.options });
                    let tableFields = res?.message;
                    f.fields = tableFields;
                    f.cannot_add_rows = 1;
                    f.cannot_delete_rows = 1;
                    if (doc[f.fieldname].length) {
                        f.data = doc[f.fieldname];
                    }
                    continue;
                }
                if(['Attach','Attach Image'].includes(f.fieldtype)){
                    if (doc[f.fieldname]) {
                        f.fieldtype = 'HTML';
                        f.options = `
                            <div class="form-group horizontal">
                                <div class="clearfix">
                                    <label class="control-label" style="padding-right: 0px;">${f.label}</label>
                                    <span class="help"></span>
                                </div>
                                <div class="control-input-wrapper">
                                <div class="control-input" style="display: none;"></div>
                                <div class="control-value like-disabled-input ellipsis">
                                    <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                                        <use class="" href="#es-line-link"></use>
                                    </svg>
                                        <a href="${doc[f.fieldname]}" target="_blank">${doc[f.fieldname]}</a>
                                    </div>
                                    <div class="help-box small text-extra-muted hide"></div>
                                </div>
                            </div>
                        `;
                    } else {
                        f.default = '';
                        f.read_only = 1;
                    }
                    continue;
                }
                if (doc[f.fieldname]) {
                    f.default = doc[f.fieldname];
                    f.read_only = 1;
                } else {
                    f.default = '';
                    f.read_only = 1;
                }
            }
        }
        const dialog = new frappe.ui.Dialog({
            title: __(`Create ${__(this.connection?.title || doctype)}`),
            size: this.getDialogSize(fields),  // Available sizes: 'small', 'medium', 'large', 'extra-large'
            fields: fields || [],
            primary_action_label: ['create', 'write'].includes(mode) ? (name ? 'Update' : 'Create') : 'Close',
            primary_action: async (values) => {
                if (['create', 'write'].includes(mode)) {
                    if (!name) {
                        let response = await frappe.xcall('frappe.client.insert', {
                            doc: {
                                doctype: doctype,
                                ...values
                            }
                        });
                        if (response) {
                            this.rows.push(response);
                            this.updateTableBody();
                            frappe.show_alert({ message: `Successfully created ${__(this.connection?.title || doctype)}`, indicator: 'green' });
                            if(this.frm?.['dt_events']?.[this.doctype]?.['after_insert']){
                                let change = this.frm['dt_events'][this.doctype]['after_insert']
                                change(this,response);
                            }
                        }
                    } else {
                        let value_fields = fields.filter((f) => !['Section Break', 'Column Break', 'HTML', 'Button', 'Tab Break'].includes(f.fieldtype))
                        let updated_values = {};
                        for (let field of value_fields) {
                            let key = field.fieldname;
                            if (Array.isArray(values[key])) {
                                updated_values[key] = values[key].map((item) => {
                                    if (item.old_name) {
                                        return { ...item, name: item.old_name };
                                    }
                                    return item;
                                });
                            } else {
                                updated_values[key] = values[key] || '';
                            }
                        }
                        let response = await frappe.xcall('frappe.client.set_value', { doctype: doctype, name, fieldname: updated_values });
                        if (response) {
                            let rowIndex = this.rows.findIndex(r => r.name === name);
                            this.rows[rowIndex] = response;
                            this.updateTableBody();
                            frappe.show_alert({ message: `Successfully updated ${__(this.connection?.title || doctype)}`, indicator: 'green' });
                            if(this.frm?.['dt_events']?.[this.doctype]?.['after_update']){
                                let change = this.frm['dt_events'][this.doctype]['after_update']
                                change(this,response);
                            }
                        }
                    }
                }
                dialog.clear();
                dialog.hide();
                if(this.frm?.['dt_events']?.[this.doctype]?.['after_save']){
                    let change = this.frm['dt_events'][this.doctype]['after_save']
                    change(this,mode,values);
                }
            },
            secondary_action_label: 'Cancel',
            secondary_action: () => {
                dialog.clear();
                dialog.hide();
            }
        });
        if (['create', 'write'].includes(mode)) {
            dialog.get_secondary_btn().show();
        } else {
            dialog.get_secondary_btn().hide();
        }
        this.form_dialog = dialog;
        dialog.show();
        for (let [fieldname, field] of Object.entries(dialog.fields_dict)?.filter(([fieldname, field]) => field.df.fieldtype == "Date")) {
            if (field?.df?.min_max_depends_on) {
                let splitted = field.df.min_max_depends_on.split('->');
                let fn = splitted[0].split('.')[0];
                let doctype = splitted[0].split('.')[1];
                let min_field = splitted[1];
                let max_field = splitted[2] ? splitted[2] : '';
                if (dialog.get_value(fieldname)) {
                    if (this.sva_db.exists(doctype, dialog.get_value(fn))) {
                        let doc = await this.sva_db.get_doc(doctype, dialog.get_value(fn));
                        let option = {};
                        if (min_field && doc[min_field]) {
                            option['minDate'] = new Date(doc[min_field]);
                        }
                        if (max_field && doc[max_field]) {
                            option['maxDate'] = new Date(doc[max_field]);
                        }
                        dialog.fields_dict[fieldname].$input.datepicker(option);
                    }
                }
            }
        }
        if(this.frm?.['dt_events']?.[this.doctype]?.['after_render']){
            let change = this.frm['dt_events'][this.doctype]['after_render']
            change(this,mode);
        }
    }
    async deleteRecord(doctype, name) {
        frappe.confirm(`Are you sure you want to delete this ${__(this.connection?.title || doctype)}?`, async () => {
            await frappe.xcall('frappe.client.delete', { doctype, name });
            let rowIndex = this.rows.findIndex(r => r.name === name);
            this.rows.splice(rowIndex, 1);
            this.updateTableBody();
            frappe.show_alert({ message: `Successfully deleted ${__(this.connection?.title || doctype)}`, indicator: 'green' });
            if(this.frm?.['dt_events']?.[this.doctype]?.['after_delete']){
                let change = this.frm['dt_events'][this.doctype]['after_delete']
                change(this,name);
            }
        });
    }
    createTable() {
        const el = document.createElement('div');
        el.classList.add('form-grid-container', 'form-grid');
        el.style = 'overflow:auto;';
        this.table = document.createElement('table');
        this.table.classList.add('table', 'table-bordered');
        this.table.style = 'width:100%;height:auto; font-size:13px; margin-top:0px !important;margin-bottom: 0px;';
        this.table.appendChild(this.createTableHead());
        el.appendChild(this.table);
        this.table.appendChild(this.createTableBody());
        return el;
    }

    createTableHead() {
        const thead = document.createElement('thead');
        if (this.options?.additionalTableHeader) {
            thead.innerHTML = this.options?.additionalTableHeader?.join('') || '';
        }
        thead.style = `
            color:${this.options?.style?.tableHeader?.color || '#525252'};
            font-size:${this.options?.style?.tableHeader?.fontSize || '12px'};
            font-weight:${this.options?.style?.tableHeader?.fontWeight || 'normal'};
            z-index:3; font-weight:200 !important;white-space: nowrap;`
            ;
        const tr = document.createElement('tr');

        if (this.options.serialNumberColumn) {
            const serialTh = document.createElement('th');
            serialTh.textContent = '#';
            serialTh.style = 'width:40px;text-align:center;position:sticky;left:0px;background-color:#F3F3F3;';
            tr.appendChild(serialTh);
        }

        let left = 0;
        let freezeColumnsAtLeft = 1;

        this.columns.forEach(column => {
            const th = document.createElement('th');
            let col = this.header.find(h => h.fieldname === column.fieldname);
            if (col.width) {
                th.style = `min-width:${Number(col.width) * 50}px !important;max-width:${Number(col.width) * 50}px !important;width:${Number(col.width) * 50}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
            }
            th.textContent = column.label || column.name;

            if (column.sortable) {
                this.createSortingIcon(th, column); // Create the sorting dropdown
                if (col.width) {
                    th.style = `min-width:${Number(col.width) * 50}px !important;max-width:${Number(col.width) * 50}px !important;width:${Number(col.width) * 50}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;cursor:pointer;`;
                } else {
                    th.style = `cursor:pointer;`;
                }
            }

            if (this.options.freezeColumnsAtLeft && this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft) {
                if (col.width) {
                    th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${column.sortable ? 'pointer' : 'default'};min-width:${Number(col.width) * 50}px !important;max-width:${Number(col.width) * 50}px !important;width:${Number(col.width) * 50}px !important; white-space: nowrap;overflow: hidden;text-overflow:ellipsis;`;
                } else {
                    th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${column.sortable ? 'pointer' : 'default'}`;
                }
                left += column.width;
                freezeColumnsAtLeft++;
            }

            tr.appendChild(th);
        });
        // ========================= Workflow Logic ======================
        if (this.workflow && (this.wf_editable_allowed || this.wf_transitions_allowed)) {
            const addColumn = document.createElement('th');
            addColumn.textContent = this.connection.action_label ? this.connection.action_label : 'Approval';
            addColumn.style = 'text-align:center;';
            tr.appendChild(addColumn);
        }
        // ========================= Workflow End ======================
        if (((this.frm.doc.docstatus == 0 && this.conf_perms.length && (this.conf_perms.includes('read') || this.conf_perms.includes('delete') || this.conf_perms.includes('write')))) || this.childLinks?.length) {
            const action_th = document.createElement('th');
            action_th.style = 'width:5px; text-align:center;position:sticky;right:0px;background-color:#F3F3F3;';
            if (frappe.user_roles.includes("Administrator")) {
                action_th.appendChild(this.createSettingsButton());
                tr.appendChild(action_th);
            } else {
                if (this.conf_perms.length || this.childLinks?.length) {
                    tr.appendChild(action_th);
                    action_th.textContent = 'Actions'
                }
            }
        }
        thead.appendChild(tr);
        return thead;
    }

    createSortingIcon(th, column) {
        const sortIcon = document.createElement('span');
        sortIcon.className = 'sort-icon';
        sortIcon.style = 'margin-left:5px; cursor:pointer;';
        sortIcon.innerHTML = (this?.currentSort?.direction == 'desc' && this?.currentSort?.column == column.fieldname) ? '&darr;' : '&uarr;';  // Default icon (up arrow)
        th.appendChild(sortIcon);
        th.addEventListener('click', () => {
            const direction = this.currentSort?.column === column.fieldname && this.currentSort?.direction === 'asc' ? 'desc' : 'asc';
            this.sortByColumn(column, direction);
            if (direction === 'asc') {
                sortIcon.innerHTML = '&uarr;'; // Up arrow for ascending
            } else {
                sortIcon.innerHTML = '&darr;'; // Down arrow for descending
            }
        });
    }
    createActionColumn(row, primaryKey) {
        const positiveClosureState = this.workflow?.states?.find(s => s.custom_closure == "Positive");
        const dropdown = document.createElement('div');
        dropdown.classList.add('dropdown');

        const dropdownBtn = document.createElement('span');
        dropdownBtn.classList.add('h4');
        dropdownBtn.style.cursor = 'pointer';
        dropdownBtn.setAttribute('data-toggle', 'dropdown');
        dropdownBtn.innerHTML = "&#8942;";

        const dropdownMenu = document.createElement('div');
        dropdownMenu.classList.add('dropdown-menu');
        dropdownMenu.style.position = 'fixed';
        dropdownMenu.style.zIndex = '9999';
        dropdownMenu.style.display = 'none';

        const appendDropdownOption = (text, onClickHandler) => {
            const option = document.createElement('a');
            option.classList.add('dropdown-item');
            option.textContent = text;
            option.addEventListener('click', onClickHandler);
            dropdownMenu.appendChild(option);
        };

        // View Button
        if (this.conf_perms.length && this.permissions.length && this.permissions.includes('read')) {
            appendDropdownOption('View', async () => {
                await this.createFormDialog(this.doctype, primaryKey, 'view');
            });
        }

        // Edit and Delete Buttons
        if (!['1', '2'].includes(row.docstatus) && this.frm?.doc?.docstatus == 0) {
            if (this.permissions.includes('write')) {
                if (positiveClosureState && row['workflow_state']) {
                    if ((positiveClosureState.state != row['workflow_state'])) {
                        appendDropdownOption('Edit', async () => {
                            await this.createFormDialog(this.doctype, primaryKey, 'write');
                        });
                    }
                } else {
                    appendDropdownOption('Edit', async () => {
                        await this.createFormDialog(this.doctype, primaryKey, 'write');
                    });
                }
            }
            if (this.permissions.includes('delete')) {
                if (positiveClosureState && row['workflow_state']) {
                    if ((positiveClosureState.state != row['workflow_state'])) {
                        appendDropdownOption('Delete', async () => {
                            await this.deleteRecord(this.doctype, primaryKey);
                        });
                    }
                } else {
                    appendDropdownOption('Delete', async () => {
                        await this.deleteRecord(this.doctype, primaryKey);
                    });
                }
            }
        }

        // Child Links
        if (this.childLinks?.length) {
            this.childLinks.forEach(async (link) => {
                appendDropdownOption(link?.title || link.link_doctype, async () => {
                    await this.childTableDialog(link.link_doctype, primaryKey, row, link);
                });
            });
        }

        dropdown.appendChild(dropdownBtn);
        document.body.appendChild(dropdownMenu);

        const toggleDropdown = (event) => {
            event.stopPropagation();
            const rect = dropdownBtn.getBoundingClientRect();
            const dropdownWidth = dropdownMenu.offsetWidth || 150; // Default width in case offsetWidth is 0
            dropdownMenu.style.top = `${rect.bottom}px`;
            dropdownMenu.style.left = `${rect.left - dropdownWidth}px`; // Adjust position for left-side popup
            dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
        };

        dropdownBtn.addEventListener('click', toggleDropdown);

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdownMenu.style.display = 'none';
        });

        return dropdown;
    }

    createTableBody() {
        if (this.rows.length === 0) {
            return this.createNoDataFoundPage();
        }

        const tbody = document.createElement('tbody');
        this.tBody = tbody;
        let rowIndex = 0;
        const batchSize = this.options?.pageLimit || 30;
        tbody.style.whiteSpace = 'nowrap';

        if (this.currentSort) {
            this.sortByColumn(this.currentSort.column, this.currentSort.direction, false);
        }

        const renderBatch = async () => {
            const fragment = document.createDocumentFragment(); // Use a document fragment to batch DOM changes

            for (let i = 0; i < batchSize && rowIndex < this.rows.length; i++) {
                const row = this.rows[rowIndex];
                row.rowIndex = rowIndex;
                const tr = document.createElement('tr');
                let primaryKey = row?.name || row?.rowIndex || rowIndex?.id || rowIndex;
                tr.style.maxHeight = '32px';
                tr.style.height = '32px';
                tr.style.backgroundColor = '#fff';

                // Serial Number Column
                if (this.options.serialNumberColumn) {
                    const serialTd = document.createElement('td');
                    serialTd.style.minWidth = '40px';
                    serialTd.style.textAlign = 'center';
                    serialTd.style.position = 'sticky';
                    serialTd.style.left = '0px';
                    serialTd.style.backgroundColor = '#fff';

                    const serialNumber = this.page > 1
                        ? ((this.page - 1) * this.limit) + (rowIndex + 1)
                        : rowIndex + 1;

                    serialTd.innerHTML = `<a href="/app/${this.doctype?.split(' ').join('-')?.toLowerCase() || this.doctype.toLowerCase()}/${row['name']}">${serialNumber}</a>`;
                    tr.appendChild(serialTd);
                }

                let left = 0;
                let freezeColumnsAtLeft = 1;
                this.columns.forEach((column) => {
                    const td = document.createElement('td');
                    td.style = this.getCellStyle(column, freezeColumnsAtLeft, left);
                    if (this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft) {
                        left += column.width;
                        freezeColumnsAtLeft++;
                    }

                    td.textContent = row[column.fieldname] || '';
                    if (this.options.editable) {
                        this.createEditableField(td, column, row);
                    } else {
                        this.createNonEditableField(td, column, row);
                    }
                    tr.appendChild(td);
                });

                // ========================= Workflow Logic ===================
                if (this.workflow && (this.wf_editable_allowed || this.wf_transitions_allowed)) {
                    const bg = this.workflow_state_bg?.find(bg => bg.name === row['workflow_state'] && bg.style);
                    const closureStates = this.workflow?.states?.filter(s => ['Positive', 'Negative'].includes(s.custom_closure)).map(e => e.state);
                    const isClosed = closureStates.includes(row['workflow_state']);
                    const wfActionTd = document.createElement('td');
                    const el = document.createElement('select');
                    el.classList.add('form-select', 'rounded');
                    const titleText = this.workflow.transitions
                        .filter(link => frappe.user_roles.includes(link.allowed) && link.state === row['workflow_state'])
                        .map(e => `${e.action} by ${e.allowed}`)
                        .join("\n");

                    el.setAttribute('title', titleText);
                    el.style.width = '100px';
                    el.style.minWidth = '100px';
                    el.style.padding = '2px 5px';
                    el.classList.add(bg ? `bg-${bg.style.toLowerCase()}` : 'pl-[20px]', ...(bg ? ['text-white'] : []));
                    if (isClosed) {
                        el.disabled = true;
                        el.innerHTML = `<option value="" style="color:black" selected disabled>${row['workflow_state']}</option>`;
                        el.style['-webkit-appearance'] = 'none';
                        el.style['-moz-appearance'] = 'none';
                        el.style['appearance'] = 'none';
                        el.style['background-color'] = 'transparent';
                        el.style['text-align'] = 'center';
                        wfActionTd.appendChild(el);
                    } else {
                        el.disabled = this.frm?.doc?.docstatus !== 0 || closureStates.includes(row['workflow_state']) ||
                            !(this.workflow?.transitions?.some(tr => frappe.user_roles.includes(tr.allowed) && tr.state === row['workflow_state']));
                        el.innerHTML = `<option value="" style="color:black" selected disabled>${row['workflow_state']}</option>` +
                            [...new Set(this.workflow.transitions
                                .filter(link => frappe.user_roles.includes(link.allowed) && link.state === row['workflow_state'])
                                .map(e => e.action))]
                                .map(action => `<option value="${action}" style="background-color:white; color:black; cursor:pointer;" class="rounded p-1">${action}</option>`)
                                .join('');

                        el.addEventListener('change', async (event) => {
                            const action = event.target.value;
                            const link = this.workflow.transitions.find(l => l.action === action && frappe.user_roles.includes(l.allowed));
                            const originalState = el?.getAttribute('title');
                            if (link) {
                                if (window.onWorkflowStateChange) {
                                    await window.onWorkflowStateChange(this, link, primaryKey, el, originalState);
                                } else {
                                    await this.wf_action(link, primaryKey, el, originalState);
                                }
                                el.value = '';
                                el.title = originalState;
                            }
                        });

                        wfActionTd.appendChild(el);
                    }
                    wfActionTd.style.textAlign = 'center';
                    tr.appendChild(wfActionTd);
                }

                // ========================= Workflow End ===================
                if ((this.frm.doc.docstatus === 0 && this.conf_perms.length && (this.conf_perms.includes('delete') || this.conf_perms.includes('write'))) || this.childLinks?.length) {
                    const actionTd = document.createElement('td');
                    actionTd.style.minWidth = '50px';
                    actionTd.style.textAlign = 'center';
                    actionTd.style.position = 'sticky';
                    actionTd.style.right = '0px';
                    actionTd.style.backgroundColor = '#fff';
                    actionTd.appendChild(this.createActionColumn(row, primaryKey));
                    tr.appendChild(actionTd);
                }

                fragment.appendChild(tr);
                rowIndex++;
            }

            tbody.appendChild(fragment); // Append all rows at once to minimize reflows
        };

        const handleScroll = () => {
            const scrollTop = this.table_wrapper.scrollTop;
            if (scrollTop > this.lastScrollTop && this.table_wrapper.scrollTop + this.table_wrapper.clientHeight >= this.table_wrapper.scrollHeight) {
                renderBatch();
            }
            this.lastScrollTop = scrollTop;
        };

        this.table_wrapper.addEventListener('scroll', handleScroll);
        renderBatch();
        return tbody;
    }

    // ================================ Workflow Action  Logic ================================
    async wf_action(selected_state_info, docname, wf_select_el, prevState) {
        let me = this;
        const bg = me.workflow_state_bg?.find(bg => bg.name === selected_state_info.next_state && bg?.style);
        let meta = await frappe.call({
            method: 'frappe_theme.api.get_meta',
            args: { doctype: me.doctype },
        });
        const fields = meta?.message?.fields?.filter(field => {
            return field?.wf_state_field == selected_state_info.action
        })?.map(field => { return { label: field.label, fieldname: field.fieldname, fieldtype: field.fieldtype, reqd: 1, options: field.options } });

        const popupFields = [
            {
                label: "Action Test",
                fieldname: "action_test",
                fieldtype: "HTML",
                options: `<p>Action:  <span style="padding: 4px 8px; border-radius: 100px; color:white;  font-size: 12px; font-weight: 400;" class="bg-${bg?.style?.toLowerCase() || 'secondary'}">${selected_state_info.action}</span></p>`,
            },
            ...(fields ? fields : []),
        ];
        let dialog;
        const workflowFormValue = await new Promise((resolve) => {
            dialog = new frappe.ui.Dialog({
                title: "Confirm",
                size: this.getDialogSize(popupFields),
                fields: popupFields,
                primary_action_label: "Proceed",
                primary_action: (values) => {
                    resolve(values);
                },
                secondary_action_label: "Cancel",
                secondary_action: () => {
                    dialog.hide();
                    wf_select_el.value = ""; // Reset dropdown value
                    wf_select_el.title = prevState;
                    frappe.show_alert({ message: `${selected_state_info.action} Action has been cancelled.`, indicator: "orange" });
                },
            });
            dialog.show();
        });
        try {
            const updateFields = {
                [me.workflow.workflow_state_field]: selected_state_info.next_state,
                ...(workflowFormValue && workflowFormValue),
            };
            const response = await this.sva_db.set_value(me.doctype, docname, updateFields);
            dialog.hide();
            if (response?.exc) throw new Error("Update failed");
            const row = me.rows.find((r) => r.name === docname);
            row[me.workflow.workflow_state_field] = selected_state_info.next_state;
            if (workflowFormValue?.wf_comment) {
                row.wf_comment = workflowFormValue.wf_comment;
            } else {
                const comment = `${me.workflow.workflow_state_field} changed to ${selected_state_info.next_state}`;
                row.wf_comment = comment;
            }
            Object.assign(row, workflowFormValue);
            me.rows[row.rowIndex] = row;
            me.updateTableBody();
            frappe.show_alert({ message: `${selected_state_info.next_state} successfully`, indicator: "green" });
        } catch (error) {
            if (error.message) {
                frappe.throw({
                    title : 'Error',
                    message : error.message
                })
            }
            console.error(error);
        }
        if(this.frm?.['dt_events']?.[this.doctype]?.['after_workflow_action']){
            let change = this.frm['dt_events'][this.doctype]['after_workflow_action']
            change(this,selected_state_info,docname,prevState);
        }
    }

    // ================================ Workflow Action End ================================
    async childTableDialog(doctype, primaryKeyValue, parentRow, link) {
        const dialog = new frappe.ui.Dialog({
            title: __(link?.title || doctype),
            size: 'extra-large', // small, large, extra-large
            fields: [{
                fieldname: 'table',
                fieldtype: 'HTML',
                options: `<div id = "${doctype?.split(' ').length > 1 ? doctype?.split(' ')?.join('-')?.toLowerCase() : doctype.toLowerCase()}" ></div > `,
            }],
        });
        dialog.onhide = async function () {
            let updated_doc = await this.sva_db.get_doc(this.doctype, parentRow.name);
            let idx = this.rows.findIndex(r => r.name === parentRow.name);
            this.rows[idx] = updated_doc;
            this.updateTableBody();
        }.bind(this);
        $(dialog.$wrapper).on('show.bs.modal', function () {
            $(this).removeAttr('aria-hidden');
        });
        $(dialog.$wrapper).on('hidden.bs.modal', function () {
            $(this).attr('aria-hidden', 'true');
        });
        // let dialog_width = await frappe.db.get_single_value('My Theme', 'dialog_width');
        // $(dialog.$wrapper).find('.modal-dialog').css('max-width', dialog_width ?? '70%');
        dialog.show();
        new SvaDataTable({
            wrapper: dialog.body.querySelector(`#${doctype?.split(' ').length > 1 ? doctype?.split(' ')?.join('-')?.toLowerCase() : doctype.toLowerCase()}`), // Wrapper element
            doctype: doctype,
            connection: link,
            frm: { doctype: this.doctype, doc: { name: primaryKeyValue, docstatus: parentRow.docstatus }, parentRow },
            options: {
                serialNumberColumn: true,
                editable: false,
            },
        });
    }
    sortByColumn(column, direction, updateTable = true) {
        const columnName = column.fieldname || column;
        let sorted_rows = this.rows.sort((a, b) => {
            const valueA = a[columnName];
            const valueB = b[columnName];
            if (valueA === valueB) return 0;
            if (Number.isInteger(parseFloat(valueA)) && Number.isInteger(parseFloat(valueB))) {
                return direction === 'asc' ? Number(valueA) - Number(valueB) : Number(valueB) - Number(valueA);
            }
            if (direction === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });

        this.currentSort = { column: columnName, direction };
        if (updateTable) {
            this.updateTableBody();
        } else {
            return sorted_rows;
        }
    }

    updateTableBody() {
        if (this.rows.length === 0) {
            this.table.replaceChild(this.createNoDataFoundPage(), this.tBody);
            return;
        }
        const oldTbody = this.table.querySelector('tbody');
        const newTbody = this.createTableBody();
        this.table.replaceChild(newTbody, oldTbody || this.table.querySelector('#noDataFoundPage')); // Replace old tbody with new sorted tbody
    }

    getCellStyle(column, freezeColumnsAtLeft, left) {
        return this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft
            ? `position: sticky; left:${left} px; z-index: 2; background-color: white; min-width:${column.width} px; max-width:${column.width} px; padding: 0px`
            : `min-width:${column.width || 150} px; max-width:${column.width || 200} px; padding: 0px !important;`;
    }

    createEditableField(td, column, row) {
        const frm = this.frm;
        const childTableFieldName = this.childTableFieldName;
        td.textContent = "";
        let columnField = {
            ...column,
            onchange: function () {
                let changedValue = control.get_input_value();
                if (column.fieldtype === 'Percent') {
                    changedValue = parseFloat(changedValue);
                }
                if (row[column.fieldname] !== changedValue) {
                    let rowIndex = frm.doc[childTableFieldName].findIndex(r => r.name === row.name);
                    frm.doc[childTableFieldName][rowIndex][column.fieldname] = control.get_input_value();
                    frm.dirty();
                }
            }
        };

        columnField.get_query = () => {
            const filters = []
            if (column.additional_filters) {
                filters.push(...column.additional_filters);
            }
            if (column.link_filter) {
                const [parentfield, filter_key] = column.link_filter.split("->");
                let rowIndex = frm.doc[childTableFieldName].findIndex(r => r.name === row.name);
                filters.push([
                    column.options, filter_key, '=', frm.doc[childTableFieldName][rowIndex][parentfield]
                ])
            }
            if (column.doc_link_filters) {
                filters.push(...JSON.parse(column.doc_link_filters));
            }
            let keys = this.uniqueness?.row?.find(r => r.includes(column.fieldname));
            if (keys) {
                let rowIndex = frm.doc[childTableFieldName].findIndex(r => r.name === row.name);
                let _row = frm.doc[childTableFieldName][rowIndex]
                filters.push([
                    column.options,
                    'name',
                    'not in',
                    keys.map(k => _row[k]).filter(k => (k && k != columnField.fieldname))
                ]);
            }
            return { filters }
        };

        const control = frappe.ui.form.make_control({
            parent: td,
            df: columnField,
            render_input: true,
            only_input: true,
        });

        $(control.input).css({ width: '100%', height: '32px', backgroundColor: 'white', margin: '0px', boxShadow: 'none' });
        if (row[column.fieldname]) {
            control.set_value(row[column.fieldname]);
        }
        control.refresh();
    }

    createNonEditableField(td, column, row) {
        let col = this.header.find(h => h.fieldname === column.fieldname);
        td.textContent = "";
        let columnField = {
            ...column,
            read_only: 1,
            description: ''
        };
        if (column.fieldtype === 'Link') {
            if (frappe.utils.get_link_title(column.options, row[column.fieldname])) {
                td.innerText = frappe.utils.get_link_title(column.options, row[column.fieldname]) || "";
                td.title = frappe.utils.get_link_title(column.options, row[column.fieldname]) || "";
            } else {
                try {
                    frappe.utils.fetch_link_title(column.options, row[column.fieldname]).then(res => {
                        td.innerText = res || "";
                        td.title = res || "";
                    })
                } catch (error) {
                    td.innerText = row[column.fieldname] || "";
                    td.title = row[column.fieldname] || "";
                }
            }
            if (col.width) {
                $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
            } else {
                $(td).css({ height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
            }
            return;
        }
        if (['HTML'].includes(columnField.fieldtype)) {
            const control = frappe.ui.form.make_control({
                parent: td,
                df: columnField,
                render_input: true,
                only_input: true,
            });
            $(control.input).css({ width: '100%', height: '32px', backgroundColor: 'white', margin: '0px', fontSize: '12px', color: 'black', boxShadow: 'none', padding: '0px 5px', cursor: 'normal' });
            $(td).css({ height: '32px !important' });
            if (row[column.fieldname]) {
                control.set_value(row[column.fieldname]);
            }
            control.refresh();
            return;
        } else {
            if (columnField?.has_link) {
                let [doctype, link_field] = columnField.has_link.split('->');
                td.addEventListener('click', async () => {
                    await this.childTableDialog(doctype, link_field, row?.name, row);
                })
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px', cursor: 'pointer', color: 'blue' });
                }
            } else {
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                }
            }
            if (columnField.fieldtype === 'Currency') {
                td.innerHTML = formatCurrency(row[column.fieldname], frappe.sys_defaults.currency);
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px', textAlign: 'right' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px', textAlign: 'right' });
                }
                return;
            }
            if (columnField.fieldtype === 'Attach') {
                if (row[column.fieldname]) {
                    td.innerHTML = `<a href = "${row[column.fieldname]}" target = "_blank" >${row[column.fieldname]}</a> `;
                } else {
                    td.innerHTML = '';
                }
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                }
                return;
            }
            if (columnField.fieldtype === 'Attach Image') {
                if (row[column.fieldname]) {
                    td.innerHTML = `<img src = "${row[column.fieldname]}" style = "width:30px;border-radius:50%;height:30px;object-fit:cover;" /> `;
                    return;
                }
            }
            if (['Int', 'Float'].includes(columnField.fieldtype)) {
                td.innerText = row[column.fieldname].toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                }) || 0;
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px', textAlign: 'right' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px', textAlign: 'right' });
                }
                return;
            }
            if (['Date'].includes(columnField.fieldtype)) {
                td.innerText = row[column.fieldname] ? formaDate(row[column.fieldname]) : '';
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                }
                return;
            }
            if (columnField.fieldname == 'name') {
                td.innerHTML = `<a href = "/app/${this.doctype?.split(' ').length > 1 ? this.doctype?.split(' ')?.join('-')?.toLowerCase() : this.doctype.toLowerCase()}/${row[column.fieldname]}" > ${row[column.fieldname]}</a> `;
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
                }
                return;
            }
            if (columnField.fieldtype == 'Button') {
                let btn = document.createElement('button');
                btn.classList.add('btn', 'btn-secondary', 'btn-sm');
                btn.setAttribute('data-dt', this.doctype);
                btn.setAttribute('data-dn', row.name);
                btn.setAttribute('data-fieldname', columnField.fieldname);
                btn.onclick = this.onFieldClick;
                btn.textContent = columnField.label;
                td.appendChild(btn)
                if (col.width) {
                    $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', padding: '0px 5px' });
                } else {
                    $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', padding: '0px 5px' });
                }
                return;
            }
            td.textContent = row[column.fieldname] || "";
            if (col.width) {
                $(td).css({ width: `${Number(col.width) * 50}px`, minWidth: `${Number(col.width) * 50}px`, maxWidth: `${Number(col.width) * 50}px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
            } else {
                $(td).css({ width: `150px`, minWidth: `150px`, maxWidth: `150px`, height: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0px 5px' });
            }
            td.title = row[column.fieldname] || "";
        }
    }
    async getDocList() {
        try {
            let filters = []
            if (this.connection?.extended_condition && this.connection?.extended_condition) {
                try {
                    let cond = JSON.parse(this.connection.extended_condition)
                    if (Array.isArray(cond) && cond?.length) {
                        filters.push(cond);
                    }
                } catch (error) {
                    console.log("Exception: while parsing extended_condition", error);
                }
            }
            if (this.connection?.connection_type === 'Referenced') {
                filters.push([this.doctype, this.connection.dt_reference_field, '=', this.frm.doc.doctype]);
                filters.push([this.doctype, this.connection.dn_reference_field, '=', this.frm.doc.name]);
            } else {
                filters.push([this.doctype, this.connection.link_fieldname, '=', this.frm.doc.name]);
            }
            this.total = await frappe.db.count(this.doctype, { filters: filters });
            let res = await frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: this.doctype,
                    filters: [...filters, ...this.additional_list_filters],
                    fields: this.fields || ['*'],
                    limit_page_length: this.limit,
                    order_by: 'creation desc',
                    limit_start: this.page > 0 ? ((this.page - 1) * this.limit) : 0
                }
            });
            return res.message;
        } catch (error) {
            return [];
        }
    }
    createNoDataFoundPage() {
        const tr = document.createElement('tr');
        tr.id = 'noDataFoundPage';
        tr.style.height = '200px'; // Use viewport height to set a more responsive height
        tr.style.fontSize = '20px';
        const td = document.createElement('td');
        td.colSpan = (
            this.columns?.length ?? 3) + (
                (
                    this.options?.serialNumberColumn ? 1 : 0) +
                ((this.conf_perms.includes('write') || this.conf_perms.includes('delete')) ? 1 : 0) +
                ((this.wf_transitions_allowed || this.wf_editable_allowed) ? 1 : 0)
            ); // Ensure columns are defined properly

        td.innerHTML = `
                <div class="msg-box no-border">
                    <div class="mb-4">
                        <svg class="icon icon-xl" style="stroke: var(--text-light);">
                            <use href="#icon-small-file"></use>
                        </svg>
                    </div>
                    <p>You haven't created a record yet</p>

                </div>
        `
        tr.appendChild(td);
        return tr;
    }
    handleNoPermission() {
        let noPermissionPage = document.createElement('div');
        noPermissionPage.id = 'noPermissionPage';
        noPermissionPage.style.height = '100%';
        noPermissionPage.style.fontSize = '20px';
        noPermissionPage.style.textAlign = 'center';
        noPermissionPage.style.paddingTop = '50px';
        noPermissionPage.style.color = 'grey';
        noPermissionPage.textContent = "You do not have permission through role permission to access this resource.";
        if (!this.wrapper.querySelector('#noPermissionPage')) {
            this.wrapper.appendChild(noPermissionPage);
        }
    }
    getDialogSize(fields) {
        let hasChildTable = fields.some(field => field.fieldtype === "Table");
        let hasMultipleColumns = false;

        let currentColumnCount = 0; // Track columns in a section
        for (let field of fields) {
            if (field.fieldtype === "Section Break") {
                currentColumnCount = 0; // Reset column count on new section
            } else if (field.fieldtype === "Column Break") {
                currentColumnCount++; // Increase column count
            }

            if (currentColumnCount >= 1) { // At least one column break = 2 columns
                hasMultipleColumns = true;
            }
        }

        if (hasChildTable) {
            return "extra-large";  // Child tables require more space
        } else if (hasMultipleColumns) {
            return "large";  // Sections with 2+ columns need a larger dialog
        } else {
            return "small"; // Default size
        }
    }

}

