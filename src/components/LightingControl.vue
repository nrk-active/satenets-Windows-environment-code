<template>
  <button 
    class="sun-icon"
    :class="{ active: lightingEnabled }"
    @click="toggleLighting"
    :title="lightingEnabled ? '关闭光照' : '开启光照'"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-lighting']);

// 光照状态
const lightingEnabled = ref(true);

// 切换光照状态
function toggleLighting() {
  lightingEnabled.value = !lightingEnabled.value;
  emit('toggle-lighting', lightingEnabled.value);
}

// 设置光照状态
function setLightingState(enabled) {
  lightingEnabled.value = enabled;
}

// 暴露方法给父组件
defineExpose({
  setLightingState
});
</script>

<style scoped>
/* 太阳图标按钮样式 */
.sun-icon {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  color: #fff;
  outline: none;
  padding: 0;
  overflow: hidden;
}

.sun-icon svg {
  transition: all 0.3s ease;
}

.sun-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
}

.sun-icon.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5);
  animation: sunGlow 2s infinite alternate;
}

.sun-icon.active svg {
  transform: rotate(15deg);
}

@keyframes sunGlow {
  from {
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5);
  }
  to {
    box-shadow: 0 4px 24px rgba(255, 255, 255, 0.8);
  }
}
</style>