<template>
  <div class="node-jump-container" :style="containerStyle">
    <div class="jump-input-group">
      <label class="jump-label">跳转到节点:</label>
      <input 
        v-model="nodeInput"
        type="text"
        class="node-input"
        placeholder="输入节点ID"
        @keyup.enter="jumpToNode"
        @input="filterNodes"
      />
      <button 
        class="jump-button"
        @click="jumpToNode"
        :disabled="!nodeInput.trim()"
      >
        跳转
      </button>
    </div>
    
    <div class="jump-input-group time-jump">
      <label class="jump-label">跳转到时间:</label>
      <input 
        v-model="timeInput"
        type="text"
        class="time-input"
        placeholder="HH:MM:SS"
        @keyup.enter="jumpToTime"
        @input="validateTimeInput"
        maxlength="8"
      />
      <button 
        class="jump-button"
        @click="jumpToTime"
        :disabled="!isValidTimeInput"
      >
        跳转
      </button>
    </div>
    
    <div v-if="showSuggestions && filteredNodes.length > 0" class="suggestions-dropdown">
      <div 
        v-for="node in filteredNodes.slice(0, 10)" 
        :key="node.id"
        class="suggestion-item"
        @click="selectNode(node)"
      >
        <span class="node-id">{{ node.id }}</span>
        <span class="node-type">{{ getNodeTypeLabel(node.type) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted } from 'vue';
import * as Cesium from 'cesium';
import { useDataLoader } from '../composables/useDataLoader.js';
import { parseFolderName } from '../utils/folderParser.js';

const props = defineProps({
  networkData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  }
});

const emit = defineEmits(['node-selected', 'time-changed']);

// 注入Cesium viewer
const cesiumViewer = inject('cesiumViewer', null);

// 获取数据文件夹信息
const { getCurrentDataFolder } = useDataLoader();

const nodeInput = ref('');
const timeInput = ref('');
const showSuggestions = ref(false);

// 过滤后的节点列表
const filteredNodes = computed(() => {
  if (!nodeInput.value.trim() || !props.networkData?.nodes) {
    return [];
  }
  const searchTerm = nodeInput.value.toLowerCase();
  return props.networkData.nodes.filter(node => 
    node.id.toLowerCase().includes(searchTerm)
  );
});

// 显示错误反馈
function showErrorFeedback(inputSelector) {
  const inputEl = document.querySelector(inputSelector);
  if (inputEl) {
    inputEl.classList.add('error-shake');
    setTimeout(() => {
      inputEl.classList.remove('error-shake');
    }, 500);
  }
}

// 验证时间输入格式
const isValidTimeInput = computed(() => {
  if (!timeInput.value) return false;
  
  // 支持多种格式：HH:MM:SS, MM:SS, SS
  const timePattern = /^(?:(\d{1,2}):)?(?:(\d{1,2}):)?(\d{1,2})$/;
  const match = timeInput.value.match(timePattern);
  
  if (!match) return false;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60;
});

// 获取节点类型标签
function getNodeTypeLabel(type) {
  const typeLabels = {
    'satellite': '卫星',
    'station': '地面站',
    'roadm': 'ROADM'
  };
  return typeLabels[type] || type;
}

// 验证时间输入
function validateTimeInput(event) {
  let value = event.target.value;
  
  // 自动添加冒号
  if (value.length === 2 && !value.includes(':')) {
    value += ':';
  } else if (value.length === 5 && value.split(':').length === 2) {
    value += ':';
  }
  
  // 限制字符为数字和冒号
  value = value.replace(/[^\d:]/g, '');
  
  timeInput.value = value;
}

// 解析时间输入为总秒数
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(part => parseInt(part) || 0);
  
  if (parts.length === 1) {
    // 只有秒数
    return parts[0];
  } else if (parts.length === 2) {
    // 分钟:秒数
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // 小时:分钟:秒数
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

// 跳转到指定时间
function jumpToTime() {
  if (!isValidTimeInput.value) {
    showErrorFeedback('.time-input');
    return;
  }
  
  const totalSeconds = parseTimeToSeconds(timeInput.value);
  let currentFolder = getCurrentDataFolder();
  
  if (!currentFolder) {
    currentFolder = localStorage.getItem('selectedDataFolder');
  }
  
  if (!currentFolder) {
    const hasData = props.networkData?.nodes?.length > 0;
    if (hasData) {
      const nodeCount = props.networkData.nodes.length;
      if (nodeCount > 5000) {
        currentFolder = 'new_10s_3600s';
      } else {
        currentFolder = 'old_60s_360s';
      }
    } else {
      currentFolder = 'old_60s_360s'; 
    }
  }
  
  // 根据文件夹类型计算时间间隔和帧数
  const config = parseFolderName(currentFolder);
  const timeInterval = config.interval;
  const totalDuration = config.totalDuration;
  const maxFrames = Math.ceil(config.totalDuration / config.interval);
  
  // 检查输入时间是否超出文件夹总时长
  if (totalSeconds > totalDuration) {
    const maxHours = Math.floor(totalDuration / 3600);
    const maxMinutes = Math.floor((totalDuration % 3600) / 60);
    const maxSecs = totalDuration % 60;
    const maxTimeStr = `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}:${maxSecs.toString().padStart(2, '0')}`;
    
    alert(`输入的时间超出范围！\n当前文件夹 "${currentFolder}" 的最大时长为: ${maxTimeStr}\n请输入不超过此时长的时间。`);
    showErrorFeedback('.time-input');
    return;
  }
  
  // 计算目标帧数
  let targetFrame;
  if (totalSeconds === 0) {
    targetFrame = 1; // 0秒对应帧1
  } else {
    targetFrame = Math.round(totalSeconds / timeInterval);
    targetFrame = Math.max(1, targetFrame);
  }
  
  // 确保不超过最大帧数
  const clampedFrame = Math.max(1, Math.min(maxFrames, targetFrame));
  
  try {
    
    // 发射时间变化事件 - 确保传递数字类型的帧数
    emit('time-changed', Number(clampedFrame));
    
    // 通过全局事件触发时间轴跳转
    const frameChangeEvent = new CustomEvent('timeline-frame-change', {
      detail: { frame: Number(clampedFrame), forceUpdate: true }
    });
    window.dispatchEvent(frameChangeEvent);
    
  } catch (error) {
    showErrorFeedback('.time-input');
  }
  
  // 计算实际跳转后的时间并更新输入框显示
  const actualSeconds = clampedFrame * timeInterval;
  const actualHours = Math.floor(actualSeconds / 3600);
  const actualMinutes = Math.floor((actualSeconds % 3600) / 60);
  const actualSecsRemainder = actualSeconds % 60;
  const actualTimeStr = `${actualHours.toString().padStart(2, '0')}:${actualMinutes.toString().padStart(2, '0')}:${actualSecsRemainder.toString().padStart(2, '0')}`;
  
  setTimeout(() => {
    timeInput.value = actualTimeStr;
  }, 500);
}

// 过滤节点并显示建议
function filterNodes() {
  showSuggestions.value = nodeInput.value.trim().length > 0 && filteredNodes.value.length > 0;
}

// 选择建议的节点
function selectNode(node) {
  nodeInput.value = node.id;
  showSuggestions.value = false;
  jumpToNode();
}

// 跳转到指定节点
function jumpToNode() {
  try {
    if (!nodeInput.value.trim() || !props.networkData?.nodes) {
      showErrorFeedback('.node-input');
      return;
    }
    
    const searchId = nodeInput.value.toLowerCase().trim();
    let targetNode = props.networkData.nodes.find(node => String(node.id).toLowerCase() === searchId);
    
    if (!targetNode) {
      targetNode = props.networkData.nodes.find(node => String(node.id).toLowerCase().includes(searchId));
    }
  
    if (!targetNode) {
      showErrorFeedback('.node-input');
      return;
    }
    
    nodeInput.value = targetNode.id;
    
    let targetPosition;
    if (targetNode.type === 'satellite') {
      targetPosition = new Cesium.Cartesian3(
        parseFloat(targetNode.position[0]) * 1000,
        parseFloat(targetNode.position[1]) * 1000,
        parseFloat(targetNode.position[2]) * 1000
      );
    } else {
      targetPosition = Cesium.Cartesian3.fromDegrees(
        parseFloat(targetNode.position[0]),
        parseFloat(targetNode.position[1]),
        targetNode.type === 'station' ? 100000 : 50000 
      );
    }
    
    if (cesiumViewer && cesiumViewer()) {
      const viewer = cesiumViewer();
      
      viewer.camera.flyTo({
        destination: targetPosition,
        duration: 2.0, 
        complete: () => {
          emit('node-selected', String(targetNode.id));
        }
      });
    } else {
      showErrorFeedback('.node-input');
    }
    
    showSuggestions.value = false;
  } catch (error) {
    showErrorFeedback('.node-input');
  }
}

// 点击外部隐藏建议列表
function handleClickOutside(event) {
  if (!event.target.closest('.node-jump-container')) {
    showSuggestions.value = false;
  }
}

// 监听网络数据变化，清空输入
watch(() => props.networkData, () => {
  nodeInput.value = '';
  timeInput.value = '';
  showSuggestions.value = false;
});

// 动态调整位置
const containerStyle = ref({});

// 动态调整输入框位置 - 修正回落逻辑
function adjustPosition() {
  try {
    const objectViewer = document.querySelector('.object-viewer');
    const viewportWidth = window.innerWidth;
    
    let position = {
      bottom: '20px', // 默认回落位置
      left: '10px',
      width: '320px'
    };
    
    // 移动端适配
    if (viewportWidth <= 768) {
      position.width = '280px';
      position.bottom = '120px';
      containerStyle.value = position;
      return;
    }
    
    // 1. 计算左侧偏移量 (NodeJumpInput 不应被左侧抽屉遮挡)
    let leftOffset = 10; // 默认距离左边10px
    
    if (objectViewer) {
      const rect = objectViewer.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && 
                       objectViewer.classList.contains('drawer-open'); // 仅在抽屉打开时计算偏移
      
      if (isVisible && rect.width > 50) {
        leftOffset = rect.right + 10;
      }
    }
    
    position.left = `${leftOffset}px`;
    
    // 2. 计算底部偏移量 (根据底部 ServicePanel 的状态回落)
    const servicePanel = document.querySelector('.service-panel');
    
    // 默认回落到距离底部 70px (NodeJumpInput 的底部位置)
    let maxBottomHeight = 75; // 👈 修复 1: 提升最小回落高度 (60px 清除底部图标组)

    if (servicePanel) {
                const rect = servicePanel.getBoundingClientRect();
                const isDrawerOpen = servicePanel.classList.contains('drawer-open');
                
                if (isDrawerOpen && rect.height > 50) {
                    // ServicePanel 打开时，时间轴移动到 ServicePanel 顶部之上 5px 处
                    maxBottomHeight = rect.height + 5; 
                }
            }
    
    // NodeJumpInput 的底部位置应该是：Max(默认回落位置, 底部抽屉打开时的位置)
    position.bottom = `${maxBottomHeight}px`;
    
    // 3. 应用样式并分发事件
    containerStyle.value = position;
    
    // 分发UI位置变化事件 (供其他组件，如时间轴，参考)
    window.dispatchEvent(new CustomEvent('ui-positions-changed', {
      detail: {
        source: 'nodeJump',
        bottomHeight: maxBottomHeight
      }
    }));
  } catch (error) {
    containerStyle.value = {
      bottom: '20px', // 默认回落位置
      left: '10px',
      width: '320px'
    };
  }
}

onMounted(() => {
  // 添加事件监听
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', adjustPosition);
  
  // 监听底部面板状态变化事件，确保 NodeJumpInput 立即响应
  const handlePanelStateChange = (event) => {
    if (event.detail.type === 'bottom-panel') {
      setTimeout(adjustPosition, 100); // 短暂延迟确保 ServicePanel 动画开始
    }
  };
  window.addEventListener('panel-state-changed', handlePanelStateChange);

  // 初始位置调整
  setTimeout(adjustPosition, 300);
  
  // 定期检查位置 - 与仿真时间轴保持相同间隔
  const interval = setInterval(adjustPosition, 2000);
  
  // 清理函数
  window.nodeJumpCleanup = () => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', adjustPosition);
    window.removeEventListener('panel-state-changed', handlePanelStateChange);
    clearInterval(interval);
  };
});

onUnmounted(() => {
  if (window.nodeJumpCleanup) {
    window.nodeJumpCleanup();
    delete window.nodeJumpCleanup;
  }
});
</script>

<style scoped>
.node-jump-container {
  position: fixed;
  z-index: 999; 
  background: var(--bg-primary); 
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--color-shadow);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: bottom 0.3s ease-out, left 0.3s ease-out; /* 添加平滑过渡 */
}

.jump-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jump-label {
  color: var(--color-text);
  font-size: 13px;
  flex-shrink: 0;
  width: 80px;
}

.node-input,
.time-input {
  flex-grow: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--color-text);
  font-size: 13px;
  transition: border-color 0.2s;
}

.node-input:focus,
.time-input:focus {
  border-color: var(--color-highlight);
  outline: none;
}

.jump-button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.jump-button:hover:not(:disabled) {
  background: var(--color-highlight-dark);
}

.jump-button:disabled {
  background: var(--bg-tertiary);
  color: var(--color-text-dim);
  cursor: not-allowed;
}

/* 节点建议下拉列表 */
.suggestions-dropdown {
  position: absolute;
  bottom: 100%; /* 定位在输入框下方 */
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--bg-primary);
  border: 1px solid var(--color-border);
  border-top: none;
  max-height: 200px;
  overflow-y: auto;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 12px var(--color-shadow);
}

.suggestion-item {
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  transition: background 0.2s;
  font-size: 13px;
  color: var(--color-text);
}

.suggestion-item:hover {
  background: var(--bg-secondary);
}

.node-type {
  color: var(--color-text-dim);
  font-size: 12px;
}

/* 错误反馈动画 */
.error-shake {
  animation: shake 0.5s;
  border-color: #e74c3c !important;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  20%, 60% {
    transform: translateX(-5px);
  }
  40%, 80% {
    transform: translateX(5px);
  }
}
</style>