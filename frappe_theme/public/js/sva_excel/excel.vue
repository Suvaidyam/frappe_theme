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
// onMounted(async () => {
//   const { univerAPI } = initUniver(container.value);

//   try {
//     const testDoc = await frappe.call({
//       method: "frappe.client.get_list",
//       args: {
//         doctype: "Excel Workbook",
//         fields: ["name", "json"],
//         order_by: "creation desc",
//         limit_page_length: 1
//       }
//     });

//     let workbookData = null;

//     if (testDoc.message && testDoc.message.length > 0) {
//       const savedSheets = JSON.parse(testDoc.message[0].json);
//       console.log(savedSheets,'savedSheets');
//       // WorkbookData structure 
//       workbookData = {
//         id: crypto.randomUUID(),
//         locale: "enUS",
//         name: savedSheets.name || "",
//         appVersion: "0.10.2",
//         sheetOrder: Object.keys(savedSheets),
//         sheets: savedSheets
//       };
//       console.log("Loaded workbook data from Test:", workbookData);
//     } else {
//       const response = await frappe.call({
//         method: "frappe_theme.apis.excel.excel",
//         args: {},
//         freeze: true,
//       });

//       if (!response.message) {
//         throw new Error("Workbook data not found in API response");
//       }

//       workbookData = response.message;
//     }

//     // 🔹 Workbook create
//     const workbook = await univerAPI.createWorkbook(workbookData);
//     console.log("Workbook created successfully",workbookData);

//     workbookRef = univerAPI.getActiveWorkbook();

//   } catch (error) {
//     console.error("Error creating workbook:", error);
//   }
// });

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
 
async function saveRecord() {
  if (!workbookRef) {
    console.error("univerAPI not initialized");
    return;
  }

  // 1 Workbook ko JSON me save karo
  const workbookJson = workbookRef.save();
  const sheetsData = workbookJson.sheets;

  let allResults = [];

  // 2 Process each sheet
  for (let sheetId in sheetsData) {
    let sheet = sheetsData[sheetId];
    let cellData = sheet.cellData || {};

    // Transform cellData to flat structure
    let flatCellData = {};
    Object.keys(cellData).forEach(rowKey => {
      let row = cellData[rowKey];
      Object.keys(row).forEach(colKey => {
        let cell = row[colKey];
        if (cell && cell.v !== undefined) {
          flatCellData[`R${rowKey}-C${colKey}`] = cell.v;
        }
      });
    });

    // 3 Find header row - Row with most non-empty cells
    let headerRow = null;
    let maxColumns = 0;
    const rowStats = {};
    
    for (let key in flatCellData) {
      const [r, c] = key.replace('R','').split('-C').map(Number);
      const cellValue = flatCellData[key];
      
      if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
        if (!rowStats[r]) rowStats[r] = 0;
        rowStats[r]++;
      }
    }
    
    // Select row with maximum filled columns
    for (let row in rowStats) {
      if (rowStats[row] > maxColumns) {
        maxColumns = rowStats[row];
        headerRow = parseInt(row);
      }
    }
    
    if (!headerRow) {
      console.warn(`No header row found for sheet ${sheetId}`);
      continue;
    }

    // 4 Extract headers from header row
    const headers = {};
    for (let key in flatCellData) {
      if (key.startsWith(`R${headerRow}-C`)) {
        const col = parseInt(key.split('-C')[1]);
        const headerValue = flatCellData[key];
        
        if (headerValue !== null && headerValue !== undefined && headerValue !== '') {
          headers[col] = headerValue.toString().trim();
        }
      }
    }
    
    console.log('Headers:', headers);

    // 5 Process data rows
    const rowData = {};
    for (let key in flatCellData) {
      const [r, c] = key.replace('R','').split('-C').map(Number);
      
      if (r > headerRow) {
        if (!rowData[r]) rowData[r] = {};
        const headerName = headers[c];
        if (headerName) {
          rowData[r][headerName] = flatCellData[key];
        }
      }
    }

    // 6 Filter and format results
    const finalArray = Object.values(rowData).filter(row => {
      return Object.values(row).some(value => 
        value !== null && value !== undefined && value !== ''
      );
    });
        
    // Add to combined results
    allResults = [...allResults, ...finalArray];
  }
  console.log('Final Results:', allResults);
  return allResults;
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







