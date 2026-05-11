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
			doctype: "",
			owner: "",
			field: "",
			date_from: "",
			date_to: "",
		};
		this._selectedField = { value: "", label: "All Fields" };
		this.fieldOptions = [];
		this.setupFilters();
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

        .changes-table-wrapper {
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            background: #f9fafb;
        }

        .changes-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: #f9fafb;
            table-layout: fixed;
        }

        .changes-table th {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            padding: 10px 14px;
            font-weight: 600;
            text-align: left;
            color: #334155;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #e2e8f0;
            position: sticky;
            top: 0;
            z-index: 1;
        }

        .changes-table th:nth-child(1) {
            width: 25%;
        }

        .changes-table th:nth-child(2),
        .changes-table th:nth-child(3) {
            width: 37.5%;
        }

        .changes-table td {
            padding: 10px 14px;
            border-top: 1px solid #f1f5f9;
            font-size: 0.8125rem;
            vertical-align: top;
        }

        .changes-table td:nth-child(1) {
            width: 25%;
            font-weight: 500;
            color: #475569;
        }

        .changes-table td:nth-child(2),
        .changes-table td:nth-child(3) {
            width: 37.5%;
        }

        .changes-table tbody tr:hover {
            background: #f8fafc;
        }

        .changes-table tbody tr:nth-child(even) {
            background: #fafbfc;
        }

        .old-value, .new-value {
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 0.8125rem;
            display: block;
            max-height: 200px;
            overflow-y: auto;
            overflow-x: auto;
        }

        .old-value {
            background-color: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }

        .new-value {
            background-color: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
        }

        .old-value::-webkit-scrollbar,
        .new-value::-webkit-scrollbar {
            height: 4px;
            width: 4px;
        }

        .old-value::-webkit-scrollbar-thumb,
        .new-value::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }

        .value-chip-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .value-chip {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 0.75rem;
            line-height: 1.2;
            font-weight: 500;
            border: 1px solid transparent;
            white-space: nowrap;
        }

        .old-value .value-chip {
            background: #fee2e2;
            color: #991b1b;
            border-color: #fca5a5;
        }

        .new-value .value-chip {
            background: #dcfce7;
            color: #166534;
            border-color: #86efac;
        }

        .json-mini-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.75rem;
            margin: 0;
        }

        .json-mini-table th {
            background: rgba(0,0,0,0.04);
            padding: 5px 8px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border: 1px solid rgba(0,0,0,0.06);
            white-space: nowrap;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .json-mini-table td {
            padding: 5px 8px;
            border: 1px solid rgba(0,0,0,0.06);
            color: #374151;
            white-space: nowrap;
        }

        .json-mini-table tr:nth-child(even) {
            background: rgba(0,0,0,0.015);
        }

        .json-mini-table tr:hover {
            background: rgba(0,0,0,0.03);
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

            .timeline-filters {
                margin-left: 0 !important;
                padding: 8px !important;
            }

            .timeline-entry {
                margin-left: 0 !important;
                border-left: none !important;
            }

            .timeline-entry::before {
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
        }

        .geo-added-chip {
            background: #dcfce7;
            color: #166534;
            border-color: #86efac;
            font-weight: 600;
        }

        .geo-removed-chip {
            background: #fee2e2;
            color: #991b1b;
            border-color: #fca5a5;
        }

        .old-value .value-chip,
        .new-value .value-chip {
            background: rgba(0,0,0,0.04);
            color: #374151;
            border-color: #d1d5db;
        }

        .geo-parent-badge {
            display: inline-block;
            margin-left: 4px;
            font-size: 0.65rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            opacity: 0.7;
            vertical-align: middle;
        }`;

		this.timeline_wrapper = document.createElement("div");
		this.timeline_wrapper.id = "timeline-wrapper";

		const styleTag = document.createElement("style");
		styleTag.textContent = this.styles;
		document.head.appendChild(styleTag);
		wrapper.appendChild(this.timeline_wrapper);
		return wrapper;
	}
	setupPagination() {
		// Purane pagination controls ko remove karna
		const existingPagination = this.wrapper.querySelector(".pagination-controls");
		if (existingPagination) {
			existingPagination.remove();
		}
		const paginationContainer = document.createElement("div");
		paginationContainer.className = "pagination-controls";
		paginationContainer.style.cssText = `
            display: flex;
            justify-content: end;
            gap: 8px;
            margin-top: 20px;
            margin-bottom: 20px;
        `;

		this.prevButton = document.createElement("button");
		this.nextButton = document.createElement("button");
		this.pageInfo = document.createElement("span");
		this.prevButton.innerHTML = "&#8592; Previous";
		this.nextButton.innerHTML = `Next &rarr;`;
		this.pageInfo.innerHTML = `Page ${this.page}`;

		[this.prevButton, this.nextButton].forEach((button) => {
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
		this.prevButton.style.opacity = this.page === 1 ? "0.5" : "1";
		this.nextButton.disabled = !this.hasMore;
		this.nextButton.style.opacity = !this.hasMore ? "0.5" : "1";
	}
	formatRelativeTime(dateStr) {
		const date = frappe.datetime.str_to_obj(dateStr);
		if (!date) return "";

		const now = new Date();
		const diff = now - date;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (minutes < 60) {
			return `${minutes} ${minutes > 1 ? __("minutes") : __("minute")} ${__("ago")}`;
		} else if (hours < 24) {
			return `${hours} ${hours > 1 ? __("hours") : __("hour")} ${__("ago")}`;
		} else if (days < 30) {
			return `${days} ${days > 1 ? __("days") : __("day")} ${__("ago")}`;
		} else {
			return "";
		}
	}
	setupInfiniteScroll() {
		// Create loading indicator
		this.loader = document.createElement("div");
		this.loader.className = "timeline-loader";
		this.loader.innerHTML = `
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>`;

		// Add intersection observer for infinite scroll
		const options = {
			root: null,
			rootMargin: "100px",
			threshold: 0.1,
		};

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
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
                    ${Array(3)
						.fill()
						.map(
							() => `
                        <div class="skeleton-table-row">
                            <div class="skeleton-cell field"></div>
                            <div class="skeleton-cell value"></div>
                            <div class="skeleton-cell value"></div>
                        </div>
                    `
						)
						.join("")}
                </div>
            </div>`;

		// Show multiple skeleton entries
		const skeletonEntries = Array(3).fill(skeletonHTML).join("");

		if (!this.page || this.page === 1) {
			this.timeline_wrapper.innerHTML = skeletonEntries;
		} else {
			const timelineContainer = this.timeline_wrapper.querySelector("#timeline-container");
			if (timelineContainer) {
				timelineContainer.insertAdjacentHTML("beforeend", skeletonEntries);
			}
		}
	}
	getJsonSkipFields() {
		return new Set([
			"name",
			"idx",
			"__islocal",
			"__unsaved",
			"doctype",
			"docstatus",
			"owner",
			"modified_by",
			"creation",
			"modified",
			"parent",
			"parentfield",
			"parenttype",
			"budget_plan_doc",
			"planning_table",
		]);
	}

	extractSingleRowValue(row, skipFields = this.getJsonSkipFields()) {
		if (!row || typeof row !== "object" || Array.isArray(row)) return null;

		const candidateEntries = Object.entries(row).filter(
			([key, val]) =>
				!skipFields.has(key) &&
				val !== undefined &&
				val !== null &&
				val !== "" &&
				(typeof val === "string" || typeof val === "number")
		);

		if (candidateEntries.length !== 1) return null;
		return String(candidateEntries[0][1]);
	}

	normalizeTableMultiSelectChanges(changes) {
		const grouped = {};
		const groupedOrder = [];
		const output = [];

		changes.forEach((change) => {
			const oldRowValue = this.extractSingleRowValueFromJson(change.oldValue);
			const newRowValue = this.extractSingleRowValueFromJson(change.newValue);
			const oldBlank = !change.oldValue || String(change.oldValue).trim() === "(blank)";
			const newBlank = !change.newValue || String(change.newValue).trim() === "(blank)";

			const isRemoved = oldRowValue && (newBlank || !newRowValue);
			const isAdded = newRowValue && (oldBlank || !oldRowValue);

			if (!(isAdded || isRemoved)) {
				output.push(change);
				return;
			}

			const key = `${change.fieldLabel || ""}`;

			if (!grouped[key]) {
				grouped[key] = {
					fieldLabel: change.fieldLabel,
					oldValues: [],
					newValues: [],
				};
				groupedOrder.push(key);
			}

			if (isAdded) grouped[key].newValues.push(newRowValue);
			if (isRemoved) grouped[key].oldValues.push(oldRowValue);
		});

		groupedOrder.forEach((key) => {
			const row = grouped[key];
			const uniqueOld = [...new Set(row.oldValues)];
			const uniqueNew = [...new Set(row.newValues)];
			output.push({
				fieldLabel: row.fieldLabel,
				oldValue: uniqueOld.length ? uniqueOld.join(", ") : "(blank)",
				newValue: uniqueNew.length ? uniqueNew.join(", ") : "(blank)",
				__tableMultiSelect: 1,
			});
		});

		return output;
	}

	async getTableMultiSelectInfo(sourceDoctype, fieldLabel) {
		if (!sourceDoctype || !fieldLabel) return null;
		this._tableMultiSelectInfoCache = this._tableMultiSelectInfoCache || {};
		const cacheKey = `${sourceDoctype}::${fieldLabel}`;
		if (Object.prototype.hasOwnProperty.call(this._tableMultiSelectInfoCache, cacheKey)) {
			return this._tableMultiSelectInfoCache[cacheKey];
		}

		try {
			await frappe.model.with_doctype(sourceDoctype);
			const meta = frappe.get_meta(sourceDoctype);
			const tableDf = (meta?.fields || []).find(
				(df) => df.fieldtype === "Table MultiSelect" && df.label === fieldLabel
			);
			if (!tableDf?.options) {
				this._tableMultiSelectInfoCache[cacheKey] = null;
				return null;
			}

			await frappe.model.with_doctype(tableDf.options);
			const childMeta = frappe.get_meta(tableDf.options);
			const linkDf = (childMeta?.fields || []).find((df) => df.fieldtype === "Link");
			const info = {
				fieldname: tableDf.fieldname,
				childDoctype: tableDf.options,
				linkFieldname: linkDf?.fieldname || null,
				linkDoctype: linkDf?.options || null,
			};
			this._tableMultiSelectInfoCache[cacheKey] = info;
			return info;
		} catch (e) {
			this._tableMultiSelectInfoCache[cacheKey] = null;
			return null;
		}
	}

	async resolveCsvLinkTitles(csvValue, linkDoctype) {
		if (!csvValue || csvValue === "(blank)" || !linkDoctype) return csvValue;
		const values = String(csvValue)
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		if (!values.length) return csvValue;

		const resolved = [];
		for (const value of values) {
			try {
				const title =
					frappe.utils.get_link_title(linkDoctype, value) ||
					(await frappe.utils.fetch_link_title(linkDoctype, value));
				resolved.push(title || value);
			} catch (e) {
				resolved.push(value);
			}
		}
		return resolved.join(", ");
	}

	async resolveCsvLinkTitlesArray(csvValue, linkDoctype) {
		if (!csvValue || csvValue === "(blank)" || !linkDoctype) return null;
		const values = String(csvValue)
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		if (!values.length) return null;

		const resolved = [];
		for (const value of values) {
			try {
				const title =
					frappe.utils.get_link_title(linkDoctype, value) ||
					(await frappe.utils.fetch_link_title(linkDoctype, value));
				resolved.push(title || value);
			} catch (e) {
				resolved.push(value);
			}
		}
		return resolved;
	}

	parseCsvValues(csvValue) {
		if (!csvValue || csvValue === "(blank)") return [];
		return String(csvValue)
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
	}

	getInitialTableMultiSelectState(sourceDoctype, fieldInfo) {
		if (!fieldInfo?.fieldname || !fieldInfo?.linkFieldname) return null;
		if (sourceDoctype !== this.frm.doctype) return null;

		const rows = this.frm.doc[fieldInfo.fieldname] || [];
		if (!Array.isArray(rows)) return null;

		const values = rows
			.map((row) => row && row[fieldInfo.linkFieldname])
			.filter(Boolean)
			.map((value) => String(value));

		return values.length ? [...new Set(values)] : [];
	}

	async applyFullTableMultiSelectState(changes, sourceDoctype) {
		this._tableMultiSelectStateCache = this._tableMultiSelectStateCache || {};

		for (const change of changes) {
			if (!change?.__tableMultiSelect) continue;

			const info = await this.getTableMultiSelectInfo(sourceDoctype, change.fieldLabel);
			if (!info) continue;

			const stateKey = `${sourceDoctype}::${change.fieldLabel}`;
			if (
				!Object.prototype.hasOwnProperty.call(this._tableMultiSelectStateCache, stateKey)
			) {
				const initialState = this.getInitialTableMultiSelectState(sourceDoctype, info);
				if (initialState) {
					this._tableMultiSelectStateCache[stateKey] = initialState;
				}
			}

			const currentState = this._tableMultiSelectStateCache[stateKey];
			if (!currentState) continue;

			const removedValues = this.parseCsvValues(change.oldValue);
			const addedValues = this.parseCsvValues(change.newValue);

			const previousState = currentState.filter((value) => !addedValues.includes(value));
			removedValues.forEach((value) => {
				if (!previousState.includes(value)) {
					previousState.push(value);
				}
			});

			change.oldValue = previousState.length ? previousState.join(", ") : "(blank)";
			change.newValue = currentState.length ? currentState.join(", ") : "(blank)";
			this._tableMultiSelectStateCache[stateKey] = previousState;
		}

		return changes;
	}

	async resolveTableMultiSelectTitles(changes, sourceDoctype) {
		const resolvedChanges = [];

		for (const change of changes) {
			if (!change?.__tableMultiSelect) {
				resolvedChanges.push(change);
				continue;
			}

			const cloned = { ...change };
			const info = await this.getTableMultiSelectInfo(sourceDoctype, change.fieldLabel);
			const linkDoctype = info?.linkDoctype;

			if (linkDoctype) {
				cloned.__oldItems = await this.resolveCsvLinkTitlesArray(
					cloned.oldValue,
					linkDoctype
				);
				cloned.__newItems = await this.resolveCsvLinkTitlesArray(
					cloned.newValue,
					linkDoctype
				);
			}

			resolvedChanges.push(cloned);
		}

		return resolvedChanges;
	}

	extractSingleRowValueFromJson(value) {
		if (!value || typeof value !== "string") return null;
		const trimmed = value.trim();
		if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) return null;

		try {
			const parsed = JSON.parse(trimmed);
			return this.extractSingleRowValue(parsed);
		} catch (e) {
			return null;
		}
	}

	isGeoDetailsChange(change) {
		const val =
			change.newValue && change.newValue !== "(blank)" ? change.newValue : change.oldValue;
		if (!val || val === "(blank)") return false;
		const trimmed = val.trim();
		if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) return false;
		try {
			const p = JSON.parse(trimmed);
			return p && ("state_name" in p || "district_name" in p || "block_name" in p);
		} catch {
			return false;
		}
	}

	normalizeGeoChanges(changes) {
		const geoChanges = changes.filter((c) => this.isGeoDetailsChange(c));
		const nonGeoChanges = changes.filter((c) => !this.isGeoDetailsChange(c));
		if (!geoChanges.length) return changes;

		const addedRows = [];
		const removedRows = [];
		for (const change of geoChanges) {
			const isAdded = !change.oldValue || change.oldValue === "(blank)";
			const val = isAdded ? change.newValue : change.oldValue;
			try {
				const row = JSON.parse(val.trim());
				if (isAdded) addedRows.push(row);
				else removedRows.push(row);
			} catch (_e) {
				/* invalid JSON — skip row */
			}
		}

		const levels = [
			{ key: "state", idField: "state", nameField: "state_name", parentField: null },
			{
				key: "district",
				idField: "district",
				nameField: "district_name",
				parentField: "state_name",
			},
			{
				key: "block",
				idField: "block",
				nameField: "block_name",
				parentField: "district_name",
			},
			{
				key: "gram_panchayat",
				idField: "gram_panchayat",
				nameField: "gram_panchayat_name",
				parentField: "block_name",
			},
			{
				key: "village",
				idField: "village",
				nameField: "village_name",
				parentField: "gram_panchayat_name",
			},
		];
		const levelLabels = {
			state: "States",
			district: "Districts",
			block: "Blocks",
			gram_panchayat: "Gram Panchayats",
			village: "Villages",
		};

		const getRowDepth = (row) => {
			if (row.village_name) return "village";
			if (row.gram_panchayat_name) return "gram_panchayat";
			if (row.block_name) return "block";
			if (row.district_name) return "district";
			if (row.state_name) return "state";
			return null;
		};

		// Build a composite name-key for a row up to the given level
		// e.g. district level → "Bihar|Saran", state level → "Bihar"
		const rowNameKey = (row, level) => {
			const parts = [row.state_name];
			if (level.key !== "state") parts.push(row.district_name);
			if (level.key !== "state" && level.key !== "district") parts.push(row.block_name);
			if (["gram_panchayat", "village"].includes(level.key))
				parts.push(row.gram_panchayat_name);
			if (level.key === "village") parts.push(row.village_name);
			return parts.filter(Boolean).join("|");
		};

		// Collect unique rows for a level by aggregating from rows at this depth OR deeper.
		// e.g. for "States", also collects state names from district/block rows.
		const levelOrder = ["state", "district", "block", "gram_panchayat", "village"];
		const getRowsForLevel = (rows, level) => {
			const levelIdx = levelOrder.indexOf(level.key);
			const seen = new Set();
			return rows.filter((r) => {
				const depthIdx = levelOrder.indexOf(getRowDepth(r));
				if (depthIdx < levelIdx) return false; // row doesn't reach this level
				if (!r[level.nameField]) return false;
				const key = rowNameKey(r, level);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		};

		const geoLevelChanges = [];
		for (const level of levels) {
			const rawAdded = getRowsForLevel(addedRows, level);
			const rawRemoved = getRowsForLevel(removedRows, level);
			if (!rawAdded.length && !rawRemoved.length) continue;

			// Match rows by name-key to identify truly added/removed vs re-saved unchanged rows
			const addedKeys = new Map(rawAdded.map((r) => [rowNameKey(r, level), r]));
			const removedKeys = new Map(rawRemoved.map((r) => [rowNameKey(r, level), r]));

			const unchanged = [...addedKeys.entries()]
				.filter(([k]) => removedKeys.has(k))
				.map(([, r]) => r);
			const trulyAdded = [...addedKeys.entries()]
				.filter(([k]) => !removedKeys.has(k))
				.map(([, r]) => r);
			const trulyRemoved = [...removedKeys.entries()]
				.filter(([k]) => !addedKeys.has(k))
				.map(([, r]) => r);

			// Only show this level if something actually changed at this level
			if (!trulyAdded.length && !trulyRemoved.length) continue;

			const makeItem = (row) => ({
				label: row[level.nameField] || row[level.idField],
				parentLabel: level.parentField
					? (row[level.parentField] || "").toUpperCase()
					: null,
			});

			geoLevelChanges.push({
				fieldLabel: levelLabels[level.key],
				__geoChange: true,
				__geoLevel: level.nameField,
				__unchangedItems: unchanged.map(makeItem),
				__addedItems: trulyAdded.map(makeItem),
				__removedItems: trulyRemoved.map(makeItem),
			});
		}

		return [...nonGeoChanges, ...geoLevelChanges];
	}

	_geoChip(item, cssClass) {
		return `<span class="value-chip ${cssClass}">${frappe.utils.escape_html(item.label)}${
			item.parentLabel
				? `<span class="geo-parent-badge">${frappe.utils.escape_html(
						item.parentLabel
				  )}</span>`
				: ""
		}</span>`;
	}

	formatGeoPrevious(change) {
		const prev = [...(change.__removedItems || []), ...(change.__unchangedItems || [])];
		if (!prev.length) return "(empty)";
		const chips = [
			...(change.__removedItems || []).map((i) => this._geoChip(i, "geo-removed-chip")),
			...(change.__unchangedItems || []).map((i) => this._geoChip(i, "value-chip")),
		].join("");
		return `<span class="value-chip-container">${chips}</span>`;
	}

	formatGeoCurrent(change) {
		const curr = [...(change.__unchangedItems || []), ...(change.__addedItems || [])];
		if (!curr.length) return "(empty)";
		const chips = [
			...(change.__unchangedItems || []).map((i) => this._geoChip(i, "value-chip")),
			...(change.__addedItems || []).map((i) => this._geoChip(i, "geo-added-chip")),
		].join("");
		return `<span class="value-chip-container">${chips}</span>`;
	}

	parseGeoDocname(docname) {
		if (!docname || !docname.startsWith("GD-")) return null;
		const rest = docname.slice(3);
		const idx = rest.indexOf("-");
		if (idx === -1) return null;
		return { doctype: rest.slice(0, idx), docname: rest.slice(idx + 1) };
	}

	// Format JSON values into readable mini-tables
	formatCellValue(value) {
		if (!value || typeof value !== "string") return value || "";

		const trimmed = value.trim();
		if (
			(trimmed.startsWith("[") && trimmed.endsWith("]")) ||
			(trimmed.startsWith("{") && trimmed.endsWith("}"))
		) {
			try {
				let parsed = JSON.parse(trimmed);
				const skipFields = this.getJsonSkipFields();

				if (!Array.isArray(parsed)) {
					const singleValue = this.extractSingleRowValue(parsed, skipFields);
					if (singleValue !== null) return singleValue;
					parsed = [parsed];
				}
				if (parsed.length === 0) return "(empty)";

				const csvValues = parsed
					.map((row) => this.extractSingleRowValue(row, skipFields))
					.filter((value) => value !== null);
				if (csvValues.length && csvValues.length === parsed.length) {
					return csvValues.join(", ");
				}

				const allKeys = new Set();
				parsed.forEach((row) => {
					if (row && typeof row === "object") {
						Object.keys(row).forEach((k) => {
							if (!skipFields.has(k)) allKeys.add(k);
						});
					}
				});

				const keys = Array.from(allKeys);
				if (keys.length === 0) return trimmed;

				let html = `<table class="json-mini-table"><thead><tr>`;
				html += `<th>#</th>`;
				keys.forEach((k) => {
					const label = frappe.model.unscrub(k);
					html += `<th>${label}</th>`;
				});
				html += `</tr></thead><tbody>`;
				parsed.forEach((row, i) => {
					html += `<tr>`;
					html += `<td>${i + 1}</td>`;
					keys.forEach((k) => {
						let val = row[k];
						if (val === undefined || val === null) val = "";
						if (typeof val === "number") {
							val = frappe.format(val, { fieldtype: "Currency" });
						}
						html += `<td>${val}</td>`;
					});
					html += `</tr>`;
				});
				html += `</tbody></table>`;
				return html;
			} catch (e) {
				return value;
			}
		}
		return value;
	}

	formatChipValue(value) {
		let items;
		if (Array.isArray(value)) {
			items = value.filter(Boolean);
		} else {
			if (!value || String(value).trim() === "(blank)") return "(blank)";
			items = String(value)
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);
		}

		if (!items.length) return "(blank)";

		return `<span class="value-chip-container">${items
			.map((item) => `<span class="value-chip">${frappe.utils.escape_html(item)}</span>`)
			.join("")}</span>`;
	}

	formatTimelineValue(change, value) {
		if (change?.__tableMultiSelect) {
			const isOld = value === change.oldValue;
			const items = isOld ? change.__oldItems : change.__newItems;
			return this.formatChipValue(items || value);
		}
		return this.formatCellValue(value);
	}

	fetchTimelineData(append = false) {
		if (!append) {
			this.showSkeletonLoader();
			this._tableMultiSelectStateCache = {};
		}
		// Ensure filters are properly formatted
		// Strip geo-level suffix (e.g. "geography_details::state_name" → "geography_details")
		const rawField = this.filters.field || "";
		const activeGeoLevel = rawField.includes("::") ? rawField.split("::")[1] : null;
		const filters = {
			doctype: this.filters.doctype || "",
			owner: this.filters.owner || "",
			field: rawField.split("::")[0],
			date_from: this.filters.date_from || "",
			date_to: this.filters.date_to || "",
		};

		return frappe
			.call({
				method: "frappe_theme.api.get_versions",
				args: {
					dt: this.frm.doctype,
					dn: this.frm.docname,
					start: (this.page - 1) * this.pageSize,
					page_length: this.pageSize + 1, // Fetch one extra record to check if next page exists
					filters: JSON.stringify(filters),
				},
			})
			.then(async (response) => {
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
					this.timeline_wrapper.innerHTML = "";
					const timelineContainer = document.createElement("div");
					timelineContainer.id = "timeline-container";
					this.timeline_wrapper.appendChild(timelineContainer);
				}

				const timelineContainer =
					this.timeline_wrapper.querySelector("#timeline-container");

				if (versions.length > 0) {
					for (const item of versions) {
						let changes = [];
						try {
							changes = JSON.parse(item.changed);
						} catch (error) {
							console.error("Error parsing 'changed' field:", error);
						}
						// Separate regular changes and child table changes
						const regularChanges = [];
						const childTableGroups = {};
						const childTableRowCounters = {}; // Track row indices per child table

						changes.forEach((change) => {
							const isChildTable = change[3] === 1;
							if (isChildTable) {
								const childTableField = change[4] || "";
								const rowName = change[5] || "";
								const key = `${childTableField}_${rowName}`;
								if (!childTableGroups[key]) {
									// Extract child table label from the first change's full label
									const fullLabel = change[0] || "";
									const childTableLabel = fullLabel.includes(" > ")
										? fullLabel.split(" > ")[0]
										: childTableField;

									// Track row index per child table
									if (!childTableRowCounters[childTableField]) {
										childTableRowCounters[childTableField] = 0;
									}
									const rowIdx = childTableRowCounters[childTableField]++;

									childTableGroups[key] = {
										childTableField: childTableField,
										childTableLabel: childTableLabel,
										rowIdx: rowIdx,
										changes: [],
									};
								}

								// Extract field name from the label (after " > ")
								const fullLabel = change[0] || "";
								const fieldLabel = fullLabel.includes(" > ")
									? fullLabel.split(" > ")[1]
									: fullLabel;

								childTableGroups[key].changes.push({
									fieldLabel: fieldLabel,
									oldValue: change[1] || "",
									newValue: change[2] || "",
								});
							} else {
								regularChanges.push({
									fieldLabel: change[0] || "",
									oldValue: change[1] || "",
									newValue: change[2] || "",
								});
							}
						});

						const normalizedRegularChanges = this.normalizeGeoChanges(
							this.normalizeTableMultiSelectChanges(regularChanges)
						);
						const hydratedRegularChanges = await this.applyFullTableMultiSelectState(
							normalizedRegularChanges,
							item.custom_actual_doctype || item.ref_doctype
						);
						const resolvedRegularChanges = await this.resolveTableMultiSelectTitles(
							hydratedRegularChanges,
							item.custom_actual_doctype || item.ref_doctype
						);

						const entry = document.createElement("div");
						entry.className = "timeline-entry";

						// Build HTML for regular changes
						const visibleRegularChanges = resolvedRegularChanges.filter(
							(change) =>
								!(
									change.__geoChange &&
									activeGeoLevel &&
									change.__geoLevel !== activeGeoLevel
								)
						);
						if (
							visibleRegularChanges.length === 0 &&
							Object.keys(childTableGroups).length === 0
						)
							continue;
						let regularChangesHTML = "";
						if (visibleRegularChanges.length > 0) {
							regularChangesHTML = `
								<div class="changes-table-wrapper">
								<table class="changes-table">
									<thead>
										<tr>
											<th>Field</th>
											<th>Previous</th>
											<th>Current</th>
										</tr>
									</thead>
									<tbody>
										${visibleRegularChanges
											.map((change) => {
												if (change.__geoChange) {
													return `
													<tr>
														<td>${change.fieldLabel}</td>
														<td><span class="old-value">${this.formatGeoPrevious(change)}</span></td>
														<td><span class="new-value">${this.formatGeoCurrent(change)}</span></td>
													</tr>`;
												}
												return `
											<tr>
												<td>${change.fieldLabel}</td>
												<td><span class="old-value">${this.formatTimelineValue(change, change.oldValue)}</span></td>
												<td><span class="new-value">${this.formatTimelineValue(change, change.newValue)}</span></td>
											</tr>`;
											})
											.join("")}
									</tbody>
								</table>
								</div>`;
						}

						// Build HTML for child table changes
						let childTableChangesHTML = "";
						const childTableKeys = Object.keys(childTableGroups);
						if (childTableKeys.length > 0) {
							childTableChangesHTML = childTableKeys
								.map((key) => {
									const group = childTableGroups[key];

									return `
										<div class="child-table-section" style="margin-top: 16px;">
											<div class="child-table-header" style="
												padding: 8px 0;
												margin-bottom: 8px;
												font-weight: 600;
												color: #4b5563;
												font-size: 0.875rem;
											">
												${
													group.childTableLabel
														? group.childTableLabel
														: group.childTableField
												} <span style="color: #6b7280; font-weight: 500;">(Row #${
										group.rowIdx + 1
									})</span>
											</div>
											<div class="changes-table-wrapper">
											<table class="changes-table">
												<thead>
													<tr>
														<th>Field</th>
														<th>Previous</th>
														<th>Current</th>
													</tr>
												</thead>
												<tbody>
													${group.changes
														.map(
															(change) => `
														<tr>
															<td>${change.fieldLabel}</td>
															<td><span class="old-value">${this.formatCellValue(change.oldValue)}</span></td>
															<td><span class="new-value">${this.formatCellValue(change.newValue)}</span></td>
														</tr>
													`
														)
														.join("")}
												</tbody>
											</table>
											</div>
										</div>`;
								})
								.join("");
						}

						const actualDoctype = item.custom_actual_doctype || item.ref_doctype;
						const actualDocname = item.custom_actual_document_name || item.docname;
						const geoParent =
							actualDoctype === "Geography Details"
								? this.parseGeoDocname(actualDocname)
								: null;
						const linkDoctype = geoParent ? geoParent.doctype : actualDoctype;
						const linkDocname = geoParent ? geoParent.docname : actualDocname;
						const showLink = linkDoctype !== this.frm.doc.doctype;

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
                                style="display: ${showLink ? "block" : "none"};"
                                >
                                    ${__(linkDoctype)} -
                                    ${linkDocname}
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
                                    <span class="timeline-date">${frappe.datetime.global_date_format(
										item.creation
									)}</span>
                                </div>
                                <span class="timeline-relative-time">${this.formatRelativeTime(
									item.creation
								)}</span>
                            </div>
                        </div>
                        ${regularChangesHTML}
                        ${childTableChangesHTML}`;

						entry.querySelector(".timeline-link").addEventListener("click", (e) => {
							e.preventDefault();

							frappe.model.with_doctype(linkDoctype, () => {
								frappe.model.with_doc(linkDoctype, linkDocname, function () {
									const doc = frappe.get_doc(linkDoctype, linkDocname);
									const meta = frappe.get_meta(linkDoctype);

									const d = new frappe.ui.Dialog({
										title: __(`${linkDoctype}: ${linkDocname}`),
										fields: meta.fields
											.filter(
												(df) =>
													![
														"HTML",
														"Table",
														"Table Multiselect",
														"Button",
														"Color",
													].includes(df.fieldtype)
											)
											.map((df) => ({
												...df,
												read_only: 1,
											})),
									});

									d.set_values(doc);
									d.show();
								});
							});
						});

						timelineContainer.appendChild(entry);
					}
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
			})
			.catch((error) => {
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
			this.prevButton.style.opacity = this.page === 1 ? "0.5" : "1";
			this.nextButton.disabled = !this.hasMore;
			this.nextButton.style.opacity = !this.hasMore ? "0.5" : "1";
		}
	}

	//  Filter UI

	setupFilters() {
		const filtersContainer = document.createElement("div");
		filtersContainer.className = "timeline-filters";
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
		const filtersWrapper = document.createElement("div");
		filtersWrapper.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            background: #f9fafb;
            border-radius: 8px;
            padding: 6px;
        `;

		// Filter icon
		const filterIcon = document.createElement("div");
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
            flex-shrink: 0;
        `;

		// Doctype filter with icon
		this.doctypeSelect = document.createElement("select");
		this.doctypeSelect.style.cssText = `
            flex: 1 1 150px;
            min-width: 0;
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

		// Field filter — searchable dropdown
		const fieldWrapper = document.createElement("div");
		fieldWrapper.style.cssText = `
            position: relative;
            flex: 1 1 150px;
            min-width: 0;
        `;

		this.fieldInput = document.createElement("input");
		this.fieldInput.type = "text";
		this.fieldInput.placeholder = "All Fields";
		this.fieldInput.autocomplete = "off";
		this.fieldInput.style.cssText = `
            width: 100%;
            padding: 8px 12px 8px 28px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            outline: none;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            box-sizing: border-box;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 7h10M7 12h6M7 17h4'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 8px center;
            background-size: 14px;
        `;

		this.fieldDropdown = document.createElement("div");
		this.fieldDropdown.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            max-height: 200px;
            overflow-y: auto;
            z-index: 100;
        `;
		this.fieldDropdown.hidden = true;

		fieldWrapper.appendChild(this.fieldInput);
		fieldWrapper.appendChild(this.fieldDropdown);

		// Date range filter — single range picker
		this.dateRangePicker = this.createDateRangePicker("Date Range");
		this.dateRangePicker.el.style.cssText += `flex: 1 1 180px; min-width: 0;`;

		// Owner search with icon
		const searchWrapper = document.createElement("div");
		searchWrapper.style.cssText = `
            position: relative;
            flex: 1 1 150px;
            min-width: 0;
        `;

		this.ownerSearch = document.createElement("input");
		this.ownerSearch.type = "text";
		this.ownerSearch.placeholder = "Changed By";
		this.ownerSearch.style.cssText = `
            width: 100%;
            box-sizing: border-box;
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
		this.clearButton = document.createElement("button");
		this.clearButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
		this.clearButton.style.cssText = `
            display: none;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-left: auto;
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
		[this.doctypeSelect, this.fieldInput, this.ownerSearch].forEach((element) => {
			element.addEventListener("focus", () => {
				element.style.borderColor = "#6366f1";
				element.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.1)";
			});
			element.addEventListener("blur", () => {
				element.style.borderColor = "#e5e7eb";
				element.style.boxShadow = "none";
			});
		});

		// Append elements
		filtersWrapper.appendChild(filterIcon);
		filtersWrapper.appendChild(this.doctypeSelect);
		filtersWrapper.appendChild(fieldWrapper);
		searchWrapper.appendChild(this.ownerSearch);
		filtersWrapper.appendChild(searchWrapper);
		filtersWrapper.appendChild(this.dateRangePicker.el);
		filtersWrapper.appendChild(this.clearButton);
		filtersContainer.appendChild(filtersWrapper);
		this.wrapper.insertBefore(filtersContainer, this.timeline_wrapper);

		this.setupFilterEventListeners();
		this.fetchDoctypes();
		this.fetchDocFields(null);
	}

	setupFilterEventListeners() {
		const updateClearButtonVisibility = () => {
			const hasFilters =
				this.filters.doctype ||
				this.filters.owner ||
				this.filters.field ||
				this.filters.date_from ||
				this.filters.date_to;
			this.clearButton.style.display = hasFilters ? "inline-flex" : "none";
		};

		this.doctypeSelect.addEventListener("change", () => {
			this.filters.doctype = this.doctypeSelect.value;
			this.filters.field = "";
			this._selectedField = { value: "", label: "All Fields" };
			this.fieldInput.value = "";
			this.fieldInput.placeholder = "All Fields";
			this.fetchDocFields(this.filters.doctype || null);
			this.page = 1;
			this.setupPagination();
			this.fetchTimelineData();
			updateClearButtonVisibility();
		});

		// Field searchable dropdown listeners
		this.fieldInput.addEventListener("focus", () => {
			this.fieldInput.value = "";
			this._renderFieldOptions(this.fieldOptions, updateClearButtonVisibility);
			this.fieldDropdown.hidden = false;
		});

		this.fieldInput.addEventListener("input", () => {
			const q = this.fieldInput.value.toLowerCase();
			const filtered = this.fieldOptions.filter((o) => o.label.toLowerCase().includes(q));
			this._renderFieldOptions(filtered, updateClearButtonVisibility);
			this.fieldDropdown.hidden = filtered.length === 0;
		});

		this.fieldInput.addEventListener("blur", () => {
			this.fieldDropdown.hidden = true;
			this.fieldInput.value = this._selectedField.value ? this._selectedField.label : "";
			this.fieldInput.placeholder = this._selectedField.value
				? this._selectedField.label
				: "All Fields";
		});

		// Date range listener
		this.dateRangePicker.el.addEventListener("date-range-change", (e) => {
			this.filters.date_from = e.detail.date_from;
			this.filters.date_to = e.detail.date_to;
			this.page = 1;
			this.setupPagination();
			this.fetchTimelineData();
			updateClearButtonVisibility();
		});

		// Field searchable dropdown listeners
		this.fieldInput.addEventListener("focus", () => {
			this.fieldInput.value = "";
			this._renderFieldOptions(this.fieldOptions, updateClearButtonVisibility);
			this.fieldDropdown.hidden = false;
		});

		this.fieldInput.addEventListener("input", () => {
			const q = this.fieldInput.value.toLowerCase();
			const filtered = this.fieldOptions.filter((o) => o.label.toLowerCase().includes(q));
			this._renderFieldOptions(filtered, updateClearButtonVisibility);
			this.fieldDropdown.hidden = filtered.length === 0;
		});

		this.fieldInput.addEventListener("blur", () => {
			this.fieldDropdown.hidden = true;
			this.fieldInput.value = this._selectedField.value ? this._selectedField.label : "";
			this.fieldInput.placeholder = this._selectedField.value
				? this._selectedField.label
				: "All Fields";
		});

		// Date range listener
		this.dateRangePicker.el.addEventListener("date-range-change", (e) => {
			this.filters.date_from = e.detail.date_from;
			this.filters.date_to = e.detail.date_to;
			this.page = 1;
			this.setupPagination();
			this.fetchTimelineData();
			updateClearButtonVisibility();
		});

		let timeout;
		this.ownerSearch.addEventListener("input", () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				this.filters.owner = this.ownerSearch.value;
				this.page = 1;
				this.setupPagination();
				this.fetchTimelineData();
				updateClearButtonVisibility();
			}, 300);
		});

		this.clearButton.addEventListener("click", () => {
			this.doctypeSelect.value = "";
			this.ownerSearch.value = "";
			this.dateRangePicker.clear();
			this._selectedField = { value: "", label: "All Fields" };
			this.fieldInput.value = "";
			this.fieldInput.placeholder = "All Fields";
			this.filters.doctype = "";
			this.filters.owner = "";
			this.filters.field = "";
			this.filters.date_from = "";
			this.filters.date_to = "";
			this.fetchDocFields(null);
			this.page = 1;
			this.setupPagination();
			this.fetchTimelineData();
			updateClearButtonVisibility();
		});
	}

	createDateRangePicker(placeholder) {
		const MONTHS = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

		const wrapper = document.createElement("div");
		wrapper.style.cssText = `position:relative;`;

		const input = document.createElement("input");
		input.type = "text";
		input.placeholder = placeholder;
		input.readOnly = true;
		input.style.cssText = `
            padding: 7px 10px 7px 28px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            outline: none;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            transition: border-color 0.2s ease;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 8px center;
            background-size: 14px;
        `;

		const dropdown = document.createElement("div");
		dropdown.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            padding: 14px;
            z-index: 300;
            min-width: 268px;
            display: none;
        `;

		let startDate = null; // [d, m, y]
		let endDate = null;
		let viewYear = new Date().getFullYear();
		let viewMonth = new Date().getMonth();
		let viewMode = "day"; // "day" | "month" | "year"
		let yearRangeStart = Math.floor(viewYear / 12) * 12;

		const fmt = (d, m, y) => `${String(d).padStart(2, "0")} ${MONTHS[m].slice(0, 3)}, ${y}`;
		const toStr = (d, m, y) =>
			`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

		const updateInput = () => {
			if (startDate && endDate) {
				input.value = `${fmt(...startDate)} – ${fmt(...endDate)}`;
				input.style.borderColor = "#6366f1";
			} else if (startDate) {
				input.value = `${fmt(...startDate)} – ...`;
				input.style.borderColor = "#6366f1";
			} else {
				input.value = "";
				input.style.borderColor = "#e5e7eb";
			}
		};

		const applyStyles = (dayCells, todayStr, hoverStr) => {
			const sStr = startDate ? toStr(...startDate) : null;
			const eStr = endDate ? toStr(...endDate) : null;
			const effectiveEnd = eStr || (sStr && hoverStr && hoverStr > sStr ? hoverStr : null);
			Object.entries(dayCells).forEach(([ds, cell]) => {
				const isStart = ds === sStr;
				const isEnd = ds === eStr;
				const isHover = ds === hoverStr && startDate && !endDate;
				const inRange = sStr && effectiveEnd && ds > sStr && ds < effectiveEnd;
				const isToday = ds === todayStr;
				if (isStart || isEnd || isHover) {
					cell.style.cssText += `background:#111827; color:white; border-radius:50%; font-weight:600;`;
				} else if (inRange) {
					cell.style.cssText += `background:#e0e7ff; color:#111827; border-radius:2px; font-weight:400;`;
				} else if (isToday) {
					cell.style.cssText += `background:#f3f4f6; color:#111827; border-radius:50%; font-weight:600;`;
				} else {
					cell.style.cssText += `background:transparent; color:#111827; border-radius:50%; font-weight:400;`;
				}
			});
		};

		const makeNavBtn = (svgPath, onClick) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${svgPath}"/></svg>`;
			btn.style.cssText = `background:none; border:none; cursor:pointer; color:#6b7280; padding:4px; border-radius:4px; display:flex; align-items:center; flex-shrink:0;`;
			btn.addEventListener("mouseenter", () => (btn.style.background = "#f3f4f6"));
			btn.addEventListener("mouseleave", () => (btn.style.background = "none"));
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				onClick();
			});
			return btn;
		};

		const makeHeaderLabel = (text, onClick) => {
			const span = document.createElement("span");
			span.textContent = text;
			span.style.cssText = `font-weight:600; color:#111827; font-size:0.9rem; cursor:pointer; padding:2px 6px; border-radius:4px; transition:background 0.15s;`;
			span.addEventListener("mouseenter", () => (span.style.background = "#f3f4f6"));
			span.addEventListener("mouseleave", () => (span.style.background = "transparent"));
			span.addEventListener("click", (e) => {
				e.stopPropagation();
				onClick();
			});
			return span;
		};

		const renderCalendar = () => {
			dropdown.innerHTML = "";

			const header = document.createElement("div");
			header.style.cssText = `display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;`;

			if (viewMode === "day") {
				header.appendChild(
					makeNavBtn("M15 18l-6-6 6-6", () => {
						viewMonth--;
						if (viewMonth < 0) {
							viewMonth = 11;
							viewYear--;
						}
						renderCalendar();
					})
				);

				const titleWrap = document.createElement("div");
				titleWrap.style.cssText = `display:flex; gap:4px; align-items:center;`;
				titleWrap.appendChild(
					makeHeaderLabel(MONTHS[viewMonth], () => {
						viewMode = "month";
						renderCalendar();
					})
				);
				titleWrap.appendChild(
					makeHeaderLabel(String(viewYear), () => {
						yearRangeStart = Math.floor(viewYear / 12) * 12;
						viewMode = "year";
						renderCalendar();
					})
				);
				header.appendChild(titleWrap);

				header.appendChild(
					makeNavBtn("M9 18l6-6-6-6", () => {
						viewMonth++;
						if (viewMonth > 11) {
							viewMonth = 0;
							viewYear++;
						}
						renderCalendar();
					})
				);
				dropdown.appendChild(header);

				// Day headers
				const dayHeaders = document.createElement("div");
				dayHeaders.style.cssText = `display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:4px;`;
				DAYS.forEach((day) => {
					const cell = document.createElement("div");
					cell.textContent = day;
					cell.style.cssText = `text-align:center; font-size:0.7rem; font-weight:600; color:#9ca3af; padding:4px 0;`;
					dayHeaders.appendChild(cell);
				});
				dropdown.appendChild(dayHeaders);

				const grid = document.createElement("div");
				grid.style.cssText = `display:grid; grid-template-columns:repeat(7,1fr);`;

				const firstDay = new Date(viewYear, viewMonth, 1).getDay();
				const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
				const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
				const today = new Date();
				const todayStr = toStr(today.getDate(), today.getMonth(), today.getFullYear());

				for (let i = firstDay - 1; i >= 0; i--) {
					const cell = document.createElement("div");
					cell.textContent = daysInPrevMonth - i;
					cell.style.cssText = `text-align:center; height:30px; display:flex; align-items:center; justify-content:center; font-size:0.8rem; color:#d1d5db;`;
					grid.appendChild(cell);
				}

				const dayCells = {};
				for (let d = 1; d <= daysInMonth; d++) {
					const dateStr = toStr(d, viewMonth, viewYear);
					const cell = document.createElement("div");
					cell.textContent = d;
					cell.style.cssText = `text-align:center; font-size:0.8rem; cursor:pointer; height:30px; display:flex; align-items:center; justify-content:center;`;
					cell.dataset.date = dateStr;
					dayCells[dateStr] = cell;
					grid.appendChild(cell);
				}

				applyStyles(dayCells, todayStr, null);

				grid.addEventListener("mouseover", (e) => {
					const cell = e.target.closest("[data-date]");
					if (!cell) return;
					const ds = cell.dataset.date;
					if (startDate && !endDate) {
						applyStyles(dayCells, todayStr, ds);
					} else {
						const sStr = startDate ? toStr(...startDate) : null;
						const eStr = endDate ? toStr(...endDate) : null;
						if (ds !== sStr && ds !== eStr) {
							cell.style.background = "#f3f4f6";
							cell.style.borderRadius = "50%";
						}
					}
				});
				grid.addEventListener("mouseleave", () => applyStyles(dayCells, todayStr, null));

				grid.addEventListener("click", (e) => {
					e.stopPropagation();
					const cell = e.target.closest("[data-date]");
					if (!cell) return;
					const ds = cell.dataset.date;
					const [y, m, d] = ds.split("-").map(Number);
					const clickedDmy = [d, m - 1, y];
					if (!startDate || (startDate && endDate)) {
						startDate = clickedDmy;
						endDate = null;
					} else {
						const sStr = toStr(...startDate);
						if (ds === sStr) return;
						if (ds < sStr) {
							endDate = startDate;
							startDate = clickedDmy;
						} else {
							endDate = clickedDmy;
						}
						dropdown.style.display = "none";
						wrapper.dispatchEvent(
							new CustomEvent("date-range-change", {
								detail: {
									date_from: toStr(...startDate),
									date_to: toStr(...endDate),
								},
							})
						);
					}
					updateInput();
					applyStyles(dayCells, todayStr, null);
				});

				const totalCells = firstDay + daysInMonth;
				const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
				for (let d = 1; d <= remaining; d++) {
					const cell = document.createElement("div");
					cell.textContent = d;
					cell.style.cssText = `text-align:center; height:30px; display:flex; align-items:center; justify-content:center; font-size:0.8rem; color:#d1d5db;`;
					grid.appendChild(cell);
				}
				dropdown.appendChild(grid);
			} else if (viewMode === "month") {
				header.appendChild(
					makeNavBtn("M15 18l-6-6 6-6", () => {
						viewYear--;
						renderCalendar();
					})
				);
				header.appendChild(
					makeHeaderLabel(String(viewYear), () => {
						yearRangeStart = Math.floor(viewYear / 12) * 12;
						viewMode = "year";
						renderCalendar();
					})
				);
				header.appendChild(
					makeNavBtn("M9 18l6-6-6-6", () => {
						viewYear++;
						renderCalendar();
					})
				);
				dropdown.appendChild(header);

				const grid = document.createElement("div");
				grid.style.cssText = `display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:4px 0;`;
				MONTHS.forEach((mon, idx) => {
					const cell = document.createElement("div");
					cell.textContent = mon.slice(0, 3);
					const isActive = idx === viewMonth;
					cell.style.cssText = `text-align:center; padding:10px 0; font-size:0.85rem; cursor:pointer; border-radius:6px; font-weight:${
						isActive ? "600" : "400"
					}; background:${isActive ? "#111827" : "transparent"}; color:${
						isActive ? "white" : "#111827"
					};`;
					cell.addEventListener("mouseenter", () => {
						if (!isActive) cell.style.background = "#f3f4f6";
					});
					cell.addEventListener("mouseleave", () => {
						if (!isActive) cell.style.background = "transparent";
					});
					cell.addEventListener("click", (e) => {
						e.stopPropagation();
						viewMonth = idx;
						viewMode = "day";
						renderCalendar();
					});
					grid.appendChild(cell);
				});
				dropdown.appendChild(grid);
			} else if (viewMode === "year") {
				header.appendChild(
					makeNavBtn("M15 18l-6-6 6-6", () => {
						yearRangeStart -= 12;
						renderCalendar();
					})
				);
				header.appendChild(
					makeHeaderLabel(`${yearRangeStart} – ${yearRangeStart + 11}`, () => {})
				);
				header.appendChild(
					makeNavBtn("M9 18l6-6-6-6", () => {
						yearRangeStart += 12;
						renderCalendar();
					})
				);
				dropdown.appendChild(header);

				const grid = document.createElement("div");
				grid.style.cssText = `display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:4px 0;`;
				for (let y = yearRangeStart; y < yearRangeStart + 12; y++) {
					const cell = document.createElement("div");
					cell.textContent = y;
					const isActive = y === viewYear;
					cell.style.cssText = `text-align:center; padding:10px 0; font-size:0.85rem; cursor:pointer; border-radius:6px; font-weight:${
						isActive ? "600" : "400"
					}; background:${isActive ? "#111827" : "transparent"}; color:${
						isActive ? "white" : "#111827"
					};`;
					cell.addEventListener("mouseenter", () => {
						if (!isActive) cell.style.background = "#f3f4f6";
					});
					cell.addEventListener("mouseleave", () => {
						if (!isActive) cell.style.background = "transparent";
					});
					cell.addEventListener("click", (e) => {
						e.stopPropagation();
						viewYear = y;
						viewMode = "month";
						renderCalendar();
					});
					grid.appendChild(cell);
				}
				dropdown.appendChild(grid);
			}
		};

		input.addEventListener("click", (e) => {
			e.stopPropagation();
			const isOpen = dropdown.style.display === "block";
			document.querySelectorAll(".sva-dp-dropdown").forEach((d) => {
				d.style.display = "none";
			});
			if (!isOpen) {
				renderCalendar();
				dropdown.style.display = "block";
			}
		});

		document.addEventListener("click", () => {
			dropdown.style.display = "none";
		});
		dropdown.addEventListener("click", (e) => e.stopPropagation());
		dropdown.classList.add("sva-dp-dropdown");

		wrapper.appendChild(input);
		wrapper.appendChild(dropdown);

		return {
			el: wrapper,
			clear: () => {
				startDate = null;
				endDate = null;
				viewYear = new Date().getFullYear();
				viewMonth = new Date().getMonth();
				viewMode = "day";
				yearRangeStart = Math.floor(viewYear / 12) * 12;
				updateInput();
			},
		};
	}

	fetchDocFields(filterDoctype) {
		frappe
			.call({
				method: "frappe_theme.api.get_timeline_fields",
				args: {
					dt: this.frm.doctype,
					dn: this.frm.docname,
					filter_doctype: filterDoctype || null,
				},
			})
			.then((response) => {
				const fields = response.message || [];
				this.fieldOptions = [{ value: "", label: __("All Fields"), doctype: "" }];
				fields.forEach((f) => {
					this.fieldOptions.push({
						value: f.fieldname,
						label: f.label,
						doctype: f.doctype,
					});
				});
				this._renderFieldOptions(this.fieldOptions, null);
			});
	}

	_renderFieldOptions(options, updateClearButtonVisibility) {
		this.fieldDropdown.innerHTML = "";
		options.forEach((opt) => {
			const div = document.createElement("div");
			div.dataset.value = opt.value;
			div.style.cssText = `
                padding: 8px 8px;
                cursor: pointer;
                color: #374151;
            `;
			div.innerHTML = `
				<div style="font-size: 0.875rem; font-weight: 500; color: #374151;">${opt.label}</div>
				${
					opt.doctype
						? `<div style="font-size: 0.75rem; color: #374151; margin-top: 1px;">${__(
								opt.doctype
						  )}</div>`
						: ""
				}
			`;
			div.addEventListener("mouseenter", () => (div.style.background = "#f3f4f6"));
			div.addEventListener("mouseleave", () => (div.style.background = ""));
			div.addEventListener("mousedown", (e) => {
				e.preventDefault(); // prevent blur firing before click
				this._selectedField = opt;
				this.fieldInput.value = opt.value ? opt.label : "";
				this.fieldInput.placeholder = opt.value ? opt.label : "All Fields";
				this.filters.field = opt.value;
				this.fieldDropdown.hidden = true;
				this.page = 1;
				this.setupPagination();
				this.fetchTimelineData();
				if (updateClearButtonVisibility) updateClearButtonVisibility();
			});
			this.fieldDropdown.appendChild(div);
		});
	}

	async fetchDoctypes() {
		try {
			const response = await frappe.call({
				method: "frappe_theme.api.get_timeline_dt",
				args: {
					dt: this.frm.doctype,
					dn: this.frm.docname,
				},
			});

			const doctypes = response.message || [];
			this.doctypeSelect.innerHTML = "";

			// Add placeholder option
			const placeholderOption = document.createElement("option");
			placeholderOption.value = "";
			placeholderOption.textContent = __("All Changes");
			placeholderOption.selected = true;
			this.doctypeSelect.appendChild(placeholderOption);

			// Add current doctype option
			const currentOption = document.createElement("option");
			currentOption.value = this.frm.doc.doctype;
			currentOption.textContent = __(this.frm.doc.doctype);
			this.doctypeSelect.appendChild(currentOption);

			// Add other doctype options
			doctypes.forEach((dt) => {
				const option = document.createElement("option");
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
