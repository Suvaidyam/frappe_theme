class SVALinkedUser {
    constructor(frm, wrapper) {
        this.frm = frm;
        this.wrapper = wrapper;
        this.user_list = [];
        this.permissions = [];
        this.total_pages = 1;
        this.currentPage = 1;
        this.render_user();
        return this.wrapper;
    }
    getPermissions() {
        return new Promise((rslv, rjct) => {
            frappe.call({
                method: 'frappe_theme.api.get_permissions',
                args: { doctype: "SVA User" },
                callback: function (response) {
                    rslv(response.message)
                },
                error: (err) => {
                    rjct(err);
                }
            });
        });
    }
    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    createTable() {
        let el = document.createElement('div');
        el.style = 'overflow-y:auto;'
        el.className = 'form-grid-container form-grid';

        const canWrite = this.permissions.includes('write');
        const canDelete = this.permissions.includes('delete');

        el.innerHTML = `
            <table style="margin: 0px !important;" class="table table-bordered">
                <thead style="font-size: 12px;">
                    <tr>
                        <th class="row-check sortable-handle col" style="width: 40px; text-align: center; position: sticky; left: 0px; background-color: #F8F8F8;">
                           <!-- <input type="checkbox" id="selectAllCheckBox"> -->
                           #
                        </th>
                        <th class="static-area ellipsis" style="color:#525252; font-size: 13px;">Full Name</th>
                        <th class="static-area ellipsis" style="color:#525252; font-size: 13px;">Role Profile</th>
                        <th class="static-area ellipsis" style="color:#525252; font-size: 13px;">Email</th>
                        <th class="static-area ellipsis" style="color:#525252; font-size: 13px;">Status</th>
                        ${(canWrite || canDelete) ? '<th class="static-area ellipsis" style="color:#525252; font-size: 13px;">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody style="background-color: #fff; font-size: 12px;">
                    ${this.user_list.length === 0
                ? `
                            <tr>
                                <td colspan="9" style="height:92px; text-align: center; font-size: 14px; color: #6c757d; background-color: #F8F8F8; line-height: 92px;">
                                    You haven't created a record yet
                                </td>
                            </tr>
                            `
                : this.user_list.map((user, index) => `
                            <tr class="grid-row">
                                <td class="row-check sortable-handle col" style="width: 40px; text-align: center; position: sticky; left: 0px; background-color: #fff;">
                                   <!-- <input type="checkbox" class="toggleCheckbox" data-id="${user.name}"> -->
                                    <a href="${frappe.utils.get_form_link('SVA User', user.name, false)}">${index + 1}</a>
                                </td>
                                <td class="col grid-static-col col-xs-3 ">${user.full_name}</td>
                                <td style="white-space: nowrap;"> ${user.role_profile}</td>
                                <td style="white-space: nowrap;">${user.email}</td>
                                <td style="padding: 5px 8px !important;">
                                    <div class="dropdown" style="width: 100px; height: 26px; border-radius: 4px; background-color: #F1F1F1; color: #0E1116; font-weight: 400; font-size: 14px; line-height: 15.4px; letter-spacing: 0.25%; display: flex; align-items: center; justify-content: center; gap: 4px">
                                    ${canWrite ? `
                                        <span title="Status" id="dropStatus-${user.name}" class="small dropdown-toggle badge bg-light pointer ${user.status === 'Active' ? 'text-success' : 'text-danger'}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                            ${user?.status}
                                        </span>
                                        <div class="dropdown-menu" aria-labelledby="dropStatus-${user.name}">
                                            <a class="dropdown-item user-status" data-user="${user.name}" data-status="Active">Active</a>
                                            <a class="dropdown-item user-status" data-user="${user.name}" data-status="Inactive">Inactive</a>
                                        </div>`
                        : `<span class="${user?.status == 'Active' ? 'text-success' : 'text-danger'} small">${user.status}</span>`}
                                    </div>
                                </td>
                                ${(canWrite || canDelete) ? `
                                    <td>
                                        <div class="dropdown">
                                            <span title="action" class="pointer d-flex justify-content-center align-items-center" id="dropdownMenuButton-${user.name}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                ⋮
                                            </span>
                                            <div class="dropdown-menu" aria-labelledby="dropdownMenuButton-${user.name}">
                                                ${canWrite ? `<a class="dropdown-item edit-btn" data-user="${user.name}">Edit</a>` : ''}
                                                ${canWrite ? `<a class="dropdown-item reset-pass-btn" data-user="${user.email}">Reset Password</a>` : ''}
                                            </div>
                                        </div>
                                    </td> 
                                ` : ''}
                            </tr>
                        `).join('')}
                </tbody>
            </table>
        `
        return el;
    }
    createFooter() {
        let el = document.createElement('div');
        el.className = 'd-flex flex-wrap py-2 justify-content-between';

        let totalPages = this.total_pages;
        let currentPage = this.currentPage;
        const canCreate = this.permissions.includes('create');

        const getPagination = () => {
            if (totalPages <= 7) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
            }

            let pages = new Set([1, 2, totalPages - 1, totalPages]);

            if (currentPage > 3) pages.add(currentPage - 1);
            if (currentPage > 2) pages.add(currentPage);
            if (currentPage < totalPages - 1) pages.add(currentPage + 1);

            let result = [];
            let prev = 0;
            [...pages].sort((a, b) => a - b).forEach(page => {
                if (prev && page - prev > 1) {
                    result.push("...");
                }
                result.push(page);
                prev = page;
            });

            return result;
        };

        el.innerHTML = `
            <div class="d-flex align-items-center" style="gap: 8px;">
            <!-- <div id="task-header"></div> -->
            ${canCreate ? `
                <button style="height:30px;" class="btn btn-secondary btn-sm" id="createTask">
                    <svg class="es-icon es-line icon-xs" aria-hidden="true">
                        <use href="#es-line-add"></use>
                    </svg> Add row
                </button>
            ` : ''}
            </div>
            ${totalPages > 1 ? `
                <nav aria-label="Page navigation">
                    <ul class="pagination">
                        <li class="page-item">
                            <a style="padding: 0.35rem 0.75rem !important;" class="page-link prev-page ${currentPage == 1 ? 'disabled' : ''}" aria-label="Previous">
                                <span aria-hidden="true">&laquo;</span>
                            </a>
                        </li>
                        ${getPagination().map(p => `
                            <li class="page-item ${p == currentPage ? 'active' : ''} ${p === "..." ? "disabled" : ""}">
                                <a style="padding: 0.35rem 0.75rem !important;" class="page-link">${p}</a>
                            </li>
                        `).join('')}
                        <li class="page-item">
                            <a style="padding: 0.35rem 0.75rem !important;" class="page-link next-page ${currentPage == totalPages ? 'disabled' : ''}" aria-label="Next">
                                <span aria-hidden="true">&raquo;</span>
                            </a>
                        </li>
                    </ul>
                </nav>
            ` : ''}
        `;

        return el;
    }

    noDataFound() {
        let el = document.createElement('div');
        el.style = 'flex-direction: column; height: 200px;'
        e.addClass('d-flex justify-content-center align-items-center')
        el.innerHTML = `
            <svg class="icon icon-xl" style="stroke: var(--text-light);">
                <use href="#icon-small-file"></use>
            </svg>
            <p class="text-muted">You haven't created a Recored yet</p>
        `
        return el;
    }
    async render_user() {
        try {
            this.permissions = await this.getPermissions();
            // Check if user has at least read permission
            if (!this.permissions.includes('read')) {
                const noPermissionDiv = document.createElement('div');
                noPermissionDiv.style.cssText = `
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 20px;
                    text-align: center;
                    padding: 50px;
                    color: var(--gray-600);
                `;
                noPermissionDiv.textContent = "You do not have permission through role permission to access this resource.";
                this.wrapper.appendChild(noPermissionDiv);
                return;
            }

            let limit = 10;
            let user_permission = await frappe.db.get_list('User Permission', {
                fields: ['user'],
                limit: 1000,
                filters: {
                    allow: this.frm.doctype,
                    for_value: this.frm.docname
                }
            });
            user_permission = [...new Set(user_permission.map(item => item.user))];;

            let total_records = await frappe.db.count('SVA User', {
                filters: {
                    email: ['IN', user_permission],
                }
            }
            );

            this.total_pages = Math.ceil(total_records / limit);
            this.currentPage = Math.max(1, Math.min(this.currentPage, this.total_pages));
            let start = (this.currentPage - 1) * limit;

            this.user_list = await frappe.db.get_list('SVA User', {
                fields: ['*'],
                filters: {
                    email: ['IN', user_permission],
                },
                order_by: 'modified desc',
                start: start,
                limit: limit,
            }); // Store reference
            let selectedIds = [];
            if (document.getElementById('task-list')) {
                document.getElementById('task-list').remove();
            }
            let task_container = document.createElement('div');
            task_container.classList.add('task-list');
            task_container.id = 'task-list';
            task_container.innerHTML = `
                <div id="task-body"></div>
                <div id="task-footer"></div>
            `
            task_container.querySelector('#task-body').appendChild(this.createTable());
            task_container.querySelector('#task-footer').appendChild(this.createFooter());
            this.wrapper.appendChild(task_container);

            const toggleVisibility = (show) => {
                if (show) {
                    // let action_bar = this.getActionBar();
                    task_container.querySelector('#task-header').innerHTML = '';
                    task_container.querySelector('#task-header').appendChild(this.getActionBar());

                    // bulk delete
                    $('#bulkDeleteButton').on('click', function () {
                        frappe.confirm('Are you sure you want to delete the selected users?', async () => {
                            this.user_list = this.user_list.filter(user => !selectedIds.includes(user.name))
                            for (const userName of selectedIds) {
                                try {
                                    await frappe.db.delete_doc('SVA User', userName);
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                } catch (error) {
                                    console.error(`Failed to delete ${userName}:`, error);
                                }
                            }
                            this.render_user();
                            frappe.show_alert({ message: __('Users deleted successfully'), indicator: 'green' });
                        });
                    }.bind(this));
                } else {
                    task_container.querySelector('#task-header').innerHTML = '';
                }
            };

            // Bind event for individual checkboxes
            $(document).off('change', '.toggleCheckbox').on('change', '.toggleCheckbox', function (e) {
                const id = $(e.currentTarget).data('id');
                if (e.currentTarget.checked) {
                    selectedIds.push(id);
                } else {
                    selectedIds = selectedIds.filter(x => x !== id);
                }
                $('#selectAllCheckBox').prop('checked', selectedIds.length === this.user_list.length);
                toggleVisibility(selectedIds.length > 0);
            }.bind(this));

            // Bind event for "Select All" checkbox
            $(document).off('change', '#selectAllCheckBox').on('change', '#selectAllCheckBox', function (e) {
                const isChecked = $(e.currentTarget).prop('checked');
                $('.toggleCheckbox').prop('checked', isChecked);
                selectedIds = isChecked ? this.user_list?.map(x => x.name) : [];
                toggleVisibility(selectedIds.length > 0);
            }.bind(this));

            // New User
            if (this.permissions.includes('create')) {
                $('#createTask').off('click').on('click', function () {
                    this.form(null, 'New User', this.frm);
                }.bind(this));
            }

            // User Status
            if (this.permissions.includes('write')) {
                $('.user-status').on('click', function (e) {
                    const name = $(e.currentTarget).data('user');
                    const newStatus = $(e.currentTarget).data('status');
                    frappe.db.set_value('SVA User', name, 'status', newStatus).then(() => {
                        this.render_user();
                        frappe.show_alert({ message: __('User status updated successfully'), indicator: 'green' });
                    })
                }.bind(this));
            }

            if (this.permissions.includes('write')) {
                $('.reset-pass-btn').off('click').on('click', function (e) {
                    const user = $(e.currentTarget).data('user');
                    frappe.confirm('Are you sure you want to reset your password?', () => {
                        frappe.call({
                            method: "frappe.core.doctype.user.user.reset_password",
                            args: {
                                user: user,
                            }
                        });
                    });
                }.bind(this));
            }

            if (this.permissions.includes('write')) {
                $('.edit-btn').off('click').on('click', function (e) {
                    const userName = $(e.currentTarget).data('user');
                    let data = this.user_list.filter(user => user.name === userName);
                    if (data.length) {
                        this.form(data[0], 'Edit User');
                    } else {
                        console.error(`User ${userName} not found.`);
                    }
                }.bind(this));
            }

            // pageination
            // Unbind existing event listeners before binding new ones
            $(document).off('click', '.page-link').on('click', '.page-link', (e) => {
                let page = Number($(e.target).text());
                if (!isNaN(page)) {
                    this.render_user();
                    this.createFooter();
                    this.currentPage = page;
                }
            });

            $(document).off('click', '.prev-page').on('click', '.prev-page', (e) => {
                if (this.currentPage > 1) {
                    this.render_user();
                    this.createFooter();
                    this.currentPage = (this.currentPage - 1)
                }
            });

            $(document).off('click', '.next-page').on('click', '.next-page', (e) => {
                if (this.currentPage < this.total_pages) {
                    this.render_user();
                    this.createFooter();
                    this.currentPage = (this.currentPage + 1)
                }
            });

        } catch (error) {
            console.error('Error in render_user:', error);
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 20px;
                text-align: center;
                padding: 50px;
                color: var(--gray-600);
            `;
            errorDiv.textContent = `Failed to initialize: ${error.message || error}`;
            this.wrapper.appendChild(errorDiv);
        }
    }

    deleteUser = async (taskName) => {
        let user = await frappe.db.get_doc('SVA User', taskName);
        await frappe.db.delete_doc('SVA User', taskName).then(() => {
            this.render_user();
            frappe.show_alert({ message: __(`User deleted successfully`), indicator: 'green' });
        });
        let all_rows = await frappe.db.get_list('User Permission', {
            fields: ['name'],
            filters: {
                user: user.email,
            }
        });
        for (const row of all_rows) {
            await frappe.db.delete_doc('User Permission', row.name);
        }
    }
    async form(data = null, action, frm) {
        let label = cur_frm.active_tab_map[cur_frm.doc.name].label;
        let title = action === 'New User' ? 'New ' + label : 'Edit ' + label;
        let primaryActionLabel = action === 'New User' ? 'Save' : 'Update';

        let fileds = await frappe.call({
            method: 'frappe.desk.form.load.getdoctype',
            args: {
                doctype: 'SVA User',
                with_parent: 1,
                cached_timestamp: frappe.datetime.now_datetime()
            }
        });

        // Create the dialog form
        let fields = fileds?.docs[0]?.fields.filter((field) =>
            ['role_profile', 'first_name', 'last_name', 'email', 'mobile_number'].includes(field.fieldname)
        ).map(field => {
            if (action === 'Edit User' && data) {
                if (data[field.fieldname]) {
                    field.default = data[field.fieldname];
                }
                if (field.fieldname === 'email') {
                    field.read_only = 1;
                }
            }
            if (field.fieldname === 'role_profile') {
                if (['NGO', 'Donor', 'Vendor'].includes(cur_frm.doctype)) {
                    field.get_query = function () {
                        return {
                            filters: {
                                'custom_belongs_to': cur_frm.doctype.toLowerCase()
                            }
                        }
                    }
                }
            }

            return field;
        });
        let user_form = new frappe.ui.Dialog({
            title: title,
            fields: fields,
            primary_action_label: primaryActionLabel,
            primary_action: async function (values) {
                let regex = /^[6-9]\d{9}$/;
                if (values.mobile_number && !regex.test(values.mobile_number)) {
                    frappe.msgprint('Please enter valid mobile number');
                    return;
                }
                if (action === 'New User') {

                    if (await frappe.db.exists("SVA User", { 'email': values.email })) {
                        frappe.throw(__('This email address is already in use.'));
                    }

                    frappe.db.insert({
                        doctype: "SVA User",
                        ...values
                    }).then(async (new_doc) => {
                        if (new_doc) {
                            await frappe.db.insert({
                                doctype: "User Permission",
                                user: new_doc.email,
                                allow: cur_frm.doctype,
                                for_value: cur_frm.docname,
                                apply_to_all_doctypes: 1
                            })
                            frappe.show_alert({ message: __('User created successfully'), indicator: 'green' });
                            await this.render_user();
                            this.createFooter();
                            this.currentPage = 1;
                            user_form.hide();
                        }
                    }).catch(error => {
                        console.error(error);
                        frappe.show_alert({ message: __('There was an error creating the user'), indicator: 'red' });
                    });
                } else if (action === 'Edit User' && data) {
                    // Update existing task logic
                    frappe.db.set_value('SVA User', data.name, values).then(updated_doc => {
                        if (updated_doc) {
                            frappe.show_alert({ message: __('User updated successfully'), indicator: 'green' });
                            this.user_list = this.user_list.map(user => {
                                if (user.name === data.name) {
                                    user = { ...user, ...values };
                                }
                                return user;
                            });
                            this.render_user();
                            this.createFooter();
                            this.currentPage = 1;
                            user_form.hide();
                        }
                    }).catch(error => {
                        console.error(error);
                        frappe.show_alert({ message: __('There was an error updating the user'), indicator: 'red' });
                    });
                }
            }.bind(this)

        });

        if (action === 'Edit User' && data) {
            user_form.set_values(data);
        }
        user_form.show();
    };

    // getActionBar() {
    //     let el = document.createElement('div');
    //     el.innerHTML= `
    //     <button id="bulkDeleteButton" class="btn mx-8" style="color: #fff;background-color: #E03636;">
    //         Delete
    //     </button>
    //     `
    //     return el;
    // }

    // Update Task Status
    //  async updateTaskStatus(taskIds, status, key) {

    //     await Promise.allSettled(
    //         taskIds.map((taskName, index) =>
    //             new Promise(resolve => setTimeout(resolve, index * 200)) // Apply delay
    //                 .then(() => frappe.db.set_value('ToDo', taskName, key, status))
    //                 .then(() => {
    //                     this.user_list = this.user_list.map(task => {
    //                         if (task.name === taskName) {
    //                             task[key] = status;
    //                         }
    //                         return task;
    //                     });
    //                 })
    //                 .catch(error => console.error(`Error updating ${taskName}:`, error))
    //         )
    //     );

    //     this.render_user()
    //     frappe.show_alert({ message: __('tasks updated successfully'), indicator: 'green' });

    //     // if (cur_frm) cur_frm.refresh();
    // }
}

export default SVALinkedUser;