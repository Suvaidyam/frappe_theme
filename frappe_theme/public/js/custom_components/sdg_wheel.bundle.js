frappe.provide("frappe.ui");
import Loader from "../loader-element.js";
import SvaDataTable from "../datatable/sva_datatable.bundle.js";

class SVASDGWheel {
	constructor({ wrapper, conf = {}, html_field = null, frm = null }) {
		this.wrapper = wrapper;
		this.conf = conf;
		this.report_name = conf.sdg_report;
		this.title = conf.label || this.report_name || null;
		this.html_field = html_field;
		this.block_height = conf.sdg_block_height;
		this.target_fields = JSON.parse(conf.sdg_target_fields || "[]");
		this.sdg_column_name = conf.sdg_name_column || "";
		this.sdg_data = this.get_sdg_data();
		this.frm = frm;
		this.selected_goals = [];
		this.filters = {};
		this.standard_filters = conf.standard_filters || {};
		this.prepared_data = {};
		this.columns = [];
		this.result = [];
		this.loader = null;
		this.init();
	}

	init() {
		this.setup_wrapper();
		this.fetch_data();
	}

	setup_wrapper() {
		this.$wrapper = $(this.wrapper);
		this.$wrapper.empty();

		this.$wrapper.css({
			border: "1px solid #dcdcdc",
			background: "#fff",
			position: "relative",
			height: `${this.block_height || 445}px`,
			borderRadius: "10px",
			padding: "10px",
		});

		// Add container with styles
		this.$wrapper.html(`
            <div class="sdg-wheel-container">
                <style>
                    .sdg-wheel-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                        gap: 10px;
                        width: 100%;
                        height: 9%;
                        margin-bottom: 2px;
                    }

                    .sdg-wheel-title {
                        font-weight: bold;
                        font-size: 14px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        flex: 1;
                        min-width: 0;
                    }

                    .sdg-wheel-title p {
                        margin: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .sdg-wheel-actions {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        flex-shrink: 0;
                    }

                    .sdg-wheel-container {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                    }

                    .sdg-wheel-wrapper {
                        width: 100%;
                        height: 95%;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .sdg-wheel-svg {
                        padding: 0px;
                        height: 100%;
                        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
                    }

                    .sdg-segment {
                        cursor: pointer;
                        transition: all 0.3s ease;
                        transform-origin: center;
                    }

                    .sdg-segment:hover {
                        opacity: 0.8;
                        filter: brightness(1.1);
                    }

                    .sdg-segment.selected {
                        filter: brightness(1.2) drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
                        stroke: #fff;
                        stroke-width: 3;
                    }

                    .sdg-segment.inactive {
                        opacity: 0.3;
                    }

                    .sdg-icon-image {
                        pointer-events: none;
                        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
                    }

                    .sdg-center-logo {
                        pointer-events: none;
                    }

                    .sdg-center {
                        pointer-events: none;
                    }

                    .sdg-tooltip {
                        position: absolute;
                        top: 50px;
                        right: 10px;
                        z-index: 1000;
                        background: white;
                        padding: 8px 15px;
                        border-radius: 4px;
                        border: 1px solid #ccc;
                        background-color: #F2F2F3;
                        display: none;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                        max-width: 250px;
                    }

                    .sdg-tooltip.show {
                        display: block;
                    }

                    .sdg-tooltip-title {
                        font-weight: 600;
                        margin-bottom: 2px;
                        font-size: 15px;
                    }

                    .sdg-tooltip-stats {
                        font-size: 12px;
                    }

                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }

                    .sdg-segment.pulse {
                        animation: pulse 1s ease-in-out;
                    }
                </style>
                <div class="sdg-wheel-wrapper"></div>
                <div class="sdg-tooltip"></div>
            </div>
        `);

		this.loader = $("<div>").addClass("map-loader").css({
			position: "absolute",
			top: "0",
			left: "0",
			right: "0",
			bottom: "0",
			zIndex: 1000,
			background: "rgba(255, 255, 255, 0.8)",
			display: "flex",
			borderRadius: "10px",
			alignItems: "center",
			justifyContent: "center",
			flexDirection: "column",
		}).html(`
            <div class="loading-indicator text-muted">
                <i class="fa fa-spinner fa-pulse fa-2x"></i>
            </div>
            <div class="text-muted mt-2">Loading SDG data...</div>
        `);

		this.$wrapper.append(this.loader);

		this.setup_controls();
	}

	setup_controls() {
		this.header_row = document.createElement("div");
		this.header_row.classList.add("sdg-wheel-header");
		this.$wrapper.find(".sdg-wheel-container").prepend(this.header_row);

		this.title_container = document.createElement("div");
		this.title_container.classList.add("sdg-wheel-title");
		this.title_container.setAttribute("title", this.title || "");
		this.title_container.innerHTML = `<p>${this.title || ""}</p>`;
		this.header_row.appendChild(this.title_container);

		this.actions_container = document.createElement("div");
		this.actions_container.classList.add("sdg-wheel-actions");
		this.header_row.appendChild(this.actions_container);

		// Refresh Button
		this.refreshButton = $('<button class="btn btn-secondary btn-sm" title="Refresh Data">')
			.html(
				'<svg width="16" height="16" class="icon icon-sm"><use href="#icon-refresh"></use></svg>'
			)
			.css({
				padding: "4px 6px",
				backgroundColor: "#fff",
				border: "none",
				cursor: "pointer",
			})
			.on("click", () => this.refresh());

		// Show Table Button
		this.showTableButton = $('<button class="btn btn-secondary btn-sm" title="View Table">')
			.html(
				`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9H21M3 15H21M9 9L9 20M15 9L15 20M6.2 20H17.8C18.9201 20 19.4802 20 19.908 19.782C20.2843 19.5903 20.5903 19.2843 20.782 18.908C21 18.4802 21 17.9201 21 16.8V7.2C21 6.0799 21 5.51984 20.782 5.09202C20.5903 4.71569 20.2843 4.40973 19.908 4.21799C19.4802 4 18.9201 4 17.8 4H6.2C5.0799 4 4.51984 4 4.09202 4.21799C3.71569 4.40973 3.40973 4.71569 3.21799 5.09202C3 5.51984 3 6.07989 3 7.2V16.8C3 17.9201 3 18.4802 3.21799 18.908C3.40973 19.2843 3.71569 19.5903 4.09202 19.782C4.51984 20 5.07989 20 6.2 20Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
			)
			.css({
				padding: "2px 3px",
				backgroundColor: "#fff",
				border: "none",
				cursor: "pointer",
			})
			.on("click", () => this.showDataTable());

		// Fullscreen Button
		this.fullscreenButton = $(
			'<button class="btn btn-secondary btn-sm" title="Toggle Fullscreen">'
		)
			.html(
				`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
            </svg>`
			)
			.css({
				padding: "4px 6px",
				backgroundColor: "#fff",
				border: "none",
				cursor: "pointer",
			})
			.on("click", () => this.toggleFullscreen());
		this.actions_container.appendChild(this.refreshButton[0]);
		this.actions_container.appendChild(this.fullscreenButton[0]);
		this.actions_container.appendChild(this.showTableButton[0]);
	}

	// Add method to update title dynamically
	setTitle(new_title) {
		if (this.title_container) {
			this.title = new_title;
			this.title_container.setAttribute("title", new_title);
			this.title_container.querySelector("p").textContent = new_title;
		}
	}

	toggleFullscreen() {
		if (!this.isFullscreen) {
			this.fullscreenButton
				.html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen-exit" viewBox="0 0 16 16">
                    <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5m5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5M0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5m10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0z"/>
                </svg>`);

			// add transition for smooth fullscreen
			this.$wrapper.css({
				position: "fixed",
				top: "0",
				left: "0",
				width: "100vw",
				height: "100vh",
				zIndex: "9999",
				transition: "all 0.3s ease-in-out",
			});
			this.$wrapper.find(".sdg-wheel-container").css({
				borderRadius: "0",
			});

			this.isFullscreen = true;
		} else {
			this.fullscreenButton
				.html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen" viewBox="0 0 16 16">
                <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
            </svg>`);

			// Reset styles
			this.$wrapper.css({
				position: "relative",
				width: "100%",
				height: `${this.block_height || 445}px`,
				"z-index": "auto",
				transition: "all 0.3s ease-in-out",
			});

			this.$wrapper.find(".sdg-wheel-container").css({
				borderRadius: "10px",
			});
			this.isFullscreen = false;
		}
	}

	async showDataTable() {
		const wrapper = document.createElement("div");
		let loader = new Loader(wrapper);
		loader.show();
		let table_options = {
			label: "",
			wrapper,
			doctype: "",
			frm: this.frm || cur_frm,
			connection: {
				crud_permissions: JSON.stringify(["read"]),
				link_report: this.report_name,
				connection_type: "Report",
			},
			childLinks: [],
			options: {
				serialNumberColumn: true,
				editable: false,
			},
			loader,
		};

		if (this.html_field) {
			table_options.connection["html_field"] = this.html_field;
			table_options.connection["configuration_basis"] = "Property Setter";
		}

		if (this.conf?.listview_settings) {
			table_options.connection["listview_settings"] = this.conf?.listview_settings;
		}

		let dialog = new frappe.ui.Dialog({
			title: this.report_name || "Data Table",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "data_table_html",
					options: `<div>Table Loading...</div>`,
				},
			],
			size: "extra-large",
			primary_action_label: "Close",
			primary_action: function () {
				dialog.hide();
			},
		});
		dialog.show();
		dialog.set_df_property("data_table_html", "options", wrapper);

		new SvaDataTable(table_options);

		if (this?.isFullscreen) {
			dialog.$wrapper.css("z-index", 10000);
		}
		dialog.on_hide = () => {
			dialog.$wrapper.css("z-index", "");
		};
	}

	refresh() {
		this.fetch_data();
	}

	setFilters(filters = {}) {
		this.filters = filters;
		this.fetch_data();
	}

	async fetch_data() {
		if (!this.report_name) {
			this.render();
			this.loader?.hide();
			return;
		}

		this.loader.show();
		let pre_filters = {};
		if (this.frm) {
			if (this.frm?.["dt_events"]?.[this?.html_field]?.get_filters) {
				let get_filters = this.frm?.["dt_events"]?.[this?.html_field]?.get_filters;
				pre_filters = (await get_filters(this.report_name, this.html_field)) || {};
			}
		}

		frappe.call({
			method: "frappe_theme.dt_api.get_dt_list",
			args: {
				doctype: this.report_name,
				doc: this.frm?.doc?.name,
				ref_doctype: this.frm?.doc?.doctype,
				filters: { ...this.standard_filters, ...this.filters, ...pre_filters },
				fields: ["*"],
				_type: "Report",
				return_columns: true,
			},
			callback: (r) => {
				if (r.message) {
					this.process_report_data(r.message);
					this.render();
				}
				this.loader?.hide();
			},
			error: (err) => {
				console.error("Error fetching SDG report data:", err);
				this.loader?.hide();
			}
		});
	}

	process_report_data(report_data) {
		this.columns = report_data?.columns;
		this.result = report_data?.result;
		// Initialize prepared data
		this.prepared_data = {};
		// Find SDG column
		const sdg_col = this.columns?.find(
			(col) => col.fieldname === this.sdg_column_name || col.options === "SDGs"
		);
		if (!sdg_col) {
			console.error("SDG column not found in report data");
			return;
		}
		if (!this.result || this.result.length === 0) {
			return;
		}
		// Helper function to get value from row
		const getRowValue = (row, column) => {
			if (Array.isArray(row)) {
				const index = this.columns.indexOf(column);
				return row[index];
			}
			return row[column.fieldname];
		};

		// Helper function to create target object
		const createTargetObject = (column, value) => ({
			...column,
			value: value,
		});

		// Process each row
		this.result.forEach((row) => {
			const sdg_value = getRowValue(row, sdg_col);

			if (!sdg_value) return;

			// Initialize SDG entry if not exists
			if (!this.prepared_data[sdg_value]) {
				this.prepared_data[sdg_value] = [];
			}

			// Process target fields if they exist
			if (this.target_fields && this.target_fields.length > 0) {
				this.target_fields.forEach((field) => {
					const target_col = this.columns?.find(
						(col) => col.fieldname === field.fieldname
					);

					if (!target_col) return;

					const value = getRowValue(row, target_col);
					const targetObject = createTargetObject(target_col, value);
					this.prepared_data[sdg_value].push(targetObject);
				});
			}
		});
	}

	get_sdg_data() {
		return [
			{
				number: 1,
				id: "Goal 1",
				old_name: "Goal 1: No Poverty",
				title: "No Poverty",
				color: "#E5243B",
			},
			{
				number: 2,
				id: "Goal 2",
				old_name: "Goal 2: Zero hunger (No hunger)",
				title: "Zero Hunger",
				color: "#DDA63A",
			},
			{
				number: 3,
				id: "Goal 3",
				old_name: "Goal 3: Good health and well-being",
				title: "Good Health",
				color: "#4C9F38",
			},
			{
				number: 4,
				id: "Goal 4",
				old_name: "Goal 4: Quality education",
				title: "Quality Education",
				color: "#C5192D",
			},
			{
				number: 5,
				id: "Goal 5",
				old_name: "Goal 5: Gender equality",
				title: "Gender Equality",
				color: "#FF3A21",
			},
			{
				number: 6,
				id: "Goal 6",
				old_name: "Goal 6: Clean water and sanitation",
				title: "Clean Water",
				color: "#26BDE2",
			},
			{
				number: 7,
				id: "Goal 7",
				old_name: "Goal 7: Affordable and clean energy",
				title: "Affordable Energy",
				color: "#FCC30B",
			},
			{
				number: 8,
				id: "Goal 8",
				old_name: "Goal 8: Decent work and economic growth",
				title: "Decent Work",
				color: "#A21942",
			},
			{
				number: 9,
				id: "Goal 9",
				old_name: "Goal 9: Industry, Innovation and Infrastructure",
				title: "Industry Innovation",
				color: "#FD6925",
			},
			{
				number: 10,
				id: "Goal 10",
				old_name: "Goal 10: Reduced inequality",
				title: "Reduced Inequalities",
				color: "#DD1367",
			},
			{
				number: 11,
				id: "Goal 11",
				old_name: "Goal 11: Sustainable cities and communities",
				title: "Sustainable Cities",
				color: "#FD9D24",
			},
			{
				number: 12,
				id: "Goal 12",
				old_name: "Goal 12: Responsible consumption and production",
				title: "Responsible Consumption",
				color: "#BF8B2E",
			},
			{
				number: 13,
				id: "Goal 13",
				old_name: "Goal 13: Climate action",
				title: "Climate Action",
				color: "#3F7E44",
			},
			{
				number: 14,
				id: "Goal 14",
				old_name: "Goal 14: Life below water",
				title: "Life Below Water",
				color: "#0A97D9",
			},
			{
				number: 15,
				id: "Goal 15",
				old_name: "Goal 15: Life on land",
				title: "Life on Land",
				color: "#56C02B",
			},
			{
				number: 16,
				id: "Goal 16",
				old_name: "Goal 16: Peace, justice and strong institutions",
				title: "Peace & Justice",
				color: "#00689D",
			},
			{
				number: 17,
				id: "Goal 17",
				old_name: "Goal 17: Partnerships for the goals",
				title: "Partnerships",
				color: "#19486A",
			},
		];
	}

	render() {
		const container = this.$wrapper.find(".sdg-wheel-wrapper");
		const size = 500;
		const centerX = size / 2;
		const centerY = size / 2;
		const outerRadius = 220;
		const innerRadius = 120;
		const segmentAngle = (2 * Math.PI) / this.sdg_data.length;

		let svg = `<svg class="sdg-wheel-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;

		// Draw segments
		this.sdg_data.forEach((goal, index) => {
			const startAngle = index * segmentAngle - Math.PI / 2;
			const endAngle = startAngle + segmentAngle;

			const x1 = centerX + innerRadius * Math.cos(startAngle);
			const y1 = centerY + innerRadius * Math.sin(startAngle);
			const x2 = centerX + outerRadius * Math.cos(startAngle);
			const y2 = centerY + outerRadius * Math.sin(startAngle);
			const x3 = centerX + outerRadius * Math.cos(endAngle);
			const y3 = centerY + outerRadius * Math.sin(endAngle);
			const x4 = centerX + innerRadius * Math.cos(endAngle);
			const y4 = centerY + innerRadius * Math.sin(endAngle);

			const largeArcFlag = segmentAngle > Math.PI ? 1 : 0;

			const path = `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1} Z`;

			svg += `<path class="sdg-segment inactive" data-goal="${goal.number}" d="${path}" fill="${goal.color}" />`;

			// Add icon - centered in the segment
			const iconAngle = startAngle + segmentAngle / 2;
			const iconRadius = (innerRadius + outerRadius) / 2;
			const iconSize = 50;

			// Calculate center position
			const iconCenterX = centerX + iconRadius * Math.cos(iconAngle);
			const iconCenterY = centerY + iconRadius * Math.sin(iconAngle);

			// Offset by half the icon size to center it
			const iconX = iconCenterX - iconSize / 2;
			const iconY = iconCenterY - iconSize / 2;

			// Add pointer-events="none" to allow mouse events to pass through to the segment
			svg += `<image class="sdg-icon-image" x="${iconX}" y="${iconY}" href="/assets/frappe_theme/images/sdg_icons/E-WEB-Goal-${goal.number}.png" height="${iconSize}" width="${iconSize}" pointer-events="none" />`;
		});

		// Center circle
		svg += `<circle class="sdg-center" cx="${centerX}" cy="${centerY}" r="${
			innerRadius - 5
		}" fill="white" />`;

		// Center logo - properly centered with pointer-events="none"
		const logoSize = 200;
		const logoX = centerX - logoSize / 2;
		const logoY = centerY - logoSize / 2;
		svg += `<image class="sdg-center-logo" href="/assets/frappe_theme/images/E_SDG_logo_Square_WEB.png" x="${logoX}" y="${logoY}" height="${logoSize}" width="${logoSize}" pointer-events="none" />`;

		svg += "</svg>";

		container.html(svg);
		this.setup_interactions();
	}

	setup_interactions() {
		const self = this;

		this.$wrapper.find(".sdg-segment").each(function () {
			const $segment = $(this);
			const goalNumber = parseInt($segment.data("goal"));
			const goal = self.sdg_data.find((g) => g.number === goalNumber);
			let target_data =
				self.prepared_data[goal.number] ||
				self.prepared_data[goal.id] ||
				self.prepared_data[goal.old_name] ||
				self.prepared_data[goal.title] ||
				null;

			if (target_data && target_data.length > 0) {
				$segment.removeClass("inactive");
			}

			$segment.on("mouseenter", function (e) {
				$segment.removeClass("inactive");
				$segment.addClass("selected pulse");
				self.show_tooltip(e, goal);
			});

			$segment.on("mouseleave", function () {
				self.hide_tooltip();
				$segment.removeClass("selected pulse");
				if (!target_data || target_data.length === 0) {
					$segment.addClass("inactive");
				}
			});
		});
	}

	show_tooltip(e, goal) {
		let target_data =
			this.prepared_data[goal.number] ||
			this.prepared_data[goal.id] ||
			this.prepared_data[goal.old_name] ||
			this.prepared_data[goal.title] ||
			null;
		const $tooltip = this.$wrapper.find(".sdg-tooltip");
		const content = `
            <div class="sdg-tooltip-title">SDG ${goal.number}: ${goal.title}</div>
            <hr style="margin:3px 0px;">
            <div class="sdg-tooltip-stats">
                ${
					target_data && target_data?.length
						? `
                    ${target_data
						.map(
							(target) => `
                        <div class="sdg-tooltip-stat">
                            <span class="sdg-tooltip-stat-label">${
								target?.label || target?.fieldname
							}:</span>
                            <span class="sdg-tooltip-stat-value">${this.get_formatted_value(
								target
							)}</span>
                        </div>
                    `
						)
						.join("")}
                `
						: `
                <div>No data available for this goal.</div>
                `
				}
            </div>
        `;

		$tooltip.html(content);
		$tooltip.addClass("show");
	}

	get_formatted_value(data) {
		switch (data?.fieldtype) {
			case "Currency":
				return frappe.utils.format_currency(data.value || 0);
			case "Float":
				return frappe.utils.shorten_number(
					data.value || 0,
					frappe.sys_defaults.country,
					null,
					data?.column?.precision || 2
				);
			case "Int":
				return frappe.utils.shorten_number(
					data.value || 0,
					frappe.sys_defaults.country,
					null,
					0
				);
			case "Percent":
				return `${format_number(data.value || 0, null, data?.column?.precision || 2)}%`;
			default:
				return frappe.utils.shorten_number(
					data.value || 0,
					frappe.sys_defaults.country,
					null,
					0
				);
		}
	}

	hide_tooltip() {
		this.$wrapper.find(".sdg-tooltip").removeClass("show");
	}

	reset_selection() {
		this.selected_goals = [];
		this.update_selection_state();
	}

	get_goal_description(number) {
		const descriptions = {
			1: "End poverty in all its forms everywhere",
			2: "End hunger, achieve food security and improved nutrition",
			3: "Ensure healthy lives and promote well-being for all",
			4: "Ensure inclusive and equitable quality education",
			5: "Achieve gender equality and empower all women and girls",
			6: "Ensure availability and sustainable management of water",
			7: "Ensure access to affordable, reliable, sustainable energy",
			8: "Promote sustained, inclusive economic growth and employment",
			9: "Build resilient infrastructure, promote inclusive industrialization",
			10: "Reduce inequality within and among countries",
			11: "Make cities and human settlements inclusive and sustainable",
			12: "Ensure sustainable consumption and production patterns",
			13: "Take urgent action to combat climate change",
			14: "Conserve and sustainably use the oceans and marine resources",
			15: "Protect, restore and promote sustainable use of terrestrial ecosystems",
			16: "Promote peaceful and inclusive societies for sustainable development",
			17: "Strengthen the means of implementation and revitalize global partnerships",
		};
		return descriptions[number] || "";
	}
}

frappe.ui.SVASDGWheel = SVASDGWheel;
export default SVASDGWheel;
