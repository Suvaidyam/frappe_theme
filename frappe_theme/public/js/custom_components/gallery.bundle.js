import Loader from "../loader-element.js";

class SVAGalleryComponent {
	constructor(frm, wrapper) {
		this.frm = frm;
		this.wrapper = wrapper;
		this.gallery_files = [];
		this.groupedFiles = {};
		this.collapsedGroups = {};
		this.selectedFiles = [];
		this.view = "Card"; // Default view
		this.permissions = [];
		this.folders = [];
		this.initialize();
		return this.wrapper;
	}
	get_permissions(doctype) {
		return new Promise((rslv, rjct) => {
			frappe.call({
				method: "frappe_theme.api.get_permissions",
				args: { doctype: doctype },
				callback: function (response) {
					rslv(response.message);
				},
				error: (err) => {
					rjct(err);
				},
			});
		});
	}
	async initialize() {
		try {
			if (!this.wrapper) {
				console.error("Wrapper element is null");
				return;
			}
			// Get permissions and store them
			this.permissions = await this.get_permissions("File");

			// Initialize the wrapper with basic structure regardless of permissions
			this.wrapper.innerHTML = `
                <div class="gallery-wrapper">
                    <div class="gallery-header" id="gallery-header"></div>
                    <div class="gallery-body" id="gallery-body"></div>
                </div>
            `;

			// Check if user has at least read permission
			if (!this.permissions.includes("read")) {
				const noPermissionDiv = document.createElement("div");
				noPermissionDiv.id = "noPermissionPage";
				noPermissionDiv.style.cssText = `
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    text-align: center;
                    padding: 50px;
                    color: var(--gray-600);
                `;
				noPermissionDiv.textContent =
					"You do not have permission through role permission to access this resource.";

				// Clear the gallery body and append the no permission message
				const galleryBody = this.wrapper.querySelector("#gallery-body");
				galleryBody.innerHTML = "";
				galleryBody.appendChild(noPermissionDiv);
				return;
			}

			// Continue with initialization only if read permission exists
			this.appendGalleryStyles();
			await this.fetchFolders();
			await this.fetchGalleryFiles();
			this.renderHeader();
			this.updateGallery();
			this.attachEventListeners();
		} catch (error) {
			console.error("Error in initialize:", error);
			const errorDiv = document.createElement("div");
			errorDiv.id = "errorPage";
			errorDiv.style.cssText = `
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                text-align: center;
                padding: 50px;
                color: var(--gray-600);
            `;
			errorDiv.textContent = `Failed to initialize gallery: ${error.message || error}`;

			const galleryBody = this.wrapper.querySelector("#gallery-body");
			galleryBody.innerHTML = "";
			galleryBody.appendChild(errorDiv);
		}
	}

	appendGalleryStyles() {
		const style = document.createElement("style");
		style.innerHTML = `
            .gallery-wrapper {
                height: calc(100vh - 270px);
                min-height: 400px;
                position: relative;
                display: flex;
                flex-direction: column;
            }
            .gallery-wrapper .gallery-header {
                padding: 0px 0px 12px 0px;
                background: #fff;
                border-bottom: 1px solid #e2e2e2;
                z-index: 1;
            }
            .gallery-wrapper .gallery-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
            }
            .gallery-wrapper .empty-state {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px;
                text-align: center;
                color: #6E7073;
            }
            .gallery-wrapper .empty-state i {
                font-size: 48px;
                margin-bottom: 16px;
                color: #E2E2E2;
            }
            .gallery-wrapper .empty-state p {
                font-size: 16px;
                margin-bottom: 16px;
            }
            ${this.getCommonStyles()}
        `;
		document.head.appendChild(style);
	}

	getCommonStyles() {
		return `
            .gallery-wrapper .checkbox-container {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 2;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .gallery-wrapper .image-container:hover .checkbox-container,
            .gallery-wrapper .checkbox-container input[type="checkbox"]:checked {
                opacity: 1;
            }
            .gallery-wrapper .checkbox-container.selected {
                opacity: 1;
            }
            .gallery-wrapper .checkbox-container input[type="checkbox"] {
                width: 20px !important;
                height: 20px !important;
                background-color: rgba(255, 255, 255, 0.9);
                border: 2px solid #fff;
                border-radius: 4px;
            }
            .gallery-wrapper .card-img-top {
                width: 100%;
                height: 200px;
                border-bottom:1px solid #e2e2e2;
                object-fit: cover;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            .gallery-wrapper .image-card {
                width: 100%;
                background: white;
                border-radius: 8px;
                border:1px solid #e2e2e2;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .gallery-wrapper .image-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0,0,0,0.15);
            }
            .gallery-wrapper .image-container {
                position: relative;
            }
            .gallery-wrapper .image-container:hover .image-cover {
                opacity: 1;
                visibility: visible;
            }
            .gallery-wrapper .image-cover {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 200px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s, visibility 0.2s;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
            }
            .gallery-wrapper .cover-header {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 2;
            }
            .gallery-wrapper .cover-body {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .gallery-wrapper .action-button {
                background: rgba(255, 255, 255, 0.9);
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                color: #1F272E;
                transition: background-color 0.2s;
            }
            .gallery-wrapper .action-button:hover {
                background: #ffffff;
            }
            .gallery-wrapper .view-button {
                background: rgba(255, 255, 255, 0.9);
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #1F272E;
                transition: transform 0.2s, background-color 0.2s;
                text-decoration: none;
            }
            .gallery-wrapper .view-button:hover {
                transform: scale(1.1);
                background: #ffffff;
                text-decoration: none;
                color: #1F272E;
            }
            .gallery-wrapper .file-name {
                padding: 6px 12px ;
                font-size: 14px;
                color: #1F272E;
                word-break: break-word;
            }
            .gallery-wrapper .file-date {
                padding: 0 12px 6px;
                font-size: 12px;
                color: #6E7073;
            }
            /* Frappe List View Styles */
            .gallery-wrapper .frappe-list {
                background-color: var(--fg-color);
                border-radius: var(--border-radius-md);
                box-shadow: var(--card-shadow);
            }
            .gallery-wrapper .frappe-list-row {
                display: flex;
                align-items: center;
                padding: 12px 15px;
                border-bottom: 1px solid var(--border-color);
                transition: background-color 0.2s;
            }
            .gallery-wrapper .frappe-list-row:hover {
                background-color: var(--fg-hover-color);
            }
            .gallery-wrapper .frappe-list-col {
                padding: 0 8px;
                font-size: var(--text-md);
            }
            .gallery-wrapper .frappe-list-col-checkbox {
                width: 30px;
            }
            .gallery-wrapper .frappe-list-col-subject {
                flex: 2;
                min-width: 200px;
            }
            .gallery-wrapper .frappe-list-col-creation {
                width: 140px;
            }
            .gallery-wrapper .frappe-list-col-preview {
                width: 100px;
            }
            .gallery-wrapper .frappe-list-col-actions {
                width: 40px;
                text-align: right;
            }
            .gallery-wrapper .frappe-list-header {
                background-color: var(--fg-color);
                border-bottom: 1px solid var(--border-color);
                font-weight: 600;
                color: var(--text-muted);
            }
            .gallery-wrapper .frappe-list-header .frappe-list-row:hover {
                background-color: var(--fg-color);
            }
            .gallery-wrapper .list-actions {
                opacity: 0;
                transition: opacity 0.2s;
            }
            .gallery-wrapper .frappe-list-row:hover .list-actions {
                opacity: 1;
            }
            .gallery-wrapper .list-row-checkbox {
                margin: 0;
            }
            /* Group styles */
            .gallery-wrapper .gallery-group {
                margin-bottom: 16px;
                border: 1px solid #e2e2e2;
                border-radius: 8px;
            }
            .gallery-wrapper .group-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                background: #f8f9fa;
                border-bottom: 1px solid #e2e2e2;
                cursor: pointer;
                user-select: none;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            .gallery-wrapper .group-header:hover {
                background: #eef0f2;
            }
            .gallery-wrapper .group-toggle-icon {
                font-size: 12px;
                color: #6E7073;
                width: 14px;
                text-align: center;
            }
            .gallery-wrapper .group-title {
                font-weight: 600;
                font-size: 14px;
                color: #1F272E;
            }
            .gallery-wrapper .group-count {
                font-size: 12px;
                background: #d1d8dd;
                color: #36414C;
                padding: 2px 8px;
                border-radius: 10px;
            }
            .gallery-wrapper .group-body {
                padding: 16px;
                border-bottom-left-radius: 8px;
                border-bottom-right-radius: 8px;
            }
            .gallery-wrapper .pdf-thumbnail-wrapper {
                background: #f5f5f5;
            }
            @media (max-width: 768px) {
                .gallery-wrapper {
                    height: calc(100vh - 200px);
                }
                .gallery-wrapper .card-img-top {
                    height: 160px;
                }
                .gallery-wrapper .image-cover {
                    height: 160px;
                }
            }
        `;
	}

	async fetchFolders() {
		try {
			const { message: folders } = await frappe.call({
				method: "frappe_theme.api.get_folders",
				type: "GET",
			});
			this.folders = (folders || []).map((f) => f.name);
		} catch (error) {
			console.error("Error fetching folders:", error);
			this.folders = ["Home"];
		}
	}

	async fetchGalleryFiles() {
		const loader = new Loader(
			this.wrapper.querySelector(".gallery-wrapper"),
			"gallery-fetch-loader"
		);
		try {
			loader.show();
			if (!this.frm || !this.frm.doc) {
				console.error("Form or document not initialized");
				return;
			}

			// Call your custom API instead of frappe.db.get_list
			const { message: files } = await frappe.call({
				method: "frappe_theme.api.get_files",
				type: "GET",
				args: {
					doctype: this.frm.doc.doctype,
					docname: this.frm.doc.name,
				},
			});

			this.gallery_files = files || [];

			// Extract unique owners
			const uniqueOwners = [...new Set(this.gallery_files.map((file) => file.owner))];

			if (uniqueOwners.length > 0) {
				const { message: ownerNames } = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "User",
						filters: { name: ["in", uniqueOwners] },
						fields: ["name", "full_name"],
					},
				});

				// Create a map of user names to full names
				const ownerFullNames = {};
				ownerNames.forEach((user) => {
					ownerFullNames[user.name] = user.full_name;
				});
				this.gallery_files = this.gallery_files.map((file) => ({
					...file,
					owner_full_name: ownerFullNames[file.owner],
				}));
			}

			this.groupFilesByFolder();
			this.updateGallery();
		} catch (error) {
			console.error("Error fetching files:", error);
			frappe.msgprint({
				title: __("Error"),
				indicator: "red",
				message: __("Error fetching files:") + (error.message || error),
			});
		} finally {
			loader.hide();
		}
	}

	groupFilesByFolder() {
		this.groupedFiles = {};
		this.gallery_files.forEach((file) => {
			let displayLabel;
			if (!file.attached_to_field) {
				// attached_to_field is NOT set → group by folder name
				const folder = file.folder || "Home";
				displayLabel = folder === "Home" ? "Attachments" : folder.replace(/^Home\//, "");
			} else {
				// attached_to_field IS set → group by attached_to_doctype
				displayLabel = file.attached_to_doctype || "Attachments";
			}
			if (!this.groupedFiles[displayLabel]) {
				this.groupedFiles[displayLabel] = [];
			}
			this.groupedFiles[displayLabel].push(file);
		});
	}

	render() {
		this.wrapper.innerHTML = `
            <div class="gallery-wrapper">
                <div class="gallery-header" id="gallery-header"></div>
                <div class="gallery-body" id="gallery-body"></div>
            </div>
        `;

		this.groupFilesByFolder();
		this.renderHeader();
		this.updateGallery();
	}

	renderHeader() {
		const canCreate = this.permissions.includes("create");
		const canDelete = this.permissions.includes("delete");

		const headerHTML = `
            <div class="row" style="display: flex; justify-content: space-between; align-items: center; margin: 0;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span class="text-muted">Total records: ${this.gallery_files.length}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${
						canDelete
							? `
                        <button class="btn btn-danger btn-sm" style="display:none;" id="deleteSelectedButton">
                            <i class="fa fa-trash"></i> Delete Selected
                        </button>
                    `
							: ""
					}
                    <div class="btn-group">
                        <button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown">
                            <i class="fa ${this.view === "Card" ? "fa-th-large" : "fa-list"}"></i>
                            <span id="viewNameButton">${this.view} View</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-right">
                            <li><a class="dropdown-item" id="cardViewBtn"><i class="fa fa-th-large"></i> Card View</a></li>
                            <li><a class="dropdown-item" id="listViewBtn"><i class="fa fa-list"></i> List View</a></li>
                        </ul>
                    </div>
                    ${
						canCreate
							? `
                        <button class="btn btn-primary btn-sm" id="customUploadButton">
                            <i class="fa fa-upload"></i> Upload
                        </button>
                    `
							: ""
					}
                </div>
            </div>
        `;
		this.wrapper.querySelector("#gallery-header").innerHTML = headerHTML;
	}

	renderEmptyState() {
		return `
            <div class="empty-state">
                <i class="fa fa-file-o"></i>
                <p>No files uploaded yet</p>
            </div>
        `;
	}
	preview_file(frm) {
		let file_extension = frm?.file_url?.split(".").pop();
		let show_file = new frappe.ui.Dialog({
			title: __("Preview File"),
			size: "large",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "preview_html",
				},
			],
			primary_action_label: __("Download"),
			primary_action() {
				let link = document.createElement("a");
				link.href = frm.file_url;
				link.download = frm.file_name;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			},
			secondary_action_label: __("Close"),
			secondary_action() {
				show_file.hide();
			},
		});
		let $preview = "";
		if (frappe.utils.is_image_file(frm.file_url)) {
			$preview = $(`<div class="img_preview position-relative">
				<img style="width: 100%; max-height:75vh;object-fit: contain;"
					class="img-responsive"
					src="${frappe.utils.escape_html(frm.file_url)}"
				/>
			</div>`);
		} else if (frappe.utils.is_video_file(frm.file_url)) {
			$preview = $(`<div class="img_preview d-flex justify-content-center">
				<video style="width:100%" height="320" controls>
					<source src="${frappe.utils.escape_html(frm.file_url)}">
					${__("Your browser does not support the video element.")}
				</video>
			</div>`);
		} else if (file_extension === "pdf") {
			$preview = $(`<div class="img_preview">
				<object style="background:#323639;" width="100%">
					<embed
						style="background:#323639;"
						width="100%"
						height="1190"
						src="${frappe.utils.escape_html(frm.file_url)}" type="application/pdf"
					>
				</object>
			</div>`);
		} else if (file_extension === "mp3") {
			$preview = $(`<div class="img_preview d-flex justify-content-center">
				<audio width="480" height="60" controls>
					<source src="${frappe.utils.escape_html(frm.file_url)}" type="audio/mpeg">
					${__("Your browser does not support the audio element.")}
				</audio >
			</div>`);
		} else {
			$preview = $(`<div class="img_preview d-flex justify-content-center">
				<p class="text-muted">Preview not available for this file type</p>
			</div>`);
		}

		if ($preview) {
			show_file.show();
			show_file.get_field("preview_html").$wrapper.html($preview);
		}
	}
	convertTofileSize(size) {
		if (size < 1024) {
			return size + " Bytes";
		} else if (size < 1048576) {
			return (size / 1024).toFixed(2) + " KB";
		} else if (size < 1073741824) {
			return (size / 1048576).toFixed(2) + " MB";
		}
	}
	renderCardView() {
		if (!this.gallery_files.length) {
			return this.renderEmptyState();
		}

		const canWrite = this.permissions.includes("write");
		const canDelete = this.permissions.includes("delete");
		const groups = Object.keys(this.groupedFiles);

		return groups
			.map((groupName) => {
				const files = this.groupedFiles[groupName];
				const isCollapsed = this.collapsedGroups[groupName];
				return `
				<div class="gallery-group">
					<div class="group-header group-toggle-btn" data-doctype="${groupName}">
						<i class="fa ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"} group-toggle-icon"></i>
						<span class="group-title">${__(groupName)}</span>
						<span class="badge badge-secondary group-count">${files.length}</span>
					</div>
					<div class="group-body" data-doctype="${groupName}" style="${isCollapsed ? "display:none;" : ""}">
						<div class="row">
							${files
								.map((file) => {
									let extension = file?.file_url
										?.split(".")
										.pop()
										?.toLowerCase();
									return `
									<div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
										<div class="image-card">
											<div class="image-container">
												${this.getFilePreview(file, extension)}
												${
													canDelete
														? `
													<div class="checkbox-container">
														<input type="checkbox" data-id="${file.name}" class="toggleCheckbox"/>
													</div>
												`
														: ""
												}
												<div class="image-cover">
													${
														canWrite || canDelete
															? `
														<div class="cover-header">
															<div class="dropdown">
																<button class="action-button" data-toggle="dropdown">
																	<i class="fa fa-ellipsis-v"></i>
																</button>
																<div class="dropdown-menu dropdown-menu-right">
																	${
																		canWrite
																			? `
																		<a class="dropdown-item edit-btn" data-id="${file.name}">
																			<i class="fa fa-edit"></i> Edit
																		</a>
																	`
																			: ""
																	}
																	${
																		canDelete
																			? `
																		<a class="dropdown-item delete-btn" data-id="${file.name}">
																			<i class="fa fa-trash"></i> Delete
																		</a>
																	`
																			: ""
																	}
																</div>
															</div>
														</div>
													`
															: ""
													}
													<div class="cover-body">
														<p class="view-button preview-btn" style="cursor: pointer;" data-file='${JSON.stringify(file)}'>
															<i class="fa fa-eye"></i>
														</p>
													</div>
												</div>
											</div>
											<div class="file-name" style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;" title="${
												file.file_name
											}">${file.file_name}</div>
											<div class="d-flex justify-content-between">
												<div class="file-date">${frappe.datetime.str_to_user(file.creation)?.split(" ")[0]}</div>
												<div class="file-date">
													${this.convertTofileSize(file.file_size)}
												</div>
											</div>
											<div class="d-flex justify-content-between">
												<div class="file-date" style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;"
													title="by ${file.owner_full_name} ${file.owner != "Administrator" ? `(${file.owner})` : ""}">
													by ${file.owner_full_name} ${file.owner != "Administrator" ? `(${file.owner})` : ""}
												</div>
											</div>
										</div>
									</div>
								`;
								})
								.join("")}
						</div>
					</div>
				</div>
			`;
			})
			.join("");
	}

	getFileIcon(extension) {
		const iconMap = {
			// Documents
			pdf: "fa fa-file-pdf-o",
			doc: "fa fa-file-word-o",
			docx: "fa fa-file-word-o",
			txt: "fa fa-file-text-o",
			// Spreadsheets
			xls: "fa fa-file-excel-o",
			xlsx: "fa fa-file-excel-o",
			csv: "fa fa-file-excel-o",
			// Presentations
			ppt: "fa fa-file-powerpoint-o",
			pptx: "fa fa-file-powerpoint-o",
			// Images
			jpg: "fa fa-file-image-o",
			jpeg: "fa fa-file-image-o",
			png: "fa fa-file-image-o",
			gif: "fa fa-file-image-o",
			bmp: "fa fa-file-image-o",
			// Video
			mp4: "fa fa-file-video-o",
			avi: "fa fa-file-video-o",
			mov: "fa fa-file-video-o",
			wmv: "fa fa-file-video-o",
			// Audio
			mp3: "fa fa-file-audio-o",
			wav: "fa fa-file-audio-o",
			// Archives
			zip: "fa fa-file-archive-o",
			rar: "fa fa-file-archive-o",
			"7z": "fa fa-file-archive-o",
			// Code
			js: "fa fa-file-code-o",
			css: "fa fa-file-code-o",
			html: "fa fa-file-code-o",
			py: "fa fa-file-code-o",
		};

		return iconMap[extension?.toLowerCase()] || "fa fa-file-o";
	}

	getFilePreview(file, extension) {
		const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];

		if (imageExtensions.includes(extension)) {
			return `<img src="${file.file_url}" class="card-img-top" alt="${file.file_name}">`;
		} else if (extension === "pdf") {
			return `
				<div class="card-img-top pdf-thumbnail-wrapper" style="height: 200px; background-color: #f5f5f5; overflow: hidden; position: relative;">
					<iframe src="${frappe.utils.escape_html(
						file.file_url
					)}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH" scrolling="no" style="width: calc(100% + 20px); height: 220px; border: none; pointer-events: none; position: absolute; top: 0; left: 0;"></iframe>
				</div>`;
		} else {
			const iconClass = this.getFileIcon(extension);
			return `
				<div class="card-img-top d-flex align-items-center justify-content-center" style="height: 200px; background-color: #f8f9fa;">
					<div class="file-icon text-center">
						<i class="${iconClass}" style="font-size: 48px; color: #6c757d;"></i>
						<div style="font-size: 12px; margin-top: 8px; color: #6c757d;">.${extension}</div>
					</div>
				</div>`;
		}
	}

	async renderForm(mode, fileId = null) {
		const self = this;

		// Build folder options for the Select field
		const folderOptions = this.folders.length ? this.folders.map((f) => f).join("\n") : "Home";

		if (mode === "create") {
			// ── Custom multi-file upload dialog ──
			const uploadDialog = new frappe.ui.Dialog({
				title: __("Upload Files"),
				fields: [
					{
						label: "Folder",
						fieldname: "folder",
						fieldtype: "Select",
						options: folderOptions,
						default: "Home",
						description: "Select a folder for the uploaded files",
					},
					{
						fieldtype: "Section Break",
					},
					{
						label: "Files",
						fieldname: "upload_area",
						fieldtype: "HTML",
					},
				],
				primary_action_label: __("Upload"),
				primary_action: async function () {
					const selectedFolder = uploadDialog.get_value("folder");
					const pendingFiles = self._pendingUploadFiles || [];

					if (!pendingFiles.length) {
						frappe.msgprint(__("Please select at least one file"));
						return;
					}

					uploadDialog.get_primary_btn().prop("disabled", true);
					const progressWrapper = uploadDialog.$wrapper.find(".upload-progress-area");
					progressWrapper.show();

					let uploadedCount = 0;
					const totalFiles = pendingFiles.length;

					for (const file of pendingFiles) {
						try {
							progressWrapper.html(`
								<div style="padding: 8px 0;">
									<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
										Uploading ${uploadedCount + 1} of ${totalFiles}: ${file.name}
									</div>
									<div class="progress" style="height: 6px;">
										<div class="progress-bar" style="width: ${Math.round((uploadedCount / totalFiles) * 100)}%"></div>
									</div>
								</div>
							`);

							const fileDoc = await self._uploadSingleFile(file, selectedFolder);
							if (fileDoc) {
								self.gallery_files.unshift(fileDoc);
							}
							uploadedCount++;
						} catch (err) {
							console.error("Upload failed for", file.name, err);
							frappe.show_alert({
								message: __("Failed to upload: ") + file.name,
								indicator: "orange",
							});
						}
					}

					self._pendingUploadFiles = [];
					uploadDialog.hide();

					if (uploadedCount > 0) {
						frappe.show_alert({
							message: __(`${uploadedCount} file(s) uploaded successfully`),
							indicator: "green",
						});
						self.render();
						self.updateGallery();
					}
				},
			});

			// Render custom upload area
			self._pendingUploadFiles = [];
			uploadDialog.show();

			const $uploadArea = uploadDialog.fields_dict.upload_area.$wrapper;
			$uploadArea.html(`
				<div class="custom-upload-zone" style="
					border: 2px dashed var(--border-color);
					border-radius: 8px;
					padding: 30px 20px;
					text-align: center;
					cursor: pointer;
					transition: border-color 0.2s, background 0.2s;
					background: var(--fg-color);
					margin-bottom: 10px;
				">
					<i class="fa fa-cloud-upload" style="font-size: 36px; color: var(--text-light); margin-bottom: 8px;"></i>
					<div style="font-size: 14px; color: var(--text-muted); margin-bottom: 4px;">
						Drag & drop files here or <span style="color: var(--primary); font-weight: 500;">browse</span>
					</div>
					<div style="font-size: 12px; color: var(--text-light);">
						Select multiple files at once
					</div>
					<input type="file" multiple class="upload-file-input" style="display: none;" />
				</div>
				<div class="upload-file-list" style="max-height: 200px; overflow-y: auto;"></div>
				<div class="upload-progress-area" style="display: none;"></div>
			`);

			const $dropZone = $uploadArea.find(".custom-upload-zone");
			const $fileInput = $uploadArea.find(".upload-file-input");
			const $fileList = $uploadArea.find(".upload-file-list");

			// Click to browse
			$dropZone.on("click", (e) => {
				if (e.target === $fileInput[0]) return; // prevent infinite loop
				$fileInput.trigger("click");
			});
			$fileInput.on("click", (e) => e.stopPropagation());

			// File input change
			$fileInput.on("change", function () {
				self._addFilesToPending(this.files, $fileList);
				this.value = ""; // reset so same file can be re-added
			});

			// Drag & drop
			$dropZone.on("dragover", (e) => {
				e.preventDefault();
				e.stopPropagation();
				$dropZone.css({ borderColor: "var(--primary)", background: "var(--control-bg)" });
			});
			$dropZone.on("dragleave", (e) => {
				e.preventDefault();
				e.stopPropagation();
				$dropZone.css({
					borderColor: "var(--border-color)",
					background: "var(--fg-color)",
				});
			});
			$dropZone.on("drop", (e) => {
				e.preventDefault();
				e.stopPropagation();
				$dropZone.css({
					borderColor: "var(--border-color)",
					background: "var(--fg-color)",
				});
				const droppedFiles = e.originalEvent.dataTransfer.files;
				self._addFilesToPending(droppedFiles, $fileList);
			});

			this.dialog = uploadDialog;
		} else {
			// ── Edit mode dialog ──
			let editFields = [
				{
					label: "File URL",
					fieldname: "file",
					fieldtype: "Data",
					read_only: 1,
				},
				{
					label: "File Name",
					fieldname: "file_name",
					fieldtype: "Data",
					reqd: 1,
					description: "Enter a name for your file",
				},
				{
					label: "Folder",
					fieldname: "folder",
					fieldtype: "Select",
					options: folderOptions,
					default: "Home",
					description: "Select a folder for the file",
				},
			];

			if (fileId) {
				try {
					let doc = await frappe.db.get_doc("File", fileId);
					editFields = editFields.map((f) => {
						if (f.fieldname === "file" && doc.file_url) {
							f.default = doc.file_url;
							return f;
						}
						if (f.fieldname === "folder" && doc.folder) {
							f.default = doc.folder;
							return f;
						}
						if (doc[f.fieldname]) {
							f.default = doc[f.fieldname];
						}
						return f;
					});
				} catch (error) {
					console.error("Error fetching file:", error);
					frappe.msgprint(__("Error fetching file details. Please try again."));
					return;
				}
			}

			const editDialog = new frappe.ui.Dialog({
				title: __("Edit File"),
				fields: editFields,
				primary_action_label: __("Save"),
				async primary_action(values) {
					try {
						const updateValues = {};
						if (values.file_name) updateValues.file_name = values.file_name;
						if (values.file) updateValues.file_url = values.file;
						if (values.folder) updateValues.folder = values.folder;

						let updated_file = await frappe.db.set_value("File", fileId, updateValues);
						if (updated_file?.message) {
							self.gallery_files = self.gallery_files.map((file) =>
								file.name === fileId ? updated_file.message : file
							);
							await self.fetchGalleryFiles();
							frappe.show_alert({
								message: __("File updated successfully"),
								indicator: "green",
							});
						}
						self.updateGallery();
						this.hide();
					} catch (error) {
						console.error("Error updating file:", error);
						frappe.msgprint(__("Error updating file: ") + (error.message || error));
					}
				},
			});

			editDialog.show();
			this.dialog = editDialog;
		}
	}

	_addFilesToPending(fileList, $fileListContainer) {
		for (const file of fileList) {
			// Avoid duplicates by name+size
			const exists = this._pendingUploadFiles.some(
				(f) => f.name === file.name && f.size === file.size
			);
			if (!exists) {
				this._pendingUploadFiles.push(file);
			}
		}
		this._renderPendingFileList($fileListContainer);
	}

	_renderPendingFileList($container) {
		if (!this._pendingUploadFiles.length) {
			$container.html("");
			return;
		}

		const self = this;
		$container.html(
			this._pendingUploadFiles
				.map((file, idx) => {
					const ext = file.name.split(".").pop()?.toLowerCase();
					const iconClass = this.getFileIcon(ext);
					const size = this.convertTofileSize(file.size);
					return `
					<div class="pending-file-item" style="
						display: flex;
						align-items: center;
						justify-content: space-between;
						padding: 8px 10px;
						border: 1px solid var(--border-color);
						border-radius: 6px;
						margin-bottom: 6px;
						background: var(--fg-color);
					">
						<div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
							<i class="${iconClass}" style="font-size: 16px; color: var(--text-muted);"></i>
							<span style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${file.name}">${file.name}</span>
							<span style="font-size: 11px; color: var(--text-light); white-space: nowrap;">${size}</span>
						</div>
						<button class="btn btn-xs btn-link remove-pending-file" data-idx="${idx}" style="color: var(--text-muted); padding: 0 4px;">
							<i class="fa fa-times"></i>
						</button>
					</div>`;
				})
				.join("")
		);

		$container.find(".remove-pending-file").on("click", function () {
			const idx = parseInt($(this).data("idx"));
			self._pendingUploadFiles.splice(idx, 1);
			self._renderPendingFileList($container);
		});
	}

	_uploadSingleFile(file, folder) {
		return new Promise((resolve, reject) => {
			const formData = new FormData();
			formData.append("file", file, file.name);
			formData.append("doctype", this.frm.doc.doctype);
			formData.append("docname", this.frm.doc.name);
			formData.append("is_private", 1);
			if (folder) {
				formData.append("folder", folder);
			}

			const xhr = new XMLHttpRequest();
			xhr.open("POST", "/api/method/upload_file", true);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

			xhr.onload = function () {
				try {
					const data = JSON.parse(xhr.responseText);
					if (xhr.status === 200 && data.message) {
						resolve(data.message);
					} else {
						console.error("Upload response error:", data);
						reject(data.exc || data._server_messages || "Upload failed");
					}
				} catch (e) {
					console.error("Upload parse error:", xhr.responseText);
					reject("Upload failed: could not parse response");
				}
			};
			xhr.onerror = function () {
				console.error("Upload network error");
				reject("Upload failed: network error");
			};
			xhr.send(formData);
		});
	}

	attachEventListeners() {
		const self = this;

		if (this.permissions.includes("create")) {
			$("#customUploadButton")
				.off("click")
				.on("click", async () => {
					await self.renderForm("create");
				});
		}

		if (this.permissions.includes("delete")) {
			$("#deleteSelectedButton")
				.off("click")
				.on("click", async () => {
					if (self.selectedFiles.length === 0) {
						frappe.msgprint(__("Please select files to delete"));
						return;
					}

					frappe.confirm(
						"Are you sure you want to delete the selected files?",
						async () => {
							try {
								for (const fileId of self.selectedFiles) {
									await frappe.db.delete_doc("File", fileId);
								}
								self.gallery_files = self.gallery_files.filter(
									(file) => !self.selectedFiles.includes(file.name)
								);
								self.selectedFiles = [];
								self.render();
								self.updateSelectedFilesUI();
								frappe.show_alert({
									message: __("Files deleted successfully"),
									indicator: "green",
								});
							} catch (error) {
								console.error("Error deleting files:", error);
								frappe.msgprint(__("Error deleting files. Please try again."));
							}
						}
					);
				});
		}

		// View switching remains accessible to all users with read permission
		$("#cardViewBtn")
			.off("click")
			.on("click", () => {
				self.view = "Card";
				self.selectedFiles = [];
				$("#viewNameButton").text("Card View");
				self.updateSelectedFilesUI();
				self.updateGallery();
			});

		$("#listViewBtn")
			.off("click")
			.on("click", () => {
				self.view = "List";
				self.selectedFiles = [];
				$("#viewNameButton").text("List View");
				self.updateSelectedFilesUI();
				self.updateGallery();
			});

		this.attachGalleryItemEventListeners();
	}

	attachGalleryItemEventListeners() {
		const self = this;

		$(".delete-btn")
			.off("click")
			.on("click", async function () {
				// Remove previous handlers
				const fileId = $(this).data("id");
				if (fileId) {
					try {
						frappe.confirm("Are you sure you want to delete this file?", async () => {
							await frappe.db.delete_doc("File", fileId);
							self.gallery_files = self.gallery_files.filter(
								(file) => file.name !== fileId
							);
							self.render();
						});
					} catch (error) {
						console.error(error);
					}
				}
			});

		$(".preview-btn")
			.off("click")
			.on("click", function () {
				const fileData = $(this).data("file");
				if (fileData) {
					self.preview_file(fileData);
				}
			});

		$(".edit-btn")
			.off("click")
			.on("click", async function () {
				// Remove previous handlers
				const fileId = $(this).data("id");
				await self.renderForm("edit", fileId); // Use self here
			});

		$(".toggleCheckbox")
			.off("change")
			.on("change", function () {
				// Remove previous handlers
				const fileId = $(this).data("id");
				const checkboxContainer = $(this).closest(".checkbox-container");

				if (this.checked) {
					self.selectedFiles.push(fileId);
					checkboxContainer.addClass("selected");
				} else {
					self.selectedFiles = self.selectedFiles.filter((fid) => fid != fileId);
					checkboxContainer.removeClass("selected");
				}
				self.updateSelectedFilesUI();
			});

		$("#selectAllCheckBox")
			.off("change")
			.on("change", function () {
				const isChecked = this.checked;
				self.selectedFiles = isChecked ? self.gallery_files.map((file) => file.name) : [];
				$(".toggleCheckbox").prop("checked", isChecked);
				if (isChecked) {
					$(".checkbox-container").addClass("selected");
				} else {
					$(".checkbox-container").removeClass("selected");
				}
				self.updateSelectedFilesUI();
			});
	}

	updateSelectedFilesUI() {
		const deleteSelectedButton = document.getElementById("deleteSelectedButton");

		// Only update delete button if it exists (user has delete permission)
		if (deleteSelectedButton) {
			if (this.selectedFiles.length > 0) {
				deleteSelectedButton.style.display = "block";
			} else {
				deleteSelectedButton.style.display = "none";
			}
		}

		// Update select all checkbox if it exists
		const selectAllCheckbox = document.getElementById("selectAllCheckBox");
		if (selectAllCheckbox) {
			if (this.selectedFiles.length === this.gallery_files.length) {
				selectAllCheckbox.checked = true;
			} else {
				selectAllCheckbox.checked = false;
			}
		}
	}

	updateGallery() {
		const bodyWrapper = this.wrapper.querySelector("#gallery-body");
		if (this.view === "Card") {
			bodyWrapper.innerHTML = this.renderCardView();
		} else {
			bodyWrapper.innerHTML = this.renderListView();
		}
		bodyWrapper.style.height = "75vh";
		bodyWrapper.style.overflow = "auto";
		this.attachGalleryItemEventListeners(); // Attach event listeners to gallery items
		this.attachGroupToggleListeners();
		this.attachEventListeners();
	}

	attachGroupToggleListeners() {
		const self = this;
		this.wrapper.querySelectorAll(".group-toggle-btn").forEach((btn) => {
			btn.addEventListener("click", function () {
				const doctype = this.dataset.doctype;
				self.collapsedGroups[doctype] = !self.collapsedGroups[doctype];
				const groupBody = self.wrapper.querySelector(
					`.group-body[data-doctype="${doctype}"]`
				);
				const icon = this.querySelector(".group-toggle-icon");
				if (groupBody) {
					groupBody.style.display = self.collapsedGroups[doctype] ? "none" : "";
				}
				if (icon) {
					icon.className = self.collapsedGroups[doctype]
						? "fa fa-chevron-right group-toggle-icon"
						: "fa fa-chevron-down group-toggle-icon";
				}
			});
		});
	}

	renderListView() {
		if (!this.gallery_files.length) {
			return this.renderEmptyState();
		}

		const canWrite = this.permissions.includes("write");
		const canDelete = this.permissions.includes("delete");
		const groups = Object.keys(this.groupedFiles);

		return groups
			.map((groupName) => {
				const files = this.groupedFiles[groupName];
				const isCollapsed = this.collapsedGroups[groupName];
				return `
				<div class="gallery-group">
					<div class="group-header group-toggle-btn" data-doctype="${groupName}">
						<i class="fa ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"} group-toggle-icon"></i>
						<span class="group-title">${groupName}</span>
						<span class="badge badge-secondary group-count">${files.length}</span>
					</div>
					<div class="group-body" data-doctype="${groupName}" style="${isCollapsed ? "display:none;" : ""}">
						<div class="frappe-list">
							<div class="frappe-list-header">
								<div class="frappe-list-row">
									${
										canDelete
											? `
										<div class="frappe-list-col frappe-list-col-checkbox">
											<input type="checkbox" class="list-row-checkbox" id="selectAllCheckBox">
										</div>
									`
											: ""
									}
									<div class="frappe-list-col frappe-list-col-subject">File Name</div>
									<div class="frappe-list-col frappe-list-col-creation">Upload Date</div>
									<div class="frappe-list-col frappe-list-col-preview">Preview</div>
									${
										canWrite || canDelete
											? `
										<div class="frappe-list-col frappe-list-col-actions"></div>
									`
											: ""
									}
								</div>
							</div>
							<div class="frappe-list-body">
								${files
									.map((file) => {
										let extension = file?.file_url
											?.split(".")
											.pop()
											?.toLowerCase();
										return `
										<div class="frappe-list-row">
											${
												canDelete
													? `
												<div class="frappe-list-col frappe-list-col-checkbox">
													<input type="checkbox" class="list-row-checkbox toggleCheckbox" data-id="${file.name}">
												</div>
											`
													: ""
											}
											<div class="frappe-list-col frappe-list-col-subject">
												<a href="${file.file_url}" target="_blank" class="text-muted">
													<i class="${this.getFileIcon(extension)} mr-2"></i>
													${file.file_name}
												</a>
											</div>
											<div class="frappe-list-col frappe-list-col-creation">
												${frappe.datetime.str_to_user(file.creation)}
											</div>
											<div class="frappe-list-col frappe-list-col-preview">
												${this.getListPreviewThumb(file, extension)}
											</div>
											${
												canWrite || canDelete
													? `
												<div class="frappe-list-col frappe-list-col-actions">
													<div class="list-actions">
														<div class="dropdown">
															<button class="btn btn-link btn-sm" data-toggle="dropdown">
																<i class="fa fa-ellipsis-v text-muted"></i>
															</button>
															<div class="dropdown-menu dropdown-menu-right">
																${
																	canWrite
																		? `
																	<a class="dropdown-item edit-btn" data-id="${file.name}">
																		<i class="fa fa-edit text-muted"></i> Edit
																	</a>
																`
																		: ""
																}
																${
																	canDelete
																		? `
																	<a class="dropdown-item delete-btn" data-id="${file.name}">
																		<i class="fa fa-trash text-muted"></i> Delete
																	</a>
																`
																		: ""
																}
															</div>
														</div>
													</div>
												</div>
											`
													: ""
											}
										</div>
									`;
									})
									.join("")}
							</div>
						</div>
					</div>
				</div>
			`;
			})
			.join("");
	}

	getListPreviewThumb(file, extension) {
		const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
		if (imageExtensions.includes(extension)) {
			return `
				<img src="${file.file_url}" class="list-thumb preview-btn" data-file='${JSON.stringify(file)}'
					style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; cursor: pointer;" alt="${
						file.file_name
					}">`;
		} else if (extension === "pdf") {
			return `
				<div class="list-thumb-pdf preview-btn" data-file='${JSON.stringify(
					file
				)}' style="width: 36px; height: 36px; overflow: hidden; border-radius: 4px; cursor: pointer; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
					<i class="fa fa-file-pdf-o" style="font-size: 20px; color: #e74c3c;"></i>
				</div>`;
		} else {
			return `
				<p class="preview-btn" style="cursor: pointer; margin: 0;" data-file='${JSON.stringify(file)}'>
					<i class="fa fa-eye"></i>
				</p>`;
		}
	}
}

export default SVAGalleryComponent;
