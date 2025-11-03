<template>
  <div class="simulation-control-container">
    <!-- 速度显示 -->
    <div class="speed-display">
      <span class="speed-label">速度</span>
      <span class="speed-value">{{ currentSpeed }}x</span>
    </div>
    
    <!-- 控制按钮组 -->
    <div class="control-buttons">
      <!-- 开始仿真按钮 -->
      <div class="tooltip-wrapper">
        <button 
          class="control-btn start-btn"
          :class="{ active: isSimulating, disabled: isDisabled }"
          @click="handleStart"
          @mouseenter="showTooltip('start')"
          @mouseleave="hideTooltip"
          :disabled="isDisabled"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <div v-if="tooltipVisible === 'start'" class="tooltip">
          {{ getStartButtonText() }}
        </div>
      </div>

      <!-- 暂停仿真按钮 -->
      <div class="tooltip-wrapper">
        <button 
          class="control-btn pause-btn"
          :class="{ active: isPaused }"
          @click="handlePause"
          @mouseenter="showTooltip('pause')"
          @mouseleave="hideTooltip"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        </button>
        <div v-if="tooltipVisible === 'pause'" class="tooltip">
          暂停仿真
        </div>
      </div>

      <!-- 加速按钮 -->
      <div class="tooltip-wrapper">
        <button 
          class="control-btn speed-up-btn"
          @click="handleSpeedUp"
          @mouseenter="showTooltip('speedup')"
          @mouseleave="hideTooltip"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
          </svg>
        </button>
        <div v-if="tooltipVisible === 'speedup'" class="tooltip">
          加速
        </div>
      </div>

      <!-- 减速按钮 -->
      <div class="tooltip-wrapper">
        <button 
          class="control-btn speed-down-btn"
          @click="handleSpeedDown"
          @mouseenter="showTooltip('speeddown')"
          @mouseleave="hideTooltip"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
          </svg>
        </button>
        <div v-if="tooltipVisible === 'speeddown'" class="tooltip">
          减速
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

// 定义 props
const props = defineProps({
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  isSimulating: {
    type: Boolean,
    default: false
  },
  isLocalSimulationRunning: {
    type: Boolean,
    default: false
  },
  currentSpeed: {
    type: Number,
    default: 1
  }
});

// 定义 emits
const emit = defineEmits([
  'start-simulation',
  'pause-simulation',
  'increase-speed',
  'decrease-speed'
]);

// 本地状态
const isPaused = ref(false);
const tooltipVisible = ref(null);
let tooltipTimeout = null;

// 计算是否禁用
const isDisabled = computed(() => {
  if (props.isLoggedIn) {
    return props.isSimulating;
  } else {
    return props.isLocalSimulationRunning;
  }
});

// 获取开始按钮文本
function getStartButtonText() {
  if (props.isLoggedIn) {
    return props.isSimulating ? '运行中...' : '开始仿真';
  } else {
    return props.isLocalSimulationRunning ? '运行中...' : '开始仿真';
  }
}

// 处理开始仿真
function handleStart() {
  if (isDisabled.value) return;
  emit('start-simulation');
}

// 处理暂停仿真
function handlePause() {
  isPaused.value = !isPaused.value;
  emit('pause-simulation');
}

// 处理加速
function handleSpeedUp() {
  emit('increase-speed');
}

// 处理减速
function handleSpeedDown() {
  emit('decrease-speed');
}

// 显示工具提示
function showTooltip(type) {
  tooltipTimeout = setTimeout(() => {
    tooltipVisible.value = type;
  }, 50);
}

// 隐藏工具提示
function hideTooltip() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  tooltipVisible.value = null;
}
</script>

<style scoped>
/* 容器样式 - 参考 GridControl */
.simulation-control-container {
  position: fixed;
  bottom: 20px;
  right: 30px;
  z-index: 10000000;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 速度显示 */
.speed-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1px 2px;
  background: var(--theme-dialog-bg);
  border: 1px solid var(--theme-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px var(--theme-shadow);
  min-width: 60px;
}

.speed-label {
  font-size: 11px;
  color: var(--theme-main-text);
  opacity: 0.7;
  margin-bottom: 2px;
}

.speed-value {
  font-size: 16px;
  font-weight: bold;
  color: var(--theme-accent);
  font-family: monospace;
}

/* 控制按钮组 */
.control-buttons {
  display: flex;
  gap: 6px;
  background: var(--theme-dialog-bg);
  border: 1px solid var(--theme-border);
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 8px var(--theme-shadow);
}

/* 工具提示包装器 */
.tooltip-wrapper {
  position: relative;
}

/* 通用按钮样式 - 参考 GridControl */
.control-btn {
  width: 30px;
  height: 30px;
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
  position: relative;
}

.control-btn svg {
  transition: all 0.3s ease;
}

.control-btn:hover:not(.disabled) {
  transform: scale(1.1);
  box-shadow: 0 4px 12px var(--theme-shadow);
}

/* 开始按钮样式 */
.start-btn {
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2));
  border-color: #00ff88;
}

.start-btn:hover:not(.disabled) {
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.3), rgba(0, 212, 255, 0.3));
  color: #00ff88;
  border-color: #00ff88;
}

.start-btn.active {
  background: #00ff88;
  border-color: #00e077;
  color: #101010;
  animation: startGlow 2s infinite alternate;
}

.start-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes startGlow {
  from {
    box-shadow: 0 4px 16px rgba(0, 255, 136, 0.5);
  }
  to {
    box-shadow: 0 4px 24px rgba(0, 255, 136, 0.8);
  }
}

/* 暂停按钮样式 */
.pause-btn {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(255, 100, 100, 0.2));
  border-color: #e74c3c;
}

.pause-btn:hover {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.3), rgba(255, 100, 100, 0.3));
  color: #e74c3c;
  border-color: #e74c3c;
}

.pause-btn.active {
  background: #e74c3c;
  border-color: #c0392b;
  color: #fff;
  animation: pauseGlow 2s infinite alternate;
}

@keyframes pauseGlow {
  from {
    box-shadow: 0 4px 16px rgba(231, 76, 60, 0.5);
  }
  to {
    box-shadow: 0 4px 24px rgba(231, 76, 60, 0.8);
  }
}

/* 加速按钮样式 */
.speed-up-btn {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.2));
  border-color: #3498db;
}

.speed-up-btn:hover {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.3), rgba(41, 128, 185, 0.3));
  color: #3498db;
  border-color: #3498db;
}

/* 减速按钮样式 */
.speed-down-btn {
  background: linear-gradient(135deg, rgba(52, 73, 94, 0.2), rgba(44, 62, 80, 0.2));
  border-color: #34495e;
}

.speed-down-btn:hover {
  background: linear-gradient(135deg, rgba(52, 73, 94, 0.3), rgba(44, 62, 80, 0.3));
  color: #95a5a6;
  border-color: #95a5a6;
}

/* 工具提示样式 - 参考 GridControl */
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
  pointer-events: none;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .simulation-control-container {
    bottom: 15px;
    right: 15px;
    gap: 8px;
  }
  
  .control-btn {
    width: 36px;
    height: 36px;
  }
  
  .control-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .speed-display {
    padding: 6px 10px;
    min-width: 50px;
  }
  
  .speed-value {
    font-size: 10px;
  }
}
</style>
