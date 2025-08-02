class SVANotesManager {
    constructor(frm, wrapper) {
        this.frm = frm;
        this.wrapper = this.setupWrapper(wrapper);
        this.noteList = [];
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
    setupWrapper(wrapper) {
        // remove all children of wrapper
        wrapper.innerHTML = '';
        // while (wrapper.firstChild) {
        //     wrapper.removeChild(wrapper.firstChild);
        // }
        const notesWrapper = document.createElement('div');
        notesWrapper.id = 'notes-wrapper';

        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'notes-loading';
        loadingDiv.style.display = 'none';
        const loadingContent = document.createElement('div');
        loadingContent.style.display = 'flex';
        loadingContent.style.justifyContent = 'center';
        loadingContent.style.alignItems = 'center';
        loadingContent.style.height = '200px';
        const loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('loading-spinner'); // Define this CSS class
        loadingContent.appendChild(loadingSpinner);
        loadingDiv.appendChild(loadingContent);
        notesWrapper.appendChild(loadingDiv);

        wrapper.appendChild(notesWrapper);
        this.notes_wrapper = notesWrapper;
        return wrapper;
    }

    showLoading(show = true) {
        const loadingElement = this.notes_wrapper.querySelector('#notes-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    async initialize() {
        try {
            this.permissions = await this.get_permissions("Notes");
            
            // Check if user has at least read permission
            if (!this.permissions.includes('read')) {
                const noPermissionDiv = document.createElement('div');
                noPermissionDiv.style.cssText = `
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 20px;
                    text-align: center;
                    padding: 50px;
                    color: var(--gray-600);
                `;
                noPermissionDiv.textContent = "You do not have permission through role permission to access this resource.";
                this.notes_wrapper.appendChild(noPermissionDiv);
                return;
            }

            this.showLoading(true);
            await this.fetchNotes();
            this.renderLayout();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing NotesManager:', error);
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 20px;
                text-align: center;
                padding: 50px;
                color: var(--gray-600);
            `;
            errorDiv.textContent = `Failed to initialize notes: ${error.message || error}`;
            this.notes_wrapper.appendChild(errorDiv);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchNotes() {
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Notes',
                fields: [
                    'name',
                    'title',
                    'description',
                    'creation',
                    'owner'
                ],
                filters: {
                    'reference_doctype': this.frm.doc.doctype,
                    'related_to': this.frm.doc.name
                },
                limit_page_length: 10000,
            },
        });

        // Fetch full names for all owners
        const notes = response.message;
        const uniqueOwners = [...new Set(notes.map(note => note.owner))];

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

        // Add full names to notes
        this.noteList = notes.map(note => ({
            ...note,
            owner_full_name: ownerFullNames[note.owner]
        }));
    }

    renderLayout() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            * {
            margin: 0px;
            padding: 0px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            box-sizing: border-box;
        }
        .note_content {
            width: 100%;
            // padding: 20px;
        }
        .title_links {
            width: 100%;
            height: 700px; 
            min-height: 700px;
            overflow-y: auto;
        }
        .note-button {
            background-color: black;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
        }
        #default-message {
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        #action_icon {
            cursor: pointer;
            background: none;
            border: none;
            font-size: 20px;
            padding: 0;
        }
        .action-menu {
            position: relative;
        }
        .action-menu-content {
            display: none;
            position: absolute;
            right: 16px;
            top:7px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        .action-menu-content a {
            display: block;
            padding: 6px 35px;
            text-decoration: none;
            color: inherit;
        }
        .action-menu-content a:hover {
            background: #f8fafc;
        }
        .note_message {
            display: flex;
            min-height: 500px;
            height: 100%;
            justify-content: center;
            align-items: center;
        }
        .note-title {
            font-size: 24px;
            font-weight:normal ;
            margin-bottom: 20px;
        }
        .note-group {
            margin-bottom: 20px;

        }
        .group-title {
            font-size: 14px;
            color: #718096;
            margin-bottom: 10px;
        }
        .note-item {
            border-bottom: 1px solid #e2e8f0;
            padding: 10px;
            // margin-bottom: 15px;
        }
        .note-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;

        }

        .note-header h3 {
        font-weight: normal;
            font-size: 18px;
            margin: 0;
            flex-grow: 1;
            margin-right: 10px;
        }

        .frappe-control .ql-editor:not(.read-mode){
            min-height: 100px;
            Height: 36px;
            background-color: #fff;
            border: none;

        }
        .input-with-feedback form-control{
            background-color: red !important;

        }



        .note-content {
            margin-bottom: 10px;
        }
        .note-meta {
            display: flex;
            align-items: center;
            font-size: 12px;
            color: #718096;
            gap: 5px;
        }
        .add-note-link {
            color: #9C2B2E;
            text-decoration: none;
        }
        @media (max-width: 768px) {
            .note_content {
                padding: 10px;
            }
            .note-title {
                font-size: 20px;
            }
            .note-header h3 {
                font-size: 16px;
            }
            .note-item {
                padding: 10px;
            }
        }
        `; // Paste your CSS here
        document.head.appendChild(styleElement);

        const notesContainer = document.createElement('div');
        notesContainer.classList.add('notes-container');

        const formSection = document.createElement('div');
        formSection.classList.add('form-section');
        const createForm = document.createElement('div');
        createForm.id = 'create-form';
        formSection.appendChild(createForm);
        notesContainer.appendChild(formSection);

        const listSection = document.createElement('div');
        listSection.classList.add('list-section');
        const titleLinks = document.createElement('div');
        titleLinks.classList.add('title_links');
        listSection.appendChild(titleLinks);
        notesContainer.appendChild(listSection);


        this.wrapper.appendChild(notesContainer);
        this.createNoteForm();
        this.renderNotesList(); // Call this after appending to DOM
    }


    renderNotesList() {
        const groupedData = this.groupNotesByDate();
        const titleLinks = this.wrapper.querySelector('.title_links');
        titleLinks.innerHTML = ''; // Clear existing list

        if (Object.values(groupedData).every(group => group.length === 0)) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('note_message');
            messageDiv.textContent = "You haven't created a Record yet";
            titleLinks.appendChild(messageDiv);
            return;
        }

        for (const [groupName, notes] of Object.entries(groupedData)) {
            if (notes.length === 0) continue;

            const noteGroup = document.createElement('div');
            noteGroup.classList.add('note-group');

            const groupTitle = document.createElement('p');
            groupTitle.classList.add('group-title');
            groupTitle.textContent = groupName;
            noteGroup.appendChild(groupTitle);

            notes.forEach(note => {
                const noteItem = this.createNoteItemElement(note);
                noteGroup.appendChild(noteItem);
            });

            titleLinks.appendChild(noteGroup);
        }
    }

    createNoteItemElement(note) {
        const noteItem = document.createElement('div');
        noteItem.classList.add('note-item');

        const noteHeader = document.createElement('div');
        noteHeader.classList.add('note-header');

        const noteTitle = document.createElement('h3');
        noteTitle.textContent = note.title;
        noteHeader.appendChild(noteTitle);

        // Only show action menu if user has write or delete permission
        if (this.permissions.includes('write') || this.permissions.includes('delete')) {
            const actionMenu = document.createElement('div');
            actionMenu.classList.add('action-menu');

            const actionButton = document.createElement('button');
            actionButton.id = 'action_icon';
            actionButton.setAttribute('note_id', note.name);
            actionButton.textContent = '⋮';
            actionMenu.appendChild(actionButton);

            const actionMenuContent = document.createElement('div');
            actionMenuContent.classList.add('action-menu-content');
            actionMenuContent.style.display = 'none';

            // Only show edit option if user has write permission
            if (this.permissions.includes('write')) {
                const editLink = document.createElement('a');
                editLink.href = '#';
                editLink.classList.add('edit_note');
                editLink.textContent = 'Edit';
                actionMenuContent.appendChild(editLink);
            }

            // Only show delete option if user has delete permission
            if (this.permissions.includes('delete')) {
                const deleteLink = document.createElement('a');
                deleteLink.href = '#';
                deleteLink.classList.add('delete_note');
                deleteLink.textContent = 'Delete';
                actionMenuContent.appendChild(deleteLink);
            }

            actionMenu.appendChild(actionMenuContent);
            noteHeader.appendChild(actionMenu);
        }

        noteItem.appendChild(noteHeader);

        const noteContent = document.createElement('div');
        noteContent.classList.add('note-content');
        noteContent.innerHTML = note.description || '';
        noteItem.appendChild(noteContent);

        const noteMeta = document.createElement('div');
        noteMeta.classList.add('note-meta');

        const ownerSpan = document.createElement('span');
        ownerSpan.textContent = note.owner_full_name || note.owner;
        noteMeta.appendChild(ownerSpan);

        const separatorSpan = document.createElement('span');
        separatorSpan.textContent = '•';
        noteMeta.appendChild(separatorSpan);

        const timeAgoSpan = document.createElement('span');
        timeAgoSpan.textContent = this.timeAgo(note.creation);
        noteMeta.appendChild(timeAgoSpan);

        noteItem.appendChild(noteMeta);

        return noteItem;
    }

    groupNotesByDate() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const formatDate = date => new Date(date).toISOString().split('T')[0];

        return this.noteList.reduce((groups, note) => {
            const creationDate = formatDate(note.creation);
            if (creationDate === formatDate(today)) {
                groups.Today.push(note); // Changed to push for chronological order
            } else if (creationDate === formatDate(yesterday)) {
                groups.Yesterday.push(note);
            } else {
                groups.Older.push(note);
            }
            return groups;
        }, { Today: [], Yesterday: [], Older: [] });
    }

    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }
        return 'just now';
    }

    setupEventListeners() {
        // Only attach action menu listeners if user has write or delete permission
        if (this.permissions.includes('write') || this.permissions.includes('delete')) {
            this.wrapper.querySelectorAll('#action_icon').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const dropdown = button.nextElementSibling;
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                });
            });
        }

        // Only attach edit listeners if user has write permission
        if (this.permissions.includes('write')) {
            this.wrapper.querySelectorAll('.edit_note').forEach(link => {
                link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const noteName = link.closest('.note-item')
                        .querySelector('#action_icon')
                        .getAttribute('note_id');
                    await this.handleEditNote(noteName);
                });
            });
        }

        // Only attach delete listeners if user has delete permission
        if (this.permissions.includes('delete')) {
            this.wrapper.querySelectorAll('.delete_note').forEach(link => {
                link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const noteName = link.closest('.action-menu')
                        .querySelector('#action_icon')
                        .getAttribute('note_id');
                    await this.handleDeleteNote(noteName);
                });
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.matches('#action_icon')) {
                this.wrapper.querySelectorAll('.action-menu-content').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
    }

    async handleEditNote(noteName) {
        try {
            // Fetch the note details
            const { message: latestNote } = await frappe.call({
                method: 'frappe.client.get',
                args: { doctype: 'Notes', name: noteName },
            });

            if (!latestNote) {
                frappe.show_alert({ message: 'Failed to fetch note details', indicator: 'red' });
                return;
            }

            // Get the metadata for the doctype
            const { message: meta } = await frappe.call({
                method: 'frappe_theme.api.get_meta',
                args: { doctype: 'Notes' },
            });

            if (!meta || !meta.fields) {
                frappe.show_alert({ message: 'Failed to fetch doctype metadata', indicator: 'red' });
                return;
            }

            // Clear and use the create form container for editing
            const formContainer = this.wrapper.querySelector('#create-form');
            while (formContainer.firstChild) { // Clear existing form using while loop
                formContainer.removeChild(formContainer.firstChild);
            }

            // Render fields using make_control (same as before)
            const fieldControls = [];
            meta.fields.forEach(f => {
                if (f.hidden) return;

                const fieldWrapper = document.createElement('div');
                fieldWrapper.classList.add('my-control', 'mb-3');
                formContainer.appendChild(fieldWrapper);

                const control = frappe.ui.form.make_control({
                    parent: fieldWrapper,
                    df: {
                        fieldname: f.fieldname,
                        fieldtype: f.fieldtype || 'Data',
                        options: f.fieldtype === 'Link' ? f.options : undefined,
                        default: latestNote[f.fieldname] || '',
                        read_only: f.read_only || 0,
                        hidden: f.hidden || 0,
                    },
                    render_input: true,
                });
                $(control.label_area).remove(); // Keep this for label removal

                const formControl = control.wrapper.querySelector('.form-control');
                if (formControl) {
                    formControl.style.backgroundColor = 'white';
                    formControl.style.marginBottom = '0px';

                    formControl.addEventListener('focus', () => {
                        formControl.style.backgroundColor = 'white';
                        formControl.style.boxShadow = 'none';
                        formControl.style.border = 'none';
                    });
                }

                control.refresh();
                if (latestNote[f.fieldname]) {
                    control.set_value(latestNote[f.fieldname]);
                }

                fieldControls.push(control);
            });

            // Add button container (using DOM manipulation)
            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('button-container', 'pb-4');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'flex-end';
            buttonContainer.style.gap = '10px';
            formContainer.appendChild(buttonContainer);

            const cancelButton = document.createElement('button');
            cancelButton.classList.add('btn', 'btn-secondary');
            cancelButton.textContent = 'Cancel';
            buttonContainer.appendChild(cancelButton);

            const updateButton = document.createElement('button');
            updateButton.classList.add('btn', 'btn-primary');
            updateButton.textContent = 'Update';
            buttonContainer.appendChild(updateButton);


            // Cancel button handler (using DOM manipulation)
            cancelButton.addEventListener('click', async () => {
                while (formContainer.firstChild) {
                    formContainer.removeChild(formContainer.firstChild);
                }
                this.createNoteForm();
            });

            // Update button handler (using DOM manipulation)
            updateButton.addEventListener('click', async () => {
                const updatedValues = {};
                let validationFailed = false;

                fieldControls.forEach(control => {
                    const value = control.get_value();
                    if (control.df.reqd && !value) {
                        validationFailed = true;
                        frappe.msgprint({ message: `Field "${control.df.label}" is mandatory`, indicator: 'red' });
                    }
                    updatedValues[control.df.fieldname] = value;
                });

                if (validationFailed) return;

                try {
                    await frappe.db.set_value('Notes', noteName, updatedValues);
                    frappe.show_alert({ message: 'Note updated successfully', indicator: 'green' });

                    // Refresh notes list (using DOM manipulation)
                    await this.fetchNotes();
                    this.renderNotesList();
                    this.setupEventListeners();

                    while (formContainer.firstChild) {
                        formContainer.removeChild(formContainer.firstChild);
                    }
                    this.createNoteForm();

                } catch (err) {
                    frappe.show_alert({ message: `Error: ${err.message}`, indicator: 'red' });
                }
            });

        } catch (err) {
            frappe.msgprint({ message: `Error: ${err.message}`, indicator: 'red' });
        }
    }

    async handleDeleteNote(noteName) {
        frappe.confirm('Are you sure you want to delete this Note?',
            async () => {
                try {
                    await frappe.db.delete_doc('Notes', noteName);
                    frappe.show_alert({ message: 'Note deleted successfully', indicator: 'green' });

                    // Refresh notes list (using DOM manipulation)
                    await this.fetchNotes();
                    this.renderNotesList();  // Re-render the list
                    this.setupEventListeners(); // Re-attach event listeners

                } catch (error) {
                    frappe.show_alert({ message: `Error: ${error.message}`, indicator: 'red' });
                }
            }
        );
    }

    async createNoteForm() {
        // Only show form if user has create permission
        if (!this.permissions.includes('create')) {
            return;
        }

        try {
            const { message: meta } = await frappe.call({
                method: 'frappe_theme.api.get_meta',
                args: { doctype: 'Notes' }
            });

            if (!meta || !meta.fields) {
                frappe.show_alert({ message: 'Failed to fetch metadata', indicator: 'red' });
                return;
            }

            const formContainer = this.wrapper.querySelector('#create-form');
            while (formContainer.firstChild) { // Clear existing form (important!)
                formContainer.removeChild(formContainer.firstChild);
            }

            const fieldControls = [];

            meta.fields.forEach(f => {
                if (f.hidden) return;

                const fieldWrapper = document.createElement('div');
                fieldWrapper.classList.add('my-control', 'mb-3');
                formContainer.appendChild(fieldWrapper);

                if (f.fieldname === 'reference_doctype') {
                    f.default = this.frm.doc.doctype;
                }
                if (f.fieldname === 'related_to') {
                    f.default = this.frm.doc.name;
                    if (f.fieldtype === "Dynamic Link") {
                        f.options = "Your Target Doctype"; // Or fetch dynamically if needed
                    }
                }

                const control = frappe.ui.form.make_control({
                    parent: fieldWrapper,
                    df: {
                        label: f.label || f.fieldname,
                        fieldname: f.fieldname,
                        fieldtype: f.fieldtype || 'Data',
                        options: f.fieldtype === 'Link' ? f.options : undefined,
                        default: f.default || '',
                        read_only: f.read_only || 0,
                        hidden: f.hidden || 0,
                        placeholder: f.placeholder || '',
                    },
                    render_input: true
                });
                $(control.label_area).remove();

                const formControl = control.wrapper.querySelector('.form-control');
                if (formControl) {
                    // Styling code remains the same
                }

                if (f.fieldtype === 'Dynamic Link' && f.options) {
                    control.df.options = f.options;
                }

                control.refresh();

                if (f.default) {
                    control.set_value(f.default);
                }

                fieldControls.push(control);
            });

            const submitButton = document.createElement('button');
            submitButton.classList.add('btn', 'btn-primary');
            submitButton.textContent = 'Save';
            submitButton.style.float = 'right';
            submitButton.style.marginLeft = 'auto';
            formContainer.appendChild(submitButton);

            const clearfix = document.createElement('div');
            clearfix.style.clear = 'both';
            formContainer.appendChild(clearfix);

            submitButton.addEventListener('click', async () => {
                const newNoteValues = {};
                let validationFailed = false;

                fieldControls.forEach(control => {
                    const value = control.get_value();
                    if (control.df.reqd && !value) {
                        validationFailed = true;
                        frappe.msgprint({ message: `Field "${control.df.label}" is mandatory`, indicator: 'red' });
                    }
                    newNoteValues[control.df.fieldname] = value;
                });

                if (validationFailed) return;

                newNoteValues['reference_doctype'] = this.frm.doc.doctype;
                newNoteValues['related_to'] = this.frm.doc.name;

                try {
                    const { message } = await frappe.call({
                        method: 'frappe.client.insert',
                        args: { doc: { doctype: 'Notes', ...newNoteValues } }
                    });

                    if (message) {
                        frappe.show_alert({ message: 'Note Created Successfully', indicator: 'green' });

                        fieldControls.forEach(control => {
                            if (!['reference_doctype', 'related_to'].includes(control.df.fieldname)) {
                                control.set_value('');
                            }
                        });

                        // Refresh notes list using DOM manipulation
                        await this.fetchNotes();
                        this.renderNotesList();
                        this.setupEventListeners();

                    }
                } catch (error) {
                    frappe.show_alert({ message: `Error: ${error.message}`, indicator: 'red' });
                }
            });

        } catch (error) {
            frappe.msgprint({ message: `Error: ${error.message}`, indicator: 'red' });
        }
    }
}

export default SVANotesManager;