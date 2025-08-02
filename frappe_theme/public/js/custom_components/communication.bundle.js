class SVAEmailComponent {
    constructor(frm, wrapper) {
        this.frm = frm;
        this.wrapper = wrapper;
        this.communication_list = [];
        this.currentEmailIndex = 0;
        this.emailContainer = null;
        this.emailSidebar = null;
        this.emailList = null;
        this.emailBodyContent = null;
        this.setupStyles();
        this.initialize();
        return this.wrapper;
    }

    async initialize() {
        this.communication_list = await getDocList('Communication', [
            ['Communication', 'reference_name', '=', this.frm.doc.name],
            ['Communication', 'in_reply_to', '=', '']
        ], ['*']);
        this.render();
        this.attachEventListeners();
    }
    setupStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .email-container {
                display: flex;
                height:785px;
                background-color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }

            .email-sidebar {
                width: 300px;
                border-right: 1px solid #e5e5e5;
                display: flex;
                flex-direction: column;
                background: #fff;
            }
        
            .top-header {
                align-items: center;
                padding: 8px 8px;
                border-bottom: 1px solid #e5e5e5;
                height: 48px;
                background:#f9f9f9 ;
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                justify-content: space-between;
            
            }
        

            .header-icon {
                width: 24px;
                height: 24px;
                display: flex;
                border: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: #666;
                border-radius: 4px;
            }

            .header-icon:hover {
                background-color: #f5f5f5;
            }

            .email-tabs {
                display: flex;
                border-bottom: 1px solid #e5e5e5;
                justify-content: space-between;
                background: #fff;
                padding: 0 16px;
            }

            .tab-item {
                padding: 8px 16px;
                cursor: pointer;
                color: #666;
                font-size: 14px;
                position: relative;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
            }

            .active_tab {
                color: #801621;
                border-bottom-color: #801621;
            }

            .email-list {
                overflow-y: auto;
                flex: 1;
            }

            .date-group {
                padding: 8px 16px;
                font-size: 12px;
                font-weight: 500;
                color: #666;
                background: #f9f9f9;
                text-transform: uppercase;
            }

            .email-item {
                padding: 12px 16px;
                border-bottom: 1px solid #e5e5e5;
                cursor: pointer;
                transition: background 0.2s;
            }

            .email-item:hover {
                background: #f5f5f5;
            }

            .email-item.active {
                background: #e8f0fe;
            }

            .email-header {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 4px;
            }

            .email-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 500;
                flex-shrink: 0;
            }

            .email-content {
                flex: 1;
                min-width: 0;
            }

            .sender-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2px;
            }

            .sender-name {
                font-size: 14px;
                font-weight: 500;
                color: #333;
                margin: 0;
            }

            .time-ago {
                font-size: 12px;
                color: #666;
                white-space: nowrap;
            }

            .email-subject {
                font-size: 14px;
                color: #333;
                margin: 0 0 4px 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .email-preview {
                font-size: 13px;
                color: #666;
                margin: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .attachment-info {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 4px;
                color: #666;
                font-size: 12px;
            }

            .email-body {
                flex: 1;
                padding: 0px 24px 10px 24px; 
                background: #fff;
                overflow-y: auto;
            }

            .email-detail-header {
                margin-bottom: 24px;
                border-bottom: 1px solid #e5e5e5;
                padding-bottom: 10px;
            }

            .email-detail-subject {
                font-size: 14px;
                color: #333;
                font-weight: 500 !important;    
                margin: 0 ;
                font-weight: normal;
            }

            .email-detail-meta {
                display: flex;
                gap: 12px;
            }

            .meta-content {
                flex: 1;
            }

            .meta-sender {
                font-size: 14px;
                font-weight: 500;
                color: #333;
                margin-bottom: 4px;
            }

            .meta-recipient {
                font-size: 14px;
                color: #666;
            }

            .meta-time {
                font-size: 12px;
                color: #666;
                text-align: right;
            }

            .email-detail-body {
                font-size: 14px;
                line-height: 1.6;
                color: #333;
                padding-left: 45px;
            }

            .attachments {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #e5e5e5;
            }

            .attachments-header {
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
                text-transform: uppercase;
            }

            .attachment-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .email-detail-subject-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #e5e5e5;
                padding-bottom: 11px;
                margin-bottom: 11px;
            }
            button.btn-primary > .es-icon {
                fill:white;
                stroke-width: 0;
            }

            .attachment-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: #f5f5f5;
                border-radius: 4px;
                font-size: 13px;
                color: #333;
                cursor: pointer;
            }

            .action-buttons {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .nav-button {
                padding: 0.5rem;
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .nav-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .nav-button:not(:disabled):hover {
                color: #111827;
            }

            .attachment-item:hover {
                background: #eee;
            }

            @media (max-width: 768px) {
                .email-sidebar {
                    width: 100%;
                }

                .email-container {
                    flex-direction: column;
                    height: 750px;
                    overflow: auto;
                }

                .email-body {
                    display: none;
                }

                .email-body.active {
                    display: block;
                }
            }
        `;
        document.head.appendChild(style);
    }

    formatDateGroup(emailDate) {
        const today = new Date();
        const yesterday = new Date();
        today.setHours(0, 0, 0, 0);
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const emailDateFormatted = new Date(emailDate);
        emailDateFormatted.setHours(0, 0, 0, 0);

        if (emailDateFormatted.getTime() === today.getTime()) return "Today";
        if (emailDateFormatted.getTime() === yesterday.getTime()) return "Yesterday";
        return "Older";
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    timeAgo(timestamp) {
        if (!timestamp) return '--:--';
        const now = Date.now();
        timestamp = new Date(timestamp);
        const diff = now - timestamp;
        const second = 1000;
        const minute = second * 60;
        const hour = minute * 60;
        const day = hour * 24;
        const week = day * 7;
        const month = day * 30;
        const year = day * 365;

        if (diff < minute) {
            const seconds = Math.round(diff / second);
            return seconds === 1 ? "1 second ago" : `${seconds} seconds ago`;
        }
        if (diff < hour) {
            const minutes = Math.round(diff / minute);
            return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
        }
        if (diff < day) {
            const hours = Math.round(diff / hour);
            return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
        }
        if (diff < day * 2) {
            return "Yesterday";
        }
        if (diff < week) {
            const days = Math.round(diff / day);
            return days === 1 ? "1 day ago" : `${days} days ago`;
        }
        if (diff < month) {
            const weeks = Math.round(diff / week);
            return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
        }
        if (diff < year) {
            const months = Math.round(diff / month);
            return months === 1 ? "1 month ago" : `${months} months ago`;
        }
        const years = Math.round(diff / year);
        return years === 1 ? "1 year ago" : `${years} years ago`;
    }

    createEmailItem(item) {
        const emailItem = document.createElement('div');
        emailItem.classList.add('email-item');
        emailItem.dataset.emailId = item.name;

        const emailHeader = document.createElement('div');
        emailHeader.classList.add('email-header');

        const emailAvatar = document.createElement('div');
        emailAvatar.classList.add('email-avatar');
        emailAvatar.style.backgroundColor = this.getRandomColor();
        emailAvatar.textContent = item?.sender[0]?.toUpperCase() || ""; // Handle cases where sender is null/undefined

        const emailContent = document.createElement('div');
        emailContent.classList.add('email-content');

        const senderLine = document.createElement('div');
        senderLine.classList.add('sender-line');

        const senderName = document.createElement('h4');
        senderName.classList.add('sender-name');
        senderName.textContent = item?.sender_full_name || "Unknown Sender"; // Handle cases where name is null/undefined

        const timeAgoSpan = document.createElement('span');
        timeAgoSpan.classList.add('time-ago');
        timeAgoSpan.textContent = this.timeAgo(item?.communication_date);

        const emailSubject = document.createElement('p');
        emailSubject.classList.add('email-subject');
        emailSubject.textContent = item?.subject || "No Subject";  // Handle cases where subject is null/undefined

        const emailPreview = document.createElement('p');
        emailPreview.classList.add('email-preview');
        emailPreview.textContent = item?.preview || "No preview available"; // Handle cases where preview is null/undefined. Use actual preview if available.

        senderLine.appendChild(senderName);
        senderLine.appendChild(timeAgoSpan);

        emailContent.appendChild(senderLine);
        emailContent.appendChild(emailSubject);
        emailContent.appendChild(emailPreview);

        if (item.attachments && item.attachments.length > 0) { // Check for attachments and if it is an array
            const attachmentInfo = document.createElement('div');
            attachmentInfo.classList.add('attachment-info');
            const icon = document.createElement('i');
            icon.classList.add('fa', 'fa-paperclip');
            const text = document.createElement('span');
            text.textContent = `${item.attachments.length} Attachment${item.attachments.length !== 1 ? 's' : ''}`; // Display number of attachments
            attachmentInfo.appendChild(icon);
            attachmentInfo.appendChild(text);
            emailContent.appendChild(attachmentInfo);
        }

        emailHeader.appendChild(emailAvatar);
        emailHeader.appendChild(emailContent);
        emailItem.appendChild(emailHeader);

        return emailItem;
    }

    render() {
        this.emailContainer = document.createElement('div');
        this.emailContainer.classList.add('email-container');

        this.emailSidebar = document.createElement('div');
        this.emailSidebar.classList.add('email-sidebar');

        const topHeader = document.createElement('div');
        topHeader.classList.add('top-header');

        const headerActions = document.createElement('div');
        headerActions.classList.add('header-actions');

        const allEmailButton = document.createElement('span');
        allEmailButton.id = 'allEmailButton';
        allEmailButton.classList.add('tab-item', 'active_tab');
        allEmailButton.textContent = 'All';

        const inboxEmailButton = document.createElement('span');
        inboxEmailButton.id = 'inboxEmailButton';
        inboxEmailButton.classList.add('tab-item');
        inboxEmailButton.textContent = 'Inbox';

        const sentEmailButton = document.createElement('span');
        sentEmailButton.id = 'sentEmailButton';
        sentEmailButton.classList.add('tab-item');
        sentEmailButton.textContent = 'Sent';

        const refreshButton = document.createElement('button');
        refreshButton.classList.add('text-muted', 'btn', 'btn-default', 'icon-btn');
        refreshButton.id = 'refresh_email_list';
        refreshButton.innerHTML = ` <svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
                <use class="" href="#es-line-reload"></use>
            </svg>`;

        const composeButton = document.createElement('button');
        composeButton.classList.add('btn-primary', 'text-muted', 'btn', 'icon-btn', 'add-email-btn');
        composeButton.innerHTML = `<svg  class="es-icon es-line icon-xs" aria-hidden="true"><use href="#es-line-add"></use></svg>`;


        headerActions.appendChild(allEmailButton);
        headerActions.appendChild(inboxEmailButton);
        headerActions.appendChild(sentEmailButton);
        headerActions.appendChild(refreshButton);
        headerActions.appendChild(composeButton);
        topHeader.appendChild(headerActions);


        this.emailList = document.createElement('div');
        this.emailList.classList.add('email-list');

        if (this.communication_list.length === 0) {
            // ... (no data message - same as before)
        } else {
            const groupedEmails = this.communication_list.reduce((groups, email) => {
                const group = this.formatDateGroup(email.communication_date);
                groups[group] = groups[group] || [];
                groups[group].push(email);
                return groups;
            }, {});

            const sortedGroups = Object.keys(groupedEmails).sort((a, b) => {
                // ... (sorting logic - same as before)
            });

            sortedGroups.forEach(group => {
                const dateGroupDiv = document.createElement('div');
                dateGroupDiv.classList.add('date-group');
                dateGroupDiv.textContent = group;
                this.emailList.appendChild(dateGroupDiv);

                groupedEmails[group].forEach(item => {
                    const emailItem = this.createEmailItem(item);
                    this.emailList.appendChild(emailItem);
                });
            });
        }

        this.emailSidebar.appendChild(topHeader);
        this.emailSidebar.appendChild(this.emailList);
        this.emailContainer.appendChild(this.emailSidebar);

        this.emailBodyContent = document.createElement('div');
        this.emailBodyContent.id = 'emailBodyContent';
        this.emailBodyContent.classList.add('email-body');

        const defaultMessage = document.createElement('div');
        defaultMessage.style.display = "flex";
        defaultMessage.style.alignItems = "center";
        defaultMessage.style.justifyContent = "center";
        defaultMessage.style.height = "100%";

        const messageContent = document.createElement('div');
        messageContent.style.textAlign = "center";

        const messageTitle = document.createElement('p');
        messageTitle.style.fontSize = "19px";
        messageTitle.style.color = "#333";
        messageTitle.textContent = "Select an item to read";

        const messageSubtitle = document.createElement('p');
        messageSubtitle.style.fontSize = "12px";
        messageSubtitle.style.color = "#666";
        messageSubtitle.textContent = "Nothing is selected";

        messageContent.appendChild(messageTitle);
        messageContent.appendChild(messageSubtitle);
        defaultMessage.appendChild(messageContent);
        this.emailBodyContent.appendChild(defaultMessage);

        this.emailContainer.appendChild(this.emailBodyContent);
        this.wrapper.innerHTML = ""; // Clear any previous content
        this.wrapper.appendChild(this.emailContainer);


        if (this.communication_list.length > 0) {
            setTimeout(() => {
                const latestEmail = this.emailList.querySelector('.email-item');
                if (latestEmail) {
                    latestEmail.click();
                }
            }, 0);
        }
    }

    attachEventListeners() {
        const refreshButton = document.getElementById('refresh_email_list');
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                try {
                    this.communication_list = await getDocList('Communication', [
                        ['Communication', 'reference_name', '=', this.frm.doc.name],
                        ['Communication', 'in_reply_to', '=', '']
                    ], ['*']);
                    this.render();
                    this.attachEventListeners();
                } catch (error) {
                    console.error(error);
                }
            });
        }

        ['all', 'inbox', 'sent'].forEach(type => {
            const tabButton = document.getElementById(`${type}EmailButton`);
            if (tabButton) {
                tabButton.addEventListener('click', async (event) => {
                    try {
                        let filters = [['Communication', 'reference_name', '=', this.frm.doc.name]];
                        if (type !== 'all') {
                            filters.push(['Communication', 'sent_or_received', '=', type === 'inbox' ? 'Received' : 'Sent']);
                        }
                        filters.push(['Communication', 'in_reply_to', '=', '']);

                        this.communication_list = await getDocList('Communication', filters, ['*']);
                        this.render();
                        this.attachEventListeners();

                        const tabs = document.querySelectorAll('.tab-item');
                        tabs.forEach(tab => tab.classList.remove('active_tab'));
                        document.getElementById(`${type}EmailButton`).classList.add('active_tab');

                    } catch (error) {
                        console.error(error);
                    }
                });
            }
        });

        const composeButton = document.querySelector('.add-email-btn');
        if (composeButton) {
            composeButton.addEventListener('click', async () => {
                cur_frm.email_doc("");
            });
        }

        // Email Item Click
        this.emailList.addEventListener('click', async (event) => {
            const emailItem = event.target.closest('.email-item');
            if (emailItem) {
                const docName = emailItem.dataset.emailId;
                this.currentEmailIndex = this.communication_list.findIndex(item => item.name === docName);

                // ... (rest of email item click logic - fetching replies, setting values, rendering email body)
                let replies = await getDocList('Communication', [
                    ['Communication', 'in_reply_to', '=', docName]
                ], ['subject', 'content', 'communication_date']);

                await set_value("Communication", docName);
                let emailDoc = this.communication_list.find(item => item.name === docName);
                const emails = [...replies, emailDoc];

                let emailBody = `
                    <div class="email-detail">
                        <div class="email-detail-header">
                            <div class="email-detail-subject-container">
                                <span class="email-detail-subject">Subject: ${emailDoc?.subject}</span>
                                <div class="action-buttons" id="action_icon">
                                    <span class="email-counter">${this.currentEmailIndex + 1} of ${this.communication_list.length}</span>
                                    <button class="nav-button" id="prev-email" ${this.currentEmailIndex === 0 ? 'disabled' : ''}>
                                        <i class="fa fa-chevron-left"></i>
                                    </button>
                                    <button class="nav-button" id="next-email" ${this.currentEmailIndex === this.communication_list.length - 1 ? 'disabled' : ''}>
                                        <i class="fa fa-chevron-right"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="email-detail-meta">
                                <div class="email-avatar" style="background-color: ${this.getRandomColor()};">
                                    ${emailDoc?.sender[0]?.toUpperCase()}
                                </div>
                                <div class="meta-content">
                                    <div class="meta-sender">${emailDoc?.sender_full_name} <${emailDoc?.sender}></div>
                                    <div class="meta-recipient">To: ${emailDoc?.recipients}</div>
                                </div>
                                <div class="meta-time">
                                    ${formatDateTime(emailDoc?.communication_date, true, true)}
                                </div>
                            </div>
                        </div>
                        <div class="email-detail-body">
                            ${emails.map((email) => `
                                ${email?.content}
                            `).join('')}
                        </div>
                        ${emailDoc?.attachments ? `
                            <div class="attachments">
                                <h4 class="attachments-header">Attachments</h4>
                                <div class="attachment-list">
                                    <span class="attachment-item">
                                        <i class="fa fa-file-o"></i>
                                        document.csv
                                    </span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                this.emailBodyContent.innerHTML = emailBody;
                this.setupNavigation();

                const allEmailItems = this.emailList.querySelectorAll('.email-item');
                allEmailItems.forEach(item => item.classList.remove('active'));
                emailItem.classList.add('active');
            }

        });

    }

    setupNavigation() {
        const prevButton = document.getElementById('prev-email');
        const nextButton = document.getElementById('next-email');

        if (prevButton && nextButton) {
            prevButton.addEventListener('click', () => {
                this.navigateToEmail(-1);
            });

            nextButton.addEventListener('click', () => {
                this.navigateToEmail(1);
            });
        }
    }


    navigateToEmail(direction) {
        const newIndex = this.currentEmailIndex + direction;

        if (newIndex >= 0 && newIndex < this.communication_list.length) {
            this.currentEmailIndex = newIndex;
            const allEmailItems = this.emailList.querySelectorAll('.email-item');
            if (allEmailItems[newIndex]) {
                allEmailItems[newIndex].click();
            }
        }
    }

}

export default SVAEmailComponent;