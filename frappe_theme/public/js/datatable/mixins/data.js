const DataMixin = {
	async getUserWiseListSettings() {
		let res = await this.sva_db.call({
			method: "frappe_theme.dt_api.get_user_list_settings",
			parent_id:
				this.connection.parent ||
				`${this.doctype || this.link_report}-${this.connection.html_field}`,
			child_dt: this.doctype || this.link_report,
		});
		return res.message;
	},
	get_permissions(doctype) {
		if (this.connection.connection_type === "Report") {
			return this.conf_perms ? this.conf_perms : ["read"];
		} else {
			return new Promise((rslv, rjct) => {
				frappe.call({
					method: "frappe_theme.api.get_permissions",
					args: { doctype: doctype, _type: this.connection.connection_type },
					callback: function (response) {
						rslv(response.message);
					},
					error: (err) => {
						rjct(err);
					},
				});
			});
		}
	},
	sortByColumn(column, direction, updateTable = true) {
		const columnName = column.fieldname || column;
		let sorted_rows = this.rows.sort((a, b) => {
			const valueA = a[columnName];
			const valueB = b[columnName];
			if (valueA === valueB) return 0;
			if (Number.isInteger(parseFloat(valueA)) && Number.isInteger(parseFloat(valueB))) {
				return direction === "asc"
					? Number(valueA) - Number(valueB)
					: Number(valueB) - Number(valueA);
			}
			if (direction === "asc") {
				return valueA > valueB ? 1 : -1;
			} else {
				return valueA < valueB ? 1 : -1;
			}
		});

		this.currentSort = { column: columnName, direction };
		if (updateTable) {
			this.updateTableBody();
		} else {
			return sorted_rows;
		}
	},
	async getDocList() {
		try {
			let filters = [];
			if (this.connection?.extend_condition && this.connection?.extended_condition) {
				try {
					let cond = JSON.parse(this.connection.extended_condition);
					if (Array.isArray(cond) && cond?.length) {
						cond = cond?.map((e) => {
							if (
								e.length > 3 &&
								e[3] &&
								!Array.isArray(e[3]) &&
								isNaN(e[3]) &&
								e[3]?.toLowerCase() == "today"
							) {
								e[3] = new Date().toISOString().split("T")[0];
							}
							return e;
						});
						filters = filters.concat(cond);
					}
				} catch (error) {
					console.error("Exception: while parsing extended_condition", error);
				}
			}
			if (this.connection?.connection_type === "Referenced") {
				if (this.frm?.doc.doctype != this.frm?.doc.name) {
					filters.push([
						this.doctype,
						this.connection.dt_reference_field,
						"=",
						this.frm?.doc.doctype,
					]);
					filters.push([
						this.doctype,
						this.connection.dn_reference_field,
						"=",
						this.frm?.doc.name,
					]);
				}
			} else if (this.connection?.connection_type === "Direct") {
				if (this.frm?.doc.doctype != this.frm?.doc.name) {
					filters.push([
						this.doctype,
						this.connection.link_fieldname,
						"=",
						this.frm?.doc.name,
					]);
				}
			} else if (this.connection?.connection_type === "Indirect") {
				filters.push([
					this.doctype,
					this.connection.foreign_field,
					"=",
					this.frm?.doc?.[this.connection.local_field],
				]);
			} else if (
				this.connection?.connection_type != "Unfiltered" &&
				this.connection.link_fieldname
			) {
				filters.push([
					this.doctype,
					this.connection.link_fieldname,
					"=",
					this.frm?.doc.name,
				]);
			}
			let filters_to_apply = [...filters, ...this.additional_list_filters];
			if (this.connection?.connection_type == "Report") {
				filters_to_apply = {};
				if (this.frm?.["dt_events"]?.[this.doctype || this.link_report]?.get_filters) {
					let get_filters =
						this.frm?.["dt_events"]?.[this.doctype || this.link_report]?.get_filters;
					filters_to_apply =
						(await get_filters(this.doctype || this.link_report, this.frm || {})) ||
						{};
				}
				[...filters, ...this.additional_list_filters].forEach((f) => {
					filters_to_apply[f[1]] = [f[2], f[3]];
				});
			}
			// this.total = await frappe.db.count(this.doctype, { filters: [...filters, ...this.additional_list_filters] });
			let { message } = await this.sva_db.call({
				method: "frappe_theme.dt_api.get_dt_count",
				doctype: this.doctype || this.link_report,
				doc: this.frm?.doc?.name,
				ref_doctype: this.frm?.doc?.doctype,
				filters: filters_to_apply,
				_type: this.connection.connection_type,
				unfiltered: this.connection?.unfiltered,
			});
			if (message) {
				this.total = message;
			}
			// Update pagination after getting total count
			if (this.total > this.limit && !this.isTransposed) {
				const footer = this.wrapper?.querySelector("div#footer-element");
				const footerRight = footer?.querySelector("#sva-dt-footer-right");
				const target = footerRight || footer;
				const existing = target?.querySelector("div#pagination-element");
				if (!existing && target) {
					target.appendChild(this.setupPagination());
				} else if (existing) {
					this.updatePageButtons();
				}
			} else {
				// Remove pagination if not needed
				let paginationElement = this.wrapper
					.querySelector("div#sva-dt-footer-right")
					?.querySelector("div#pagination-element");
				if (!paginationElement) {
					paginationElement = this.wrapper
						.querySelector("div#footer-element")
						?.querySelector("div#pagination-element");
				}
				if (paginationElement) {
					paginationElement.remove();
					this.pageButtonsContainer = null;
				}
			}
			let res = await this.sva_db.call({
				method: "frappe_theme.dt_api.get_dt_list",
				doctype: this.doctype || this.link_report,
				doc: this.frm?.doc?.name,
				ref_doctype: this.frm?.doc?.doctype,
				filters: filters_to_apply,
				fields: this.fields || ["*"],
				limit_page_length: this.isTransposed ? 0 : this.limit,
				order_by: `${this.sort_by} ${this.sort_order}`,
				limit_start: this.isTransposed
					? 0
					: this.page > 0
					? (this.page - 1) * this.limit
					: 0,
				_type: this.connection.connection_type,
				unfiltered: this.connection?.unfiltered,
			});
			const msg = res.message;
			// Non-Report: server returns [rows, link_titles]
			if (Array.isArray(msg) && Array.isArray(msg[0])) {
				const [rows, link_titles] = msg;
				if (link_titles) {
					for (const [key, title] of Object.entries(link_titles)) {
						const sep = key.indexOf("::");
						frappe.utils.add_link_title(key.slice(0, sep), key.slice(sep + 2), title);
					}
				}
				return rows;
			}
			return msg;
		} catch (error) {
			console.error(error);
			return [];
		}
	},
};

export default DataMixin;
