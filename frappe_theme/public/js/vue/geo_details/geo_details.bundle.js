class GeoDetails {
	/**
	 * @param {Object} opts
	 * @param {HTMLElement|jQuery} opts.wrapper - Container element
	 * @param {Object} [opts.coords] - Single location: { lat, lng }
	 * @param {Object} [opts.groups] - Multiple locations: { "lat,lng": { lat, lng, records } }
	 * @param {string} [opts.doctype] - Doctype for location dialog table (multi mode)
	 * @param {string} [opts.title] - Title text shown above map
	 * @param {number} [opts.height=250] - Map height in px
	 * @param {number} [opts.zoom=15] - Zoom level (single mode)
	 * @param {boolean} [opts.showMaximize=true] - Show maximize button
	 * @param {string} [opts.maximizeTitle] - Dialog title for fullscreen
	 * @param {boolean} [opts.showFooter=false] - Show village + coordinates footer
	 * @param {Function} [opts.onMarkerClick] - Custom marker click handler (overrides default)
	 */
	constructor(opts) {
		this.wrapper = opts.wrapper instanceof $ ? opts.wrapper[0] : opts.wrapper;
		this.mode = opts.coords ? "single" : "multi";
		this.coords = opts.coords || null;
		this.groups = opts.groups || {};
		this.doctype = opts.doctype || "";
		this.title = opts.title || "";
		this.height = opts.height !== undefined ? opts.height : 250;
		this.zoom = opts.zoom || 15;
		this.scrollWheelZoom = opts.scrollWheelZoom !== false;
		this.showMaximize = opts.showMaximize !== false;
		this.maximizeTitle = opts.maximizeTitle || this.title || "Geo Tagging";
		this.showFooter = opts.showFooter || false;
		this.onMarkerClick = opts.onMarkerClick || null;
		this.fitBoundsPadding = opts.fitBoundsPadding || [30, 30];

		this.map = null;
		this.mapId = "geo-map-" + frappe.utils.get_random(8);

		this._buildContainer();
		setTimeout(() => {
			this._initMap();
			this._addTileLayer();
			this._addMarkers();
			if (this.showFooter && this.mode === "single" && this.coords) {
				this._reverseGeocode(this.coords.lat, this.coords.lng);
			}
		}, 0);
	}

	_buildContainer() {
		let heightStyle = this.height ? `height:${this.height}px;` : "height:100%;";
		let html = "";

		// Header: title + maximize button
		if (this.title || this.showMaximize) {
			html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">`;
			html += `<div style="font-size:14px;font-weight:600;color:#1e293b;">${
				this.title || ""
			}</div>`;
			if (this.showMaximize) {
				html += `<button class="btn btn-xs btn-default geo-maximize-btn" title="Maximize" style="padding:2px 6px;">
					${frappe.utils.icon("expand", "sm")}
				</button>`;
			}
			html += `</div>`;
		}

		// Map container
		html += `<div id="${this.mapId}" style="${heightStyle}border-radius:8px;overflow:hidden;"></div>`;

		// Footer: village + coordinates
		if (this.showFooter && this.mode === "single" && this.coords) {
			html += `<div style="margin-top:10px;font-size:12px;color:var(--text-muted);">
				<span class="geo-village-name"></span>
				<span class="geo-coordinates">Coordinates: ${this.coords.lat}, ${this.coords.lng}</span>
			</div>`;
		}

		this.wrapper.innerHTML = html;

		// Maximize handler
		if (this.showMaximize) {
			let btn = this.wrapper.querySelector(".geo-maximize-btn");
			if (btn) {
				btn.addEventListener("click", () => this._openMaximize());
			}
		}
	}

	_initMap() {
		if (typeof L === "undefined") {
			console.warn("GeoDetails: Leaflet (L) is not available.");
			return;
		}
		this.map = L.map(this.mapId, { scrollWheelZoom: this.scrollWheelZoom });
	}

	_addTileLayer() {
		if (!this.map) return;
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {}).addTo(this.map);
	}

	_addMarkers() {
		if (!this.map) return;
		if (this.mode === "single" && this.coords) {
			L.marker([this.coords.lat, this.coords.lng]).addTo(this.map);
			this.map.setView([this.coords.lat, this.coords.lng], this.zoom);
		} else if (this.mode === "multi") {
			this._addGroupMarkers(this.map);
		}
	}

	_addGroupMarkers(map) {
		let bounds = [];
		Object.values(this.groups).forEach((group) => {
			let latlng = [group.lat, group.lng];
			let marker = L.marker(latlng).addTo(map);
			marker.on("click", () => {
				if (this.onMarkerClick) {
					this.onMarkerClick(group);
				} else {
					this._showLocationDialog(group);
				}
			});
			bounds.push(latlng);
		});
		if (bounds.length) {
			map.fitBounds(bounds, { padding: this.fitBoundsPadding });
		}
	}

	_reverseGeocode(lat, lng) {
		fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
			.then((r) => r.json())
			.then((data) => {
				let village =
					data.address?.village ||
					data.address?.town ||
					data.address?.city ||
					data.address?.county ||
					"";
				let $el = $(this.wrapper).find(".geo-village-name");
				if (village && $el.length) {
					$el.text("Village: " + village + "  |  ");
				}
			})
			.catch(() => {});
	}

	_openMaximize() {
		let dlg = new frappe.ui.Dialog({
			title: this.maximizeTitle,
			fields: [{ fieldtype: "HTML", fieldname: "max_map" }],
		});
		frappe.utils.make_dialog_fullscreen(dlg);
		dlg.show();
		let $container = $("<div>").css({
			height: "calc(100vh - 100px)",
			borderRadius: "8px",
			overflow: "hidden",
		});
		dlg.fields_dict.max_map.$wrapper.html($container);
		setTimeout(() => {
			let maxGeo = new GeoDetails({
				wrapper: $container[0],
				coords: this.coords,
				groups: this.groups,
				doctype: this.doctype,
				height: null,
				zoom: this.zoom,
				showMaximize: false,
				showFooter: false,
				onMarkerClick: this.onMarkerClick,
			});
			dlg.on_hide = () => {
				maxGeo.destroy();
			};
		}, 200);
	}

	_showLocationDialog(group) {
		let records = group.records || [];
		let names = records.map((r) => r.name);
		let doctype = this.doctype;

		if (!doctype || !names.length) return;

		frappe.model.with_doctype(doctype, () => {
			frappe.model.with_doc(doctype, names[0], () => {
				let doc = frappe.get_doc(doctype, names[0]);
				let meta = frappe.get_meta(doctype);

				let fields = meta.fields
					.filter((df) => !df.hidden)
					.map((df) => ({ ...df, read_only: 1 }));

				// Add a section at the bottom to show location
				let lat = group.lat;
				let lng = group.lng;
				fields.push(
					{ fieldtype: "Section Break", label: "" },
					{ fieldtype: "HTML", fieldname: "location_info" }
				);

				let dlg = new frappe.ui.Dialog({
					title: `${doctype} - (${names[0]})`,
					fields: fields,
					size: "extra-large",
				});

				dlg.set_values(doc);
				dlg.show();

				// Show location card
				if (lat && lng) {
					dlg.fields_dict.location_info.$wrapper.html(`
						<div style="margin-top:12px;padding:14px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e3a5f;display:flex;align-items:center;gap:10px;">
							<div style="font-size:18px;">${frappe.utils.icon("web", "md")}</div>
							<div>
								<div style="font-weight:600;font-size:13px;">Location</div>
								<div class="geo-address-text" style="font-size:12px;color:#3b6fa0;">Loading address...</div>
							</div>
						</div>
					`);

					fetch(
						`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
					)
						.then((r) => r.json())
						.then((data) => {
							let address = data.display_name || `${lat}, ${lng}`;
							dlg.fields_dict.location_info.$wrapper
								.find(".geo-address-text")
								.text(address);
						})
						.catch(() => {
							dlg.fields_dict.location_info.$wrapper
								.find(".geo-address-text")
								.text(`${lat}, ${lng}`);
						});
				}
			});
		});
	}

	destroy() {
		if (this.map) {
			this.map.remove();
			this.map = null;
		}
		if (this.wrapper) {
			this.wrapper.innerHTML = "";
		}
	}
}

frappe.ui.GeoDetails = GeoDetails;
export default GeoDetails;
