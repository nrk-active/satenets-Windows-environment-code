<template>
  <div class="collapsed-sidebar right-sidebar" @click="$emit('reopen')">
    <div class="arrow-icon">
      <span>◄</span>
    </div>
    <div class="sidebar-text">信息面板</div>
  </div>
</template>

<script setup>
const emit = defineEmits(['reopen']);
</script>

<style scoped>
.collapsed-sidebar {
  width: 24px;
  height: 100%;
  background: var(--theme-secondary-bg); /* 使用次级背景 */
  border-left: 1px solid var(--theme-border); /* 使用边框色 */
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.collapsed-sidebar:hover {
  background: var(--theme-main-bg);
  width: 32px;
}

.arrow-icon {
  padding: 8px 0;
  color: var(--theme-main-text);
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  color: var(--theme-border);
  font-size: 12px;
  margin-top: 16px;
  user-select: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.collapsed-sidebar:hover .sidebar-text {
  opacity: 1;
}
</style> 