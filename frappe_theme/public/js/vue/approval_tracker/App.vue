<template>
  <div class="d-flex gap-3 overflow-auto">
    <!-- Single table on small screens -->
    <div class="d-block d-md-none w-100" style="max-height: 550px; overflow: auto;">
      <table class="table border " style="min-width: 200px;">
        <thead class="table-light">
          <tr>
            <th>State</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data" :key="item.state" class="border mb-2">
            <td :class="`text-${item.style?.toLowerCase()}`">{{ item.state }}</td>
            <td :class="`text-${item.style?.toLowerCase()} fw-semibold`">{{ item.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Split tables on medium and larger screens -->
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
            <tr v-for="item in half" :key="item.state" class="border mb-2">
              <td :class="`text-${item.style?.toLowerCase()}`">{{ item.state }}</td>
              <td :class="`text-${item.style?.toLowerCase()} fw-semibold`">{{ item.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

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
