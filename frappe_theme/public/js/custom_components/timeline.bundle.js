class SVATimelineGenerator {
    constructor(frm, wrapper) {
        this.frm = frm;
        this.wrapper = this.setupWrapper(wrapper);
        this.page = 1;
        this.pageSize = 10;
        this.loading = false;
        this.hasMore = true;
        this.setupInfiniteScroll();
        this.filters = {
            doctype: '',
            owner: ''
        };
        this.setupFilters()
        this.setupPagination();
        this.fetchTimelineData();
        return this.wrapper;
    }
    setupWrapper(wrapper) {
        this.styles = `
        .timeline-entry {
            padding: 24px;
            border-left: 3px solid #e5e7eb;
            margin-left: 32px;
            position: relative;
            margin-bottom: 32px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
        }
        
        .timeline-entry:hover {
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        
        .timeline-entry::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 32px;
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: #6366f1;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #e5e7eb;
            transition: all 0.2s ease;
        }
        
        .timeline-entry:hover::before {
            background: #4f46e5;
            transform: scale(1.2);
        }
        
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            gap: 16px;
        }
        
        .timeline-meta {
            color: #6b7280;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .timeline-user {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .timeline-user-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: #6366f1;
        }
        
        .timeline-link {
            color: #4f46e5;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 6px;
            background: #f5f3ff;
            transition: all 0.2s ease;
        }
        
        .timeline-link:hover {
            background: #ede9fe;
            transform: translateX(2px);
        }
        
        .changes-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            background: #f9fafb;
        }
        
        .changes-table th {
            background: #f3f4f6;
            padding: 8px 12px;
            font-weight: 600;
            text-align: left;
            color: #4b5563;
            font-size: 0.875rem;
        }
        
        .changes-table td {
            padding: 8px 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 0.875rem;
        }
        
        .old-value, .new-value {
            border-radius: 4px;
            padding: 2px 6px;
            font-family: monospace;
            font-size: 0.875rem;
            display: inline-block;
        }
        
        .old-value {
            background-color: #fef2f2;
            color: #991b1b;
            border: 1px solid #fee2e2;
        }
        
        .new-value {
            background-color: #f0fdf4;
            color: #166534;
            border: 1px solid #dcfce7;
        }
        
        .empty-state {
            text-align: center;
            padding: 64px 24px;
            color: #6b7280;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .empty-state svg {
            margin-bottom: 16px;
            opacity: 0.7;
        }
        
        .empty-state p {
            font-size: 1rem;
            font-weight: 500;
            margin: 0;
        }
        
        .timeline-meta-container {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        .timeline-timestamp {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #f3f4f6;
            border-radius: 6px;
            font-weight: 500;
            color: #4b5563;
            transition: all 0.2s ease;
        }
        
        .timeline-timestamp:hover {
            background: #e5e7eb;
        }
        
        .timeline-timestamp svg {
            width: 14px;
            height: 14px;
            color: #9ca3af;
        }
        
        .timeline-date {
            font-weight: 600;
        }
        
        .timeline-time {
            color: #6b7280;
        }
        
        .timeline-relative-time {
            font-size: 0.75rem;
            color: #9ca3af;
            font-style: italic;
        }
        
        .timeline-loader {
            text-align: center;
            padding: 20px;
            display: none;
        }
        
        .timeline-loader.visible {
            display: block;
        }
        
        .loading-dots {
            display: inline-flex;
            gap: 4px;
            align-items: center;
        }
        
        .loading-dots span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #6366f1;
            animation: pulse 1s ease-in-out infinite;
        }
        
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes pulse {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1); opacity: 1; }
        }
        
        @media (max-width: 640px) {
            .timeline-timestamp {
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
            }
            
            .timeline-relative-time {
                display: none;
            }
        }
        
        .skeleton-loader {
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        .skeleton-entry {
            padding: 24px;
            border-left: 3px solid #e5e7eb;
            margin-left: 32px;
            position: relative;
            margin-bottom: 32px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .skeleton-entry::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 32px;
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: #e5e7eb;
        }
        
        .skeleton-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }
        
        .skeleton-user {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .skeleton-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #e5e7eb;
        }
        
        .skeleton-text {
            height: 12px;
            background: #e5e7eb;
            border-radius: 4px;
        }
        
        .skeleton-text.name {
            width: 120px;
        }
        
        .skeleton-text.link {
            width: 200px;
            margin-top: 8px;
        }
        
        .skeleton-text.date {
            width: 150px;
        }
        
        .skeleton-table {
            width: 100%;
            border-spacing: 0;
            margin-top: 16px;
        }
        
        .skeleton-table-row {
            display: flex;
            gap: 16px;
            padding: 8px 0;
        }
        
        .skeleton-cell {
            height: 16px;
            background: #e5e7eb;
            border-radius: 4px;
        }
        
        .skeleton-cell.field {
            width: 25%;
        }
        
        .skeleton-cell.value {
            width: 35%;
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 0.5;
            }
            50% {
                opacity: 1;
            }
        }`;

        this.timeline_wrapper = document.createElement('div');
        this.timeline_wrapper.id = 'timeline-wrapper';

        const styleTag = document.createElement('style');
        styleTag.textContent = this.styles;
        document.head.appendChild(styleTag);
        wrapper.appendChild(this.timeline_wrapper);
        return wrapper;
    }
    setupPagination() {
        // Purane pagination controls ko remove karna
        const existingPagination = this.wrapper.querySelector('.pagination-controls');
        if (existingPagination) {
            existingPagination.remove();
        }
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        paginationContainer.style.cssText = `
            display: flex;
            justify-content: end;
            gap: 8px;
            margin-top: 20px;
            margin-bottom: 20px;
        `;

        this.prevButton = document.createElement('button');
        this.nextButton = document.createElement('button');
        this.pageInfo = document.createElement('span');
        this.prevButton.innerHTML = '&#8592; Previous';
        this.nextButton.innerHTML = `Next &rarr;`;
        this.pageInfo.innerHTML = `Page ${this.page}`;

        [this.prevButton, this.nextButton].forEach(button => {
            button.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #e5e7eb;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                color: #4b5563;
                font-weight: 500;
                transition: all 0.2s ease;
            `;
        });

        this.pageInfo.style.cssText = `
            padding: 8px 16px;
            color: #4b5563;
            font-weight: 500;
        `;

        this.prevButton.onclick = () => this.changePage(-1);
        this.nextButton.onclick = () => this.changePage(1);

        paginationContainer.appendChild(this.prevButton);
        paginationContainer.appendChild(this.pageInfo);
        paginationContainer.appendChild(this.nextButton);

        this.wrapper.appendChild(paginationContainer);

        // Initialize button states
        this.updatePaginationButtons();
    }

    async changePage(direction) {
        if (this.loading) return;

        const newPage = this.page + direction;
        if (newPage < 1) return;

        this.page = newPage;
        this.pageInfo.innerHTML = `Page ${this.page}`;
        // this.setupPagination();
        await this.fetchTimelineData();

        // Update button states
        this.prevButton.disabled = this.page === 1;
        this.prevButton.style.opacity = this.page === 1 ? '0.5' : '1';
        this.nextButton.disabled = !this.hasMore;
        this.nextButton.style.opacity = !this.hasMore ? '0.5' : '1';
    }
    formatRelativeTime(dateStr) {
        const date = frappe.datetime.str_to_obj(dateStr);
        if (!date) return '';

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 60) {
            return `${minutes} ${minutes > 1 ? __('minutes') : __('minute')} ${__('ago')}`;
        } else if (hours < 24) {
            return `${hours} ${hours > 1 ? __('hours') : __('hour')} ${__('ago')}`;
        } else if (days < 30) {
            return `${days} ${days > 1 ? __('days') : __('day')} ${__('ago')}`;
        } else {
            return '';
        }
    }
    setupInfiniteScroll() {
        // Create loading indicator
        this.loader = document.createElement('div');
        this.loader.className = 'timeline-loader';
        this.loader.innerHTML = `
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>`;

        // Add intersection observer for infinite scroll
        const options = {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.loading && this.hasMore) {
                    this.loadMore();
                }
            });
        }, options);

        this.timeline_wrapper.appendChild(this.loader);
        this.observer.observe(this.loader);
    }
    async loadMore() {
        if (this.loading || !this.hasMore) return;

        this.loading = true;
        this.page += 1;
        this.showSkeletonLoader();
        // this.setupPagination();
        await this.fetchTimelineData(true);
        this.loading = false;
    }
    showSkeletonLoader() {
        const skeletonHTML = `
            <div class="skeleton-entry skeleton-loader">
                <div class="skeleton-header">
                    <div>
                        <div class="skeleton-user">
                            <div class="skeleton-avatar"></div>
                            <div class="skeleton-text name"></div>
                        </div>
                        <div class="skeleton-text link"></div>
                    </div>
                    <div class="skeleton-text date"></div>
                </div>
                <div class="skeleton-table">
                    ${Array(3).fill().map(() => `
                        <div class="skeleton-table-row">
                            <div class="skeleton-cell field"></div>
                            <div class="skeleton-cell value"></div>
                            <div class="skeleton-cell value"></div>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        // Show multiple skeleton entries
        const skeletonEntries = Array(3).fill(skeletonHTML).join('');

        if (!this.page || this.page === 1) {
            this.timeline_wrapper.innerHTML = skeletonEntries;
        } else {
            const timelineContainer = this.timeline_wrapper.querySelector('#timeline-container');
            if (timelineContainer) {
                timelineContainer.insertAdjacentHTML('beforeend', skeletonEntries);
            }
        }
    }
    fetchTimelineData(append = false) {
        if (!append) {
            this.showSkeletonLoader();
        }
        // Ensure filters are properly formatted
        const filters = {
            doctype: this.filters.doctype || '',
            owner: this.filters.owner || ''
        };

        return frappe.call({
            method: "frappe_theme.api.get_versions",
            args: {
                dt: this.frm.doctype,
                dn: this.frm.docname,
                start: (this.page - 1) * this.pageSize,
                page_length: this.pageSize + 1, // Fetch one extra record to check if next page exists
                filters: JSON.stringify(filters),
            },
        }).then((response) => {
            const versions = response.message || [];
            // Check if we got more records than pageSize to determine if next page exists
            this.hasMore = versions.length > this.pageSize;

            // If we got extra record, remove it from display
            if (this.hasMore) {
                versions.pop();
            }

            // Update pagination button states
            this.updatePaginationButtons();

            if (!append) {
                this.timeline_wrapper.innerHTML = '';
                const timelineContainer = document.createElement('div');
                timelineContainer.id = 'timeline-container';
                this.timeline_wrapper.appendChild(timelineContainer);
            }

            const timelineContainer = this.timeline_wrapper.querySelector('#timeline-container');

            if (versions.length > 0) {
                versions.forEach(item => {
                    let changes = [];
                    try {
                        changes = JSON.parse(item.changed);
                    } catch (error) {
                        console.error("Error parsing 'changed' field:", error);
                    }

                    const entry = document.createElement('div');
                    entry.className = 'timeline-entry';

                    entry.innerHTML = `
                        <div class="timeline-header">
                            <div>
                                <div class="timeline-user">
                                    <div class="timeline-user-avatar">
                                        ${item.owner.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="timeline-meta">${item.owner}</div>
                                </div>
                                <a href="#" class="timeline-link"
                                style="display: ${(item.custom_actual_doctype || item.ref_doctype) === this.frm.doc.doctype ? 'none' : 'block'};"
                                >
                                    ${__(item.custom_actual_doctype || item.ref_doctype)} - 
                                    ${item.custom_actual_document_name || item.docname}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M7 17L17 7M17 7H7M17 7V17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </a>
                            </div>
                            <div class="timeline-meta-container">
                                <div class="timeline-timestamp">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span class="timeline-date">${frappe.datetime.global_date_format(item.creation)}</span>
                                </div>
                                <span class="timeline-relative-time">${this.formatRelativeTime(item.creation)}</span>
                            </div>   
                        </div>
                        <table class="changes-table">
                            <thead>
                                <tr>
                                    <th>Field</th>
                                    <th>Previous</th>
                                    <th>Current</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${changes.map(change => `
                                    <tr>
                                        <td>${change[0]}</td>
                                        <td><span class="old-value">${change[1] || ''}</span></td>
                                        <td><span class="new-value">${change[2] || ''}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>`;

                    entry.querySelector('.timeline-link').addEventListener('click', (e) => {
                        e.preventDefault();
                        const doctype = item.custom_actual_doctype || item.ref_doctype;
                        const docname = item.custom_actual_document_name || item.docname;

                        frappe.model.with_doctype(doctype, () => {
                            frappe.model.with_doc(doctype, docname, function () {
                                const doc = frappe.get_doc(doctype, docname);
                                const meta = frappe.get_meta(doctype);

                                const d = new frappe.ui.Dialog({
                                    title: __(`${doctype}: ${docname}`),
                                    fields: meta.fields.filter(df => !["HTML","Table","Table Multiselect","Button","Color"].includes(df.fieldtype)).map(df => ({
                                        ...df,
                                        read_only: 1
                                    }))
                                });

                                d.set_values(doc);
                                d.show();
                            });
                        });
                    });

                    timelineContainer.appendChild(entry);
                });
            } else if (!append) {
                timelineContainer.innerHTML = `
                    <div class="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af">
                            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <p>No changes found</p>
                    </div>
                `;
            }

            // Always ensure loader is last
            if (this.loader.parentNode === this.timeline_wrapper) {
                this.timeline_wrapper.appendChild(this.loader);
            }
        }).catch((error) => {
            if (!append) {
                this.timeline_wrapper.innerHTML = `
                    <div class="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444">
                            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <p>Failed to load timeline data</p>
                    </div>
                `;
            }
        });
    }

    updatePaginationButtons() {
        if (this.prevButton && this.nextButton) {
            this.prevButton.disabled = this.page === 1;
            this.prevButton.style.opacity = this.page === 1 ? '0.5' : '1';
            this.nextButton.disabled = !this.hasMore;
            this.nextButton.style.opacity = !this.hasMore ? '0.5' : '1';
        }
    }

    //  Filter UI

    setupFilters() {
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'timeline-filters';
        filtersContainer.style.cssText = `
            background: white;
            padding: 12px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.03);
            margin-bottom: 20px;
            margin-left: 32px;
            border: 1px solid #f3f4f6;
        `;

        // Create compact filters wrapper with search bar look
        const filtersWrapper = document.createElement('div');
        filtersWrapper.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
            background: #f9fafb;
            border-radius: 8px;
            padding: 6px;
        `;

        // Filter icon
        const filterIcon = document.createElement('div');
        filterIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280">
                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        filterIcon.style.cssText = `
            display: flex;
            align-items: center;
            padding: 0 4px;
            color: #6b7280;
        `;

        // Doctype filter with icon
        this.doctypeSelect = document.createElement('select');
        this.doctypeSelect.style.cssText = `
            min-width: 180px;
            padding: 8px 32px 8px 28px;
            border: 1px solid #e5e7eb;
            outline: none;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"),
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat, no-repeat;
            background-position: right 8px center, left 8px center;
            background-size: 16px, 16px;
        `;

        // Owner search with icon
        const searchWrapper = document.createElement('div');
        searchWrapper.style.cssText = `
            position: relative;
            flex: 1;
            min-width: 160px;
        `;

        this.ownerSearch = document.createElement('input');
        this.ownerSearch.type = 'text';
        this.ownerSearch.placeholder = 'Search user...';
        this.ownerSearch.style.cssText = `
            width: 100%;
            padding: 8px 32px 8px 28px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            outline: none;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 8px center;
            background-size: 16px;
        `;

        // Clear filters button with improved styling
        this.clearButton = document.createElement('button');
        this.clearButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        this.clearButton.style.cssText = `
            display: none;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0;
            background: #f3f4f6;
            color: #4b5563;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        // Hover and focus states
        [this.doctypeSelect, this.ownerSearch].forEach(element => {
            element.addEventListener('focus', () => {
                element.style.borderColor = '#6366f1';
                element.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
            });
            element.addEventListener('blur', () => {
                element.style.borderColor = '#e5e7eb';
                element.style.boxShadow = 'none';
            });
        });

        // Append elements
        filtersWrapper.appendChild(filterIcon);
        filtersWrapper.appendChild(this.doctypeSelect);
        searchWrapper.appendChild(this.ownerSearch);
        filtersWrapper.appendChild(searchWrapper);
        filtersWrapper.appendChild(this.clearButton);
        filtersContainer.appendChild(filtersWrapper);
        this.wrapper.insertBefore(filtersContainer, this.timeline_wrapper);

        this.setupFilterEventListeners();
        this.fetchDoctypes();
    }

    setupFilterEventListeners() {
        const updateClearButtonVisibility = () => {
            const hasFilters = this.filters.doctype || this.filters.owner;
            this.clearButton.style.display = hasFilters ? 'inline-flex' : 'none';
        };

        this.doctypeSelect.addEventListener('change', () => {
            this.filters.doctype = this.doctypeSelect.value;
            this.page = 1;
            this.setupPagination();
            this.fetchTimelineData();
            updateClearButtonVisibility();
        });

        let timeout;
        this.ownerSearch.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.filters.owner = this.ownerSearch.value;
                this.page = 1;
                this.setupPagination();
                this.fetchTimelineData();
                updateClearButtonVisibility();
            }, 300);
        });

        this.clearButton.addEventListener('click', () => {
            this.doctypeSelect.value = '';
            this.ownerSearch.value = '';
            this.filters.doctype = '';
            this.filters.owner = '';
            this.page = 1;
            this.setupPagination();
            this.fetchTimelineData();
            updateClearButtonVisibility();
        });
    }

    async fetchDoctypes() {
        try {
            const response = await frappe.call({
                method: "frappe_theme.api.get_timeline_dt",
                args: {
                    dt: this.frm.doctype,
                    dn: this.frm.docname,
                }
            });

            const doctypes = response.message || [];
            this.doctypeSelect.innerHTML = "";

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = __('All Documents');
            placeholderOption.selected = true;
            this.doctypeSelect.appendChild(placeholderOption);

            // Add current doctype option
            const currentOption = document.createElement('option');
            currentOption.value = this.frm.doc.doctype;
            currentOption.textContent = __(this.frm.doc.doctype);
            this.doctypeSelect.appendChild(currentOption);

            // Add other doctype options
            doctypes.forEach(dt => {
                const option = document.createElement('option');
                option.value = dt;
                option.textContent = __(dt);
                this.doctypeSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching doctypes:", error);
        }
    }
}

export default SVATimelineGenerator;