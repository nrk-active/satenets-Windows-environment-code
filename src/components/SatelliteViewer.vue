<template>
  <div class="satellite-viewer-container">
    <!-- 导航栏 -->
    <NavigationBar 
      @simulation-data-selected="handleDataSelection" 
      :isLoggedIn="isLoggedIn" 
      :username="username" 
      @logout="handleLogout"
      @login-success="handleLoginSuccess"
    />
    
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 左侧面板区域 -->
      <ObjectViewer 
        v-show="showLeftPanel"
        ref="objectViewerRef"
        :current-process-id="selectedProcessId"
        :show-satellite="showSatellite"
        :show-station="showStation"
        :show-roadm="showRoadm"
        :show-links="showLinks"
        :selected-entity-id="selectedEntity?.id"
        @update:show-satellite="showSatellite = $event"
        @update:show-station="showStation = $event"
        @update:show-roadm="showRoadm = $event"
        @update:show-links="showLinks = $event"
        @select-entity="handleEntitySelect"
        @close="handleLeftPanelClose"
      />
      <LeftCollapsedSidebar 
        v-show="!showLeftPanel" 
        @reopen="reopenLeftPanel"
      />
      
      <!-- 中间Cesium容器 -->
      <div id="cesiumContainer">
        <!-- 自定义选择指示器 -->
        <div 
          v-if="selectedEntity" 
          class="custom-selection-indicator"
          :style="selectionIndicatorStyle"
        ></div>
        
        <ServicePanel 
          v-show="showBottomPanel"
          :service-data="serviceData"
          :network-data="currentGraphData"
          :generate-service-id="generateServiceId"
          @select-service="handleSelectService"
          @close="handleBottomPanelClose"
          @update-service-data="handleServiceDataUpdate"
        />

        <BottomCollapsedSidebar 
          v-show="!showBottomPanel"
          @reopen="reopenBottomPanel"
        />
      </div>
      
      <!-- 右侧面板区域 -->
      <div class="right-panel-container" v-if="selectedService || showRightPanel">
        <!-- 业务详情面板 -->
        <ServiceDetail 
          v-if="selectedService"
          :selected-service="selectedService"
          @close="handleCloseServiceDetail"
        />
        <!-- 实体信息面板 -->
        <EntityInfoPanel 
          v-else-if="showRightPanel"
          :selectedEntity="selectedEntity" 
          :graphData="selectedEntityRawData"
          @close="handleRightPanelClose" 
        />
      </div>
      
      <RightCollapsedSidebar 
        v-show="!showRightPanel && !selectedService" 
        @reopen="reopenRightPanel"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, inject, ref, provide } from 'vue';
import { useRouter } from 'vue-router';
import NavigationBar from './navigation-bar.vue';
import ObjectViewer from './ObjectViewer.vue';
import EntityInfoPanel from './EntityInfoPanel.vue';
import LeftCollapsedSidebar from './LeftCollapsedSidebar.vue';
import RightCollapsedSidebar from './RightCollapsedSidebar.vue';
import BottomCollapsedSidebar from './BottomCollapsedSidebar.vue';
import ControlPanel from './ControlPanel.vue';
import ServicePanel from './ServicePanel.vue';
import ServiceDetail from './ServiceDetail.vue';
import ServicePathPanel from './ServicePathPanel.vue';

import { useCesium } from '../composables/useCesium.js';
import { useDataLoader } from '../composables/useDataLoader.js';
import { useServiceData } from '../composables/useServiceData.js';
import { useAnimation } from '../composables/useAnimation.js';
import * as Cesium from 'cesium';

const router = useRouter();

// 注入登录状态和方法
const isLoggedIn = inject('isLoggedIn', ref(false));
const username = inject('username', ref(''));
const isGuestMode = inject('isGuestMode', ref(false));
const authMethods = inject('authMethods', {});
const selectedProcessId = inject('selectedProcessId', ref(null));

// 从 authMethods 中解构方法
const { handleLoginSuccess, handleGuestLogin, handleLogout: originalHandleLogout } = authMethods;

// 包装 handleLogout 方法，添加路由跳转
function handleLogout() {
  if (originalHandleLogout) {
    originalHandleLogout();
  }
  // 登出后跳转到登录页
  router.push('/login');
}

// 处理仿真数据选择
const showDataPanel = ref(false);
const selectedSimulationData = ref({});
const showObjectViewer = ref(true);
const objectViewerRef = ref(null);

// 侧边栏状态管理
const showLeftPanel = ref(true);
const showRightPanel = ref(false);
const showBottomPanel = ref(true);

// 选中的实体信息
const selectedEntity = ref(null);
const selectedEntityRawData = ref(null);

function handleDataSelection(data) {
  selectedSimulationData.value = data;
  showDataPanel.value = true;
  console.log('选择的仿真数据:', data);
}

// 自定义选择指示器
const selectionIndicatorStyle = ref({});
const selectionIndicatorSize = 20; // 默认20px

// 更新选择指示器位置
function updateSelectionIndicator() {
  if (!selectedEntity.value || !viewer() || !currentGraphData) {
    selectionIndicatorStyle.value = { display: 'none' };
    return;
  }

  // 对于链路类型，不显示选择指示器
  if (selectedEntity.value.type === 'link') {
    selectionIndicatorStyle.value = { display: 'none' };
    return;
  }

  // 找到选中的实体
  const entity = currentGraphData.nodes.find(node => node.id === selectedEntity.value.id);
  if (!entity) {
    selectionIndicatorStyle.value = { display: 'none' };
    return;
  }

  // 获取实体的3D位置
  let position;
  if (entity.type === 'satellite') {
    position = new Cesium.Cartesian3(
      parseFloat(entity.position[0]) * 1000,
      parseFloat(entity.position[1]) * 1000,
      parseFloat(entity.position[2]) * 1000
    );
  } else {
    position = Cesium.Cartesian3.fromDegrees(
      parseFloat(entity.position[0]),
      parseFloat(entity.position[1]),
      10
    );
  }

  // 将3D位置转换为屏幕坐标 - 使用正确的API
  try {
    const screenPosition = viewer().scene.cartesianToCanvasCoordinates(position);
    
    if (screenPosition) {
      selectionIndicatorStyle.value = {
        display: 'block',
        left: `${screenPosition.x - selectionIndicatorSize / 2}px`,
        top: `${screenPosition.y - selectionIndicatorSize / 2}px`,
        width: `${selectionIndicatorSize}px`,
        height: `${selectionIndicatorSize}px`
      };
    } else {
      selectionIndicatorStyle.value = { display: 'none' };
    }
  } catch (error) {
    console.warn('无法计算屏幕坐标:', error);
    selectionIndicatorStyle.value = { display: 'none' };
  }
}

// 初始化所有composables
const { 
  viewer, 
  showSatellite, 
  showStation, 
  showRoadm,
  showLinks,
  initializeCesium,
  createEntities,
  addRoadmLinks,
  highlightSatelliteLinks,
  updateVisibility,
  setupClickHandler,
  cleanup: cleanupCesium
} = useCesium();

const { 
  nodeCount, 
  linkCount, 
  loadGraphData,
  loadGraphDataFromAPI,
  dataCache 
} = useDataLoader();

const {
  serviceData,
  selectedService,
  loadServiceData,
  generateServiceId,
  selectService,
  closeServiceDetail,
  drawServicePath,
  clearServicePath,
  clearAllServicePaths,
  drawMultipleServicePaths
} = useServiceData();

// 提供 Cesium viewer 给子组件
provide('cesiumViewer', viewer);

const {
  isPlaying,
  timeFrame,
  animationInProgress,
  animateTransition,
  togglePlayback,
  cleanup: cleanupAnimation,
  setPreviousFrameData,
  getPreviousFrameData
} = useAnimation();

// 主要业务逻辑
let currentGraphData = null;

// 监听显示状态变化
watch([showSatellite, showStation, showRoadm, showLinks], () => {
  updateVisibility();
}, { deep: true });

// 监听进程ID变化，当选择新进程时立即加载数据
watch(selectedProcessId, async (newProcessId, oldProcessId) => {
  console.log('=== 进程ID监听器触发 ===');
  console.log('新进程ID:', newProcessId);
  console.log('旧进程ID:', oldProcessId);
  console.log('登录状态:', isLoggedIn.value);
  console.log('条件检查:', newProcessId, newProcessId !== oldProcessId, isLoggedIn.value);
  
  if (newProcessId && newProcessId !== oldProcessId && isLoggedIn.value) {
    console.log(`进程ID发生变化，从 ${oldProcessId} 变为 ${newProcessId}`);
    console.log('立即加载新进程的数据...');
    
    try {
      // 加载新进程的初始数据（60秒时间戳）
      const data = await loadGraphDataFromAPI(newProcessId, 60);
      
      if (data?.nodes?.length) {
        // 清除当前实体并重新创建
        viewer().entities.removeAll();
        createEntities(data);
        addRoadmLinks(data);
        setPreviousFrameData(data);
        currentGraphData = data;
        updateVisibility();
        
        // 更新ObjectViewer的数据
        if (objectViewerRef.value) {
          objectViewerRef.value.updateData(data);
        }
        
        console.log('新进程数据加载完成');
      } else {
        console.warn('API返回的数据为空或格式不正确');
      }
    } catch (error) {
      console.error('加载新进程数据失败:', error);
    }
  } else {
    console.log('不满足数据加载条件，跳过加载');
  }
}, { immediate: false });

// 监听登录状态变化
watch(isLoggedIn, async (newLoginStatus) => {
  if (newLoginStatus) {
    console.log('用户登录成功，检查是否有缓存的进程ID');
    const cachedProcessId = selectedProcessId.value || localStorage.getItem('selectedProcessId');
    
    if (cachedProcessId) {
      console.log(`发现缓存的进程ID: ${cachedProcessId}，立即加载数据`);
      try {
        const data = await loadGraphDataFromAPI(cachedProcessId, 60);
        
        if (data?.nodes?.length) {
          viewer().entities.removeAll();
          createEntities(data);
          addRoadmLinks(data);
          setPreviousFrameData(data);
          currentGraphData = data;
          updateVisibility();
          
          if (objectViewerRef.value) {
            objectViewerRef.value.updateData(data);
          }
          
          console.log('登录后数据加载完成');
        }
      } catch (error) {
        console.error('登录后加载数据失败:', error);
      }
    }
  } else {
    // 用户登出时清空数据
    console.log('用户登出，清空场景数据');
    viewer().entities.removeAll();
    currentGraphData = null;
    if (objectViewerRef.value) {
      objectViewerRef.value.updateData({ nodes: [], edges: [] });
    }
  }
}, { immediate: false });

async function loadTimeFrame(frame) {
  console.log(`加载时间帧: ${frame}分钟`);
  
  try {
    timeFrame.value = frame;
    
    // 检查登录状态
    if (!isLoggedIn.value) {
      console.warn('用户未登录，无法加载数据');
      return;
    }
    
    // 获取当前选择的进程ID
    const currentProcessId = selectedProcessId.value || localStorage.getItem('selectedProcessId');
    
    if (!currentProcessId) {
      console.warn('没有选择进程ID，无法加载数据');
      return;
    }
    
    // 使用API加载数据
    console.log(`使用API加载数据，进程ID: ${currentProcessId}, 时间戳: ${frame * 60}`);
    
    const [networkData, serviceDataResult] = await Promise.all([
      loadGraphDataFromAPI(currentProcessId, frame * 60),
      loadServiceData(frame)
    ]);
    
    if (!networkData) {
      console.error('API网络数据加载失败');
      return;
    }
    
    console.log('API网络数据加载成功:', networkData);
    console.log('业务数据加载成功:', serviceDataResult);
    
    currentGraphData = networkData;
    processNetworkData(networkData);
    
  } catch (error) {
    console.error(`加载时间帧失败:`, error);
  }
}

// 处理网络数据的通用函数
function processNetworkData(networkData) {
  if (getPreviousFrameData() === null) {
    viewer().entities.removeAll();
    createEntities(networkData);
    addRoadmLinks(networkData);
    
    setPreviousFrameData(networkData);
    updateVisibility();
    
    // 更新ObjectViewer的数据
    if (objectViewerRef.value) {
      objectViewerRef.value.updateData(networkData);
    }
    return;
  }
  
  animateTransition(viewer(), getPreviousFrameData(), networkData, (satelliteIds) => {
    // 动画完成回调
    console.log('动画完成，更新的卫星:', satelliteIds);
    // 更新ObjectViewer的数据
    if (objectViewerRef.value) {
      objectViewerRef.value.updateData(networkData);
    }
  });
  
  // 预加载下一帧数据的逻辑可以根据需要添加
}

function handleSatelliteClick(entityId) {
  // 处理实体点击，包括选中效果和高亮链接
  handleEntitySelect(entityId);
}

function handleEntitySelect(entityId) {
  console.log('选择了实体:', entityId);
  // 处理实体选择逻辑
  if (currentGraphData) {
    // 首先尝试在节点中查找
    let entity = currentGraphData.nodes.find(node => node.id === entityId);
    
    // 如果在节点中没找到，尝试在链路中查找
    if (!entity && entityId.includes('-')) {
      const [source, target] = entityId.split('-');
      entity = currentGraphData.edges.find(edge => 
        (edge.source === source && edge.target === target) ||
        (`${edge.source}-${edge.target}` === entityId)
      );
      // 为链路添加类型信息
      if (entity) {
        entity = { ...entity, type: 'link', id: entityId };
      }
    }
    
    if (entity) {
      // 如果有业务详情面板打开，先关闭它
      if (selectedService.value) {
        closeServiceDetail();
      }
      
      selectedEntity.value = entity;
      selectedEntityRawData.value = currentGraphData;
      showRightPanel.value = true; // 选择实体时展开右侧面板
      
      if (entity.type === 'satellite') {
        highlightSatelliteLinks(entityId, currentGraphData);
      }
      
      // 更新选择指示器
      updateSelectionIndicator();
    }
  }
}

// 侧边栏控制函数
function handleLeftPanelClose() {
  showLeftPanel.value = false;
}

function handleRightPanelClose() {
  showRightPanel.value = false;
  // 关闭右侧面板时清除选择
  selectedEntity.value = null;
  selectedEntityRawData.value = null;
  selectionIndicatorStyle.value = { display: 'none' };
}

function handleBottomPanelClose() {
  showBottomPanel.value = false;
}

function handleServiceDataUpdate(newServiceData) {
  console.log('更新业务数据:', newServiceData);
  
  // 更新serviceData对象
  Object.assign(serviceData.value, newServiceData);
  
  // 触发响应式更新
  serviceData.value = { ...serviceData.value };
  
  console.log('业务数据已更新');
}

function reopenLeftPanel() {
  showLeftPanel.value = true;
}

function reopenRightPanel() {
  showRightPanel.value = true;
}

function reopenBottomPanel() {
  showBottomPanel.value = true;
}

function highlightEntity(entityId) {
  if (!currentGraphData) return null;
  
  // 查找实体信息
  const entity = currentGraphData.nodes.find(node => node.id === entityId);
  
  if (entity) {
    // 高亮显示链接
    if (entity.type === 'satellite') {
      highlightSatelliteLinks(entityId, currentGraphData);
    }
    
    // 返回实体信息
    return {
      entity,
      rawData: currentGraphData
    };
  }
  
  return null;
}

function handleVisibilityChange(type, checked) {
  switch(type) {
    case 'satellite':
      showSatellite.value = checked;
      break;
    case 'station':
      showStation.value = checked;
      break;
    case 'roadm':
      showRoadm.value = checked;
      break;
  }
  updateVisibility();
}

// 包装 selectService 函数，在选择业务时关闭实体信息面板
function handleSelectService(service, type) {
  // 关闭实体信息面板
  showRightPanel.value = false;
  selectedEntity.value = null;
  selectedEntityRawData.value = null;
  selectionIndicatorStyle.value = { display: 'none' };
  
  // 选择业务
  selectService(service, type);
}

// 包装 closeServiceDetail 函数，关闭业务详情时恢复实体信息面板
function handleCloseServiceDetail() {
  closeServiceDetail();
  
  // 如果有选中的实体，重新打开右侧面板
  if (selectedEntity.value) {
    showRightPanel.value = true;
  }
}

onMounted(async () => {
  try {
    console.log('=== SatelliteViewer 初始化 ===');
    console.log('初始化Cesium...');
    console.log('当前登录状态:', isLoggedIn.value, '用户名:', username.value);
    console.log('当前选择的进程ID:', selectedProcessId.value);
    console.log('localStorage中的进程ID:', localStorage.getItem('selectedProcessId'));
    
    const cesiumViewer = initializeCesium("cesiumContainer");
    setupClickHandler(handleSatelliteClick);
    updateVisibility();
    
    // 添加相机移动监听器以更新选择指示器位置
    viewer().scene.postRender.addEventListener(updateSelectionIndicator);
    
    console.log('Cesium初始化完成，等待用户选择进程');
    
    // 定期检查进程ID变化（调试用）
    const debugInterval = setInterval(() => {
      const currentId = selectedProcessId.value;
      const localStorageId = localStorage.getItem('selectedProcessId');
      if (currentId || localStorageId) {
        console.log('定期检查 - 当前进程ID:', currentId, '本地存储:', localStorageId);
        clearInterval(debugInterval);
      }
    }, 2000);
    
  } catch (err) {
    console.error("初始化失败:", err);
  }
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupCesium();
});

// 暴露方法给父组件
defineExpose({
  highlightEntity
});
</script>

<style scoped>
.satellite-viewer-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
}

.main-content {
  display: flex;
  flex: 1;
  height: calc(100vh - 109px); /* 导航栏总高度: 28px + 80px + 1px边框 = 109px */
  overflow: hidden;
  position: relative;
}

#cesiumContainer {
  flex: 1;
  width: 100%;
  position: relative;
  min-width: 0; /* 防止flex项目收缩问题 */
  height: 100%;
  overflow: hidden;
}

/* 自定义选择指示器样式 */
.custom-selection-indicator {
  position: absolute;
  border: 2px solid #00ff00;
  border-radius: 4px;
  background: transparent;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
  }
  50% {
    box-shadow: 0 0 12px rgba(0, 255, 0, 0.8);
  }
  100% {
    box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
  }
}

/* 右侧面板容器 */
.right-panel-container {
  position: relative;
  height: 100%;
  min-width: 300px;
  max-width: 350px;
  background: transparent;
}
</style>
