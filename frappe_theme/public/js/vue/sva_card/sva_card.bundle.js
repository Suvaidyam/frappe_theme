import { createApp } from "vue";
import { createPinia } from "pinia";
import { store } from "./store.js";
import App from "./App.vue"; 

class SvaCard {
	constructor({ wrapper, frm, numberCards, signal }) {
		this.$wrapper = $(wrapper);
		this.frm = frm;
		this.numberCards = numberCards;
		this.signal = signal;
		this.app = null;
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
				console.warn('Error during cleanup:', e);
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
			cards: this.numberCards || [],
		});
		SetVueGlobals(this.app);
		this.app.use(pinia);

		// create a store
		this.app.provide('store', store);

		// mount the app only if wrapper exists
		if (this.$wrapper && this.$wrapper.get(0)) {
			this.app.mount(this.$wrapper.get(0));
		} else {
			console.warn('Wrapper element not found for mounting Vue app');
		}
	}
}

export default SvaCard;
