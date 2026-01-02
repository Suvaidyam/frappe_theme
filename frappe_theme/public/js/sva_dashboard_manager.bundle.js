import SvaCard from "./vue/sva_card/sva_card.bundle.js";
import SvaChart from "./vue/sva_chart/sva_chart.bundle.js";

class SVADashboardManager {
	static DEFAULT_OPTIONS = {
		numberCards: [],
		charts: [],
		signal: null,
		debounceTime: 250,
		errorHandler: console.error,
	};

	constructor({ wrapper, frm, ...options }) {
		if (!wrapper || !frm) {
			throw new Error("wrapper and frm are required parameters");
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

		this.sva_db = new SVAHTTP(this.signal);
		// State management
		this.isDestroyed = false;
		this.activeRequests = new Set();
		this.componentInstances = new Map();
		this.filters = {};

		// Create container instances with memoization
		this.containers = {};
		if (this.numberCards.length) {
			this.containers["cards"] = this.createContainer("sva-dashboard-cards");
		}

		if (this.charts.length) {
			this.containers["charts"] = this.createContainer("sva-dashboard-charts");
		}
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
			return new Promise((resolve) => {
				timeoutId = setTimeout(() => resolve(fn.apply(this, args)), delay);
			});
		};
	}

	// Enhanced error handling
	handleError(error, context = "") {
		if (this.isDestroyed) return;

		if (error.name === "AbortError") {
			console.log(`${context} aborted`);
			return;
		}

		this.errorHandler(`${context}: ${error.message}`, error);
	}

	createContainer(className) {
		const container = document.createElement("div");
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
					signal: this.signal,
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
			if (this.charts?.length && !this.frm.is_new()) {
				let chartInstance = new SvaChart({
					wrapper: this.containers.charts,
					frm: this.frm,
					charts: this.charts,
					signal: this.signal,
				});
				initializationPromises.push(chartInstance);
			} else if (this.charts?.length) {
				this.containers.charts.innerHTML = `
                <div style="height: 344px; gap: 10px;" id="form-not-saved" class="d-flex flex-column justify-content-center align-items-center p-3 card rounded mb-2">
                    <svg class="icon icon-xl" style="stroke: var(--text-light);">
					    <use href="#icon-small-file"></use>
				    </svg>
                </div>`;
			}

			await Promise.all(initializationPromises);
			await this.init();
		} catch (error) {
			this.handleError(error, "Component initialization failed");
		}
	}

	async init() {
		if (this.isDestroyed) return;

		try {
			await this.make();
			await this.renderDashboard();
		} catch (error) {
			this.handleError(error, "Dashboard initialization failed");
		}
	}

	async make() {
		if (this.isDestroyed) return;

		this.wrapper.innerHTML = "";
		if (this.containers.cards) {
			this.wrapper.appendChild(this.containers.cards);
		}
		if (this.containers.charts) {
			this.wrapper.appendChild(this.containers.charts);
		}
		await this.initializeStyles();
	}

	async initializeStyles() {
		if (document.getElementById("sva-dashboard-manager-styles")) return;

		const styleSheet = document.createElement("style");
		styleSheet.id = "sva-dashboard-manager-styles";
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

		const renderPromises = Array.from(this.componentInstances.entries()).map(
			([type, instance]) => {
				instance.filters = this.filters;
				return instance
					.make()
					.catch((error) => this.handleError(error, `${type} rendering error`));
			}
		);

		await Promise.all(renderPromises);
	}

	cleanup() {
		if (this.isDestroyed) return;

		this.isDestroyed = true;

		// Cancel all pending requests
		this.activeRequests.forEach((controller) => controller.abort());
		this.activeRequests.clear();

		// Cleanup component instances
		this.componentInstances.forEach((instance) => {
			if (typeof instance.cleanup === "function") {
				instance.cleanup();
			}
		});
		this.componentInstances.clear();

		// Clear DOM elements
		Object.values(this.containers).forEach((container) => {
			container.innerHTML = "";
		});
		this.wrapper.innerHTML = "";

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
