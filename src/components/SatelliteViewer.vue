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
      <div class="right-panel-container" v-if="selectedService || showRightPanel || showDataPanel">
        <!-- 图表面板 -->
        <ChartPanel 
          v-if="showDataPanel"
          ref="chartPanelRef"
          :selected-data="selectedSimulationData"
          :current-frame-data="currentGraphData"
          :time-frame="timeFrame"
          @close="handleChartPanelClose"
        />
        <!-- 业务详情面板 -->
        <ServiceDetail 
          v-else-if="selectedService"
          :selected-service="selectedService"
          @close="handleCloseServiceDetail"
        />
        <!-- 实体信息面板 -->
        <EntityInfoPanel 
          v-else-if="showRightPanel"
          :selectedEntity="selectedEntity" 
          :graphData="selectedEntityRawData"
          :service-data="serviceData"
          @close="handleRightPanelClose" 
        />
      </div>
      
      <RightCollapsedSidebar 
        v-show="!showRightPanel && !selectedService && !showDataPanel" 
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
import ChartPanel from './ChartPanel.vue';


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
const chartPanelRef = ref(null);

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
  
  // 关闭其他面板，确保图表面板独占右侧
  showRightPanel.value = false;
  selectedEntity.value = null;
  selectedEntityRawData.value = null;
  
  // 如果有业务详情面板打开，也关闭它
  if (selectedService.value) {
    closeServiceDetail();
  }
}

// 处理图表面板关闭
function handleChartPanelClose() {
  showDataPanel.value = false;
  console.log('图表面板已关闭');
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
  let cesiumEntity = null;
  if (viewer() && viewer().entities) {
    cesiumEntity = viewer().entities.getById(selectedEntity.value.id);
  }
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
  resetClockRange,
  cleanup: cleanupCesium
} = useCesium();

const { 
  nodeCount, 
  linkCount, 
  loadGraphData,
  loadGraphDataFromAPI,
  dataCache,
  clearCache,
  getCacheInfo,
  setDataFolder,
  getCurrentDataFolder,
  restoreDataFolderSetting,
  selectedDataFolder
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
        if (viewer() && viewer().entities) {
          viewer().entities.removeAll();
        }
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
          if (viewer() && viewer().entities) {
            viewer().entities.removeAll();
          }
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
        const currentFolder = getCurrentDataFolder();
        const filename = `./data/${currentFolder}/network_state_${defaultFrame * 60}.00.json`;
        const networkData = await loadGraphData(filename);
        
        if (networkData) {
          console.log('登出后本地数据加载成功');
          if (viewer() && viewer().entities) {
            viewer().entities.removeAll();
          }
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
        if (viewer() && viewer().entities) {
          viewer().entities.removeAll();
        }
        currentGraphData = null;
        if (objectViewerRef.value) {
          objectViewerRef.value.updateData({ nodes: [], edges: [] });
        }
      }
    } catch (error) {
      console.error('登出后加载本地数据失败:', error);
      // 加载失败时清空数据
      if (viewer() && viewer().entities) {
        viewer().entities.removeAll();
      }
      currentGraphData = null;
      if (objectViewerRef.value) {
        objectViewerRef.value.updateData({ nodes: [], edges: [] });
      }
    }
  }
}, { immediate: false });

async function loadTimeFrame(frame) {
  console.log(`强制加载帧: ${frame}`);
  
  try {
    timeFrame.value = frame;
    
    // 检查登录状态
    if (!isLoggedIn.value) {
      console.log('用户未登录，从本地文件强制加载数据');
      
      // 检查是否已选择文件夹
      const currentFolder = getCurrentDataFolder();
      if (!currentFolder) {
        console.warn('未选择数据文件夹，无法加载数据');
        return;
      }
      
      // 根据文件夹类型确定时间间隔和文件命名规则
      let timeInterval, fileTimeValue;
      
      if (currentFolder === 'new') {
        timeInterval = 10; // new文件夹：每10秒一帧
        // 计算实际的文件时间值：(帧数-1) * 间隔 + 间隔
        fileTimeValue = (frame - 1) * 10 + 10;
      } else {
        timeInterval = 60; // old文件夹：每60秒一帧
        // 计算实际的文件时间值：(帧数-1) * 间隔 + 间隔
        fileTimeValue = (frame - 1) * 60 + 60;
      }
      
      // 直接构建文件名，不依赖时间计算
      const filename = `./data/${currentFolder}/network_state_${fileTimeValue}.00.json`;
      console.log(`强制加载文件: ${filename} (文件夹: ${currentFolder}, 帧索引: ${frame}, 文件时间值: ${fileTimeValue}秒)`);
      
      try {
        const networkData = await loadGraphData(filename);
        
        if (networkData) {
          console.log('本地网络数据加载成功:', networkData);
          currentGraphData = networkData;
          processNetworkData(networkData);
          
          // 如果图表面板是打开的，更新图表数据
          if (showDataPanel.value && chartPanelRef.value) {
            chartPanelRef.value.addDataPoint(frame, networkData);
          }
          
          // 同时尝试加载业务数据
          try {
            const serviceDataResult = await loadServiceData(frame);
            console.log('本地业务数据加载成功:', serviceDataResult);
            
            // 更新ObjectViewer中的文件显示
            const networkFileName = filename.split('/').pop();
            const serviceFileName = `service_state_${fileTimeValue}.00.json`;
            if (objectViewerRef.value) {
              objectViewerRef.value.updateLoadedFiles(networkFileName, serviceFileName);
            }
          } catch (serviceError) {
            console.warn('本地业务数据加载失败:', serviceError);
            
            // 即使业务数据加载失败，也更新网络文件显示
            const networkFileName = filename.split('/').pop();
            if (objectViewerRef.value) {
              objectViewerRef.value.updateLoadedFiles(networkFileName, '加载失败');
            }
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
    
    // 使用API加载数据，直接基于帧数计算时间戳
    const timeStamp = frame * 60; // API使用60秒间隔
    console.log(`使用API强制加载数据，进程ID: ${currentProcessId}, 帧: ${frame}, 时间戳: ${timeStamp}`);
    
    const [networkData, serviceDataResult] = await Promise.all([
      loadGraphDataFromAPI(currentProcessId, timeStamp),
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
    
    // 如果图表面板是打开的，更新图表数据
    if (showDataPanel.value && chartPanelRef.value) {
      chartPanelRef.value.addDataPoint(frame, networkData);
    }
    
  } catch (error) {
    console.error(`加载时间帧失败:`, error);
  }
}

// 处理网络数据的通用函数
function processNetworkData(networkData) {
  console.log('processNetworkData 开始处理数据:', networkData);
  
  // 检查viewer是否可用
  if (!viewer() || !viewer().entities) {
    console.warn('Cesium viewer未准备好，跳过数据处理');
    return;
  }
  
  console.log('Cesium viewer可用，当前实体数量:', viewer().entities.values.length);
  
  // 更新业务数据的网络数据引用，并传递viewer
  updateNetworkDataAndRedraw(networkData, viewer());
  
  if (getPreviousFrameData() === null) {
    console.log('这是第一帧数据，清空现有实体并创建新实体');
    viewer().entities.removeAll();
    console.log('已清空所有实体，开始创建新实体...');
    
    createEntities(networkData);
    console.log('实体创建完成，当前实体数量:', viewer().entities.values.length);
    
    addRoadmLinks(networkData);
    console.log('链路创建完成，最终实体数量:', viewer().entities.values.length);
    
    setPreviousFrameData(networkData);
    updateVisibility();
    
    // 更新ObjectViewer的数据
    if (objectViewerRef.value) {
      objectViewerRef.value.updateData(networkData);
    }
    return;
  }
  
  console.log('这不是第一帧，执行动画过渡');
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
    
    // 恢复数据文件夹设置
    restoreDataFolderSetting();
    console.log('当前数据文件夹:', getCurrentDataFolder());
    
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
      console.log(`时间轴控制：切换到帧 ${frame}, 当前播放状态: ${isPlaying.value}`);
      
      // 在初始设置阶段忽略时间轴变化
      if (isInitialSetup) {
        console.log('初始设置阶段，忽略时间轴变化');
        return;
      }
      
      // 只有当帧数真正改变时才处理
      if (frame !== timeFrame.value) {
        isTimelineControlled = true;
        timeFrame.value = frame;
        
        // 如果正在播放，不立即加载帧（让播放循环处理）
        // 如果暂停中，立即加载帧
        if (!isPlaying.value) {
          console.log('暂停状态下的时间轴控制，立即加载帧:', frame);
          loadTimeFrame(frame).then(() => {
            isTimelineControlled = false;
          });
        } else {
          console.log('播放状态下的时间轴控制，由播放循环处理');
          isTimelineControlled = false;
        }
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
    
    // 添加文件夹变更事件监听器
    const handleDataFolderChange = async (event) => {
      const { folderName, folderInfo } = event.detail;
      console.log(`数据文件夹已更改为: ${folderName}`, folderInfo);
      
      // 重置前一帧数据，确保新文件夹的第一帧被当作初始帧处理
      setPreviousFrameData(null);
      console.log('已重置前一帧数据，新文件夹的第一帧将创建新实体');
      
      // 更新useDataLoader中的文件夹设置
      setDataFolder(folderName);
      
      // 使用新的重置时钟函数，确保时间轴从第一帧开始
      resetClockRange(folderName);
      
      // 确保播放状态被重置
      if (isPlaying.value) {
        togglePlayback(loadTimeFrame); // 停止播放
      }
      
      // 重置时间帧到第一帧
      timeFrame.value = 1;
      
      // 手动跳转到第一帧，避免时间追赶
      setTimeout(() => {
        jumpToTimeFrame(1);
        console.log('已重置到第一帧');
      }, 300);
      
      // 如果当前是未登录状态，立即加载新文件夹的数据
      if (!isLoggedIn.value) {
        console.log('重新加载新文件夹的数据...');
        
        // 检查viewer是否可用
        if (!viewer() || !viewer().entities) {
          console.warn('Cesium viewer未准备好，延迟加载数据');
          setTimeout(async () => {
            try {
              const defaultFrame = 1;
              timeFrame.value = defaultFrame;
              await loadTimeFrame(defaultFrame);
            } catch (error) {
              console.error('延迟加载新文件夹数据失败:', error);
            }
          }, 1000);
          return;
        }
        
        // 清除当前场景
        try {
          if (viewer() && viewer().entities) {
            viewer().entities.removeAll();
          }
          currentGraphData = null;
          
          // 短暂延迟后加载新文件夹的第一帧数据
          setTimeout(async () => {
            try {
              const defaultFrame = 1;
              timeFrame.value = defaultFrame;
              await loadTimeFrame(defaultFrame);
              console.log('新文件夹数据加载完成');
            } catch (error) {
              console.error('加载新文件夹数据失败:', error);
            }
          }, 500); // 延迟500ms，确保时钟重置完成
          
        } catch (error) {
          console.error('加载新文件夹数据失败:', error);
        }
      }
    };
    
    window.addEventListener('data-folder-changed', handleDataFolderChange);
    window.currentHandleDataFolderChange = handleDataFolderChange;
    
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
    
    // 不再自动加载默认数据，等待用户选择文件夹
    if (!isLoggedIn.value) {
      console.log('用户未登录，等待用户选择数据文件夹...');
      // 移除自动加载逻辑，让用户主动选择文件夹
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
  
  // 清理文件夹变更事件监听器
  if (window.currentHandleDataFolderChange) {
    window.removeEventListener('data-folder-changed', window.currentHandleDataFolderChange);
    delete window.currentHandleDataFolderChange;
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
