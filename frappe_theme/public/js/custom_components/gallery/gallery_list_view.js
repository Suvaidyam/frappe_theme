/**
 * List View Mixin for SVAGalleryComponent
 * Handles list/table-based file rendering with grouped folders
 */

export function getListViewStyles() {
	return `
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
	`;
}

export function applyListViewMixin(GalleryClass) {
	GalleryClass.prototype.renderListView = function () {
		if (!this.gallery_files.length) {
			return this.renderEmptyState();
		}
		return this._renderListGroupTree(this.groupTree, "");
	};

	GalleryClass.prototype._renderListGroupTree = function (tree, parentPath) {
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
								? `<div class="frappe-list">
							<div class="frappe-list-header">
								<div class="frappe-list-row">
									${
										canDelete
											? `<div class="frappe-list-col frappe-list-col-checkbox"><input type="checkbox" class="list-row-checkbox selectAllCheckBox"></div>`
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
	};

	GalleryClass.prototype._renderFileListRow = function (file, canWrite, canDelete) {
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
					<button class="btn btn-link btn-sm file-action-menu-btn" data-file-id="${file.name}" data-can-write="${canWrite}" data-can-delete="${canDelete}"><i class="fa fa-ellipsis-v text-muted"></i></button>
				</div>
			</div>`
					: ""
			}
		</div>`;
	};

	GalleryClass.prototype._getListIconClass = function (extension) {
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
	};

	GalleryClass.prototype.getListPreviewThumb = function (file, extension) {
		const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
		if (imageExtensions.includes(extension)) {
			return `
				<img src="${file.file_url}" class="list-thumb preview-btn" data-file-id="${file.name}"
					style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);" alt="${file.file_name}">`;
		} else {
			return `
				<span class="preview-btn" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: var(--control-bg, #f4f5f6); transition: background 0.15s;" data-file-id="${file.name}">
					<i class="fa fa-eye" style="font-size: 13px; color: var(--text-muted);"></i>
				</span>`;
		}
	};
}
