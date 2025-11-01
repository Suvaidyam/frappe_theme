<template>
  <div class="loader-overlay" role="status" aria-live="polite" aria-busy="true">
    <div class="loader-spinner" :style="spinnerStyle" aria-hidden="true"></div>
    <span class="sr-only">Loading…</span>
  </div>
</template>

<script>
export default {
  name: 'Loader',
  computed: {
    spinnerStyle() {
      const themeColor = (window.frappe && frappe.boot && frappe.boot.my_theme && frappe.boot.my_theme.button_background_color) || 'black';
      return {
        borderTopColor: themeColor
      };
    }
  }
};
</script>

<style scoped>
.loader-overlay{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:300px;
  width:100%;
  background:#fff;
  z-index:1;
}
.loader-spinner{
  width:30px;
  height:30px;
  border:2.5px solid #f3f3f3;
  border-top:2.5px solid black; /* overridden via inline style */
  border-radius:50%;
  animation: spin 1s linear infinite;
}
.sr-only{
  position:absolute;
  width:1px;
  height:1px;
  padding:0;
  margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0;
}
@keyframes spin{
  0%{transform:rotate(0deg)}
  100%{transform:rotate(360deg)}
}
</style>
