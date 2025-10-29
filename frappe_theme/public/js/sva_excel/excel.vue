<template>
	<div ref="container_excel" id="sva_container_excel"></div>
</template>

<script setup>
import { ref, onMounted, defineProps } from "vue";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { UniverSheetsAdvancedPreset } from "@univerjs/preset-sheets-advanced";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import UniverPresetSheetsDrawingEnUS from "@univerjs/preset-sheets-drawing/locales/en-US";
import UniverPresetSheetsAdvancedEnUS from "@univerjs/preset-sheets-advanced/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "@univerjs/preset-sheets-advanced/lib/index.css";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import UniverPresetSheetsDataValidationEnUS from "@univerjs/preset-sheets-data-validation/locales/en-US";
import "@univerjs/preset-sheets-data-validation/lib/index.css";

const container_excel = ref(null);

const props = defineProps({
	frm: {
		type: Object,
		required: true,
	},
	conf: {
		type: Object,
		required: true,
	},
});

function initUniver(container) {
	const { univer, univerAPI } = createUniver({
		locale: LocaleType.EN_US,
		locales: {
			[LocaleType.EN_US]: mergeLocales(
				UniverPresetSheetsCoreEnUS,
				UniverPresetSheetsDrawingEnUS,
				UniverPresetSheetsAdvancedEnUS,
				UniverPresetSheetsDataValidationEnUS
			),
		},
		presets: [
			UniverSheetsCorePreset({
				container: container_excel.value,
				header: false,
				toolbar: false,
				footer: false,
				contextMenu: true,
			}),
			UniverSheetsAdvancedPreset({
				exchangeClientOptions: { enableServerSideComputing: false },
			}),
			UniverSheetsDataValidationPreset(),
		],
	});
	return { univer, univerAPI };
}

// =========== onMounted ===========
onMounted(async () => {
	const { univerAPI } = initUniver(container_excel.value);

	try {
		const response = await frappe.call({
			method: props.conf?.endpoint,
			args: {
				doc: JSON.stringify(props.frm?.doc),
			},
			freeze: true,
		});
		const workbookData = response.message;
		const workbook = await univerAPI.createWorkbook(workbookData);

		// =========== no edit permission ===========
		const permission = workbook.getPermission();
		const workbookEditablePerm =
			permission.permissionPointsDefinition.WorkbookEditablePermission;
		const unitId = workbook.getId();
		permission.setWorkbookPermissionPoint(unitId, workbookEditablePerm, false);

		// ==== catch =====
	} catch (error) {
		console.error("Error loading workbook:", error);
	}
});
</script>

<style scoped>
#sva_container_excel {
	width: 90% !important;
	height: 50vh !important;
	z-index: -1000 !important;
}
#sva_container_excel ::v-deep(canvas[data-u-comp="render-canvas"]) {
	z-index: 0 !important;
	touch-action: auto !important;
}
</style>
