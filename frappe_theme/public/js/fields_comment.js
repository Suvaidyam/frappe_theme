// Place these function definitions near the top of the file, outside any other function scopes.
const primaryColor = frappe.boot.my_theme?.button_background_color || '#171717';
// Variable to store the context of the currently viewed field's comments
let current_field_context = null;

// Add these color constants at the top of the file with other constants
const STATUS_COLORS = {
    'Open': '#4A90E2',      // Blue
    'Resolved': '#50C878',  // Green
    'Closed': '#FF4444'     // Red
};

// Add this helper function to get status color
function getStatusColor(status) {
    return STATUS_COLORS[status] || '#A9A9A9';
}

// Add permission check function
function check_comment_permissions() {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'frappe_theme.api.get_permissions',
            args: { doctype: 'DocType Field Comment' },
            callback: function (response) {
                resolve(response.message);
            },
            error: function (err) {
                reject(err);
            }
        });
    });
}

const getLightColor = (color) => {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    // Lighten by 40%
    return `rgb(${Math.min(255, r + 102)}, ${Math.min(255, g + 102)}, ${Math.min(255, b + 102)})`;
};

const getLighterColor = (color) => {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    // Lighten by 60%
    return `rgb(${Math.min(255, r + 153)}, ${Math.min(255, g + 153)}, ${Math.min(255, b + 153)})`;
};

const getUserColor = (username) => {
    const colors = [
        '#4A90E2', // Light Blue
        '#50C878', // Light Green
        '#FFA07A', // Light Salmon
        '#B19CD9', // Light Purple
        '#FF6B6B', // Light Red
        '#48D1CC', // Light Turquoise
        '#D2B48C', // Light Brown
        '#A9A9A9', // Light Gray
        '#BDB76B', // Light Olive
        '#FFB6C1'  // Light Pink
    ];
    // Generate a consistent index based on username
    const index = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
};

// Place this function definition near the top of the file, outside any other function scopes.
function get_comment_html(comment, commentMap) {
    const userColor = getUserColor(comment.user);
    const isCurrentUser = comment.user === frappe.session.user;

    // Render the comment content as Markdown
    const renderedComment = frappe.format(comment.comment, 'Markdown');
    return `
        <div class="comment-item" style="margin-bottom: 28px; position: relative; display: flex; ${isCurrentUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
            ${!isCurrentUser ? `
                <div style="background: ${userColor}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ${getUserAvatar(frappe.user.full_name(comment.user))}
                </div>
            ` : ''}
            <div style="width: fit-content; max-width: 80%;">
                ${!isCurrentUser ? `
                    <div style="margin-bottom: 6px;">
                        <div style="font-weight: 600; font-size: 13px; color: ${userColor}; display: flex; align-items: center; gap: 6px;">
                            ${frappe.user.full_name(comment.user)}
                            <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">${frappe.datetime.prettyDate(comment.creation_date)}</span>
                            ${comment.is_external && frappe.boot.user_team !== 'NGO' ? `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#1976d2">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                <div class="comment-content" style="padding: 12px 16px; border-radius: 16px; border: 1px solid #ececec; position: relative; background: ${isCurrentUser ? '#f5f7fa' : '#fff'}; margin-bottom: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); width: fit-content;">
                    ${!isCurrentUser ? `
                        <div style="position: absolute; left: -7px; top: 16px; width: 12px; height: 12px; background: #fff; border-left: 1px solid #ececec; border-bottom: 1px solid #ececec; transform: rotate(45deg);"></div>
                    ` : `
                        <div style="position: absolute; right: -7px; top: 16px; width: 12px; height: 12px; background: #f5f7fa; border-right: 1px solid #ececec; border-bottom: 1px solid #ececec; transform: rotate(45deg);"></div>
                    `}
                    <div style="font-size: 14px; line-height: 1.6; color: #222; word-wrap: break-word; white-space: pre-wrap;word-break: break-all; overflow-wrap: anywhere;">${renderedComment}</div>
                </div>
                <div style="display: flex; justify-content: ${isCurrentUser ? 'flex-end' : 'flex-start'}; margin-top: 4px; align-items: center; gap: 8px;">
                    ${isCurrentUser ? `
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                            ${frappe.datetime.prettyDate(comment.creation_date)}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; align-items: center; gap: 8px; flex-direction: column; margin-left: 10px;">
                ${isCurrentUser ? `
                    <div style="background: ${userColor}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-left: 10px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        ${frappe.user.full_name(comment.user)}
                    </div>
               
                    ${comment.is_external && frappe.boot.user_team !== 'NGO' ? `
                        <span style="margin-left: 10px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1976d2">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </span>
                    ` : ''}
                 ` : ''}
            </div>
        </div>
    `;
}

// Add this new function after the get_comment_html function
function create_new_comment_thread(fieldName, field, frm) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe_theme.api.create_new_comment_thread",
            args: {
                doctype_name: frm.doctype,
                docname: frm.docname,
                field_name: fieldName,
                field_label: field.df.label || fieldName
            },
            callback: function (response) {
                if (response.message) {
                    // Reload comments to show the new thread
                    load_field_comments(fieldName, field, frm).then(() => {
                        // Update total comment count badge
                        updateTotalCommentCount(frm);
                        frappe.show_alert({
                            message: __('New comment thread created'),
                            indicator: 'green'
                        });
                        resolve(response.message);
                    });
                } else {
                    frappe.show_alert({
                        message: __('Error creating new comment thread'),
                        indicator: 'red'
                    });
                    reject();
                }
            },
            error: function (err) {
                frappe.show_alert({
                    message: __('Error creating new comment thread'),
                    indicator: 'red'
                });
                reject(err);
            }
        });
    });
}

// Move these functions outside the refresh event handler
function load_field_comments(fieldName, field, frm) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe_theme.api.load_field_comments",
            args: {
                doctype_name: frm.doctype,
                docname: frm.docname,
                field_name: fieldName
            },
            callback: function (response) {
                const comments_list = $('.field-comments-sidebar').find('.comments-list');
                comments_list.empty();

                // Create field section first
                const field_section = $(`
                    <div class="field-comment-section" style="margin-bottom: 25px; padding: 15px; border-radius: 12px; border: none; box-shadow: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            <h5 style="margin: 0; font-size: 15px;">${field.df.label || fieldName}</h5>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-default btn-sm new-thread-btn" style="padding: 4px 8px; display: none;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="threads-container"></div>
                    </div>
                `);

                // Add click handler for new thread button
                field_section.find('.new-thread-btn').click(() => {
                    create_new_comment_thread(fieldName, field, frm);
                });

                // Process each thread
                if (response.message && response.message.threads) {
                    // Filter threads for NGO users - only show threads that have comments
                    let threadsToShow = response.message.threads;
                    if (frappe.boot.user_team === 'NGO') {
                        threadsToShow = response.message.threads.filter(thread =>
                            thread.comments && thread.comments.length > 0
                        );
                    }

                    threadsToShow.forEach((thread, index) => {
                        const thread_section = $(`
                            <div class="thread-section" style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: ${index === 0 ? 'var(--fg-color)' : 'var(--bg-color)'}; border: 1px solid var(--border-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <div class="status-pill-container" style="margin-left: auto;">
                                        ${renderStatusPill(thread.status || 'Open')}
                                    </div>
                                </div>
                                <div class="field-comments"></div>
                                <div class="comment-input" style="margin-top: 15px; display: none;">
                                    <div style="display: flex; align-items: center;">
                                        <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                            <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `);

                        // Initialize status tracking for this thread
                        let currentStatus = thread.status || 'Open';

                        // Set initial status and show status selector only if there are comments
                        if (thread.comments && thread.comments.length > 0) {
                            thread_section.find('.status-pill-container').show();
                            // Disable status select if status is Closed
                            if (currentStatus === 'Closed') {
                                thread_section.find('.status-pill').css({
                                    'opacity': '0.7',
                                    'cursor': 'not-allowed'
                                });
                                thread_section.find('.comment-input').hide();
                            }
                        }

                        // Add status change handler
                        thread_section.find('.status-pill').click((e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        });

                        // Use event delegation for status option clicks
                        thread_section.on('click', '.status-option', (e) => {
                            e.preventDefault();
                            const newStatus = $(e.target).data('status');
                            const statusPill = thread_section.find('.status-pill');

                            // Check permissions before allowing status change
                            check_comment_permissions().then(permissions => {
                                if (!permissions.includes('write')) {
                                    frappe.show_alert({
                                        message: __('You do not have permission to change status'),
                                        indicator: 'red'
                                    });
                                    return;
                                }

                                // Validate status transition
                                if (!isValidStatusTransition(currentStatus, newStatus)) {
                                    let validNextStatuses = '';
                                    if (currentStatus === 'Open') {
                                        validNextStatuses = 'Resolved';
                                    } else if (currentStatus === 'Resolved') {
                                        validNextStatuses = 'Open or Closed';
                                    } else if (currentStatus === 'Closed') {
                                        validNextStatuses = 'Resolved';
                                    }

                                    frappe.show_alert({
                                        message: __(`Invalid status change. Status can only be changed from ${currentStatus} to ${validNextStatuses}`),
                                        indicator: 'red'
                                    });
                                    return;
                                }

                                frappe.db.set_value('DocType Field Comment', thread.name, 'status', newStatus)
                                    .then(() => {
                                        currentStatus = newStatus;
                                        frappe.show_alert({
                                            message: __('Status updated successfully'),
                                            indicator: 'green'
                                        });

                                        // Update total comment count immediately after status change
                                        setTimeout(() => {
                                            updateTotalCommentCount(frm);
                                        }, 100);

                                        // If status is Closed, remove dropdown and disable the pill
                                        if (newStatus === 'Closed') {
                                            // Remove dropdown menu
                                            thread_section.find('.dropdown-menu').remove();
                                            // Remove dropdown toggle attributes
                                            statusPill.removeAttr('data-toggle')
                                                .removeAttr('aria-haspopup')
                                                .removeAttr('aria-expanded');
                                            // Update styling
                                            statusPill.css({
                                                'opacity': '0.7',
                                                'cursor': 'not-allowed'
                                            });
                                            thread_section.find('.comment-input').hide();
                                        } else {
                                            statusPill.css({
                                                'opacity': '1',
                                                'cursor': 'pointer'
                                            });
                                            thread_section.find('.comment-input').show();
                                        }

                                        // Show/hide new thread button based on status
                                        if (newStatus === 'Closed') {
                                            field_section.find('.new-thread-btn').show();
                                        } else {
                                            field_section.find('.new-thread-btn').hide();
                                        }

                                        // Update the status text
                                        updateStatusPill(statusPill, newStatus);

                                        // Update total comment count badge after status change
                                        updateTotalCommentCount(frm);
                                    });
                            });
                        });

                        // Hide comment input if status is Closed
                        if (currentStatus === 'Closed') {
                            thread_section.find('.comment-input').hide();
                            // Show new thread button if this is the latest thread
                            if (index === 0) {
                                field_section.find('.new-thread-btn').show();
                            }
                        }

                        if (!thread.comments || thread.comments.length === 0) {
                            thread_section.find('.field-comments').html(`
                                <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                    <div class="text-muted" style="text-align: center;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                            <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                            <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                        </svg>
                                        <div>No comments yet</div>
                                    </div>
                                </div>
                            `);
                        } else {
                            const commentMap = {};
                            thread.comments.forEach(c => commentMap[c.name] = c);

                            // Sort comments by creation date
                            const sortedComments = thread.comments.sort((a, b) => new Date(a.creation_date) - new Date(b.creation_date));

                            sortedComments.forEach(c => {
                                const comment_element = get_comment_html(c, commentMap);
                                thread_section.find('.field-comments').append(comment_element);
                            });
                        }

                        field_section.find('.threads-container').append(thread_section);

                        // Initialize comment control if user has create permission and thread is not closed
                        if (currentStatus !== 'Closed') {
                            check_comment_permissions().then(permissions => {
                                if (permissions.includes('create')) {
                                    initializeCommentControl(thread_section, fieldName, field, get_comment_html);
                                    thread_section.find('.comment-input').show();
                                }
                            });
                        }
                    });

                    // If no threads exist, create a new thread section with comment input
                    if (threadsToShow.length === 0) {
                        const new_thread_section = $(`
                            <div class="thread-section" style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: var(--fg-color); border: 1px solid var(--border-color);">
                                <div class="field-comments">
                                    <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                        <div class="text-muted" style="text-align: center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                                <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                                <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                            </svg>
                                            <div>No comments yet</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="comment-input" style="margin-top: 15px;">
                                    <div style="display: flex; align-items: center;">
                                        <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                            <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px; "></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `);

                        field_section.find('.threads-container').append(new_thread_section);

                        // Initialize comment control for new thread
                        check_comment_permissions().then(permissions => {
                            if (permissions.includes('create')) {
                                initializeCommentControl(new_thread_section, fieldName, field, get_comment_html);
                                new_thread_section.find('.comment-input').show();
                            }
                        });
                    }
                }

                comments_list.append(field_section);
                initializeDropdowns();
                resolve();
            },
            error: function (err) {
                console.error('Error loading field comments:', err);
                reject(err);
            }
        });
    });
}

function load_all_comments(frm) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe_theme.api.load_all_comments",
            args: {
                doctype_name: frm.doctype,
                docname: frm.docname
            },
            callback: function (response) {
                const comments_list = $('.field-comments-sidebar').find('.comments-list');
                comments_list.empty();

                // Filter fields for NGO users - only show fields that have comments
                let fieldsToShow = response.message || [];
                if (frappe.boot.user_team === 'NGO') {
                    fieldsToShow = (response.message || []).filter(data =>
                        data.comments && data.comments.length > 0
                    );
                }

                if (!response.message || response.message.length === 0 || (frappe.boot.user_team === 'NGO' && fieldsToShow.length === 0)) {
                    comments_list.html(`
                        <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
                            <div class="text-muted" style="text-align: center;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                    <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                    <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                </svg>
                                <div>No comments yet</div>
                            </div>
                        </div>
                    `);
                    resolve();
                    return;
                }

                // Create HTML for each field's comments
                fieldsToShow.forEach(data => {
                    let fields = [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })]
                    const field = fields.find((f) => f.df.fieldname == data.field_name);
                    if (!field) return; // Skip if field doesn't exist in the form

                    const field_section = $(`
                        <div class="field-comment-section" style="margin-bottom: 25px; padding: 15px; border-radius: 12px; border: none; box-shadow: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                <h5 style="margin: 0; font-size: 15px;">
                                  ${data.field_label || data.field_name}
                                  ${field.tab && field.tab.df && field.tab.df.label ? `<span style="color: #888; font-size: 12px; font-weight: 400;">(${field.tab.df.label})</span>` : ''}
                                </h5>
                                <div class="status-pill-container" style="margin-left: auto;">
                                    ${renderStatusPill(data.status || 'Open')}
                                </div>
                            </div>
                            <div class="field-comments"></div>
                            <div class="comment-input" style="margin-top: 15px; display: none;">
                                <div style="display: flex; align-items: center;">
                                    <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                        <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px; "></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);

                    // Initialize status tracking for this field section
                    let currentStatus = data.status || 'Open';

                    // Set initial status and show status selector only if there are comments
                    if (data.comments && data.comments.length > 0) {
                        field_section.find('.status-pill-container').show();
                        // Disable status select if status is Closed
                        if (currentStatus === 'Closed') {
                            field_section.find('.status-pill').css({
                                'opacity': '0.7',
                                'cursor': 'not-allowed'
                            });
                            // Hide comment input if status is Closed
                            field_section.find('.comment-input').hide();
                        }
                    }

                    // Add status change handler
                    field_section.find('.status-pill').click((e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });

                    // Use event delegation for status option clicks
                    field_section.on('click', '.status-option', (e) => {
                        e.preventDefault();
                        const newStatus = $(e.target).data('status');
                        const statusPill = field_section.find('.status-pill');

                        // Check permissions before allowing status change
                        check_comment_permissions().then(permissions => {
                            if (!permissions.includes('write')) {
                                frappe.show_alert({
                                    message: __('You do not have permission to change status'),
                                    indicator: 'red'
                                });
                                return;
                            }

                            // Validate status transition
                            if (!isValidStatusTransition(currentStatus, newStatus)) {
                                let validNextStatuses = '';
                                if (currentStatus === 'Open') {
                                    validNextStatuses = 'Resolved';
                                } else if (currentStatus === 'Resolved') {
                                    validNextStatuses = 'Open or Closed';
                                } else if (currentStatus === 'Closed') {
                                    validNextStatuses = 'Resolved';
                                }

                                frappe.show_alert({
                                    message: __(`Invalid status change. Status can only be changed from ${currentStatus} to ${validNextStatuses}`),
                                    indicator: 'red'
                                });
                                return;
                            }

                            frappe.db.get_list('DocType Field Comment', {
                                filters: {
                                    doctype_name: frm.doctype,
                                    docname: frm.docname,
                                    field_name: data.field_name
                                },
                                fields: ['name'],
                                limit: 1
                            }).then(comment_doc_list => {
                                if (comment_doc_list && comment_doc_list.length > 0) {
                                    frappe.db.set_value('DocType Field Comment', comment_doc_list[0].name, 'status', newStatus)
                                        .then(() => {
                                            currentStatus = newStatus;
                                            frappe.show_alert({
                                                message: __('Status updated successfully'),
                                                indicator: 'green'
                                            });

                                            // Update total comment count immediately after status change
                                            setTimeout(() => {
                                                updateTotalCommentCount(frm);
                                            }, 100);

                                            // If status is Closed, remove dropdown and disable the pill
                                            if (newStatus === 'Closed') {
                                                // Remove dropdown menu
                                                field_section.find('.dropdown-menu').remove();
                                                // Remove dropdown toggle attributes
                                                statusPill.removeAttr('data-toggle')
                                                    .removeAttr('aria-haspopup')
                                                    .removeAttr('aria-expanded');
                                                // Update styling
                                                statusPill.css({
                                                    'opacity': '0.7',
                                                    'cursor': 'not-allowed'
                                                });
                                                field_section.find('.comment-input').hide();
                                            } else {
                                                statusPill.css({
                                                    'opacity': '1',
                                                    'cursor': 'pointer'
                                                });
                                                field_section.find('.comment-input').show();
                                            }

                                            // Update the status text
                                            updateStatusPill(statusPill, newStatus);

                                            // Update total comment count badge after status change
                                            updateTotalCommentCount(frm);
                                        });
                                }
                            });
                        });
                    });

                    if (!data.comments || data.comments.length === 0) {
                        field_section.find('.field-comments').html(`
                            <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                <div class="text-muted" style="text-align: center;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                        <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                        <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                    </svg>
                                    <div>No comments yet</div>
                                </div>
                            </div>
                        `);
                    } else {
                        // Need a commentMap for replies - create it from the logs
                        const commentMap = {};
                        data.comments.forEach(c => commentMap[c.name] = c);

                        // Sort comments by creation date
                        const sortedComments = data.comments.sort((a, b) => new Date(a.creation_date) - new Date(b.creation_date));

                        sortedComments.forEach(c => {
                            const comment_element = get_comment_html(c, commentMap);
                            field_section.find('.field-comments').append(comment_element);
                        });
                    }

                    comments_list.append(field_section);
                    // Only initialize comment control if user has create permission and status is not Closed
                    if (currentStatus !== 'Closed') {
                        check_comment_permissions().then(permissions => {
                            if (permissions.includes('create')) {
                                initializeCommentControl(field_section, data.field_name, field, get_comment_html);
                                field_section.find('.comment-input').show();
                            }
                        });
                    }
                });

                // Add comment icons to each field (but NOT for NGO users)
                if (frappe.boot.user_team !== 'NGO') {
                    [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })].forEach(f => {
                        const field = f;
                        const fieldname = f?.df?.fieldname || 'details_tab';
                        if (!field || !field.df) return;

                        const selector = field?.label_area || field?.tab_link || field?.head;
                        if (!selector) return;

                        // Skip if field is read-only or is a layout field
                        if (field.df.read_only || [, 'Column Break', 'HTML', 'Button'].includes(field.df.fieldtype)) {
                            return;
                        }

                        // Create comment icon if not exists
                        if (selector && !$(selector).find('.field-comment-icon').length) {
                            const count = commentCountCache[fieldname] || 0;
                            const comment_icon = $(`
                                <div class="field-comment-icon" style="display: none; position: absolute; right: -30px; top: -2px; z-index: 10;">
                                    <button class="btn" style="padding: 2px 8px; position: relative;" tabindex="-1" type="button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
                                            <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                                        </svg>
                                        <span class="comment-count-badge" style="
                                            position: absolute;
                                            top: -4px;
                                            right: -8px;
                                            background: ${count > 0 ? primaryColor : '#e0e0e0'};
                                            color: ${count > 0 ? '#fff' : '#666'};
                                            border-radius: 50%;
                                            min-width: 16px;
                                            height: 16px;
                                            font-size: 10px;
                                            font-weight: 600;
                                            display: flex !important;
                                            align-items: center;
                                            justify-content: center;
                                            padding: 0 4px;
                                            box-shadow: ${count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'};
                                            border: 1.5px solid #fff;
                                            z-index: 9999;
                                            opacity: ${count > 0 ? 1 : 0.9};
                                            transition: all 0.2s ease;
                                            transform-origin: center;
                                            transform: ${count > 0 ? 'scale(1)' : 'scale(0.9)'};
                                        ">${count}</span>
                                    </button>
                                </div>
                            `);

                            // Add icon to the field wrapper
                            $(selector).css('position', 'relative');
                            $(selector).append(comment_icon);

                            // Show/hide icon on hover
                            $(field.$wrapper).hover(
                                function () {
                                    comment_icon.show();
                                },
                                function () { comment_icon.hide(); }
                            );

                            // Handle click on comment icon - only respond to mouse clicks
                            comment_icon.find('button').on('click', function (e) {
                                e.preventDefault();
                                e.stopPropagation();

                                // Show sidebar
                                $('.field-comments-sidebar').show();
                                // Force a reflow to ensure the transition works
                                $('.field-comments-sidebar')[0].offsetHeight;
                                $('.field-comments-sidebar').css('right', '0');

                                // Set context when viewing comments for a specific field
                                current_field_context = { fieldName: fieldname, field: field, frm: frm };

                                // Load only this field's comments
                                load_field_comments(fieldname, field, frm);
                            });

                            // Prevent keyboard events from triggering the button
                            comment_icon.find('button').on('keydown keyup keypress', function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                return false;
                            });
                        } else {
                            // Update existing comment count badge
                            const commentCountBadge = $(selector).find('.comment-count-badge');
                            if (commentCountBadge.length) {
                                const count = commentCountCache[fieldname] || 0;
                                commentCountBadge.text(count);
                                commentCountBadge.css({
                                    'background': count > 0 ? primaryColor : '#e0e0e0',
                                    'color': count > 0 ? '#fff' : '#666',
                                    'box-shadow': count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
                                    'opacity': count > 0 ? 1 : 0.9,
                                    'transform': count > 0 ? 'scale(1)' : 'scale(0.9)'
                                });
                            }
                        }
                    });
                } else {
                    [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })].forEach(f => {
                        const field = f;
                        const fieldname = f?.df?.fieldname || 'details_tab';
                        if (!field || !field.df) return;

                        const selector = field?.label_area || field?.tab_link || field?.head;
                        if (!selector) return;

                        // Remove any existing comment icons
                        const existingIcon = $(selector).find('.field-comment-icon');
                        if (existingIcon.length) {
                            existingIcon.remove();
                        }
                    });
                }

                initializeDropdowns();
                resolve();
            },
            error: function (err) {
                console.error('Error loading all comments:', err);
                reject(err);
            }
        });
    });
}

// Move initializeCommentControl function outside the refresh event handler
function initializeCommentControl(field_section, fieldName, field, get_comment_html) {
    const commentBox = field_section.find('.comment-box')[0];
    let control;

    // Initialize the control
    control = frappe.ui.form.make_control({
        parent: $(commentBox),
        df: {
            fieldtype: 'Comment',
            fieldname: 'comment',
            placeholder: __('Type your message...Use @ to mention someone'),
        },
        render_input: true,
        only_input: true,
        enable_mentions: true,
    });

    // Remove comment-input-header and adjust spacing
    $(commentBox).find('.avatar-frame.standard-image').css('min-width', '33px');
    $(commentBox).find('[data-fieldtype="Comment"]').css('max-width', '252px');
    $(commentBox).find('.comment-input-header').remove();
    $(commentBox).closest('.comment-input').css({
        'margin': '0',
        'padding': '0'
    });
    $(commentBox).closest('.comment-box').css({
        'margin': '0',
        'padding': '0',
    });

    // Add checkbox after the comment button only if not NGO
    setTimeout(() => {
        const commentButton = $(commentBox).find('.btn-comment');
        if (commentButton.length) {
            const buttonWrapper = $(`
                <div class="comment-action-container" style="display: flex; align-items: end; gap: 10px; margin: 8px; flex-direction: row-reverse; justify-content: end;">
                </div>
            `);
            commentButton.wrap(buttonWrapper);

            // Only show checkbox if NOT NGO
            if (frappe.boot.user_team !== 'NGO') {
                commentButton.parent().append(`
                    <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px; padding: 4px 8px; border-radius: 6px;">
                        <input type="checkbox" id="new_comment_external_${fieldName}" class="external-checkbox" style="margin: 0; width: 14px; height: 14px;">
                        <label for="new_comment_external_${fieldName}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; margin: 0; font-weight: 500; user-select: none; white-space: nowrap;">Visible to NGO</label>
                    </div>
                `);
            }
        }
    }, 100);

    // Handle comment submission using Frappe's built-in button
    $(commentBox).find('.btn-comment').off('click').on('click', () => {
        if (!control) return;

        const comment = control.get_value();
        if (!comment) return;

        // Set is_external based on user_team
        let isExternal = 0;
        if (frappe.boot.user_team === 'NGO') {
            isExternal = 1;
        } else {
            isExternal = $(`#new_comment_external_${fieldName}`).is(':checked') ? 1 : 0;
        }

        // Extract mentions from comment
        const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
        const mentions = new Set();
        let match;
        while ((match = mentionRegex.exec(comment)) !== null) {
            mentions.add(match[1]);
        }

        // Call the server-side method to save the comment
        frappe.call({
            method: "frappe_theme.api.save_field_comment",
            args: {
                doctype_name: field.frm.doctype,
                docname: field.frm.docname,
                field_name: fieldName,
                field_label: field.df.label || fieldName,
                comment_text: comment,
                is_external: isExternal
            },
            callback: function (response) {
                if (response.message) {
                    const newCommentEntry = response.message;
                    control.set_value('');
                    // Reset the external checkbox (if present)
                    $(`#new_comment_external_${fieldName}`).prop('checked', false);

                    frappe.show_alert({
                        message: __('Comment added successfully'),
                        indicator: 'green'
                    });

                    // Show status pill after first comment
                    field_section.find('.status-pill-container').show();
                    // Send notifications to mentioned users
                    if (mentions.size > 0) {
                        Array.from(mentions).forEach(mention => {
                            frappe.call({
                                method: 'frappe_theme.api.send_mention_notification',
                                args: {
                                    mentioned_user: mention,
                                    comment_doc: newCommentEntry.parent,
                                    doctype: field.frm.doctype,
                                    docname: field.frm.docname,
                                    field_name: fieldName,
                                    field_label: field.df.label || fieldName,
                                    comment: comment
                                }
                            });
                        });
                    }

                    // Reload comments based on current view
                    const isAllCommentsView = $('.field-comments-sidebar').find('.comments-list').children().length > 1;
                    if (isAllCommentsView) {
                        load_all_comments(field.frm).then(() => {
                            // Update total comment count badge
                            updateTotalCommentCount(field.frm);
                        });
                    } else {
                        // For field-specific view, reload the comments immediately
                        load_field_comments(fieldName, field, field.frm).then(() => {
                            // Update comment count badge
                            updateCommentCount(fieldName, field.frm);
                            // Update total comment count badge
                            updateTotalCommentCount(field.frm);
                        });
                    }

                    // Also call updateTotalCommentCount directly after a short delay to ensure it runs
                    setTimeout(() => {
                        updateTotalCommentCount(field.frm);
                    }, 500);
                } else {
                    console.error('Error saving comment:', response);
                    frappe.show_alert({
                        message: __('Error adding comment'),
                        indicator: 'red'
                    });
                }
            }
        });
    });

    return control;
}

// Add this at the top of the file with other constants
let commentCountCache = {};



// Move updateCommentCount function outside the refresh event handler
function updateCommentCount(fieldName, frm) {
    // Get the comment count badge element
    const field = [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })].find((f) => f.df.fieldname == fieldName)
    let selector = field?.label_area || field?.tab_link || field?.head;
    const commentCountBadge = $(selector).find('.comment-count-badge');
    if (!commentCountBadge.length) return;

    // Use cached count if available
    if (commentCountCache[fieldName] !== undefined) {
        const count = commentCountCache[fieldName];
        commentCountBadge.text(count);
        commentCountBadge.css({
            'display': 'flex !important',
            'visibility': 'visible',
            'opacity': count > 0 ? 1 : 0.9,
            'transform': count > 0 ? 'scale(1)' : 'scale(0.9)',
            'background': count > 0 ? primaryColor : '#e0e0e0',
            'color': count > 0 ? '#fff' : '#666',
            'boxShadow': count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
        });
        return;
    }

    // Get all comment counts in one call
    frappe.call({
        method: 'frappe_theme.api.get_all_field_comment_counts',
        args: {
            doctype_name: frm.doctype,
            docname: frm.docname
        },
        callback: function (r) {
            if (r.message) {
                // Update cache
                commentCountCache = r.message;

                // Update the specific field's count
                const count = r.message[fieldName] || 0;
                commentCountBadge.text(count);
                commentCountBadge.css({
                    'display': 'flex !important',
                    'visibility': 'visible',
                    'opacity': count > 0 ? 1 : 0.9,
                    'transform': count > 0 ? 'scale(1)' : 'scale(0.9)',
                    'background': count > 0 ? primaryColor : '#e0e0e0',
                    'color': count > 0 ? '#fff' : '#666',
                    'boxShadow': count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
                });

                // Also update the total comment count badge
                updateTotalCommentCount(frm);
            }
        }
    });
}

// Add this new function before the frappe.ui.form.on('*') handler
function setupFieldComments(frm) {
    if (!frm.is_new()) {
        if (!frm.doc || !frm.doc.doctype) return;

        // Check if field comments are disabled globally
        if (frappe.boot.my_theme && frappe.boot.my_theme.hide_fields_comment) {
            return;
        }
        // Check permissions first
        check_comment_permissions().then(permissions => {
            // Only proceed if user has read permission
            if (!permissions.includes('read')) {
                return;
            }

            // Lighten by 40%
            const lightPrimaryColor = getLightColor(primaryColor);
            const lighterPrimaryColor = getLighterColor(primaryColor);

            // Create comment popup/sidebar if not exists
            if (!$('.field-comments-sidebar').length) {
                const comment_sidebar = $(`
                    <div class="field-comments-sidebar" style="display: none; position: fixed; right: -400px; top: 48px; width: 400px; height: calc(100vh - 48px); background: var(--fg-color); box-shadow: -2px 0 8px rgba(0,0,0,0.1); z-index: 100; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                        <div style="padding: 15px; border-bottom: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h5 style="margin: 0; font-size: 18px; font-weight: 600;">Comments</h5>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-default btn-sm refresh-comments" style="padding: 4px 8px;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="vertical-align: middle;" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                        </svg>
                                    </button>
                                    <button class="btn btn-default btn-sm close-comments" style="padding: 4px 8px;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="vertical-align: middle;" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="comments-container" style="height: calc(100vh - 108px); overflow-y: auto; padding: 15px;">
                            <div class="comments-list"></div>
                        </div>
                    </div>
                `);

                $('body').append(comment_sidebar);

                // Handle close button click
                comment_sidebar.find('.close-comments').click(() => {
                    comment_sidebar.css('right', '-400px');
                    setTimeout(() => {
                        comment_sidebar.hide();
                    }, 400);
                });

                // Handle refresh button click
                comment_sidebar.find('.refresh-comments').click(() => {
                    if (!cur_frm) return;

                    // Show loading state
                    const refreshBtn = comment_sidebar.find('.refresh-comments');
                    refreshBtn.prop('disabled', true);
                    refreshBtn.find('svg').css('animation', 'spin 1s linear infinite');

                    let loadCommentsPromise;

                    // Check if viewing comments for a specific field or all comments
                    if (current_field_context) {
                        loadCommentsPromise = load_field_comments(current_field_context.fieldName, current_field_context.field, current_field_context.frm);
                    } else {
                        loadCommentsPromise = load_all_comments(frm);
                    }

                    loadCommentsPromise.then(() => {
                        // Reset button state
                        refreshBtn.prop('disabled', false);
                        refreshBtn.find('svg').css('animation', '');

                        // Update total comment count badge
                        updateTotalCommentCount(frm);

                        frappe.show_alert({
                            message: __('Comments refreshed'),
                            indicator: 'green'
                        });
                    }).catch((error) => {
                        // Reset button state on error
                        refreshBtn.prop('disabled', false);
                        refreshBtn.find('svg').css('animation', '');

                        frappe.show_alert({
                            message: __('Error refreshing comments'),
                            indicator: 'red'
                        });
                    });
                });
            }

            // Add comment button to form only if user has create permission
            if (permissions.includes('read') && !frm.page.sidebar.find('.field-comments-btn').length) {
                frappe.call({
                    method: 'frappe_theme.api.get_total_open_resolved_comment_count',
                    args: {
                        doctype_name: frm.doctype,
                        docname: frm.docname
                    },
                    callback: function (r) {
                        let count = r.message || 0;
                        let label = count > 0
                            ? __('Comments') + ` <span class="comments-badge">${count}</span>`
                            : __('Comments');
                        let btn = frm.add_custom_button(label, function () {
                            $('.field-comments-sidebar').show();
                            $('.field-comments-sidebar')[0].offsetHeight;
                            $('.field-comments-sidebar').css('right', '0');
                            current_field_context = null;
                            load_all_comments(frm);
                        });
                        // Style the badge
                        $(btn).find('.comments-badge').css({
                            'background': primaryColor,
                            'color': '#fff',
                            'border-radius': '10px',
                            'padding': '3px 6px ',
                            'font-size': '10px',
                            'margin-left': '2px'
                        });

                        // Store the button reference for later updates
                        btn.addClass('field-comments-btn');
                        // Store the button reference globally for this form
                        frm.commentsButton = btn;
                    }
                });
            }

            // Get all comment counts in one call when form loads
            frappe.call({
                method: 'frappe_theme.api.get_all_field_comment_counts',
                args: {
                    doctype_name: frm.doctype,
                    docname: frm.docname
                },
                callback: function (r) {
                    if (r.message) {
                        // Update cache
                        commentCountCache = r.message;

                        // Add comment icons to each field (but NOT for NGO users)
                        if (frappe.boot.user_team !== 'NGO') {
                            [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })].forEach(f => {
                                const field = f;
                                const fieldname = f?.df?.fieldname || 'details_tab';
                                if (!field || !field.df) return;

                                const selector = field?.label_area || field?.tab_link || field?.head;
                                if (!selector) return;

                                // Skip if field is read-only or is a layout field
                                if (field.df.read_only || ['Column Break', 'HTML', 'Button'].includes(field.df.fieldtype)) {
                                    return;
                                }

                                // Create comment icon if not exists
                                if (selector && !$(selector).find('.field-comment-icon').length) {
                                    const count = commentCountCache[fieldname] || 0;
                                    const comment_icon = $(`
                                        <div class="field-comment-icon" style="display: none;position: absolute; right: ${field.variant == 'field' ? '-20px' : '-10px'}; top: ${field.variant == 'field' ? '-2px' : '7px'}; z-index: 10;">
                                            <button class="btn" style="padding: 2px 8px; position: relative;" tabindex="-1" type="button">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
                                                    <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                                                </svg>
                                                <span class="comment-count-badge" style="
                                                    position: absolute;
                                                    top: -4px;
                                                    right: -8px;
                                                    background: ${count > 0 ? primaryColor : '#e0e0e0'};
                                                    color: ${count > 0 ? '#fff' : '#666'};
                                                    border-radius: 50%;
                                                    min-width: 16px;
                                                    height: 16px;
                                                    font-size: 10px;
                                                    font-weight: 600;
                                                    display: flex !important;
                                                    align-items: center;
                                                    justify-content: center;
                                                    padding: 0 4px;
                                                    box-shadow: ${count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'};
                                                    border: 1.5px solid #fff;
                                                    z-index: 9999;
                                                    opacity: ${count > 0 ? 1 : 0.9};
                                                    transition: all 0.2s ease;
                                                    transform-origin: center;
                                                    transform: ${count > 0 ? 'scale(1)' : 'scale(0.9)'};
                                                ">${count}</span>
                                            </button>
                                        </div>
                                    `);

                                    // Add icon to the field wrapper
                                    $(selector).css('position', 'relative');
                                    $(selector).css('cursor', 'pointer');
                                    $(selector).append(comment_icon);

                                    // Show/hide icon on hover
                                    $(selector).hover(
                                        function () {
                                            comment_icon.show();
                                        },
                                        function () { comment_icon.hide(); }
                                    );

                                    // Handle click on comment icon - only respond to mouse clicks
                                    comment_icon.find('button').on('click', function (e) {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Show sidebar
                                        $('.field-comments-sidebar').show();
                                        // Force a reflow to ensure the transition works
                                        $('.field-comments-sidebar')[0].offsetHeight;
                                        $('.field-comments-sidebar').css('right', '0');

                                        // Set context when viewing comments for a specific field
                                        current_field_context = { fieldName: fieldname, field: field, frm: frm };

                                        // Load only this field's comments
                                        load_field_comments(fieldname, field, frm);
                                    });

                                    // Prevent keyboard events from triggering the button
                                    comment_icon.find('button').on('keydown keyup keypress', function (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return false;
                                    });
                                } else {
                                    // Update existing comment count badge
                                    const commentCountBadge = $(selector).find('.comment-count-badge');
                                    if (commentCountBadge.length) {
                                        const count = commentCountCache[fieldname] || 0;
                                        commentCountBadge.text(count);
                                        commentCountBadge.css({
                                            'background': count > 0 ? primaryColor : '#e0e0e0',
                                            'color': count > 0 ? '#fff' : '#666',
                                            'box-shadow': count > 0 ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
                                            'opacity': count > 0 ? 1 : 0.9,
                                            'transform': count > 0 ? 'scale(1)' : 'scale(0.9)'
                                        });
                                    }
                                }
                            });
                        } else {
                            [...frm.fields.map((f) => { return { ...f, variant: 'field' } }), ...frm?.layout?.tabs?.map((t) => { return { ...t, variant: 'tab' } })].forEach(f => {
                                const field = f;
                                const fieldname = f?.df?.fieldname || 'details_tab';
                                if (!field || !field.df) return;

                                const selector = field?.label_area || field?.tab_link || field?.head;
                                if (!selector) return;

                                // Remove any existing comment icons
                                const existingIcon = $(selector).find('.field-comment-icon');
                                if (existingIcon.length) {
                                    existingIcon.remove();
                                }
                            });
                        }
                    }

                    // Update total comment count badge after loading field counts
                    updateTotalCommentCount(frm);
                }
            });
        });
    }
}

// Remove the frappe.ui.form.on('*') handler and replace with this
frappe.ui.form.on('*', {
    refresh: function (frm) {
        setupFieldComments(frm);
    }
});

function getStatusPillStyle(status) {
    if (status === 'Closed') {
        return {
            dot: '#218838',
            bg: '#E6F4EA',
            text: '#218838'
        };
    }
    if (status === 'Open') {
        return {
            dot: '#D32F2F',
            bg: '#FDEAEA',
            text: '#D32F2F'
        };
    }
    // Resolved or default
    return {
        dot: '#444',
        bg: '#F2F2F2',
        text: '#444'
    };
}

function renderStatusPill(status) {
    const style = getStatusPillStyle(status);
    const isClosed = status === 'Closed';
    
    // Only show Open/Resolved for NGO
    let statusOptions = '';
    if (frappe.boot.user_team === 'NGO') {
        statusOptions = `
            <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
            <a class="dropdown-item status-option" data-status="Resolved" href="#">Resolved</a>
        `;
    } else {
        statusOptions = `
            <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
            <a class="dropdown-item status-option" data-status="Resolved" href="#">Resolved</a>
            <a class="dropdown-item status-option" data-status="Closed" href="#">Closed</a>
        `;
    }

    return `
        <div class="status-pill-container" style="position: relative;">
            <button class="status-pill" type="button"
                ${isClosed ? '' : 'data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"'}
                style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 2px 18px 2px 12px;
                    border-radius: 999px;
                    background: ${style.bg} !important;
                    color: ${style.text} !important;
                    font-weight: 500 !important;
                    font-size: 13px !important;
                    line-height: 1.2;
                    cursor: ${isClosed ? 'not-allowed' : 'pointer'};
                    border: none;
                    margin: 0;
                    opacity: ${isClosed ? '0.7' : '1'};
                    box-shadow: none;
                ">
                <span style="
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${style.dot};
                    margin-right: 6px;
                "></span>
                ${status}
            </button>
            ${!isClosed ? `
                <div class="dropdown-menu" style="
                    min-width: 120px;
                    padding: 8px 0;
                    margin: 0;
                    border: 1px solid #E0E0E0;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    ${statusOptions}
                </div>
            ` : ''}
        </div>
    `;
}

// Add this function to initialize dropdowns
function initializeDropdowns() {
    // Check permissions first
    check_comment_permissions().then(permissions => {
        if (permissions.includes('write')) {
            $('.status-pill').each(function () {
                $(this).dropdown();
            });
        } else {
            // For read-only users, remove dropdown functionality
            $('.status-pill').each(function () {
                $(this).removeAttr('data-toggle')
                    .removeAttr('aria-haspopup')
                    .removeAttr('aria-expanded')
                    .css('cursor', 'default');
            });
            // Remove dropdown menus
            $('.dropdown-menu').remove();
        }
    });
}

// Update the status change handlers to use the new button structure
function updateStatusPill(element, newStatus) {
    const style = getStatusPillStyle(newStatus);
    const isClosed = newStatus === 'Closed';
    
    // Check permissions to determine if dropdown should be shown
    check_comment_permissions().then(permissions => {
        const canShowDropdown = permissions.includes('write');
        
        // Only show Open/Resolved for NGO
        let statusOptions = '';
        if (frappe.boot.user_team === 'NGO') {
            statusOptions = `
                <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
                <a class="dropdown-item status-option" data-status="Resolved" href="#">Resolved</a>
            `;
        } else {
            statusOptions = `
                <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
                <a class="dropdown-item status-option" data-status="Resolved" href="#">Resolved</a>
                <a class="dropdown-item status-option" data-status="Closed" href="#">Closed</a>
            `;
        }
        
        element.attr('style', `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 18px 2px 12px;
            border-radius: 999px;
            background: ${style.bg} !important;
            color: ${style.text} !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            line-height: 1.2;
            cursor: ${isClosed ? 'not-allowed' : (canShowDropdown ? 'pointer' : 'default')};
            border: none;
            margin: 0;
            opacity: ${isClosed ? '0.7' : '1'};
            box-shadow: none;
        `);
        
        // Update the button content
        element.html(`
            <span style="
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${style.dot};
                margin-right: 6px;
            "></span>
            ${newStatus}
        `);
        
        // Add dropdown attributes if not closed and user can show dropdown
        if (!isClosed && canShowDropdown) {
            element.attr('data-toggle', 'dropdown')
                .attr('aria-haspopup', 'true')
                .attr('aria-expanded', 'false');
        } else {
            element.removeAttr('data-toggle')
                .removeAttr('aria-haspopup')
                .removeAttr('aria-expanded');
        }
        
        // Update or create dropdown menu
        let dropdownMenu = element.siblings('.dropdown-menu');
        if (!isClosed && canShowDropdown) {
            if (dropdownMenu.length === 0) {
                // Create new dropdown menu
                dropdownMenu = $(`
                    <div class="dropdown-menu" style="
                        min-width: 120px;
                        padding: 8px 0;
                        margin: 0;
                        border: 1px solid #E0E0E0;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    ">
                        ${statusOptions}
                    </div>
                `);
                element.parent().append(dropdownMenu);
            } else {
                // Update existing dropdown menu
                dropdownMenu.html(statusOptions);
            }
        } else {
            // Remove dropdown menu if status is closed or user can't show dropdown
            dropdownMenu.remove();
        }
        
        // Re-initialize dropdown functionality
        if (!isClosed && canShowDropdown) {
            element.dropdown();
        }
    });
}

frappe.router.on('change', function () {
    // Hide the sidebar and move it off-screen
    $('.field-comments-sidebar').css('right', '-400px');
    setTimeout(() => {
        $('.field-comments-sidebar').hide();
    }, 400);
});

// Add this helper function at the top with other helper functions
function isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
        'Open': ['Resolved'],
        'Resolved': ['Open', 'Closed'],
        'Closed': ['Resolved'] // Allow reopening from Closed to Resolved
    };
    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// Function to update the external flag for a comment
function updateExternalFlag(commentName, isExternal) {
    frappe.call({
        method: 'frappe_theme.api.update_comment_external_flag',
        args: {
            comment_name: commentName,
            is_external: isExternal ? 1 : 0  // Convert boolean to integer
        },
        callback: function (response) {
            if (response.message) {
                frappe.show_alert({
                    message: __('External flag updated successfully'),
                    indicator: 'green'
                });
            } else {
                frappe.show_alert({
                    message: __('Error updating external flag'),
                    indicator: 'red'
                });
                // Revert the checkbox state if update failed
                const checkbox = document.getElementById(`external_${commentName}`);
                if (checkbox) {
                    checkbox.checked = !isExternal;
                }
            }
        },
        error: function (err) {
            frappe.show_alert({
                message: __('Error updating external flag'),
                indicator: 'red'
            });
            // Revert the checkbox state if update failed
            const checkbox = document.getElementById(`external_${commentName}`);
            if (checkbox) {
                checkbox.checked = !isExternal;
            }
        }
    });
}

// Add CSS styles for better checkbox appearance
$(document).ready(function () {
    // Add custom styles for external checkbox
    const style = document.createElement('style');
    style.textContent = `
        .external-checkbox {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            width: 16px !important;
            height: 16px !important;
            border: 2px solid #cbd5e0;
            border-radius: 3px;
            background-color: white;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            margin: 0 !important;
        }
        
        .external-checkbox:checked {
            background-color: #007bff;
            border-color: #007bff;
        }
        
        .external-checkbox:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
        }
        
        .external-checkbox:hover {
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
        }
        
        .external-checkbox:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
        }
        
        .comment-item .external-checkbox-container {
            transition: all 0.2s ease;
        }
        
        .comment-item .external-checkbox-container:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);
});

// Add debounce mechanism for total comment count updates
let totalCommentCountUpdateTimeout = null;

// Add this new function to update the total comment count badge
function updateTotalCommentCount(frm) {

    // Clear existing timeout
    if (totalCommentCountUpdateTimeout) {
        clearTimeout(totalCommentCountUpdateTimeout);
    }

    // Debounce the API call to prevent too many requests
    totalCommentCountUpdateTimeout = setTimeout(() => {
        frappe.call({
            method: 'frappe_theme.api.get_total_open_resolved_comment_count',
            args: {
                doctype_name: frm.doctype,
                docname: frm.docname
            },
            callback: function (r) {
                let count = r.message || 0;

                // Use the stored button reference if available
                let commentsBtn = frm.commentsButton;

                // Fallback to finding the button if reference is not available
                if (!commentsBtn || !commentsBtn.length) {
                    commentsBtn = frm.page.sidebar.find('.field-comments-btn') ||
                        frm.page.sidebar.find('button:contains("Comments")') ||
                        $('button:contains("Comments")').filter(function () {
                            return $(this).closest('.form-sidebar').length > 0;
                        });
                }

                if (commentsBtn && commentsBtn.length) {
                    let label = count > 0
                        ? __('Comments') + ` <span class="comments-badge">${count}</span>`
                        : __('Comments');
                    commentsBtn.html(label);
                    // Style the badge
                    commentsBtn.find('.comments-badge').css({
                        'background': primaryColor,
                        'color': '#fff',
                        'border-radius': '10px',
                        'padding': '2px 2px',
                        'font-size': '11px',
                        'margin-left': '2px'
                    });
                } else {
                }
            },
            error: function (err) {
                console.error('Error updating total comment count:', err);
            }
        });
    }, 300); // 300ms debounce delay
}