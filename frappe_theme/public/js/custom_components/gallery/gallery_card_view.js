/**
 * Card View Mixin for SVAGalleryComponent
 * Handles card-based file rendering with grouped folders
 */

export function getCardViewStyles() {
	return `
		.gallery-wrapper .card-img-top {
			width: 100%;
			height: 200px;
			border-bottom: 1px solid #e2e2e2;
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
		.gallery-wrapper .image-container {
			position: relative;
		}
		.gallery-wrapper .image-container:hover .image-cover {
			opacity: 1;
			visibility: visible;
		}
		.gallery-wrapper .image-container.menu-active .image-cover {
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
		.gallery-wrapper .pdf-thumbnail-wrapper {
			background: #f5f5f5;
		}
	`;
}

export function applyCardViewMixin(GalleryClass) {
	GalleryClass.prototype.renderCardView = function () {
		if (!this.gallery_files.length) {
			return this.renderEmptyState();
		}
		return this._renderCardGroupTree(this.groupTree, "");
	};

	GalleryClass.prototype._renderCardGroupTree = function (tree, parentPath) {
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
	};

	GalleryClass.prototype._renderFileCard = function (file, canWrite, canDelete) {
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
								<button class="action-button file-action-menu-btn" data-file-id="${file.name}" data-can-write="${canWrite}" data-can-delete="${canDelete}">
									<i class="fa fa-ellipsis-v"></i>
								</button>
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
	};
}
