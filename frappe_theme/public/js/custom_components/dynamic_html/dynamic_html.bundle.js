import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

class CustomDynamicHtml {
	constructor(frm, wrapper, connection) {
		this.$wrapper = $(wrapper);
		this.app = null;
		this.frm = frm;
		this.connection = connection;
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
		let pinia = createPinia();
		const props = { frm: this.frm, connection: this.connection };
		this.app = createApp(App, props);
		if (typeof SetVueGlobals === "function") {
			SetVueGlobals(this.app);
		}
		this.app.use(pinia);

		if (this.$wrapper && this.$wrapper.get(0)) {
			this.app.mount(this.$wrapper.get(0));
		} else {
			console.warn("Wrapper element not found for mounting Vue app");
		}
	}
}

frappe.provide("frappe.ui");
frappe.ui.CustomDynamicHtml = CustomDynamicHtml;
export default CustomDynamicHtml;
