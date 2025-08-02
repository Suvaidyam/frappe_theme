class SVAHTTP {
    constructor(signal) {
        this.signal = signal;
        this.controller = null; // Store the AbortController
    }

    // Create a new AbortController and cancel the previous request
    newRequest() {
        if (this.controller) {
            this.controller.abort(); // Cancel the previous request
        }
        this.controller = new AbortController(); // Create a new controller
        return this.controller.signal; // Return the signal for fetch
    }

    // Get CSRF Token from Frappe
    getCsrfToken() {
        return frappe.csrf_token || "";
    }

    // Fetch Wrapper
    async fetchAPI(method, data) {
        const signal = this.signal || this.newRequest();
        const response = await fetch(`/api/method/${method}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Frappe-CSRF-Token": this.getCsrfToken()
            },
            body: JSON.stringify({ ...data, _: (new Date()).getTime() }),
            signal
        });

        let responseData;
        try {
            responseData = await response.json();
        } catch (error) {
            // If parsing fails, fallback to text (or a default message)
            responseData = { message: await response.text() };
        }
        if (!response.ok) {
            console.error(responseData,'Eroor in response');
            let messages = JSON.parse(responseData._server_messages || '[]');
            let msg = ''
            if (messages.length) {
                msg = messages.map(message_obj => JSON.parse(message_obj || '{}')?.message).join('\n');
            }
            const errorMsg = msg || "Request failed";
            throw new Error(errorMsg);
        }

        return responseData;
    }

    async call(args = {}) {
        const signal = this.newRequest();
        let method = args.method;
        delete args.method;
        const response = await fetch(`/api/method/${method}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Frappe-CSRF-Token": this.getCsrfToken()
            },
            body: JSON.stringify(args),
            signal
        });
        return await response.json();
    }
    // Check if a record exists
    async exists(doctype, filters) {
        const exists = await this.fetchAPI("frappe.client.get_value", { doctype, fieldname: 'name', filters })
        return exists?.message?.name || false;
    }

    // Fetch a specific document
    async get_doc(doctype, name) {
        let res = await this.fetchAPI("frappe.client.get", { doctype, name });
        return res.message;
    }
    // Fetch a specific document
    async get_list(doctype, args) {
        let res = await this.fetchAPI("frappe.client.get_list", { doctype, ...args });
        return res.message;
    }
    // Fetch a single value from a document
    async get_value(doctype, filters, fieldname = 'name') {
        let res = await this.fetchAPI("frappe.client.get_value", { doctype, fieldname, filters });
        return res.message[fieldname];
    }

    // Set a value in a document
    async set_value(doctype, name, fieldname, value) {
        let res = await this.fetchAPI("frappe.client.set_value", { doctype, name, fieldname, value });
        return res.message;
    }

    // Fetch values from a Singleton Doctype
    async get_single_value(doctype) {
        let res = await this.fetchAPI("frappe.client.get_single_value", { doctype });
        return res.message;
    }
}

// export default SVAHTTP;