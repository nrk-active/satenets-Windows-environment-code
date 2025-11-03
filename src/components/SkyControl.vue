<template>
  <div class="tooltip-container">
    <button 
      class="sky-icon"
      :class="{ active: skyEnabled }"
      @click="toggleSky"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <circle cx="5" cy="5" r="1" fill="currentColor"/>
        <circle cx="19" cy="5" r="1" fill="currentColor"/>
        <circle cx="5" cy="19" r="1" fill="currentColor"/>
        <circle cx="19" cy="19" r="1" fill="currentColor"/>
      </svg>
    </button>
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ skyEnabled ? '关闭星空' : '开启星空' }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-sky']);

// 星空状态
const skyEnabled = ref(true);

// 工具提示状态
const tooltipVisible = ref(false);
const tooltipPosition = ref('');
let tooltipTimeout = null;

// 切换星空状态
function toggleSky() {
  skyEnabled.value = !skyEnabled.value;
  emit('toggle-sky', skyEnabled.value);
}

// 设置星空状态
function setSkyState(enabled) {
  skyEnabled.value = enabled;
}

// 显示工具提示（添加延迟）
function showTooltip() {
  tooltipTimeout = setTimeout(() => {
    tooltipVisible.value = true;
    // 根据窗口位置设置工具提示位置
    tooltipPosition.value = 'top';
  }, 50); // 50毫秒延迟 - 更灵敏的显示
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
  setSkyState
});
</script>

<style scoped>
/* 容器样式 */
.tooltip-container {
  position: fixed;
  bottom: 20px;
  left: 170px; /* 调整位置，使四个按钮均匀排列 */
  z-index: 1000;
}

/* 星空图标按钮样式 */
.sky-icon {
  width: 40px;
  height: 40px;
  border: 1px solid var(--theme-border);
  background: var(--theme-dialog-bg);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--theme-shadow);
  color: var(--theme-main-text);
  outline: none;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.sky-icon svg {
  transition: all 0.3s ease;
}

.sky-icon:hover {
  background: var(--theme-accent);
  color: #fff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px var(--theme-shadow);
  border-color: var(--theme-accent);
}

.sky-icon.active {
  background: var(--theme-accent);
  border-color: var(--theme-accent);
  color: #fff;
  box-shadow: 0 4px 16px var(--theme-shadow);
  animation: skyGlow 2s infinite alternate;
}

.sky-icon.active svg {
  transform: rotate(15deg);
}

@keyframes skyGlow {
  from {
    box-shadow: 0 4px 16px rgba(100, 149, 237, 0.5);
  }
  to {
    box-shadow: 0 4px 24px rgba(100, 149, 237, 0.8);
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