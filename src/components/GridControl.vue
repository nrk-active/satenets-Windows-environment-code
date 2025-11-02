<template>
  <div class="tooltip-container">
    <button 
      class="grid-icon"
      :class="{ active: gridEnabled }"
      @click="toggleGrid"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <!-- 地球圆形轮廓 -->
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
        <!-- 经线 - 增加更多可见的竖直线 -->
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
        <path d="M 6 2 Q 6 12 6 22" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.7"/>
        <path d="M 18 2 Q 18 12 18 22" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.7"/>
        <!-- 纬线 -->
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
        <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>
        <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>
      </svg>
    </button>
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ gridEnabled ? '关闭经纬线网格' : '开启经纬线网格' }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-grid']);

// 经纬线网格状态
const gridEnabled = ref(true);

// 工具提示状态
const tooltipVisible = ref(false);
const tooltipPosition = ref('');
let tooltipTimeout = null;

// 切换经纬线网格状态
function toggleGrid() {
  gridEnabled.value = !gridEnabled.value;
  emit('toggle-grid', gridEnabled.value);
}

// 设置经纬线网格状态
function setGridState(enabled) {
  gridEnabled.value = enabled;
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
  setGridState
});
</script>

<style scoped>
/* 容器样式 */
.tooltip-container {
  position: fixed;
  bottom: 20px;
  left: 120px; /* 位置在国界线按钮右侧 */
  z-index: 1000;
}

/* 网格图标按钮样式 */
.grid-icon {
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

.grid-icon svg {
  transition: all 0.3s ease;
}

.grid-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
}

.grid-icon.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5);
  animation: gridGlow 2s infinite alternate;
}

.grid-icon.active svg {
  transform: rotate(15deg);
}

@keyframes gridGlow {
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