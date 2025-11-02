<template>
  <div class="tooltip-container">
    <button 
      class="border-icon"
      :class="{ active: borderEnabled }"
      @click="toggleBorder"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <!-- 地图轮廓图标 -->
        <path d="M3 3L21 3L21 21L3 21L3 3Z" stroke="currentColor" stroke-width="2" fill-opacity="0.1"/>
        <path d="M7 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M11 7L11 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M15 7L15 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M19 7L19 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 7L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 11L19 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 15L19 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 19L19 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ borderEnabled ? '隐藏国界线' : '显示国界线' }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-border']);

// 国界线状态
const borderEnabled = ref(true);

// 工具提示状态
const tooltipVisible = ref(false);
const tooltipPosition = ref('');
let tooltipTimeout = null;

// 切换国界线状态
function toggleBorder() {
  borderEnabled.value = !borderEnabled.value;
  emit('toggle-border', borderEnabled.value);
}

// 设置国界线状态
function setBorderState(enabled) {
  borderEnabled.value = enabled;
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
  setBorderState
});
</script>

<style scoped>
/* 容器样式 */
.tooltip-container {
  position: fixed;
  bottom: 20px;
  left: 70px;
  z-index: 1000;
}

/* 国界线图标按钮样式 */
.border-icon {
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

.border-icon svg {
  transition: all 0.3s ease;
}

.border-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
}

.border-icon.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5);
  animation: borderGlow 2s infinite alternate;
}

.border-icon.active svg {
  transform: rotate(15deg);
}

@keyframes borderGlow {
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