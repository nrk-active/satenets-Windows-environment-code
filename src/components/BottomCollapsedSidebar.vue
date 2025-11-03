<template>
  <div class="collapsed-sidebar bottom-sidebar" @click="$emit('reopen')">
    <div class="arrow-icon">
      <span>▲</span>
    </div>
    <div class="sidebar-text">业务列表</div>
  </div>
</template>

<script setup>
const emit = defineEmits(['reopen']);
</script>

<style scoped>
.collapsed-sidebar {
  height: 24px;
  width: 100%;
  background: var(--theme-secondary-bg);
  border-top: 1px solid var(--theme-border);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.collapsed-sidebar:hover {
  background: var(--theme-main-bg);
}

.bottom-sidebar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1001;
}

.arrow-icon {
  margin-right: 8px;
  font-size: 12px;
  color: var(--theme-border);
  transition: color 0.3s ease;
}

.collapsed-sidebar:hover .arrow-icon {
  color: var(--theme-main-text);
}

.sidebar-text {
  font-size: 12px;
  color: var(--theme-border);
  transition: color 0.3s ease;
  white-space: nowrap;
}

.collapsed-sidebar:hover .sidebar-text {
  color: var(--theme-main-text);
}
</style>
