<template>
  <div class="w-full h-full">
    <div
    ref="container"
    style="width: 100%; height: 60vh; border: 1px solid #ccc"
    ></div>
   <div class="py-2 d-flex justify-content-end">
  <button 
    type="button" 
    class="btn btn-primary btn-sm"
    @click="saveRecord"
  >
    Save Record
  </button>
</div>

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

const container = ref(null);

function initUniver(container) {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        UniverPresetSheetsCoreEnUS,
        UniverPresetSheetsDrawingEnUS,
        UniverPresetSheetsAdvancedEnUS
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
 
    ],
  })
  return { univer, univerAPI };
}
let workbookRef = null; 
onMounted( async () => {
  
const { univerAPI} = initUniver(container.value);
  
 try {
  const response = await frappe.call({
    method: "frappe_theme.apis.excel.excel",
    args: {},
    freeze: true,
  });

  console.log("API Response:", response);

  if (!response.message) {
    throw new Error("Workbook data not found in API response");
  }

  //  workbook create
  const workbook = await univerAPI.createWorkbook(response.message);
  console.log("Workbook created successfully:", response.message);

  workbookRef = univerAPI.getActiveWorkbook();

  // ============ edit permissions disabled ============
// const permission = workbook.getPermission();
// const workbookEditablePerm = permission.permissionPointsDefinition.WorkbookEditablePermission;
// const unitId = workbook.getId();
// permission.setWorkbookPermissionPoint(unitId, workbookEditablePerm, false);
} catch (error) {
  console.error("Error creating workbook:", error);
}
});
 
 // 🔹 Save button handler
function saveRecord() {
  if (workbookRef) {
    const workbookJson = workbookRef.save();
    console.log("Excel JSON (IWorkbookData):", workbookJson);

  } else {
    console.error("univerAPI not initialized")
  }

}

</script>

<style scoped>
.save-btn {
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
 
.save-btn:hover {
  background-color: #45a049;
}
</style>







