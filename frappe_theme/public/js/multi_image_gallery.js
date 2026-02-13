frappe.ui.MultiImageGallery = class MultiImageGallery {
	constructor(options = {}) {
		this.frm = options.frm || null;
		this.dialog = options.dialog || null;

		this.childTable = options.childTable || "images";
		this.childDoctype = options.childDoctype || "Activity Images";
		this.imageField = options.imageField || "image";
		this.fileNameField = options.fileNameField || "file_name";
		this.wrapper = options.wrapper?.[0] || options.wrapper;

		this.isNoWrap = false;
		this.autoSlideInterval = null;
		this.sortable = null;

		this.init();
	}

	init() {
		if (!this.wrapper) return;
		this.loadSortableLibrary().then(() => {
			this.setupLayout();
			this.bindWrapToggle();
			this.bindUpload();
			this.bindBulkActions();
			this.renderImageCards();
		});
	}

	loadSortableLibrary() {
		return new Promise((resolve) => {
			if (window.Sortable) {
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
			script.onload = resolve;
			document.head.appendChild(script);
		});
	}

	getDocInfo() {
		if (this.frm) {
			return {
				doctype: this.frm.doctype,
				docname: this.frm.docname,
			};
		} else if (this.dialog) {
			return {
				doctype: this.dialog.doc?.doctype || this.childDoctype,
				docname: this.dialog.doc?.name || null,
			};
		}
		return {};
	}

	getCurrentImages() {
		if (this.frm && this.frm.doc) {
			return this.frm.doc[this.childTable] || [];
		} else if (this.dialog) {
			let table = this.dialog.fields_dict[this.childTable];
			return table?.df?.data || table?.grid?.data || [];
		}
		return [];
	}

	setupLayout() {
		const wrapper = this.wrapper;
		$(wrapper).removeClass("hide-control");

		const gridTable = wrapper.querySelector(".form-grid");
		if (gridTable) gridTable.style.display = "none";

		const gridFooter = wrapper.querySelector(".grid-footer");
		if (gridFooter) gridFooter.style.display = "none";

		$(wrapper).find(".custom-images-section").remove();

		this.section = $(`
      <div class="custom-images-section" style="
        margin-top: 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px;
      ">

        <div class="action-header" style="
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        ">
          <div class="upload-btn" style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          ">
            <button class="btn btn-sm btn-default upload-btn-main" style="
              white-space: nowrap;
            ">
              ${frappe.utils.icon("upload", "sm")}
              <span class="upload-text">Upload Multiple Images</span>
            </button>
            <button class="btn btn-sm btn-default wrap-toggle-btn">
              No Wrap
            </button>
          </div>

          <div class="bulk-action-bar" style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          ">
            <button class="btn btn-sm btn-default select-toggle-btn" style="
              display: none;
              white-space: nowrap;
            ">
              Select All
            </button>
            <button class="btn btn-sm btn-danger bulk-delete-btn" style="
              display: none;
              white-space: nowrap;
            ">
              ${frappe.utils.icon("delete", "sm")}
              <span class="delete-text">Delete Selected</span>
            </button>
          </div>
        </div>

        <div class="image-gallery" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 8px;
        "></div>
      </div>

      <style>
        /* Drag & Drop Sortable Styles */
        .image-card {
          cursor: move;
          cursor: grab;
        }

        .image-card:active {
          cursor: grabbing;
        }

        .sortable-ghost {
          opacity: 0.4;
          background: #e0f2fe;
          border: 2px dashed #0ea5e9;
        }

        .sortable-drag {
          opacity: 1;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          transform: rotate(3deg);
        }

        .sortable-chosen {
          background: #f0f9ff;
        }

        /* Mobile First - Extra Small (< 576px) */
        @media (max-width: 575.98px) {
          .custom-images-section {
            padding: 8px !important;
          }

          .action-header {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .upload-btn,
          .bulk-action-bar {
            width: 100%;
            justify-content: center;
          }

          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
            gap: 8px !important;
            padding: 8px !important;
          }

          .upload-text,
          .delete-text {
            display: none;
          }
        }

        /* Small devices (≥ 576px) */
        @media (min-width: 576px) and (max-width: 767.98px) {
          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
            gap: 10px !important;
          }
        }

        /* Medium devices - Tablets (≥ 768px) */
        @media (min-width: 768px) and (max-width: 991.98px) {
          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
            gap: 12px !important;
          }
        }

        /* Large devices - Desktops (≥ 992px) */
        @media (min-width: 992px) and (max-width: 1199.98px) {
          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important;
            gap: 15px !important;
          }
        }

        /* Extra large devices (≥ 1200px) */
        @media (min-width: 1200px) and (max-width: 1399.98px) {
          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
          }
        }

        /* XXL devices (≥ 1400px) */
        @media (min-width: 1400px) {
          .image-gallery {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
          }
        }

        /* Image card responsive */
        .image-card {
          transition: transform 0.2s ease;
        }

        .image-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Touch devices - remove hover effect */
        @media (hover: none) {
          .image-card:hover {
            transform: none;
            box-shadow: none;
          }
        }
      </style>
    `);

		$(wrapper).append(this.section);

		this.imageContainer = this.section.find(".image-gallery");
		this.uploadBtn = this.section.find(".upload-btn-main");
		this.wrapToggleBtn = this.section.find(".wrap-toggle-btn");
		this.wrapToggleBtn.hide();
		this.actionBar = this.section.find(".bulk-action-bar");
		this.selectToggleBtn = this.section.find(".select-toggle-btn");
	}

	initSortable() {
		if (this.sortable) {
			this.sortable.destroy();
		}

		if (!window.Sortable) return;

		this.sortable = new Sortable(this.imageContainer[0], {
			animation: 150,
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			dragClass: "sortable-drag",
			handle: ".image-card",
			onEnd: (evt) => {
				this.handleReorder(evt.oldIndex, evt.newIndex);
			},
		});
	}

	handleReorder(oldIndex, newIndex) {
		if (oldIndex === newIndex) return;

		if (this.frm && this.frm.doc) {
			const images = this.frm.doc[this.childTable];
			const movedItem = images[oldIndex];

			// Remove from old position
			images.splice(oldIndex, 1);
			// Insert at new position
			images.splice(newIndex, 0, movedItem);

			// Update idx for all items
			images.forEach((item, index) => {
				item.idx = index + 1;
			});

			this.frm.refresh_field(this.childTable);

			// Auto-save
			setTimeout(() => {
				if (!this.frm.is_dirty()) return;

				this.frm.save().then(() => {
					frappe.show_alert({
						message: __("Image order updated"),
						indicator: "green",
					});
				});
			}, 200);
		} else if (this.dialog) {
			let table = this.dialog.fields_dict[this.childTable];
			let images = table?.df?.data || table?.grid?.data || [];

			const movedItem = images[oldIndex];

			// Remove from old position
			images.splice(oldIndex, 1);
			// Insert at new position
			images.splice(newIndex, 0, movedItem);

			// Update idx
			images.forEach((item, index) => {
				item.idx = index + 1;
			});

			if (table?.refresh) {
				table.refresh();
			}

			frappe.show_alert({
				message: __("Image order updated"),
				indicator: "green",
			});
		}
	}

	bindWrapToggle() {
		this.wrapToggleBtn.on("click", () => {
			this.isNoWrap = !this.isNoWrap;

			if (this.isNoWrap) {
				// Disable sortable in carousel mode
				if (this.sortable) {
					this.sortable.option("disabled", true);
				}

				this.imageContainer.css({
					display: "flex",
					flexWrap: "nowrap",
					overflowX: "auto",
					height: "277px",
				});
				this.imageContainer.find(".image-card").css({ minWidth: "220px" });
				this.wrapToggleBtn.text("Wrap");
				this.startAutoSlide();
			} else {
				// Enable sortable in grid mode
				if (this.sortable) {
					this.sortable.option("disabled", false);
				}

				this.stopAutoSlide();
				this.imageContainer.css({
					display: "grid",
					flexWrap: "",
					overflowX: "",
					height: "auto",
				});
				this.imageContainer.find(".image-card").css({ minWidth: "" });
				this.wrapToggleBtn.text("No Wrap");
			}
		});
	}

	startAutoSlide() {
		this.stopAutoSlide();
		this.autoSlideInterval = setInterval(() => {
			this.imageContainer.animate({ scrollLeft: "+=220" }, 600, "linear", () => {
				if (
					this.imageContainer.scrollLeft() + this.imageContainer.innerWidth() >=
					this.imageContainer[0].scrollWidth
				) {
					this.imageContainer.scrollLeft(0);
				}
			});
		}, 2000);
	}

	stopAutoSlide() {
		if (this.autoSlideInterval) {
			clearInterval(this.autoSlideInterval);
			this.autoSlideInterval = null;
		}
	}

	bindUpload() {
		this.uploadBtn.on("click", () => {
			if (this.frm && !this.dialog) {
				this.frm.disable_save();

				new frappe.ui.FileUploader({
					allow_multiple: 1,
					restrictions: {
						allowed_file_types: ["image/*", "video/*", "audio/*"],
						max_file_size: 50 * 1024 * 1024,
					},

					on_success: async (files) => {
						files = Array.isArray(files) ? files : [files];

						files.forEach((file) => {
							let row = this.frm.add_child("images");
							row.image = file.file_url;
							row.file_name = file.file_name;
						});

						this.frm.refresh_field("images");
						this.renderImageCards();
						this.show_success(files.length);

						setTimeout(() => {
							if (!this.frm.is_dirty()) {
								this.frm.enable_save();
								return;
							}

							if (this.frm.doc.__unsaved || this.frm.save_disabled) {
								this.frm.enable_save();
								return;
							}

							this.frm.save().finally(() => {
								this.frm.enable_save();
							});
						}, 200);
					},

					on_error: () => {
						this.frm.enable_save();
					},
				});
			}

			if (this.dialog) {
				this.dialog_uploaded_files = this.dialog_uploaded_files || [];

				new frappe.ui.FileUploader({
					allow_multiple: 1,
					restrictions: {
						allowed_file_types: ["image/*", "video/*", "audio/*"],
						max_file_size: 50 * 1024 * 1024,
					},

					on_success: (files) => {
						files = Array.isArray(files) ? files : [files];

						files.forEach((file) => {
							this.dialog_uploaded_files.push({
								image: file.file_url,
								file_name: file.file_name,
							});
						});

						this.renderImageCards();
						this.show_success(files.length);
					},
				});
			}
		});
	}

	show_success(count) {
		frappe.show_alert({
			message: __("Successfully uploaded {0} images", [count]),
			indicator: "green",
		});
	}

	add_files(files) {
		files.forEach((file) => {
			// CASE 1: Normal Form
			if (this.frm && typeof this.frm.add_child === "function") {
				let row = this.frm.add_child(this.childTable);
				row[this.imageField] = file.file_url;
				row[this.fileNameField] = file.file_name;
			}
			// CASE 2: Dialog
			else if (this.dialog) {
				let table = this.dialog.fields_dict[this.childTable];
				if (!table) return;

				// Handle both grid and data array
				if (table.grid) {
					table.grid.add_new_row();
					let row = table.grid.get_row(-1);
					if (row) {
						row.doc[this.imageField] = file.file_url;
						row.doc[this.fileNameField] = file.file_name;
					}
				} else {
					table.df.data = table.df.data || [];
					table.df.data.push({
						[this.imageField]: file.file_url,
						[this.fileNameField]: file.file_name,
					});
				}

				table.refresh();
			}
		});

		// Refresh field
		if (this.frm && typeof this.frm.refresh_field === "function") {
			this.frm.refresh_field(this.childTable);
		} else if (this.dialog) {
			let table = this.dialog.fields_dict[this.childTable];
			if (table && table.refresh) {
				table.refresh();
			}
		}
	}

	bindBulkActions() {
		this.selectToggleBtn.on("click", () => {
			const cbs = this.imageContainer.find("input[type='checkbox']");
			const all = cbs.length === cbs.filter(":checked").length;
			cbs.prop("checked", !all).trigger("change");
		});

		this.actionBar.find(".bulk-delete-btn").on("click", () => {
			const selected = this.imageContainer
				.find("input[type='checkbox']:checked")
				.map((i, el) => $(el).data("name"))
				.get();

			if (!selected.length) return;

			frappe.confirm(__("Delete {0} selected images?", [selected.length]), () => {
				if (this.frm && this.frm.doc) {
					const grid = this.frm.fields_dict[this.childTable].grid;

					selected.reverse().forEach((row_name) => {
						const grid_row = grid.grid_rows.find((gr) => gr.doc.name === row_name);
						if (grid_row) {
							grid_row.remove();
						}
					});

					this.frm.save().then(() => {
						setTimeout(() => {
							this.frm.reload_doc().then(() => {
								this.renderImageCards();
								this.show_delete_success();
							});
						}, 300);
					});
				} else if (this.dialog) {
					let table = this.dialog.fields_dict[this.childTable];

					if (table && table.grid) {
						const grid = table.grid;

						// ✅ Delete in reverse order
						selected.reverse().forEach((row_name) => {
							const grid_row = grid.grid_rows.find(
								(gr) => gr.doc.name === row_name || gr.doc.idx === row_name
							);

							if (grid_row) {
								grid_row.remove();
							}
						});

						grid.refresh();
					}

					this.renderImageCards();
					this.show_delete_success();
				}
			});
		});
	}

	show_delete_success() {
		frappe.show_alert({
			message: __("Selected images deleted successfully"),
			indicator: "green",
		});
	}

	updateActionBar() {
		const total = this.imageContainer.find("input[type='checkbox']").length;
		const checked = this.imageContainer.find("input[type='checkbox']:checked").length;
		const deleteBtn = this.actionBar.find(".bulk-delete-btn");

		if (checked) {
			deleteBtn.show();
			this.selectToggleBtn.show();
			this.selectToggleBtn.text(checked === total ? "Unselect All" : "Select All");
		} else {
			deleteBtn.hide();
			this.selectToggleBtn.hide();
		}
	}

	renderImageCards() {
		const container = this.imageContainer;
		container.empty();

		const images = this.getCurrentImages();

		if (!images.length) {
			container.html(
				`<div style="text-align:center;color:#64748b;padding:20px">No images uploaded yet</div>`
			);
			this.wrapToggleBtn.hide();
			return;
		}

		images.forEach((item) => {
			const card = $(`
				<div class="image-card" style="background:white;border-radius:12px;overflow:hidden;position:relative">
					<div style="position:absolute;top:10px;right:10px;z-index:10">
						<input type="checkbox" data-name="${
							item.name || item.idx
						}" style="width:18px;height:18px;cursor:pointer">
					</div>
					<img src="${
						item[this.imageField]
					}" style="width:100%;height:150px;object-fit:cover;cursor:pointer">
					<div style="padding:10px">
						<p style="margin:0;font-size:13px;color:#374151">${item[this.fileNameField] || "Unnamed"}</p>
					</div>
				</div>
			`);

			card.find("input").on("change", () => this.updateActionBar());
			card.find("img").on("click", () => {
				window.open(item[this.imageField], "_blank");
			});

			container.append(card);
		});

		this.wrapToggleBtn.show();
		this.wrapToggleBtn.text("No Wrap");

		// Initialize sortable after rendering
		this.initSortable();
	}
};
