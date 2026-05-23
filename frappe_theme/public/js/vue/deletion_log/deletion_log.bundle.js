import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

class DeletionLog {
	constructor({ frm }) {
		this.frm = frm;
		this.app = null;
		this._mountEl = null;
		this.init();
	}

	init() {
		this.setup_app();
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
		if (this._mountEl && this._mountEl.parentNode) {
			this._mountEl.parentNode.removeChild(this._mountEl);
			this._mountEl = null;
		}
	}

	setup_app() {
		// Create and attach overlay container to body
		this._mountEl = document.createElement("div");
		document.body.appendChild(this._mountEl);

		let pinia = createPinia();
		this.app = createApp(App, { frm: this.frm });
		SetVueGlobals(this.app);
		this.app.use(pinia);
		this.app.mount(this._mountEl);

		// Listen for close event dispatched by App.vue
		this._mountEl.addEventListener("dl-close", () => this.cleanup());
	}
}

frappe.provide("frappe.ui");
frappe.ui.DeletionLog = DeletionLog;
export default DeletionLog;
