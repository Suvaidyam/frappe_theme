<template>
  <div class="w-full h-full">
    <div
    ref="container"
    style="width: 100%; height: 60vh; border: 1px solid #ccc"
    ></div>
</div>
</template>
 
<script setup>
import { ref, onMounted } from "vue";
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced'
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US'
import UniverPresetSheetsAdvancedEnUS from '@univerjs/preset-sheets-advanced/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-drawing/lib/index.css'
import '@univerjs/preset-sheets-advanced/lib/index.css'
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation'
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US'
import '@univerjs/preset-sheets-data-validation/lib/index.css'

const container = ref(null);
let workbookRef = null; 

function initUniver(container) {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        UniverPresetSheetsCoreEnUS,
        UniverPresetSheetsDrawingEnUS,
        UniverPresetSheetsAdvancedEnUS,
        UniverPresetSheetsDataValidationEnUS

      )
    },
    presets: [
      UniverSheetsCorePreset({
        container: container,
        header: false,     
        toolbar: false,    
        footer: false,     
        contextMenu: true,
      }),
      UniverSheetsAdvancedPreset({
        exchangeClientOptions: { enableServerSideComputing: false },
      }),
      UniverSheetsDataValidationPreset()
    ],
  })
  return { univer, univerAPI };
}

// =========== onMounted ===========
onMounted(async () => {
  const { univerAPI } = initUniver(container.value);

    try {
    const response = await frappe.call({
      method: "frappe_theme.apis.excel.get_excel_json",
      args: {
        project_name:"P-2378"
      },
      freeze: true,
    });
    const workbookData = response.message;
    console.log("Loaded workbookData:", workbookData);
    const workbook = await univerAPI.createWorkbook(workbookData);

    // =========== no edit permission ===========
    const permission = workbook.getPermission();
    const workbookEditablePerm = permission.permissionPointsDefinition.WorkbookEditablePermission;
    const unitId = workbook.getId();
    permission.setWorkbookPermissionPoint(unitId, workbookEditablePerm, false);
    
    // ==== catch ====
  } catch (error) {
    console.error("Error loading workbook:", error);
  }
 
});

</script>

<style scoped>
/* .save-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
  margin-bottom: 10px;
}
  */
/* .save-btn:hover {
  background-color: #45a049;
} */
</style>