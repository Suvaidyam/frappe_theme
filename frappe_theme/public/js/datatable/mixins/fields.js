const FieldsMixin = {
	getCellStyle(column, isSticky, left, isLastSticky) {
		if (isSticky) {
			return `position: sticky; left:${left}px; z-index: 2; background-color: #fff; min-width:${
				column.width || 150
			}px; max-width:${column.width || 200}px; padding: 0px${
				isLastSticky ? "; box-shadow: inset -2px 0 0 0 #d1d8dd" : ""
			}`;
		}
		return `min-width:${column.width || 150}px; max-width:${
			column.width || 200
		}px; padding: 0px !important;`;
	},

	createEditableField(td, column, row) {
		const frm = this.frm;
		const childTableFieldName = this.childTableFieldName;
		td.textContent = "";
		let columnField = {
			...column,
			onchange: function () {
				let changedValue = control.get_input_value();
				if (column.fieldtype === "Percent") {
					changedValue = parseFloat(changedValue);
				}
				if (row[column.fieldname] !== changedValue) {
					let rowIndex = frm.doc[childTableFieldName].findIndex(
						(r) => r.name === row.name
					);
					frm.doc[childTableFieldName][rowIndex][column.fieldname] =
						control.get_input_value();
					frm.dirty();
				}
			},
		};

		columnField.get_query = () => {
			const filters = [];
			if (column.additional_filters) {
				filters.push(...column.additional_filters);
			}
			if (column.link_filter) {
				const [parentfield, filter_key] = column.link_filter.split("->");
				let rowIndex = frm.doc[childTableFieldName].findIndex((r) => r.name === row.name);
				filters.push([
					column.options,
					filter_key,
					"=",
					frm.doc[childTableFieldName][rowIndex][parentfield],
				]);
			}
			if (column.doc_link_filters) {
				filters.push(...JSON.parse(column.doc_link_filters));
			}
			let keys = this.uniqueness?.row?.find((r) => r.includes(column.fieldname));
			if (keys) {
				let rowIndex = frm.doc[childTableFieldName].findIndex((r) => r.name === row.name);
				let _row = frm.doc[childTableFieldName][rowIndex];
				filters.push([
					column.options,
					"name",
					"not in",
					keys.map((k) => _row[k]).filter((k) => k && k != columnField.fieldname),
				]);
			}
			return { filters };
		};

		const control = frappe.ui.form.make_control({
			parent: td,
			df: columnField,
			render_input: true,
			only_input: true,
		});

		$(control.input).css({
			width: "100%",
			height: "32px",
			backgroundColor: "white",
			margin: "0px",
			boxShadow: "none",
		});
		if (row[column.fieldname]) {
			control.set_value(row[column.fieldname]);
		}
		control.refresh();
	},

	createNonEditableField(td, column, row, columnIndex) {
		let col = this.header.find((h) => h.fieldname === column.fieldname);
		td.textContent = "";
		let columnField = {
			...column,
			read_only: 1,
			description: "",
		};
		let highlight = this.highlighted_columns?.includes(column.fieldname);
		if (highlight) {
			td.style.backgroundColor = frappe.utils.get_lighter_shade_of_hex_color(
				frappe.boot?.my_theme?.button_background_color || "#2196F3",
				85
			);
		}
		if (column.fieldname === this?.workflow?.workflow_state_field) {
			if (
				this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
					column.fieldname
				]
			) {
				let formatter =
					this.frm.dt_events[this.doctype || this.link_report].formatter[
						column.fieldname
					];
				td.innerHTML = formatter(
					this.workflow_state_map[row[column.fieldname]] || row[column.fieldname],
					column,
					row,
					this
				);
				td.title =
					this.workflow_state_map[row[column.fieldname]] || row[column.fieldname] || "";
			} else {
				td.innerHTML = `<span>${
					this.workflow_state_map[row[column.fieldname]] || row[column.fieldname]
				}</span>`;
				td.title =
					this.workflow_state_map[row[column.fieldname]] || row[column.fieldname] || "";
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
			}
			return;
		}
		if (column.fieldtype === "Link") {
			let spanElement;
			if (
				this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
					column.fieldname
				]
			) {
				let formatter =
					this.frm.dt_events[this.doctype || this.link_report].formatter[
						column.fieldname
					];
				if (frappe.utils.get_link_title(column.options, row[column.fieldname])) {
					td.innerHTML = formatter(
						frappe.utils.get_link_title(column.options, row[column.fieldname]),
						column,
						row,
						this
					);
					td.title =
						frappe.utils.get_link_title(column.options, row[column.fieldname]) || "";
				} else {
					try {
						frappe.utils
							.fetch_link_title(column.options, row[column.fieldname])
							.then((res) => {
								td.innerHTML = formatter(
									res || row[column.fieldname] || "",
									column,
									row,
									this
								);
								td.title = res || row[column.fieldname] || "";
							});
					} catch (error) {
						td.innerHTML = formatter(row[column.fieldname] || "", column, row, this);
						td.title = row[column.fieldname] || "";
					}
				}
			} else {
				if (frappe.utils.get_link_title(column.options, row[column.fieldname])) {
					spanElement = document.createElement("span");
					spanElement.textContent = frappe.utils.get_link_title(
						column.options,
						row[column.fieldname]
					);
					td.appendChild(spanElement);
					td.title =
						frappe.utils.get_link_title(column.options, row[column.fieldname]) || "-";
				} else {
					spanElement = document.createElement("span");
					td.appendChild(spanElement);
					try {
						frappe.utils
							.fetch_link_title(column.options, row[column.fieldname])
							.then((res) => {
								spanElement.textContent = res || row[column.fieldname] || "-";
								td.title = res || row[column.fieldname] || "-";
							});
					} catch (error) {
						spanElement.textContent = row[column.fieldname] || "-";
						td.title = row[column.fieldname] || "-";
					}
				}

				// Apply CSS styles
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}
			this.bindColumnEvents(
				td.firstElementChild || spanElement,
				row[column.fieldname],
				column,
				row
			);
			return;
		}
		if (column.fieldtype == "Select") {
			let edit_level1 =
				["1", "2"].includes(row.docstatus) &&
				(this.frm ? this.frm?.doc?.docstatus == 0 : true);
			let wf_editable_roles = this?.workflow?.states
				?.filter((s) => s.state == row[this?.workflow?.workflow_state_field])
				?.map((s) => s.allow_edit);
			let wf_editable = this.workflow
				? wf_editable_roles?.some((role) => frappe.user_roles.includes(role))
				: true;
			let is_editable = this.connection?.disable_edit_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_edit_depends_on, row)
				: true;
			let editable =
				!edit_level1 &&
				this.crud.write &&
				wf_editable &&
				this.permissions.includes("write") &&
				this.conf_perms.includes("write") &&
				is_editable;
			if (col?.inline_edit && editable) {
				let me = this;
				const control = frappe.ui.form.make_control({
					parent: td,
					df: {
						...column,
						read_only:
							column?.read_only ||
							(column?.read_only_depends_on
								? frappe.utils.custom_eval(column.read_only_depends_on, row)
								: false),
						onchange: async function () {
							let changedValue = control?.get_input_value();
							if (row[column.fieldname] && row[column.fieldname] != changedValue) {
								try {
									let response = await me.sva_db.set_value(
										me.doctype,
										row.name,
										column.fieldname,
										changedValue
									);
									if (response) {
										me.reloadRow(response);
										frappe.show_alert({
											message: `${
												column?.label || column.fieldname
											} updated successfully`,
											indicator: "success",
										});
									}
								} catch (error) {
									frappe.show_alert({
										message: `Error updating ${
											column?.label || column.fieldname
										}`,
										indicator: "danger",
									});
								}
							} else {
								try {
									let response = await me.sva_db.set_value(
										me.doctype,
										row.name,
										column.fieldname,
										changedValue
									);
									if (response) {
										me.reloadRow(response);
										frappe.show_alert({
											message: `${
												column?.label || column.fieldname
											} updated successfully`,
											indicator: "success",
										});
									}
								} catch (error) {
									frappe.show_alert({
										message: `Error updating ${
											column?.label || column.fieldname
										}`,
										indicator: "danger",
									});
								}
							}
						},
					},
					value: row[column.fieldname] || "-",
					render_input: true,
					only_input: true,
				});
				$(control.input).css({
					width: "100%",
					height: "25px",
					marginTop: "5px",
					fontSize: "12px",
					color: "black",
				});
				$(td).css({ height: "25px !important", padding: "0px 5px" });
				control.refresh();
			} else {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					const _span = document.createElement("span");
					_span.title = row[column.fieldname] || "-";
					_span.textContent = row[column.fieldname] || "-";
					td.appendChild(_span);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					}
				}
			}
			return;
		}
		if (["HTML"].includes(columnField.fieldtype)) {
			const control = frappe.ui.form.make_control({
				parent: td,
				df: columnField,
				render_input: true,
				only_input: true,
			});
			$(control.input).css({
				width: "100%",
				height: "32px",
				backgroundColor: "white",
				margin: "0px",
				fontSize: "12px",
				color: "black",
				boxShadow: "none",
				padding: "0px 5px",
				cursor: "normal",
			});
			$(td).css({ height: "32px !important" });
			if (row[column.fieldname]) {
				control.set_value(row[column.fieldname]);
			}
			control.refresh();
			return;
		} else {
			if (columnField?.has_link) {
				let [doctype, link_field] = columnField.has_link.split("->");
				td.addEventListener("click", async () => {
					await this.childTableDialog(doctype, link_field, row?.name, row);
				});
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
						cursor: "pointer",
						color: "blue",
					});
				}
			} else {
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}
			if (columnField.fieldtype === "Currency") {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					let value = formatCurrency(
						row[column.fieldname],
						frappe.sys_defaults.currency
					);
					const _span = document.createElement("span");
					_span.title = value;
					_span.textContent = value;
					td.appendChild(_span);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span") || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (columnField.fieldtype === "Attach") {
				if (
					row[column.fieldname] &&
					!["null", "undefined", null, undefined].includes(row[column.fieldname])
				) {
					const _a = document.createElement("a");
					_a.title = row[column.fieldname];
					_a.href = row[column.fieldname];
					_a.target = "_blank";
					_a.textContent = row[column.fieldname] || "-";
					td.appendChild(_a);
				} else {
					td.innerHTML = "-";
				}
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
				return;
			}
			if (columnField.fieldtype === "Attach Image") {
				if (
					row[column.fieldname] &&
					!["null", "undefined", null, undefined].includes(row[column.fieldname])
				) {
					const _img = document.createElement("img");
					_img.title = row[column.fieldname];
					_img.alt = row[column.fieldname];
					_img.src = row[column.fieldname];
					_img.style.width = "30px";
					_img.style.borderRadius = "50%";
					_img.style.height = "30px";
					_img.style.objectFit = "cover";
					td.appendChild(_img);
					return;
				} else {
					td.innerHTML = "-";
					return;
				}
			}
			if (["Int", "Float"].includes(columnField.fieldtype)) {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					let value =
						row[column.fieldname]?.toLocaleString("en-US", {
							minimumFractionDigits: 0,
							maximumFractionDigits: 2,
						}) || 0;
					const _span = document.createElement("span");
					_span.title = value;
					_span.textContent = value;
					td.appendChild(_span);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span") || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (["Percent"].includes(columnField.fieldtype)) {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					let value =
						row[column.fieldname]?.toLocaleString("en-US", {
							minimumFractionDigits: 0,
							maximumFractionDigits: 2,
						}) || 0;
					let clampedValue = Math.min(Math.max(parseFloat(value) || 0, 0), 100);
					let barColor = col?.color || "#2E7D32";
					td.innerHTML = this.percentageCell(clampedValue, barColor);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
							textAlign: "right",
						});
					}
				}
				this.bindColumnEvents(
					td.firstElementChild || td.querySelector("span"),
					row[column.fieldname],
					column,
					row
				);
				return;
			}
			if (["Date"].includes(columnField.fieldtype)) {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					const _dateVal = row[column.fieldname]
						? formaDate(row[column.fieldname])
						: "-";
					const _span = document.createElement("span");
					_span.title = _dateVal;
					_span.textContent = _dateVal;
					td.appendChild(_span);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					} else {
						$(td).css({
							width: `150px`,
							minWidth: `150px`,
							maxWidth: `150px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					}
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
				return;
			}
			if (["Datetime"].includes(columnField.fieldtype)) {
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						column.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							column.fieldname
						];
					td.innerHTML = formatter(row[column.fieldname], column, row, this);
				} else {
					const _datetimeVal = row[column.fieldname]
						? formatDatetime(row[column.fieldname])
						: "-";
					const _span = document.createElement("span");
					_span.title = _datetimeVal;
					_span.textContent = _datetimeVal;
					td.appendChild(_span);
					if (col?.width) {
						$(td).css({
							width: `${Number(col?.width) * 50}px`,
							minWidth: `${Number(col?.width) * 50}px`,
							maxWidth: `${Number(col?.width) * 50}px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					} else {
						$(td).css({
							width: `200px`,
							minWidth: `200px`,
							maxWidth: `200px`,
							height: "32px",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							padding: "0px 5px",
						});
					}
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
				return;
			}
			if (["name", this.meta?.title_field].includes(columnField.fieldname)) {
				const doctype =
					this.connection?.connection_type === "Report"
						? this.connection.report_ref_dt
						: this.doctype;
				const href = `/app/${encodeURIComponent(
					frappe.router.slug(doctype)
				)}/${encodeURIComponent(row.name)}`;
				const value = row[column.fieldname];
				// If both `name` and `title_field` columns are visible, only the title_field
				// should get the "link emphasis" color/underline.
				const titleField = this.meta?.title_field;
				const hasNameColumn = (this.columns || []).some((c) => c.fieldname === "name");
				const hasTitleColumn =
					titleField && (this.columns || []).some((c) => c.fieldname === titleField);
				const bothVisible = !!(hasNameColumn && hasTitleColumn);
				const isNameColumn = columnField.fieldname === "name";
				const emphasizeThisColumn = !(bothVisible && isNameColumn);

				const linkColor = emphasizeThisColumn
					? frappe.boot?.my_theme?.navbar_color || "var(--primary-color)"
					: "inherit";
				const textDecoration = emphasizeThisColumn ? "underline" : "none";
				if (value && !["null", "undefined", null, undefined].includes(value)) {
					const _a = document.createElement("a");
					if (!col?.wrap) _a.className = "ellipsis";
					_a.href = href;
					_a.title = value;
					_a.dataset.doctype = doctype;
					_a.dataset.name = row.name;
					_a.style.cursor = "pointer";
					_a.style.textDecoration = textDecoration;
					_a.style.color = linkColor;
					_a.textContent = value;
					td.appendChild(_a);
				} else {
					td.innerHTML = `<span title="-">-</span>`;
				}
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						...(col?.wrap
							? { minHeight: "32px" }
							: {
									height: "32px",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
							  }),
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						...(col?.wrap
							? { minHeight: "32px" }
							: {
									height: "32px",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
							  }),
						padding: "0px 5px",
					});
				}
				return;
			}
			if (columnField.fieldtype == "Button") {
				let btn = document.createElement("button");
				btn.classList.add("btn", "btn-secondary", "btn-sm");
				btn.setAttribute("data-dt", this.doctype);
				btn.setAttribute("data-dn", row.name);
				btn.setAttribute("data-fieldname", columnField.fieldname);
				btn.onclick = this.onFieldClick;
				btn.textContent = columnField.label;
				if (
					this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
						columnField.fieldname
					]
				) {
					let formatter =
						this.frm.dt_events[this.doctype || this.link_report].formatter[
							columnField.fieldname
						];
					btn = formatter(btn, column, row, this);
				}
				td.appendChild(btn);
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						padding: "0px 5px",
					});
				}
				this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
				return;
			}
			if (
				this.frm?.dt_events?.[this.doctype || this.link_report]?.formatter?.[
					column.fieldname
				]
			) {
				let formatter =
					this.frm.dt_events[this.doctype || this.link_report].formatter[
						column.fieldname
					];
				td.innerHTML = formatter(row[column.fieldname], column, row, this);
			} else {
				if (
					row[column.fieldname] &&
					!["null", "undefined", null, undefined].includes(row[column.fieldname])
				) {
					const _span = document.createElement("span");
					_span.title = row[column.fieldname] || "";
					_span.textContent = row[column.fieldname] || "";
					td.appendChild(_span);
				} else {
					td.innerHTML = `<span title="-">-</span>`;
				}
				if (col?.width) {
					$(td).css({
						width: `${Number(col?.width) * 50}px`,
						minWidth: `${Number(col?.width) * 50}px`,
						maxWidth: `${Number(col?.width) * 50}px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				} else {
					$(td).css({
						width: `150px`,
						minWidth: `150px`,
						maxWidth: `150px`,
						height: "32px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						padding: "0px 5px",
					});
				}
			}
			this.bindColumnEvents(td.firstElementChild, row[column.fieldname], column, row);
			td.title = row[column.fieldname] || "";
		}
	},
	bindColumnEvents(element, value, column, row) {
		if (
			this.frm?.dt_events?.[this.doctype || this.link_report]?.columnEvents?.[
				column.fieldname
			]
		) {
			let events =
				this.frm.dt_events[this.doctype || this.link_report].columnEvents[
					column.fieldname
				];
			for (let event in events) {
				element.addEventListener(event, () =>
					events[event](element, value, column, row, this)
				);
			}
		}
	},
	percentageCell(value, bgColor, textColor) {
		const pct = Math.min(100, Math.max(0, Math.round(value)));

		return `
		<div style="display:flex; align-items:center; gap:8px; width:100%;">
			<div style="flex:1; height:5px; background:#e5e5e5; border-radius:99px; overflow:hidden;">
				<div style="width:${pct}%; height:100%; background:${bgColor}; border-radius:99px;"></div>
			</div>
			<span style="
				font-size:12px;
				font-weight:500;
				color:${textColor};
				font-variant-numeric:tabular-nums;
				white-space:nowrap;
				min-width:36px;
				text-align:right;
			">${pct}%</span>
		</div>
	`.trim();
	},
};

export default FieldsMixin;
