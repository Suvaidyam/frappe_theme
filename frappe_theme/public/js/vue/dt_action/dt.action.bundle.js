import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./dt_action.vue";

class DTAction {
    constructor({ wrapper, dt }) {
        this.$wrapper = $(wrapper);
        this.dt = dt;
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
            dt: this.dt || {},
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

export default DTAction;