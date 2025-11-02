/*
 * 卫星网络仿真系统的主视图容器，集成了导航栏、对象列表、三维场景、业务面板、图表面板、实体信息面板等多个子组件。
 * 导航栏：管理仿真流程、用户登录、数据选择、播放控制等操作。
 * 对象列表侧边栏：展示卫星、地面站、ROADM、链路等对象，支持选中、显示/隐藏和快速定位
 * Cesium三维场景：动态展示卫星网络仿真动画，支持实体选择、播放速度调节、时间跳转等交互
 * 节点跳转与时间跳转：支持用户快速定位到指定节点或仿真时间帧
 * 业务面板与详情：展示和管理业务数据，支持业务路径高亮和详情查看
 * 图表面板：可视化展示仿真结果（如延迟、带宽、跳数等指标）
 * 实体信息面板：展示选中实体的详细属性和业务承载情况
 */

<template>
  <div class="satellite-viewer-container">
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
    
    <div class="main-content">
  
      <div id="cesiumContainer">
        <div class="speed-display-panel">
          <div class="current-speed">{{ playbackSpeed }}x</div>
        </div>
        
        <div 
          v-for="(entity, index) in selectedEntities" 
          :key="entity.id"
          :data-entity-id="entity.id"
          class="custom-selection-indicator selection-indicator-sync"
          :style="getSelectionIndicatorStyle(entity.id)"
          :ref="el => { if (el) indicatorRefs[entity.id] = el }"
        ></div>
        
        <NodeJumpInput 
          :network-data="currentGraphData"
          @node-selected="handleEntitySelect"
          @time-changed="handleTimeJump"
        />
        <button class="drawer-toggle-button left-toggle" @click="toggleLeftPanel" :class="{'open-active': showLeftPanel}">
          {{ showLeftPanel ? '◄' : '►' }}
        </button>
        
        <button class="drawer-toggle-button right-toggle" @click="toggleRightPanel" :class="{'open-active': showRightPanel || selectedService || showDataPanel}">
          {{ showRightPanel || selectedService || showDataPanel ? '►' : '◄' }}
        </button>
        
        <button class="drawer-toggle-button bottom-toggle" @click="toggleBottomPanel" :class="{'open-active': showBottomPanel}">
          {{ showBottomPanel ? '▼' : '▲' }}
        </button>
      </div>

      <ObjectViewer 
        :class="{'drawer-open': showLeftPanel}"
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
      <div 
        class="right-drawer-container"
        :class="{'drawer-open': showRightPanel || selectedService || showDataPanel}"
      >
        <ChartPanel 
          v-if="showDataPanel"
          ref="chartPanelRef"
          :selected-data="selectedSimulationData"
          :current-frame-data="currentGraphData"
          :time-frame="timeFrame"
          @close="handleChartPanelClose"
        />
        <ServiceDetail 
          v-else-if="selectedService"
          :selected-service="selectedService"
          @close="handleCloseServiceDetail"
        />
        <EntityInfoPanel 
          v-else-if="showRightPanel"
          :selectedEntity="selectedEntity" 
          :graphData="selectedEntityRawData"
          :service-data="serviceData"
          @close="handleRightPanelClose" 
        />
      </div>
        
        <ServicePanel 
          :class="{'drawer-open': showBottomPanel}"
          :service-data="serviceData"
          :network-data="currentGraphData"
          :generate-service-id="generateServiceId"
          @select-service="handleSelectService"
          @close="handleBottomPanelClose"
          @update-service-data="handleServiceDataUpdate"
        />
      
      <div class="bottom-controls-group">
        <LightingControl 
          ref="lightingControlRef"
          :initial-enabled="true"
          @toggle-lighting="onToggleLighting"
        />
        <BorderControl 
          ref="borderControlRef"
          :initial-enabled="true"
          @toggle-border="onToggleBorder"
        />
        <GridControl 
          ref="gridControlRef"
          :initial-enabled="true"
          @toggle-grid="onToggleGrid"
        />
        <SkyControl 
          ref="skyControlRef"
          :initial-enabled="true"
          @toggle-sky="onToggleSky"
        />
        <EarthTextureControl 
          ref="earthTextureControlRef"
          @toggle-earth-texture="onToggleEarthTexture"
        />
        </div>
      
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, inject, ref, provide, nextTick, computed, reactive } from 'vue';
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
import LightingControl from './LightingControl.vue'; //10.27 新增
import BorderControl from './BorderControl.vue'; //10.27 新增
import GridControl from './GridControl.vue'; //10.28 新增
import SkyControl from './SkyControl.vue'; //10.28 新增
import EarthTextureControl from './EarthTextureControl.vue'; //新增

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

// 光照控制相关 10.27新增
const lightingControlRef = ref(null);

// 处理光照切换事件
function handleToggleLighting(enabled) {
  if (window.toggleLighting) {
    window.toggleLighting(enabled);
  }
}
//新增结束

// 国界线控制相关 10.27新增
const borderControlRef = ref(null);

// 处理国界线切换事件
function onToggleBorder(enabled) {
  if (window.toggleBorder) {
    window.toggleBorder(enabled);
  }
}

// 经纬线网格控制相关 10.28新增
const gridControlRef = ref(null);

// 处理经纬线网格切换事件
function onToggleGrid(enabled) {
  console.log(`切换经纬线网格状态: ${enabled}`);
  if (toggleGrid) {
    toggleGrid(enabled);
  } else {
    console.warn('toggleGrid方法未找到');
  }
}//新增结束

// 星空背景控制相关 10.28新增
const skyControlRef = ref(null);

// 处理星空背景切换事件
function onToggleSky(enabled) {
  console.log(`切换星空背景状态: ${enabled}`);
  if (toggleSky) {
    toggleSky(enabled);
  } else {
    console.warn('toggleSky方法未找到');
  }
}//新增结束

// 地球纹理控制相关 新增
const earthTextureControlRef = ref(null);

// 处理地球纹理切换事件
function onToggleEarthTexture(textureType) {
  console.log(`切换地球纹理类型: ${textureType}`);
  if (window.toggleEarthTexture) {
    window.toggleEarthTexture(textureType);
  } else {
    console.warn('window.toggleEarthTexture方法未找到');
  }
}//新增结束

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
const showLeftPanel = ref(false);
const showRightPanel = ref(false);
const showBottomPanel = ref(false);

// 选中的实体信息 - 改为数组以支持多选
const selectedEntities = ref([]);
const RawData = ref(null);

// 为了兼容性，提供selectedEntity计算属性，返回最后一个选中的实体
const selectedEntity = computed(() => {
  return selectedEntities.value.length > 0 ? selectedEntities.value[selectedEntities.value.length - 1] : null;
});

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


// 自定义选择指示器
const selectionIndicatorSize = 15; // 进一步减小为15px，使红色圆圈更小
const indicatorRefs = reactive({}); // 存储选择指示器元素的引用

// 获取选择指示器样式 - 支持多个实体
function getSelectionIndicatorStyle(entityId) {
  if (!entityId || !viewer() || !currentGraphData) {
    return { display: 'none' };
  }

  // 查找实体信息
  const entity = currentGraphData.nodes.find(node => node.id === entityId);
  if (!entity) {
    return { display: 'none' };
  }

  // 对于链路类型，不显示选择指示器
  if (entity.type === 'link') {
    return { display: 'none' };
  }

  // 首先尝试从Cesium场景中获取实体的实时位置
  let position = null;
  
  // 查找Cesium场景中对应的实体
  let cesiumEntity = null;
  if (viewer() && viewer().entities) {
    cesiumEntity = viewer().entities.getById(entityId);
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
    // 从数据中构建位置
    if (entity.type === 'satellite') {
      position = new Cesium.Cartesian3(
        parseFloat(entity.position[0]) * 1000,
        parseFloat(entity.position[1]) * 1000,
        parseFloat(entity.position[2]) * 1000
      );
      console.log(`选择指示器：使用卫星 ${entityId} 的数据位置（回退）`);
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
        return {
          display: 'block',
          left: `${screenPosition.x - selectionIndicatorSize / 2}px`,
          top: `${screenPosition.y - selectionIndicatorSize / 2}px`,
          width: `${selectionIndicatorSize}px`,
          height: `${selectionIndicatorSize}px`
        };
      } else {
        // 实体在屏幕外，隐藏指示器
        return { display: 'none' };
      }
    } else {
      return { display: 'none' };
    }
  } catch (error) {
    console.warn('无法计算屏幕坐标:', error);
    return { display: 'none' };
  }
}

// 更新选择指示器位置 - 支持多个选择指示器
function updateSelectionIndicator() {
  // 遍历所有选中的实体，更新各自的选择指示器
  selectedEntities.value.forEach(entity => {
    if (entity && entity.id) {
      // 为每个选中的实体触发位置更新
      // 实际样式计算由 getSelectionIndicatorStyle 处理
      const indicatorElement = document.querySelector(`[data-entity-id="${entity.id}"]`);
      if (indicatorElement) {
        const style = getSelectionIndicatorStyle(entity.id);
        Object.assign(indicatorElement.style, style);
      }
    }
  });
  
  // 触发重新渲染以确保所有指示器位置正确
  if (viewer() && viewer().scene) {
    viewer().scene.requestRender();
  }
}

// 添加一个持续更新选择指示器位置的函数
function startSelectionIndicatorUpdater() {
  // 设置CSS变量，确保所有指示器动画同步
  document.documentElement.style.setProperty('--indicator-delay', '0s');
  
  function updateIndicators() {
    if (selectedEntities.value.length > 0 && viewer() && viewer().scene) {
      updateSelectionIndicator();
      
      // 移除每帧调用 synchronizeIndicatorAnimations()
      // 只在选中实体变化时调用一次即可
    }
    requestAnimationFrame(updateIndicators);
  }
  
  // 启动更新循环
  updateIndicators();
}

// 同步所有选择指示器的动画
function synchronizeIndicatorAnimations() {
  // 重置CSS变量，确保所有指示器动画同步
  document.documentElement.style.setProperty('--indicator-delay', '0s');
  
  // 获取所有选择指示器元素
  const indicators = Object.values(indicatorRefs);
  
  // 如果没有指示器，直接返回
  if (indicators.length === 0) return;
  
  // 记录当前时间，作为动画同步的基准
  const syncTime = Date.now();
  
  // 对每个指示器执行动画重置
  indicators.forEach(indicator => {
    if (!indicator) return;
    
    // 短暂禁用动画
    indicator.style.animation = 'none';
    
    // 强制重排，确保样式应用
    void indicator.offsetHeight;
    
    // 恢复动画，确保所有指示器同时开始
    indicator.style.animation = 'blink-sync 1s infinite ease-in-out';
    
    // 设置动画开始时间为同步时间
    indicator.style.animationDelay = '0s';
  });
  
  console.log(`已同步 ${indicators.length} 个选择指示器的动画`);
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
  clearGroundLinks, // 9月28日新增，对应链路显示功能部分
  highlightSatelliteLinks,
  validateHighlightedLinks,
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
  parseFolderName,
  toggleLighting, // 10.27新增
  toggleBorder, // 10.27新增
  toggleGrid, // 10.28新增
  toggleSky // 10.28新增，对应星空背景功能部分
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
  getPreviousFrameData,
  clearEntityPositionCache,
  setEntityPositionCache
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

// 处理光照控制切换事件 10.27新增
function onToggleLighting(enabled) {
  console.log(`切换光照状态: ${enabled}`);
  if (window.toggleLighting) {
    window.toggleLighting(enabled);
  } else {
    console.warn('window.toggleLighting方法未找到');
  }
}//新增结束

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
    currentGraphData = null;
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
          clearGroundLinks(); // 先清除地面链路（9月28日新增）
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

/**
 * 预加载指定帧的业务数据
 */
async function loadBusinessDataForFrame(frameNumber) {
  try {
    const folderPath = getCurrentDataFolder();
    
    // 动态解析文件夹的时间间隔
    const config = parseFolderName(folderPath);
    const timeInterval = config.interval;
    
    const timeSeconds = frameNumber * timeInterval;
    const filename = `./data/${folderPath}/network_state_${timeSeconds}.00.json`;
    
    console.log(`预加载业务数据: ${filename}`);
    
    const response = await fetch(filename);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 预加载数据到缓存
    if (data.business_services) {
      console.log(`预加载完成，业务服务数量: ${data.business_services.length}`);
    }
    
    return data;
  } catch (error) {
    console.warn(`预加载帧 ${frameNumber} 业务数据失败:`, error);
    throw error;
  }
}

async function loadTimeFrame(frame, isFrameJump = false) {
  console.log(`强制加载帧: ${frame}, 时间跳转: ${isFrameJump}`);
  
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
          
          // 重要修复：确保业务数据在网络数据处理之前同步加载
          let serviceDataResult = null;
          try {
            console.log('同步加载业务数据...');
            serviceDataResult = await loadServiceData(frame, isFrameJump);
            console.log('本地业务数据加载成功:', serviceDataResult);
          } catch (serviceError) {
            console.warn('本地业务数据加载失败:', serviceError);
          }
          
          // 业务数据加载完成后再处理网络数据
          currentGraphData = networkData;
          processNetworkData(networkData);
          
          // 如果图表面板是打开的，更新图表数据
          if (showDataPanel.value && chartPanelRef.value) {
            chartPanelRef.value.addDataPoint(frame, networkData);
          }
          
          // 更新ObjectViewer的文件显示
          const networkFileName = filename.split('/').pop();
          const serviceFileName = `service_state_${fileTimeValue}.00.json`;
          if (objectViewerRef.value) {
            if (serviceDataResult) {
              objectViewerRef.value.updateLoadedFiles(networkFileName, serviceFileName);
            } else {
              objectViewerRef.value.updateLoadedFiles(networkFileName, '业务数据加载失败');
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
      loadServiceData(frame, isFrameJump)
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
  
  // 验证并更新当前高亮的卫星链路
  validateHighlightedLinks(networkData);
  
  // 重要修复：延迟更新业务数据，不在这里立即调用，避免使用旧的业务数据
  // updateNetworkDataAndRedraw(networkData, viewer()); // 移除立即调用
  
  if (getPreviousFrameData() === null) {
    console.log('这是第一帧数据，清空现有实体并创建新实体');
    viewer().entities.removeAll();
    console.log('已清空所有实体，开始创建新实体...');
    
    createEntities(networkData);
    console.log('实体创建完成，当前实体数量:', viewer().entities.values.length);
    
    // 关键修复：为新创建的卫星实体建立与动画系统的连接
    rebuildEntityAnimationBindings(networkData);
    
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
    
    // 重要修复：第一帧也需要在最后更新业务数据，确保业务路径与网络数据同步
    // 注释掉自动重绘，避免性能问题 - 只有用户手动绘制业务路径时才重绘
    // setTimeout(() => {
    //   console.log('第一帧数据处理完成，现在更新业务数据和路径');
    //   updateNetworkDataAndRedraw(networkData, viewer(), false);
    // }, 100);
    
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
    console.log(`帧跳跃距离${frameJumpDistance}超过阈值${FRAME_JUMP_THRESHOLD}，启用瞬间模式避免穿越动画`);
    
    // 大跨度跳转时先清除所有业务路径，避免显示错误的路径
    clearAllServicePaths(viewer());
    
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
      
      // 重要修复：立即重新加载业务数据以确保时间同步
      const frameToLoad = timeFrame.value;
      console.log(`大跨度跳转后重新加载业务数据，当前帧: ${frameToLoad}`);
      
      // 使用异步函数确保业务数据完全加载后再处理
      (async () => {
        try {
          console.log('开始同步重新加载业务数据...');
          await loadServiceData(frameToLoad, true); // 传递时间跳转标识
          console.log('业务数据重新加载完成，现在更新网络数据和重绘路径');
          
          // 业务数据加载完成后立即更新网络数据
          updateNetworkDataAndRedraw(networkData, viewer(), true); // 传递帧跳转标识
        } catch (error) {
          console.error('重新加载业务数据失败:', error);
          // 即使业务数据加载失败，也要更新网络数据
          updateNetworkDataAndRedraw(networkData, viewer(), true);
        }
      })();
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
      // 注释掉自动重绘，避免每个时间片都卡顿 - 只有用户手动绘制业务路径时才重绘
      // updateNetworkDataAndRedraw(networkData, viewer(), false);
    });
  }
  
  // 更新上一次处理的帧号
  lastProcessedFrame = currentFrame;
  
  // 预加载下一帧数据的逻辑可以根据需要添加
}

// 重新建立实体与动画系统的绑定连接
function rebuildEntityAnimationBindings(networkData) {
  console.log('开始重新建立实体与动画系统的绑定连接');
  
  if (!viewer() || !viewer().entities) {
    console.warn('Cesium viewer未准备好，跳过绑定重建');
    return;
  }
  
  let reboundCount = 0;
  const satellites = networkData.nodes.filter(node => node.type === 'satellite');
  
  satellites.forEach(satelliteNode => {
    const entity = viewer().entities.getById(satelliteNode.id);
    if (entity && entity.position) {
      // 获取当前位置（从新创建实体的静态位置）
      let currentPosition;
      if (typeof entity.position.getValue === 'function') {
        currentPosition = entity.position.getValue(Cesium.JulianDate.now());
      } else if (entity.position instanceof Cesium.Cartesian3) {
        currentPosition = entity.position;
      }
      
      if (currentPosition) {
        // 重新为动画系统建立缓存和 CallbackProperty
        const position = new Cesium.Cartesian3(
          currentPosition.x,
          currentPosition.y, 
          currentPosition.z
        );
        
        const callbackProperty = new Cesium.CallbackProperty(function(time, result) {
          return Cesium.Cartesian3.clone(position, result);
        }, false);
        
        // 将新的位置缓存到动画系统中，需要先获取动画系统的缓存设置函数
        setEntityPositionCache(satelliteNode.id, { position, callbackProperty });
        
        // 替换实体的位置属性为动画系统控制的 CallbackProperty
        entity.position = callbackProperty;
        
        reboundCount++;
        console.log(`重新绑定卫星 ${satelliteNode.id} 到动画系统`);
      }
    }
  });
  
  console.log(`实体绑定重建完成，共重新绑定 ${reboundCount} 个卫星实体`);
}

function handleSatelliteClick(entityId) {
  // 处理实体点击，包括选中效果和高亮链接 - 支持多选模式
  handleEntitySelect(entityId);
}

// 为handleSatelliteClick添加清除所有选择的方法
handleSatelliteClick.clearAllSelections = function() {
  console.log('点击空白区域，清除所有站点选择');
  // 清除所有选中的实体
  selectedEntities.value = [];
  selectedEntityRawData.value = null;
  showRightPanel.value = false;
  
  // 更新选择指示器
  updateSelectionIndicator();
};

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
        
        // 检查该实体是否已经被选中
        const existingIndex = selectedEntities.value.findIndex(e => e.id === idStr);
        
        if (existingIndex !== -1) {
          // 如果已选中，则取消选中（从数组中移除）
          selectedEntities.value.splice(existingIndex, 1);
          console.log(`取消选择实体: ${idStr}`);
        } else {
          // 如果未选中，则添加到选中数组
          selectedEntities.value.push(entity);
          console.log(`选择实体: ${idStr}`);
        }
        
        // 更新原始数据（用于右侧面板显示，显示最后选中的实体）
        if (selectedEntities.value.length > 0) {
          selectedEntityRawData.value = currentGraphData;
          showRightPanel.value = true; // 选择实体时展开右侧面板
        } else {
          selectedEntityRawData.value = null;
          showRightPanel.value = false;
        }
        
        if (entity.type === 'satellite') {
          highlightSatelliteLinks(idStr, currentGraphData);
        }
        
        // 更新选择指示器
        updateSelectionIndicator();
        
        // 使用nextTick确保DOM更新后再同步动画
        nextTick(() => {
          // 确保所有指示器动画同步
          synchronizeIndicatorAnimations();
        });
      }
    }
  } catch (error) {
    console.error('处理实体选择失败:', error);
  }
}

// 处理时间跳转
async function handleTimeJump(frame) {
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
    
    // 重要修复：时间跳转时先清除业务路径，避免显示错误连接
    console.log('时间跳转前先清除业务路径');
    const cesiumViewer = viewer();
    if (cesiumViewer) {
      clearAllServicePaths(cesiumViewer);
    }
    
    // 预加载业务数据以确保数据同步
    try {
      console.log('预加载业务数据');
      await loadBusinessDataForFrame(safeFrame);
    } catch (error) {
      console.warn('业务数据预加载失败，继续执行:', error);
    }
    
    // 强制加载指定帧
    loadTimeFrame(safeFrame, true); // 标识为时间跳转
  } catch (error) {
    console.error('时间跳转处理失败:', error);
  }
}


// 侧边栏控制函数（变为开关抽屉）

function toggleLeftPanel() {
  showLeftPanel.value = !showLeftPanel.value;
}

function handleLeftPanelClose() {
  showLeftPanel.value = false;
}

function toggleRightPanel() {
  // 如果当前右侧有内容显示，则关闭，否则打开
  if (showRightPanel.value || selectedService.value || showDataPanel.value) {
    showRightPanel.value = false;
    selectedService.value = null; // 关闭业务详情
    showDataPanel.value = false; // 关闭图表
  } else {
    // 默认打开  (右侧面板)
    showRightPanel.value = true;
  }
}

function handleRightPanelClose() {
  showRightPanel.value = false;
  // 关闭右侧面板时清除选择
  selectedEntities.value = [];
  selectedEntityRawData.value = null;
}

// 处理图表面板关闭
function handleChartPanelClose() {
  showDataPanel.value = false;
  // 保留日志
  console.log('图表面板已关闭'); 
}


// 底部面板开关函数
function toggleBottomPanel() {
  showBottomPanel.value = !showBottomPanel.value;
  // 触发面板状态变化事件
  window.dispatchEvent(new CustomEvent('panel-state-changed', {
    detail: { type: 'bottom-panel', action: showBottomPanel.value ? 'open' : 'close' }
  }));
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
  // 1. 关闭实体信息面板和图表面板
  showRightPanel.value = false;
  showDataPanel.value = false;
  
  // 2. 确保右侧抽屉打开
  if (!selectedService.value) { 
    toggleRightPanel(); // 调用开关函数来打开抽屉
  }
  
  // 3. 选择业务
  selectService(service, type);
}

// 包装 closeServiceDetail 函数，关闭业务详情时恢复实体信息面板
function handleCloseServiceDetail() {
  // 调用 useServiceData 中的关闭方法
  closeServiceDetail(); 
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
      console.log(`左侧时间跳转到帧: ${targetFrame}, 强制更新: ${forceUpdate}`);
      
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
    
    // 启动选择指示器更新器
    startSelectionIndicatorUpdater();
    
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
      
      // 清理实体位置缓存，确保新文件夹的实体能够正确绑定到动画系统
      clearEntityPositionCache();
      console.log('已清理实体位置缓存，新实体将重新建立动画绑定');
      
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
    
    // 暴露光照控制方法给window对象 10.27新增
    window.toggleLighting = (enabled) => {
      try {
        toggleLighting(enabled);
        console.log(`光照状态已切换为: ${enabled}`);
      } catch (error) {
        console.error('切换光照状态失败:', error);
      }
    };
    
    // 暴露国界线控制方法给window对象 10.27新增
    window.toggleBorder = (enabled) => {
      try {
        toggleBorder(enabled);
        console.log(`国界线显示状态已切换为: ${enabled}`);
      } catch (error) {
        console.error('切换国界线显示状态失败:', error);
      }
    };
    
    console.log('缓存调试功能已添加：');
    console.log('- 使用 window.debugCache() 查看缓存状态');
    console.log('- 使用 window.clearAllCache() 清理所有缓存');
    console.log('显示控制功能已添加：');
    console.log('- 使用 window.toggleLighting(enabled) 控制光照显示');
    console.log('- 使用 window.toggleBorder(enabled) 控制国界线显示');
    
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
  isPlaying: () => isPlaying.value,
  earthTextureControlRef
});
</script>

<style scoped>
/* 使用主题变量 */
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
  background-color: var(--bg-primary);
}

/* 播放速度显示 - 修复位置，向下移动 */
.speed-display-panel {
  position: absolute; 
  /* 修正：将位置设置在导航栏高度 + 50px 的位置，确保在右侧开关按钮下方 */
  top: calc(var(--nav-height) + 50px); 
  right: 10px; 
  z-index: 1004; 
  background-color: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
}

.current-speed {
  font-weight: bold;
}

.main-content {
  display: flex;
  flex: 1;
  height: calc(100vh - var(--nav-height)); /* 适应新的导航栏高度 */
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

/* 抽屉切换按钮 - 类似 satelitem.space 的小按钮 */
.drawer-toggle-button {
  position: fixed;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  cursor: pointer;
  z-index: 1002;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--color-shadow);
  font-size: 14px;
}

.drawer-toggle-button:hover,
.drawer-toggle-button.open-active {
  background: var(--color-highlight);
  border-color: var(--color-highlight);
  color: var(--bg-primary);
  box-shadow: 0 4px 12px var(--color-highlight);
}

.left-toggle {
  top: calc(var(--nav-height) + 10px);
  left: 10px;
}

.right-toggle {
  top: calc(var(--nav-height) + 10px);
  right: 10px;
}

.bottom-toggle {
  bottom: 45px;
  left: 50%;
  transform: translateX(-50%);
}

/* 左侧对象列表 (Drawer) */
.object-viewer {
  position: fixed;
  top: var(--nav-height);
  left: 0;
  height: calc(100% - var(--nav-height));
  width: 300px;
  z-index: 1001;
  transform: translateX(-100%);
  transition: transform 0.3s ease-out;
  box-shadow: 4px 0 10px var(--color-shadow);
  background: var(--bg-primary);
}

.object-viewer.drawer-open {
  transform: translateX(0);
}

/* 右侧面板组 (Drawer Container) */
.right-drawer-container {
  position: fixed;
  top: var(--nav-height);
  right: 0;
  height: calc(100% - var(--nav-height));
  width: 350px; /* 略微增加宽度以更好地显示图表 */
  z-index: 1003;
  transform: translateX(100%);
  transition: transform 0.3s ease-out;
  box-shadow: -4px 0 10px var(--color-shadow);
}

.drawer-open {
  transform: translateX(0);
}

/* 确保右侧抽屉内的内容填满容器 */
.right-drawer-container > * {
  width: 100%;
  height: 100%;
}

/* 底部业务面板 (Drawer) */
.service-panel {
  position: fixed; /* 使用 fixed 定位确保在视口中 */
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px; /* 打开时的高度 */
  z-index: 10011; /* 👈 关键修复：确保高于时间轴 (10010) */
  /* 默认状态：向下移动自身高度，实现下沉效果 */
  transform: translateY(100%); 
  transition: transform 0.3s ease-out; /* 添加过渡效果 */
  /* ... (其他样式保持不变) ... */
}

/* 抽屉打开状态 */
.service-panel.drawer-open {
  transform: translateY(0); /* 打开状态：恢复到原始位置 */
}

.bottom-controls-group {
  position: fixed;
  bottom: 5px; /* 👈 修复 1: 紧贴页面最底部，只留 5px 间隙 */
  left: 20px; 
  right: auto; 
  z-index: 10020;
  display: flex;
  
  /* 关键修改：横向排列 */
  flex-direction: row; 
  
  /* 确保按钮从左侧开始排列 */
  align-items: center; 
  justify-content: flex-start; 
  gap: 10px;
}

/* 覆盖 LightingControl 组件内部的定位 (保持不变，以支持横向排列) */
.bottom-controls-group > :deep(.tooltip-container) {
  position: static;
  margin: 0;
}

.bottom-controls-group > :deep(.tooltip-container) .sun-icon,
.bottom-controls-group > :deep(.tooltip-container) .border-icon,
.bottom-controls-group > :deep(.tooltip-container) .grid-icon,
.bottom-controls-group > :deep(.tooltip-container) .sky-icon,
.bottom-controls-group > :deep(.tooltip-container) .earth-icon {
  position: static;
}

/* NodeJumpInput 样式 - 确保其 Z-index 足够高 */
.node-jump-container {
    z-index: 1001; /* 确保它在Cesium场景的上方 */

}
</style>