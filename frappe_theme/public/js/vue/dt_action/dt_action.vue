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

const exportData = () => {
	frappe.require("data_import_tools.bundle.js").then(() => {
		let exporter = new frappe.data_import.DataExporter(props.dt.doctype, "Insert New Records");
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
};

const importData = () => {
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
