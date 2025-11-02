<template>
  <div class="collapsed-sidebar left-sidebar" @click="$emit('reopen')">
    <div class="arrow-icon">
      <span>►</span>
    </div>
    <div class="sidebar-text">对象列表</div>
  </div>
</template>

<script setup>
const emit = defineEmits(['reopen']);
</script>

<style scoped>
.collapsed-sidebar {
  width: 24px;
  height: 100%;
  background: #181818;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.collapsed-sidebar:hover {
  background: #2a2a2a;
  width: 32px;
}

.arrow-icon {
  padding: 8px 0;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  color: #aaa;
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