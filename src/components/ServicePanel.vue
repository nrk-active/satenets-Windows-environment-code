<!-- src/components/ServicePanel.vue -->
<template>
  <div class="service-panel" :style="{ height: panelHeight + 'px' }">
    <!-- 可拖拽的调整大小手柄 -->
    <div 
      class="resize-handle"
      @mousedown="startResize"
    ></div>
    
    <div class="service-header">
      <h3 style="padding-right: 10px;">业务路径控制</h3>
      <div class="service-controls">
        <button 
          class="control-btn" 
          @click="loadLocalServiceData"
          :disabled="loading"
        >
          {{ loading ? '加载中...' : '加载本地数据' }}
        </button>
        <button 
          class="control-btn" 
          :class="{ active: showAllPaths }"
          @click="toggleAllPaths"
        >
          {{ showAllPaths ? '清除所有路径' : '绘制所有路径' }}
        </button>
        <button class="control-btn" @click="clearAllPaths">清除所有路径</button>
      </div>
      <div class="service-stats">
        活跃: {{ serviceData.active_requests?.length || 0 }} | 
        待处理: {{ serviceData.pending_requests?.length || 0 }} |
        失败: {{ serviceData.failed_requests?.length || 0 }}
      </div>
      <span class="close-btn" @click="$emit('close')">▼</span>
    </div>
    
    <!-- 业务类型显示设置 -->
    <div class="service-display-controls">
      <div class="control-section">
        <h4>业务类型显示</h4>
        <div class="control-row">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="displaySettings.showActive"
              @change="updatePathDisplay"
            />
            <span class="checkmark"></span>
            活跃业务 ({{ serviceData.active_requests?.length || 0 }})
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="displaySettings.showPending"
              @change="updatePathDisplay"
            />
            <span class="checkmark"></span>
            待处理业务 ({{ serviceData.pending_requests?.length || 0 }})
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="displaySettings.showBlocked"
              @change="updatePathDisplay"
            />
            <span class="checkmark"></span>
            阻塞业务 ({{ serviceData.blocked_requests?.length || 0 }})
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="displaySettings.showEnded"
              @change="updatePathDisplay"
            />
            <span class="checkmark"></span>
            已结束业务 ({{ serviceData.ended_requests?.length || 0 }})
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="displaySettings.showFailed"
              @change="updatePathDisplay"
            />
            <span class="checkmark"></span>
            失败业务 ({{ serviceData.failed_requests?.length || 0 }})
          </label>
        </div>
      </div>
      
      <div class="control-section">
        <h4>最大显示路径数</h4>
        <div class="slider-container">
          <input 
            type="range" 
            min="1" 
            max="50" 
            v-model="displaySettings.maxPaths"
            @input="updatePathDisplay"
            class="path-slider"
          />
          <span class="slider-value">{{ displaySettings.maxPaths }}</span>
        </div>
      </div>
      
      <div class="control-section">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="displaySettings.autoUpdate"
          />
          <span class="checkmark"></span>
          自动更新路径
        </label>
      </div>
    </div>
    
    <div class="service-list">
      <!-- 业务列表 -->
      <div class="service-category">
        <h4>业务列表</h4>
        <div class="business-list">
          <!-- 活跃业务 -->
          <div v-if="serviceData.active_requests?.length && displaySettings.showActive" class="business-group">
            <div v-for="request in serviceData.active_requests" 
                 :key="generateServiceId(request)" 
                 class="service-item active" 
                 @click="handleServiceClick(request, 'active')">
              <div class="service-info">
                <span class="service-id">{{ generateServiceId(request) }}</span>
                <span class="service-route">{{ request.src_node }} → {{ request.dst_node }}</span>
              </div>
              <div class="service-actions">
                <button 
                  class="action-btn draw-btn"
                  @click.stop="drawSinglePath(request)"
                  :disabled="!networkData"
                >
                  绘制
                </button>
                <button 
                  class="action-btn clear-btn"
                  @click.stop="clearSinglePath(request)"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
          
          <!-- 待处理业务 -->
          <div v-if="serviceData.pending_requests?.length && displaySettings.showPending" class="business-group">
            <div v-for="request in serviceData.pending_requests" 
                 :key="generateServiceId(request)" 
                 class="service-item pending" 
                 @click="handleServiceClick(request, 'pending')">
              <div class="service-info">
                <span class="service-id">{{ generateServiceId(request) }}</span>
                <span class="service-route">{{ request.src_node }} → {{ request.dst_node }}</span>
              </div>
              <div class="service-actions">
                <button 
                  class="action-btn draw-btn"
                  @click.stop="drawSinglePath(request)"
                  :disabled="!networkData"
                >
                  绘制
                </button>
                <button 
                  class="action-btn clear-btn"
                  @click.stop="clearSinglePath(request)"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
          
          <!-- 其他业务类型类似 -->
          <div v-if="serviceData.blocked_requests?.length && displaySettings.showBlocked" class="business-group">
            <div v-for="request in serviceData.blocked_requests" 
                 :key="generateServiceId(request)" 
                 class="service-item blocked" 
                 @click="handleServiceClick(request, 'blocked')">
              <div class="service-info">
                <span class="service-id">{{ generateServiceId(request) }}</span>
                <span class="service-route">{{ request.src_node }} → {{ request.dst_node }}</span>
              </div>
              <div class="service-actions">
                <button 
                  class="action-btn draw-btn"
                  @click.stop="drawSinglePath(request)"
                  :disabled="!networkData"
                >
                  绘制
                </button>
                <button 
                  class="action-btn clear-btn"
                  @click.stop="clearSinglePath(request)"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="serviceData.failed_requests?.length && displaySettings.showFailed" class="business-group">
            <div v-for="request in serviceData.failed_requests" 
                 :key="generateServiceId(request)" 
                 class="service-item failed" 
                 @click="handleServiceClick(request, 'failed')">
              <div class="service-info">
                <span class="service-id">{{ generateServiceId(request) }}</span>
                <span class="service-route">{{ request.src_node }} → {{ request.dst_node }}</span>
              </div>
              <div class="service-actions">
                <button 
                  class="action-btn draw-btn"
                  @click.stop="drawSinglePath(request)"
                  :disabled="!networkData"
                >
                  绘制
                </button>
                <button 
                  class="action-btn clear-btn"
                  @click.stop="clearSinglePath(request)"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted } from 'vue';
import { useServiceData } from '../composables/useServiceData.js';

const props = defineProps({
  serviceData: Object,
  generateServiceId: Function,
  networkData: Object  // 添加网络数据属性
});

const emit = defineEmits(['selectService', 'close', 'updateServiceData']);

// 注入 Cesium viewer
const cesiumViewer = inject('cesiumViewer', null);

// 使用 useServiceData 的路径绘制功能
const {
  drawServicePath,
  clearServicePath,
  clearAllServicePaths: clearAllServicePathsFunc,
  drawMultipleServicePaths,
  loadServiceDataFromFile
} = useServiceData();

// 显示设置
const displaySettings = ref({
  showActive: true,
  showPending: true,
  showBlocked: true,
  showEnded: false,
  showFailed: false,
  maxPaths: 10,
  autoUpdate: false
});

const showAllPaths = ref(false);

// 面板调整大小相关
const panelHeight = ref(300);
const isResizing = ref(false);
const loading = ref(false);

// 调整大小功能
function startResize(event) {
  isResizing.value = true;
  const startY = event.clientY;
  const startHeight = panelHeight.value;
  
  function resize(e) {
    if (!isResizing.value) return;
    
    const deltaY = startY - e.clientY;
    const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
    panelHeight.value = newHeight;
  }
  
  function stopResize() {
    isResizing.value = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
  
  event.preventDefault();
}

// 加载本地业务数据
function loadLocalServiceData() {
  // 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  
  fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    loading.value = true;
    
    try {
      // 使用 useServiceData 的 loadServiceDataFromFile 方法
      const processedData = await loadServiceDataFromFile(file);
      
      // 触发数据更新事件，让父组件知道数据已更新
      emit('updateServiceData', processedData);
      
      console.log('成功加载业务数据:', processedData);
      
      // 显示成功提示
      setTimeout(() => {
        alert(`业务数据加载成功！\n活跃: ${processedData.active_requests?.length || 0}\n待处理: ${processedData.pending_requests?.length || 0}\n失败: ${processedData.failed_requests?.length || 0}`);
      }, 100);
      
    } catch (error) {
      console.error('加载业务数据失败:', error);
      alert('加载失败: ' + error.message);
    } finally {
      loading.value = false;
      // 清理文件输入元素
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput);
      }
    }
  };
  
  // 添加到DOM并触发点击
  document.body.appendChild(fileInput);
  fileInput.click();
}

// 处理业务点击
function handleServiceClick(service, type) {
  emit('selectService', service, type);
}

// 绘制单个业务路径
function drawSinglePath(service) {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer || !props.networkData) {
    console.warn('Cesium viewer 或网络数据不可用');
    return;
  }
  
  console.log('绘制业务路径:', service);
  drawServicePath(viewer, service, props.networkData);
}

// 清除单个业务路径
function clearSinglePath(service) {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer) {
    console.warn('Cesium viewer 不可用');
    return;
  }
  
  const serviceId = props.generateServiceId(service);
  console.log('清除业务路径:', serviceId);
  clearServicePath(viewer, serviceId);
}

// 切换所有路径显示
function toggleAllPaths() {
  console.log('=== 切换所有路径显示 ===');
  
  // cesiumViewer 是通过 inject 获取的，应该是一个函数
  const viewer = cesiumViewer?.() || cesiumViewer;
  console.log('实际使用的 viewer:', viewer);
  console.log('networkData:', props.networkData);
  console.log('serviceData:', props.serviceData);
  
  if (!viewer || !props.networkData) {
    console.warn('Cesium viewer 或网络数据不可用');
    return;
  }
  
  showAllPaths.value = !showAllPaths.value;
  console.log('showAllPaths:', showAllPaths.value);
  
  if (showAllPaths.value) {
    // 绘制所有路径
    console.log('开始绘制所有路径，设置:', displaySettings.value);
    drawMultipleServicePaths(viewer, props.serviceData, props.networkData, {
      showActive: displaySettings.value.showActive,
      showPending: displaySettings.value.showPending,
      showEnded: displaySettings.value.showEnded,
      showBlocked: displaySettings.value.showBlocked,
      showFailed: displaySettings.value.showFailed,
      maxPaths: displaySettings.value.maxPaths
    });
  } else {
    // 清除所有路径
    console.log('清除所有路径');
    clearAllPaths();
  }
}

// 清除所有路径
function clearAllPaths() {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer) {
    console.warn('Cesium viewer 不可用');
    return;
  }
  
  clearAllServicePathsFunc(viewer);
  showAllPaths.value = false;
}

// 更新路径显示
function updatePathDisplay() {
  if (displaySettings.value.autoUpdate && showAllPaths.value) {
    toggleAllPaths();
    // 重新绘制以应用新设置
    toggleAllPaths();
  }
}

// 监听业务数据变化
watch(() => props.serviceData, (newData) => {
  if (displaySettings.value.autoUpdate && showAllPaths.value && newData) {
    // 自动更新路径显示
    updatePathDisplay();
  }
}, { deep: true });

onMounted(() => {
  console.log('ServicePanel 挂载完成');
  console.log('Props:', props);
  console.log('cesiumViewer 在挂载时:', cesiumViewer);
  console.log('serviceData:', props.serviceData);
  console.log('networkData:', props.networkData);
});
</script>

<style scoped>
.service-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
  background-color: rgba(30, 30, 30, 0.75);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(85, 85, 85, 0.8);
  color: white;
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #555;
  cursor: ns-resize;
  z-index: 1001;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background: #777;
}

.resize-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 2px;
  background: #888;
  border-radius: 1px;
}

.service-header {
  padding: 10px 15px;
  border-bottom: 1px solid rgba(85, 85, 85, 0.8);
  background-color: rgba(40, 40, 40, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.service-header h3 {
  margin: 0;
  font-size: 16px;
  flex: 0 0 auto;
}

.service-controls {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.control-btn {
  padding: 4px 8px;
  border: 1px solid rgba(85, 85, 85, 0.8);
  background: rgba(64, 64, 64, 0.8);
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: rgba(80, 80, 80, 0.9);
  border-color: rgba(119, 119, 119, 0.9);
}

.control-btn.active {
  background: #3498db;
  border-color: #2980b9;
  color: white;
}

.service-stats {
  font-size: 12px;
  color: #ccc;
  flex: 1;
  text-align: right;
}

.close-btn {
  cursor: pointer;
  font-size: 14px;
  color: #aaa;
  transition: color 0.2s;
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 2px;
}

.close-btn:hover {
  color: #f39c12;
  background-color: rgba(255, 255, 255, 0.1);
}

/* 业务显示控制 */
.service-display-controls {
  padding: 10px 15px;
  border-bottom: 1px solid rgba(68, 68, 68, 0.8);
  background: rgba(40, 40, 40, 0.6);
  flex-shrink: 0;
}

.control-section {
  margin-bottom: 10px;
}

.control-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #ffd700;
}

.control-row {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 1px solid #666;
  border-radius: 3px;
  margin-right: 6px;
  position: relative;
  background: #333;
  transition: all 0.2s ease;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background: #3498db;
  border-color: #2980b9;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  position: absolute;
  left: 2px;
  top: -2px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.path-slider {
  flex: 1;
  max-width: 200px;
}

.slider-value {
  font-size: 12px;
  font-weight: bold;
  color: #3498db;
  min-width: 20px;
}

/* 业务列表 */
.service-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.service-category h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #999;
  border-bottom: 1px solid #444;
  padding-bottom: 5px;
}

.business-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.business-group {
  border: 1px solid rgba(68, 68, 68, 0.8);
  border-radius: 4px;
  overflow: hidden;
  background: rgba(40, 40, 40, 0.5);
}

.service-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  border-bottom: 1px solid rgba(68, 68, 68, 0.6);
  background: rgba(50, 50, 50, 0.4);
}

.service-item:last-child {
  border-bottom: none;
}

.service-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.service-item.active {
  background-color: rgba(76, 175, 80, 0.2);
  border-left: 3px solid #4CAF50;
}

.service-item.pending {
  background-color: rgba(255, 193, 7, 0.2);
  border-left: 3px solid #FFC107;
}

.service-item.blocked {
  background-color: rgba(255, 87, 34, 0.2);
  border-left: 3px solid #FF5722;
}

.service-item.failed {
  background-color: rgba(244, 67, 54, 0.2);
  border-left: 3px solid #F44336;
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.service-id {
  font-weight: bold;
  color: #fff;
}

.service-route {
  font-size: 11px;
  color: #ccc;
}

.service-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 2px 6px;
  border: 1px solid #666;
  background: #444;
  color: #ccc;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #555;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.draw-btn {
  border-color: #4CAF50;
  color: #4CAF50;
}

.draw-btn:hover:not(:disabled) {
  background: #4CAF50;
  color: white;
}

.clear-btn {
  border-color: #f44336;
  color: #f44336;
}

.clear-btn:hover {
  background: #f44336;
  color: white;
}
</style>