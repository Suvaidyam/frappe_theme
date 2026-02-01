frappe.ui.form.ControlTableMultiSelect = class DashboardControlTableMultiSelect extends (
	frappe.ui.form.ControlTableMultiSelect
) {
	make_input() {
		if (this?.frm?.meta?.issingle && this.frm?.meta?.is_dashboard) {
			this.sva_multiselect = new FrappeMultiselect(this);
		} else {
			super.make_input();
		}
	}
};

class FrappeMultiselect {
	constructor(field) {
		// Frappe field object
		this.field = field;
		this.df = field.df;
		this.frm = field.frm;

		this.wrapper = field.$wrapper ? field.$wrapper[0] : field.wrapper;
		this.fieldname = this.df.fieldname;
		this.label = this.df.label || "";
		this.placeholder = this.df.placeholder || "Select options...";
		this._linkField = null;

		this.options = [];
		this.selectedValues = new Set();
		this.maxDisplayTags = 1;

		this.isOpen = false;
		this.searchTerm = "";
		this.loading = false;
		this.init();
	}

	getLinkField() {
		if (this.field?._linkField) return this.field._linkField;
		const meta = this.df?.options ? frappe.get_meta(this.df.options) : null;
		this._linkField =
			meta?.fields?.find((df) => df.fieldtype === "Link") ||
			this.df?.fields?.find((df) => df.fieldtype === "Link") ||
			null;
		return this._linkField;
	}

	normalizeValues(values) {
		if (values == null) return [];
		const linkFieldName = this.getLinkField()?.fieldname;
		const list = Array.isArray(values) ? values : [values];
		return list
			.map((item) => {
				if (item && typeof item === "object") {
					return (
						(linkFieldName && item[linkFieldName]) ||
						item.value ||
						item.name ||
						item.label
					);
				}
				return item;
			})
			.filter(Boolean);
	}

	getChildTableValue() {
		const values = this.getValue();
		const linkFieldName = this.getLinkField()?.fieldname;
		if (!linkFieldName) return values;
		return values.map((value) => ({ [linkFieldName]: value }));
	}

	async init() {
		this.render();
		this.bindEvents();
		this.loadExistingValue();
		this.updateDisplay();
		this.fetchOptionsDebounced();
	}

	// Fetch options from Frappe
	async fetchOptions() {
		let link_field = this.getLinkField();
		if (!link_field) {
			console.warn("No link doctype specified for multiselect");
			return;
		}

		this.setLoading(true);

		try {
			const response = await frappe.call({
				method: "frappe.desk.search.search_link",
				args: {
					txt: this.searchTerm,
					doctype: link_field.options,
					reference_doctype: this.frm?.doctype,
					page_length: 10,
					ignore_user_permissions: 0,
				},
				async: true,
			});
			if (response && response.message) {
				this.options = response.message;
				this.renderOptions();
			}
		} catch (error) {
			console.error("Error fetching options:", error);
			frappe.msgprint({
				title: __("Error"),
				indicator: "red",
				message: __("Failed to load options for {0}", [this.label]),
			});
		} finally {
			this.setLoading(false);
		}
	}

	// Load existing value from form
	loadExistingValue() {
		if (this.frm && this.frm.doc[this.fieldname]) {
			const value = this.frm.doc[this.fieldname];
			// Handle both comma-separated string and JSON array
			let values = [];
			if (typeof value === "string") {
				try {
					values = JSON.parse(value);
				} catch {
					values = value
						.split(",")
						.map((v) => v.trim())
						.filter(Boolean);
				}
			} else if (Array.isArray(value)) {
				values = value;
			}
			this.selectedValues = new Set(this.normalizeValues(values));
		}
	}

	setLoading(loading) {
		this.loading = loading;
		if (this.loadingEl) {
			this.loadingEl.style.display = loading ? "block" : "none";
		}
		if (this.optionsList) {
			this.optionsList.style.display = loading ? "none" : "block";
		}
	}

	render() {
		this.wrapper.innerHTML = "";
		this.wrapper.classList.add("frappe-multiselect-wrapper");

		this.container = document.createElement("div");
		this.container.className = "frappe-multiselect";
		this.container.setAttribute("tabindex", "0");

		// Selection area
		this.selectionArea = document.createElement("div");
		this.selectionArea.className = "frappe-multiselect-selection";

		this.tagsContainer = document.createElement("div");
		this.tagsContainer.className = "frappe-multiselect-tags";

		this.placeholderEl = document.createElement("span");
		this.placeholderEl.className = "frappe-multiselect-placeholder";
		this.placeholderEl.textContent = this.placeholder;

		this.arrowIcon = document.createElement("span");
		this.arrowIcon.className = "frappe-multiselect-arrow";
		this.arrowIcon.innerHTML = frappe.utils.icon("select", "sm");

		this.selectionArea.appendChild(this.tagsContainer);
		this.selectionArea.appendChild(this.placeholderEl);
		this.selectionArea.appendChild(this.arrowIcon);
		this.container.appendChild(this.selectionArea);

		// Dropdown
		this.dropdown = document.createElement("div");
		this.dropdown.className = "frappe-multiselect-dropdown";

		// Search
		this.searchWrapper = document.createElement("div");
		this.searchWrapper.className = "frappe-multiselect-search-wrapper";

		this.searchInput = document.createElement("input");
		this.searchInput.type = "text";
		this.searchInput.className = "frappe-multiselect-search";
		this.searchInput.placeholder = __("Search...");

		this.searchWrapper.appendChild(this.searchInput);
		this.dropdown.appendChild(this.searchWrapper);

		// Loading indicator
		this.loadingEl = document.createElement("div");
		this.loadingEl.className = "frappe-multiselect-loading";
		this.loadingEl.innerHTML = '<span class="loading-spinner"></span> ' + __("Loading...");
		this.loadingEl.style.display = "none";
		this.dropdown.appendChild(this.loadingEl);

		// Options list
		this.optionsList = document.createElement("div");
		this.optionsList.className = "frappe-multiselect-options";
		this.dropdown.appendChild(this.optionsList);

		// Actions
		this.actionsBar = document.createElement("div");
		this.actionsBar.className = "frappe-multiselect-actions";

		this.selectAllBtn = document.createElement("button");
		this.selectAllBtn.type = "button";
		this.selectAllBtn.className = "btn btn-xs btn-default";
		this.selectAllBtn.textContent = __("Select All");

		this.clearAllBtn = document.createElement("button");
		this.clearAllBtn.type = "button";
		this.clearAllBtn.className = "btn btn-xs btn-default";
		this.clearAllBtn.textContent = __("Clear All");

		this.actionsBar.appendChild(this.selectAllBtn);
		this.actionsBar.appendChild(this.clearAllBtn);
		this.dropdown.appendChild(this.actionsBar);

		this.container.appendChild(this.dropdown);
		this.wrapper.appendChild(this.container);

		this.injectStyles();
	}

	renderOptions() {
		this.optionsList.innerHTML = "";
		const filteredOptions = this.getFilteredOptions();
		const sortedOptions = this.getSortedOptions(filteredOptions);

		if (sortedOptions.length === 0) {
			const noResults = document.createElement("div");
			noResults.className = "frappe-multiselect-no-results";
			noResults.textContent = this.searchTerm
				? __("No matching options")
				: __("No options available");
			this.optionsList.appendChild(noResults);
			return;
		}

		sortedOptions.forEach((option, index) => {
			const optionEl = this.createOptionElement(option, index);
			this.optionsList.appendChild(optionEl);
		});
	}

	createOptionElement(option, index) {
		const value = typeof option === "object" ? option.value : option;
		const label = typeof option === "object" ? option.label : option;
		const description = typeof option === "object" ? option.description : "";
		const isSelected = this.selectedValues.has(value);

		const optionEl = document.createElement("div");
		optionEl.className = `frappe-multiselect-option ${isSelected ? "selected" : ""}`;
		optionEl.setAttribute("data-value", value);

		const checkbox = document.createElement("div");
		checkbox.className = `frappe-multiselect-checkbox ${isSelected ? "checked" : ""}`;
		checkbox.innerHTML = isSelected
			? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5L4 7L8 3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`
			: "";

		const labelEl = document.createElement("span");
		labelEl.className = "frappe-multiselect-option-label";
		labelEl.textContent = label;

		const textArea = document.createElement("div");
		textArea.className = "frappe-multiselect-option-text";
		textArea.appendChild(labelEl);

		if (description) {
			const descEl = document.createElement("div");
			descEl.className = "frappe-multiselect-option-description";
			descEl.textContent = description;
			textArea.appendChild(descEl);
		}

		optionEl.appendChild(checkbox);
		optionEl.appendChild(textArea);

		return optionEl;
	}

	getFilteredOptions() {
		if (!this.searchTerm) return this.options;
		const term = this.searchTerm.toLowerCase();
		return this.options.filter((option) => {
			const label = typeof option === "object" ? option.label : option;
			return label.toLowerCase().includes(term);
		});
	}

	getSortedOptions(options) {
		const selected = [];
		const unselected = [];

		options.forEach((option) => {
			const value = typeof option === "object" ? option.value : option;
			if (this.selectedValues.has(value)) {
				selected.push(option);
			} else {
				unselected.push(option);
			}
		});

		const sortAlpha = (a, b) => {
			const labelA = (typeof a === "object" ? a.label : a).toLowerCase();
			const labelB = (typeof b === "object" ? b.label : b).toLowerCase();
			return labelA.localeCompare(labelB);
		};

		selected.sort(sortAlpha);
		unselected.sort(sortAlpha);

		return selected.length > 0 ? [...selected, ...unselected] : unselected;
	}

	updateDisplay() {
		this.tagsContainer.innerHTML = "";
		const selectedArray = this.selectedValues ? Array.from(this.selectedValues) : [];
		if (selectedArray.length === 0) {
			this.placeholderEl.style.display = "block";
			this.tagsContainer.style.display = "none";
		} else {
			this.placeholderEl.style.display = "none";
			this.tagsContainer.style.display = "flex";

			const displayCount = Math.min(selectedArray.length, this.maxDisplayTags);

			for (let i = 0; i < displayCount; i++) {
				const value = selectedArray[i];
				const opt = this.options.find((option) => {
					if (typeof option === "object") {
						return option.value === value;
					}
					return option === value;
				});
				const tag = this.createTag(
					value,
					opt
						? typeof opt === "object"
							? opt?.label
								? opt.label
								: opt.value
							: opt
						: value
				);
				this.tagsContainer.appendChild(tag);
			}

			if (selectedArray.length > this.maxDisplayTags) {
				const moreTag = document.createElement("span");
				moreTag.className = "frappe-multiselect-tag frappe-multiselect-tag-more";
				moreTag.textContent = `+${selectedArray.length - this.maxDisplayTags} more`;
				this.tagsContainer.appendChild(moreTag);
			}
		}
	}

	createTag(value, label) {
		const tag = document.createElement("span");
		tag.className = "frappe-multiselect-tag";
		tag.setAttribute("data-value", value);

		const tagLabel = document.createElement("span");
		tagLabel.className = "frappe-multiselect-tag-label";
		tagLabel.textContent = label;

		const removeBtn = document.createElement("span");
		removeBtn.className = "frappe-multiselect-tag-remove";
		removeBtn.innerHTML = "&times;";

		tag.appendChild(tagLabel);
		tag.appendChild(removeBtn);

		return tag;
	}

	fetchOptionsDebounced = frappe.utils.debounce(() => this.fetchOptions(), 1000);

	bindEvents() {
		this.selectionArea.addEventListener("click", (e) => {
			if (e.target.closest(".frappe-multiselect-tag-remove")) {
				const tag = e.target.closest(".frappe-multiselect-tag");
				const value = tag.getAttribute("data-value");
				this.deselectValue(value);
				return;
			}
			if (!this.options?.length) {
				this.fetchOptionsDebounced();
			}
			this.toggle();
		});

		this.dropdown.addEventListener("click", (e) => e.stopPropagation());

		this.optionsList.addEventListener("click", (e) => {
			const optionEl = e.target.closest(".frappe-multiselect-option");
			if (optionEl) {
				const value = optionEl.getAttribute("data-value");
				this.toggleValue(value);
			}
		});

		this.searchInput.addEventListener("input", (e) => {
			this.searchTerm = e.target.value;
			this.fetchOptionsDebounced();
		});

		this.searchInput.addEventListener("click", (e) => e.stopPropagation());

		this.selectAllBtn.addEventListener("click", (e) => {
			this.selectAll();
		});

		this.clearAllBtn.addEventListener("click", (e) => {
			this.clearAll();
		});

		document.addEventListener("click", (e) => {
			if (!this.wrapper.contains(e.target)) this.close();
		});
	}

	toggle() {
		this.isOpen ? this.close() : this.open();
	}

	open() {
		this.isOpen = true;
		this.dropdown.classList.add("open");
		this.searchInput.focus();
		this.renderOptions();
	}

	close() {
		this.isOpen = false;
		this.dropdown.classList.remove("open");
		this.searchInput.value = "";
		this.searchTerm = "";
	}

	toggleValue(value) {
		this.selectedValues.has(value) ? this.deselectValue(value) : this.selectValue(value);
	}

	selectValue(value) {
		this.selectedValues.add(value);
		this.updateDisplay();
		this.renderOptions();
		this.syncToFrappe();
	}

	deselectValue(value) {
		this.selectedValues.delete(value);
		this.updateDisplay();
		this.renderOptions();
		this.syncToFrappe();
	}

	selectAll() {
		this.getFilteredOptions().forEach((option) => {
			const value = typeof option === "object" ? option.value : option;
			this.selectedValues.add(value);
		});
		this.updateDisplay();
		this.renderOptions();
		this.syncToFrappe();
	}

	clearAll() {
		this.selectedValues.clear();
		this.updateDisplay();
		this.renderOptions();
		this.syncToFrappe();
	}

	// Sync value back to Frappe form
	syncToFrappe() {
		const childTableValue = this.getChildTableValue();

		if (this.frm) {
			this.frm.doc[this.fieldname] = childTableValue;
		}

		// Trigger field's change event if defined
		if (this.df.change) {
			this.df.change(childTableValue);
		}

		// Dispatch custom event
		const event = new CustomEvent("change", {
			detail: { value: childTableValue, fieldname: this.fieldname },
		});
		this.wrapper.dispatchEvent(event);
	}

	getValue() {
		return Array.from(this.selectedValues);
	}

	setValue(values) {
		this.selectedValues = new Set(this.normalizeValues(values));
		this.updateDisplay();
		this.renderOptions();
	}

	refresh() {
		this.fetchOptions();
	}

	injectStyles() {
		if (document.getElementById("frappe-multiselect-styles")) return;

		const styles = document.createElement("style");
		styles.id = "frappe-multiselect-styles";
		styles.textContent = `
            .frappe-multiselect-wrapper {
                position: relative;
                font-size: var(--text-md);
				margin-bottom: 8px;
            }
            .frappe-multiselect {
                position: relative;
                outline: none;
            }
            .frappe-multiselect-selection {
                display: flex;
                align-items: center;
                padding: 4px 32px 4px 10px;
                border: 1px solid #dcdcdc;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                transition: border-color 0.15s, box-shadow 0.15s;
                position: relative;
            }
            .frappe-multiselect-placeholder {
                color: #8d99a6;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
            }
            .frappe-multiselect-tags {
                display: flex;
                flex-wrap: nowrap;
                gap: 4px;
				flex: 1;
				overflow: hidden;
            }
            .frappe-multiselect-tag {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                background: #F8F8F8;
                color: var(--text-color, #333);
                border-radius: var(--border-radius-sm, 4px);
                font-size: var(--text-sm, 12px);
                max-width: 120px;
            }
            .frappe-multiselect-tag-label {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .frappe-multiselect-tag-remove {
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
                opacity: 0.7;
            }
            .frappe-multiselect-tag-remove:hover {
                opacity: 1;
            }
            .frappe-multiselect-tag-more {
                background: var(--bg-light-gray, #f0f0f0);
                color: var(--text-muted, #666);
				white-space: nowrap;
            }
            .frappe-multiselect-arrow {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted, #8d99a6);
                transition: transform 0.2s;
            }
            .frappe-multiselect-arrow.open {
                transform: translateY(-50%) rotate(180deg);
            }
            .frappe-multiselect-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                margin-top: 4px;
                background: var(--fg-color, #fff);
                border: 1px solid var(--border-color, #d1d8dd);
                border-radius: var(--border-radius, 6px);
                box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-8px);
                transition: all 0.15s;
            }
            .frappe-multiselect-dropdown.open {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            .frappe-multiselect-search-wrapper {
                padding: 8px;
                border-bottom: 1px solid var(--border-color, #d1d8dd);
            }
            .frappe-multiselect-search {
                width: 100%;
                padding: 6px 10px;
                border: 1px solid var(--border-color, #d1d8dd);
                border-radius: var(--border-radius-sm, 4px);
                font-size: var(--text-md, 13px);
                outline: none;
            }
            .frappe-multiselect-search:focus {
                border-color: var(--primary, #2490ef);
            }
            .frappe-multiselect-loading {
                padding: 16px;
                text-align: center;
                color: var(--text-muted, #8d99a6);
            }
            .frappe-multiselect-loading .loading-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid var(--border-color, #d1d8dd);
                border-top-color: var(--primary, #2490ef);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .frappe-multiselect-options {
                max-height: 200px;
                overflow-y: auto;
				overflow-x: hidden;
				white-space: wrap;
                padding: 4px 0;
            }
            .frappe-multiselect-option {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                cursor: pointer;
                transition: background 0.1s;
            }
            .frappe-multiselect-option:hover {
                background: var(--bg-light-gray, #f5f7fa);
            }
            .frappe-multiselect-option.selected {
                background: #F8F8F8;
            }
            .frappe-multiselect-option.selected:hover {
                background: var(--bg-blue, #d4ebfc);
            }
            .frappe-multiselect-checkbox {
                width: 16px;
                height: 16px;
                border: 2px solid var(--border-color, #d1d8dd);
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.15s;
            }
            .frappe-multiselect-checkbox.checked {
                background: var(--primary, #2490ef);
                border-color: var(--primary, #2490ef);
            }
            .frappe-multiselect-option-label {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .frappe-multiselect-no-results {
                padding: 16px;
                text-align: center;
                color: var(--text-muted, #8d99a6);
            }
            .frappe-multiselect-actions {
                display: flex;
                gap: 8px;
                padding: 8px;
                border-top: 1px solid var(--border-color, #d1d8dd);
            }
            .frappe-multiselect-actions .btn {
                flex: 1;
            }
        `;
		document.head.appendChild(styles);
	}
}
