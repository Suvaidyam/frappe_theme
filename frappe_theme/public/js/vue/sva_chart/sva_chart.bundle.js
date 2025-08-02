import { createApp } from "vue";
import { createPinia } from "pinia";
import { store } from "./store.js";
import App from "./App.vue"; 

class SvaChart {
	constructor({ wrapper, frm, charts ,signal}) {
		this.$wrapper = $(wrapper);
		this.frm = frm;
		this.charts = charts;
		this.signal = signal;
		this.init();
	}

	init(refresh) {
		!refresh && this.setup_app();
	}
	refresh(){
		this.setup_app();
	}
	setup_app() {
		// create a pinia instance
		let pinia = createPinia();
		// create a vue instance with dynamic props
		let app = createApp(App, {
			charts: this.charts || [],
		});
		SetVueGlobals(app);
		app.use(pinia);

		// create a store
		app.provide('store', store);

		// mount the app
		this.$sva_chart= app.mount(this.$wrapper.get(0));
	}

	
}

export default SvaChart;
