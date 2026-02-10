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
                border-radius: 10px;
                border: 1px solid var(--border-color, #e2e2e2);
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                overflow: hidden;
            }
            .gallery-wrapper .image-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }
            .gallery-wrapper .image-card .file-info {
                padding: 10px 12px 8px;
            }
            .gallery-wrapper .image-card .file-meta {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 0 12px 10px;
                flex-wrap: wrap;
            }
            .gallery-wrapper .file-ext-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .gallery-wrapper .file-ext-badge.ext-pdf { background: #fef2f2; color: #dc2626; }
            .gallery-wrapper .file-ext-badge.ext-doc,
            .gallery-wrapper .file-ext-badge.ext-docx { background: #eff6ff; color: #2563eb; }
            .gallery-wrapper .file-ext-badge.ext-xls,
            .gallery-wrapper .file-ext-badge.ext-xlsx,
            .gallery-wrapper .file-ext-badge.ext-csv { background: #f0fdf4; color: #16a34a; }
            .gallery-wrapper .file-ext-badge.ext-ppt,
            .gallery-wrapper .file-ext-badge.ext-pptx { background: #fff7ed; color: #ea580c; }
            .gallery-wrapper .file-ext-badge.ext-jpg,
            .gallery-wrapper .file-ext-badge.ext-jpeg,
            .gallery-wrapper .file-ext-badge.ext-png,
            .gallery-wrapper .file-ext-badge.ext-gif,
            .gallery-wrapper .file-ext-badge.ext-svg,
            .gallery-wrapper .file-ext-badge.ext-webp { background: #fdf4ff; color: #9333ea; }
            .gallery-wrapper .file-ext-badge.ext-mp4,
            .gallery-wrapper .file-ext-badge.ext-avi,
            .gallery-wrapper .file-ext-badge.ext-mov { background: #fefce8; color: #ca8a04; }
            .gallery-wrapper .file-ext-badge.ext-zip,
            .gallery-wrapper .file-ext-badge.ext-rar { background: #f5f5f4; color: #57534e; }
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
                padding: 8px 12px 4px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-color, #1F272E);
                word-break: break-word;
                line-height: 1.4;
            }
            .gallery-wrapper .file-date {
                font-size: 11px;
                color: var(--text-muted, #6E7073);
            }
            .gallery-wrapper .file-size-badge {
                font-size: 11px;
                color: var(--text-muted, #6E7073);
                background: var(--control-bg, #f4f5f6);
                padding: 1px 6px;
                border-radius: 4px;
            }
            .gallery-wrapper .file-owner {
                font-size: 11px;
                color: var(--text-light, #9a9a9a);
                display: flex;
                align-items: center;
                gap: 4px;
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
                min-width: 180px;
            }
            .gallery-wrapper .frappe-list-col-type {
                width: 70px;
            }
            .gallery-wrapper .frappe-list-col-size {
                width: 90px;
            }
            .gallery-wrapper .frappe-list-col-owner {
                width: 140px;
            }
            .gallery-wrapper .frappe-list-col-creation {
                width: 120px;
            }
            .gallery-wrapper .frappe-list-col-preview {
                width: 60px;
                text-align: center;
            }
            .gallery-wrapper .frappe-list-col-actions {
                width: 40px;
                text-align: right;
            }
            .gallery-wrapper .frappe-list-col .list-file-icon {
                width: 28px;
                height: 28px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 8px;
                font-size: 13px;
            }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-pdf { background: #fef2f2; color: #dc2626; }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-doc { background: #eff6ff; color: #2563eb; }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-xls { background: #f0fdf4; color: #16a34a; }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-img { background: #fdf4ff; color: #9333ea; }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-vid { background: #fefce8; color: #ca8a04; }
            .gallery-wrapper .frappe-list-col .list-file-icon.icon-default { background: #f5f5f4; color: #57534e; }
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
            .gallery-wrapper .gallery-subgroup {
                margin-top: 12px;
                border: 1px solid #eaeaea;
                border-radius: 6px;
            }
            .gallery-wrapper .gallery-subgroup > .group-header {
                background: #f0f2f4;
                border-radius: 6px 6px 0 0;
                padding: 8px 14px;
            }
            .gallery-wrapper .gallery-subgroup > .group-header .group-title {
                font-size: 13px;
            }
            .gallery-wrapper .gallery-subgroup > .group-body {
                padding: 12px;
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
				args: {
					doctype: this.frm.doc.doctype,
					docname: this.frm.doc.name,
				},
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
		this.groupTree = {};
		this._allGroupPaths = [];

		this.gallery_files.forEach((file) => {
			let path;
			if (!file.attached_to_field) {
				const folder = file.folder || "Home";
				path = folder === "Home" ? "Attachments" : folder.replace(/^Home\//, "");
			} else {
				path = file.attached_to_doctype || "Attachments";
			}

			const parts = path.split("/");
			let currentLevel = this.groupTree;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (!currentLevel[part]) {
					currentLevel[part] = { files: [], children: {} };
				}
				if (i === parts.length - 1) {
					currentLevel[part].files.push(file);
				} else {
					currentLevel = currentLevel[part].children;
				}
			}
		});

		this._collectGroupPaths(this.groupTree, "");
	}

	_collectGroupPaths(tree, prefix) {
		for (const name of Object.keys(tree)) {
			const fullPath = prefix ? `${prefix}/${name}` : name;
			this._allGroupPaths.push(fullPath);
			this._collectGroupPaths(tree[name].children, fullPath);
		}
	}

	_countNodeFiles(node) {
		let count = node.files.length;
		for (const child of Object.values(node.children)) {
			count += this._countNodeFiles(child);
		}
		return count;
	}

	_displayFolderName(name) {
		// Strip docname~ prefix if present (e.g. "D01~Reports" → "Reports")
		if (name && name.includes("~")) {
			return name.split("~").slice(1).join("~");
		}
		return name;
	}

	_buildFolderTree(folders) {
		const tree = { name: "Home", fullPath: "Home", children: [] };
		const map = { Home: tree };

		const sorted = [...folders].sort();
		for (const f of sorted) {
			if (f === "Home") continue;
			const parts = f.split("/");
			const rawName = parts[parts.length - 1];
			const displayName = this._displayFolderName(rawName);
			const parentPath = parts.slice(0, -1).join("/") || "Home";
			const node = { name: displayName, fullPath: f, children: [] };
			map[f] = node;
			if (map[parentPath]) {
				map[parentPath].children.push(node);
			}
		}
		return tree;
	}

	_renderFolderTreeHTML(node, selectedFolder, depth = 0) {
		const isSelected = node.fullPath === selectedFolder;
		const hasChildren = node.children.length > 0;
		const indent = depth * 18;

		// Determine if this node should be expanded (default: depth 0 always expanded, or if a descendant is selected)
		const isExpanded = this._isFolderExpanded(node, selectedFolder);

		const themeColor = frappe.boot.my_theme?.button_background_color || "var(--primary)";
		let html = `
			<div class="folder-tree-item ${isSelected ? "folder-selected" : ""}" data-folder="${
			node.fullPath
		}" style="padding: 6px 10px 6px ${
			10 + indent
		}px; cursor: pointer; display: flex; align-items: center; gap: 6px; border-radius: 6px; margin-bottom: 2px; transition: background 0.15s; ${
			isSelected ? `background: ${themeColor}; color: #fff;` : ""
		}" >
				${
					hasChildren
						? `<i class="fa fa-chevron-${
								isExpanded ? "down" : "right"
						  } folder-toggle-arrow" style="font-size: 10px; width: 12px; text-align: center; transition: transform 0.2s; ${
								isSelected ? "color: #fff;" : "color: var(--text-muted);"
						  }"></i>`
						: `<span style="width: 12px; display: inline-block;"></span>`
				}
				<i class="fa ${hasChildren ? "fa-folder" : "fa-folder-o"}" style="font-size: 14px; ${
			isSelected ? "color: #fff;" : "color: var(--yellow-500, #f59e0b);"
		}"></i>
				<span style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${
					node.name
				}</span>
			</div>`;

		if (hasChildren) {
			html += `<div class="folder-tree-children" data-parent="${
				node.fullPath
			}" style="display: ${isExpanded ? "block" : "none"};">`;
			for (const child of node.children) {
				html += this._renderFolderTreeHTML(child, selectedFolder, depth + 1);
			}
			html += `</div>`;
		}
		return html;
	}

	_isFolderExpanded(node, selectedFolder) {
		// Always expand if this node is the root (Home)
		if (node.fullPath === "Home") return true;
		// Expand if this node is selected
		if (node.fullPath === selectedFolder) return true;
		// Expand if a descendant is selected
		if (selectedFolder && selectedFolder.startsWith(node.fullPath + "/")) return true;
		// Check the stored expanded state
		if (this._expandedFolders && this._expandedFolders.has(node.fullPath)) return true;
		return false;
	}

	async _createNewFolder(parentFolder, uploadDialog) {
		const self = this;
		const newFolderDialog = new frappe.ui.Dialog({
			title: __("New Folder"),
			fields: [
				{
					label: "Parent Folder",
					fieldname: "parent_folder",
					fieldtype: "Data",
					read_only: 1,
					default: parentFolder,
				},
				{
					label: "Folder Name",
					fieldname: "folder_name",
					fieldtype: "Data",
					reqd: 1,
					description: "Enter a name for the new folder",
				},
			],
			primary_action_label: __("Create"),
			async primary_action(values) {
				try {
					const folderName = values.folder_name.trim();
					if (!folderName) {
						frappe.msgprint(__("Please enter a folder name"));
						return;
					}
					await frappe.call({
						method: "frappe.client.insert",
						args: {
							doc: {
								doctype: "File",
								file_name: self.frm.doc.name + "~" + folderName,
								is_folder: 1,
								folder: parentFolder,
								attached_to_doctype: self.frm.doc.doctype,
								attached_to_name: self.frm.doc.name,
							},
						},
					});
					newFolderDialog.hide();
					frappe.show_alert({ message: __("Folder created"), indicator: "green" });

					// Refresh folders and re-render tree
					await self.fetchFolders();
					const newFullPath = parentFolder + "/" + self.frm.doc.name + "~" + folderName;
					self._selectedUploadFolder = newFullPath;
					self._refreshUploadFolderTree(uploadDialog);
				} catch (error) {
					console.error("Error creating folder:", error);
					frappe.msgprint(__("Failed to create folder: ") + (error.message || error));
				}
			},
		});
		newFolderDialog.show();
	}

	_refreshUploadFolderTree(uploadDialog) {
		if (!this._expandedFolders) this._expandedFolders = new Set();

		const folderTree = this._buildFolderTree(this.folders);
		const $treeContainer = uploadDialog.$wrapper.find(".folder-tree-container");
		$treeContainer.html(this._renderFolderTreeHTML(folderTree, this._selectedUploadFolder));

		// Update breadcrumb
		let displayPath = this._selectedUploadFolder.replace(/^Home\/?/, "") || "Home";
		displayPath = displayPath
			.split("/")
			.map((s) => this._displayFolderName(s))
			.join("/");
		uploadDialog.$wrapper.find(".folder-breadcrumb").text(displayPath);

		const self = this;

		// Folder selection click (on the item itself, not the arrow)
		$treeContainer
			.find(".folder-tree-item")
			.off("click")
			.on("click", function (e) {
				// If the arrow was clicked, handle toggle instead
				if ($(e.target).hasClass("folder-toggle-arrow")) return;
				self._selectedUploadFolder = $(this).data("folder");
				self._refreshUploadFolderTree(uploadDialog);
			});

		// Collapse/Expand toggle click on the arrow
		$treeContainer
			.find(".folder-toggle-arrow")
			.off("click")
			.on("click", function (e) {
				e.stopPropagation();
				const $item = $(this).closest(".folder-tree-item");
				const folderPath = $item.data("folder");
				const $children = $item.next(".folder-tree-children");

				if ($children.is(":visible")) {
					$children.slideUp(150);
					$(this).removeClass("fa-chevron-down").addClass("fa-chevron-right");
					self._expandedFolders.delete(folderPath);
				} else {
					$children.slideDown(150);
					$(this).removeClass("fa-chevron-right").addClass("fa-chevron-down");
					self._expandedFolders.add(folderPath);
				}
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
					<button class="btn btn-default btn-sm" id="collapseAllBtn" title="Collapse/Expand All">
						<i class="fa fa-compress"></i> <span id="collapseAllLabel">Collapse All</span>
					</button>
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
		return this._renderCardGroupTree(this.groupTree, "");
	}

	_renderCardGroupTree(tree, parentPath) {
		const canWrite = this.permissions.includes("write");
		const canDelete = this.permissions.includes("delete");

		return Object.entries(tree)
			.map(([name, node]) => {
				const fullPath = parentPath ? `${parentPath}/${name}` : name;
				const displayName = this._displayFolderName(name);
				const isCollapsed = this.collapsedGroups[fullPath];
				const totalFiles = this._countNodeFiles(node);
				const hasChildren = Object.keys(node.children).length > 0;

				return `
				<div class="gallery-group ${parentPath ? "gallery-subgroup" : ""}">
					<div class="group-header group-toggle-btn" data-doctype="${fullPath}">
						<i class="fa ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"} group-toggle-icon"></i>
						<span class="group-title">${__(displayName)}</span>
						<span class="badge badge-secondary group-count">${totalFiles}</span>
					</div>
					<div class="group-body" data-doctype="${fullPath}" style="${isCollapsed ? "display:none;" : ""}">
						${
							node.files.length > 0
								? `<div class="row">
							${node.files.map((file) => this._renderFileCard(file, canWrite, canDelete)).join("")}
						</div>`
								: ""
						}
						${hasChildren ? this._renderCardGroupTree(node.children, fullPath) : ""}
					</div>
				</div>`;
			})
			.join("");
	}

	_renderFileCard(file, canWrite, canDelete) {
		let extension = file?.file_url?.split(".").pop()?.toLowerCase();
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
										</a>`
												: ""
										}
										${
											canDelete
												? `
										<a class="dropdown-item delete-btn" data-id="${file.name}">
											<i class="fa fa-trash"></i> Delete
										</a>`
												: ""
										}
									</div>
								</div>
							</div>`
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
				<div class="file-meta">
					<span class="file-ext-badge ext-${extension}">${(extension || "file").toUpperCase()}</span>
					<span class="file-size-badge">${this.convertTofileSize(file.file_size)}</span>
					<span class="file-date">${frappe.datetime.str_to_user(file.creation)?.split(" ")[0]}</span>
				</div>
				<div style="padding: 0 12px 10px;">
					<div class="file-owner" title="${file?.owner_full_name || ""} ${
			file?.owner != "Administrator" ? `(${file.owner})` : ""
		}">
						<i class="fa fa-user-circle-o" style="font-size: 13px;"></i>
						<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${
							file?.owner_full_name || file?.owner
						}${file?.owner != "Administrator" ? ` (${file.owner})` : ""}</span>
					</div>
				</div>
			</div>
		</div>
		`;
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
			const bgMap = {
				pdf: "#fef2f2",
				doc: "#eff6ff",
				docx: "#eff6ff",
				txt: "#f8fafc",
				xls: "#f0fdf4",
				xlsx: "#f0fdf4",
				csv: "#f0fdf4",
				ppt: "#fff7ed",
				pptx: "#fff7ed",
				mp4: "#fefce8",
				avi: "#fefce8",
				mov: "#fefce8",
				mp3: "#fdf4ff",
				wav: "#fdf4ff",
				zip: "#f5f5f4",
				rar: "#f5f5f4",
			};
			const colorMap = {
				pdf: "#dc2626",
				doc: "#2563eb",
				docx: "#2563eb",
				txt: "#475569",
				xls: "#16a34a",
				xlsx: "#16a34a",
				csv: "#16a34a",
				ppt: "#ea580c",
				pptx: "#ea580c",
				mp4: "#ca8a04",
				avi: "#ca8a04",
				mov: "#ca8a04",
				mp3: "#9333ea",
				wav: "#9333ea",
				zip: "#57534e",
				rar: "#57534e",
			};
			const bg = bgMap[extension] || "#f8f9fa";
			const clr = colorMap[extension] || "#6c757d";
			return `
				<div class="card-img-top d-flex align-items-center justify-content-center" style="height: 200px; background: ${bg};">
					<div class="file-icon text-center">
						<div style="width: 64px; height: 64px; border-radius: 16px; background: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
							<i class="${iconClass}" style="font-size: 28px; color: ${clr};"></i>
						</div>
						<span class="file-ext-badge ext-${extension}">${(extension || "FILE").toUpperCase()}</span>
					</div>
				</div>`;
		}
	}

	async renderForm(mode, fileId = null) {
		const self = this;

		if (mode === "create") {
			// ── Modern file-system upload dialog ──
			self._selectedUploadFolder = "Home";

			const uploadDialog = new frappe.ui.Dialog({
				title: __("Upload Files"),
				size: "large",
				fields: [
					{
						fieldname: "upload_layout",
						fieldtype: "HTML",
					},
				],
				primary_action_label: __("Upload"),
				primary_action: async function () {
					const selectedFolder = self._selectedUploadFolder;
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

					for (let fileIdx = 0; fileIdx < pendingFiles.length; fileIdx++) {
						const file = pendingFiles[fileIdx];
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

							// Replace remove button with green check icon
							const $item = uploadDialog.$wrapper.find(
								`.remove-pending-file[data-idx="${fileIdx}"]`
							);
							$item.replaceWith(
								`<i class="fa fa-check-circle" style="color: var(--green-500, #22c55e); font-size: 16px; padding: 0 4px;"></i>`
							);
						} catch (err) {
							console.error("Upload failed for", file.name, err);
							let errorMsg = "";
							try {
								if (typeof err === "string") {
									const parsed = JSON.parse(err);
									if (Array.isArray(parsed)) {
										const msgObj = JSON.parse(parsed[0]);
										errorMsg = msgObj.message || err;
									} else {
										errorMsg = parsed.message || err;
									}
								} else {
									errorMsg = err?.message || err;
								}
							} catch (_) {
								errorMsg = err;
							}
							// Replace remove button with red error icon
							const $failItem = uploadDialog.$wrapper.find(
								`.remove-pending-file[data-idx="${fileIdx}"]`
							);
							$failItem.replaceWith(
								`<i class="fa fa-times-circle" style="color: var(--red-500, #ef4444); font-size: 16px; padding: 0 4px;"></i>`
							);

							// Show error message below the failed file item
							const $failRow = uploadDialog.$wrapper
								.find(`.pending-file-item`)
								.eq(fileIdx);
							$failRow.after(`
								<div style="padding: 4px 10px 8px; font-size: 12px; color: var(--red-500, #ef4444);">
									<i class="fa fa-exclamation-circle"></i> ${errorMsg}
								</div>
							`);
							$failRow.css({
								"border-color": "var(--red-300, #fca5a5)",
								background: "var(--bg-red, #fff5f5)",
							});

							uploadDialog.get_primary_btn().prop("disabled", false);
						}
					}

					self._pendingUploadFiles = [];

					if (uploadedCount === totalFiles) {
						// All files uploaded successfully — close dialog
						uploadDialog.hide();
						frappe.show_alert({
							message: __(`${uploadedCount} file(s) uploaded successfully`),
							indicator: "green",
						});
						self.render();
						self.updateGallery();
					} else if (uploadedCount > 0) {
						// Some files failed — keep dialog open, refresh gallery
						frappe.show_alert({
							message: __(
								`${uploadedCount} of ${totalFiles} file(s) uploaded. Some files failed.`
							),
							indicator: "orange",
						});
						self.render();
						self.updateGallery();
					}
				},
			});

			// Render file-system style upload area
			self._pendingUploadFiles = [];
			uploadDialog.show();

			const folderTree = this._buildFolderTree(this.folders);
			const $layout = uploadDialog.fields_dict.upload_layout.$wrapper;

			$layout.html(`
				<div style="display: flex; gap: 0; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; min-height: 380px;">
					<!-- Folder Tree Sidebar -->
					<div style="width: 220px; min-width: 220px; background: var(--control-bg, #f4f5f6); border-right: 1px solid var(--border-color); display: flex; flex-direction: column;">
						<div style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
							<span style="font-weight: 600; font-size: 13px; color: var(--text-color);"><i class="fa fa-folder-open" style="margin-right: 6px; color: var(--yellow-500, #f59e0b);"></i>Folders</span>
							<button class="btn btn-xs btn-default new-folder-btn" title="New Folder" style="padding: 2px 8px; font-size: 12px;">
								${frappe.utils.icon("add", "sm")}
							</button>
						</div>
						<div class="folder-tree-container" style="flex: 1; overflow-y: auto; padding: 8px 6px;">
							${this._renderFolderTreeHTML(folderTree, self._selectedUploadFolder)}
						</div>
					</div>
					<!-- Upload Area -->
					<div style="flex: 1; display: flex; flex-direction: column; padding: 16px;">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
							<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);">
								<i class="fa fa-folder" style="color: var(--yellow-500, #f59e0b);"></i>
								<span>Upload to:</span>
								<span class="folder-breadcrumb" style="font-weight: 600; color: var(--text-color);">${(
									(self._selectedUploadFolder || "").replace(/^Home\/?/, "") ||
									"Home"
								)
									.split("/")
									.map((s) => self._displayFolderName(s))
									.join("/")}</span>
							</div>
						</div>
						<div class="custom-upload-zone" style="
							border: 2px dashed var(--border-color);
							border-radius: 8px;
							padding: 24px 16px;
							text-align: center;
							cursor: pointer;
							transition: border-color 0.2s, background 0.2s;
							background: var(--fg-color);
							margin-bottom: 12px;
						">
							<i class="fa fa-cloud-upload" style="font-size: 32px; color: var(--text-light); margin-bottom: 6px;"></i>
							<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 2px;">
								Drag & drop files here or <span style="color: ${
									frappe.boot.my_theme?.button_background_color ||
									"var(--primary)"
								}; font-weight: 500;">browse</span>
							</div>
							<div style="font-size: 11px; color: var(--text-light);">
								Select multiple files at once
							</div>
							<input type="file" multiple class="upload-file-input" style="display: none;" />
						</div>
						<div class="upload-file-list" style="flex: 1; overflow-y: auto; max-height: 180px;"></div>
						<div class="upload-progress-area" style="display: none;"></div>
					</div>
				</div>
			`);

			// Folder tree click handlers
			if (!self._expandedFolders) self._expandedFolders = new Set();

			$layout.find(".folder-tree-item").on("click", function (e) {
				if ($(e.target).hasClass("folder-toggle-arrow")) return;
				self._selectedUploadFolder = $(this).data("folder");
				self._refreshUploadFolderTree(uploadDialog);
			});

			// Collapse/Expand toggle
			$layout.find(".folder-toggle-arrow").on("click", function (e) {
				e.stopPropagation();
				const $item = $(this).closest(".folder-tree-item");
				const folderPath = $item.data("folder");
				const $children = $item.next(".folder-tree-children");

				if ($children.is(":visible")) {
					$children.slideUp(150);
					$(this).removeClass("fa-chevron-down").addClass("fa-chevron-right");
					self._expandedFolders.delete(folderPath);
				} else {
					$children.slideDown(150);
					$(this).removeClass("fa-chevron-right").addClass("fa-chevron-down");
					self._expandedFolders.add(folderPath);
				}
			});

			// New folder button
			$layout.find(".new-folder-btn").on("click", () => {
				self._createNewFolder(self._selectedUploadFolder, uploadDialog);
			});

			const $dropZone = $layout.find(".custom-upload-zone");
			const $fileInput = $layout.find(".upload-file-input");
			const $fileList = $layout.find(".upload-file-list");

			// Click to browse
			$dropZone.on("click", (e) => {
				if (e.target === $fileInput[0]) return;
				$fileInput.trigger("click");
			});
			$fileInput.on("click", (e) => e.stopPropagation());

			// File input change
			$fileInput.on("change", function () {
				self._addFilesToPending(this.files, $fileList);
				this.value = "";
			});

			// Drag & drop
			$dropZone.on("dragover", (e) => {
				e.preventDefault();
				e.stopPropagation();
				$dropZone.css({
					borderColor: frappe.boot.my_theme?.button_background_color || "var(--primary)",
					background: "var(--control-bg)",
				});
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
			const folderDisplayMap = {};
			const folderOptions = this.folders.length
				? this.folders
						.map((f) => {
							const displayName = f
								.split("/")
								.map((s) => this._displayFolderName(s))
								.join("/");
							folderDisplayMap[displayName] = f;
							return displayName;
						})
						.join("\n")
				: "Home";
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
					hidden: 1,
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
						if (f.fieldname === "folder" && doc.folder && !doc.attached_to_field) {
							const displayDefault = doc.folder
								.split("/")
								.map((s) => this._displayFolderName(s))
								.join("/");
							f.default = displayDefault;
							f.hidden = 0;
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
						if (values.folder)
							updateValues.folder = folderDisplayMap[values.folder] || values.folder;

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
						// Extract user-friendly message from _server_messages
						let errorMsg = "Upload failed";
						if (data._server_messages) {
							try {
								const msgs = JSON.parse(data._server_messages);
								if (msgs.length) {
									const msgObj = JSON.parse(msgs[0]);
									errorMsg = msgObj.message || errorMsg;
								}
							} catch (e) {
								// Ignore parsing errors and use generic message
							}
						}
						reject(errorMsg);
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

		// Collapse / Expand All toggle
		$("#collapseAllBtn")
			.off("click")
			.on("click", () => {
				const groups = self._allGroupPaths || [];
				const allCollapsed =
					groups.length > 0 && groups.every((g) => self.collapsedGroups[g]);
				groups.forEach((g) => {
					self.collapsedGroups[g] = !allCollapsed;
				});
				// Update icon and label
				if (!allCollapsed) {
					$("#collapseAllBtn i").attr("class", "fa fa-expand");
					$("#collapseAllLabel").text("Expand All");
				} else {
					$("#collapseAllBtn i").attr("class", "fa fa-compress");
					$("#collapseAllLabel").text("Collapse All");
				}
				self.updateGallery();
			});

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
		return this._renderListGroupTree(this.groupTree, "");
	}

	_renderListGroupTree(tree, parentPath) {
		const canWrite = this.permissions.includes("write");
		const canDelete = this.permissions.includes("delete");

		return Object.entries(tree)
			.map(([name, node]) => {
				const fullPath = parentPath ? `${parentPath}/${name}` : name;
				const isCollapsed = this.collapsedGroups[fullPath];
				const totalFiles = this._countNodeFiles(node);
				const hasChildren = Object.keys(node.children).length > 0;

				return `
				<div class="gallery-group ${parentPath ? "gallery-subgroup" : ""}">
					<div class="group-header group-toggle-btn" data-doctype="${fullPath}">
						<i class="fa ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"} group-toggle-icon"></i>
						<span class="group-title">${__(name)}</span>
						<span class="badge badge-secondary group-count">${totalFiles}</span>
					</div>
					<div class="group-body" data-doctype="${fullPath}" style="${isCollapsed ? "display:none;" : ""}">
						${
							node.files.length > 0
								? `<div class="frappe-list">
							<div class="frappe-list-header">
								<div class="frappe-list-row">
									${
										canDelete
											? `<div class="frappe-list-col frappe-list-col-checkbox"><input type="checkbox" class="list-row-checkbox" id="selectAllCheckBox"></div>`
											: ""
									}
									<div class="frappe-list-col frappe-list-col-subject">Name</div>
									<div class="frappe-list-col frappe-list-col-type">Type</div>
									<div class="frappe-list-col frappe-list-col-size">Size</div>
									<div class="frappe-list-col frappe-list-col-owner">Uploaded By</div>
									<div class="frappe-list-col frappe-list-col-creation">Date</div>
									<div class="frappe-list-col frappe-list-col-preview"></div>
									${canWrite || canDelete ? `<div class="frappe-list-col frappe-list-col-actions"></div>` : ""}
								</div>
							</div>
							<div class="frappe-list-body">
								${node.files.map((file) => this._renderFileListRow(file, canWrite, canDelete)).join("")}
							</div>
						</div>`
								: ""
						}
						${hasChildren ? this._renderListGroupTree(node.children, fullPath) : ""}
					</div>
				</div>`;
			})
			.join("");
	}

	_renderFileListRow(file, canWrite, canDelete) {
		let extension = file?.file_url?.split(".").pop()?.toLowerCase();
		const iconColorClass = this._getListIconClass(extension);
		return `
		<div class="frappe-list-row">
			${
				canDelete
					? `<div class="frappe-list-col frappe-list-col-checkbox"><input type="checkbox" class="list-row-checkbox toggleCheckbox" data-id="${file.name}"></div>`
					: ""
			}
			<div class="frappe-list-col frappe-list-col-subject">
				<div style="display: flex; align-items: center;">
					<span class="list-file-icon ${iconColorClass}"><i class="${this.getFileIcon(
			extension
		)}"></i></span>
					<a href="${
						file.file_url
					}" target="_blank" style="color: var(--text-color); font-weight: 450; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
			file.file_name
		}">
						${file.file_name}
					</a>
				</div>
			</div>
			<div class="frappe-list-col frappe-list-col-type"><span class="file-ext-badge ext-${extension}">${(
			extension || ""
		).toUpperCase()}</span></div>
			<div class="frappe-list-col frappe-list-col-size" style="font-size: 12px; color: var(--text-muted);">${this.convertTofileSize(
				file.file_size
			)}</div>
			<div class="frappe-list-col frappe-list-col-owner" style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
				file?.owner_full_name || file?.owner
			}">${file?.owner_full_name || file?.owner}</div>
			<div class="frappe-list-col frappe-list-col-creation" style="font-size: 12px; color: var(--text-muted);">${
				frappe.datetime.str_to_user(file.creation)?.split(" ")[0]
			}</div>
			<div class="frappe-list-col frappe-list-col-preview">${this.getListPreviewThumb(
				file,
				extension
			)}</div>
			${
				canWrite || canDelete
					? `
			<div class="frappe-list-col frappe-list-col-actions">
				<div class="list-actions">
					<div class="dropdown">
						<button class="btn btn-link btn-sm" data-toggle="dropdown"><i class="fa fa-ellipsis-v text-muted"></i></button>
						<div class="dropdown-menu dropdown-menu-right">
							${
								canWrite
									? `<a class="dropdown-item edit-btn" data-id="${file.name}"><i class="fa fa-edit text-muted"></i> Edit</a>`
									: ""
							}
							${
								canDelete
									? `<a class="dropdown-item delete-btn" data-id="${file.name}"><i class="fa fa-trash text-muted"></i> Delete</a>`
									: ""
							}
						</div>
					</div>
				</div>
			</div>`
					: ""
			}
		</div>`;
	}

	_getListIconClass(extension) {
		const pdfExts = ["pdf"];
		const docExts = ["doc", "docx", "txt"];
		const xlsExts = ["xls", "xlsx", "csv"];
		const imgExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
		const vidExts = ["mp4", "avi", "mov", "wmv"];

		if (pdfExts.includes(extension)) return "icon-pdf";
		if (docExts.includes(extension)) return "icon-doc";
		if (xlsExts.includes(extension)) return "icon-xls";
		if (imgExts.includes(extension)) return "icon-img";
		if (vidExts.includes(extension)) return "icon-vid";
		return "icon-default";
	}

	getListPreviewThumb(file, extension) {
		const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
		if (imageExtensions.includes(extension)) {
			return `
				<img src="${file.file_url}" class="list-thumb preview-btn" data-file='${JSON.stringify(file)}'
					style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);" alt="${
						file.file_name
					}">`;
		} else {
			return `
				<span class="preview-btn" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: var(--control-bg, #f4f5f6); transition: background 0.15s;" data-file='${JSON.stringify(
					file
				)}'>
					<i class="fa fa-eye" style="font-size: 13px; color: var(--text-muted);"></i>
				</span>`;
		}
	}
}

export default SVAGalleryComponent;
