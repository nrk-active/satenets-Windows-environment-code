<template>
  <div class="tooltip-container">
    <button 
      class="sun-icon"
      :class="{ active: lightingEnabled }"
      @click="toggleLighting"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ lightingEnabled ? '关闭光照' : '开启光照' }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-lighting']);

// 光照状态
const lightingEnabled = ref(true);

// 工具提示状态
const tooltipVisible = ref(false);
const tooltipPosition = ref('');
let tooltipTimeout = null;

// 切换光照状态
function toggleLighting() {
  lightingEnabled.value = !lightingEnabled.value;
  emit('toggle-lighting', lightingEnabled.value);
}

// 设置光照状态
function setLightingState(enabled) {
  lightingEnabled.value = enabled;
}

// 显示工具提示（添加延迟）
function showTooltip() {
  tooltipTimeout = setTimeout(() => {
    tooltipVisible.value = true;
    // 根据窗口位置设置工具提示位置
    tooltipPosition.value = 'top';
  }, 50); // 200毫秒延迟 - 更灵敏的显示
}

// 隐藏工具提示
function hideTooltip() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  tooltipVisible.value = false;
}

// 暴露方法给父组件
defineExpose({
  setLightingState
});
</script>

<style scoped>
/* 容器样式 */
.tooltip-container {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
}

/* 太阳图标按钮样式 */
.sun-icon {
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
  color: #fff;
  outline: none;
  padding: 0;
  overflow: hidden;
  position: relative;
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

/* 自定义工具提示样式 */
.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  margin-bottom: 8px;
  z-index: 1001;
  opacity: 0;
  transform-origin: center bottom;
  animation: tooltipFadeIn 0.3s ease-out forwards;
}

/* 工具提示的箭头 */
.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

/* 工具提示淡入动画 */
@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>