/**
 * Directory View Mixin for SVAGalleryComponent
 * Handles folder-based navigation with breadcrumbs, folder cards, and file cards
 */

export function getDirectoryViewStyles() {
	return `
		/* Directory View */
		.gallery-wrapper .directory-view .dir-folder-card:hover {
			border-color: var(--primary);
			box-shadow: 0 4px 12px rgba(0,0,0,0.08);
			transform: translateY(-2px);
		}
		.gallery-wrapper .directory-view .dir-breadcrumb-link:hover {
			color: var(--text-color) !important;
			text-decoration: underline !important;
		}
		.gallery-wrapper .directory-view .dir-back-btn:hover {
			background: var(--bg-light-gray);
		}
		.gallery-wrapper .dir-folder-card:hover .dir-folder-menu-btn {
			opacity: 1 !important;
		}
		.gallery-wrapper .dir-folder-menu-btn.menu-active {
			opacity: 1 !important;
		}
		.gallery-wrapper .dir-folder-menu-btn:hover {
			background: var(--control-bg);
			color: var(--text-color);
		}
	`;
}

export function applyDirectoryViewMixin(GalleryClass) {
	GalleryClass.prototype.renderDirectoryView = function () {
		const hasExtraFolders = this.folders && this.folders.length > 1;
		if (!this.gallery_files.length && !this._currentDirPath && !hasExtraFolders) {
			return this.renderEmptyState();
		}
		const currentPath = this._currentDirPath;
		const canWrite = this.permissions.includes("write");
		const canDelete = this.permissions.includes("delete");

		// Build a separate tree for directory view that includes empty folders
		// Deep clone groupTree so we don't mutate the shared state
		const dirTree = JSON.parse(JSON.stringify(this.groupTree));
		(this.folders || []).forEach((folderPath) => {
			if (folderPath === "Home") return;
			const stripped = folderPath.replace(/^Home\//, "");
			if (!stripped) return;
			const parts = stripped.split("/");
			let currentLevel = dirTree;
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (!currentLevel[part]) {
					currentLevel[part] = { files: [], children: {} };
				}
				if (i < parts.length - 1) {
					currentLevel = currentLevel[part].children;
				}
			}
		});

		// Navigate to the right level in dirTree
		let folders = [];
		let files = [];

		if (!currentPath) {
			// Root level — show top-level groups
			folders = Object.entries(dirTree).map(([name, node]) => ({
				name,
				displayName: this._displayFolderName(name),
				fullPath: name,
				fileCount: this._countNodeFiles(node),
				folderDocName: name === "Attachments" ? "Home" : "Home/" + name,
				isEditable: name.includes("~"),
			}));
			// No files at root
		} else {
			// Navigate into the tree by path segments
			const parts = currentPath.split("/");
			let node = dirTree;
			let found = true;
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (i === 0) {
					// First level: keys of groupTree
					if (node[part]) {
						node = node[part];
					} else {
						found = false;
						break;
					}
				} else {
					// Deeper levels: navigate through children
					if (node.children && node.children[part]) {
						node = node.children[part];
					} else {
						found = false;
						break;
					}
				}
			}
			if (found && node) {
				// Child folders
				folders = Object.entries(node.children).map(([name, child]) => ({
					name,
					displayName: this._displayFolderName(name),
					fullPath: currentPath + "/" + name,
					fileCount: this._countNodeFiles(child),
					folderDocName: "Home/" + currentPath + "/" + name,
					isEditable: name.includes("~"),
				}));
				files = node.files || [];
			}
		}

		// Build breadcrumb
		const breadcrumbParts = [];
		breadcrumbParts.push({ label: "All Folders", path: null });
		if (currentPath) {
			const segments = currentPath.split("/");
			let accumulated = "";
			for (let i = 0; i < segments.length; i++) {
				accumulated = i === 0 ? segments[i] : accumulated + "/" + segments[i];
				breadcrumbParts.push({
					label: this._displayFolderName(segments[i]),
					path: accumulated,
				});
			}
		}

		const breadcrumbHTML = breadcrumbParts
			.map((b, i) => {
				const isLast = i === breadcrumbParts.length - 1;
				if (isLast) {
					return `<span style="font-weight: 600; color: var(--text-color); font-size: 14px;">${b.label}</span>`;
				}
				return `<a href="javascript:void(0)" class="dir-breadcrumb-link" data-path="${
					b.path || ""
				}" style="color: var(--text-muted); font-size: 14px; text-decoration: none;">${
					b.label
				}</a>
					<i class="fa fa-chevron-right" style="font-size: 10px; color: var(--text-light); margin: 0 4px;"></i>`;
			})
			.join("");

		// Folder cards
		const folderCardsHTML = folders.length
			? `<div style="margin-bottom: 20px;">
				<div style="font-weight: 600; font-size: 13px; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
					${currentPath ? "Sub Folders" : ""}
				</div>
				<div class="row">
					${folders
						.map(
							(f) => `
						<div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
							<div class="dir-folder-card" data-path="${f.fullPath}" data-folder-doc="${
								f.folderDocName
							}" data-folder-name="${f.name}" data-display-name="${
								f.displayName
							}" data-is-editable="${f.isEditable}" style="
								background: var(--fg-color);
								border: 1px solid var(--border-color);
								border-radius: 10px;
								padding: 14px 12px;
								cursor: pointer;
								transition: all 0.2s ease;
								display: flex;
								align-items: center;
								gap: 10px;
								min-height: 52px;
							">
								<i class="fa fa-folder" style="font-size: 20px; color: var(--yellow-500, #f59e0b); flex-shrink: 0;"></i>
								<div style="min-width: 0; flex: 1;">
									<div style="font-size: 13px; font-weight: 500; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
										f.displayName
									}">${f.displayName}</div>
									<div style="font-size: 11px; color: var(--text-muted);">${f.fileCount} file${
								f.fileCount !== 1 ? "s" : ""
							}</div>
								</div>
								${
									f.isEditable && (canWrite || canDelete)
										? `<button class="dir-folder-menu-btn" style="
									background: transparent; border: none; color: var(--text-muted);
									padding: 4px 6px; line-height: 1; border-radius: 4px;
									opacity: 0; transition: opacity 0.2s; cursor: pointer; flex-shrink: 0;
								"><i class="fa fa-ellipsis-v"></i></button>`
										: ""
								}
							</div>
						</div>
					`
						)
						.join("")}
				</div>
			</div>`
			: "";

		// File cards (reuse the existing card renderer)
		const fileCardsHTML = files.length
			? `<div>
				<div style="font-weight: 600; font-size: 13px; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
					Files
				</div>
				<div class="row">
					${files.map((file) => this._renderFileCard(file, canWrite, canDelete)).join("")}
				</div>
			</div>`
			: "";

		const emptyState =
			!folders.length && !files.length
				? `<div class="empty-state">
				<i class="fa fa-folder-open-o"></i>
				<p>This folder is empty</p>
			</div>`
				: "";

		return `
			<div class="directory-view">
				<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
					${
						currentPath
							? `<button class="btn btn-xs btn-default dir-back-btn" style="padding: 4px 8px; margin-right: 4px;">
						<i class="fa fa-arrow-left"></i>
					</button>`
							: ""
					}
					${breadcrumbHTML}
				</div>
				${folderCardsHTML}
				${fileCardsHTML}
				${emptyState}
			</div>
		`;
	};

	GalleryClass.prototype._attachDirectoryEventListeners = function () {
		const self = this;
		const canDelete = this.permissions.includes("delete");

		// Folder card click — navigate into folder
		$(this.wrapper)
			.find(".dir-folder-card")
			.off("click")
			.on("click", function (e) {
				if ($(e.target).closest(".dir-folder-menu-btn").length) return;
				self._currentDirPath = $(this).data("path");
				self.updateGallery();
			});

		// 3-dot menu button — show popup appended to body (toggle behavior)
		$(this.wrapper)
			.find(".dir-folder-menu-btn")
			.off("click")
			.on("click", function (e) {
				e.stopPropagation();
				e.preventDefault();

				const wasActive = $(this).hasClass("menu-active");
				// Remove any existing popup & clear previous active state
				$(".dir-folder-popup").remove();
				$(".dir-folder-menu-btn.menu-active").removeClass("menu-active");

				// If it was already open, just close and return
				if (wasActive) return;

				const $card = $(this).closest(".dir-folder-card");
				const folderDoc = $card.data("folder-doc");
				const displayName = $card.data("display-name");

				const rect = this.getBoundingClientRect();
				const menuItems = [];
				if (canDelete) {
					menuItems.push(
						`<div class="dir-popup-item dir-popup-delete" style="padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--red-500, #e74c3c);"><i class="fa fa-trash"></i> Delete</div>`
					);
				}

				const $popup = $(`<div class="dir-folder-popup" style="
				position:fixed;
				top:${rect.bottom + 4}px;
				left:${rect.left - 100}px;
				min-width:140px;
				background:var(--fg-color, #fff);
				border:1px solid var(--border-color);
				border-radius:8px;
				box-shadow:0 8px 24px rgba(0,0,0,0.15);
				z-index:1060;
				padding:4px 0;
			">${menuItems.join("")}</div>`);

				$("body").append($popup);

				const $btn = $(this);
				$btn.addClass("menu-active");

				$popup.find(".dir-popup-delete").on("click", function () {
					$popup.remove();
					$btn.removeClass("menu-active");
					self._deleteFolder(folderDoc, displayName);
				});
				$popup
					.find(".dir-popup-item")
					.on("mouseenter", function () {
						$(this).css("background", "var(--fg-hover-color, #f5f5f5)");
					})
					.on("mouseleave", function () {
						$(this).css("background", "transparent");
					});

				// Close popup on outside click
				setTimeout(() => {
					$(document).one("click", function () {
						$popup.remove();
						$btn.removeClass("menu-active");
					});
				}, 10);
			});

		// Breadcrumb link click
		$(this.wrapper)
			.find(".dir-breadcrumb-link")
			.off("click")
			.on("click", function () {
				const path = $(this).data("path");
				self._currentDirPath = path || null;
				self.updateGallery();
			});

		// Back button
		$(this.wrapper)
			.find(".dir-back-btn")
			.off("click")
			.on("click", function () {
				if (self._currentDirPath) {
					const parts = self._currentDirPath.split("/");
					parts.pop();
					self._currentDirPath = parts.length ? parts.join("/") : null;
				} else {
					self._currentDirPath = null;
				}
				self.updateGallery();
			});
	};

	GalleryClass.prototype._deleteFolder = function (folderDocName, displayName) {
		const self = this;
		frappe.confirm(
			__("Are you sure you want to delete folder <b>{0}</b> and all its contents?", [
				displayName,
			]),
			async () => {
				try {
					await frappe.call({
						method: "frappe.client.delete",
						args: { doctype: "File", name: folderDocName },
					});
					frappe.show_alert({ message: __("Folder deleted"), indicator: "green" });
					await self.fetchFolders();
					await self.fetchGalleryFiles();
					self._currentDirPath = null;
					self.render();
				} catch (error) {
					console.error("Error deleting folder:", error);
					// frappe.msgprint(
					// 	__("Failed to delete folder") + ": " + (error.message || error)
					// );
				}
			}
		);
	};
}
