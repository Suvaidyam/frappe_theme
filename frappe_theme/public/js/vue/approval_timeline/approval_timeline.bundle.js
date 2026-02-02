import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

class CustomApprovalTimeline {
	constructor({ wrapper, doctype, referenceName, documentTitle, wf_state }) {
		this.$wrapper = $(wrapper);
		this.app = null;
		this.doctype = doctype;
		this.referenceName = referenceName;
		this.documentTitle = documentTitle;
		this.wf_state = wf_state;
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
			doctype: this.doctype,
			referenceName: this.referenceName,
			documentTitle: this.documentTitle,
			wf_state: this.wf_state,
			autoLoad: true,
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
frappe.ui.CustomApprovalTimeline = CustomApprovalTimeline;
export default CustomApprovalTimeline;
