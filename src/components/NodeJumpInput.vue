<template>
  <div class="node-jump-wrapper" :style="containerStyle">
    <!--11.1新增 放大镜图标按钮 -->
    <button 
      class="magnifier-button"
      @click="togglePanel"
      :title="isPanelVisible ? '收起搜索面板' : '展开搜索面板'"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>
    
    <!-- 输入框面板，点击放大镜图标时显示/隐藏 -->
    <div v-if="isPanelVisible" class="node-jump-container">
      <!-- 节点跳转 -->
      <div class="jump-input-group">
        <label class="jump-label">跳转到节点:</label>
        <div class="input-button-row">
          <input 
            v-model="nodeInput"
            type="text"
            class="node-input"
            placeholder="输入节点ID"
            @keyup.enter="jumpToNode"
            @input="filterNodes"
            autofocus
          />
          <button 
            class="jump-button"
            @click="jumpToNode"
            :disabled="!nodeInput.trim()"
          >
            跳转
          </button>
        </div>
      </div>
      
      <!-- 时间跳转 -->
      <div class="jump-input-group time-jump">
        <label class="jump-label">跳转到时间:</label>
        <div class="input-button-row">
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
      </div>
      
      <!-- 节点建议列表 -->
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
  </div>
</template>
<!--11.1新增结束 节点建议列表 -->

<script setup>
import { ref, computed, watch, inject, nextTick } from 'vue';
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
//11.1新增 开始
const isPanelVisible = ref(false); // 控制面板显示/隐藏

// 切换面板显示状态
function togglePanel() {
  isPanelVisible.value = !isPanelVisible.value;
  
  // 如果显示面板，清空输入并聚焦到节点输入框
  if (isPanelVisible.value) {
    nodeInput.value = '';
    timeInput.value = '';
    showSuggestions.value = false;
    
    nextTick(() => {
      const inputElement = document.querySelector('.node-input');
      if (inputElement) {
        inputElement.focus();
      }
    });
  }
}
//11.1新增结束

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
    console.warn('请输入有效的时间格式 (HH:MM:SS, MM:SS 或 SS)');
    showErrorFeedback('.time-input');
    return;
  }
  
  const totalSeconds = parseTimeToSeconds(timeInput.value);
  let currentFolder = getCurrentDataFolder();
  
  // 如果getCurrentDataFolder返回null，尝试从localStorage直接获取
  if (!currentFolder) {
    currentFolder = localStorage.getItem('selectedDataFolder');
    console.log(`从localStorage获取文件夹: ${currentFolder}`);
  }
  
  // 如果仍然没有文件夹信息，尝试从ObjectViewer的显示中推断
  if (!currentFolder) {
    const objectViewerElement = document.querySelector('.current-folder');
    if (objectViewerElement) {
      const text = objectViewerElement.textContent;
      const match = text.match(/当前选择：(.+)/);
      if (match && match[1] !== '未选择') {
        currentFolder = match[1];
        console.log(`从ObjectViewer推断文件夹: ${currentFolder}`);
      }
    }
  }
  
  // 如果还是没有，使用默认推断逻辑
  if (!currentFolder) {
    // 检查是否有已加载的数据，从中推断可能的文件夹
    const hasData = props.networkData?.nodes?.length > 0;
    if (hasData) {
      // 根据节点数量推断可能的文件夹类型
      const nodeCount = props.networkData.nodes.length;
      if (nodeCount > 5000) {
        currentFolder = 'new_10s_3600s'; // 大数据集通常是new文件夹
        console.log(`根据节点数量(${nodeCount})推断文件夹: ${currentFolder}`);
      } else {
        currentFolder = 'old_60s_360s'; // 小数据集通常是old文件夹
        console.log(`根据节点数量(${nodeCount})推断文件夹: ${currentFolder}`);
      }
    } else {
      console.warn('无法确定当前数据文件夹，使用默认配置');
      currentFolder = 'old_60s_360s'; // 默认文件夹
    }
  }
  
  // 根据文件夹类型计算时间间隔和帧数
  const config = parseFolderName(currentFolder);
  const timeInterval = config.interval;
  const totalDuration = config.totalDuration;
  const maxFrames = Math.ceil(config.totalDuration / config.interval);
  
  console.log(`使用文件夹: ${currentFolder}, 时间间隔: ${timeInterval}秒, 总时长: ${totalDuration}秒, 最大帧数: ${maxFrames}`);
  
  // 检查输入时间是否超出文件夹总时长
  if (totalSeconds > totalDuration) {
    console.warn(`输入时间 ${timeInput.value} (${totalSeconds}秒) 超出当前文件夹最大时长 ${totalDuration}秒`);
    
    // 计算最大时长的时间格式
    const maxHours = Math.floor(totalDuration / 3600);
    const maxMinutes = Math.floor((totalDuration % 3600) / 60);
    const maxSecs = totalDuration % 60;
    const maxTimeStr = `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}:${maxSecs.toString().padStart(2, '0')}`;
    
    alert(`输入的时间超出范围！\n当前文件夹 "${currentFolder}" 的最大时长为: ${maxTimeStr}\n请输入不超过此时长的时间。`);
    showErrorFeedback('.time-input');
    return;
  }
  
  // 修正时间到帧数的转换逻辑
  // 时间轴显示使用公式：totalSeconds = frame * timeInterval
  // 所以反向计算：frame = totalSeconds / timeInterval
  // 处理边界情况：
  // - 0秒对应帧1（显示为1*60=60秒）
  // - 60秒对应帧1（显示为1*60=60秒）
  // - 120秒对应帧2（显示为2*60=120秒）
  let targetFrame;
  if (totalSeconds === 0) {
    targetFrame = 1; // 0秒对应帧1
  } else {
    // 计算最接近的帧数：找到使得frame * timeInterval最接近totalSeconds的帧
    targetFrame = Math.round(totalSeconds / timeInterval);
    // 确保至少是帧1
    targetFrame = Math.max(1, targetFrame);
  }
  
  // 确保不超过最大帧数
  const clampedFrame = Math.max(1, Math.min(maxFrames, targetFrame));
  
  try {
    console.log(`跳转到时间: ${timeInput.value} (${totalSeconds}秒) -> 第${clampedFrame}帧 (时间间隔: ${timeInterval}秒, 最大帧数: ${maxFrames})`);
    
    // 添加视觉反馈
    const jumpBtn = document.querySelector('.time-jump .jump-button');
    if (jumpBtn) {
      jumpBtn.classList.add('jumping');
      setTimeout(() => {
        jumpBtn.classList.remove('jumping');
      }, 2000);
    }
    
    // 发射时间变化事件 - 确保传递数字类型的帧数
    emit('time-changed', Number(clampedFrame));
    
    // 通过全局事件触发时间轴跳转
    const frameChangeEvent = new CustomEvent('timeline-frame-change', {
      detail: { frame: Number(clampedFrame), forceUpdate: true }
    });
    window.dispatchEvent(frameChangeEvent);
    console.log(`已发送timeline-frame-change事件，目标帧: ${clampedFrame}`);
  } catch (error) {
    console.error('跳转时间时出错:', error);
    showErrorFeedback('.time-input');
  }
  
  // 计算实际跳转后的时间并更新输入框显示
  // 使用与时间轴显示一致的公式：frame * timeInterval
  const actualSeconds = clampedFrame * timeInterval;
  const actualHours = Math.floor(actualSeconds / 3600);
  const actualMinutes = Math.floor((actualSeconds % 3600) / 60);
  const actualSecsRemainder = actualSeconds % 60;
  const actualTimeStr = `${actualHours.toString().padStart(2, '0')}:${actualMinutes.toString().padStart(2, '0')}:${actualSecsRemainder.toString().padStart(2, '0')}`;
  
  if (actualSeconds !== totalSeconds) {
    console.log(`输入时间 ${timeInput.value} (${totalSeconds}秒) 调整为最近的有效时间: ${actualTimeStr} (${actualSeconds}秒, 第${clampedFrame}帧)`);
  } else {
    console.log(`时间跳转精确匹配: ${actualTimeStr} (${actualSeconds}秒, 第${clampedFrame}帧)`);
  }
  
  // 更新输入框显示为实际跳转的时间
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
      console.warn('请输入有效的节点ID');
      showErrorFeedback('.node-input');
      return;
    }
    
    const searchId = nodeInput.value.toLowerCase().trim();
    
    // 首先尝试精确匹配
    let targetNode = props.networkData.nodes.find(node => 
      String(node.id).toLowerCase() === searchId
    );
    
    // 如果没找到，尝试模糊匹配
    if (!targetNode) {
      targetNode = props.networkData.nodes.find(node => 
        String(node.id).toLowerCase().includes(searchId)
      );
    }
  
    if (!targetNode) {
      console.warn(`未找到节点: ${nodeInput.value}`);
      showErrorFeedback('.node-input');
      return;
    }
    
    console.log(`跳转到节点: ${targetNode.id} (${getNodeTypeLabel(targetNode.type)})`);
    
    // 设置输入框为匹配到的节点ID
    nodeInput.value = targetNode.id;
    
    // 计算目标位置
    let targetPosition;
    if (targetNode.type === 'satellite') {
      // 卫星使用ECEF坐标系（米为单位）
      targetPosition = new Cesium.Cartesian3(
        parseFloat(targetNode.position[0]) * 1000,
        parseFloat(targetNode.position[1]) * 1000,
        parseFloat(targetNode.position[2]) * 1000
      );
    } else {
      // 地面站和ROADM使用经纬度坐标
      targetPosition = Cesium.Cartesian3.fromDegrees(
        parseFloat(targetNode.position[0]),
        parseFloat(targetNode.position[1]),
        targetNode.type === 'station' ? 100000 : 50000 // 地面站高度100km，ROADM高度50km
      );
    }
    
    // 使用Cesium viewer进行跳转
    if (cesiumViewer && cesiumViewer()) {
      const viewer = cesiumViewer();
      
      // 添加视觉反馈 - 跳转按钮变色
      const jumpBtn = document.querySelector('.jump-input-group:first-child .jump-button');
      if (jumpBtn) {
        jumpBtn.classList.add('jumping');
        setTimeout(() => {
          jumpBtn.classList.remove('jumping');
        }, 2000);
      }
      
      // 平滑飞行到目标位置
      viewer.camera.flyTo({
        destination: targetPosition,
        duration: 2.0, // 2秒飞行时间
        complete: () => {
          console.log(`成功跳转到节点: ${targetNode.id}`);
          
          // 发射选中事件 - 确保发送字符串ID
          emit('node-selected', String(targetNode.id));
        }
      });
    } else {
      console.error('Cesium viewer 不可用');
      showErrorFeedback('.node-input');
    }
    
    // 隐藏建议列表
    showSuggestions.value = false;
  } catch (error) {
    console.error('跳转到节点时出错:', error);
    showErrorFeedback('.node-input');
    // 确保错误被处理，不向上传播
  }
}

//11.1新增 
// 点击外部隐藏建议列表和面板
function handleClickOutside(event) {
  const jumpWrapper = event.target.closest('.node-jump-wrapper');
  const magnifierButton = event.target.closest('.magnifier-button');
  
  // 如果点击的不是面板内的元素且不是放大镜图标，隐藏面板
  if (!jumpWrapper || magnifierButton) {
    showSuggestions.value = false;
  }
}
//11.1新增 结束

// 监听网络数据变化，清空输入
watch(() => props.networkData, () => {
  nodeInput.value = '';
  timeInput.value = '';
  showSuggestions.value = false;
});

// 添加全局点击事件监听
document.addEventListener('click', handleClickOutside);

// 组件卸载时清理事件监听
import { onUnmounted, onMounted } from 'vue';

// 动态调整位置
const containerStyle = ref({});

// 动态调整输入框位置 - 修改为固定在右侧中部偏上
function adjustPosition() {
  try {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    //11.1 固定在右侧中部偏上位置
    let position = {
      top: '18%', // 设置为视口高度的15%，位于中部偏上
      right: '20px'
    };
    //11.1 新增结束
    
    // 移动端适配
    if (viewportWidth <= 768) {
      position.right = '10px';
      position.top = '25%'; // 移动端稍微下调一点
    }
    
    containerStyle.value = position;
    
  } catch (error) {
    console.error('调整位置时出错:', error);
    containerStyle.value = {
      top: '30%',
      right: '20px'
    };
  }
}

onMounted(() => {
  // 添加事件监听
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', adjustPosition);
  
  // 监听UI位置变化事件（与仿真时间轴同步）
  const handleUIPositionsChange = (event) => {
    if (event.detail.source !== 'nodeJump') {
      console.log('NodeJump: 响应UI位置变化事件');
      setTimeout(adjustPosition, 50);
    }
  };
  window.addEventListener('ui-positions-changed', handleUIPositionsChange);
  
  // 初始位置调整
  setTimeout(adjustPosition, 300);
  
  // 定期检查位置 - 与仿真时间轴保持相同间隔
  const interval = setInterval(adjustPosition, 2000);
  
  // DOM变化观察（简化版）
  const observer = new MutationObserver(() => {
    setTimeout(adjustPosition, 100);
  });
  
  // 观察可能影响布局的元素 - 只观察ServicePanel
  const elementsToObserve = [
    document.querySelector('.object-viewer-container'),
    document.querySelector('.object-viewer'),
    document.querySelector('.service-panel')
  ].filter(Boolean);
  
  elementsToObserve.forEach(element => {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  });
  
  // 清理函数
  window.nodeJumpCleanup = () => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', adjustPosition);
    window.removeEventListener('ui-positions-changed', handleUIPositionsChange);
    clearInterval(interval);
    observer.disconnect();
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
/*11.1新增*/
/* 容器样式 */
.node-jump-wrapper {
  position: fixed;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* 放大镜按钮样式 */
.magnifier-button {
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(85, 85, 85, 0.7);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.magnifier-button:hover {
  background: rgba(45, 45, 45, 0.9);
  transform: scale(1.05);
}

.magnifier-button:active {
  transform: scale(0.95);
}

/* 输入框面板样式 */
.node-jump-container {
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(85, 85, 85, 0.7);
  border-radius: 6px;
  padding: 10px;
  width: 180px; /* 宽度从280px进一步减小到220px */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  animation: slideUp 0.3s ease-out;
}

/* 面板滑入动画 */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端适配调整 */
@media (max-width: 768px) {
  .node-jump-container {
    width: 220px; /* 移动端进一步减小宽度 */
  }
  
  .jump-input-group {
    flex-wrap: nowrap;
  }
  
  .jump-label {
    min-width: 60px;
    font-size: 11px;
    margin-left: 15px; /* 移动端适当调整后移距离 */
  }
  
  .input-button-row {
    justify-content: center;
  }
  
  .node-input, .time-input {
    min-width: 50px; /* 进一步减小移动端输入框最小宽度 */
    max-width: 90px; /* 添加移动端最大宽度限制 */
    font-size: 10px;
    padding: 3px 4px; /* 减小内边距 */
    flex: 0.7; /* 应用相同的flex增长因子 */
  }
  
  .jump-button {
    min-width: 35px;
    font-size: 10px;
    padding: 3px 6px;
  }
}
/*11.1新增结束*/

.jump-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-jump {
  border-top: 1px solid #444;
  padding-top: 8px;
}

.jump-label {
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  margin-left: 20px; /* 后移文字，与输入框左端对齐 */
}

.input-button-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.node-input, .time-input {
  flex: 0.7; /* 减小flex增长因子使输入框变窄 */
  min-width: 50px; /* 进一步减小输入框最小宽度 */
  max-width: 100px; /* 减小最大宽度使输入框进一步变窄 */
  padding: 5px 4px; /* 减小内边距 */
  border: 1px solid #555;
  border-radius: 3px;
  background: rgba(40, 40, 40, 0.8);
  color: #fff;
  font-size: 12px; /* 适当减小字体大小 */
  outline: none;
  transition: border-color 0.2s;
  text-align: center; /* 确保输入框文本居中 */
}

.time-input {
  font-family: monospace;
  text-align: center;
}

.node-input:focus, .time-input:focus {
  border-color: #4CAF50;
}

.node-input::placeholder, .time-input::placeholder {
  color: #999;
  text-align: center; /* 确保占位符文本也居中 */
}

.jump-button {
  padding: 5px 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  min-width: 50px;
}

.jump-button:hover:not(:disabled) {
  background: #45a049;
}

.jump-button:disabled {
  background: #666;
  cursor: not-allowed;
}

/* 跳转动画效果 */
.jump-button.jumping {
  background: #45a049;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* 错误抖动动画 */
.error-shake {
  animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  border-color: #ff5252 !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
  20%, 40%, 60%, 80% { transform: translateX(3px); }
}

.suggestions-dropdown {
  position: absolute;
  bottom: 100%; /* 改为从容器上方弹出 */
  left: 0;
  right: 0;
  background: rgba(40, 40, 40, 0.95);
  border: 1px solid #555;
  border-radius: 4px;
  margin-bottom: 5px; /* 改为底部间距 */
  max-height: 200px;
  overflow-y: auto;
  z-index: 1001;
  backdrop-filter: blur(5px);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3); /* 改为向上的阴影 */
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background: rgba(76, 175, 80, 0.2);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.node-id {
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}

.node-type {
  color: #4CAF50;
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(76, 175, 80, 0.2);
  border-radius: 3px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .node-jump-container {
    width: 280px;
    padding: 8px;
  }
  
  .jump-input-group {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .jump-label {
    font-size: 11px;
  }
  
  .node-input, .time-input {
    font-size: 11px;
    padding: 4px 6px;
  }
  
  .jump-button {
    font-size: 11px;
    padding: 4px 8px;
  }
}
</style>