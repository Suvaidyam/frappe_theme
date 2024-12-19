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

    constructor({ wrapper, columns = [], rows = [], limit = 10, childLinks = [], connection, options, frm, cdtfname, doctype, render_only = false }) {
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
        this.wrapper = this.setupWrapper(wrapper);
        this.uniqueness = this.options?.uniqueness || { row: [], column: [] };
        this.table_wrapper = document.createElement('div');
        this.table_wrapper.id = 'table_wrapper';
        this.table = null;
        this.permissions = [];
        this.mgrant_settings = {};
        if (!render_only) {
            if (this.conf_perms.length && this.conf_perms.includes('read')) {
                this.get_permissions(this.doctype).then(async perms => {
                    this.permissions = perms;
                    this.mgrant_settings = await frappe.db.get_doc('mGrant Settings', 'mGrant Settings');
                    if (this.frm.doctype == "Grant" && await frappe.db.exists("mGrant Settings Grant Wise",this.frm.doc.name)){
                        let msgw = await frappe.db.get_doc("mGrant Settings Grant Wise",this.frm.doc.name)
                        if (msgw){
                            this.mgrant_settings = msgw
                        }
                    }
                    if (perms.length && perms.includes('read')) {
                        if (this.header.length) {
                            let columns = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: this.doctype });
                            this.columns = [{
                                fieldname: 'name',
                                label: 'ID'
                            }, ...columns?.message?.filter(f => this.header.includes(f.fieldname))]
                            await this.setupTotalCount();
                            this.rows = await this.getDocList()
                            this.table = this.createTable();
                            if (!this.table_wrapper.querySelector('table')) {
                                this.table_wrapper.appendChild(this.table);
                            }
                            this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
                            if (!this.wrapper.querySelector('#table_wrapper')) {
                                this.wrapper.appendChild(this.table_wrapper);
                            }
                            this.tBody = this.table.querySelector('tbody');
                            this.setupFooter(this.wrapper);
                        }
                    } else {
                        this.handleNoPermission();
                    }
                })
            }
        } else {
            this.table = this.createTable();
            if (!this.table_wrapper.querySelector('table')) {
                this.table_wrapper.appendChild(this.table);
            }
            this.table_wrapper = this.setupTableWrapper(this.table_wrapper);
            if (!this.wrapper.querySelector('#table_wrapper')) {
                this.wrapper.appendChild(this.table_wrapper);
            }
            this.tBody = this.table.querySelector('tbody');
        }
        return this.wrapper;
    }

    setupWrapper(wrapper) {
        wrapper.style = `max-width:${this.options?.style?.width || '100%'}; width:${this.options?.style?.width || '100%'};max-height:${this.options?.style?.height || '500px'}; height:${this.options?.style?.height || '500px'};`;
        if (!wrapper.querySelector('div#header-element')) {
            let header = document.createElement('div');
            header.id = 'header-element';
            header.style = 'display:flex;justify-content:space-between;align-items:center;padding:0px 0px 5px 0px;';
            wrapper.appendChild(header);
        }

        if (!wrapper.querySelector('div#header-element').querySelector('div#count-wrapper')) {
            let count_wrapper = document.createElement('div');
            count_wrapper.id = 'count-wrapper';
            wrapper.querySelector('div#header-element').appendChild(count_wrapper);
        }
        return wrapper;
    }
    setupTableWrapper(tableWrapper) {
        tableWrapper.style = `max-width:${this.options?.style?.width || '100%'}; width:${this.options?.style?.width || '100%'};max-height:90%;min-height:110px;margin:0; padding:0;box-sizing:border-box; overflow:auto;scroll-behavior:smooth;`;
        return tableWrapper;
    }
    async setupTotalCount() {
        if (!this.wrapper.querySelector('#header-element').querySelector('#count-wrapper').querySelector('#count-element')) {
            let filters = []
            if (this.connection?.connection_type === 'Referenced') {
                filters.push([this.doctype, this.connection.dt_reference_field, '=', this.frm.doc.doctype]);
                filters.push([this.doctype, this.connection.dn_reference_field, '=', this.frm.doc.name]);
            } else {
                filters.push([this.doctype, this.connection.link_fieldname, '=', this.frm.doc.name]);
            }
            this.total = await frappe.db.count(this.doctype, { filters: filters });
            let count = document.createElement('span');
            count.id = 'count-element';
            count.innerHTML = `<span>Total records: ${this.total}</span>`;
            count.style = 'font-size:12px;';
            this.wrapper.querySelector('#header-element').querySelector('#count-wrapper').appendChild(count);
        } else {
            let filters = []
            if (this.connection?.connection_type === 'Referenced') {
                filters.push([this.doctype, this.connection.dt_reference_field, '=', this.frm.doc.doctype]);
                filters.push([this.doctype, this.connection.dn_reference_field, '=', this.frm.doc.name]);
            } else {
                filters.push([this.doctype, this.connection.link_fieldname, '=', this.frm.doc.name]);
            }
            this.total = await frappe.db.count(this.doctype, { filters: filters });
            this.wrapper.querySelector('#header-element').querySelector('#count-wrapper').querySelector('#count-element').innerHTML = `<span>Total records: ${this.total}</span>`;
        }
    }
    async setupFooter(wrapper) {
        let footer = document.createElement('div');
        footer.id = 'footer-element';
        footer.style = 'display:flex;width:100%;height:fit-content;margin-top:10px;align-items:center;justify-content:space-between;';
        if (!wrapper.querySelector('div#footer-element')) {
            wrapper.appendChild(footer);
        }
        let buttonContainer = document.createElement('div');
        buttonContainer.id = 'create-button-container';
        if (!wrapper.querySelector('div#footer-element').querySelector('div#create-button-container')) {
            wrapper.querySelector('div#footer-element').appendChild(buttonContainer);
        }
        if (this.conf_perms.length && this.conf_perms.includes('create')) {
            if (this.permissions.length && this.permissions.includes('create')) {
                if (!wrapper.querySelector('div#footer-element').querySelector('div#create-button-container').querySelector('button#create')) {
                    const create_button = document.createElement('button');
                    create_button.id = 'create';
                    create_button.textContent = "Create";
                    create_button.classList.add('btn', 'btn-primary', 'btn-sm');
                    create_button.style = 'width:fit-content;height:fit-content;';
                    create_button.addEventListener('click', async () => {
                        await this.createFormDialog(this.doctype);
                    });
                    wrapper.querySelector('div#footer-element').querySelector('div#create-button-container').appendChild(create_button);
                }
            }
        }
        if (this.total > this.limit) {
            if (!wrapper.querySelector('div#footer-element').querySelector('div#pagination-element')) {
                wrapper.querySelector('div#footer-element').appendChild(await this.setupPagination());
            }
        }
    }
    async setupPagination() {
        let pagination = document.createElement('div');
        pagination.id = 'pagination-element';
        pagination.setAttribute('aria-label', 'Page navigation');
        pagination.setAttribute('style', 'font-size:12px !important;height:33px !important;');

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

    manipulateFieldLabels(field) {
        const year_type = this.mgrant_settings?.year_type || "Financial Year";
        let new_label = false;

        if (year_type === "Financial Year") {
            if (field.fieldname.startsWith('q1_')) {
                new_label = field.label + ' (Apr-Jun)';
            } else if (field.fieldname.startsWith('q2_')) {
                new_label = field.label + ' (Jul-Sep)';
            } else if (field.fieldname.startsWith('q3_')) {
                new_label = field.label + ' (Oct-Dec)';
            } else if (field.fieldname.startsWith('q4_')) {
                new_label = field.label + ' (Jan-Mar)';
            }
        } else if (year_type === "Calendar Year") {
            if (field.fieldname.startsWith('q1_')) {
                new_label = field.label + ' (Jan-Mar)';
            } else if (field.fieldname.startsWith('q2_')) {
                new_label = field.label + ' (Apr-Jun)';
            } else if (field.fieldname.startsWith('q3_')) {
                new_label = field.label + ' (Jul-Sep)';
            } else if (field.fieldname.startsWith('q4_')) {
                new_label = field.label + ' (Oct-Dec)';
            }
        }
    
        return new_label;
    }
    
    sortFields(fields) {
        const calendarYearOrder = [
            "q1_", "jan_", "feb_", "mar_", 
            "q2_", "apr_", "may_", "jun_", 
            "q3_", "jul_", "aug_", "sep_", 
            "q4_", "oct_", "nov_", "dec_"
        ];
    
        // Separate target and achievement fields for sorting
        const targetFields = [];
        const achievementFields = [];
        const fieldPositions = []; // To track original order of all fields
    
        fields.forEach((field, index) => {
            if (field.fieldname.includes("target")) {
                targetFields.push(field);
            } else if (field.fieldname.includes("achievement")) {
                achievementFields.push(field);
            } else {
                fieldPositions.push({ field, index }); // Store other fields with their positions
            }
        });
    
        // Sort target and achievement fields based on the calendar year order
        const sortedTargets = targetFields.sort((a, b) => {
            const aIndex = calendarYearOrder.findIndex(prefix => a.fieldname.startsWith(prefix));
            const bIndex = calendarYearOrder.findIndex(prefix => b.fieldname.startsWith(prefix));
            return aIndex - bIndex;
        });
    
        const sortedAchievements = achievementFields.sort((a, b) => {
            const aIndex = calendarYearOrder.findIndex(prefix => a.fieldname.startsWith(prefix));
            const bIndex = calendarYearOrder.findIndex(prefix => b.fieldname.startsWith(prefix));
            return aIndex - bIndex;
        });
    
        // Replace target and achievement fields in their original positions
        let targetIndex = 0, achievementIndex = 0;
        return fields.map(field => {
            if (field.fieldname.includes("target")) {
                return sortedTargets[targetIndex++];
            } else if (field.fieldname.includes("achievement")) {
                return sortedAchievements[achievementIndex++];
            } else {
                return field; // Keep other fields in their original positions
            }
        });
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
                if (i !== this.page) {  // Only update if it's a different page
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

    async get_permissions(doctype) {
        let res = await frappe.call({
            method: 'frappe_theme.api.get_permissions',
            args: { doctype },
            callback: function (response) {
                return response.message
            },
            error: (err) => {
                console.error(err);
            }
        });
        return res?.message ?? [];
    }

    async createFormDialog(doctype, name = undefined) {
        let res = await frappe.call('frappe_theme.api.get_meta_fields', { doctype: this.doctype });
        let fields = res?.message;
        let year_type = this.mgrant_settings?.year_type || "Financial Year";
        if (year_type === "Calendar Year" && ['Input','Output','Outcome','Impact'].includes(doctype)) {
            fields = this.sortFields(fields);
        }
        if (name) {
            let doc = await frappe.db.get_doc(doctype, name);
            fields.forEach(async f => {
                if(this.manipulateFieldLabels(f)){
                    f.label = this.manipulateFieldLabels(f);
                };
                if (doc[f.fieldname]) {
                    f.default = doc[f.fieldname];
                }
            })
        } else {
            await fields.forEach(async f => {
                if(this.manipulateFieldLabels(f)){
                    f.label = this.manipulateFieldLabels(f);
                };
                if (this.frm.parentRow) {
                    if (this.frm.parentRow[f.fieldname]) {
                        f.default = this.frm.parentRow[f.fieldname];
                        f.read_only = 1;
                    }
                }
                if (this.frm.doctype == f.options) {
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
                        const filters = []
                        if (this.uniqueness.column.length) {
                            if (this.uniqueness.column.includes(f.fieldname)) {
                                let existing_options = this.rows?.map((item) => { return item[f.fieldname] })
                                filters.push([f.options, 'name', 'not in', existing_options])
                            }
                        }
                        if (f.link_filter) {
                            const [parentfield, filter_key] = f.link_filter.split("->");
                            filters.push([
                                f.options, filter_key, '=', dialog.fields_dict[parentfield]?.value || `Please select ${parentfield}`
                            ])
                        }
                        return { filters }
                    }
                }
            })
        }
        const dialog = new frappe.ui.Dialog({
            title: `Create ${doctype}`,
            fields: fields || [],
            primary_action_label: name ? 'Update' : 'Create',
            primary_action: async (values) => {
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
                    }
                } else {
                    let response = await frappe.xcall('frappe.client.set_value', { doctype: doctype, name, fieldname: values });
                    if (response) {
                        let rowIndex = this.rows.findIndex(r => r.name === name);
                        this.rows[rowIndex] = response;
                        this.updateTableBody();
                    }
                }
                dialog.clear();
                dialog.hide();
                await this.setupTotalCount();
            },
            secondary_action_label: 'Cancel',
            secondary_action: () => {
                dialog.clear();
                dialog.hide();
            }
        });
        dialog.show();
    }
    async deleteRecord(doctype, name) {
        frappe.confirm(`Are you sure you want to delete this ${doctype}?`, async () => {
            await frappe.xcall('frappe.client.delete', { doctype, name });
            let rowIndex = this.rows.findIndex(r => r.name === name);
            this.rows.splice(rowIndex, 1);
            this.updateTableBody();
        });
    }
    createTable() {
        const table = document.createElement('table');
        table.classList.add('table', 'table-bordered');
        table.style = 'width:100%; font-size:13px; margin-top:0px !important; position:relative;';
        table.appendChild(this.createTableHead());
        table.appendChild(this.createTableBody());
        return table;
    }

    createTableHead() {
        const thead = document.createElement('thead');
        if (this.options?.additionalTableHeader) {
            thead.innerHTML = this.options?.additionalTableHeader?.join('') || '';
        }
        thead.style = `
            color:${this.options?.style?.tableHeader?.color || 'black'};
            font-size:${this.options?.style?.tableHeader?.fontSize || '12px'};
            font-weight:${this.options?.style?.tableHeader?.fontWeight || 'normal'};
            position:sticky; top: 0px; background-color:#F3F3F3; 
            text-align:center; z-index:3; font-weight:200 !important;`
            ;
        const tr = document.createElement('tr');

        if (this.options.serialNumberColumn) {
            const serialTh = document.createElement('th');
            serialTh.style = 'width:40px';
            tr.appendChild(serialTh);
        }

        let left = 0;
        let freezeColumnsAtLeft = 1;

        this.columns.forEach(column => {
            if(this.manipulateFieldLabels(column)){
                column.label = this.manipulateFieldLabels(f);
            };
            const th = document.createElement('th');
            th.textContent = column.label || column.name;

            if (column.sortable) {
                this.createSortingIcon(th, column); // Create the sorting dropdown
                th.style = 'cursor:pointer'; // Add pointer cursor to indicate clickable
            }

            if (this.options.freezeColumnsAtLeft && this.options.freezeColumnsAtLeft >= freezeColumnsAtLeft) {
                th.style = `position:sticky; left:${left}px; z-index:2; background-color:#F3F3F3;cursor:${column.sortable ? 'pointer' : 'default'}`;
                left += column.width;
                freezeColumnsAtLeft++;
            }

            tr.appendChild(th);
        });

        if (this.conf_perms.length && (this.conf_perms.includes('delete') || this.conf_perms.includes('write'))) {
            const action_th = document.createElement('th');
            action_th.style.width = '30px';
            // action_th.textContent = "Actions";
            tr.appendChild(action_th);
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

    createTableBody() {
        if (this.rows.length === 0) {
            return this.createNoDataFoundPage();
        }
        const tbody = document.createElement('tbody');
        this.tBody = tbody;
        let rowIndex = 0;
        const batchSize = this.options?.pageLimit || 30;
        tbody.style = `
            font-size:${this.options?.style?.tableBody?.fontSize || '12px'};
            font-weight:${this.options?.style?.tableBody?.fontWeight || 'normal'};
            color:${this.options?.style?.tableBody?.color || 'black'};
            background-color:${this.options?.style?.tableBody?.backgroundColor || 'transparent'};`
            ;
        if (this.currentSort) {
            this.sortByColumn(this.currentSort.column, this.currentSort.direction, false);
        }
        const renderBatch = async () => {
            for (let i = 0; i < batchSize && rowIndex < this.rows.length; i++) {
                const row = this.rows[rowIndex];
                row.rowIndex = rowIndex;
                const tr = document.createElement('tr');
                let primaryKey = row?.name || row?.rowIndex || rowIndex?.id || rowIndex;
                tr.style = 'max-height:25px !important; height:25px !important;';

                if (this.options.serialNumberColumn) {
                    const serialTd = document.createElement('td');
                    serialTd.style = 'min-width:40px; text-align:center;';
                    if (this.page > 1) {
                        serialTd.textContent = ((this.page - 1) * this.limit) + (rowIndex + 1);
                    } else {
                        serialTd.textContent = rowIndex + 1;
                    }
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

                    td.textContent = row[column.fieldname] || "";
                    if (this.options.editable) {
                        this.createEditableField(td, column, row);
                    } else {
                        this.createNonEditableField(td, column, row);
                    }
                    tr.appendChild(td);
                });

                if (this.conf_perms.length || this.childLinks?.length) {
                    const action_td = document.createElement('td');
                    action_td.style = 'min-width:100px; text-align:center;';
                    const dropdown = document.createElement('div');
                    dropdown.classList.add('dropdown');

                    const dropdownBtn = document.createElement('span');
                    dropdownBtn.classList.add('h4');
                    dropdownBtn.style = 'cursor:pointer;';
                    dropdownBtn.setAttribute('data-toggle', 'dropdown');
                    dropdownBtn.innerHTML = "&#8942;";

                    const dropdownMenu = document.createElement('div');
                    dropdownMenu.classList.add('dropdown-menu');
                    if (this.conf_perms.length && this.conf_perms.includes('write')) {
                        if (this.permissions.length && this.permissions.includes('write')) {
                            const editOption = document.createElement('a');
                            editOption.classList.add('dropdown-item');
                            editOption.textContent = "Edit";
                            editOption.addEventListener('click', async () => {
                                await this.createFormDialog(this.doctype, primaryKey);
                            });
                            dropdownMenu.appendChild(editOption);
                        }
                    }
                    if (this.conf_perms.length && this.conf_perms.includes('delete')) {
                        if (this.permissions.length && this.permissions.includes('delete')) {
                            const deleteOption = document.createElement('a');
                            deleteOption.classList.add('dropdown-item');
                            deleteOption.textContent = "Delete";
                            deleteOption.addEventListener('click', async () => {
                                await this.deleteRecord(this.doctype, primaryKey);
                            });
                            dropdownMenu.appendChild(deleteOption);
                        }
                    }
                    if (this.childLinks?.length) {
                        this.childLinks.forEach(async link => {
                            const linkOption = document.createElement('a');
                            linkOption.classList.add('dropdown-item');
                            linkOption.textContent = link.link_doctype;
                            linkOption.addEventListener('click', async () => {
                                await this.childTableDialog(link.link_doctype, primaryKey, row, link);
                            });
                            dropdownMenu.appendChild(linkOption);
                        });
                    }
                    dropdown.appendChild(dropdownBtn);
                    dropdown.appendChild(dropdownMenu);
                    action_td.appendChild(dropdown);
                    if (dropdownMenu.children?.length > 0) {
                        tr.appendChild(action_td);
                    }
                }

                this.tBody.appendChild(tr);
                rowIndex++;
            }
        };

        const handleScroll = () => {
            const scrollTop = this.table_wrapper.scrollTop;
            if (scrollTop > this.lastScrollTop) {
                if (this.table_wrapper.scrollTop + this.table_wrapper.clientHeight >= this.table_wrapper.scrollHeight) {
                    renderBatch();
                }
            }
            this.lastScrollTop = scrollTop;
        };

        this.table_wrapper.addEventListener('scroll', handleScroll);
        renderBatch();
        return tbody;
    }
    async childTableDialog(doctype, primaryKeyValue, parentRow, link) {
        const dialog = new frappe.ui.Dialog({
            title: doctype,
            fields: [{
                fieldname: 'table',
                fieldtype: 'HTML',
                options: `<div id="${doctype?.split(' ').length > 1 ? doctype?.split(' ')?.join('-')?.toLowerCase() : doctype.toLowerCase()}"></div>`,
            }],
        });
        dialog.onhide = async function () {
            let updated_doc = await frappe.db.get_doc(this.doctype, parentRow.name);
            let idx = this.rows.findIndex(r => r.name === parentRow.name);
            this.rows[idx] = updated_doc;
            this.updateTableBody();
        }.bind(this);
        let dialog_width = await frappe.db.get_single_value('My Theme', 'dialog_width');
        $(dialog.$wrapper).find('.modal-dialog').css('max-width', dialog_width ?? '70%');
        dialog.show();
        new SvaDataTable({
            wrapper: dialog.body.querySelector(`#${doctype?.split(' ').length > 1 ? doctype?.split(' ')?.join('-')?.toLowerCase() : doctype.toLowerCase()}`), // Wrapper element
            doctype: doctype,
            connection: link,
            frm: { doctype: this.doctype, doc: { name: primaryKeyValue }, parentRow },
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
            ? `position:sticky; left:${left}px; z-index:2; background-color:white; min-width:${column.width}px; max-width:${column.width}px; padding:0px`
            : `min-width:${column.width}px; max-width:${column.width}px; padding:0px;`;
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

        $(control.input).css({ width: '100%', height: '35px', backgroundColor: 'white', margin: '0px', boxShadow: 'none' });
        if (row[column.fieldname]) {
            control.set_value(row[column.fieldname]);
        }
        control.refresh();
    }

    createNonEditableField(td, column, row) {
        td.textContent = "";
        let columnField = {
            ...column,
            read_only: 1
        };
        if (['Link', 'HTML'].includes(columnField.fieldtype)) {
            const control = frappe.ui.form.make_control({
                parent: td,
                df: columnField,
                render_input: true,
                only_input: true,
            });
            $(control.input).css({ width: '100%', height: '35px', backgroundColor: 'white', margin: '0px', boxShadow: 'none' });
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
                $(td).css({ height: '35px', padding: "6px 10px", cursor: 'pointer', color: 'blue' });
            } else {
                $(td).css({ height: '35px', padding: "6px 10px" });
            }
            if (columnField.fieldtype === 'Attach') {
                td.innerHTML = `<a href="${row[column.fieldname]}" target="_blank">${row[column.fieldname]}</a>`;
                return;
            }
            if (columnField.fieldtype === 'Attach Image') {
                if (row[column.fieldname]) {
                    td.innerHTML = `<img src="${row[column.fieldname]}" style="width:30px;border-radius:50%;height:30px;object-fit:cover;" />`;
                    return;
                }
            }
            if (columnField.fieldname === 'name') {
                td.innerHTML = `<a href="/app/${this.doctype?.split(' ').length > 1 ? this.doctype?.split(' ')?.join('-')?.toLowerCase() : this.doctype.toLowerCase()}/${row[column.fieldname]}">${row[column.fieldname]}</a>`;
                return;
            } else {
                td.textContent = row[column.fieldname] || "";
            }
        }
    }
    async getDocList() {
        try {
            let filters = []
            if (this.connection?.connection_type === 'Referenced') {
                filters.push([this.doctype, this.connection.dt_reference_field, '=', this.frm.doc.doctype]);
                filters.push([this.doctype, this.connection.dn_reference_field, '=', this.frm.doc.name]);
            } else {
                filters.push([this.doctype, this.connection.link_fieldname, '=', this.frm.doc.name]);
            }
            let res = await frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: this.doctype,
                    filters: filters,
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
        const noDataFoundPage = document.createElement('tr');
        noDataFoundPage.id = 'noDataFoundPage';
        noDataFoundPage.style.height = '300px'; // Use viewport height to set a more responsive height
        noDataFoundPage.style.fontSize = '20px';
        const noDataFoundText = document.createElement('td');
        noDataFoundText.colSpan = (this.columns?.length ?? 3) + ((this.options?.serialNumberColumn ? 1 : 0) + ((this.conf_perms.includes('write') || this.conf_perms.includes('delete')) ? 1 : 0)); // Ensure columns are defined properly
        noDataFoundText.style.textAlign = 'center'; // Center the text horizontally
        noDataFoundText.style.paddingTop = '30px';
        noDataFoundText.style.color = 'grey';
        noDataFoundText.textContent = "No data found!";
        noDataFoundPage.appendChild(noDataFoundText);
        return noDataFoundPage;
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
}

