<template>
  <div class="tooltip-container">
    <button 
      class="sun-icon"
      :class="{'active': isDarkTheme}"
      @click="toggleLighting"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <template v-if="isDarkTheme">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </template>
      </svg>
    </button>
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ isDarkTheme ? '切换至浅色模式' : '切换至深色模式' }}
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue';

const isDarkTheme = inject('isDarkTheme', ref(true));
const toggleThemeFunc = inject('toggleTheme', () => {});

const emit = defineEmits(['toggle-lighting']);

const tooltipVisible = ref(false);
const tooltipPosition = ref('top'); // 默认顶部显示
let tooltipTimeout = null;

function toggleLighting() {
  toggleThemeFunc();
  emit('toggle-lighting', !isDarkTheme.value); 
}

function showTooltip() {
  tooltipTimeout = setTimeout(() => {
    tooltipVisible.value = true;
  }, 50);
}

function hideTooltip() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  tooltipVisible.value = false;
}

// 暴露方法给父组件
defineExpose({});
</script>

<style scoped>
/* 容器样式：必须是 static，让父容器 (bottom-controls-group) 控制定位 */
.tooltip-container {
  position: static;
  z-index: 1000;
}

/* 太阳/月亮图标按钮样式 */
.sun-icon {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  background: var(--bg-tertiary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--color-shadow);
  color: var(--color-text);
  outline: none;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.sun-icon:hover {
  background: var(--bg-secondary);
  transform: scale(1.1);
  box-shadow: 0 4px 12px var(--color-shadow);
  border-color: var(--color-text);
}

.sun-icon.active {
  /* 深色主题时 (isDarkTheme=true, 显示月亮) */
  background: var(--bg-secondary);
  border-color: var(--color-text);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5);
  animation: sunGlow 2s infinite alternate;
}

.sun-icon:not(.active) {
  /* 浅色主题时 (isDarkTheme=false, 显示太阳) */
  background: var(--bg-secondary);
  border-color: var(--color-highlight); /* 使用高亮色边框 */
  box-shadow: 0 4px 16px var(--color-highlight);
  animation: lightGlow 2s infinite alternate;
}

@keyframes sunGlow {
  from { box-shadow: 0 4px 16px rgba(255, 255, 255, 0.5); }
  to { box-shadow: 0 4px 24px rgba(255, 255, 255, 0.8); }
}

@keyframes lightGlow {
  from { box-shadow: 0 4px 16px var(--color-highlight); }
  to { box-shadow: 0 4px 24px var(--color-highlight); }
}

/* 自定义工具提示样式 (使用主题变量) */
.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--tooltip-bg);
  color: var(--color-text);
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
  border-color: var(--tooltip-bg) transparent transparent transparent;
}

/* 工具提示淡入动画 */
@keyframes tooltipFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>