<template>
  <div class="d-flex gap-3 overflow-auto">
    <!-- ✅ Single table on small screens -->
    <div class="d-block d-md-none w-100" style="max-height: 550px; overflow: auto;">
      <table class="table border" style="min-width: 200px;">
        <thead class="table-light">
          <tr>
            <th>State</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data" :key="item.state" :style="{ cursor: 'pointer', userSelect: 'none' }"
            :class="{ 'bg-light fw-bold': selectedStates.includes(item.state) }" @click="onStateClick(item.state)">
            <td :class="`text-${item.style?.toLowerCase()}`" style="padding: 4px !important;">{{ item.state }}</td>
            <td :class="`text-${item.style?.toLowerCase()} fw-semibold`" style="padding: 4px !important;">{{ item.count
            }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ✅ Split tables on larger screens -->
    <template v-if="data.length > 1">
      <div class="d-none d-md-block" v-for="(half, i) in [firstHalf, secondHalf]" :key="i"
        style="max-height: 550px; overflow: auto;" v-if="i === 0 || secondHalf.length">
        <table class="table border" style="min-width: 200px; width: 550px;">
          <thead class="table-light">
            <tr>
              <th>State</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in half" :key="item.state" :style="{ cursor: 'pointer', userSelect: 'none' }"
              :class="{ 'bg-light fw-bold': selectedStates.includes(item.state) }" @click="onStateClick(item.state)">
              <td :class="`text-${item.style?.toLowerCase()}`" style="padding: 4px !important;">{{ item.state }}</td>
              <td :class="`text-${item.style?.toLowerCase()} fw-semibold`" style="padding: 4px !important;">{{
                item.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'

const selectedStates = ref([]) // ✅ multiple selection

const onStateClick = (state) => {
  const index = selectedStates.value.indexOf(state)
  if (index > -1) {
    selectedStates.value.splice(index, 1)
  } else {
    selectedStates.value.push(state)
  }

  if (selectedStates.value.length === 0) {
    window.parent.postMessage({ type: 'RESET_FILTER' }, '*')
  } else {
    window.parent.postMessage({ type: 'FILTER_BY_STATE', states: [...selectedStates.value] }, '*')
  }
}

const data = ref([])
const props = defineProps({ doctype: { required: true } })

const get_data = async () => {
  const res = await frappe.call({
    method: 'frappe_theme.api.get_workflow_count',
    args: { doctype: props.doctype }
  })
  if (res) data.value = res.message
}
get_data()

const mid = computed(() => Math.ceil(data.value.length / 2))
const firstHalf = computed(() => data.value.slice(0, mid.value))
const secondHalf = computed(() => data.value.slice(mid.value))
</script>
