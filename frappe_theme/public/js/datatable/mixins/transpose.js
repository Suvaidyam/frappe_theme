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

			// Add column headers for each column
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

		// Extract action column (last column) from all rows
		const actionColumn = rows.map((row) => row.cells[row.cells.length - 1]);

		// Convert to matrix excluding action column
		const matrix = rows.map((row) =>
			Array.from(row.cells)
				.slice(0, -1)
				.map((cell) => cell.innerHTML)
		);

		// Transpose data columns
		const transposed = matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));

		// Clear and rebuild
		this.table.innerHTML = "";
		const thead = this.table.createTHead();
		const tbody = this.table.createTBody();

		// First row: action column as first row
		const actionRow = thead.insertRow();
		actionColumn.forEach((originalCell, index) => {
			const th = document.createElement("th");
			th.style.cssText = originalCell.style.cssText;
			th.style.backgroundColor = "#F3F3F3";

			// Make first header cell sticky
			if (index === 0) {
				th.style.position = "sticky";
				th.style.left = "0px";
				th.style.zIndex = "3";
				th.style.backgroundColor = "#F3F3F3";
				th.style.textAlign = "left";
				th.style.borderRight = "1px solid #dee2e6";
				th.appendChild(this.createSettingsButton());
			} else {
				// For three dot actions, center align
				th.style.textAlign = "center";
				// Hide action columns for reports to prevent overlap
				if (this.connection.connection_type === "Report") {
					th.style.display = "none";
				} else {
					th.innerHTML = originalCell.innerHTML;
				}
			}

			actionRow.appendChild(th);
		});

		// Rest of transposed data
		transposed.forEach((rowData, rowIndex) => {
			const row = tbody.insertRow();
			row.style.maxHeight = "32px";
			row.style.height = "32px";
			row.style.backgroundColor = "#fff";

			rowData.forEach((cellData, colIndex) => {
				const cell = row.insertCell();
				cell.innerHTML = cellData;
				cell.style.height = "32px";
				cell.style.whiteSpace = "nowrap";
				cell.style.overflow = "hidden";
				cell.style.textOverflow = "ellipsis";
				cell.style.padding = "0px 5px";
				cell.style.textAlign = "left";

				// Make first column sticky
				if (colIndex === 0) {
					cell.style.position = "sticky";
					cell.style.left = "0px";
					cell.style.zIndex = "2";
					cell.style.backgroundColor = "#f8f9fa";
					cell.style.fontWeight = "500";
					cell.style.borderRight = "1px solid #dee2e6";
				}

				// Apply width from header settings (now rowIndex maps to original columns)
				if (rowIndex < this.header.length) {
					const col = this.header[rowIndex];
					if (col?.width) {
						cell.style.width = `${Number(col.width) * 50}px`;
						cell.style.minWidth = `${Number(col.width) * 50}px`;
						cell.style.maxWidth = `${Number(col.width) * 50}px`;
					}
				}
			});
		});
	},
};

export default TransposeMixin;
