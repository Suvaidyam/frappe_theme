class FilterRibbon {
	constructor({ wrapper, frm, filters = [] }) {
		this.wrapper = wrapper;
		this.filters = filters;
		this.frm = frm;
		this.lastUpdated = new Date();
		this.updateInterval = null;
		this.ribbonElement = null;
		this.linkFieldCache = {}; // Cache for link field values
		this.init();
	}

	init() {
		this.injectStyles();
		this.render();
		this.startTimestampUpdate();
	}

	injectStyles() {
		// Check if styles already exist
		if (document.getElementById("filter-ribbon-styles")) return;

		const style = document.createElement("style");
		style.id = "filter-ribbon-styles";
		style.textContent = `
            .filter-ribbon {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: #F8F8F8;
                border-left: 4px solid ${frappe.boot?.my_theme?.navbar_color || "#2196F3"};
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: 14px;
                color: #333;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                margin-bottom: 15px;
                border-radius: 0 4px 4px 0;
            }

            .filter-ribbon-content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
            }

            .filter-ribbon .check-icon {
                width: 24px;
                height: 24px;
                background: ${frappe.boot?.my_theme?.navbar_color || "#2196F3"};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .filter-ribbon .filter-text {
                color: ${frappe.boot?.my_theme?.navbar_color || "#1976D2"};
                line-height: 1.4;
            }

            .filter-ribbon .filter-text strong {
                font-weight: 600;
                color: ${frappe.boot?.my_theme?.navbar_color || "#1565C0"};
            }

            .filter-ribbon .filter-chip {
                display: inline-block;
                background: #fff;
                padding: 3px 10px;
                border-radius: 14px;
                margin: 0 3px;
                font-size: 12px;
                border: 1px solid ${frappe.boot?.my_theme?.navbar_color || "#2196F3"};
                color: ${frappe.boot?.my_theme?.navbar_color || "#1565C0"};
                font-weight: 500;
            }

            .filter-ribbon .filter-timestamp {
                color: #757575;
                font-size: 12px;
                font-style: italic;
                white-space: nowrap;
                margin-left: 16px;
            }

            @media (max-width: 768px) {
                .filter-ribbon {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }

                .filter-ribbon .filter-timestamp {
                    margin-left: 34px;
                }
            }
        `;

		document.head.appendChild(style);
	}

	/**
	 * Get field metadata from frm
	 */
	getFieldMeta(fieldname) {
		if (!this.frm || !this.frm.fields_dict) return null;

		const field = this.frm.fields_dict[fieldname];
		if (!field) return null;

		return field;
	}

	/**
	 * Fetch link field value with title
	 */
	async fetchLinkFieldValue(doctype, name, df) {
		const cacheKey = `${doctype}:${name}`;
		// Check cache first
		if (frappe._link_titles[cacheKey]) {
			return frappe._link_titles[cacheKey];
		}
		try {
			let displayValue = frappe.utils.get_link_title(doctype, name);
			if (displayValue) {
				frappe._link_titles[cacheKey] = displayValue;
				return displayValue;
			}

			displayValue = await frappe.utils.fetch_link_title(doctype, name);
			if (displayValue) {
				frappe._link_titles[cacheKey] = displayValue;
				return displayValue;
			}

			frappe._link_titles[cacheKey] = name;
			return name;
		} catch (e) {
			console.error("Error fetching link field value:", e);
			frappe._link_titles[cacheKey] = name;
			return name;
		}
	}

	/**
	 * Get formatted value based on field type
	 */
	async getFormattedValue(fieldname, value) {
		let field_meta = this.getFieldMeta(fieldname);
		if (!field_meta) {
			return this.formatPlainValue(value);
		}

		const fieldtype = field_meta?.df?.fieldtype;
		try {
			// Handle different field types
			switch (fieldtype) {
				case "Link":
					if (value && field_meta?.df?.options) {
						return await this.fetchLinkFieldValue(field_meta?.df?.options, value);
					}
					return value || "";

				case "Select":
					return value || "";

				case "Date":
					if (value && typeof frappe !== "undefined" && frappe.datetime) {
						return frappe.datetime.str_to_user(value);
					}
					return value;

				case "Datetime":
					if (value && typeof frappe !== "undefined" && frappe.datetime) {
						return frappe.datetime.str_to_user(value);
					}
					return value;

				case "Time":
					return value;

				case "Currency":
					if (value && typeof frappe !== "undefined" && frappe.format) {
						return frappe.format(value, field_meta?.df);
					}
					return value;

				case "Float":
				case "Percent":
					if (value && typeof frappe !== "undefined" && frappe.format) {
						return frappe.format(value, field_meta?.df);
					}
					return value;

				case "Int":
					return value;

				case "Check":
					return value ? "Yes" : "No";

				case "Data":
				case "Small Text":
				case "Text":
				case "Long Text":
				case "Code":
					return value;

				case "Table MultiSelect":
					return await this.getMultiselectDisplay(value, field_meta);
				default:
					return value;
			}
		} catch (e) {
			console.error("Error formatting value:", e);
			return value;
		}
	}

	async getMultiselectDisplay(values, field_meta) {
		if (!field_meta) return values;
		if (field_meta?._link_field) {
			if (Array.isArray(values)) {
				const displayValues = [];
				for (const val of values) {
					let value = val[field_meta?._link_field?.fieldname] || val;
					const displayVal = await this.fetchLinkFieldValue(
						field_meta?._link_field?.options,
						value
					);
					displayValues.push(displayVal);
				}
				return displayValues.join(", ");
			}
		}
		let table_meta = frappe.get_meta(field_meta?.df?.options);
		if (table_meta) {
			let first_link_field = table_meta.fields.find((f) => f.fieldtype === "Link");
			if (first_link_field) {
				if (Array.isArray(values)) {
					const displayValues = [];
					for (const val of values) {
						let value = val[first_link_field?.fieldname] || val;
						const displayVal = await this.fetchLinkFieldValue(
							first_link_field?.options,
							value
						);
						displayValues.push(displayVal);
					}
					return displayValues.join(", ");
				}
			}
		}
	}
	/**
	 * Format plain value (when no field metadata available)
	 */
	formatPlainValue(value) {
		if (value === null || value === undefined) {
			return "empty";
		}

		if (typeof value === "boolean") {
			return value ? "Yes" : "No";
		}

		if (Array.isArray(value)) {
			return value.join(", ");
		}

		if (typeof value === "object") {
			// Try to find a readable property
			const readableKeys = ["name", "title", "label", "value"];
			for (const key of readableKeys) {
				if (value[key]) {
					return value[key];
				}
			}
			return JSON.stringify(value);
		}

		return String(value);
	}

	/**
	 * Parse filters and convert them to readable text
	 */
	async parseFilters(filters) {
		if (!filters || filters.length === 0) {
			return [];
		}

		const parsed = [];

		// Handle object format: {"key": "value"}
		if (!Array.isArray(filters) && typeof filters === "object") {
			for (const [key, value] of Object.entries(filters)) {
				const formatted = await this.formatFilter(key, "=", value);
				parsed.push(formatted);
			}
			return parsed;
		}

		// Handle array format
		if (Array.isArray(filters)) {
			for (const filter of filters) {
				// Frappe filter format: ["doctype", "fieldname", "operator", "value"]
				if (Array.isArray(filter) && filter.length >= 3) {
					const [doctype, fieldname, operator, value] = filter;
					const formatted = await this.formatFilter(
						fieldname || doctype,
						operator,
						value
					);
					parsed.push(formatted);
				}
				// Object with label: {label: "Filter Name"}
				else if (typeof filter === "object" && filter.label) {
					parsed.push(filter.label);
				}
				// Simple string
				else if (typeof filter === "string") {
					parsed.push(filter);
				}
				// Object format within array
				else if (typeof filter === "object") {
					for (const [key, value] of Object.entries(filter)) {
						if (key !== "label") {
							const formatted = await this.formatFilter(key, "=", value);
							parsed.push(formatted);
						}
					}
				}
			}
		}

		return parsed;
	}

	/**
	 * Format a single filter with fieldname, operator, and value
	 */
	async formatFilter(fieldname, operator, value) {
		const df = this.getFieldMeta(fieldname);

		// Get field label
		const fieldLabel = this.beautifyFieldname(fieldname);

		// Format operator
		const operatorMap = {
			"=": ":",
			"!=": "is not",
			">": ">",
			"<": "<",
			">=": "≥",
			"<=": "≤",
			like: "contains",
			"not like": "does not contain",
			in: "is one of",
			"not in": "is not one of",
			is: "is",
			between: "between",
		};

		const operatorText = operatorMap[operator] || operator;

		// Format single value
		const valueText = await this.getFormattedValue(fieldname, value, df);

		// Build filter text
		if (operatorText === ":") {
			return `<b>${fieldLabel}</b>: ${valueText}`;
		} else {
			return `<b>${fieldLabel}</b> ${operatorText} ${valueText}`;
		}
	}

	/**
	 * Convert field names to readable format
	 */
	beautifyFieldname(fieldname) {
		if (!fieldname) return "";
		let fields = this.frm?.meta?.fields;
		let target_field = fields?.find((f) => f.fieldname === fieldname);
		if (target_field && (target_field.label || target_field.placeholder)) {
			return target_field.label || target_field.placeholder;
		}
		return fieldname.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
	}

	async render() {
		// Clear existing ribbon if any
		if (this.ribbonElement) {
			this.ribbonElement.remove();
		}

		// Parse filters (now async)
		const parsedFilters = await this.parseFilters(this.filters);

		if (parsedFilters.length === 0) {
			return; // Don't render if no filters
		}

		// Create ribbon element
		this.ribbonElement = document.createElement("div");
		this.ribbonElement.className = "filter-ribbon";
		this.ribbonElement.id = "sva-filter-ribbon";

		const filterText = parsedFilters.join(", ");
		const filterCount = parsedFilters.length;

		this.ribbonElement.innerHTML = `
            <div class="filter-ribbon-content">
                <div class="check-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13.3337 4L6.00033 11.3333L2.66699 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="filter-text">
                    <strong>${filterCount} filter${
			filterCount > 1 ? "s" : ""
		} applied:</strong> ${filterText}
                    <text class="filter-timestamp" style="text-align:right;">${this.getRelativeTime()}</text>
                </div>
            </div>
        `;

		if (this.wrapper && !this.wrapper.querySelector("#sva-filter-ribbon")) {
			this.wrapper.appendChild(this.ribbonElement);
		}
	}

	getRelativeTime() {
		const now = new Date();
		const diffMs = now - this.lastUpdated;
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSecs < 10) {
			return "Last updated: Just now";
		} else if (diffSecs < 60) {
			return `Last updated: ${diffSecs} seconds ago`;
		} else if (diffMins < 60) {
			return `Last updated: ${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
		} else if (diffHours < 24) {
			return `Last updated: ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		} else if (diffDays < 7) {
			return `Last updated: ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
		} else {
			// Use Frappe's date formatter if available
			if (typeof frappe !== "undefined" && frappe.datetime) {
				return `Last updated: ${frappe.datetime.str_to_user(this.lastUpdated)}`;
			}
			return `Last updated: ${this.lastUpdated.toLocaleDateString()}`;
		}
	}

	updateTimestamp() {
		const timestampElement = this.ribbonElement?.querySelector(".filter-timestamp");
		if (timestampElement) {
			timestampElement.textContent = this.getRelativeTime();
		}
	}

	startTimestampUpdate() {
		// Clear existing interval if any
		this.stopTimestampUpdate();

		// Update every 10 seconds
		this.updateInterval = setInterval(() => {
			this.updateTimestamp();
		}, 10000);
	}

	stopTimestampUpdate() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	updateFilters(filters) {
		this.filters = filters;
		this.lastUpdated = new Date();
		this.linkFieldCache = {}; // Clear cache when filters update
		this.render();
	}

	refresh() {
		this.lastUpdated = new Date();
		this.linkFieldCache = {}; // Clear cache on refresh
		this.render();
	}

	destroy() {
		this.stopTimestampUpdate();
		if (this.ribbonElement) {
			this.ribbonElement.remove();
			this.ribbonElement = null;
		}
		this.linkFieldCache = {};
	}
}

frappe.provide("frappe.ui");
frappe.ui.FilterRibbon = FilterRibbon;
export default FilterRibbon;
