<template>
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
      :service-data="serviceData"
      :generate-service-id="generateServiceId"
      @select-service="selectService"
    />

    <ServiceDetail 
      v-if="selectedService"
      :selected-service="selectedService"
      @close="closeServiceDetail"
    />
  </div>
</template>

<!-- 在现有的SatelliteViewer.vue文件中添加以下方法 -->
<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import ControlPanel from './ControlPanel.vue';
import ServicePanel from './ServicePanel.vue';
import ServiceDetail from './ServiceDetail.vue';

import { useCesium } from '../composables/useCesium.js';
import { useDataLoader } from '../composables/useDataLoader.js';
import { useServiceData } from '../composables/useServiceData.js';
import { useAnimation } from '../composables/useAnimation.js';

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
  closeServiceDetail
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
    
    const cameraPosition = viewer().camera.position.clone();
    const cameraOrientation = {
      heading: viewer().camera.heading,
      pitch: viewer().camera.pitch,
      roll: viewer().camera.roll
    };
    
    currentGraphData = networkData;
    
    if (getPreviousFrameData() === null) {
      viewer().entities.removeAll();
      createEntities(networkData);
      addRoadmLinks(networkData);
      
      viewer().camera.setView({
        destination: cameraPosition,
        orientation: cameraOrientation
      });
      
      setPreviousFrameData(networkData);
      updateVisibility();
      return;
    }
    
    animateTransition(viewer(), getPreviousFrameData(), networkData, (satelliteIds) => {
      // 动画完成回调
      console.log('动画完成，更新的卫星:', satelliteIds);
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

onMounted(async () => {
  try {
    console.log('初始化Cesium和数据加载...');
    
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
    
    console.log('初始化完成');
    
  } catch (err) {
    console.error("初始化失败:", err);
  }
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupCesium();
});

// <!-- 修改现有的highlightEntity函数 -->
// <script setup>
// // 添加高亮实体的方法
// function highlightEntity(entityId) {
//   if (!currentGraphData) return null;
  
//   // 查找实体信息
//   const entity = currentGraphData.nodes.find(node => node.id === entityId);
  
//   if (entity) {
//     // 高亮显示链接
//     if (entity.type === 'satellite') {
//       highlightSatelliteLinks(entityId, currentGraphData);
//     }
    
//     // 返回实体信息
//     return {
//       entity,
//       rawData: currentGraphData
//     };
//   }
  
//   return null;
// }

// 暴露方法给父组件
defineExpose({
  highlightEntity
});
</script>

<style>
#cesiumContainer {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
