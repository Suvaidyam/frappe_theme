const customPropertySetter = async function (frm) {
	setTimeout(() => {
		let fields = frm.$wrapper.find(".field");
		fields.each(function () {
			let el = this;
			// Click listener (optional)
			el.addEventListener("click", () => {
				console.log("Field clicked:", el);
				let control = el.querySelector(".control.frappe-control.editable[data-fieldname]");

				if (control) {
					let fieldname = control.dataset.fieldname;
					let fieldtype = control.dataset.fieldtype;
					let controls = document.querySelector(".control-data");
					if (controls) {
						let oldBtn = controls.querySelector("#custom_property_setter_btn");
						if (!oldBtn) {
							let btn = document.createElement("button");
							btn.innerText = "Custom Property Setter";
							btn.className = "btn btn-sm btn-default btn-block";
							btn.id = "custom_property_setter_btn";
							btn.style.marginBottom = "10px"; // optional
							btn.addEventListener("click", async () => {
								let fields = await frappe.call(
									"frappe_theme.api.get_meta_fields",
									{
										doctype: "Custom Property Setter",
									}
								);
								let doctype =
									frm.docname == "Customize Form"
										? frm.doc.doc_type
										: frm.docname;
								let props = await frappe.db.get_list("Property Setter", {
									filters: {
										doc_type: doctype,
										field_name: fieldname,
										doctype_or_field: "DocField",
										property: "sva_ft",
									},
									fields: ["*"],
								});
								let prop = props?.length > 0 ? props[0] : null;
								if (prop) {
									try {
										let values = JSON.parse(prop.value);
										for (field of fields.message) {
											if (values[field.fieldname]) {
												field.default = values[field.fieldname];
											}
										}
									} catch (error) {
										console.log("Exception in Custom Property Setter");
									}
								}

								let dialog = new frappe.ui.Dialog({
									title: "Custom Property Setter",
									fields: fields.message.map((field) => {
										return {
											...field,
											default:
												field.fieldname == "fieldtype"
													? fieldtype
													: field.fieldname == "fieldname"
													? fieldname
													: field.default,
										};
									}),
									primary_action_label: "Save",
									primary_action: async function () {
										let values = dialog.get_values();
										let new_val = JSON.stringify(
											Object.keys(values)
												.filter(
													(key) =>
														!["fieldname", "fieldtype"].includes(key)
												)
												.reduce((acc, key) => {
													acc[key] = values[key];
													return acc;
												}, {})
										);

										if (prop) {
											await frappe.db.set_value(
												"Property Setter",
												prop.name,
												"value",
												new_val
											);
										} else {
											let doc = {
												doctype: "Property Setter",
												field_name: values.fieldname,
												doc_type: doctype,
												doctype_or_field: "DocField",
												property: "sva_ft",
												value: new_val,
											};
											let new_doc = await frappe.db.insert(doc);
										}
										dialog.hide();
									},
								});
								dialog.show();
							});
							controls.prepend(btn);
						}
					}
				}
			});

			// Mutation observer to detect class change
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (mutation.attributeName === "class") {
						if (el.classList.contains("field selected")) {
							// frm.fields_dict[chart.fieldname];
							// get child of el with class 'control frappe-control editable'
							let controlData = el.querySelectorAll(".frappe-control.editable");

							controlData.forEach(function (control) {
								console.log(control);
							});
						}
					}
				});
			});

			observer.observe(el, {
				attributes: true,
				attributeFilter: ["class"],
			});
		});
	}, 1000);
};
