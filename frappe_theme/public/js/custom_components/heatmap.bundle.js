class SVAHeatmap {
    constructor(opts) {
        this.reportName = opts.report || '';
        this.wrapper = opts.wrapper;
        this.stateGeoJsonUrl = '/assets/frappe_theme/boundaries/state_boundries.json';
        this.districtGeoJsonUrl = '/assets/frappe_theme/boundaries/districts_boundaries.json';
        this.defaultView = opts.default_view || 'State';
        this.blockHeight = opts.block_height || 280;

        this.map = null;
        this.stateLayer = null;
        this.districtLayer = null;
        this.mapId = 'map-' + frappe.utils.get_random(8);
        this.isLoading = true;
        this.primaryTargetField = opts.primary_target;
        this.targetFields = JSON.parse(opts.target_fields || '[]')?.filter((field) => field.fieldname !== this.primaryTargetField);
        this.stateField = opts.stateField;
        this.districtField = opts.districtField;
        this.isLoadingDistricts = null;

        this.highNumberCode = opts.max_data_color || '#800026';  // Default red
        this.lowNumberCode = opts.min_data_color || '#FFEDA0';    // Default yellow

        // Add custom CSS for fixed popup
        const style = document.createElement('style');
        style.textContent = `
            .fixed-popup-container {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 1000;
                background: white;
                padding: 8px 15px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background-color:#F2F2F3;
                display: none;
            }
            .legend-container {
                position: absolute;
                bottom: 18px;
                right: 10px;
                z-index: 1000;
                background: white;
                padding: 6px 8px;
                border-radius: 4px;
                border: 1px solid #ccc;
                font-size: 11px;
                min-width: 120px;
            }
            .legend-item {
                display: flex;
                align-items: center;
                margin: 2px 0;
                white-space: nowrap;
            }
            .legend-color {
                width: 8px;
                height: 8px;
                margin-right: 6px;
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);

        this.init();
    }

    init() {
        if (!this.wrapper) {
            console.error('No wrapper element provided');
            return;
        }
        this.mapContainer = $('<div>')
            .attr('id', this.mapId)
            .css({
                height: `${this.blockHeight}px`,
                width: '100%',
                position: 'relative',
                margin: '0 auto',
                backgroundColor: '#fff'
            });

        // Add title container
        this.titleContainer = $('<div>')
            .css({
                position: 'absolute',
                top: '10px',
                left: '0%',
                zIndex: 1000,
                backgroundColor: '#fff',
                fontWeight: 'bold',
                fontSize: '14px'
            });

        this.mapContainer.append(this.titleContainer);

        // Add fullscreen button
        this.fullscreenButton = $('<button class="btn btn-secondary btn-sm" title="Toggle Fullscreen">')
            .html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen" viewBox="0 0 16 16">
                    <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                </svg>`)
            .css({
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                padding: '4px 6px',
                backgroundColor: '#fff',
                border: 'none',
                cursor: 'pointer'
            })
            .on('click', () => this.toggleFullscreen());

        this.mapContainer.append(this.fullscreenButton);

        this.resetButton = $('<button class="btn btn-secondary btn-sm" title="Reset to Country View">')
            .html(`<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1">
                    <circle cx="12" cy="12" r="10"></circle><polyline points="12 8 8 12 12 16">
                    </polyline><line x1="16" y1="12" x2="8" y2="12"></line>
                </svg>`)
            .css({
                position: 'absolute',
                top: '10px',
                right: '75px',
                zIndex: 1000,
                padding: '4px 6px',
                backgroundColor: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'none'
            })
            .on('click', () => this.resetToCountryView());

        // Add refresh button
        this.refreshButton = $('<button class="btn btn-secondary btn-sm" title="Refresh Data">')
            .html('<svg class="icon icon-sm"><use href="#icon-refresh"></use></svg>')
            .css({
                position: 'absolute',
                top: '10px',
                right: '45px',
                zIndex: 1000,
                padding: '4px 6px',
                backgroundColor: '#fff',
                border: 'none',
                cursor: 'pointer'
            })
            .on('click', () => this.refreshData());

        this.mapContainer.append(this.refreshButton);
        this.mapContainer.append(this.resetButton);
        this.loader = $('<div>')
            .addClass('map-loader')
            .css({
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            })
            .html(`
                <div class="loading-indicator text-muted">
                    <i class="fa fa-spinner fa-pulse fa-2x"></i>
                </div>
                <div class="text-muted mt-2">Loading map data...</div>
            `);

        this.mapContainer.append(this.loader);

        // Add fixed popup container
        this.fixedPopupContainer = $('<div>')
            .addClass('fixed-popup-container')
            .appendTo(this.mapContainer);

        this.wrapper.html(this.mapContainer);

        setTimeout(() => {
            this.render();
            this.fetchData();
        }, 0);
    }

    render() {
        if (!document.getElementById(this.mapId)) return;

        try {
            this.map = L.map(this.mapId, {
                zoomControl: false,
                doubleClickZoom: false,
                scrollWheelZoom: false,
                touchZoom: false,
                boxZoom: false,
                keyboard: false,
                dragging: false,
            }).setView([22.5937, 78.9629], 5);
            if (this.defaultView == "State") {
                this.loadStates();
            } else {
                this.loadDistricts();
            }

            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
            }, 100);
        } catch (error) {
            $(this.wrapper).html('<div class="alert alert-danger">Failed to initialize map.</div>');
        }
    }

    fetchData() {
        if (!this.reportName) {
            this.hideLoader();
            return;
        }

        frappe.call({
            method: 'frappe.desk.query_report.run',
            args: {
                report_name: this.reportName,
                filters: this.filters
            },
            callback: (r) => {
                if (r.message) {
                    this.reportData = r.message;
                    // Update title with report name
                    this.titleContainer.text(this.reportName);

                    const hasStateColumn = this.reportData.columns.some(col => col.options === 'State');
                    if (!this.stateField && hasStateColumn) {
                        this.stateField = this.reportData.columns.find(col => col.options === 'State').fieldname;
                    }
                    const hasDistrictColumn = this.reportData.columns.some(col => col.options === 'District');
                    if (!this.districtField && hasDistrictColumn) {
                        this.districtField = this.reportData.columns.find(col => col.options === 'District').fieldname;
                    }
                    if (hasStateColumn) {
                        this.applyDataToMap();
                    } else {
                        this.hideLoader();
                        $(this.wrapper).html('<div class="alert alert-warning">Report does not have a State column.</div>');
                    }

                    if (hasDistrictColumn) {
                        this.hasDistrictColumn = true;
                    } else {
                        this.hasDistrictColumn = false;
                    }
                }
                this.hideLoader();
            },
            error: () => this.hideLoader()
        });
    }

    hideLoader() {
        if (this.isLoading && this.loader) {
            this.isLoading = false;
            this.loader.remove();
        }
    }

    applyDataToMap() {
        if (!this.reportData || !this.stateLayer) return;

        this.stateData = {};
        this.reportData.result.forEach(row => {
            const stateId = row[this.stateField];
            if (!this.stateData[stateId]) {
                this.stateData[stateId] = {
                    data: { ...row },  // Create a copy of the row data
                    count: row[this.primaryTargetField],
                    id: stateId
                };
            } else {
                this.stateData[stateId].count += row[this.primaryTargetField];
                // Merge the data for additional fields
                this.targetFields.forEach(field => {
                    const fieldname = field.fieldname;
                    if (typeof row[fieldname] === 'number') {
                        this.stateData[stateId].data[fieldname] = 
                            (this.stateData[stateId].data[fieldname] || 0) + row[fieldname];
                    } else {
                        this.stateData[stateId].data[fieldname] = row[fieldname];
                    }
                });
            }
        });

        // After processing data, create legend
        const range = this.calculateDataRange(this.stateData);
        this.createLegend(range);

        this.stateLayer.eachLayer(layer => {
            const stateID = layer.feature.properties.id;
            const data = this.stateData[stateID];
            if (data) {
                layer.setStyle({
                    fillColor: this.getColorByValue(data.count),
                    fillOpacity: 0.7
                });
            }
        });
    }

    // Add new method to calculate range and steps
    calculateDataRange(data) {
        let values = Object.values(data).map(item => item.count || 0);
        return {
            min: isNaN(Math.min(...values)) ? 0 : Math.min(...values),
            max: isNaN(Math.max(...values)) ? 0 : Math.max(...values)
        };
    }

    // Add new method to create legend
    createLegend(range) {
        if (!range || typeof range.min === 'undefined') return;

        // Remove existing legend if any
        $(this.mapContainer).find('.legend-container').remove();

        const legendContainer = $('<div>')
            .addClass('legend-container')
            .appendTo(this.mapContainer);

        // Get the column details for primaryTargetField
        const column = this.reportData?.columns.find(
            (column) => column.fieldname === this.primaryTargetField
        );
        
        const legendTitle = column?.label || 'Count';
        
        $('<div>')
            .text(legendTitle)
            .css({
                'font-weight': 'bold',
                'margin-bottom': '4px'
            })
            .appendTo(legendContainer);

        // Calculate breaks
        const breaks = this.calculateBreaks(range.min, range.max);
        
        // Create legend items
        breaks.forEach((break_, index) => {
            const nextBreak = breaks[index + 1];
            if (nextBreak) {
                const color = this.getColorByValue((break_ + nextBreak) / 2);
                const legendItem = $('<div>').addClass('legend-item');
                
                $('<div>')
                    .addClass('legend-color')
                    .css('background-color', color)
                    .appendTo(legendItem);
                
                // Format the numbers based on fieldtype
                let formattedBreak = break_;
                let formattedNextBreak = nextBreak;
                
                if (column?.fieldtype === 'Currency') {
                    formattedBreak = frappe.utils.format_currency(break_, column.options);
                    formattedNextBreak = frappe.utils.format_currency(nextBreak, column.options);
                } else {
                    formattedBreak = frappe.utils.shorten_number(break_, frappe.sys_defaults.country);
                    formattedNextBreak = frappe.utils.shorten_number(nextBreak, frappe.sys_defaults.country);
                }
                
                const rangeText = index === breaks.length - 2 
                    ? `${formattedBreak} And Above`
                    : `${formattedBreak} - ${formattedNextBreak}`;
                
                $('<div>')
                    .text(rangeText)
                    .appendTo(legendItem);
                
                legendItem.appendTo(legendContainer);
            }
        });
    }

    // Update calculateBreaks method
    calculateBreaks(min, max) {
        let breaks = [];
        
        // Always start from 0
        const actualMax = Math.ceil(max);
        
        // We want 5 breaks (which creates 4 ranges)
        if (actualMax <= 50) {
            // For small numbers (≤50), use smart rounding
            const step = Math.ceil(actualMax / 4); // 4 segments = 5 breaks
            for (let i = 0; i <= 4; i++) {
                breaks.push(Math.min(i * step, actualMax));
            }
        } else {
            // For larger numbers, round to nearest 10
            const step = Math.ceil(actualMax / 40) * 10; // Round to nearest 10
            for (let i = 0; i <= 4; i++) {
                breaks.push(Math.min(i * step, actualMax));
            }
        }
        
        // Ensure the last break is the maximum value
        if (breaks[breaks.length - 1] < actualMax) {
            breaks[breaks.length - 1] = actualMax;
        }
        
        return breaks;
    }

    // Update color scale to use dynamic high/low colors
    getColorByValue(value) {
        const data = this.defaultView === 'State' ? this.stateData : this.districtData;
        const range = this.calculateDataRange(data);
        
        if (!range || typeof range.min === 'undefined') {
            return this.lowNumberCode;
        }

        const percentage = (value - range.min) / (range.max - range.min);
        
        // Convert hex colors to RGB for interpolation
        const lowRGB = this.hexToRGB(this.lowNumberCode);
        const highRGB = this.hexToRGB(this.highNumberCode);
        
        // Interpolate between colors
        const resultRGB = {
            r: Math.round(lowRGB.r + (highRGB.r - lowRGB.r) * percentage),
            g: Math.round(lowRGB.g + (highRGB.g - lowRGB.g) * percentage),
            b: Math.round(lowRGB.b + (highRGB.b - lowRGB.b) * percentage)
        };

        return `rgb(${resultRGB.r}, ${resultRGB.g}, ${resultRGB.b})`;
    }

    // Helper function to convert hex to RGB
    hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    loadStates() {
        fetch(this.stateGeoJsonUrl)
            .then(response => response.json())
            .then(data => {
                this.stateLayer = L.geoJSON(data, {
                    style: {
                        color: '#F2F2F3',
                        weight: 1,
                        fillOpacity: 0.7,
                    },
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            mouseover: (e) => {
                                const stateName = feature.properties.name;
                                const stateId = feature.properties.id;
                                const data = this.stateData?.[stateId] || { count: 0, data: {} };
                                
                                this.refreshButton.hide();
                                this.fixedPopupContainer
                                    .html(this.getPopupContent(stateName, data))
                                    .show();
                            },
                            mouseout: () => {
                                this.fixedPopupContainer.hide();
                                this.refreshButton.show();
                            },
                            click: this.onStateClick.bind(this)
                        });
                    }
                }).addTo(this.map);
                this.map.fitBounds(this.stateLayer.getBounds());
                if (this.reportData) {
                    this.applyDataToMap();
                }
                this.hideLoader();
            })
            .catch(error => {
                console.error('Error loading states:', error);
                this.hideLoader();
            });
    }

    onStateClick(e) {
        if (!this.hasDistrictColumn) return;

        const state = e.target.feature.properties;
        this.stateLayer.clearLayers();
        this.map.removeLayer(this.stateLayer);
        this.showDistrictLoader();
        this.loadDistricts(state.name);
    }

    showDistrictLoader() {
        this.districtLoader = $('<div>')
            .css({
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            })
            .html(`
                <div class="loading-indicator text-muted">
                    <i class="fa fa-spinner fa-pulse fa-2x"></i>
                </div>
                <div class="text-muted mt-2">Loading districts...</div>
            `)
            .appendTo(this.mapContainer);
    }

    loadDistricts(stateName = null) {
        if (this.defaultView == "State") {
            this.resetButton.show();
            this.refreshButton.hide();
            this.districtGeoJsonUrl = frappe.utils.get_district_json_route(stateName)
        } else {
            this.resetButton.hide();
            this.refreshButton.show();
        }
        fetch(this.districtGeoJsonUrl)
            .then(response => response.json())
            .then(data => {
                if (this.districtLayer) this.map.removeLayer(this.districtLayer);
                if (this.stateLayer) this.map.removeLayer(this.stateLayer);
                this.districtData = {};
                if (this.reportData?.result) {
                    this.reportData.result.forEach(row => {
                        if (row[this.districtField]) {
                            const districtName = String(row[this.districtField]).toUpperCase();
                            this.districtData[districtName] = {
                                data: row,  // Store the complete row data
                                count: this.districtData[districtName]
                                    ? this.districtData[districtName].count + row[this.primaryTargetField]
                                    : row[this.primaryTargetField],
                                id: districtName
                            };
                        }
                    });
                }
                const range = this.calculateDataRange(this.districtData);
                this.createLegend(range);
                this.districtLayer = L.geoJSON(data, {
                    style: {
                        color: '#F2F2F3',
                        weight: 1,
                        fillOpacity: 0.7
                    },
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            mouseover: (e) => {
                                const districtID = feature.properties?.dt_code;
                                const districtName = feature.properties?.name
                                    ? String(feature.properties.name).toUpperCase()
                                    : 'Unknown District';
                                const data = this.districtData[districtID] || { count: 0, data: {} };
                                
                                this.refreshButton.hide();
                                this.fixedPopupContainer
                                    .html(this.getPopupContent(districtName, data))
                                    .show();
                            },
                            mouseout: () => {
                                this.fixedPopupContainer.hide();
                                this.refreshButton.show();
                            }
                        });

                        // Set initial color based on data
                        const districtID = feature.properties?.dt_code;
                        const data = this.districtData[districtID];
                        if (data) {
                            layer.setStyle({
                                fillColor: this.getColorByValue(data.count),
                                fillOpacity: 0.7
                            });
                        }
                    }
                }).addTo(this.map);

                this.map.fitBounds(this.districtLayer.getBounds());
                this.hideDistrictLoader();
            })
            .catch(error => {
                console.error('District load error:', error);
                this.hideDistrictLoader();
            });
    }

    hideDistrictLoader() {
        if (this.districtLoader) this.districtLoader.remove();
    }

    resetToCountryView() {
        this.refreshButton.show();
        this.resetButton.hide();
        if (this.districtLayer) {
            this.map.removeLayer(this.districtLayer);
            this.districtLayer = null;
        }

        if (!this.stateLayer) {
            this.loadStates();
        } else {
            this.map.addLayer(this.stateLayer);

            const bounds = this.stateLayer.getBounds();
            if (bounds && bounds.isValid()) {
                this.map.fitBounds(bounds);
            } else {
                console.warn("Invalid bounds, reinitializing country map");

                // Remove the current stateLayer
                this.map.removeLayer(this.stateLayer);
                this.stateLayer = null;

                // Reinitialize the country map
                this.loadStates();

                // You might need to add a slight delay to ensure the layer is loaded
                setTimeout(() => {
                    if (this.stateLayer && this.stateLayer.getBounds().isValid()) {
                        this.map.fitBounds(this.stateLayer.getBounds());
                    } else {
                        // Ultimate fallback if reinitialization fails
                        this.map.setView([37.8, -96], 4); // Example for US center
                    }
                }, 300);
            }
        }
    }

    // Add new method to refresh data
    refreshData() {
        this.showLoader();
        this.fetchData();
    }

    showLoader() {
        this.isLoading = true;
        if (!this.loader) {
            this.loader = $('<div>')
                .addClass('map-loader')
                .css({
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                })
                .html(`
                    <div class="loading-indicator text-muted">
                        <i class="fa fa-spinner fa-pulse fa-2x"></i>
                    </div>
                    <div class="text-muted mt-2">Loading map data...</div>
                `);
        }
        this.mapContainer.append(this.loader);
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.fixedPopupContainer?.remove();
        this.mapContainer?.remove();
    }

    // Add this new method for consistent popup configuration
    getPopupContent(name, data) {
        const column = this.reportData?.columns.find(
            (column) => column.fieldname === this.primaryTargetField
        );

        let additionalFields = '';
        if (this.targetFields?.length && data?.data) {
            additionalFields = this.targetFields
                .map(field => {
                    let value = data.data[field.fieldname];
                    if(value){
                        if (field.fieldtype === 'Currency') {
                            value = frappe.utils.format_currency(value, field.options);
                        }else{
                            value = frappe.utils.shorten_number(value, frappe.sys_defaults.country);
                        }
                    }
                    return value ? `<br/>${field?.label}: ${value}` : '';
                })
                .join('');
        }

        return `
            <div>
                <strong>${name}</strong><br/>
                ${column?.label || "Count"}: ${column.fieldtype == "Currency" ? frappe.utils.format_currency(data?.count || 0) : frappe.utils.shorten_number(data?.count || 0, frappe.sys_defaults.country)}
                ${additionalFields}
            </div>
        `;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.mapContainer[0].requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            this.fullscreenButton.html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen-exit" viewBox="0 0 16 16">
                    <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5m5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5M0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5m10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0z"/>
                </svg>`);
            this.titleContainer.css({
                'padding-left': '20px'
            });
            
            // Adjust map size
            if (this.map) {
                this.map.invalidateSize();
                setTimeout(() => {
                    if (this.stateLayer) {
                        this.map.fitBounds(this.stateLayer.getBounds());
                    } else if (this.districtLayer) {
                        this.map.fitBounds(this.districtLayer.getBounds());
                    }
                }, 100);
            }

            // Reset popup to original size
            this.fixedPopupContainer.css({
                'padding': '8px 15px',   // Original padding
                'font-size': '1em',      // Original font size
                'min-width': 'auto'      // Original width
            });
        } else {
            document.exitFullscreen();
            this.fullscreenButton.html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen" viewBox="0 0 16 16">
                <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
            </svg>`);
            
            // Reset styles
            this.mapContainer.css({
                'position': 'relative',
                'width': '100%',
                'height': `${this.blockHeight}px`,
                'z-index': 'auto'
            });
            this.titleContainer.css({
                'padding-left': '0px'
            });
            
            // Adjust map size
            if (this.map) {
                this.map.invalidateSize();
                setTimeout(() => {
                    if (this.stateLayer) {
                        this.map.fitBounds(this.stateLayer.getBounds());
                    } else if (this.districtLayer) {
                        this.map.fitBounds(this.districtLayer.getBounds());
                    }
                }, 100);
            }
        }
    }
}

export default SVAHeatmap;