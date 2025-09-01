<template>
  <div class="w-full h-full">
     <div>
    <button type="button" class="save-btn" @click="saveRecord">
      Save Record
    </button>
  </div>
    <div
      ref="container"
      style="width: 100%; height: 60vh; border: 1px solid #ccc"
    ></div>
  </div>
</template>
 
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
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
} catch (error) {
  console.error("Error creating workbook:", error);
}

// const permission = workbook.getPermission();
// const workbookEditablePerm = permission.permissionPointsDefinition.WorkbookEditablePermission;
// const unitId = workbook.getId();
// permission.setWorkbookPermissionPoint(unitId, workbookEditablePerm, false);
  // workbookRef = workbook;
   workbookRef = univerAPI.getActiveWorkbook();

// console.log('workbook',workbook)
});
 
 // 🔹 Save button handler
function saveRecord() {
  if (workbookRef) {
    const workbookJson = workbookRef.save();
    console.log("Excel JSON (IWorkbookData):", workbookJson);

  } else {
    console.error("univerAPI not initialized")
  }
  // if (!workbookRef) return;

  // const snapshot = workbookRef.getSnapshot();
  // const sheets = snapshot.sheets;

  // let filledCells = [];

  // Object.values(sheets).forEach((sheet) => {
  //   const cellData = sheet.cellData || {};
  //   Object.entries(cellData).forEach(([rowIndex, row]) => {
  //     Object.entries(row).forEach(([colIndex, cell]) => {
  //       if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
  //         filledCells.push({
  //           sheet: sheet.name,
  //           row: parseInt(rowIndex),
  //           col: parseInt(colIndex),
  //           value: cell.v,
  //         });
  //       }
  //     });
  //   });
  // });

  // console.log(" Filled cells:", filledCells);
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







