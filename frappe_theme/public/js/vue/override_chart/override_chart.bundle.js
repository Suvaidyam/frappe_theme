import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

class OverrideChart {
	constructor({ wrapper, frm, chart, type }) {
		this.$wrapper = $(wrapper);
		this.frm = frm;
		this.chart = chart;
		this.type = type;
		this.init();
	}

	init(refresh) {
		!refresh && this.setup_app();
	}

	cleanup() {
		if (this.app) {
			try {
				this.app.unmount();
				this.app = null;
			} catch (e) {
				console.warn("Error during cleanup:", e);
			}
		}
	}

	refresh() {
		this.cleanup();
		this.setup_app();
	}

	setup_app() {
		// create a pinia instance
		let pinia = createPinia();
		// create a vue instance with dynamic props
		this.app = createApp(App, {
			chart: this.chart || {},
			type: this.type || "bar",
		});
		SetVueGlobals(this.app);
		this.app.use(pinia);

		// mount the app only if wrapper exists
		if (this.$wrapper && this.$wrapper.get(0)) {
			this.app.mount(this.$wrapper.get(0));
		} else {
			console.warn("Wrapper element not found for mounting Vue app");
		}
	}
}

frappe.provide("frappe.ui");
frappe.ui.OverrideChart = OverrideChart;
export default OverrideChart;
