<template>
  <div class="satellite-viewer-container">
    <!-- 导航栏 -->
    <NavigationBar 
      @simulation-data-selected="handleDataSelection" 
      :isLoggedIn="isLoggedIn" 
      :username="username" 
      @logout="handleLogout"
      @login-success="handleLoginSuccess"
      @start-local-simulation="handleStartLocalSimulation"
      @pause-local-simulation="handlePauseLocalSimulation"
      :is-local-simulation-running="isPlaying"
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

  // 首先尝试从Cesium场景中获取实体的实时位置
  let position = null;
  
  // 查找Cesium场景中对应的实体
  const cesiumEntity = viewer().entities.getById(selectedEntity.value.id);
  if (cesiumEntity && cesiumEntity.position) {
    try {
      // 获取当前时间的实体位置（支持动画过程中的实时位置）
      const currentTime = viewer().clock.currentTime;
      if (typeof cesiumEntity.position.getValue === 'function') {
        // 如果position是一个Property（如CallbackProperty），获取当前时间的值
        position = cesiumEntity.position.getValue(currentTime);
      } else {
        // 如果position是静态的Cartesian3
        position = cesiumEntity.position;
      }
      
    } catch (error) {
      console.warn('获取Cesium实体位置失败:', error);
      position = null;
    }
  }
  
  // 如果无法从Cesium实体获取位置，回退到数据中的位置
  if (!position) {
    const entity = currentGraphData.nodes.find(node => node.id === selectedEntity.value.id);
    if (!entity) {
      selectionIndicatorStyle.value = { display: 'none' };
      return;
    }

    // 从数据中构建位置
    if (entity.type === 'satellite') {
      position = new Cesium.Cartesian3(
        parseFloat(entity.position[0]) * 1000,
        parseFloat(entity.position[1]) * 1000,
        parseFloat(entity.position[2]) * 1000
      );
      console.log(`选择指示器：使用卫星 ${selectedEntity.value.id} 的数据位置（回退）`);
    } else {
      position = Cesium.Cartesian3.fromDegrees(
        parseFloat(entity.position[0]),
        parseFloat(entity.position[1]),
        10
      );
    }
  }

  // 将3D位置转换为屏幕坐标
  try {
    const screenPosition = viewer().scene.cartesianToCanvasCoordinates(position);
    
    if (screenPosition) {
      // 检查屏幕坐标是否在有效范围内
      const canvas = viewer().scene.canvas;
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      
      if (screenPosition.x >= 0 && screenPosition.x <= canvasWidth &&
          screenPosition.y >= 0 && screenPosition.y <= canvasHeight) {
        selectionIndicatorStyle.value = {
          display: 'block',
          left: `${screenPosition.x - selectionIndicatorSize / 2}px`,
          top: `${screenPosition.y - selectionIndicatorSize / 2}px`,
          width: `${selectionIndicatorSize}px`,
          height: `${selectionIndicatorSize}px`
        };
      } else {
        // 实体在屏幕外，隐藏指示器
        selectionIndicatorStyle.value = { display: 'none' };
      }
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
  setupTimelineControl,
  setupTimelineStyles,
  debugTimelineElements,
  forceShowTimelineControls,
  adjustTimelinePosition,
  jumpToTimeFrame,
  setPlaybackRate,
  setTimelineAnimation,
  cleanup: cleanupCesium
} = useCesium();

const { 
  nodeCount, 
  linkCount, 
  loadGraphData,
  loadGraphDataFromAPI,
  dataCache,
  clearCache,
  getCacheInfo
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
  drawMultipleServicePaths,
  updateNetworkDataAndRedraw,
  clearServiceCache,
  getServiceCacheInfo
} = useServiceData();

// 提供 Cesium viewer 给子组件
provide('cesiumViewer', viewer);

const { 
  isPlaying,
  timeFrame,
  animationInProgress,
  instantMode,
  animateTransition,
  togglePlayback,
  cleanup: cleanupAnimation,
  setPreviousFrameData,
  getPreviousFrameData
} = useAnimation({
  setTimelineAnimation
});// 主要业务逻辑
let currentGraphData = null;

// 监听显示状态变化
watch([showSatellite, showStation, showRoadm, showLinks], () => {
  updateVisibility();
}, { deep: true });

// 本地仿真播放相关
function handleLocalPlayback() {
  if (!isLoggedIn.value) {
    // 未登录状态下，启动本地数据的顺序播放
    console.log('开始本地仿真播放');
    togglePlayback(loadTimeFrame);
  }
}

// 暴露给导航栏使用的方法
function toggleLocalSimulation() {
  if (!isLoggedIn.value) {
    handleLocalPlayback();
    return isPlaying.value;
  }
  return false;
}

// 处理开始本地仿真
function handleStartLocalSimulation() {
  if (!isLoggedIn.value) {
    console.log('开始本地仿真播放');
    togglePlayback(loadTimeFrame);
  }
}

// 处理暂停本地仿真
function handlePauseLocalSimulation() {
  if (!isLoggedIn.value) {
    console.log('暂停本地仿真播放');
    togglePlayback(loadTimeFrame);
  }
}

// 监听进程ID变化，当选择新进程时立即加载数据
watch(selectedProcessId, async (newProcessId, oldProcessId) => {
  console.log('=== 进程ID监听器触发 ===');
  console.log('新进程ID:', newProcessId);
  console.log('旧进程ID:', oldProcessId);
  console.log('登录状态:', isLoggedIn.value);
  console.log('条件检查:', newProcessId, newProcessId !== oldProcessId, isLoggedIn.value);
  
  if (newProcessId && newProcessId !== oldProcessId && isLoggedIn.value) {
    console.log(`进程ID发生变化，从 ${oldProcessId} 变为 ${newProcessId}`);
    console.log('清理旧进程的缓存数据...');
    
    // 清理缓存以防止内存占用过大
    clearCache();
    clearServiceCache();
    
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
    // 用户登出时切换到本地数据
    console.log('用户登出，切换到本地数据');
    
    // 清理API相关的缓存，但保留本地数据缓存
    console.log('清理API缓存，保留本地数据缓存...');
    // 可以选择部分清理或全部清理
    // clearCache(); // 如果要全部清理
    // clearServiceCache();
    
    try {
      // 加载默认的本地数据（60秒时间帧）
      const defaultFrame = 1; // 对应60秒
      const filename = `./data/network_state_${defaultFrame * 60}.00.json`;
      const networkData = await loadGraphData(filename);
      
      if (networkData) {
        console.log('登出后本地数据加载成功');
        viewer().entities.removeAll();
        createEntities(networkData);
        addRoadmLinks(networkData);
        setPreviousFrameData(networkData);
        currentGraphData = networkData;
        updateVisibility();
        
        if (objectViewerRef.value) {
          objectViewerRef.value.updateData(networkData);
        }
      } else {
        // 如果本地数据加载失败，才清空数据
        console.warn('登出后本地数据加载失败，清空场景');
        viewer().entities.removeAll();
        currentGraphData = null;
        if (objectViewerRef.value) {
          objectViewerRef.value.updateData({ nodes: [], edges: [] });
        }
      }
    } catch (error) {
      console.error('登出后加载本地数据失败:', error);
      // 加载失败时清空数据
      viewer().entities.removeAll();
      currentGraphData = null;
      if (objectViewerRef.value) {
        objectViewerRef.value.updateData({ nodes: [], edges: [] });
      }
    }
  }
}, { immediate: false });

async function loadTimeFrame(frame) {
  console.log(`加载时间帧: ${frame}分钟`);
  
  try {
    timeFrame.value = frame;
    
    // 检查登录状态
    if (!isLoggedIn.value) {
      console.log('用户未登录，尝试从本地文件加载数据');
      
      // 未登录时从本地加载数据
      try {
        const filename = `./data/network_state_${frame * 60}.00.json`;
        const networkData = await loadGraphData(filename);
        
        if (networkData) {
          console.log('本地网络数据加载成功:', networkData);
          currentGraphData = networkData;
          processNetworkData(networkData);
          
          // 同时尝试加载业务数据
          try {
            const serviceDataResult = await loadServiceData(frame);
            console.log('本地业务数据加载成功:', serviceDataResult);
          } catch (serviceError) {
            console.warn('本地业务数据加载失败:', serviceError);
          }
        } else {
          console.warn('本地网络数据加载失败');
        }
      } catch (error) {
        console.error('加载本地数据失败:', error);
      }
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
  // 更新业务数据的网络数据引用，并传递viewer
  updateNetworkDataAndRedraw(networkData, viewer());
  
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
    // 动画完成后再次更新网络数据以确保路径重绘
    updateNetworkDataAndRedraw(networkData, viewer());
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

// 调整时间轴位置的函数
// 调整时间轴位置，跟随业务面板
function adjustTimelinePositionForPanel() {
  if (!viewer()) return;
  
  console.log('开始调整时间轴位置...');
  
  // 首先运行调试
  debugTimelineElements();
  
  // 获取业务面板的高度和状态
  const servicePanel = document.querySelector('.service-panel') || 
                       document.querySelector('[class*="service"]') ||
                       document.querySelector('.bottom-panel');
  
  let bottomOffset = 10; // 默认偏移（最小化状态，减少间距）
  
  if (servicePanel) {
    const panelRect = servicePanel.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    console.log('业务面板信息:', {
      height: panelRect.height,
      top: panelRect.top,
      bottom: panelRect.bottom,
      viewportHeight
    });
    
    // 检查面板是否可见且有实际高度
    if (panelRect.height > 100 && panelRect.top < viewportHeight) {
      // 面板展开状态，紧贴面板顶部
      bottomOffset = viewportHeight - panelRect.top + 5; // 只留5px间距
      console.log(`业务面板展开，高度: ${panelRect.height}px, 调整时间轴偏移到: ${bottomOffset}px`);
    } else {
      // 面板最小化状态，紧贴底部
      bottomOffset = 10; // 只留10px间距
      console.log('业务面板最小化，时间轴偏移到: 10px');
    }
  }
  
  // 使用useCesium中的adjustTimelinePosition函数
  adjustTimelinePosition(bottomOffset);
  
  // 额外确保时间轴可见
  setTimeout(() => {
    forceShowTimelineControls();
    debugTimelineElements();
  }, 200);
}

onMounted(async () => {
  try {
    console.log('=== SatelliteViewer 初始化 ===');
    console.log('初始化Cesium...');
    console.log('当前登录状态:', isLoggedIn.value, '用户名:', username.value);
    console.log('当前选择的进程ID:', selectedProcessId.value);
    console.log('localStorage中的进程ID:', localStorage.getItem('selectedProcessId'));
    console.log('初始播放状态:', isPlaying.value);
    console.log('初始时间帧:', timeFrame.value);
    
    const cesiumViewer = initializeCesium("cesiumContainer");
    setupClickHandler(handleSatelliteClick);
    updateVisibility();
    
    // 添加播放状态监听器用于调试
    watch(isPlaying, (newValue, oldValue) => {
      console.log(`播放状态变化: ${oldValue} → ${newValue}`);
    });
    
    watch(timeFrame, (newValue, oldValue) => {
      console.log(`时间帧变化: ${oldValue} → ${newValue}`);
    });
    
    // 设置时间轴控制
    let isTimelineControlled = false; // 标记是否正在被时间轴控制
    let isInitialSetup = true; // 标记是否为初始设置阶段
    
    setupTimelineControl((frame) => {
      console.log(`时间轴控制：切换到帧 ${frame}`);
      
      // 在初始设置阶段忽略时间轴变化
      if (isInitialSetup) {
        console.log('初始设置阶段，忽略时间轴变化');
        return;
      }
      
      // 只有在非播放状态时才响应时间轴
      if (frame !== timeFrame.value && !isPlaying.value) {
        isTimelineControlled = true;
        timeFrame.value = frame; // 直接更新timeFrame而不触发loadTimeFrame
        loadTimeFrame(frame).then(() => {
          isTimelineControlled = false;
        });
      }
    });
    
    // 3秒后结束初始设置阶段
    setTimeout(() => {
      isInitialSetup = false;
      console.log('初始设置阶段结束，时间轴控制现在生效');
    }, 3000);
    
    // 启用瞬间模式以支持流畅的手动控制
    instantMode.value = false; // 改为false以显示动画效果
    console.log('已启用动画模式，支持流畅的时间轴拖拽');
    
    // 延迟调整时间轴位置，确保DOM元素已创建
    setTimeout(() => {
      console.log('开始初始化时间轴位置调整...');
      adjustTimelinePositionForPanel();
    }, 1000); // 增加延迟确保所有元素都已加载
    
    // 再次尝试，确保成功
    setTimeout(() => {
      console.log('第二次尝试时间轴位置调整...');
      adjustTimelinePositionForPanel();
    }, 2000);
    
    // 添加窗口调整大小监听器，动态调整时间轴位置
    const handleResize = () => {
      setTimeout(() => {
        adjustTimelinePositionForPanel();
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    
    // 暴露handleResize到外层作用域，以便在onUnmounted中访问
    window.currentHandleResize = handleResize;
    
    // 定期检查并修复时间轴显示
    const timelineCheckInterval = setInterval(() => {
      console.log('定期检查时间轴状态...');
      debugTimelineElements();
      forceShowTimelineControls();
      adjustTimelinePositionForPanel();
    }, 2000); // 每2秒检查一次
    
    // 存储定时器以便清理
    window.timelineCheckInterval = timelineCheckInterval;
    
    // 添加面板变化监听器（如果业务面板高度发生变化）
    const observeServicePanel = () => {
      const servicePanel = document.querySelector('.service-panel') || 
                           document.querySelector('[class*="service"]') ||
                           document.querySelector('.bottom-panel');
      if (servicePanel) {
        const observer = new MutationObserver(() => {
          setTimeout(() => {
            adjustTimelinePositionForPanel();
          }, 100);
        });
        observer.observe(servicePanel, { 
          attributes: true, 
          attributeFilter: ['style', 'class'],
          childList: true,
          subtree: true
        });
        // 存储observer以便后续清理
        window.servicePanelObserver = observer;
      }
    };
    
    setTimeout(observeServicePanel, 2000); // 延迟观察，确保面板已创建
    
    // 添加相机移动监听器以更新选择指示器位置
    viewer().scene.postRender.addEventListener(updateSelectionIndicator);
    
    console.log('Cesium初始化完成，时间轴控制已启用');
    
    // 如果用户未登录，尝试加载默认的本地数据以提供初始显示
    if (!isLoggedIn.value) {
      console.log('用户未登录，尝试加载默认本地数据...');
      try {
        const defaultFrame = 1; // 对应60秒
        const filename = `./data/network_state_${defaultFrame * 60}.00.json`;
        const networkData = await loadGraphData(filename);
        
        if (networkData) {
          console.log('默认本地数据加载成功');
          createEntities(networkData);
          addRoadmLinks(networkData);
          setPreviousFrameData(networkData);
          currentGraphData = networkData;
          updateVisibility();
          
          if (objectViewerRef.value) {
            objectViewerRef.value.updateData(networkData);
          }
        }
      } catch (error) {
        console.log('默认本地数据加载失败，等待用户操作:', error);
      }
    } else {
      console.log('用户已登录，等待用户选择进程');
    }
    
    // 定期检查进程ID变化（调试用）
    const debugInterval = setInterval(() => {
      const currentId = selectedProcessId.value;
      const localStorageId = localStorage.getItem('selectedProcessId');
      if (currentId || localStorageId) {
        console.log('定期检查 - 当前进程ID:', currentId, '本地存储:', localStorageId);
        clearInterval(debugInterval);
      }
    }, 2000);
    
    // 存储调试定时器以便清理
    window.debugInterval = debugInterval;
    
    // 添加全局缓存调试功能
    window.debugCache = () => {
      const networkCache = getCacheInfo();
      const serviceCache = getServiceCacheInfo();
      console.log('=== 缓存状态调试 ===');
      console.log('网络数据缓存:', networkCache);
      console.log('业务数据缓存:', serviceCache);
      console.log('总缓存项目数:', networkCache.size + serviceCache.size);
    };
    
    window.clearAllCache = () => {
      clearCache();
      clearServiceCache();
      console.log('所有缓存已清理');
    };
    
    console.log('缓存调试功能已添加：');
    console.log('- 使用 window.debugCache() 查看缓存状态');
    console.log('- 使用 window.clearAllCache() 清理所有缓存');
    
  } catch (err) {
    console.error("初始化失败:", err);
  }
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupCesium();
  
  // 清理窗口调整大小监听器
  if (window.currentHandleResize) {
    window.removeEventListener('resize', window.currentHandleResize);
    delete window.currentHandleResize;
  }
  
  // 清理时间轴检查定时器
  if (window.timelineCheckInterval) {
    clearInterval(window.timelineCheckInterval);
    delete window.timelineCheckInterval;
  }
  
  // 清理调试定时器
  if (window.debugInterval) {
    clearInterval(window.debugInterval);
    delete window.debugInterval;
  }
  
  // 清理面板观察器
  if (window.servicePanelObserver) {
    window.servicePanelObserver.disconnect();
    delete window.servicePanelObserver;
  }
  
  // 清理postRender事件监听器
  if (viewer() && viewer().scene) {
    try {
      viewer().scene.postRender.removeEventListener(updateSelectionIndicator);
    } catch (error) {
      console.warn('清理postRender监听器时出错:', error);
    }
  }
  
  console.log('SatelliteViewer 组件资源清理完成');
});

// 暴露方法给父组件
defineExpose({
  highlightEntity,
  toggleLocalSimulation,
  isPlaying: () => isPlaying.value
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

/* Cesium时间轴控件样式调整 */
:deep(.cesium-timeline-main) {
  bottom: 180px !important;
  z-index: 1000 !important;
}

:deep(.cesium-animation-container) {
  bottom: 180px !important;
  z-index: 1000 !important;
}

/* 确保时间轴在业务面板上方 */
:deep(.cesium-viewer-toolbar) {
  z-index: 1001 !important;
}

:deep(.cesium-timeline-bar) {
  background: rgba(42, 42, 42, 0.8) !important;
  border: 1px solid #555 !important;
  border-radius: 3px !important;
}

:deep(.cesium-animation-widget) {
  background: rgba(42, 42, 42, 0.8) !important;
  border: 1px solid #555 !important;
  border-radius: 3px !important;
}
</style>
