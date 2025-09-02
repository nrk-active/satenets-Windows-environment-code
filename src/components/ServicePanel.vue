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
      
      <!-- <div class="control-section">
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
      </div> -->
    </div>
    
    <div class="service-list">
      <div class="service-category">
        <h4>业务列表 (双击切换单个业务路径（绘制或清除）)</h4>
        <div class="business-list">
          <!-- 批量操作按钮 -->
          <div class="batch-controls">
            <div class="batch-left">
              <label class="checkbox-label">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
                <span class="checkmark"></span>
                全选
              </label>
              <span v-if="selectedServices.length" class="selected-count">已选 {{ selectedServices.length }} 项</span>
            </div>
            <div class="batch-right">
              <button class="action-btn draw-btn" @click="drawSelectedPaths" :disabled="selectedServices.length === 0">
                批量绘制
              </button>
              <button class="action-btn clear-btn" @click="clearSelectedPaths" :disabled="selectedServices.length === 0">
                批量清除
              </button>
            </div>
          </div>
          
          <!-- 活跃业务 -->
          <div v-if="serviceData.active_requests?.length && displaySettings.showActive" class="business-group">
            <h5 class="group-title active">活跃业务</h5>
            <div class="service-grid">
              <div v-for="request in serviceData.active_requests" 
                   :key="generateServiceId(request)" 
                   class="service-card active" 
                   @click="handleServiceClick(request, 'active')"
                   @dblclick="toggleSinglePath(request)">
                <input type="checkbox"
                       :checked="isServiceSelected(request)"
                       @click.stop="toggleServiceSelection(request)"
                       class="service-checkbox" />
                <div class="service-content">
                  <div class="service-id">{{ generateServiceId(request) }}</div>
                  <div class="service-route">{{ request.src_node }} → {{ request.dst_node }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 待处理业务 -->
          <div v-if="serviceData.pending_requests?.length && displaySettings.showPending" class="business-group">
            <h5 class="group-title pending">待处理业务</h5>
            <div class="service-grid">
              <div v-for="request in serviceData.pending_requests" 
                   :key="generateServiceId(request)" 
                   class="service-card pending" 
                   @click="handleServiceClick(request, 'pending')"
                   @dblclick="toggleSinglePath(request)">
                <input type="checkbox"
                       :checked="isServiceSelected(request)"
                       @click.stop="toggleServiceSelection(request)"
                       class="service-checkbox" />
                <div class="service-content">
                  <div class="service-id">{{ generateServiceId(request) }}</div>
                  <div class="service-route">{{ request.src_node }} → {{ request.dst_node }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 阻塞业务 -->
          <div v-if="serviceData.blocked_requests?.length && displaySettings.showBlocked" class="business-group">
            <h5 class="group-title blocked">阻塞业务</h5>
            <div class="service-grid">
              <div v-for="request in serviceData.blocked_requests" 
                   :key="generateServiceId(request)" 
                   class="service-card blocked" 
                   @click="handleServiceClick(request, 'blocked')"
                   @dblclick="toggleSinglePath(request)">
                <input type="checkbox"
                       :checked="isServiceSelected(request)"
                       @click.stop="toggleServiceSelection(request)"
                       class="service-checkbox" />
                <div class="service-content">
                  <div class="service-id">{{ generateServiceId(request) }}</div>
                  <div class="service-route">{{ request.src_node }} → {{ request.dst_node }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 失败业务 -->
          <div v-if="serviceData.failed_requests?.length && displaySettings.showFailed" class="business-group">
            <h5 class="group-title failed">失败业务</h5>
            <div class="service-grid">
              <div v-for="request in serviceData.failed_requests" 
                   :key="generateServiceId(request)" 
                   class="service-card failed" 
                   @click="handleServiceClick(request, 'failed')"
                   @dblclick="toggleSinglePath(request)">
                <input type="checkbox"
                       :checked="isServiceSelected(request)"
                       @click.stop="toggleServiceSelection(request)"
                       class="service-checkbox" />
                <div class="service-content">
                  <div class="service-id">{{ generateServiceId(request) }}</div>
                  <div class="service-route">{{ request.src_node }} → {{ request.dst_node }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted, computed } from 'vue';
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
  clearAllServicePathsAndCache: clearAllServicePathsAndCacheFunc,
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

// 存储已选业务ID
const selectedServices = ref([]); 

// 获取当前可见业务
const visibleRequests = computed(() => {
  const result = [];
  if (displaySettings.value.showActive) result.push(...(props.serviceData.active_requests || []));
  if (displaySettings.value.showPending) result.push(...(props.serviceData.pending_requests || []));
  if (displaySettings.value.showBlocked) result.push(...(props.serviceData.blocked_requests || []));
  if (displaySettings.value.showFailed) result.push(...(props.serviceData.failed_requests || []));
  return result;
});

// 是否全选
const allSelected = computed(() => {
  const ids = visibleRequests.value.map(req => props.generateServiceId(req));
  return ids.length > 0 && ids.every(id => selectedServices.value.includes(id));
});

// 切换全选
function toggleSelectAll() {
  const ids = visibleRequests.value.map(req => props.generateServiceId(req));
  if (allSelected.value) {
    // 取消全选
    selectedServices.value = selectedServices.value.filter(id => !ids.includes(id));
  } else {
    // 全选
    selectedServices.value = Array.from(new Set([...selectedServices.value, ...ids]));
  }
}

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

// 双击切换单个业务路径（绘制或清除）
function toggleSinglePath(service) {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer || !props.networkData) {
    console.warn('Cesium viewer 或网络数据不可用');
    return;
  }
  
  const serviceId = props.generateServiceId(service);
  
  // 检查路径是否已经绘制（简单的检查方法，您可能需要根据实际情况调整）
  const entities = viewer.entities.values;
  const hasPath = entities.some(entity => 
    entity.id && entity.id.includes && entity.id.includes(serviceId)
  );
  
  if (hasPath) {
    // 如果已有路径，则清除
    console.log('清除业务路径:', serviceId);
    clearServicePath(viewer, serviceId);
  } else {
    // 如果没有路径，则绘制
    console.log('绘制业务路径:', serviceId);
    drawServicePath(viewer, service, props.networkData);
  }
}

// 切换所有路径显示
function toggleAllPaths() {
  console.log('=== 切换所有路径显示 ===');
  
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer || !props.networkData) {
    console.warn('Cesium viewer 或网络数据不可用');
    return;
  }
  
  // 先全选所有可见的业务
  const ids = visibleRequests.value.map(req => props.generateServiceId(req));
  selectedServices.value = Array.from(new Set([...selectedServices.value, ...ids]));
  console.log('已全选所有可见业务:', selectedServices.value.length, '项');
  
  showAllPaths.value = !showAllPaths.value;
  console.log('showAllPaths:', showAllPaths.value);
  
  if (showAllPaths.value) {
    // 绘制所有选中的路径
    console.log('开始绘制所有选中路径');
    drawSelectedPaths();
  } else {
    // 清除所有选中的路径
    console.log('清除所有选中路径');
    clearSelectedPaths();
  }
}

// 清除所有路径
function clearAllPaths() {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer) {
    console.warn('Cesium viewer 不可用');
    return;
  }
  
  // 先全选所有可见的业务
  const ids = visibleRequests.value.map(req => props.generateServiceId(req));
  selectedServices.value = Array.from(new Set([...selectedServices.value, ...ids]));
  console.log('已全选所有可见业务:', selectedServices.value.length, '项');
  
  // 清除所有选中的路径
  clearSelectedPaths();
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

// 切换服务选择状态
function toggleServiceSelection(service) {
  const id = props.generateServiceId(service);
  const idx = selectedServices.value.indexOf(id);
  if (idx === -1) {
    selectedServices.value.push(id);
  } else {
    selectedServices.value.splice(idx, 1);
  }
}

// 检查服务是否被选中
function isServiceSelected(service) {
  return selectedServices.value.includes(props.generateServiceId(service));
}

// 批量绘制选中路径
function drawSelectedPaths() {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer || !props.networkData) return;
  // 找到所有选中的业务对象
  const allRequests = [
    ...(props.serviceData.active_requests || []),
    ...(props.serviceData.pending_requests || []),
    ...(props.serviceData.blocked_requests || []),
    ...(props.serviceData.ended_requests || []),
    ...(props.serviceData.failed_requests || [])
  ];
  const selected = allRequests.filter(req => selectedServices.value.includes(props.generateServiceId(req)));
  selected.forEach(service => drawServicePath(viewer, service, props.networkData));
}

// 批量清除选中路径
function clearSelectedPaths() {
  const viewer = cesiumViewer?.() || cesiumViewer;
  if (!viewer) return;
  selectedServices.value.forEach(id => clearServicePath(viewer, id));
  selectedServices.value = []; // 清除后取消选择
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
  gap: 12px;
}

/* 批量控制区域 */
.batch-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(40, 40, 40, 0.7);
  border: 1px solid rgba(68, 68, 68, 0.8);
  border-radius: 4px;
  margin-bottom: 8px;
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-right {
  display: flex;
  gap: 6px;
}

.selected-count {
  font-size: 11px;
  color: #ccc;
}


/* 业务组 */
.business-group {
  border: 1px solid rgba(68, 68, 68, 0.8);
  border-radius: 4px;
  overflow: hidden;
  background: rgba(40, 40, 40, 0.5);
}

.group-title {
  margin: 0;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  border-bottom: 1px solid rgba(68, 68, 68, 0.6);
  background: rgba(30, 30, 30, 0.8);
}

.group-title.active {
  color: #4CAF50;
}

.group-title.pending {
  color: #FFC107;
}

.group-title.blocked {
  color: #FF5722;
}

.group-title.failed {
  color: #F44336;
}

/* 业务网格布局 */
.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: rgba(68, 68, 68, 0.6);
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .service-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .service-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .service-grid {
    grid-template-columns: 1fr;
  }
}

.service-card {
  padding: 6px 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  font-size: 10px;
  background: rgba(50, 50, 50, 0.4);
  position: relative;
}

.service-card:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.service-card.active {
  background-color: rgba(76, 175, 80, 0.2);
  border-left: 2px solid #4CAF50;
}

.service-card.pending {
  background-color: rgba(255, 193, 7, 0.2);
  border-left: 2px solid #FFC107;
}

.service-card.blocked {
  background-color: rgba(255, 87, 34, 0.2);
  border-left: 2px solid #FF5722;
}

.service-card.failed {
  background-color: rgba(244, 67, 54, 0.2);
  border-left: 2px solid #F44336;
}

.service-checkbox {
  margin-right: 6px;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.service-content {
  flex: 1;
  min-width: 0;
}

.service-id {
  font-weight: bold;
  color: #fff;
  font-size: 10px;
  line-height: 1.2;
}

.service-route {
  font-size: 9px;
  color: #ccc;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn {
  padding: 3px 8px;
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