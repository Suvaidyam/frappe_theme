import { createApp } from "vue";
import { createPinia } from "pinia";
import { store } from "./store.js";
import App from "./App.vue";

class SvaChart {
	constructor({ wrapper, frm, charts, signal, filters = {} }) {
		this.$wrapper = $(wrapper);
		this.frm = frm;
		this.charts = charts;
		this.signal = signal;
		this.filters = filters;
		this.app = null;
		this.init();
	}

	init(refresh) {
		!refresh && this.setup_app();
	}
	refresh(filters) {
		if (filters) {
			this.setFilters(filters);
		}
		this.cleanup();
		this.setup_app();
	}

	cleanup() {
		if (this.app) {
			try {
				this.app.unmount();
				this.app = null;
			} catch (e) {
				console.warn("Error during chart cleanup:", e);
			}
		}
	}

	setFilters(filters = {}) {
		this.filters = filters;
	}
	setup_app() {
		// create a pinia instance
		let pinia = createPinia();
		// create a vue instance with dynamic props
		let app = createApp(App, {
			charts: this.charts || [],
			filters: this.filters || {},
			frm: this.frm,
		});
		SetVueGlobals(app);
		app.use(pinia);

		// create a store
		app.provide("store", store);

		// mount the app
		this.app = app;
		this.$sva_chart = app.mount(this.$wrapper.get(0));
	}
}

export default SvaChart;
