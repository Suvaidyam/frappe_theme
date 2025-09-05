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
let workbookRef = null; 

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

// =========== onMounted ===========
onMounted(async () => {
  const { univerAPI } = initUniver(container.value);
  try {
    const testDoc = await frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Excel JSON Wb",
        fields: ["name","first_name", "last_name", "gender", "age"],
        order_by: "creation asc",
        limit_page_length: 100
      }
    });
    let workbookData = null;
    // 🔹 Load default workbook first
    const response = await frappe.call({
      method: "frappe_theme.apis.excel.excel",
      args: {},
      freeze: true,
    });
    if (!response.message) {
      throw new Error("Workbook data not found in API response");
    }
    workbookData = response.message;
    // 🔹 Now append DB records
    if (testDoc.message && testDoc.message.length > 0) {
      const records = testDoc.message; 
      const headers = Object.keys(records[0]);
      const sheetId = workbookData.sheetOrder[0];
      const sheet = workbookData.sheets[sheetId];
      let cellData = sheet.cellData || {};
      // 🔹 Find last row index in existing cellData
      const existingRows = Object.keys(cellData).map(r => parseInt(r));
      const lastRow = existingRows.length > 0 ? Math.max(...existingRows) : 0;
      // 🔹 Append new rows after lastRow
      records.forEach((rowObj, idx) => {
        const excelRow = lastRow + 1 + idx; // next available row
        headers.forEach((header, colIdx) => {
          if (!cellData[excelRow]) cellData[excelRow] = {};
          cellData[excelRow][colIdx] = { v: rowObj[header] };
        });
      });
      // Update back
      sheet.cellData = cellData;
    }
    // 🔹 Create workbook in Univer
    const workbook = await univerAPI.createWorkbook(workbookData);
    console.log("Workbook created successfully with appended rows", workbookData);

    workbookRef = univerAPI.getActiveWorkbook();

  } catch (error) {
    console.error("Error creating workbook:", error);
  }
});

// ========== saveRecord ==========
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
  
// ======= insertOrUpdateExcelRecord =========
  for (let row of allResults) {
    await insertOrUpdateExcelRecord(row);
  } 
  // ======== Msg =========
  showFinalMessage();
  return allResults;
}

// ======= insertOrUpdateExcelRecord =========
let createdCount = 0;
let updatedCount = 0;
async function insertOrUpdateExcelRecord(row) {
  try {
    let res;
    if (row.data) {
      // 🔹 Update existing record
      res = await frappe.call({
        method: "frappe.client.set_value",
        args: {
          doctype: "Excel JSON Wb",
          name: row.data,
          fieldname: {
            first_name: row.first_name || "",
            last_name: row.last_name || "",
            gender: row.gender || "",
            age: row.age || ""
          }
        }
      });
      if (res && res.message) updatedCount++;
    } else {
      // 🔹 Insert new record
      res = await frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Excel JSON Wb",
            first_name: row.first_name || "",
            last_name: row.last_name || "",
            gender: row.gender || "",
            age: row.age || ""
          }
        }
      });
      if (res && res.message) createdCount++;
    }
    return res.message;

  } catch (err) {
    frappe.throw(`Failed to save record. ${err.message || err}`);
  }
}

function showFinalMessage() {
  if (createdCount || updatedCount) {
    frappe.msgprint(
      `${createdCount} record(s) created, ${updatedCount} record(s) updated successfully`
    );
  } else {
    frappe.throw("No records were saved");
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







