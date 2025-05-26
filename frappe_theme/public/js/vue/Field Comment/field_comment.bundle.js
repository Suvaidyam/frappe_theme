import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./field_comment.vue";

class FieldComment {
    constructor({ wrapper, frm }) {
        this.$wrapper = $(wrapper);
        this.frm = frm;
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
            frm: this.frm || {},
        });
        SetVueGlobals(this.app);
        this.app.use(pinia);

        // mount the app only if wrapper exists
        if (this.$wrapper && this.$wrapper.get(0)) {
            this.app.mount(this.$wrapper.get(0));
        } else {
            console.warn('Wrapper element not found for mounting Vue app');
        }
    }

}

frappe.provide("frappe.ui");
frappe.ui.FieldComment = FieldComment;
export default FieldComment;
