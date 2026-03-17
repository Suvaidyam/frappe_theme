const HelpersMixin = {
	setTitle(label) {
		this.label = label;
		this.header_element.querySelector("span#dt-title").textContent = `${
			this.label ? this.label : " "
		}`;
	},
	hideSkeletonLoader(reLoad = false) {
		if (this.skeletonLoader) {
			this.skeletonLoader.remove();
			this.skeletonLoader = null;
			this.table_wrapper?.querySelector("div#sva_table_wrapper")?.classList.remove("hidden");
			if (!reLoad) {
				this.header_element?.classList.remove("hidden");
				this.footer_element?.classList.remove("hidden");
			}
		}
	},
	showSkeletonLoader(reLoad = false) {
		const existingSkeleton = this.wrapper.querySelector("#skeleton-loader-overlay");
		if (existingSkeleton) {
			existingSkeleton.remove();
		}
		this.table_wrapper?.querySelector("div#sva_table_wrapper")?.classList.add("hidden");
		if (!reLoad) {
			this.header_element?.classList.add("hidden");
			this.footer_element?.classList.add("hidden");
		}
		this.skeletonLoader = this.createSkeletonLoader(reLoad);
		if (!reLoad) {
			this.wrapper.appendChild(this.skeletonLoader);
		} else {
			this.table_wrapper.appendChild(this.skeletonLoader);
		}
	},
	findDOMRowByDocname(docname, rowIndex) {
		const tableRows = this.tBody.querySelectorAll("tr");

		for (let i = 0; i < tableRows.length; i++) {
			const row = tableRows[i];

			// Strategy 1: Check if row has data-docname attribute
			if (row.getAttribute("data-docname") === docname) {
				return i;
			}

			// Strategy 2: Check if any cell contains the document name
			const nameCell =
				row.querySelector('td[data-docname="' + docname + '"]') ||
				row.querySelector('td:first-child p[data-docname="' + docname + '"]') ||
				row.querySelector('td a[href*="' + docname + '"]');

			if (nameCell) {
				return i;
			}

			// Strategy 3: Check serial number if serialNumberColumn is enabled
			if (this.options.serialNumberColumn) {
				const serialCell = row.querySelector("td:first-child p");
				if (serialCell) {
					const expectedSerial =
						this.page > 1
							? (this.page - 1) * this.limit + (rowIndex + 1)
							: rowIndex + 1;
					if (parseInt(serialCell.textContent) === expectedSerial) {
						return i;
					}
				}
			}

			// Strategy 4: Check by position/index when serialNumberColumn is disabled
			if (!this.options.serialNumberColumn && i === rowIndex) {
				return i;
			}

			// Strategy 5: Check for document name in any text content
			const rowText = row.textContent || "";
			if (rowText.includes(docname)) {
				// Additional verification: check if it's actually a document name cell
				const cells = row.querySelectorAll("td");
				for (let cell of cells) {
					if (cell.textContent && cell.textContent.trim() === docname) {
						return i;
					}
				}
			}
		}

		return -1;
	},
	add_field(df, parent) {
		if (!df.placeholder) {
			df.placeholder = df.label;
		}

		df.input_class = "input-xs";

		var f = frappe.ui.form.make_control({
			df: df,
			parent: parent || this.page_form,
			only_input: df.fieldtype == "Check" ? false : true,
		});
		this.standard_filters_fields_dict[df.fieldname] = f;
		f.refresh();
		$(f.wrapper)
			.attr("title", __(df.label, null, df.parent))
			.tooltip({
				delay: { show: 600, hide: 100 },
				trigger: "hover",
			});
		this.restyle_field(f);
		// html fields in toolbar are only for display
		if (df.fieldtype == "HTML") {
			return;
		}

		// hidden fields dont have $input
		if (!f.$input) f.make_input();

		f.$input.attr("placeholder", __(df.label, null, df.parent));

		if (df.fieldtype === "Check") {
			$(f.wrapper).find(":first-child").removeClass("col-md-offset-4 col-md-8");
		}

		if (df.fieldtype == "Button") {
			$(f.wrapper).find(".page-control-label").html("&nbsp;");
			f.$input.addClass("btn-xs").css({ width: "100%", "margin-top": "-1px" });
		}
		return f;
	},
	restyle_field(f) {
		$(f.wrapper).css("margin", "0px");

		$(f.wrapper).find("select").css("width", "140px");
		$(f.wrapper).find(".select-icon").css("top", "2px");
	},
	handleNoPermission() {
		let noPermissionPage = document.createElement("div");
		noPermissionPage.id = "noPermissionPage";
		noPermissionPage.style.height = "100%";
		noPermissionPage.style.fontSize = "20px";
		noPermissionPage.style.textAlign = "center";
		noPermissionPage.style.paddingTop = "50px";
		noPermissionPage.style.color = "grey";
		noPermissionPage.textContent =
			"You do not have permission through role permission to access this resource.";
		if (!this.wrapper.querySelector("#noPermissionPage")) {
			this.wrapper.appendChild(noPermissionPage);
		}
	},
};

export default HelpersMixin;
