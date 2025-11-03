class SVANumberCard {
	constructor({ wrapper, frm, numberCards = [], filters = {}, signal = null }) {
		this.wrapper = wrapper;
		this.frm = frm;
		this.numberCards = numberCards;
		this.filters = filters;
		this.signal = signal;

		this.sva_db = new SVAHTTP(this.signal);
		this.cardDataCache = new Map(); // Cache for card data
		this.linkedFieldsCache = new Map(); // Cache for linked fields
		this.cardRefreshTimeouts = new Map(); // Track refresh timeouts
		this.docTypeCache = new Map(); // Cache for document types
		this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
		this.DEBOUNCE_DELAY = 300; // 300ms debounce delay

		// Bind methods to preserve context
		this.debouncedRefresh = this.debounce(this.refresh.bind(this), this.DEBOUNCE_DELAY);

		// Initialize batch processor for network requests
		this.batchProcessor = new BatchProcessor(1000); // 1 second batch window
		// return this.wrapper;
	}

	debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	async make() {
		if (!this.wrapper) return;

		this.wrapper.innerHTML = "";
		if (!this.numberCards.length) {
			this.showNoDataState();
			return;
		}

		// Show loading state
		this.showLoadingState();

		const container = document.createElement("div");
		container.className = "sva-cards-container";

		try {
			const visibleCards = this.numberCards.filter((card) => card.is_visible);
			await this.processCardsInBatches(visibleCards, container);
			// Remove loading state and append container
			this.wrapper.innerHTML = "";
			this.wrapper.appendChild(container);
		} catch (error) {
			console.error("Error creating number cards:", error);
			this.showErrorState();
		}

		this.lazyLoadStyles();
	}

	async processCardsInBatches(cards, container) {
		const batchSize = 3;
		for (let i = 0; i < cards.length; i += batchSize) {
			const batch = cards.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (cardConfig) => {
					try {
						const cardData = await this.getCardDataWithCache(cardConfig.number_card);
						if (cardData) {
							const card = this.createCard({
								cardName: cardConfig.number_card,
								title: cardConfig.card_label || cardData.label || cardData.name,
								value: cardData.result !== undefined ? cardData.result : "--",
								reportName: cardData.report_name,
								doctype: cardData.document_type,
								filters: cardData.filters_json
									? JSON.parse(cardData.filters_json)
									: {},
								info: cardConfig.info || "",
								fieldtype: cardData.fieldtype,
								options: this.getCardOptions(cardConfig),
							});
							container.appendChild(card);
						} else {
							container.appendChild(
								this.createErrorCard(
									cardConfig.card_label || cardConfig.number_card
								)
							);
						}
					} catch (error) {
						console.error(`Error creating card ${cardConfig.number_card}:`, error);
						container.appendChild(
							this.createErrorCard(cardConfig.card_label || cardConfig.number_card)
						);
					}
				})
			);
		}
	}

	async fetchNumberCardData(cardName) {
		try {
			const docResponse = await this.batchProcessor.add(() =>
				this.sva_db.call({
					method: "frappe.desk.form.load.getdoc",
					doctype: "Number Card",
					name: cardName,
				})
			);

			if (!docResponse.docs?.[0]) {
				throw new Error("No document found");
			}

			const doc = docResponse.docs[0];
			const filters = await this.prepareFilters(doc);

			if (doc.report_name) {
				return await this.handleReportCard(doc);
			}

			if (!doc.document_type) {
				console.error("No document type found for card:", cardName);
				return null;
			}

			const resultResponse = await this.batchProcessor.add(() =>
				this.sva_db.call({
					method: "frappe.desk.doctype.number_card.number_card.get_result",
					card: cardName,
					doc: this.prepareDocArgs(doc),
					filters: filters,
				})
			);

			return {
				...doc,
				result: resultResponse.message,
			};
		} catch (error) {
			console.error("Error fetching number card data:", error, cardName);
			return null;
		}
	}

	async prepareFilters(doc) {
		let filters_json =
			typeof doc.filters_json === "string"
				? JSON.parse(doc.filters_json)
				: doc.filters_json || [];

		let filters = Array.isArray(filters_json)
			? filters_json
			: Object.entries(filters_json).map(([key, value]) => [
					doc.document_type,
					key,
					"=",
					value,
			  ]);

		if (doc.document_type && this.frm.docname) {
			const linkedFields = await this.getLinkedFieldsWithCache(
				doc.document_type,
				this.frm.doctype
			);
			if (linkedFields?.field) {
				const field = linkedFields.field;
				const fieldname =
					field.options === "DocType" && linkedFields.final_field
						? linkedFields.final_field.fieldname
						: field.fieldname;
				filters.push([doc.document_type, fieldname, "=", this.frm.docname]);
			}
		}

		return filters;
	}

	async handleReportCard(doc) {
		try {
			const reportDoc = await this.batchProcessor.add(() =>
				this.sva_db.get_doc("Report", doc.report_name)
			);

			if (!reportDoc) return null;

			doc.document_type = reportDoc.ref_doctype;
			const json_filters = this.prepareReportFilters(reportDoc);

			const response = await this.batchProcessor.add(() =>
				this.sva_db.call({
					method: "frappe_theme.api.execute_number_card_query",
					report_name: doc.report_name,
					filters: json_filters,
				})
			);

			if (response?.message?.result?.[0] && doc.report_field) {
				const fieldValue = response.message.result[0][doc.report_field];
				const fieldType = response.message.column_types?.[doc.report_field];

				return {
					...doc,
					result: fieldValue,
					fieldtype: fieldType?.toLowerCase().includes("decimal") ? "Currency" : null,
				};
			}
			return null;
		} catch (error) {
			console.error("Error handling report card:", error);
			return null;
		}
	}

	prepareReportFilters(reportDoc) {
		const reportFilters = reportDoc.filters || [];
		const whereConditions = [];

		reportFilters.forEach((filter) => {
			if (filter.fieldname === this.frm.doctype.toLowerCase()) {
				whereConditions.push(`${filter.fieldname} = '${this.frm.docname}'`);
			} else if (filter.default) {
				whereConditions.push(
					`${filter.fieldname} = ${
						typeof filter.default === "string" ? `'${filter.default}'` : filter.default
					}`
				);
			} else if (this.frm.doc?.[filter.fieldname] !== undefined) {
				const value = this.frm.doc[filter.fieldname];
				whereConditions.push(
					`${filter.fieldname} = ${typeof value === "string" ? `'${value}'` : value}`
				);
			}
		});

		return whereConditions.reduce((acc, condition) => {
			const matches = condition.match(/([^=]+)\s*=\s*(.+)/);
			if (matches) {
				const [_, field, value] = matches;
				acc[field.trim()] = value.trim().replace(/^['"]+|['"]+$/g, "");
			}
			return acc;
		}, {});
	}

	prepareDocArgs(doc) {
		return {
			name: doc.name,
			document_type: doc.document_type,
			label: doc.label,
			function: doc.function,
			aggregate_function_based_on: doc.aggregate_function_based_on,
			filters_json: doc.filters_json,
			is_standard: doc.is_standard,
			parent_document_type: doc.parent_document_type,
			report_name: doc.report_name,
			report_field: doc.report_field,
			type: doc.type,
		};
	}

	getCardOptions(cardConfig) {
		return {
			icon: cardConfig.icon_value,
			subtitle: cardConfig.document_type,
			backgroundColor: cardConfig.background_color,
			textColor: cardConfig.text_color,
			valueColor: cardConfig.value_color,
			iconColor: cardConfig.icon_color,
		};
	}

	createCard(config) {
		const card = document.createElement("div");
		card.className = "number-card";
		card.innerHTML = this.getCardTemplate(config);
		this.attachCardEventHandlers(card, config);
		return card;
	}

	getCardTemplate(config) {
		const options = this.getCardOptions(config);
		const containerStyle = options.backgroundColor
			? `background-color: ${options.backgroundColor}`
			: "";
		const titleStyle = options.textColor ? `color: ${options.textColor}` : "";
		const valueStyle = options.valueColor ? `color: ${options.valueColor}` : "";
		const iconHtml = options.icon ? this.getIconHTML(options) : "";
		const infoHtml = config.info ? this.getInfoHTML(config.info) : "";

		return `
            <div class="number-card-container" ${
				containerStyle ? `style="${containerStyle}"` : ""
			}>
                <div class="number-card-content">
                    <div class="number-card-header">
                        <div class="number-card-title-section">
                            <h3 class="number-card-title" ${
								titleStyle ? `style="${titleStyle}"` : ""
							}>${config.title || ""}</h3>
                            ${infoHtml}
                        </div>
                        <div class="number-card-actions">
                            <div class="number-card-menu">
                                <button class="number-card-menu-btn">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>
                                <div class="number-card-menu-dropdown">
                                    <button class="number-card-menu-item refresh-card">
                                        <i class="fa fa-refresh"></i> Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="number-card-main">
                        <div class="number-card-value" ${
							valueStyle ? `style="${valueStyle}"` : ""
						}>
                            ${this.formatValue(config.value, config.fieldtype)}
                        </div>
                        ${iconHtml}
                    </div>
                </div>
            </div>
        `;
	}

	getIconHTML(options) {
		return `
            <div class="number-card-icon" ${
				options.iconColor ? `style="background-color: ${options.iconColor}"` : ""
			}>
                <i class="${options.icon}"></i>
            </div>
        `;
	}

	getInfoHTML(info) {
		return `
            <div class="number-card-info">
                <i class="fa fa-info-circle"></i>
                <div class="number-card-tooltip">${frappe.utils.escape_html(info)}</div>
            </div>
        `;
	}

	createErrorCard(cardName) {
		return `
            <div class="number-card">
                <div class="number-card-container error">
                    <div class="number-card-content">
                        <div class="number-card-header">
                            <h3 class="number-card-title">${cardName}</h3>
                            <div class="number-card-icon">
                                <i class="fa fa-exclamation-triangle"></i>
                            </div>
                        </div>
                        <div class="number-card-value text-danger">Error loading data</div>
                    </div>
                </div>
            </div>
        `;
	}

	formatValue(value, fieldtype) {
		if (value === undefined || value === null || value === "--") return "--";

		if (typeof value === "number") {
			const absValue = Math.abs(value);

			if (fieldtype === "Currency") {
				return format_currency(value, frappe.defaults.get_default("currency"));
			}

			if (absValue >= 10000000) {
				return `${(value / 10000000).toFixed(2)} Cr`;
			} else if (absValue >= 100000) {
				return `${(value / 100000).toFixed(2)} L`;
			} else if (absValue >= 1000) {
				return `${(value / 1000).toFixed(2)} K`;
			}

			return value % 1 !== 0 ? value.toFixed(2) : value.toString();
		}
		return value;
	}

	attachCardEventHandlers(card, config) {
		const menuBtn = card.querySelector(".number-card-menu-btn");
		const menuDropdown = card.querySelector(".number-card-menu-dropdown");
		const refreshBtn = card.querySelector(".refresh-card");

		document.addEventListener(
			"click",
			(e) => {
				if (!menuBtn.contains(e.target)) {
					menuDropdown.classList.remove("show");
				}
			},
			{ passive: true }
		);

		menuBtn.addEventListener(
			"click",
			(e) => {
				e.stopPropagation();
				menuDropdown.classList.toggle("show");
			},
			{ passive: true }
		);

		refreshBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			menuDropdown.classList.remove("show");
			await this.handleCardRefresh(card, config);
		});
	}

	async handleCardRefresh(card, config) {
		const cardContainer = card.querySelector(".number-card-container");
		cardContainer.style.opacity = "0.5";
		cardContainer.style.pointerEvents = "none";

		try {
			this.cardDataCache.delete(config.cardName);
			const cardData = await this.fetchNumberCardData(config.cardName);
			if (cardData) {
				const valueElement = card.querySelector(".number-card-value");
				valueElement.textContent = this.formatValue(cardData.result, cardData.fieldtype);
			}
		} catch (error) {
			console.error("Error refreshing card:", error);
			frappe.show_alert({
				message: __("Error refreshing card"),
				indicator: "red",
			});
		} finally {
			cardContainer.style.opacity = "";
			cardContainer.style.pointerEvents = "";
		}
	}

	async getCardDataWithCache(cardName) {
		const cachedData = this.cardDataCache.get(cardName);
		if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
			return cachedData.data;
		}

		const data = await this.batchProcessor.add(() => this.fetchNumberCardData(cardName));
		if (data) {
			this.cardDataCache.set(cardName, {
				data,
				timestamp: Date.now(),
			});
		}
		return data;
	}

	async getLinkedFieldsWithCache(docType, frmDoctype) {
		const cacheKey = `${docType}-${frmDoctype}`;
		const cachedFields = this.linkedFieldsCache.get(cacheKey);
		if (cachedFields && Date.now() - cachedFields.timestamp < this.CACHE_DURATION) {
			return cachedFields.data;
		}

		try {
			const result = await this.sva_db.call({
				method: "frappe_theme.api.get_linked_doctype_fields",
				doc_type: docType,
				frm_doctype: frmDoctype,
			});

			if (result?.message) {
				this.linkedFieldsCache.set(cacheKey, {
					data: result.message,
					timestamp: Date.now(),
				});
				return result.message;
			}
		} catch (error) {
			console.error("Error getting linked fields:", error);
		}
		return null;
	}

	showNoDataState() {
		this.wrapper.innerHTML = `
            <div class="no-data">
                <i class="fa fa-info-circle fa-2x mb-2"></i>
                <div>No cards available</div>
            </div>
        `;
	}

	showErrorState() {
		this.wrapper.innerHTML = `
            <div class="no-data">
                <i class="fa fa-exclamation-circle fa-2x mb-2 text-danger"></i>
                <div class="text-danger">Error loading cards</div>
            </div>
        `;
	}

	refresh(newCards) {
		this.numberCards = newCards || this.numberCards;
		this.cardDataCache.clear(); // Clear cache on refresh
		this.make();
	}

	lazyLoadStyles() {
		if (!document.getElementById("sva-number-card-styles")) {
			const styleSheet = document.createElement("style");
			styleSheet.id = "sva-number-card-styles";
			styleSheet.textContent = this.getStyles();
			document.head.appendChild(styleSheet);
		}
	}

	showLoadingState() {
		const loadingContainer = document.createElement("div");
		loadingContainer.className = "sva-cards-loading-container";

		// Create skeleton cards
		for (let i = 0; i < Math.min(this.numberCards.length, 3); i++) {
			const skeletonCard = this.createSkeletonCard();
			loadingContainer.appendChild(skeletonCard);
		}

		this.wrapper.appendChild(loadingContainer);
	}

	createSkeletonCard() {
		const card = document.createElement("div");
		card.className = "number-card skeleton-card";
		card.innerHTML = `
            <div class="number-card-container">
                <div class="number-card-content">
                    <div class="number-card-header">
                        <div class="skeleton-title"></div>
                    </div>
                    <div class="number-card-main">
                        <div class="skeleton-value"></div>
                        <div class="skeleton-icon"></div>
                    </div>
                </div>
            </div>
        `;
		return card;
	}

	getStyles() {
		return `
            @keyframes shimmer {
                0% {
                    background-position: -1000px 0;
                }
                100% {
                    background-position: 1000px 0;
                }
            }

            .sva-cards-loading-container {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                padding: 0px 0px 15px 0px;
                width: 100%;
            }

            .skeleton-card .number-card-container {
                background: var(--card-bg);
                position: relative;
                overflow: hidden;
            }

            .skeleton-title {
                height: 14px;
                width: 60%;
                background: var(--gray-200);
                border-radius: 4px;
                animation: shimmer 2s infinite linear;
                background-image: linear-gradient(
                    to right,
                    var(--gray-200) 0%,
                    var(--gray-100) 20%,
                    var(--gray-200) 40%,
                    var(--gray-200) 100%
                );
                background-repeat: no-repeat;
                background-size: 1000px 100%;
            }

            .skeleton-value {
                height: 24px;
                width: 40%;
                background: var(--gray-200);
                border-radius: 4px;
                margin-top: 8px;
                animation: shimmer 2s infinite linear;
                background-image: linear-gradient(
                    to right,
                    var(--gray-200) 0%,
                    var(--gray-100) 20%,
                    var(--gray-200) 40%,
                    var(--gray-200) 100%
                );
                background-repeat: no-repeat;
                background-size: 1000px 100%;
            }

            .skeleton-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--gray-200);
                animation: shimmer 2s infinite linear;
                background-image: linear-gradient(
                    to right,
                    var(--gray-200) 0%,
                    var(--gray-100) 20%,
                    var(--gray-200) 40%,
                    var(--gray-200) 100%
                );
                background-repeat: no-repeat;
                background-size: 1000px 100%;
            }
            .sva-cards-container {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                padding: 0px 0px 15px 0px;
                width: 100%;
                position: relative;
                min-height: 100px;
            }
            .number-card {
                flex: 1 1 300px;
                min-width: 0;
                max-width: 100%;
            }
            .number-card-container {
                background: var(--card-bg);
                border-radius: 6px;
                padding: 10px;
                box-shadow: var(--card-shadow-lg);
                border: 2px solid #EDEDED;
                min-height: 84px;
                display: flex;
                flex-direction: column;
                height: 100%;
                color: var(--text-color);
                transition: opacity 0.2s ease-in-out;
            }
            .number-card-container.error {
                border-color: var(--red-200);
                background: var(--red-50);
            }
            .number-card-container.error .number-card-icon {
                background: var(--red-100);
            }
            .number-card-container.error .number-card-icon i {
                color: var(--red-500);
            }
            .number-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 4px;
                width: 100%;
            }
            .number-card-title-section {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                flex: 1;
                min-width: 0;
            }
            .number-card-info {
                position: relative;
                display: flex;
                align-items: center;
                padding-top: 2px;
            }
            .number-card-info i {
                font-size: 14px;
                color: var(--text-color);
                cursor: help;
                opacity: 0.7;
            }
            .number-card-tooltip {
                position: absolute;
                top: -8px;
                left: 24px;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                padding: 6px 8px;
                border-radius: 4px;
                box-shadow: var(--shadow-sm);
                font-size: 11px;
                min-width: 150px;
                max-width: 250px;
                white-space: normal;
                display: none;
                z-index: 1000;
                color: var(--text-color);
                word-wrap: break-word;
            }
            .number-card-info:hover .number-card-tooltip {
                display: block;
            }
            .number-card-main {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex: 1;
            }
            .number-card-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .number-card-menu {
                position: relative;
            }
            .number-card-menu-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-muted);
                border-radius: 4px;
                padding: 4px;
            }
            .number-card-menu-btn:hover {
                background: var(--bg-light-gray);
            }
            .number-card-menu-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-shadow: var(--shadow-sm);
                display: none;
                z-index: 100;
                min-width: 100px;
            }
            .number-card-menu-dropdown.show {
                display: block;
            }
            .number-card-menu-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                width: 100%;
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-color);
                font-size: 12px;
                border-radius: 4px;
            }
            .number-card-menu-item:hover {
                background: var(--bg-light-gray);
            }
            .number-card-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--bg-light-gray);
                transition: background-color 0.2s;
                flex-shrink: 0;
                margin-left: 12px;
            }
            .number-card-icon i {
                font-size: 16px;
                color: var(--text-color);
            }
            .number-card-content {
                width: 100%;
                display: flex;
                flex-direction: column;
                flex: 1;
            }
            .number-card-title {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
                font-weight: 500;
                line-height: 1.2;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                word-break: break-word;
            }
            .number-card-value {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-color);
                margin: 2px 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1;
            }
            .text-danger {
                color: var(--red-500) !important;
                font-size: 14px !important;
            }
            .no-data {
                width: 100%;
                text-align: center;
                color: var(--text-muted);
                padding: 40px;
                background: var(--card-bg);
                border-radius: 8px;
                border: 1px solid var(--border-color);
            }

            @media (max-width: 1200px) {
                .number-card {
                    flex-basis: calc(33.333% - 10px);
                }
            }
            @media (max-width: 992px) {
                .number-card {
                    flex-basis: calc(50% - 7.5px);
                }
            }
            @media (max-width: 576px) {
                .number-card {
                    flex-basis: 100%;
                }
                .number-card-value {
                    font-size: 18px;
                }
            }
        `;
	}
}

// Batch processor for network requests
class BatchProcessor {
	constructor(batchWindow) {
		this.batchWindow = batchWindow;
		this.currentBatch = [];
		this.batchPromise = null;
		this.batchTimeout = null;
	}

	add(request) {
		if (!this.batchPromise) {
			this.batchPromise = new Promise((resolve) => {
				this.batchTimeout = setTimeout(() => {
					this.processBatch().then(resolve);
				}, this.batchWindow);
			});
		}

		const requestPromise = new Promise((resolve) => {
			this.currentBatch.push({ request, resolve });
		});

		return requestPromise;
	}

	async processBatch() {
		clearTimeout(this.batchTimeout);
		const batch = this.currentBatch;
		this.currentBatch = [];
		this.batchPromise = null;

		const results = await Promise.all(batch.map(({ request }) => request()));
		batch.forEach(({ resolve }, index) => resolve(results[index]));
	}
}
