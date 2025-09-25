<template>
  <div class="w-full h-full">
    <div
    ref="container_excel"
    style="width: 100%; height: 60vh;"
    ></div>
</div>
</template>
 
<script setup>
import { ref, onMounted,defineProps } from "vue";
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

      )
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
      UniverSheetsDataValidationPreset()
    ],
  })
  return { univer, univerAPI };
}

// =========== onMounted ===========
onMounted(async () => {
  const { univerAPI } = initUniver(container_excel.value);

    try {
    const response = await frappe.call({
      method: props.conf?.endpoint,
      args: {
        name:props.frm?.doc?.name
      },
      freeze: true,
    });
    const workbookData = response.message;
    const workbook = await univerAPI.createWorkbook(workbookData);

    // =========== no edit permission ===========
    const permission = workbook.getPermission();
    const workbookEditablePerm = permission.permissionPointsDefinition.WorkbookEditablePermission;
    const unitId = workbook.getId();
    permission.setWorkbookPermissionPoint(unitId, workbookEditablePerm, false);
    
    // ==== catch =====
  } catch (error) {
    console.error("Error loading workbook:", error);
  }
 
});

</script>
