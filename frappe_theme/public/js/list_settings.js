class ListSettings {
	constructor({ doctype, meta, settings, dialog_primary_action }) {
		if (!doctype) {
			frappe.throw("DocType required");
		}
		this.doctype = doctype;
		this.meta = meta;
		this.settings = settings;
		this.dialog = null;
		this.dialog_primary_action = dialog_primary_action;
		this.listview_settings =
			this.settings && this.settings.listview_settings ? JSON.parse(this.settings.listview_settings) : [];
		if (typeof this.listview_settings === 'string') {
			this.listview_settings = JSON.parse(this.listview_settings)
		}
		this.additional_fields = [
			{
				label: __("Created On"),
				value: "creation",
				checked: false
			},
			{
				label: __("Created By"),
				value: "owner",
				checked: false
			},
			{
				label: __("Modified On"),
				value: "modified",
				checked: false
			},
			{
				label: __("Modified By"),
				value: "modified_by",
				checked: false
			},
		];
		// this.subject_field = null;

		frappe.run_serially([
			this.make(),
			this.get_listview_fields(meta),
			this.setup_fields(),
			this.setup_remove_fields(),
			this.add_new_fields(),
			this.show_dialog()
		])
	}

	make() {
		let me = this;
		me.dialog = new frappe.ui.Dialog({
			title: __("{0} Settings", [__(me.doctype)]),
			fields: [
				{
					label: __("Fields"),
					fieldname: "listview_settings",
					fieldtype: "Code",
					hidden: 1,
				},
				{
					label: "",
					fieldname: "description_cus",
					fieldtype: "HTML",
					options: '<p><b>Note</b>: The system converts width values using a scale where 1 unit equals 50 pixels.</p>'
				},
				{
					label: __("Fields"),
					fieldname: "fields_html",
					fieldtype: "HTML"
				},
			],
		});
		me.dialog.set_values(me.settings);
		me.dialog.set_primary_action(__("Save"), () => {
			this.dialog_primary_action(me.listview_settings)
			me.dialog.hide();
		});

	}

	refresh() {
		let me = this;
		me.setup_fields();
		me.add_new_fields();
		me.setup_remove_fields();
	}

	show_dialog() {
		let me = this;

		if (!this.settings?.fields) {
			me.update_fields();
		}

		me.dialog.show();
	}

	setup_fields() {
		let me = this;
		let fields_html = me.dialog.get_field("fields_html");
		let wrapper = fields_html.$wrapper[0];
		let fields = ``;

		for (let idx in me.listview_settings) {
			// let is_sortable = idx == 0 ? `` : `sortable`;
			// let show_sortable_handle = idx == 0 ? `hide` : ``;
			fields += `
				<div class="control-input flex align-center form-control fields_order sortable"
					style="display: block; margin-bottom: 5px;" data-fieldname="${me.listview_settings[idx].fieldname}"
					data-label="${me.listview_settings[idx].label}" data-type="${me.listview_settings[idx].type}">

					<div class="row">
						<div class="col-1">
							${frappe.utils.icon("drag", "xs", "", "", "sortable-handle ")}
						</div>
						<div class="col-10" style="padding-left:0px;">
							<div class="row align-items-center no-gutters">
								<div class="col-9">
									${__(me.listview_settings[idx].label, null, me.doctype)}
								</div>
								<div class="col-3">
									<input type="number" class="form-control control-input bg-white column-width-input" style="margin-top:-5px;height:25px;" data-fieldname="${me.listview_settings[idx].fieldname}" value="${me.listview_settings[idx]?.width || 2}" />
								</div>
							</div>
						</div>
						<div class="col-1">
							<a class="text-muted remove-field" data-fieldname="${me.listview_settings[idx].fieldname}">
								${frappe.utils.icon("delete", "xs")}
							</a>
						</div>
					</div>
				</div>`;
		}

		fields_html.html(`
			<div class="form-group">
				<div class="clearfix">
					<label class="control-label" style="padding-right: 0px;">${__("Fields")}</label>
				</div>
				<div class="control-input-wrapper">
				${fields}
				</div>
				<p class="help-box small text-extra-muted">
					<a class="add-new-fields text-muted">
						${__("+ Add / Remove Fields")}
					</a>
				</p>
			</div>
		`);
		$(fields_html.$wrapper).on('change', '.column-width-input', function () {
			me.update_fields();
		});
		new Sortable(wrapper.getElementsByClassName("control-input-wrapper")[0], {
			handle: ".sortable-handle",
			draggable: ".sortable",
			onUpdate: () => {
				me.update_fields();
				me.refresh();
			},
		});
	}

	add_new_fields() {
		let me = this;
		let fields_html = me.dialog.get_field("fields_html");
		let add_new_fields = fields_html.$wrapper[0].getElementsByClassName("add-new-fields")[0];
		add_new_fields.onclick = () => me.column_selector();
	}

	setup_remove_fields() {
		let me = this;

		let fields_html = me.dialog.get_field("fields_html");
		let remove_fields = fields_html.$wrapper[0].getElementsByClassName("remove-field");

		for (let idx = 0; idx < remove_fields.length; idx++) {
			remove_fields.item(idx).onclick = () =>
				me.remove_fields(remove_fields.item(idx).getAttribute("data-fieldname"));
		}
	}

	remove_fields(fieldname) {
		let me = this;
		for (let idx in me.listview_settings) {
			let field = me.listview_settings[idx];
			if (field.fieldname == fieldname) {
				me.listview_settings.splice(idx, 1);
				break;
			}
		}
		me.refresh();
		me.update_fields();
	}

	update_fields() {
		let me = this;
		let fields_html = me.dialog.get_field("fields_html");
		let wrapper = fields_html.$wrapper[0];
		let fields_order = wrapper.getElementsByClassName("fields_order");
		me.listview_settings = [];
		for (let idx = 0; idx < fields_order.length; idx++) {
			me.listview_settings.push({
				fieldname: fields_order.item(idx).getAttribute("data-fieldname"),
				label: __(fields_order.item(idx).getAttribute("data-label")),
				width: fields_order.item(idx).querySelector('.column-width-input')?.value || 2
			});
		}
		me.dialog.set_value("listview_settings", JSON.stringify(me.listview_settings));
	}

	column_selector() {
		let me = this;

		let d = new frappe.ui.Dialog({
			title: __("{0} Fields", [__(me.doctype)]),
			fields: [
				{
					label: __("Select Fields"),
					fieldtype: "MultiCheck",
					fieldname: "listview_settings",
					options: me.get_doctype_fields(
						me.meta,
						me.listview_settings.map((f) => f.fieldname)
					),
					columns: 2,
				},
			],
		});
		d.set_primary_action(__("Save"), () => {
			let values = d.get_values().listview_settings;
			let prev_setting = me.listview_settings.slice(); // Clone previous settings
			me.listview_settings = [];

			// Collect the existing fieldnames from values
			let value_fieldnames = new Set(values);

			for (let setting of prev_setting) {
				// Keep only fields that still exist in values
				if (value_fieldnames.has(setting.fieldname)) {
					me.listview_settings.push(setting);
				}
			}

			// Add missing fields (append at the end)
			for (let value of values) {
				if (!me.listview_settings.some(f => f.fieldname === value)) {
					if (value === 'name') {
						me.listview_settings.push({
							label: __("ID"),
							fieldname: value,
						});
					} else {
						let field = this.meta.fields.find(f => f.fieldname === value);
						if (field) {
							me.listview_settings.push({
								label: __(field.label, null, me.doctype),
								fieldname: field.fieldname,
								width: 2
							});
						} else if (['creation', 'owner', 'modified', 'modified_by'].includes(value)) {
							let ad_field = this.additional_fields.find(f => f.value === value);
							if (ad_field) {
								me.listview_settings.push({
									label: __(ad_field.label, null, me.doctype),
									fieldname: ad_field.value,
									width: 2
								});
							}
						}
					}
				}
			}

			me.dialog.set_value("listview_settings", JSON.stringify(me.listview_settings));
			me.refresh();
			d.hide();
		});
		d.show();
	}

	get_listview_fields(meta) {
		let me = this;
		if (!me.settings?.listview_settings) {
			me.set_list_view_fields(meta);
		} else {
			me.listview_settings = JSON.parse(this.settings?.listview_settings || []);
		}
		me.listview_settings.uniqBy((f) => f.fieldname);
	}

	set_list_view_fields(meta) {
		let me = this;
		// me.set_subject_field();
		meta.fields.forEach((field) => {
			if (
				field.in_list_view &&
				!frappe.model.no_value_type.includes(field.fieldtype)
				// && me.subject_field.fieldname != field.fieldname
			) {
				me.listview_settings.push({
					label: __(field.label, null, me.doctype),
					fieldname: field.fieldname,
				});
			}
		});
	}

	// set_subject_field() {
	// 	let me = this;
	// 	me.subject_field = {
	// 		label: __("ID"),
	// 		fieldname: "name",
	// 	};
	// 	me.listview_settings.push(me.subject_field);
	// }

	get_doctype_fields(meta, fields) {

		let multiselect_fields = [{
			label: __("ID"),
			value: "name",
			checked: fields.includes("name"),
		}];
		this.additional_fields.forEach((field) => {
			if (fields.includes(field.value)) {
				field.checked = fields.includes(field.value);
			}
		});
		meta.fields.forEach((field) => {
			if (field.fieldtype == "Button" || (!frappe.model.no_value_type.includes(field.fieldtype))) {
				multiselect_fields.push({
					label: __(field.label, null, field.doctype),
					value: field.fieldname,
					checked: fields.includes(field.fieldname),
				});
			}
		});
		multiselect_fields = multiselect_fields.concat(this.additional_fields);
		return multiselect_fields;
	}
}
