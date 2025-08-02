import Loader from '../loader-element.js';


class SVAGalleryComponent {
    constructor(frm, wrapper) {
        this.frm = frm;
        this.wrapper = wrapper;
        this.gallery_files = [];
        this.selectedFiles = [];
        this.view = 'Card'; // Default view
        this.permissions = [];
        this.initialize();
        return this.wrapper;
    }
    get_permissions(doctype) {
        return new Promise((rslv, rjct) => {
            frappe.call({
                method: 'frappe_theme.api.get_permissions',
                args: { doctype: doctype },
                callback: function (response) {
                    rslv(response.message)
                },
                error: (err) => {
                    rjct(err);
                }
            });
        });
    }
    async initialize() {
        try {
            if (!this.wrapper) {
                console.error('Wrapper element is null');
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
            if (!this.permissions.includes('read')) {
                const noPermissionDiv = document.createElement('div');
                noPermissionDiv.id = 'noPermissionPage';
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
                noPermissionDiv.textContent = "You do not have permission through role permission to access this resource.";

                // Clear the gallery body and append the no permission message
                const galleryBody = this.wrapper.querySelector('#gallery-body');
                galleryBody.innerHTML = '';
                galleryBody.appendChild(noPermissionDiv);
                return;
            }

            // Continue with initialization only if read permission exists
            this.appendGalleryStyles();
            await this.fetchGalleryFiles();
            this.renderHeader();
            this.updateGallery();
            this.attachEventListeners();
        } catch (error) {
            console.error('Error in initialize:', error);
            const errorDiv = document.createElement('div');
            errorDiv.id = 'errorPage';
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

            const galleryBody = this.wrapper.querySelector('#gallery-body');
            galleryBody.innerHTML = '';
            galleryBody.appendChild(errorDiv);
        }
    }

    appendGalleryStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .gallery-wrapper {
                height: calc(100vh - 270px);
                min-height: 400px;
                position: relative;
                display: flex;
                flex-direction: column;
            }
            .gallery-header {
                padding: 0px 0px 12px 0px;
                background: #fff;
                border-bottom: 1px solid #e2e2e2;
                z-index: 1;
            }
            .gallery-body {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
            }
            .empty-state {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px;
                text-align: center;
                color: #6E7073;
            }
            .empty-state i {
                font-size: 48px;
                margin-bottom: 16px;
                color: #E2E2E2;
            }
            .empty-state p {
                font-size: 16px;
                margin-bottom: 16px;
            }
            ${this.getCommonStyles()}
        `;
        document.head.appendChild(style);
    }

    getCommonStyles() {
        return `
            .gallery {
                margin-bottom: 20px;
            }
            .checkbox-container {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 2;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .image-container:hover .checkbox-container,
            .checkbox-container input[type="checkbox"]:checked {
                opacity: 1;
            }
            .checkbox-container.selected {
                opacity: 1;
            }
            .checkbox-container input[type="checkbox"] {
                width: 20px !important;
                height: 20px !important;
                background-color: rgba(255, 255, 255, 0.9);
                border: 2px solid #fff;
                border-radius: 4px;
            }
            .card-img-top {
                width: 100%;
                height: 200px;
                border-bottom:1px solid #e2e2e2;
                object-fit: cover;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            .image-card {
                width: 100%;
                background: white;
                border-radius: 8px;
                border:1px solid #e2e2e2;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .image-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px rgba(0,0,0,0.15);
            }
            .image-container {
                position: relative;
            }
            .image-container:hover .image-cover {
                opacity: 1;
                visibility: visible;
            }
            .image-cover {
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
            .cover-header {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 2;
            }
            .cover-body {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .action-button {
                background: rgba(255, 255, 255, 0.9);
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                color: #1F272E;
                transition: background-color 0.2s;
            }
            .action-button:hover {
                background: #ffffff;
            }
            .view-button {
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
            .view-button:hover {
                transform: scale(1.1);
                background: #ffffff;
                text-decoration: none;
                color: #1F272E;
            }
            .file-name {
                padding: 6px 12px ;
                font-size: 14px;
                color: #1F272E;
                word-break: break-word;
            }
            .file-date {
                padding: 0 12px 6px;
                font-size: 12px;
                color: #6E7073;
            }
            /* Frappe List View Styles */
            .frappe-list {
                background-color: var(--fg-color);
                border-radius: var(--border-radius-md);
                box-shadow: var(--card-shadow);
            }
            .frappe-list-row {
                display: flex;
                align-items: center;
                padding: 12px 15px;
                border-bottom: 1px solid var(--border-color);
                transition: background-color 0.2s;
            }
            .frappe-list-row:hover {
                background-color: var(--fg-hover-color);
            }
            .frappe-list-col {
                padding: 0 8px;
                font-size: var(--text-md);
            }
            .frappe-list-col-checkbox {
                width: 30px;
            }
            .frappe-list-col-subject {
                flex: 2;
                min-width: 200px;
            }
            .frappe-list-col-creation {
                width: 140px;
            }
            .frappe-list-col-preview {
                width: 100px;
            }
            .frappe-list-col-actions {
                width: 40px;
                text-align: right;
            }
            .frappe-list-header {
                background-color: var(--fg-color);
                border-bottom: 1px solid var(--border-color);
                font-weight: 600;
                color: var(--text-muted);
            }
            .frappe-list-header .frappe-list-row:hover {
                background-color: var(--fg-color);
            }
            .list-actions {
                opacity: 0;
                transition: opacity 0.2s;
            }
            .frappe-list-row:hover .list-actions {
                opacity: 1;
            }
            .list-row-checkbox {
                margin: 0;
            }
            @media (max-width: 768px) {
                .gallery-wrapper {
                    height: calc(100vh - 200px);
                }
                .card-img-top {
                    height: 160px;
                }
                .image-cover {
                    height: 160px;
                }
            }
        `;
    }

    async fetchGalleryFiles() {
        const loader = new Loader(this.wrapper.querySelector('.gallery-wrapper'), 'gallery-fetch-loader');
        try {
            loader.show();
            if (!this.frm || !this.frm.doc) {
                console.error('Form or document not initialized');
                return;
            }

            const filters = {
                'attached_to_name': ['=', this.frm.doc.name],
                'attached_to_doctype': ['=', this.frm.doc.doctype],
                'is_folder': 0
            };

            this.gallery_files = await frappe.db.get_list('File', {
                fields: ['*'],  // Get all fields
                filters: filters,
                order_by: 'creation desc',
                limit: 1000,
            }) || [];
            const uniqueOwners = [...new Set(this.gallery_files.map(file => file.owner))];

            const { message: ownerNames } = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    filters: { name: ['in', uniqueOwners] },
                    fields: ['name', 'full_name']
                }
            });

            // Create a map of user names to full names
            const ownerFullNames = {};
            ownerNames.forEach(user => {
                ownerFullNames[user.name] = user.full_name;
            });
            this.gallery_files = this.gallery_files.map(file => ({
                ...file,
                owner_full_name: ownerFullNames[file.owner]
            }));
            this.updateGallery();
        } catch (error) {
            console.error('Error fetching files:', error);
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Error fetching files: ') + (error.message || error)
            });
        } finally {
            loader.hide();
        }
    }

    render() {
        this.wrapper.innerHTML = ''; // Clear existing content

        // Create wrapper with fixed height and scrollable content
        this.wrapper.innerHTML = `
            <div class="gallery-wrapper">
                <div class="gallery-header" id="gallery-header"></div>
                <div class="gallery-body" id="gallery-body"></div>
            </div>
        `;

        this.renderHeader();
        this.updateGallery();
    }

    renderHeader() {
        const canCreate = this.permissions.includes('create');
        const canDelete = this.permissions.includes('delete');

        const headerHTML = `
            <div class="row" style="display: flex; justify-content: space-between; align-items: center; margin: 0;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span class="text-muted">Total records: ${this.gallery_files.length}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${canDelete ? `
                        <button class="btn btn-danger btn-sm" style="display:none;" id="deleteSelectedButton">
                            <i class="fa fa-trash"></i> Delete Selected
                        </button>
                    ` : ''}
                    <div class="btn-group">
                        <button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown">
                            <i class="fa ${this.view === 'Card' ? 'fa-th-large' : 'fa-list'}"></i>
                            <span id="viewNameButton">${this.view} View</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-right">
                            <li><a class="dropdown-item" id="cardViewBtn"><i class="fa fa-th-large"></i> Card View</a></li>
                            <li><a class="dropdown-item" id="listViewBtn"><i class="fa fa-list"></i> List View</a></li>
                        </ul>
                    </div>
                    ${canCreate ? `
                        <button class="btn btn-primary btn-sm" id="customUploadButton">
                            <i class="fa fa-upload"></i> Upload
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        this.wrapper.querySelector('#gallery-header').innerHTML = headerHTML;
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
        // return console.log(frm)
        let file_extension = frm?.file_url?.split(".").pop();
        let show_file = new frappe.ui.Dialog({
            title: __('Preview File'),
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_html',
                    options: ""
                }
            ],
            primary_action_label: __('Download'),
            primary_action() {
                let link = document.createElement('a');
                link.href = frm.file_url;
                link.download = frm.file_name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },
            secondary_action_label: __('Close'),
            secondary_action() {
                show_file.hide();
            }
        });
        let $preview = "";
        // if(!frappe.utils.is_image_file(frm.file_url)){
        //     show_file.get_primary_btn().hide();
        // }
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
            return size + ' Bytes';
        } else if (size < 1048576) {
            return (size / 1024).toFixed(2) + ' KB';
        } else if (size < 1073741824) {
            return (size / 1048576).toFixed(2) + ' MB';
        }
    }
    renderCardView() {
        if (!this.gallery_files.length) {
            return this.renderEmptyState();
        }

        const canWrite = this.permissions.includes('write');
        const canDelete = this.permissions.includes('delete');

        return `
            <div class="row">
                ${this.gallery_files.map(file => {
            let extension = file?.file_url?.split('.').pop()?.toLowerCase();
            return `
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
                            <div class="image-card">
                                <div class="image-container">
                                    ${this.getFilePreview(file, extension)}
                                    ${canDelete ? `
                                        <div class="checkbox-container">
                                            <input type="checkbox" data-id="${file.name}" class="toggleCheckbox"/>
                                        </div>
                                    ` : ''}
                                    <div class="image-cover">
                                        ${(canWrite || canDelete) ? `
                                            <div class="cover-header">
                                                <div class="dropdown">
                                                    <button class="action-button" data-toggle="dropdown">
                                                        <i class="fa fa-ellipsis-v"></i>
                                                    </button>
                                                    <div class="dropdown-menu dropdown-menu-right">
                                                        ${canWrite ? `
                                                            <a class="dropdown-item edit-btn" data-id="${file.name}">
                                                                <i class="fa fa-edit"></i> Edit
                                                            </a>
                                                        ` : ''}
                                                        ${canDelete ? `
                                                            <a class="dropdown-item delete-btn" data-id="${file.name}">
                                                                <i class="fa fa-trash"></i> Delete
                                                            </a>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ` : ''}
                                        <div class="cover-body">
                                            <p class="view-button preview-btn" style="cursor: pointer;" data-file='${JSON.stringify(file)}'>
                                                <i class="fa fa-eye"></i>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div class="file-name" style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;" title="${file.file_name}">${file.file_name}</div>
                                <div class="d-flex justify-content-between">
                                    <div class="file-date">${frappe.datetime.str_to_user(file.creation)?.split(' ')[0]}</div>
                                    <div class="file-date">
                                        ${this.convertTofileSize(file.file_size)}
                                    </div>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <div class="file-date" style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;"
                                        title="by ${file.owner_full_name} ${file.owner != 'Administrator' ? `(${file.owner})` : ''}">
                                        by ${file.owner_full_name} ${file.owner != 'Administrator' ? `(${file.owner})` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    getFileIcon(extension) {
        const iconMap = {
            // Documents
            'pdf': 'fa fa-file-pdf-o',
            'doc': 'fa fa-file-word-o',
            'docx': 'fa fa-file-word-o',
            'txt': 'fa fa-file-text-o',
            // Spreadsheets
            'xls': 'fa fa-file-excel-o',
            'xlsx': 'fa fa-file-excel-o',
            'csv': 'fa fa-file-excel-o',
            // Presentations
            'ppt': 'fa fa-file-powerpoint-o',
            'pptx': 'fa fa-file-powerpoint-o',
            // Images
            'jpg': 'fa fa-file-image-o',
            'jpeg': 'fa fa-file-image-o',
            'png': 'fa fa-file-image-o',
            'gif': 'fa fa-file-image-o',
            'bmp': 'fa fa-file-image-o',
            // Video
            'mp4': 'fa fa-file-video-o',
            'avi': 'fa fa-file-video-o',
            'mov': 'fa fa-file-video-o',
            'wmv': 'fa fa-file-video-o',
            // Audio
            'mp3': 'fa fa-file-audio-o',
            'wav': 'fa fa-file-audio-o',
            // Archives
            'zip': 'fa fa-file-archive-o',
            'rar': 'fa fa-file-archive-o',
            '7z': 'fa fa-file-archive-o',
            // Code
            'js': 'fa fa-file-code-o',
            'css': 'fa fa-file-code-o',
            'html': 'fa fa-file-code-o',
            'py': 'fa fa-file-code-o',
        };

        return iconMap[extension?.toLowerCase()] || 'fa fa-file-o';
    }

    getFilePreview(file, extension) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];

        if (imageExtensions.includes(extension)) {
            return `<img src="${file.file_url}" class="card-img-top" alt="${file.file_name}">`;
        } else {
            const iconClass = this.getFileIcon(extension);
            return `
                <div class="card-img-top d-flex align-items-center justify-content-center" style="height: 200px; background-color: #f8f9fa;">
                    <div class="file-icon text-center">
                        <i class="${iconClass}" style="font-size: 48px; color: #6c757d;"></i>
                        <div style="font-size: 12px; margin-top: 8px; color: #6c757d;">.${extension}</div>
                        </div>
                        </div>
                        `;
        }
    }

    async renderForm(mode, fileId = null) {
        const self = this;
        let fields = [
            {
                label: 'File',
                fieldname: 'file',
                fieldtype: mode === 'create' ? 'Attach' : 'Data',
                reqd: mode === 'create' ? 1 : 0,
                read_only: mode === 'edit' ? 1 : 0,
                options: {
                    allow_multiple: mode === 'create' ? true : false,
                    doctype: this.frm?.doctype,
                    docname: this.frm?.docname,
                    on_success: function (file_doc) {
                        if (file_doc) {
                            fileDialog.hide();
                            self.gallery_files.unshift(file_doc);
                            self.render();
                            self.updateGallery();
                        }
                    }
                }
            },
            {
                label: 'File Name',
                fieldname: 'file_name',
                fieldtype: 'Data',
                reqd: mode === 'create' ? 0 : 1,
                hidden: mode === 'create' ? 1 : 0,
                description: 'Enter a name for your file'
            }
        ];

        if (mode === 'edit' && fileId) {
            try {
                let doc = await frappe.db.get_doc('File', fileId);
                fields = fields.map(f => {
                    if (f.fieldname === 'file' && doc.file_url) {
                        f.default = doc.file_url;
                        return f;
                    }
                    if (doc[f.fieldname]) {
                        f.default = doc[f.fieldname];
                    }
                    return f;
                });
            } catch (error) {
                console.error('Error fetching file:', error);
                frappe.msgprint(__('Error fetching file details. Please try again.'));
                return;
            }
        }
        const fileDialog = new frappe.ui.Dialog({
            title: mode === "create" ? __("Upload Files") : __("Edit File"),
            fields: fields,
            primary_action_label: mode === "create" ? __("Upload") : __("Save"),
            async primary_action(values) {
                try {
                    if (!values.file) {
                        frappe.msgprint(__('Please select a file to upload'));
                        return;
                    }

                    if (!values.file_name) {
                        values.file_name = values.file.split('/').pop().split('?')[0];
                    }
                    if (mode === 'edit' && fileId) {
                        values['file_url'] = values.file
                        delete values.file
                        let updated_file = await frappe.db.set_value('File', fileId, values);
                        if (updated_file?.message) {
                            self.gallery_files = self.gallery_files.map(file =>
                                file.name === fileId ? updated_file.message : file
                            );
                            await self.fetchGalleryFiles();
                            frappe.show_alert({
                                message: __('File updated successfully'),
                                indicator: 'green'
                            });
                        }
                    }

                    self.updateGallery();
                    this.hide();
                } catch (error) {
                    console.error('Error handling file:', error);
                    frappe.msgprint(`Error ${mode === 'create' ? 'uploading' : 'updating'} file: ${error.message || error}`);
                }
            }
        });

        fileDialog.show();
        this.dialog = fileDialog;
    }

    attachEventListeners() {
        const self = this;

        if (this.permissions.includes('create')) {
            $('#customUploadButton').off('click').on('click', async () => {
                await self.renderForm('create');
            });
        }

        if (this.permissions.includes('delete')) {
            $('#deleteSelectedButton').off('click').on('click', async () => {
                if (self.selectedFiles.length === 0) {
                    frappe.msgprint(__('Please select files to delete'));
                    return;
                }

                frappe.confirm('Are you sure you want to delete the selected files?', async () => {
                    try {
                        for (const fileId of self.selectedFiles) {
                            await frappe.db.delete_doc('File', fileId);
                        }
                        self.gallery_files = self.gallery_files.filter(file => !self.selectedFiles.includes(file.name));
                        self.selectedFiles = [];
                        self.render();
                        self.updateSelectedFilesUI();
                        frappe.show_alert({
                            message: __('Files deleted successfully'),
                            indicator: 'green'
                        });
                    } catch (error) {
                        console.error("Error deleting files:", error);
                        frappe.msgprint(__('Error deleting files. Please try again.'));
                    } finally {
                        loader.hide();
                    }
                });
            });
        }

        // View switching remains accessible to all users with read permission
        $('#cardViewBtn').off('click').on('click', () => {
            self.view = 'Card';
            self.selectedFiles = [];
            $('#viewNameButton').text('Card View');
            self.updateSelectedFilesUI();
            self.updateGallery();
        });

        $('#listViewBtn').off('click').on('click', () => {
            self.view = 'List';
            self.selectedFiles = [];
            $('#viewNameButton').text('List View');
            self.updateSelectedFilesUI();
            self.updateGallery();
        });

        this.attachGalleryItemEventListeners();
    }

    attachGalleryItemEventListeners() {
        const self = this;

        $('.delete-btn').off('click').on('click', async function () {  // Remove previous handlers
            const fileId = $(this).data('id');
            if (fileId) {
                try {
                    frappe.confirm('Are you sure you want to delete this file?', async () => {
                        await frappe.db.delete_doc('File', fileId);
                        self.gallery_files = self.gallery_files.filter(file => file.name !== fileId);
                        self.render();
                    });
                } catch (error) {
                    console.error(error);
                }
            }
        });

        $('.preview-btn').off('click').on('click', function () {
            const fileData = $(this).data('file');
            if (fileData) {
                self.preview_file(fileData);
            }
        });

        $('.edit-btn').off('click').on('click', async function () { // Remove previous handlers
            const fileId = $(this).data('id');
            await self.renderForm('edit', fileId); // Use self here
        });

        $('.toggleCheckbox').off('change').on('change', function () { // Remove previous handlers
            const fileId = $(this).data('id');
            const checkboxContainer = $(this).closest('.checkbox-container');

            if (this.checked) {
                self.selectedFiles.push(fileId);
                checkboxContainer.addClass('selected');
            } else {
                self.selectedFiles = self.selectedFiles.filter((fid) => fid != fileId);
                checkboxContainer.removeClass('selected');
            }
            self.updateSelectedFilesUI();
        });

        $('#selectAllCheckBox').off('change').on('change', function () {
            const isChecked = this.checked;
            self.selectedFiles = isChecked ? self.gallery_files.map(file => file.name) : [];
            $('.toggleCheckbox').prop('checked', isChecked);
            if (isChecked) {
                $('.checkbox-container').addClass('selected');
            } else {
                $('.checkbox-container').removeClass('selected');
            }
            self.updateSelectedFilesUI();
        });
    }

    updateSelectedFilesUI() {
        const deleteSelectedButton = document.getElementById('deleteSelectedButton');

        // Only update delete button if it exists (user has delete permission)
        if (deleteSelectedButton) {
            if (this.selectedFiles.length > 0) {
                deleteSelectedButton.style.display = 'block';
            } else {
                deleteSelectedButton.style.display = 'none';
            }
        }

        // Update select all checkbox if it exists
        const selectAllCheckbox = document.getElementById('selectAllCheckBox');
        if (selectAllCheckbox) {
            if (this.selectedFiles.length === this.gallery_files.length) {
                selectAllCheckbox.checked = true;
            } else {
                selectAllCheckbox.checked = false;
            }
        }
    }

    updateGallery() {
        const bodyWrapper = this.wrapper.querySelector('#gallery-body');
        if (this.view === 'Card') {
            bodyWrapper.innerHTML = this.renderCardView();
        } else {
            bodyWrapper.innerHTML = this.renderListView();
        }
        bodyWrapper.style.height = '75vh';
        // bodyWrapper.style.minHeight = '500px';
        bodyWrapper.style.overflow = 'auto';
        this.attachGalleryItemEventListeners(); // Attach event listeners to gallery items
        this.attachEventListeners();
    }

    renderListView() {
        if (!this.gallery_files.length) {
            return this.renderEmptyState();
        }

        const canWrite = this.permissions.includes('write');
        const canDelete = this.permissions.includes('delete');

        return `
            <div class="frappe-list">
                <div class="frappe-list-header">
                    <div class="frappe-list-row">
                        ${canDelete ? `
                            <div class="frappe-list-col frappe-list-col-checkbox">
                                <input type="checkbox" class="list-row-checkbox" id="selectAllCheckBox">
                            </div>
                        ` : ''}
                        <div class="frappe-list-col frappe-list-col-subject">File Name</div>
                        <div class="frappe-list-col frappe-list-col-creation">Upload Date</div>
                        <div class="frappe-list-col frappe-list-col-preview">Preview</div>
                        ${(canWrite || canDelete) ? `
                            <div class="frappe-list-col frappe-list-col-actions"></div>
                        ` : ''}
                    </div>
                </div>
                <div class="frappe-list-body">
                    ${this.gallery_files.map(file => {
            let extension = file?.file_url?.split('.').pop()?.toLowerCase();
            return `
                            <div class="frappe-list-row">
                                ${canDelete ? `
                                    <div class="frappe-list-col frappe-list-col-checkbox">
                                        <input type="checkbox" class="list-row-checkbox toggleCheckbox" data-id="${file.name}">
                                    </div>
                                ` : ''}
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
                                    <p class="preview-btn" style="cursor: pointer;" data-file='${JSON.stringify(file)}'>
                                        <i class="fa fa-eye"></i>
                                    </p>
                                </div>
                                ${(canWrite || canDelete) ? `
                                    <div class="frappe-list-col frappe-list-col-actions">
                                        <div class="list-actions">
                                            <div class="dropdown">
                                                <button class="btn btn-link btn-sm" data-toggle="dropdown">
                                                    <i class="fa fa-ellipsis-v text-muted"></i>
                                                </button>
                                                <div class="dropdown-menu dropdown-menu-right">
                                                    ${canWrite ? `
                                                        <a class="dropdown-item edit-btn" data-id="${file.name}">
                                                            <i class="fa fa-edit text-muted"></i> Edit
                                                        </a>
                                                    ` : ''}
                                                    ${canDelete ? `
                                                        <a class="dropdown-item delete-btn" data-id="${file.name}">
                                                            <i class="fa fa-trash text-muted"></i> Delete
                                                        </a>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }
}

export default SVAGalleryComponent;