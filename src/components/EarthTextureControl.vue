<template>
  <div class="tooltip-container">
    <button 
      class="earth-icon"
      :class="{ active: currentTextureIndex !== 0 }"
      @click="toggleEarthTexture"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M2 12h20" stroke="currentColor" stroke-width="1" opacity="1"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="1" opacity="1"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="1"/>
      </svg>
    </button>
    <div 
      v-if="tooltipVisible"
      class="tooltip"
      :class="tooltipPosition"
    >
      {{ getTooltipText() }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// 定义props和emits
const emit = defineEmits(['toggle-earth-texture']);

// 地球纹理状态
const currentTextureIndex = ref(0);
const textures = [
  { name: 'earth.jpg', path: '/texture/earth.jpg' },
  { name: 'earth1.jpg', path: '/texture/earth1.jpg' }
];

// 工具提示状态
const tooltipVisible = ref(false);
const tooltipPosition = ref('');
let tooltipTimeout = null;

// 切换地球纹理
function toggleEarthTexture() {
  // 切换到下一个纹理
  currentTextureIndex.value = (currentTextureIndex.value + 1) % textures.length;
  const currentTexture = textures[currentTextureIndex.value];
  emit('toggle-earth-texture', currentTexture.path);
}

// 设置地球纹理状态
function setEarthTextureState(texturePath) {
  const index = textures.findIndex(t => t.path === texturePath);
  if (index !== -1) {
    currentTextureIndex.value = index;
  }
}

// 获取工具提示文本
function getTooltipText() {
  return currentTextureIndex.value === 0 ? '切换到地球纹理2' : '切换到地球纹理1';
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
  setEarthTextureState
});
</script>

<style scoped>
/* 容器样式 */
.tooltip-container {
  position: fixed;
  bottom: 20px;
  left: 230px; /* 位于星空按钮右侧 */
  z-index: 10000000;
}

/* 地球图标按钮样式 */
.earth-icon {
  width: 35px;
  height: 35px;
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

.earth-icon svg {
  transition: all 0.3s ease;
}

/* 悬停样式 - 保持一致，填充强调色 */
.earth-icon:hover {
  background: var(--theme-accent);
  color: #fff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px var(--theme-shadow);
  border-color: var(--theme-accent);
}

/* 激活状态样式 - 当 currentTextureIndex != 0 时，显示强调色 */
.earth-icon.active {
  background: var(--theme-accent);
  border-color: var(--theme-accent);
  color: #fff;
  box-shadow: 0 4px 16px var(--theme-shadow);
  animation: earthGlow 2s infinite alternate;
}

.earth-icon.active svg {
  transform: rotate(15deg);
}

@keyframes earthGlow {
  from {
    box-shadow: 0 4px 16px rgba(34, 139, 34, 0.5);
  }
  to {
    box-shadow: 0 4px 24px rgba(34, 139, 34, 0.8);
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