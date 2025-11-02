<template>
  <div style="display: none;"></div>
</template>

<script setup>
const emit = defineEmits(['reopen']);
</script>

<style scoped>
/* 移除所有样式 */
.collapsed-sidebar {
  display: none !important;
}
</style>