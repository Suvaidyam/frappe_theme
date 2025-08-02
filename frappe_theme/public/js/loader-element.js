class Loader {
    constructor(wrapper, id) {
        this.wrapper = wrapper;
        this.hash = id || wrapper?.id || 'loader';  // Assign a default ID if none exists
        this.loader = document.createElement('div'); // Store reference to the loader

        this.loader.id = this.hash;
        this.loader.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            min-height: 200px;
            width: 100%;
            background: white;
            z-index: 1;
        `;

        let loaderInner = document.createElement('div');
        loaderInner.style.cssText = `
            border: 4px solid #f3f3f3;
            border-top: 4px solid ${frappe.boot?.my_theme?.button_background_color || "black"};
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        `;

        this.loader.appendChild(loaderInner);
        this.wrapper.appendChild(this.loader);

        // Add keyframes in <style> if not already added
        if (!document.getElementById('loader-style')) {
            const style = document.createElement('style');
            style.id = 'loader-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    hide() {
        if (this.loader && this.wrapper.contains(this.loader)) {
            this.wrapper.removeChild(this.loader);
        }
    }

    show() {
        if (!this.wrapper.contains(this.loader)) {
            this.wrapper.appendChild(this.loader);
        }
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(16);
    }
}

export default Loader;