<template>
	<button
		v-if="actionList.length > 0 || dt.connection.allow_export || dt.connection.allow_import"
		type="button"
		class="btn btn-sm btn-secondary"
		data-toggle="dropdown"
	>
		<svg class="icon icon-sm"><use href="#icon-dot-horizontal"></use></svg>
	</button>
	<div class="dropdown-menu">
		<a v-if="dt.connection.allow_export" class="dropdown-item" @click="exportData">Export</a>
		<a v-if="dt.connection.allow_import" class="dropdown-item" @click="importData">Import</a>
		<span v-for="action in actionList" :key="action.label">
			<a
				:key="action.label"
				class="dropdown-item"
				@click="executeAction(action.action)"
				v-if="!action.hidden"
			>
				{{ action.label }}
			</a>
		</span>
	</div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
	dt: {
		type: Object,
		required: true,
	},
});
const actionList = ref(JSON.parse(props.dt.connection.action_list || "[]"));

const executeAction = (action) => {
	try {
		// Check if action is a valid string
		if (typeof action !== "string" || !action.trim()) {
			frappe.show_alert({
				message: "Invalid action: Action must be a non-empty string",
				indicator: "red",
			});
			return;
		}

		// Try to create and execute the function
		const actionFunction = new Function(action);
		actionFunction();
	} catch (error) {
		// Handle syntax errors and other execution errors
		let errorMessage = "Error executing action";

		if (error instanceof SyntaxError) {
			errorMessage = `Syntax error in action: ${error.message}`;
		} else if (error instanceof ReferenceError) {
			errorMessage = `Reference error in action: ${error.message}`;
		} else if (error instanceof TypeError) {
			errorMessage = `Type error in action: ${error.message}`;
		} else {
			errorMessage = `Execution error: ${error.message}`;
		}

		frappe.show_alert({
			message: errorMessage,
			indicator: "red",
		});

		// Log the full error for debugging
		console.error("Action execution error:", error);
	}
};

const exportData = async () => {
	// Check if this is a Query Report
	if (props.dt.connection.connection_type === "Report") {
		// Handle Query Report export with current filters
		let filters = [];

		// Add link field filter if available
		if (props.dt.connection.link_fieldname && props.dt.frm?.doc?.name) {
			filters.push([
				props.dt.doctype || props.dt.link_report,
				props.dt.connection.link_fieldname,
				"=",
				props.dt.frm.doc.name,
			]);
		}

		try {
			// Get filtered data using the same method as datatable
			let res = await props.dt.sva_db.call({
				method: "frappe_theme.dt_api.get_dt_list",
				doctype: props.dt.doctype || props.dt.link_report,
				doc: props.dt.frm?.doc?.name,
				ref_doctype: props.dt.frm?.doc?.doctype,
				filters: [...filters, ...props.dt.additional_list_filters],
				fields: props.dt.fields || ["*"],
				limit_page_length: 0,
				order_by: `${props.dt.sort_by} ${props.dt.sort_order}`,
				limit_start: 0,
				_type: props.dt.connection.connection_type,
				unfiltered: props.dt.connection?.unfiltered,
			});

			if (res.message && res.message.length > 0) {
				// Get column headers from datatable
				let columns = props.dt.header || [];
				let headers = columns.map((col) => col.label || col.fieldname);

				// Prepare data based on transpose state
				let dataWithHeaders;
				if (props.dt.isTransposed) {
					// For transposed export: rows become columns
					dataWithHeaders = [
						["Fields", ...res.message.map((_, index) => index + 1)],
						...columns.map((col) => [
							col.label || col.fieldname,
							...res.message.map((row) => row[col.fieldname] || ""),
						]),
					];
				} else {
					// Normal export
					dataWithHeaders = [
						headers,
						...res.message.map((row) =>
							columns.map((col) => row[col.fieldname] || "")
						),
					];
				}

				frappe.tools.downloadify(
					dataWithHeaders,
					null,
					props.dt.doctype || props.dt.link_report
				);
			} else {
				frappe.show_alert({
					message: "No data to export",
					indicator: "orange",
				});
			}
		} catch (error) {
			frappe.show_alert({
				message: "Export failed: " + error.message,
				indicator: "red",
			});
		}
	} else {
		// Handle regular DocType export
		frappe.require("data_import_tools.bundle.js").then(() => {
			let exporter = new frappe.data_import.DataExporter(
				props.dt.doctype,
				"Insert New Records"
			);
			setTimeout(() => {
				if (exporter) {
					exporter.dialog.set_value("export_records", "by_filter");
					exporter.filter_group.add_filter(
						props.dt.doctype,
						props.dt.connection.link_fieldname,
						"equals",
						props.dt.frm.docname
					);
				}
			}, 1000);
		});
	}
};

const importData = () => {
	// Disable import for Reports
	if (props.dt.connection.connection_type === "Report") {
		frappe.show_alert({
			message: "Import is not available for Reports",
			indicator: "orange",
		});
		return;
	}

	let dialog = new frappe.ui.Dialog({
		title: "Import Data",
		fields: [
			{
				fieldname: "import_type",
				label: "Import Type",
				fieldtype: "Select",
				options: "\nInsert New Records\nUpdate Existing Records",
				reqd: 1,
				change: function () {
					let import_type = this.get_value();
					if (import_type) {
						frappe.db
							.insert({
								doctype: "Data Import",
								reference_doctype: props.dt.doctype,
								import_type: import_type,
							})
							.then((doc) => {
								frappe.show_alert({
									message: "Data Import created successfully",
									indicator: "success",
								});
								dialog.set_value("import_name", doc.name);
								dialog.set_df_property("import_type", "read_only", 1);
							});
					}
				},
			},
			{
				fieldname: "download_template",
				label: "Download Template",
				fieldtype: "Button",
				depends_on: "eval:doc.import_type",
				click: function () {
					frappe.require("data_import_tools.bundle.js").then(() => {
						new frappe.data_import.DataExporter(
							props.dt.doctype,
							"Insert New Records"
						);
					});
				},
			},
			{
				fieldname: "import_file",
				label: "Import File",
				fieldtype: "Attach",
				depends_on: "eval:doc.import_type",
				mandatory_depends_on: "eval:doc.import_type",
				change: function () {
					let import_file = this.get_value();
					if (import_file) {
						frappe.db.set_value(
							"Data Import",
							dialog.get_value("import_name"),
							"import_file",
							import_file
						);
					}
				},
			},
			{
				fieldname: "import_name",
				label: "Name",
				fieldtype: "Data",
				hidden: 1,
			},
		],
		primary_action_label: "Import Data",
		primary_action: (values) => {
			frappe.set_route("Form", "Data Import", values.import_name);
		},
	});
	dialog.show();
};
</script>
