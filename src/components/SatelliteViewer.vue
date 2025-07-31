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
        @select-entity="handleEntitySelect"
        @close="handleLeftPanelClose"
      />
      <LeftCollapsedSidebar 
        v-show="!showLeftPanel" 
        @reopen="reopenLeftPanel"
      />
      
      <!-- 中间Cesium容器 -->
      <div id="cesiumContainer">
        <ControlPanel 
          v-model:show-satellite="showSatellite"
          v-model:show-station="showStation"
          v-model:show-roadm="showRoadm"
          :is-playing="isPlaying"
          :time-frame="timeFrame"
          @toggle-playback="handleTogglePlayback"
        />

        <ServicePanel 
          v-show="showBottomPanel"
          :service-data="serviceData"
          :generate-service-id="generateServiceId"
          @select-service="selectService"
          @close="handleBottomPanelClose"
        />

        <BottomCollapsedSidebar 
          v-show="!showBottomPanel"
          @reopen="reopenBottomPanel"
        />

        <ServiceDetail 
          v-if="selectedService"
          :selected-service="selectedService"
          @close="closeServiceDetail"
        />

        <!-- 业务路径控制面板 -->
        <ServicePathPanel 
          :viewer="viewer()"
          :service-data="serviceData"
          :network-data="currentGraphData"
          :draw-service-path="drawServicePath"
          :clear-service-path="clearServicePath"
          :clear-all-service-paths="clearAllServicePaths"
          :draw-multiple-service-paths="drawMultipleServicePaths"
          @service-selected="handleServiceSelected"
        />
      </div>
      
      <!-- 右侧面板区域 -->
      <EntityInfoPanel 
        v-show="showRightPanel"
        :selectedEntity="selectedEntity" 
        :graphData="selectedEntityRawData"
        @close="handleRightPanelClose" 
      />
      <RightCollapsedSidebar 
        v-show="!showRightPanel && selectedEntity" 
        @reopen="reopenRightPanel"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, inject, ref } from 'vue';
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

const router = useRouter();

// 注入登录状态和方法
const isLoggedIn = inject('isLoggedIn', ref(false));
const username = inject('username', ref(''));
const isGuestMode = inject('isGuestMode', ref(false));
const authMethods = inject('authMethods', {});

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

// 初始化所有composables
const { 
  viewer, 
  showSatellite, 
  showStation, 
  showRoadm,
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
watch([showSatellite, showStation, showRoadm], () => {
  updateVisibility();
}, { deep: true });

async function loadTimeFrame(frame) {
  console.log(`加载时间帧: ${frame}分钟`);
  
  try {
    timeFrame.value = frame;
    
    // 同时加载网络数据和业务数据
    const networkFilename = `./data/network_state_${frame * 60}.00.json`;
    const serviceFilename = `./data/service_state_${frame * 60}.00.json`;
    
    console.log(`正在加载网络文件: ${networkFilename}`);
    console.log(`正在加载业务文件: ${serviceFilename}`);
    
    const [networkData, serviceDataResult] = await Promise.all([
      dataCache.has(networkFilename) ? 
        dataCache.get(networkFilename) : 
        loadGraphData(networkFilename),
      loadServiceData(frame)
    ]);
    
    if (!networkData) {
      console.error('网络数据加载失败');
      return;
    }
    
    console.log('网络数据加载成功:', networkData);
    console.log('业务数据加载成功:', serviceDataResult);
    
    currentGraphData = networkData;
    
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
    
    // 预加载下一帧数据
    const nextFrame = frame >= 5 ? 1 : frame + 1;
    const nextNetworkFilename = `./data/network_state_${nextFrame * 60}.00.json`;
    
    setTimeout(async () => {
      if (!dataCache.has(nextNetworkFilename)) {
        console.log(`预加载下一帧网络数据: ${nextFrame}分钟`);
        await loadGraphData(nextNetworkFilename);
      }
      
      console.log(`预加载下一帧业务数据: ${nextFrame}分钟`);
      await loadServiceData(nextFrame);
    }, 500);
    
  } catch (error) {
    console.error(`加载时间帧失败:`, error);
  }
}

function handleSatelliteClick(satelliteId) {
  highlightSatelliteLinks(satelliteId, currentGraphData);
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
      selectedEntity.value = entity;
      selectedEntityRawData.value = currentGraphData;
      showRightPanel.value = true; // 选择实体时展开右侧面板
      
      if (entity.type === 'satellite') {
        highlightSatelliteLinks(entityId, currentGraphData);
      }
    }
  }
}

// 侧边栏控制函数
function handleLeftPanelClose() {
  showLeftPanel.value = false;
}

function handleRightPanelClose() {
  showRightPanel.value = false;
}

function handleBottomPanelClose() {
  showBottomPanel.value = false;
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

function handleTogglePlayback() {
  togglePlayback(loadTimeFrame);
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

function handleServiceSelected(service) {
  console.log('从路径面板选择业务:', service);
  selectService(service, 'active');
  
  // 可选：绘制单个业务路径
  if (currentGraphData) {
    drawServicePath(viewer(), service, currentGraphData);
  }
}

onMounted(async () => {
  try {
    console.log('初始化Cesium和数据加载...');
    console.log('当前登录状态:', isLoggedIn.value, '用户名:', username.value);
    
    const cesiumViewer = initializeCesium("cesiumContainer");
    
    // 加载初始网络数据
    const data = await loadGraphData('./data/network_state_60.00.json');
    if (data?.nodes?.length) {
      createEntities(data);
      addRoadmLinks(data);
      setPreviousFrameData(data);
      currentGraphData = data;
    }
    
    setupClickHandler(handleSatelliteClick);
    updateVisibility();
    
    // 加载初始业务数据
    console.log('加载初始业务数据...');
    await loadServiceData(1);
    
    // 更新ObjectViewer的数据
    if (objectViewerRef.value && currentGraphData) {
      objectViewerRef.value.updateData(currentGraphData);
    }
    
    console.log('初始化完成');
    
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
</style>
