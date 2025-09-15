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
      @stop-simulation="handleStopSimulation"
      @increase-speed="handleIncreaseSpeed"
      @decrease-speed="handleDecreaseSpeed"
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
        <!-- 播放速度显示 -->
        <div class="speed-display-panel">
          <div class="current-speed">{{ playbackSpeed }}x</div>
        </div>
        
        <!-- 自定义选择指示器 -->
        <div 
          v-if="selectedEntity" 
          class="custom-selection-indicator"
          :style="selectionIndicatorStyle"
        ></div>
        
        <!-- 节点跳转输入框 -->
        <NodeJumpInput 
          :network-data="currentGraphData"
          @node-selected="handleEntitySelect"
          @time-changed="handleTimeJump"
        />
        
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
import { onMounted, onUnmounted, watch, inject, ref, provide, nextTick } from 'vue';
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
import NodeJumpInput from './NodeJumpInput.vue';
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
const showDataPanel = ref(false); // 默认不显示，只有用户选择后才显示
const selectedSimulationData = ref({
  averageLatency: true,     // 显示平均延迟图表
  bandwidthUtil: true,      // 显示带宽利用率图表
  hopCounts: true          // 显示平均跳数图表
});
const showObjectViewer = ref(true);
const objectViewerRef = ref(null);
const chartPanelRef = ref(null);

// 帧跳跃距离检测变量
let lastProcessedFrame = null; // 跟踪上一次处理的帧号，用于检测大跨度跳跃

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
  setTimelinePosition,
  jumpToTimeFrame,
  setPlaybackRate,
  setTimelineAnimation,
  resetClockRange,
  cleanup: cleanupCesium,
  parseFolderName
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

// 播放速度控制
const playbackSpeed = ref(1); // 当前播放速度
const speedOptions = [0.25, 0.5, 1, 2, 4]; // 可选速度，最大4倍

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
}, () => playbackSpeed.value); // 传入播放速度获取函数

// 增加播放速度
function increaseSpeed() {
  const currentIndex = speedOptions.indexOf(playbackSpeed.value);
  if (currentIndex < speedOptions.length - 1) {
    const oldSpeed = playbackSpeed.value;
    playbackSpeed.value = speedOptions[currentIndex + 1];
    setPlaybackRate(playbackSpeed.value);
    console.log(`播放速度从 ${oldSpeed}x 增加到: ${playbackSpeed.value}x`);
    
    // 如果当前正在播放，立即应用新速度到Cesium时钟
    if (isPlaying.value && viewer()) {
      viewer().clock.multiplier = playbackSpeed.value;
      console.log(`已应用Cesium时钟倍率: ${playbackSpeed.value}x`);
    }
    
    // 速度变化会在下一次播放循环时自动生效（通过getPlaybackSpeed函数）
  } else {
    console.log(`已达到最大播放速度: ${playbackSpeed.value}x`);
  }
}

// 减少播放速度
function decreaseSpeed() {
  const currentIndex = speedOptions.indexOf(playbackSpeed.value);
  if (currentIndex > 0) {
    const oldSpeed = playbackSpeed.value;
    playbackSpeed.value = speedOptions[currentIndex - 1];
    setPlaybackRate(playbackSpeed.value);
    console.log(`播放速度从 ${oldSpeed}x 减少到: ${playbackSpeed.value}x`);
    
    // 如果当前正在播放，立即应用新速度到Cesium时钟
    if (isPlaying.value && viewer()) {
      viewer().clock.multiplier = playbackSpeed.value;
      console.log(`已应用Cesium时钟倍率: ${playbackSpeed.value}x`);
    }
    
    // 速度变化会在下一次播放循环时自动生效（通过getPlaybackSpeed函数）
  } else {
    console.log(`已达到最小播放速度: ${playbackSpeed.value}x`);
  }
}

// 重置播放速度
function resetSpeed() {
  playbackSpeed.value = 1;
  setPlaybackRate(1);
  console.log('播放速度重置到: 1x');
  
  // 如果当前正在播放，立即应用新速度到Cesium时钟
  if (isPlaying.value && viewer()) {
    viewer().clock.multiplier = 1;
  }
  
  // 速度变化会在下一次播放循环时自动生效（通过getPlaybackSpeed函数）
}

// 处理navigation-bar的播放速度事件
function handleIncreaseSpeed() {
  increaseSpeed();
}

function handleDecreaseSpeed() {
  decreaseSpeed();
}

// 主要业务逻辑
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
    togglePlayback(loadTimeFrame, viewer());
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
    togglePlayback(loadTimeFrame, viewer());
  }
}

// 处理暂停本地仿真
function handlePauseLocalSimulation() {
  if (!isLoggedIn.value) {
    console.log('暂停本地仿真播放');
    togglePlayback(loadTimeFrame, viewer());
  }
}

// 处理停止仿真 - 清除所有缓存和状态
function handleStopSimulation() {
  console.log('=== SatelliteViewer: 处理停止仿真 ===');
  
  try {
    // 1. 停止当前正在进行的动画和播放
    if (!isLoggedIn.value) {
      // 停止本地仿真播放
      console.log('停止本地仿真播放');
      if (isPlaying.value) {
        togglePlayback(loadTimeFrame, viewer());
      }
    }
    
    // 2. 重置播放状态
    isPlaying.value = false;
    timeFrame.value = 1;
    playbackSpeed.value = 1;
    
    // 3. 清除所有缓存
    console.log('清除网络数据缓存...');
    clearCache();
    console.log('清除服务数据缓存...');  
    clearServiceCache();
    
    // 4. 重置所有数据状态
    currentGraphData.value = null;
    serviceData.value = null;
    selectedEntity.value = null;
    selectedService.value = null;
    selectedEntityRawData.value = null;
    
    // 5. 重置面板状态
    showRightPanel.value = false;
    showDataPanel.value = false;
    selectedSimulationData.value = {};
    
    // 6. 清除Cesium场景中的所有实体
    const cesiumViewer = viewer();
    if (cesiumViewer) {
      console.log('清除Cesium场景实体...');
      cesiumViewer.entities.removeAll();
      cesiumViewer.scene.primitives.removeAll();
      
      // 重置相机位置到默认视角
      cesiumViewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0.0, 0.0, 20000000.0)
      });
    }
    
    // 7. 重置实体显示状态
    showSatellite.value = true;
    showStation.value = true; 
    showRoadm.value = true;
    showLinks.value = true;
    
    console.log('SatelliteViewer: 停止仿真完成，所有状态已重置');
    
  } catch (error) {
    console.error('SatelliteViewer: 停止仿真时发生错误:', error);
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
      
      // 使用动态解析
      const config = parseFolderName(currentFolder);
      timeInterval = config.interval;
      // 计算实际的文件时间值：帧数 * 间隔
      fileTimeValue = frame * timeInterval;
      
      // 直接构建文件名，不依赖时间计算
      const filename = `./data/${currentFolder}/network_state_${fileTimeValue}.00.json`;
      console.log(`强制加载文件: ${filename} (文件夹: ${currentFolder}, 帧索引: ${frame}, 文件时间值: ${fileTimeValue}秒)`);
      
      try {
        let networkData = null;
        
        // 首先检查是否有预加载的数据
        if (window.preloadedFrame === frame && window.preloadedData) {
          console.log(`使用预加载的帧 ${frame} 数据`);
          networkData = window.preloadedData;
          // 清除预加载缓存
          window.preloadedData = null;
          window.preloadedFrame = null;
        } else {
          console.log(`实时加载帧 ${frame} 数据`);
          networkData = await loadGraphData(filename);
        }
        
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
    const config = parseFolderName(getCurrentDataFolder());
    const timeStamp = frame * config.interval; // 使用动态间隔
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
    
    // 初始化帧跟踪
    lastProcessedFrame = timeFrame.value;
    console.log(`初始化帧跟踪: ${lastProcessedFrame}`);
    
    // 更新ObjectViewer的数据
    if (objectViewerRef.value) {
      objectViewerRef.value.updateData(networkData);
    }
    return;
  }
  
  console.log('这不是第一帧，检查帧跳跃距离');
  
  // 检查帧跳跃距离，决定是否使用动画
  const currentFrame = timeFrame.value;
  const previousFrame = lastProcessedFrame || 1;
  const frameJumpDistance = Math.abs(currentFrame - previousFrame);
  
  console.log(`帧跳跃检测: 上一帧=${previousFrame}, 当前帧=${currentFrame}, 跳跃距离=${frameJumpDistance}`);
  
  // 定义跳跃阈值：如果跨越超过10个时间片，就不播放动画
  const FRAME_JUMP_THRESHOLD = 10;
  const shouldUseInstantMode = frameJumpDistance > FRAME_JUMP_THRESHOLD;
  
  if (shouldUseInstantMode) {
    console.log(`🚀 帧跳跃距离${frameJumpDistance}超过阈值${FRAME_JUMP_THRESHOLD}，启用瞬间模式避免穿越动画`);
    
    // 临时启用瞬间模式
    const wasInstantMode = instantMode.value;
    instantMode.value = true;
    
    // 执行瞬间切换动画
    animateTransition(viewer(), getPreviousFrameData(), networkData, (satelliteIds) => {
      // 动画完成回调
      console.log('瞬间切换完成，更新的卫星:', satelliteIds);
      
      // 恢复原来的模式
      instantMode.value = wasInstantMode;
      
      // 更新ObjectViewer的数据
      if (objectViewerRef.value) {
        objectViewerRef.value.updateData(networkData);
      }
      // 动画完成后再次更新网络数据以确保路径重绘
      updateNetworkDataAndRedraw(networkData, viewer());
    });
  } else {
    console.log(`帧跳跃距离${frameJumpDistance}在正常范围内，使用常规动画过渡`);
    
    // 执行常规动画过渡
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
  }
  
  // 更新上一次处理的帧号
  lastProcessedFrame = currentFrame;
  
  // 预加载下一帧数据的逻辑可以根据需要添加
}

function handleSatelliteClick(entityId) {
  // 处理实体点击，包括选中效果和高亮链接
  handleEntitySelect(entityId);
}

function handleEntitySelect(entityId) {
  try {
    console.log('选择了实体:', entityId);
    
    if (!entityId) {
      console.warn('选择实体: 提供的ID无效');
      return;
    }
    
    // 确保entityId是字符串类型
    const idStr = String(entityId);
    
    // 处理实体选择逻辑
    if (currentGraphData) {
      // 首先尝试在节点中查找
      let entity = currentGraphData.nodes.find(node => node.id === idStr);
    
      // 如果在节点中没找到，尝试在链路中查找
      if (!entity && idStr.includes('-')) {
        const [source, target] = idStr.split('-');
        entity = currentGraphData.edges.find(edge => 
          (edge.source === source && edge.target === target) ||
          (`${edge.source}-${edge.target}` === idStr)
        );
        // 为链路添加类型信息
        if (entity) {
          entity = { ...entity, type: 'link', id: idStr };
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
          highlightSatelliteLinks(idStr, currentGraphData);
        }
        
        // 更新选择指示器
        updateSelectionIndicator();
      }
    }
  } catch (error) {
    console.error('处理实体选择失败:', error);
  }
}

// 处理时间跳转
function handleTimeJump(frame) {
  try {
    console.log(`时间跳转到第${frame}帧`);
    
    // 确保帧是有效的数字
    const frameNumber = Number(frame);
    if (isNaN(frameNumber) || frameNumber < 1) {
      console.error('无效的帧数:', frame);
      return;
    }
    
    // 如果当前正在播放，先暂停
    if (isPlaying.value) {
      togglePlayback(loadTimeFrame, viewer());
    }
    
    // 验证帧数范围
    const currentFolder = getCurrentDataFolder();
    const config = parseFolderName(currentFolder);
    const maxFrames = config.totalFrames; // 完全依赖配置解析
    
    // 限制帧数在有效范围内
    const safeFrame = Math.min(Math.max(1, Math.round(frameNumber)), maxFrames);
    if (safeFrame !== frameNumber) {
      console.warn(`帧数已调整: ${frameNumber} → ${safeFrame} (文件夹: ${currentFolder}, 最大帧数: ${maxFrames})`);
    }
    
    // 强制加载指定帧
    loadTimeFrame(safeFrame);
  } catch (error) {
    console.error('时间跳转处理失败:', error);
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
  // 触发面板状态变化事件
  window.dispatchEvent(new CustomEvent('panel-state-changed', {
    detail: { type: 'bottom-panel', action: 'close' }
  }));
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
  // 触发面板状态变化事件
  window.dispatchEvent(new CustomEvent('panel-state-changed', {
    detail: { type: 'bottom-panel', action: 'open' }
  }));
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

// 调整时间轴位置的函数（已禁用，因为现在使用自定义时间轴）
function adjustTimelinePositionForPanel() {
  // 不再调整原生时间轴位置，因为已经隐藏了原生时间轴
  // console.log('时间轴位置调整已禁用（使用自定义时间轴）');
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
    
    // 检查是否为首次访问（没有用户主动选择过文件夹）
    const isFirstVisit = localStorage.getItem('hasUserSelectedFolder') !== 'true';
    if (isFirstVisit && !selectedProcessId.value) {
      console.log('首次访问：清除可能的默认文件夹设置');
      // 不清除localStorage，但确保ObjectViewer不显示默认信息
    }
    
    // 恢复数据文件夹设置
    restoreDataFolderSetting();
    console.log('当前数据文件夹:', getCurrentDataFolder());
    
    const cesiumViewer = initializeCesium("cesiumContainer");
    setupClickHandler(handleSatelliteClick);
    updateVisibility();
    
    // 关键修复：设置时间轴控制，传入数据加载回调
    setupTimelineControl((frame) => {
      console.log(`时间轴拖拽触发数据加载: 帧${frame}`);
      timeFrame.value = frame;
      
      // 拖拽时使用瞬间模式，避免动画插值导致的位置错误
      const wasInstantMode = instantMode.value;
      instantMode.value = true;
      
      loadTimeFrame(frame).then(() => {
        // 恢复原来的模式
        instantMode.value = wasInstantMode;
      });
    });
    
    // 添加播放状态监听器用于调试
    watch(isPlaying, (newValue, oldValue) => {
      console.log(`播放状态变化: ${oldValue} → ${newValue}`);
    });
    
    watch(timeFrame, (newValue, oldValue) => {
      console.log(`时间帧变化: ${oldValue} → ${newValue}`);
    });
    
    // 设置仿真时间轴控制
    let isTimelineControlled = false; // 标记是否正在被时间轴控制
    let isInitialSetup = true; // 标记是否为初始设置阶段
    
    // 监听自定义时间轴的帧切换事件（左侧时间跳转触发）
    const handleTimelineFrameChange = (event) => {
      const targetFrame = event.detail.frame;
      const forceUpdate = event.detail.forceUpdate === true;
      console.log(`🚀 左侧时间跳转到帧: ${targetFrame}, 强制更新: ${forceUpdate}`);
      
      // 即使在播放中也允许跳转
      if (targetFrame !== timeFrame.value || forceUpdate) {
        isTimelineControlled = true;
        timeFrame.value = targetFrame;
        
        // 同步更新Cesium时间轴位置
        if (viewer && viewer.forceSetFrame) {
          viewer.forceSetFrame(targetFrame);
        }
        
        // 手动更新自定义时间轴显示
        if (window.simulationTimelineControl) {
          window.simulationTimelineControl.updateFrame(targetFrame, targetFrame);
          console.log(`手动更新时间轴显示到帧 ${targetFrame}`);
        }
        
        // 跳转时使用瞬间模式，避免动画插值
        const wasInstantMode = instantMode.value;
        instantMode.value = true;
        
        loadTimeFrame(targetFrame).then(() => {
          isTimelineControlled = false;
          
          // 恢复原来的模式
          instantMode.value = wasInstantMode;
          
          // 如果是在播放状态下跳转，从新位置继续播放
          if (isPlaying.value) {
            console.log(`从帧 ${targetFrame} 继续播放`);
            // 确保Cesium时钟立即开始动画
            nextTick(() => {
              if (viewer && viewer.clock) {
                viewer.clock.shouldAnimate = true;
                // 确保时间轴控制知道仿真正在运行
                if (window.simulationTimelineControl) {
                  window.simulationTimelineControl.setSimulationRunning(true);
                }
              }
            });
          }
        });
      }
    };
    
    // 添加事件监听器
    window.addEventListener('timeline-frame-change', handleTimelineFrameChange);
    
    // 监听仿真播放状态变化，同步到时间轴
    watch(isPlaying, (newValue) => {
      if (window.simulationTimelineControl) {
        window.simulationTimelineControl.setSimulationRunning(newValue);
      }
    });
    
    // 监听时间帧变化，同步到时间轴
    watch(timeFrame, (newFrame, oldFrame) => {
      if (!isTimelineControlled && window.simulationTimelineControl) {
        // 仿真播放时，更新时间轴显示（包括最大运行帧）
        if (isPlaying.value) {
          window.simulationTimelineControl.updateFrame(newFrame, newFrame);
        } else {
          window.simulationTimelineControl.updateFrame(newFrame);
        }
        console.log(`时间轴同步更新: ${oldFrame} -> ${newFrame}`);
      }
    });
    
    // 3秒后结束初始设置阶段
    setTimeout(() => {
      isInitialSetup = false;
      console.log('初始设置阶段结束，仿真时间轴控制现在生效');
      
      // 根据当前数据文件夹设置时间轴总帧数
      const currentFolder = getCurrentDataFolder();
      if (window.simulationTimelineControl) {
        const config = parseFolderName(currentFolder);
        const totalFrames = config.totalFrames; // 完全依赖配置解析
        window.simulationTimelineControl.setTotalFrames(totalFrames);
        console.log(`时间轴设置完成：文件夹 ${currentFolder}，总帧数 ${totalFrames}`);
        
        // 初始化时间轴到第1帧
        window.simulationTimelineControl.updateFrame(timeFrame.value, timeFrame.value);
      }
    }, 3000);
    
    // 启用瞬间模式以支持流畅的手动控制
    instantMode.value = false; // 改为false以显示动画效果
    
    // 设置全局预加载函数，供动画系统调用
    window.preloadNextFrame = async (nextFrame) => {
      try {
        console.log(`开始预加载帧 ${nextFrame}`);
        
        // 检查是否已经预加载过这一帧
        if (window.preloadedFrame === nextFrame) {
          console.log(`帧 ${nextFrame} 已经预加载过，跳过`);
          return;
        }
        
        // 异步预加载数据，不阻塞当前动画
        const currentFolder = getCurrentDataFolder();
        if (!currentFolder) {
          console.warn('未选择数据文件夹，无法预加载');
          return;
        }
        
        // 计算预加载文件名
        const config = parseFolderName(currentFolder);
        const fileTimeValue = nextFrame * config.interval;
        const filename = `./data/${currentFolder}/network_state_${fileTimeValue}.00.json`;
        
        // 异步加载数据到缓存
        const networkData = await loadGraphData(filename);
        if (networkData) {
          window.preloadedData = networkData;
          window.preloadedFrame = nextFrame;
          console.log(`帧 ${nextFrame} 预加载完成`);
        } else {
          console.warn(`帧 ${nextFrame} 预加载失败`);
        }
      } catch (error) {
        console.error(`预加载帧 ${nextFrame} 出错:`, error);
      }
    };
    
    console.log('预加载系统已初始化');
    console.log('已启用动画模式，支持流畅的时间轴拖拽');
    
    // 强制显示时间轴控件（注释掉，因为现在要隐藏原生时间轴）
    // setTimeout(() => {
    //   console.log('强制显示时间轴控件...');
    //   forceShowTimelineControls();
    // }, 500);
    
    // 延迟调整时间轴位置，确保DOM元素已创建
    // 注意：已移除原生时间轴的强制显示和DOM监听器
    // 因为我们现在要隐藏原生时间轴，使用自定义时间轴控件
    
    // 已移除窗口大小调整和面板变化监听器，因为不再需要调整原生时间轴位置
    
    // 添加文件夹变更事件监听器
    const handleDataFolderChange = async (event) => {
      const { folderName, folderInfo } = event.detail;
      console.log(`数据文件夹已更改为: ${folderName}`, folderInfo);
      
      // 解析文件夹配置
      const config = parseFolderName(folderName);
      console.log('解析的文件夹配置:', config);
      
      // 重置前一帧数据，确保新文件夹的第一帧被当作初始帧处理
      setPreviousFrameData(null);
      console.log('已重置前一帧数据，新文件夹的第一帧将创建新实体');
      
      // 更新useDataLoader中的文件夹设置
      setDataFolder(folderName);
      
      // 使用新的重置时钟函数，确保时间轴从第一帧开始
      resetClockRange(folderName);
      
      // 重置仿真时间轴
      if (window.simulationTimelineControl) {
        window.simulationTimelineControl.reset();
        
        // 根据解析的配置设置总帧数
        window.simulationTimelineControl.setTotalFrames(config.totalFrames);
        console.log(`时间轴已重置并配置为${folderName}文件夹，总帧数: ${config.totalFrames}，时间间隔: ${config.interval}秒`);
      }
      
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
              
              // 更新时间轴显示
              if (window.simulationTimelineControl) {
                window.simulationTimelineControl.updateFrame(defaultFrame, defaultFrame);
              }
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
          
          // 加载新文件夹的默认数据（60秒时间帧）
          const defaultFrame = 1; // 对应60秒
          timeFrame.value = defaultFrame;
          await loadTimeFrame(defaultFrame);
          
          // 更新时间轴显示
          if (window.simulationTimelineControl) {
            window.simulationTimelineControl.updateFrame(defaultFrame, defaultFrame);
          }
        } catch (error) {
          console.error('加载新文件夹数据失败:', error);
        }
      }
    };
    
    window.addEventListener('data-folder-changed', handleDataFolderChange);
    window.currentHandleDataFolderChange = handleDataFolderChange;
    
    // 定期检查并修复时间轴显示 - 已禁用以减少后台日志
    // const timelineCheckInterval = setInterval(() => {
    //   console.log('定期检查时间轴状态...');
    //   
    //   // 检查时间轴是否可见
    //   const timelineElement = document.querySelector('.cesium-timeline-main');
    //   const animationElement = document.querySelector('.cesium-animation-container');
    //   
    //   if (!timelineElement || timelineElement.style.display === 'none' || 
    //       !animationElement || animationElement.style.display === 'none') {
    //     console.log('时间轴控件不可见，强制显示...');
    //     forceShowTimelineControls();
    //   }
    //   
    //   debugTimelineElements();
    //   adjustTimelinePositionForPanel();
    // }, 3000); // 每3秒检查一次
    
    // 存储定时器以便清理
    // window.timelineCheckInterval = timelineCheckInterval;
    
    // 注意：已移除面板变化监听器和定期检查
    // 因为不再需要调整原生时间轴位置
    
    // 添加相机移动监听器以更新选择指示器位置
    viewer().scene.postRender.addEventListener(updateSelectionIndicator);
    
    console.log('Cesium初始化完成，时间轴控制已启用');
    
    // 检查是否有已保存的文件夹设置，如果有则立即设置时钟范围
    const savedFolder = getCurrentDataFolder();
    if (savedFolder && savedFolder !== 'new') { // 'new'是默认值，说明没有真正选择过
      console.log(`检测到已保存的文件夹设置: ${savedFolder}，立即配置时钟范围`);
      resetClockRange(savedFolder);
    }
    
    // 不再自动加载默认数据，等待用户选择文件夹
    if (!isLoggedIn.value) {
      console.log('用户未登录，等待用户选择数据文件夹...');
      // 移除自动加载逻辑，让用户主动选择文件夹
    } else {
      console.log('用户已登录，等待用户选择进程');
    }
    
    // 定期检查进程ID变化（调试用）- 已禁用以减少后台日志
    // const debugInterval = setInterval(() => {
    //   const currentId = selectedProcessId.value;
    //   const localStorageId = localStorage.getItem('selectedProcessId');
    //   if (currentId || localStorageId) {
    //     console.log('定期检查 - 当前进程ID:', currentId, '本地存储:', localStorageId);
    //     clearInterval(debugInterval);
    //   }
    // }, 2000);
    
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
    
    // 临时调试：清除用户选择标记，模拟首次访问
    window.clearUserSelection = () => {
      localStorage.removeItem('hasUserSelectedFolder');
      localStorage.removeItem('selectedDataFolder');
      console.log('已清除用户选择标记，刷新页面查看效果');
    };
    
    // 检查是否有已保存的数据源，如果有则显示左侧面板
    const hasProcessId = selectedProcessId.value || localStorage.getItem('selectedProcessId');
    const userHasSelectedFolder = localStorage.getItem('hasUserSelectedFolder') === 'true';
    
    console.log('=== 数据源检查 ===');
    console.log('- localStorage.hasUserSelectedFolder:', localStorage.getItem('hasUserSelectedFolder'));
    console.log('- localStorage.selectedDataFolder:', localStorage.getItem('selectedDataFolder'));
    console.log('- hasProcessId:', hasProcessId);
    console.log('- userHasSelectedFolder:', userHasSelectedFolder);
    
    if (hasProcessId || userHasSelectedFolder) {
      showLeftPanel.value = true;
      console.log('检测到已保存的数据源，显示ObjectViewer面板');
      console.log('- 进程ID:', hasProcessId);
      console.log('- 用户主动选择文件夹:', userHasSelectedFolder);
    } else {
      console.log('未检测到数据源，ObjectViewer面板保持隐藏');
    }
    
    // 添加全局停止事件监听器
    window.addEventListener('simulation-stopped', () => {
      handleStopSimulation();
    });
    
    window.addEventListener('clear-all-animations', () => {
      handleStopSimulation();
    });
    
  } catch (err) {
    console.error("初始化失败:", err);
  }
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupCesium();
  
  // 清理时间轴帧切换事件监听器
  window.removeEventListener('timeline-frame-change', handleTimelineFrameChange);
  
  // 清理预加载系统
  if (window.preloadNextFrame) {
    delete window.preloadNextFrame;
  }
  if (window.preloadedData) {
    delete window.preloadedData;
  }
  if (window.preloadedFrame) {
    delete window.preloadedFrame;
  }
  console.log('预加载系统已清理');
  
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
  
  // 清理停止仿真事件监听器
  window.removeEventListener('simulation-stopped', handleStopSimulation);
  window.removeEventListener('clear-all-animations', handleStopSimulation);
  
  // 清理时间轴检查定时器
  if (window.timelineCheckInterval) {
    clearInterval(window.timelineCheckInterval);
    delete window.timelineCheckInterval;
  }
  
  // 清理面板观察器
  if (window.servicePanelObserver) {
    window.servicePanelObserver.disconnect();
    delete window.servicePanelObserver;
  }
  
  // 清理仿真时间轴
  const simulationTimeline = document.querySelector('.simulation-timeline');
  if (simulationTimeline) {
    simulationTimeline.remove();
  }
  
  // 清理全局时间轴控制对象
  if (window.simulationTimelineControl) {
    delete window.simulationTimelineControl;
  }
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

/* 播放速度控制面板 */
.speed-display-panel {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 8px 12px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.current-speed {
  color: #00ff88;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  background: rgba(0, 255, 136, 0.1);
  padding: 4px 8px;
  border-radius: 2px;
  border: 1px solid rgba(0, 255, 136, 0.3);
}

.speed-hint {
  color: #888;
  font-family: Arial, sans-serif;
  font-size: 10px;
  text-align: center;
  margin-top: 2px;
  opacity: 0.8;
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

/* Cesium时间轴控件样式调整 - 使用更高的优先级 */
:deep(.cesium-timeline-main) {
  display: block !important;
  visibility: visible !important;
  position: absolute !important;
  bottom: 30px !important;
  left: 10px !important;
  right: 5px !important;
  z-index: 10000 !important;
  height: 27px !important;
  background: rgba(42, 42, 42, 0.9) !important;
  border: 1px solid #666 !important;
  border-radius: 3px !important;
}

/* 确保时间轴在业务面板上方 */
:deep(.cesium-viewer-toolbar) {
  z-index: 10001 !important;
}

/* 添加更多时间轴相关选择器 - 全部使用高优先级 */
:deep(.cesium-timeline-container) {
  display: block !important;
  visibility: visible !important;
  position: absolute !important;
  bottom: 30px !important;
  left: 10px !important;
  right: 5px !important;
  z-index: 10000 !important;
  height: 27px !important;
}

:deep(.cesium-timeline-trackContainer) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  background: rgba(60, 60, 60, 0.8) !important;
  border: none !important;
}

:deep(.cesium-timeline-track) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  width: 100% !important;
  height: 20px !important;
  background: linear-gradient(to right, #444, #666) !important;
  border: 1px solid #888 !important;
  border-radius: 2px !important;
  margin: 3px 0 !important;
}

:deep(.cesium-timeline-bar) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  width: 100% !important;
  height: 20px !important;
  background: linear-gradient(to right, #444, #666) !important;
  border: 1px solid #888 !important;
  border-radius: 2px !important;
  margin: 3px 0 !important;
}

:deep(.cesium-timeline-needle) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: absolute !important;
  width: 2px !important;
  height: 100% !important;
  background: #00ff00 !important;
  z-index: 10001 !important;
  pointer-events: auto !important;
}

:deep(.cesium-timeline-ruler) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  width: 100% !important;
  height: 15px !important;
  background: rgba(80, 80, 80, 0.9) !important;
  border-top: 1px solid #999 !important;
  font-size: 10px !important;
  color: #ccc !important;
  z-index: 1 !important; /* 覆盖默认的-200 */
  white-space: nowrap !important;
}

/* 强制覆盖Cesium默认样式 */
:deep(.cesium-timeline-main) {
  background: rgba(42, 42, 42, 0.9) !important;
  border: 1px solid #666 !important;
  height: 27px !important;
}

:deep(.cesium-timeline-trackContainer) {
  background: rgba(50, 50, 50, 0.8) !important;
  border-top: solid 1px #888 !important;
}

:deep(.cesium-timeline-tracks) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

:deep(.cesium-timeline-bar) {
  height: 1.7em !important;
  background: linear-gradient(
    to bottom,
    rgba(116, 117, 119, 0.9) 0%,
    rgba(58, 68, 82, 0.9) 11%,
    rgba(46, 50, 56, 0.9) 46%,
    rgba(53, 53, 53, 0.9) 81%,
    rgba(53, 53, 53, 0.9) 100%) !important;
  cursor: pointer !important;
}

:deep(.cesium-timeline-needle) {
  background: #f00 !important; /* Cesium默认是红色 */
  width: 1px !important;
  top: 1.7em !important;
  bottom: 0 !important;
}

:deep(.cesium-timeline-ticLabel) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  color: #ccc !important;
  font-size: 80% !important;
  white-space: nowrap !important;
  position: absolute !important;
}

/* 强制显示所有时间轴相关元素 - 最高优先级 */
:deep([class*="cesium-timeline"]) {
  display: block !important;
  visibility: visible !important;
  z-index: 10000 !important;
}

/* 额外的时间轴样式确保 */
:deep(.cesium-timeline-main *) {
  display: block !important;
  visibility: visible !important;
}
</style>
