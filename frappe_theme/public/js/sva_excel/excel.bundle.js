import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "../sva_excel/excel.vue";

class Excel {
	constructor(frm, wrapper, conf) {
		this.$wrapper = $(wrapper);
		this.frm = frm;
		this.conf = conf;
		this.init();
	}

	init(refresh) {
		!refresh && this.setup_app();
	}

	cleanup() {
		if (this.app) {
			try {
				this.app.unmount();
				this.app = null;
			} catch (e) {
				console.warn("Error during cleanup:", e);
			}
		}
	}

	refresh() {
		this.cleanup();
		this.setup_app();
	}

	setup_app() {
		// create a pinia instance
		let pinia = createPinia();
		// create a vue instance with dynamic props
		this.app = createApp(App, {
			frm: this.frm || {},
			conf: this.conf || {},
		});
		SetVueGlobals(this.app);
		this.app.use(pinia);

		// mount the app only if wrapper exists
		if (this.$wrapper && this.$wrapper.get(0)) {
			this.app.mount(this.$wrapper.get(0));
		} else {
			console.warn("Wrapper element not found for mounting Vue app");
		}
	}
}

frappe.provide("frappe.ui");
frappe.ui.Excel = Excel;
export default Excel;

// 🔹Header Row detect
// function findHeaderRow(worksheet, maxRows = 20) {
//   const lastCol = worksheet.getLastColumn();
//   for (let r = 0; r < maxRows; r++) {
//     for (let c = 0; c <= lastCol; c++) {
//       const val = worksheet.getRange(r, c).getValue();
//       if (val && ["data", "name"].includes(String(val).trim().toLowerCase())) {
//         return r;
//       }
//     }
//   }
//   return 0;
// }

// // ======= Headers map {colIndex: headerName} =======
// function buildHeaders(worksheet, headerRow) {
//   const headers = {};
//   const lastCol = worksheet.getLastColumn();
//   for (let c = 0; c <= lastCol; c++) {
//     const h = worksheet.getRange(headerRow, c).getValue();
//     if (h) headers[c] = String(h).trim();
//   }
//   console.log(headers,'headers');
//   return headers;
// }
// // ====== prettyFieldName =======
// function prettifyFieldName(field) {
//   return field
//     .split("_")
//     .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//     .join(" ");
// }
// // ======= Update handler onchanges (update-only, id from "data"/"name") =======
// async function handleSheetUpdateOnchanges({ worksheet, row, column }) {
//   const headerRow = findHeaderRow(worksheet);
//   if (row <= headerRow) return;
//   const headers = buildHeaders(worksheet, headerRow);
//   // id column("data" or "name")
//   const idCol = Object.entries(headers).find(([_, h]) =>
//     ["data", "name"].includes(h.toLowerCase())
//   );
//   if (!idCol) return console.warn(" No 'data'/'name' column found");
//   const idColIndex = parseInt(idCol[0], 10);
//   const docname = worksheet.getRange(row, idColIndex).getValue()?.toString().trim();
//   if (!docname) return console.log("No docname in row, skipping update");
//   const field = headers[column];
//   if (!field) return console.log("No header for edited column, skipping");
//   if (["data", "name"].includes(field.toLowerCase())) {
//     worksheet.getRange(row, column).setValue(docname);
//     return frappe.throw("Editing docname not allowed");
//   }
//   const newValue = worksheet.getRange(row, column).getValue() ?? "";

//   // ===== upadte record onchange =====
//   const prettyField = prettifyFieldName(field);
//   await frappe.call({
//     method: "frappe.client.set_value",
//     args: { doctype: "Excel JSON Wb", name: docname, fieldname: { [field]: newValue } }
//   });
//   frappe.show_alert({ message: `Updated ${prettyField}: ${newValue}`, indicator: 'green' },3);
//   console.log(`Updated doc ${docname}: ${field} =`, newValue);
// }
