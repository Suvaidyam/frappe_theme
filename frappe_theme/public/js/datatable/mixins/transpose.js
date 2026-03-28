const TransposeMixin = {
	transposeTable() {
		if (!this.table) return;

		const rows = Array.from(this.table.rows);

		// Handle no data case - create empty transposed structure
		if (this.rows.length === 0) {
			this.table.innerHTML = "";
			const thead = this.table.createTHead();
			const tbody = this.table.createTBody();

			// Create header row with action column
			const actionRow = thead.insertRow();

			// Add settings button
			const settingsTh = document.createElement("th");
			settingsTh.style.cssText =
				"width:150px; text-align:left;position:sticky;right:0px;background-color:#F3F3F3;";
			settingsTh.appendChild(this.createSettingsButton());
			actionRow.appendChild(settingsTh);

			// Add single header for message
			const messageTh = document.createElement("th");
			messageTh.style.backgroundColor = "#F3F3F3";
			messageTh.style.textAlign = "center";
			messageTh.style.width = "400px";
			messageTh.innerHTML = "";
			actionRow.appendChild(messageTh);

			// Add rows for each column name
			this.columns.forEach((column, index) => {
				const row = tbody.insertRow();
				row.style.maxHeight = "32px";
				row.style.height = "32px";
				row.style.backgroundColor = "#fff";

				const labelCell = row.insertCell();
				labelCell.innerHTML = column.label || column.fieldname;
				labelCell.style.cssText =
					"height:32px;padding:0px 5px;font-weight:normal;width:150px;min-width:150px;";

				// Only add value cell for first row, others will be covered by rowSpan
				if (index === 0) {
					const valueCell = row.insertCell();
					valueCell.innerHTML = `
						<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px 0;">
							<svg class="icon icon-lg" style="stroke: var(--text-light);margin-bottom:15px;">
								<use href="#icon-small-file"></use>
							</svg>
							<p style="margin:0;font-size:14px;">You haven't created a record yet</p>
						</div>
					`;
					valueCell.rowSpan = this.columns.length;
					valueCell.style.cssText = `padding:0px;width:100%;vertical-align:middle;text-align:center;height:${
						this.columns.length * 32 + 30
					}px;line-height:32px;`;
				}
			});

			return;
		}

		if (rows.length === 0) return;

		// Convert to matrix excluding action column (last column)
		const matrix = rows.map((row) =>
			Array.from(row.cells)
				.slice(0, -1)
				.map((cell) => cell.innerHTML)
		);

		// Transpose data columns
		const transposed = matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));

		// Remove stale action dropdown menus from document.body before rebuilding
		const _dtTableKey = `${this?.doctype || this?.link_report || "unknown"}-${
			this?.connection?.html_field || "unknown"
		}`;
		document.querySelectorAll(".sva-dt-action-dropdown").forEach((menu) => {
			if (menu.dataset.dtTableKey === _dtTableKey) {
				menu.remove();
			}
		});

		// Clear and rebuild
		this.table.innerHTML = "";
		const thead = this.table.createTHead();
		const tbody = this.table.createTBody();

		// First row: settings button + one live action dropdown per data row
		const actionRow = thead.insertRow();

		// Sticky settings cell (first column label)
		const settingsTh = document.createElement("th");
		settingsTh.style.position = "sticky";
		settingsTh.style.left = "0px";
		settingsTh.style.zIndex = "3";
		settingsTh.style.backgroundColor = "#F3F3F3";
		settingsTh.style.textAlign = "left";
		settingsTh.style.borderRight = "1px solid #dee2e6";
		settingsTh.appendChild(this.createSettingsButton());
		actionRow.appendChild(settingsTh);

		// One action cell per data row — recreated with live event listeners
		const hasActionPerms =
			(this.conf_perms.length &&
				(this.conf_perms.includes("read") ||
					this.conf_perms.includes("delete") ||
					this.conf_perms.includes("write"))) ||
			this.childLinks?.length;

		this.rows.forEach((rowData) => {
			const th = document.createElement("th");
			th.style.backgroundColor = "#F3F3F3";
			th.style.minWidth = "50px";
			th.style.position = "relative";

			if (this.connection.connection_type === "Report") {
				th.style.display = "none";
			} else if (hasActionPerms) {
				const primaryKey = rowData?.name || rowData?.rowIndex;
				const actionCol = this.createActionColumn(rowData, primaryKey);
				// Pin the three-dot button to the right edge of the cell
				actionCol.style.position = "absolute";
				actionCol.style.right = "4px";
				actionCol.style.top = "50%";
				actionCol.style.transform = "translateY(-50%)";
				th.appendChild(actionCol);
			}

			actionRow.appendChild(th);
		});

		// Rest of transposed data
		transposed.forEach((rowCells, rowIndex) => {
			const col = rowIndex < this.header.length ? this.header[rowIndex] : null;
			const isWrapped = !!col?.wrap;

			const row = tbody.insertRow();
			row.style.backgroundColor = "#fff";
			if (isWrapped) {
				row.style.height = "auto";
			} else {
				row.style.maxHeight = "32px";
				row.style.height = "32px";
			}

			rowCells.forEach((cellData, colIndex) => {
				const cell = row.insertCell();
				cell.innerHTML = cellData;
				cell.style.padding = "0px 5px";
				cell.style.textAlign = "left";

				if (isWrapped) {
					cell.style.whiteSpace = "normal";
					cell.style.wordBreak = "break-word";
					cell.style.overflowWrap = "break-word";
					cell.style.overflow = "visible";
					cell.style.textOverflow = "unset";
					cell.style.height = "auto";
					cell.style.minHeight = "32px";
				} else {
					cell.style.height = "32px";
					cell.style.whiteSpace = "nowrap";
					cell.style.overflow = "hidden";
					cell.style.textOverflow = "ellipsis";
				}

				// Make first column sticky
				if (colIndex === 0) {
					cell.style.position = "sticky";
					cell.style.left = "0px";
					cell.style.zIndex = "2";
					cell.style.backgroundColor = "#f8f9fa";
					cell.style.fontWeight = "500";
					cell.style.borderRight = "1px solid #dee2e6";
				}

				// Apply column settings from header (rowIndex maps to original columns)
				if (col) {
					if (col?.width) {
						cell.style.width = `${Number(col.width) * 50}px`;
						cell.style.minWidth = `${Number(col.width) * 50}px`;
						cell.style.maxWidth = `${Number(col.width) * 50}px`;
					}
					// colIndex 0 is the sticky label cell — skip color overrides there
					if (colIndex > 0) {
						if (col?.color) cell.style.color = col.color;
						if (col?.bg_color) cell.style.backgroundColor = col.bg_color;
					}
				}
			});
		});
	},
};

export default TransposeMixin;
