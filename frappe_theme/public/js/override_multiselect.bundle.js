frappe.ui.form.ControlTableMultiSelect = class DashboardControlTableMultiSelect extends (
    frappe.ui.form.ControlTableMultiSelect
) {
    get_link_field() {
		if (!this._link_field) {
			const meta = frappe.get_meta(this.df.options);
			this._link_field =
				meta?.fields?.find((df) => df.fieldtype === "Link") ||
				this.df?.fields?.find((df) => df.fieldtype === "Link");
			if (!this._link_field) {
				throw new Error("Table MultiSelect requires a Table with atleast one Link field");
			}
		}
		return this._link_field;
	}
    make_input() {
        super.make_input();

        // Make input invisible but keep it functional for awesomplete
        this.$input.css({
            position: 'absolute',
            left: '-9999px',
            opacity: '0',
            width: '1px',
            height: '1px'
        });

        // Style the input area to be clickable
        this.$input_area.css({
            cursor: 'pointer',
            'border-radius': '8px',
            padding: '3px',
            'min-height': '32px',
            display: 'flex',
            'align-items': 'center',
            'flex-wrap': 'wrap',
            gap: '1px'
        });

        // Click input area to open dropdown
        const me = this;
        this.$input_area.on('click', function (e) {
            if (!$(e.target).closest('.btn-remove').length) {
                me.$input.val('');
                me.$input.focus();
                setTimeout(() => {
                    if (me.awesomplete) {
                        me.awesomplete.evaluate();
                    }
                }, 50);
            }
        });

        // Enhance dropdown
        if (this.awesomplete) {
            this.customize_awesomplete_display();
            this.setup_click_outside_handler();
        }
    }

    // Do not hide already-selected items; allow re-select to toggle
    custom_awesomplete_filter(awesomplete) {
        let me = this;
        awesomplete.filter = function (item) {
            // Don't filter here; rely on API search to provide filtered results
            return true;
        };
    }

    setup_click_outside_handler() {
        const me = this;
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.awesomplete').length && !$(e.target).closest(me.$input_area).length) {
                if (me.awesomplete && me.awesomplete.container) {
                    me.awesomplete.container.querySelector('.dropdown-search-input')?.remove();
                    me.awesomplete.close();
                }
            }
        });
        this.$input.on('blur', () => {
            if (me.awesomplete) me.awesomplete.close();
        });
    }

    customize_awesomplete_display() {
        if (!this.awesomplete) return;

        const original_item = this.awesomplete.item;
        const original_open = this.awesomplete.open;
        const original_close = this.awesomplete.close;
        const original_evaluate = this.awesomplete.evaluate;
        const original_select = this.awesomplete.select;
        const me = this;
        me.df.only_select = true;

        let searchInputElement = null;
        let searchContainer = null;
        let isEvaluating = false;
        let evaluateTimeout = null;

        // Toggle on re-select
        this.awesomplete.select = function (selected, callback) {
            console.log('select called....')
            if (selected && selected.querySelector('#is_no_data_found')) {
                this.close();
                return false;
            }
            if (selected && selected.value && me._rows_list && me._rows_list.includes(selected.value)) {
                me.remove_selected_value(selected.value);
                this.close();
                return false;
            }
            return original_select.call(this, selected, callback);
        };

        // Keep sticky search and filter out create/advanced options
        this.awesomplete.evaluate = function () {
            console.log('evaluluate called...')
            // Debounce evaluate calls to prevent infinite loop in dialog context
            if (evaluateTimeout) {
                clearTimeout(evaluateTimeout);
            }
            evaluateTimeout = setTimeout(() => {
                if (isEvaluating) {
                    evaluateTimeout = null;
                    return;
                }
                isEvaluating = true;
                try {
                    const existingContainer = this.container ? this.container.querySelector('.dropdown-search-input') : null;
                    original_evaluate.call(this);
                    // Remove hidden items from DOM
                    if (this.container) {
                        this.container.querySelectorAll('li[style*="display: none"]').forEach(li => li.remove());
                    }
                    if (existingContainer && this.container && !this.container.querySelector('.dropdown-search-input')) {
                        this.container.insertBefore(searchContainer, this.container.firstChild);
                    }
                } finally {
                    isEvaluating = false;
                    evaluateTimeout = null;
                }
            }, 500);
        };

        // Add sticky search input
        this.awesomplete.open = function () {
            console.log('open called...')
            original_open.call(this);
            // Remove hidden items from DOM
            if (this.container) {
                this.container.querySelectorAll('li[style*="display: none"]').forEach(li => li.remove());
            }

            if (!searchContainer) {
                searchContainer = document.createElement('li');
                searchContainer.className = 'dropdown-search-input';
                searchContainer.style.cssText = 'position: sticky; top: 0; background: white; z-index: 10; padding: 8px; border-bottom: 1px solid #d1d8dd; margin: 0; list-style: none;';

                searchInputElement = document.createElement('input');
                searchInputElement.type = 'text';
                searchInputElement.placeholder = 'Search...';
                searchInputElement.className = 'form-control';
                searchInputElement.style.cssText = 'width:100%;padding:8px;margin:0;border:1px solid #d1d8dd;border-radius:3px;font-size:13px;font-family:inherit;color:#333;background:white;box-sizing:border-box;';
                
                // Create debounced search function
                const debouncedSearch = frappe.utils.debounce(async function(term) {
                    const doctype = me.get_options();
                    if (!doctype) return;
                    if (!me.$input.cache) me.$input.cache = {};
                    if (!me.$input.cache[doctype]) me.$input.cache[doctype] = {};

                    if (me.$input.cache[doctype][term] != null) {
                        me.awesomplete.list = me.$input.cache[doctype][term];
                        // Don't call evaluate - just update list
                        return;
                    }

                    const args = {
                        txt: term,
                        doctype: doctype,
                        ignore_user_permissions: me.df.ignore_user_permissions,
                        reference_doctype: me.get_reference_doctype() || "",
                        page_length: cint(frappe.boot.sysdefaults?.link_field_results_limit) || 10,
                    };
                    me.set_custom_query(args);

                    try {
                        const r = await frappe.call({
                            type: "POST",
                            method: "frappe.desk.search.search_link",
                            no_spinner: true,
                            args: args,
                        });
                        
                        if (r.message.length > 0) {
                            r.message = me.merge_duplicates(r.message);
                            let filter_string = me.df.filter_description
                                ? me.df.filter_description
                                : args.filters ? me.get_filter_description(args.filters) : null;
                            if (filter_string) {
                                r.message.push({
                                    html: `<span class="text-muted" style="line-height: 1.5">${filter_string}</span>`,
                                    value: "",
                                    action: () => { },
                                });
                            }
                            me.$input.cache[doctype][term] = r.message;
                            me.awesomplete.list = me.$input.cache[doctype][term];
                            r.message.forEach((item) => {
                                frappe.utils.add_link_title(doctype, item.value, item.label);
                            });
                            // Don't call evaluate - just update list
                        }else{
                            r.message = [];
                            r.message.push({
                                label: "HTML",
                                value: `<span class="text-muted" style="line-height: 1.5">No results found</span>`,
                                action: () => {

                                },
                            });
                            me.$input.cache[doctype][term] = r.message;
                            me.awesomplete.list = me.$input.cache[doctype][term];
                            // Don't call evaluate - just update list
                        }
                    } catch (error) {
                        console.error('Search error:', error);
                    }
                }, 500);

                searchInputElement.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const term = e.target.value || '';
                    debouncedSearch(term);
                });
                searchInputElement.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); e.stopPropagation(); });
                searchInputElement.addEventListener('click', (e) => e.stopPropagation());
                searchContainer.appendChild(searchInputElement);
            }

            if (!this.container.querySelector('.dropdown-search-input')) {
                this.container.insertBefore(searchContainer, this.container.firstChild);
            }

            setTimeout(() => { if (searchInputElement) searchInputElement.focus(); }, 50);
        };

        this.awesomplete.close = function () {
            console.log('close called...')
            if (searchInputElement) searchInputElement.value = '';
            original_close.call(this);
        };

        // Checkbox and highlight for selected
        this.awesomplete.item = function (option, input, item_id) {
            console.log('item called...')
            let text = option;
            const html = original_item.call(this, text, input, item_id);
            const $html = $(html);
            const is_selected = me._rows_list && me._rows_list.includes(option.value);
            $html.attr('aria-selected', is_selected ? 'true' : 'false');
            $html.empty();
            if (option.label == "HTML") {
                option['html'] = option.value;
                option['value'] = "";
            }
            const content = `
				<div style="display:flex;align-items:center;gap:8px;">
					${option?.value ? `<input type="checkbox" ${is_selected ? 'checked' : ''} disabled style="margin:0;pointer-events:none;flex-shrink:0;"/>` : ''}
					<div style="display:flex;flex-direction:column;">
                        ${option?.html ? `<div id="is_no_data_found">${option.html}</div>` 
                        : 
                        `
                            ${option.label ? `<span>${option?.label}</span>` : `<span>${option?.value}</span>`}
                            <div style="font-size: 0.9em; color: #666; display: flex; gap: 3px;">
                                ${option?.label ? `<span>${option?.value}</span>` : ''}
                                ${option?.description ? `, <span>${option?.description}</span>` : ''}
                            </div>
                        `
                        }
                    </div>
				</div>`;
            $html.html(content);
            if (is_selected) {
                $html.css({ 'background-color': frappe.boot.my_theme.navbar_color ? frappe.utils.get_lighter_shade_of_hex_color(frappe.boot.my_theme.navbar_color, 95) : '#4caf50', 'border-left': `3px solid ${frappe.boot.my_theme.navbar_color || '#4caf50'}` });
            }else{
                $html.css({ 'background-color': 'inherit'});
            }
            return $html[0];
        };
    }

    remove_selected_value(value) {
        let current_value = this.get_value();
        if (!Array.isArray(current_value)) current_value = [];
        const filtered = current_value.filter(item => {
            const v = typeof item === 'object' ? item.value || item.name : item;
            return v !== value;
        });
        this.set_value(filtered);
    }

    // Toggle behavior: re-select removes
    parse(value, label) {
        const link_field = this.get_link_field();
        if (value && this._rows_list && this._rows_list.includes(value)) {
            this.rows = (this.rows || []).filter(row => row[link_field.fieldname] !== value);
            this._rows_list = this.rows.map(row => row[link_field.fieldname]);
            this.set_pill_html(this._rows_list);
            console.log('closed from this.awesomplete 1')
            if (this.awesomplete) { this.awesomplete.close(); this.awesomplete.evaluate(); }
            return this.rows;
        }
        const result = super.parse(value, label);
        console.log('closed from this.awesomplete result',result)
        if (this.awesomplete) { this.awesomplete.close(); this.awesomplete.evaluate(); }
        return result;
    }

    // Compact pills: first + count
    set_pill_html(values) {
        this.$input_area.find('.tb-selected-value').remove();
        if (!values || values.length === 0) return;
        let html = '';
        if (values.length) {
            const link_field = this.get_link_field();
            const first_value = values[0];
            const pill_name = frappe.utils.get_link_title(link_field.options, first_value) || first_value;
            const additional_count = values.length - 1;
            html = `<button style="width: 100%;" class="data-pill btn tb-selected-value">
						<span class="">${__(frappe.utils.escape_html(pill_name))} ${additional_count > 0 ? `<span style="margin-left: 5px; padding: 2px 5px;font-size: 12px; border-radius: 10px; background-color : ${frappe.boot?.my_theme.navbar_color || '#4caf50'};color: ${frappe.boot?.my_theme?.navbar_text_color || 'white'};">+${additional_count}</span>` : ''}</span>
					</button>`;
        }
        this.$input_area.prepend(html);
    }
}

