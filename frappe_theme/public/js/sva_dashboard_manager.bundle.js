import SvaCard from './vue/sva_card/sva_card.bundle.js';
import SvaChart from './vue/sva_chart/sva_chart.bundle.js';

class SVADashboardManager {
    static DEFAULT_OPTIONS = {
        numberCards: [],
        charts: [],
        signal: null,
        debounceTime: 250,
        errorHandler: console.error
    };

    constructor({ wrapper, frm, ...options }) {
        if (!wrapper || !frm) {
            throw new Error('wrapper and frm are required parameters');
        }

        // Merge default options with provided options
        const config = { ...SVADashboardManager.DEFAULT_OPTIONS, ...options };
        // Core properties
        this.wrapper = wrapper;
        this.refresh = null;
        this.frm = frm;
        this.numberCards = config.numberCards;
        this.charts = config.charts;
        this.signal = config.signal;
        this.errorHandler = config.errorHandler;
        this.debounceTime = config.debounceTime;

        this.sva_db = new SVAHTTP(this.signal)
        // State management
        this.isDestroyed = false;
        this.activeRequests = new Set();
        this.componentInstances = new Map();
        this.filters = {};

        // Create container instances with memoization
        this.containers = {
            cards: this.createContainer('sva-dashboard-cards'),
            charts: this.createContainer('sva-dashboard-charts')
        };

        // Bind methods to preserve context
        this.renderDashboard = this.renderDashboard.bind(this);

        // Initialize if components are provided
        if (this.numberCards.length || this.charts.length) {
            this.initializeComponents().catch(this.handleError.bind(this));
        }
        return { wrapper: this.wrapper, ref: this };
    }

    // Utility method for debouncing
    debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            return new Promise(resolve => {
                timeoutId = setTimeout(() => resolve(fn.apply(this, args)), delay);
            });
        };
    }

    // Enhanced error handling
    handleError(error, context = '') {
        if (this.isDestroyed) return;

        if (error.name === 'AbortError') {
            console.log(`${context} aborted`);
            return;
        }

        this.errorHandler(`${context}: ${error.message}`, error);
    }

    createContainer(className) {
        const container = document.createElement('div');
        container.className = className;
        return container;
    }

    async initializeComponents() {
        if (this.isDestroyed) return;

        try {
            const initializationPromises = [];

            // Initialize number cards
            if (this.numberCards?.length && !this.frm.is_new()) {
                let cardInstance = new SvaCard({
                    wrapper: this.containers.cards,
                    frm: this.frm,
                    numberCards: this.numberCards,
                    signal: this.signal
                });
                this.refresh = cardInstance.refresh.bind(cardInstance);
                initializationPromises.push(cardInstance);
            } else if (this.numberCards?.length) {
                this.containers.cards.innerHTML = `
                <div style="height: 66px; gap: 10px;" id="form-not-saved" class="d-flex flex-column justify-content-center align-items-center p-3 card rounded mb-2">
                    <svg class="icon icon-xl" style="stroke: var(--text-light);">
					    <use href="#icon-small-file"></use>
				    </svg>
                </div>
                `;
            }
            // Initialize charts
            if (this.charts?.length && !this.frm.is_new()) {
                let chartInstance = new SvaChart({
                    wrapper: this.containers.charts,
                    frm: this.frm,
                    charts: this.charts,
                    signal: this.signal
                });
                initializationPromises.push(chartInstance);
            } else if (this.charts?.length) {
                this.containers.charts.innerHTML = `
                <div style="height: 344px; gap: 10px;" id="form-not-saved" class="d-flex flex-column justify-content-center align-items-center p-3 card rounded mb-2">
                    <svg class="icon icon-xl" style="stroke: var(--text-light);">
					    <use href="#icon-small-file"></use>
				    </svg>
                </div>`
            }

            await Promise.all(initializationPromises);
            await this.init();
        } catch (error) {
            this.handleError(error, 'Component initialization failed');
        }
    }

    async init() {
        if (this.isDestroyed) return;

        try {
            await this.make();
            await this.renderDashboard();
        } catch (error) {
            this.handleError(error, 'Dashboard initialization failed');
        }
    }

    // async initializeNumberCards() {

    //     const cardInstance = new SVANumberCard({
    //         wrapper: this.containers.cards,
    //         frm: this.frm,
    //         numberCards: this.numberCards,
    //         filters: this.filters,
    //         signal: this.signal
    //     });
    //     if(cardInstance.numberCards.length){
    //         if(!this.frm?.['sva_cards']){
    //             this.frm['sva_cards'] = {};
    //         }
    //         if(!this.frm?.['sva_cards']?.[cardInstance.numberCards[0].number_card]){
    //             this.frm['sva_cards'][cardInstance.numberCards[0].number_card] = cardInstance;
    //         }
    //     }
    //     this.componentInstances.set('cards', cardInstance);
    // }

    // async initializeCharts() {
    //     const chartInstance = new SVADashboardChart({
    //         wrapper: this.containers.charts,
    //         frm: this.frm,
    //         charts: this.charts,
    //         filters: this.filters,
    //         signal: this.signal
    //     });
    //     if(!this.frm?.['sva_charts']){
    //         this.frm['sva_charts'] = {};
    //     }
    //     if(chartInstance.charts.length){
    //         if(!this.frm?.['sva_charts']?.[chartInstance.charts[0].dashboard_chart]){
    //             this.frm['sva_charts'][chartInstance.charts[0].dashboard_chart] = chartInstance;
    //         }
    //     }
    //     this.componentInstances.set('charts', chartInstance);

    // }

    // async makeRequest(requestFn) {
    //     const controller = new AbortController();
    //     const signal = this.signal || controller.signal;

    //     try {
    //         this.activeRequests.add(controller);

    //         if (signal.aborted) {
    //             throw new DOMException('Request aborted', 'AbortError');
    //         }

    //         return await Promise.race([
    //             requestFn(),
    //             new Promise((_, reject) => {
    //                 signal.addEventListener('abort', () =>
    //                     reject(new DOMException('Request aborted', 'AbortError'))
    //                 );
    //             })
    //         ]);
    //     } finally {
    //         this.activeRequests.delete(controller);
    //     }
    // }

    // async getFilterFields() {
    //     console.log("Getting filter fields");

    //     if (this.isDestroyed) return [];

    //     try {
    //         const meta = frappe.get_meta(this.frm.doctype);
    //         const fields = this.getStandardDateFields();
    //         const allFields = new Set();

    //         await Promise.all([
    //             this.processChartFields(allFields),
    //             this.processCardFields(allFields)
    //         ]);

    //         this.addMetaFields(meta, allFields, fields);
    //         return fields;
    //     } catch (error) {
    //         this.handleError(error, 'Error getting filter fields');
    //         return [];
    //     }
    // }

    // async processChartFields(allFields) {
    //     const chartPromises = this.charts
    //         .filter(chart => chart.dashboard_chart && !this.isDestroyed)
    //         .map(chart => this.sva_db.get_doc('Dashboard Chart', chart.dashboard_chart)
    //             .then(chartDoc => this.processFiltersJson(chartDoc.filters_json, allFields))
    //             .catch(error => this.handleError(error, 'Chart field processing error'))
    //         );

    //     await Promise.all(chartPromises);
    // }

    // async processCardFields(allFields) {
    //     const cardPromises = this.numberCards
    //         .filter(card => card.number_card && !this.isDestroyed)
    //         .map(card => this.sva_db.get_doc('Number Card', card.number_card)
    //             .then(cardDoc => this.processFiltersJson(cardDoc.filters_json, allFields))
    //             .catch(error => this.handleError(error, 'Card field processing error'))
    //         );

    //     await Promise.all(cardPromises);
    // }

    // processFiltersJson(filtersJson, allFields) {
    //     try {
    //         const filters = JSON.parse(filtersJson);
    //         Object.keys(filters).forEach(fieldname => allFields.add(fieldname));
    //     } catch (error) {
    //         this.handleError(error, 'Filter JSON parsing error');
    //     }
    // }

    async make() {
        if (this.isDestroyed) return;

        this.wrapper.innerHTML = '';
        this.wrapper.appendChild(this.containers.cards);
        this.wrapper.appendChild(this.containers.charts);
        await this.initializeStyles();
    }

    async initializeStyles() {
        if (document.getElementById('sva-dashboard-manager-styles')) return;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'sva-dashboard-manager-styles';
        styleSheet.textContent = `
            .sva-dashboard-cards,
            .sva-dashboard-charts {
                padding: 0px;
                display: grid;
                gap: 1rem;
            }
           
        `;
        document.head.appendChild(styleSheet);
    }

    async renderDashboard() {
        if (this.isDestroyed) return;

        const renderPromises = Array.from(this.componentInstances.entries())
            .map(([type, instance]) => {
                instance.filters = this.filters;
                return instance.make()
                    .catch(error => this.handleError(error, `${type} rendering error`));
            });

        await Promise.all(renderPromises);
    }

    cleanup() {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // Cancel all pending requests
        this.activeRequests.forEach(controller => controller.abort());
        this.activeRequests.clear();

        // Cleanup component instances
        this.componentInstances.forEach(instance => {
            if (typeof instance.cleanup === 'function') {
                instance.cleanup();
            }
        });
        this.componentInstances.clear();

        // Clear DOM elements
        Object.values(this.containers).forEach(container => {
            container.innerHTML = '';
        });
        this.wrapper.innerHTML = '';

        // Clear references
        this.wrapper = null;
        this.frm = null;
        this.numberCards = null;
        this.charts = null;
        this.filters = null;
        this.signal = null;
        this.containers = null;
    }
}

export default SVADashboardManager;