class ListSettings {
	constructor({
		doctype,
		meta,
		connection_type,
		settings,
		dialog_primary_action,
		sva_dt = {},
		only_list_settings = false,
	}) {
		if (!doctype) {
			frappe.throw("DocType required");
		}
		this.doctype = doctype;
		this.meta = meta;
		this.only_list_settings = only_list_settings;
		this.connection_type = connection_type;
		this.settings = settings;
		this.sva_dt = sva_dt;
		this.dialog = null;
		this.reset_layout = false;
		this.dialog_primary_action = dialog_primary_action;
		this.listview_settings =
			this.settings && this.settings.listview_settings
				? JSON.parse(this.settings.listview_settings)
				: [];
		if (typeof this.listview_settings === "string") {
			this.listview_settings = JSON.parse(this.listview_settings);
		}
		if (this.only_list_settings && this.settings && this.settings.list_filters) {
			this.listview_settings = JSON.parse(this.settings.list_filters);
		}
		this.additional_fields = [
			{
				label: __("Created On"),
				value: "creation",
				checked: false,
			},
			{
				label: __("Created By"),
				value: "owner",
				checked: false,
			},
			{
				label: __("Modified On"),
				value: "modified",
				checked: false,
			},
			{
				label: __("Modified By"),
				value: "modified_by",
				checked: false,
			},
		];
		if (this.connection_type == "Report" || this.only_list_settings) {
			this.additional_fields = [];
		}
		// this.subject_field = null;

		frappe.run_serially([
			this.make(),
			this.get_listview_fields(meta),
			this.setup_fields(),
			this.setup_remove_fields(),
			this.add_new_fields(),
			this.show_dialog(),
		]);
	}

	make() {
		let me = this;
		me.dialog = new frappe.ui.Dialog({
			title: __("{0}", [__(me.doctype)]),
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
					hidden: me.only_list_settings,
					options:
						"<p><b>Note</b>: The system converts width values using a scale where 1 unit equals 50 pixels.</p>",
				},
				{
					label: __("Fields"),
					fieldname: "fields_html",
					fieldtype: "HTML",
				},
			],
			size: "extra-large",
		});
		me.dialog.set_values(me.settings);
		me.dialog.set_primary_action(__("Save"), () => {
			this.dialog_primary_action(me.listview_settings, me.reset_layout);
			me.dialog.hide();
		});
		if (me?.sva_dt?.user_has_list_settings) {
			me.dialog.set_secondary_action_label(__("Reset Fields"));
			me.dialog.set_secondary_action(() => {
				me.listview_settings = JSON.parse(
					me?.sva_dt?.connection?.listview_settings || "[]"
				);
				frappe.run_serially([this.setup_fields(), this.show_dialog()]);
				me.reset_layout = true;
				me.dialog.get_secondary_btn().remove();
			});
		}
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
		const isAdmin = frappe.session.user == "Administrator";
		const primaryFieldname =
			!me.only_list_settings && me.connection_type !== "Report"
				? me.getPrimaryFieldname()
				: null;
		for (let idx in me.listview_settings) {
			const s = me.listview_settings[idx];
			const isPrimary = s.fieldname === primaryFieldname && parseInt(idx) === 0;
			const showEdit = !me.only_list_settings && ["Select"].includes(s.fieldtype) && isAdmin;
			const vis = !me.only_list_settings ? "visible" : "hidden";
			fields += `
				<div class="control-input flex align-center form-control fields_order ${
					isPrimary ? "" : "sortable"
				}"
					style="display: block; margin-bottom: 5px;${
						isPrimary ? "background-color:#f0f4f8;" : ""
					}" data-fieldname="${s.fieldname}"
					data-label="${s.label}" data-fieldtype="${s.fieldtype}">
					<div class="d-flex align-items-center no-gutters">
						<div style="width:40%;display:flex;align-items:center;gap:4px;overflow:hidden;">
							<div style="flex-shrink:0;text-align:center;width:20px;">
								${
									isPrimary
										? frappe.utils.icon("lock", "xs")
										: frappe.utils.icon(
												"drag",
												"xs",
												"",
												"",
												"sortable-handle "
										  )
								}
							</div>
							<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
								${__(s.label, null, me.doctype)}
							</div>
						</div>
						<div style="width:60%;display:flex;align-items:center;">
							<div style="width:22%;visibility:${vis};" class="d-flex justify-content-center">
								<input type="number" class="form-control bg-white column-width-input" style="height:25px;width:80px;padding:2px 7px;" data-fieldname="${
									s.fieldname
								}" value="${s?.width || 2}" />
							</div>
							<div style="width:11%;visibility:${
								showEdit ? "visible" : "hidden"
							};" class="d-flex justify-content-center">
								<input style="height:16px;width:16px!important;cursor:pointer;accent-color:var(--primary);" type="checkbox" class="inline-edit-checkbox" data-fieldname="${
									s.fieldname
								}" ${s?.inline_edit ? "checked" : ""} />
							</div>
							<div style="width:11%;visibility:${vis};" class="d-flex justify-content-center">
								<input style="height:16px;width:16px!important;cursor:pointer;accent-color:var(--primary);" type="checkbox" class="sticky-checkbox" data-fieldname="${
									s.fieldname
								}" ${s?.sticky ? "checked" : ""} />
							</div>
							<div style="width:11%;visibility:${vis};" class="d-flex justify-content-center">
								<input style="height:16px;width:16px!important;cursor:pointer;accent-color:var(--primary);" type="checkbox" class="wrap-checkbox" data-fieldname="${
									s.fieldname
								}" ${s?.wrap ? "checked" : ""} />
							</div>
							<div style="width:17%;visibility:${vis};gap:3px;" class="d-flex justify-content-center align-items-center">
								<input type="color" class="color-input" style="width:20px;height:20px;padding:0;border:1px solid #d1d8dd;border-radius:3px;cursor:pointer;" data-fieldname="${
									s.fieldname
								}" value="${s?.color || "#000000"}" />
								<a class="text-muted reset-color" data-fieldname="${s.fieldname}" title="${__(
				"Reset Color"
			)}" style="cursor:pointer;font-size:10px;${
				s?.color ? "" : "visibility:hidden;"
			}">&times;</a>
							</div>
							<div style="width:17%;visibility:${vis};gap:3px;" class="d-flex justify-content-center align-items-center">
								<input type="color" class="bg-color-input" style="width:20px;height:20px;padding:0;border:1px solid #d1d8dd;border-radius:3px;cursor:pointer;" data-fieldname="${
									s.fieldname
								}" value="${s?.bg_color || "#ffffff"}" />
								<a class="text-muted reset-bg-color" data-fieldname="${s.fieldname}" title="${__(
				"Reset Background"
			)}" style="cursor:pointer;font-size:10px;${
				s?.bg_color ? "" : "visibility:hidden;"
			}">&times;</a>
							</div>
							<div style="width:11%;text-align:center;">
								<a class="text-muted remove-field" data-fieldname="${s.fieldname}">
									${frappe.utils.icon("delete", "xs")}
								</a>
							</div>
						</div>
					</div>
				</div>`;
		}

		fields_html.html(`
			<div class="form-group pt-2">
				${
					!me.only_list_settings
						? `<div class="d-flex no-gutters" style="margin-bottom:8px;padding:0 12px;font-weight:600;font-size:11px;color:var(--text-muted);">
					<div style="width:40%;">${__("Fieldname")}</div>
					<div style="width:60%;display:flex;text-align:center;">
						<div style="width:22%;">${__("Column Width")}</div>
						<div style="width:11%;">${__("Edit")}</div>
						<div style="width:11%;">${__("Sticky")}</div>
						<div style="width:11%;">${__("Wrap")}</div>
						<div style="width:17%;">${__("Color")} <a class="reset-all-color" title="${__(
								"Reset All"
						  )}" style="cursor:pointer;color:var(--text-light);font-weight:400;">&times;</a></div>
						<div style="width:17%;" title="Background Color">${__(
							"BG"
						)} <a class="reset-all-bg-color" title="${__(
								"Reset All"
						  )}" style="cursor:pointer;color:var(--text-light);font-weight:400;">&times;</a></div>
						<div style="width:11%;"></div>
					</div>
				</div>`
						: ""
				}
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
		$(fields_html.$wrapper).on("change", ".column-width-input", function () {
			me.update_fields();
		});
		$(fields_html.$wrapper).on("change", ".inline-edit-checkbox", function () {
			me.update_fields();
		});
		$(fields_html.$wrapper).on("change", ".sticky-checkbox", function () {
			me.update_fields();
		});
		$(fields_html.$wrapper).on("change", ".wrap-checkbox", function () {
			me.update_fields();
		});
		$(fields_html.$wrapper).on("change", ".color-input", function () {
			const val = $(this).val();
			$(this)
				.closest("div")
				.find(".reset-color")
				.css("visibility", val && val !== "#000000" ? "visible" : "hidden");
			me.update_fields();
		});
		$(fields_html.$wrapper).on("change", ".bg-color-input", function () {
			const val = $(this).val();
			$(this)
				.closest("div")
				.find(".reset-bg-color")
				.css("visibility", val && val !== "#ffffff" ? "visible" : "hidden");
			me.update_fields();
		});
		$(fields_html.$wrapper).on("click", ".reset-color", function () {
			const fieldname = $(this).data("fieldname");
			$(fields_html.$wrapper)
				.find(`.color-input[data-fieldname="${fieldname}"]`)
				.val("#000000")
				.trigger("change");
			$(this).css("visibility", "hidden");
			me.update_fields();
		});
		$(fields_html.$wrapper).on("click", ".reset-bg-color", function () {
			const fieldname = $(this).data("fieldname");
			$(fields_html.$wrapper)
				.find(`.bg-color-input[data-fieldname="${fieldname}"]`)
				.val("#ffffff")
				.trigger("change");
			$(this).css("visibility", "hidden");
			me.update_fields();
		});
		$(fields_html.$wrapper).on("click", ".reset-all-color", function () {
			$(fields_html.$wrapper).find(".color-input").val("#000000").trigger("change");
			me.update_fields();
		});
		$(fields_html.$wrapper).on("click", ".reset-all-bg-color", function () {
			$(fields_html.$wrapper).find(".bg-color-input").val("#ffffff").trigger("change");
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
			if (me.only_list_settings) {
				me.listview_settings.push({
					fieldname: fields_order.item(idx).getAttribute("data-fieldname"),
					fieldtype: fields_order.item(idx).getAttribute("data-fieldtype"),
					label: __(fields_order.item(idx).getAttribute("data-label")),
				});
			} else {
				const el = fields_order.item(idx);
				const colorVal = el.querySelector(".color-input")?.value;
				const bgVal = el.querySelector(".bg-color-input")?.value;
				me.listview_settings.push({
					fieldname: el.getAttribute("data-fieldname"),
					fieldtype: el.getAttribute("data-fieldtype"),
					label: __(el.getAttribute("data-label")),
					width: el.querySelector(".column-width-input")?.value || 2,
					inline_edit: el.querySelector(".inline-edit-checkbox")?.checked ? 1 : 0,
					sticky: el.querySelector(".sticky-checkbox")?.checked ? 1 : 0,
					wrap: el.querySelector(".wrap-checkbox")?.checked ? 1 : 0,
					color: colorVal && colorVal !== "#000000" ? colorVal : "",
					bg_color: bgVal && bgVal !== "#ffffff" ? bgVal : "",
				});
			}
		}
		if (!me.only_list_settings && me.connection_type !== "Report") {
			me.ensurePrimaryFieldFirst();
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
				if (!me.listview_settings.some((f) => f.fieldname === value)) {
					if (value === "name") {
						me.listview_settings.push({
							label: __("ID"),
							fieldname: value,
						});
					} else {
						let field = this.meta.find((f) => f.fieldname === value);
						if (field) {
							me.listview_settings.push({
								label: __(field.label, null, me.doctype),
								fieldname: field.fieldname,
								fieldtype: field.fieldtype,
								width: 2,
								inline_edit: 0,
								sticky: 0,
								wrap: 0,
								color: "",
								bg_color: "",
							});
						} else if (
							["creation", "owner", "modified", "modified_by"].includes(value)
						) {
							let ad_field = this.additional_fields.find((f) => f.value === value);
							if (ad_field) {
								me.listview_settings.push({
									label: __(ad_field.label, null, me.doctype),
									fieldname: ad_field.value,
									fieldtype: ad_field.fieldtype,
									width: 2,
									inline_edit: 0,
									sticky: 0,
									wrap: 0,
									color: "",
									bg_color: "",
								});
							}
						}
					}
				}
			}

			if (!me.only_list_settings && me.connection_type !== "Report") {
				me.ensurePrimaryFieldFirst();
			}
			me.dialog.set_value("listview_settings", JSON.stringify(me.listview_settings));
			me.refresh();
			d.hide();
		});
		d.show();
	}

	get_listview_fields(meta) {
		let me = this;
		if (!me.settings?.listview_settings && !me.only_list_settings) {
			me.set_list_view_fields(meta);
		} else {
			me.listview_settings = me.only_list_settings
				? JSON.parse(this.settings?.list_filters || "[]")
				: JSON.parse(this.settings?.listview_settings || []).length &&
				  JSON.parse(this.settings?.listview_settings || [])?.[0]?.fieldtype == "undefined"
				? JSON.parse(this.settings?.listview_settings || []).map((f) => {
						let field = meta.find((m) => m.fieldname == f.fieldname);
						if (field) {
							return {
								...f,
								fieldtype: field.fieldtype,
							};
						} else {
							return f;
						}
				  })
				: JSON.parse(this.settings?.listview_settings || []);
		}
		me.listview_settings.uniqBy((f) => f.fieldname);
		if (!me.only_list_settings && me.connection_type !== "Report") {
			me.ensurePrimaryFieldFirst();
		}
	}

	getPrimaryFieldname() {
		const titleField = this.sva_dt?.meta?.title_field;
		if (titleField) {
			const exists = this.listview_settings.some((f) => f.fieldname === titleField);
			if (exists) return titleField;
		}
		return "name";
	}

	ensurePrimaryFieldFirst() {
		const primaryFieldname = this.getPrimaryFieldname();
		const idx = this.listview_settings.findIndex((f) => f.fieldname === primaryFieldname);
		if (idx > 0) {
			const [field] = this.listview_settings.splice(idx, 1);
			this.listview_settings.unshift(field);
		}
	}

	set_list_view_fields(meta) {
		let me = this;
		// me.set_subject_field();
		meta.forEach((field) => {
			if (
				field.in_list_view &&
				!frappe.model.no_value_type.includes(field.fieldtype)
				// && me.subject_field.fieldname != field.fieldname
			) {
				me.listview_settings.push({
					label: __(field.label, null, me.doctype),
					fieldname: field.fieldname,
					fieldtype: field.fieldtype,
					width: 2,
					inline_edit: field.inline_edit ? 1 : 0,
					sticky: 0,
					wrap: 0,
					color: "",
					bg_color: "",
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
		let multiselect_fields = [
			{
				label: __("ID"),
				value: "name",
				checked: fields.includes("name"),
			},
		];
		this.additional_fields.forEach((field) => {
			if (fields.includes(field.value)) {
				field.checked = fields.includes(field.value);
			}
		});
		meta.forEach((field) => {
			if (
				field.fieldtype == "Button" ||
				!frappe.model.no_value_type.includes(field.fieldtype)
			) {
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
frappe.provide("frappe.ui");
frappe.ui.SVAListSettings = ListSettings;
export default ListSettings;
