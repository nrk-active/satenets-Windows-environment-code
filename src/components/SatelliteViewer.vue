<template>
  <div id="cesiumContainer">
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="toggle-group">
        <div class="toggle-item">
          <input type="checkbox" id="show-satellite" v-model="showSatellite" @change="updateVisibility" checked>
          <label for="show-satellite">卫星</label>
        </div>
        <div class="toggle-item">
          <input type="checkbox" id="show-station" v-model="showStation" @change="updateVisibility" checked>
          <label for="show-station">地面站</label>
        </div>
        <div class="toggle-item">
          <input type="checkbox" id="show-roadm" v-model="showRoadm" @change="updateVisibility" checked>
          <label for="show-roadm">ROADM</label>
        </div>
      </div>
      
      <!-- 添加简单的播放控制 -->
      <div class="timeline-control">
        <button @click="togglePlayback">{{ isPlaying ? '暂停' : '播放' }}</button>
        <div class="time-display">时间: {{ timeFrame }}分钟</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, ref, onUnmounted, provide } from "vue";
import topoData from '../../topo.json';
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5ZmExMzZkNC1hMGI2LTQ0ZTUtYTA2OS1lMTRkYWFlYTAyZWUiLCJpZCI6MzEyNjQzLCJpYXQiOjE3NTAwNzUyNDB9.-9M-9Wqg-IH2FBXb12RsWEMBXSFTOvKOISePRAZsSy8';
const nodeCount = ref(0);
const linkCount = ref(0);
// 全局变量
let viewer;
let handler; // 全局变量保留
const MAX_FRAMES_CACHE = 2; // 最大缓存帧数
const POLLING_INTERVAL = 2000; // 轮询间隔（减少到2秒）
const ANIMATION_DURATION = 4000; // 动画持续时间(毫秒)（减少到4秒）
const TRANSITION_DURATION = 10000; // 10秒的平滑过渡
const PRELOAD_DELAY = 500; // 动画开始后500ms就开始预加载下一帧
const framesCache = []; // 帧缓存
let isInitialLoading = true; // 是否是初始加载
let pollingTimer = null; // 轮询定时器
let isRequesting = false; // 请求锁
const isPolling = ref(false);
let currentCounter = 0; // 当前请求的帧号
const currentFrameDisplay = ref(0); // 当前显示的帧索引
// 添加新的全局变量
const INTERPOLATION_STEPS = 40; // 每两帧之间的插值步数（降低以提高性能）
const interpolatedFrames = []; // 存储所有插值后的帧
let currentAnimationFrame = null; // 用于控制动画
const isPlaying = ref(false);
const timeFrame = ref(1); // 从1分钟开始
const maxTimeFrame = 5; // 最大5个时间帧
let playbackTimer = null;

// 保存卫星和连线实体引用
const satelliteEntities = [];
const satelliteLinkEntities = [];

const simulationProgress = ref(0);
const simulationTime = ref({ start: '', end: '' });
let progressPollingTimer = null;

// 添加一个变量存储 simulator ID
const simulatorId = ref(null);

// 添加显示控制状态
const showSatellite = ref(true);
const showStation = ref(true);
const showRoadm = ref(true);

// 添加链路渲染函数
function addLink(link, nodes, viewer) {
  const sourceNode = nodes.find(n => n.id === link.source);
  const targetNode = nodes.find(n => n.id === link.target);
  
  if (!sourceNode || !targetNode) return;
  
  // 获取节点位置
  let sourcePosition, targetPosition;
  
  if (sourceNode.type === 'satellite') {
    sourcePosition = Cesium.Cartesian3.fromArray(sourceNode.position);
  } else {
    sourcePosition = Cesium.Cartesian3.fromDegrees(
      sourceNode.position[0],
      sourceNode.position[1],
      0
    );
  }
  if (targetNode.type === 'satellite') {
    targetPosition = Cesium.Cartesian3.fromArray(targetNode.position);
  } else {
    targetPosition = Cesium.Cartesian3.fromDegrees(
      targetNode.position[0],
      targetNode.position[1],
      0
    );
  }
  // 添加连线
  viewer.entities.add({
    id: `${link.source}-${link.target}`,
    polyline: {
      positions: [sourcePosition, targetPosition],
      width: 1,
      material: Cesium.Color.YELLOW.withAlpha(0.5)
    }
  });
}

// 修改主渲染函数
async function updateScene(counter) {
  // 清除现有实体
  viewer.entities.removeAll();
  viewer.scene.primitives.removeAll();
  
  // 加载本地数据
  const data = await loadGraphData(counter);
  if (!data) return;
  
  // 渲染节点
  data.nodes.forEach(node => addNode(node, viewer));
  
  // 渲染链路
  data.links.forEach(link => addLink(link, data.nodes, viewer));
}


// 添加获取 simulator ID 的函数
async function getSimulatorId() {
    if (simulatorId.value) return simulatorId.value;
    
    try {
        const response = await fetch('/api/simulators/', {
            method: 'GET',
            credentials: 'include',
        });
        const data = await response.json();
        simulatorId.value = data.simulators[data.simulators.length - 1].id;
        console.log('获取到模拟器ID:', simulatorId.value);
        return simulatorId.value;
    } catch (error) {
        console.error('获取模拟器ID失败:', error);
        throw error;
    }
}

async function fetchProgress() {
    try {
        const id = await getSimulatorId();
        const response = await fetch(`/api/simulators/${id}/progress/`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        simulationProgress.value = data.progress;
        simulationTime.value = { start: data.start_time, end: data.end_time };
        console.log('仿真进度:', simulationProgress.value);

        if (simulationProgress.value >= 1) {
            clearInterval(progressPollingTimer);
            progressPollingTimer = null;
            console.log('仿真进度完成');
        }
    } catch (error) {
        console.error('获取进度失败:', error);
    }
}

// 修改现有的事件监听器处理方法
window.addEventListener('start-satellite-polling', () => {
    console.log('开始仿真：同时启动进度轮询和卫星数据轮询');
    // 清除可能存在的轮询定时器
    if (progressPollingTimer) {
        clearInterval(progressPollingTimer);
    }
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }
    
    // 清除现有的卫星实体
    viewer.entities.removeAll();
    satelliteEntities.length = 0;
    satelliteLinkEntities.length = 0;
    
    // 重置状态
    isInitialLoading = true;
    currentCounter = 0;
    framesCache.length = 0;
    interpolatedFrames.length = 0;
    
    // 同时开始两个轮询过程
    // 1. 开始进度轮询
    simulationProgress.value = 0;
    fetchProgress(); // 立即执行一次
    progressPollingTimer = setInterval(fetchProgress, 1000); // 每秒轮询一次进度
    
    // 2. 立即开始卫星数据轮询（不等待仿真完成）
    console.log('立即开始卫星数据轮询');
    setTimeout(() => {
        startPolling();
    }, 2000); // 延迟2秒确保仿真已开始产生数据
});

// 添加计算插值的函数
function calculateInterpolatedFrames() {
    interpolatedFrames.length = 0;
    
    const currentFrame = framesCache[0];
    const nextFrame = framesCache[1];
    
    if (!currentFrame || !nextFrame) {
        console.warn('帧数据不足，跳过插值计算');
        return false; // 返回计算状态
    }
    
    console.log('开始计算插值...');
    
    // 计算两帧之间的插值
    for (let step = 0; step < INTERPOLATION_STEPS; step++) {
        const fraction = step / INTERPOLATION_STEPS;
        const interpolatedNodes = [];
        
        currentFrame.nodes.forEach(currentNode => {
            if (currentNode.id.includes('ground_station')) return;
            
            const nextNode = nextFrame.nodes.find(node => node.id === currentNode.id);
            if (!nextNode) return;
            
            interpolatedNodes.push({
                id: currentNode.id,
                position: new Cesium.Cartesian3(
                    Cesium.Math.lerp(
                        parseFloat(currentNode.position[0]) * 1000,
                        parseFloat(nextNode.position[0]) * 1000,
                        fraction
                    ),
                    Cesium.Math.lerp(
                        parseFloat(currentNode.position[1]) * 1000,
                        parseFloat(nextNode.position[1]) * 1000,
                        fraction
                    ),
                    Cesium.Math.lerp(
                        parseFloat(currentNode.position[2]) * 1000,
                        parseFloat(nextNode.position[2]) * 1000,
                        fraction
                    )
                )
            });
        });
        
        interpolatedFrames.push(interpolatedNodes);
    }
    
    console.log(`插值计算完成，共 ${interpolatedFrames.length} 帧`);
    return true; // 返回计算状态
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 添加动画播放函数
function playAnimation() {
    if (!interpolatedFrames.length || isPlaying) return;
    
    let frameIndex = 0;
    let startTime = null;
    isPlaying = true;
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const normalizedProgress = progress / ANIMATION_DURATION;
        
        // 计算当前应该显示的帧
        frameIndex = Math.min(
            Math.floor(normalizedProgress * interpolatedFrames.length),
            interpolatedFrames.length - 1
        );
        
        const frame = interpolatedFrames[frameIndex];
        frame.forEach(node => {
            const entity = viewer.entities.getById(node.id);
            if (entity) {
                entity.position = node.position;
            }
        });
        
        currentFrameDisplay.value = Math.floor(frameIndex / INTERPOLATION_STEPS);
        
        // 动画未完成，继续请求下一帧
        if (progress < ANIMATION_DURATION) {
            viewer.scene.requestRender();
            animationFrame = requestAnimationFrame(animate);
        } else {
            isPlaying = false;
        }
    }
    
    animationFrame = requestAnimationFrame(animate);
}


// 删除或注释掉旧的 addLinks 函数，因为它不再被直接调用
/*
function addLinks(frameData) {
    // ... (旧代码) ...
}
*/

// 新增：高亮指定卫星链路的函数
let highlightedLinks = []; // 用于存储高亮实体的引用，方便清除
// 修改过渡动画持续时间，延长以便更好地观察

// 平滑过渡动画 - 匀速版本
function animateTransition(fromData, toData) {
  console.log("开始过渡动画");
  animationInProgress = true;
  
  // 准备数据映射，提高查找效率
  const toNodeMap = {};
  toData.nodes.forEach(node => {
    if (node.type === 'satellite') {
      toNodeMap[node.id] = node;
    }
  });
  
  // 查找所有实体一次性存入映射表
  const entityMap = {};
  viewer.entities.values.forEach(entity => {
    if (entity.id && entity.id.startsWith('satellite')) {
      entityMap[entity.id] = entity;
    }
  });
  
  // 预计算要动画的卫星对
  const satellitePairs = [];
  const satelliteIds = new Set();
  
  fromData.nodes.forEach(fromNode => {
    if (fromNode.type !== 'satellite') return;
    
    const toNode = toNodeMap[fromNode.id];
    if (!toNode) return;
    
    const entity = entityMap[fromNode.id];
    if (!entity) return;
    
    const fromPos = fromNode.position;
    const toPos = toNode.position;
    
    if (fromPos && toPos) {
      satellitePairs.push({
        entity,
        fromPos: [parseFloat(fromPos[0]) * 1000, parseFloat(fromPos[1]) * 1000, parseFloat(fromPos[2]) * 1000],
        toPos: [parseFloat(toPos[0]) * 1000, parseFloat(toPos[1]) * 1000, parseFloat(toPos[2]) * 1000]
      });
      satelliteIds.add(fromNode.id);
    }
  });
  
  console.log(`准备动画: ${satellitePairs.length} 个卫星需要移动`);
  
  // 如果没有卫星需要移动，直接完成过渡
  if (satellitePairs.length === 0) {
    console.log("没有卫星需要移动，跳过动画");
    previousFrameData = toData;
    animationInProgress = false;
    return;
  }
  
  // 立即开始预加载下一帧
  const nextFrame = timeFrame.value >= maxTimeFrame ? 1 : timeFrame.value + 1;
  const nextFilename = `./data/network_state_${nextFrame * 60}.00.json`;
  
  // 预加载逻辑移到这里，在动画开始时就执行
  setTimeout(async () => {
    if (!dataCache[nextFilename]) {
      console.log(`预加载下一帧: ${nextFrame}分钟`);
      try {
        dataCache[nextFilename] = await loadGraphData(nextFilename);
        console.log(`预加载完成: ${nextFrame}分钟`);
      } catch (err) {
        console.error("预加载出错:", err);
      }
    }
  }, PRELOAD_DELAY);
  
  // 开始动画，使用限制帧率的方式
  let startTime = null;
  const FRAME_INTERVAL = 16; // 约60fps，保持流畅度
  let lastFrameTime = 0;
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    
    // 限制帧率，避免过于频繁更新
    if (timestamp - lastFrameTime < FRAME_INTERVAL && elapsed < TRANSITION_DURATION) {
      currentAnimationFrame = requestAnimationFrame(animate);
      return;
    }
    
    lastFrameTime = timestamp;
    // 线性插值 - 纯粹的匀速运动，不使用缓动函数
    const fraction = Math.min(elapsed / TRANSITION_DURATION, 1.0);
    
    // 批量更新卫星位置
    for (let i = 0; i < satellitePairs.length; i++) {
      const pair = satellitePairs[i];
      
      // 线性插值计算新位置
      const newX = Cesium.Math.lerp(pair.fromPos[0], pair.toPos[0], fraction);
      const newY = Cesium.Math.lerp(pair.fromPos[1], pair.toPos[1], fraction);
      const newZ = Cesium.Math.lerp(pair.fromPos[2], pair.toPos[2], fraction);
      
      // 更新实体位置
      pair.entity.position = new Cesium.Cartesian3(newX, newY, newZ);
    }
    
    // 请求重绘
    viewer.scene.requestRender();
    
    // 动画未完成，继续下一帧
    if (elapsed < TRANSITION_DURATION) {
      currentAnimationFrame = requestAnimationFrame(animate);
    } else {
      // 动画完成
      console.log("过渡动画完成");
      animationInProgress = false;
      previousFrameData = toData;
      
      // 更新链路（如果高亮了卫星链路）
      const highlightedSatellite = highlightedLinks.length > 0 ? 
        highlightedLinks[0]?.id?.split('-')[0] : null;
      
      if (highlightedSatellite && satelliteIds.has(highlightedSatellite)) {
        highlightSatelliteLinks(highlightedSatellite, toData);
      }
      
      currentAnimationFrame = null;
    }
  }
  
  currentAnimationFrame = requestAnimationFrame(animate);
}

// 修改 loadGraphData 函数以接受文件名参数
async function loadGraphData(filename) {
  try {
    const response = await fetch(filename);
    if (!response.ok) {
      throw new Error(`加载数据失败: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json();
    
    // 解析数据
    const nodes = [];
    const edges = [];
    
    // 处理节点数据 - 修改逻辑以适应您的数据格式
    if (rawData.data.graph_nodes) {
        Object.entries(rawData.data.graph_nodes).forEach(([nodeId, nodeData]) => {
            console.log(`处理节点 ${nodeId}, 数据:`, nodeData);
            
            // 卫星节点 - 检查多种可能的坐标字段
            if (nodeId.startsWith('satellite')) {
                // 直接从 satellite_positions_summary 获取坐标
                const posData = rawData.data.satellite_positions_summary?.[nodeId];
                
                // 尝试多种可能的坐标属性名
                let x, y, z;
                
                if (posData) {
                    // 方式1: {x, y, z} 结构
                    if (posData.x !== undefined) {
                        x = posData.x;
                        y = posData.y;
                        z = posData.z;
                    } 
                    // 方式2: position 数组
                    else if (Array.isArray(posData.position)) {
                        [x, y, z] = posData.position;
                    }
                    // 方式3: current_position 对象(根据控制台显示的嵌套结构)
                    else if (posData.current_position) {
                        x = posData.current_position.x;
                        y = posData.current_position.y;
                        z = posData.current_position.z;
                    }
                } 
                // 从节点本身获取坐标
                else if (nodeData) {
                    // 方式4: 节点自身有 {x, y, z}
                    if (nodeData.x !== undefined) {
                        x = nodeData.x;
                        y = nodeData.y;
                        z = nodeData.z;
                    }
                    // 方式5: 节点有 position 数组
                    else if (Array.isArray(nodeData.position)) {
                        [x, y, z] = nodeData.position;
                    }
                    // 方式6: 节点有 current_position 对象
                    else if (nodeData.current_position) {
                        x = nodeData.current_position.x;
                        y = nodeData.current_position.y;
                        z = nodeData.current_position.z;
                    }
                }
                
                if (x !== undefined && y !== undefined && z !== undefined) {
                    nodes.push({
                        id: nodeId,
                        type: 'satellite',
                        position: [x, y, z]
                    });
                    console.log(`添加卫星节点 ${nodeId}, 坐标: [${x}, ${y}, ${z}]`);
                } else {
                    console.warn(`无法获取卫星 ${nodeId} 的坐标`);
                }
            } 
            // 地面站节点 - 检查多种可能的坐标字段
            else if (nodeData.type === 'station') {
                if (Array.isArray(nodeData.location) && nodeData.location.length >= 2) {
                    const lat = nodeData.location[0];
                    const lon = nodeData.location[1];
                    nodes.push({
                        id: nodeId,
                        type: 'station',
                        position: [lon, lat]
                        // position: [lat, lon]
                    });
                    console.log(`添加地面站节点 ${nodeId}, 坐标: [${lon}, ${lat}]`);
                } else {
                    console.warn(`无法获取地面站 ${nodeId} 的坐标`);
                }
            }
            
            // ROADM节点
            else if (nodeId.startsWith('ROADM')) {
                // 尝试多种可能的经纬度属性名
                let lon, lat;
                
                // 方式1: {longitude, latitude}
                if (nodeData.longitude !== undefined) {
                    lon = nodeData.longitude;
                    lat = nodeData.latitude;
                }
                // 方式2: {lon, lat}
                else if (nodeData.lon !== undefined) {
                    lon = nodeData.lon;
                    lat = nodeData.lat;
                }
                // 方式3: position 数组
                else if (Array.isArray(nodeData.position) && nodeData.position.length >= 2) {
                    [lon, lat] = nodeData.position;
                }
                // 方式4: location 数组
                else if (nodeData.location && Array.isArray(nodeData.location) && nodeData.location.length >= 2) {
                    lon = nodeData.location[1]; // 注意经纬度顺序
                    lat = nodeData.location[0];
                }
                
                if (lon !== undefined && lat !== undefined) {
                    nodes.push({
                        id: nodeId,
                        type: 'roadm',
                        position: [lon, lat]
                    });
                    console.log(`添加ROADM节点 ${nodeId}, 坐标: [${lon}, ${lat}]`);
                } else {
                    console.warn(`无法获取ROADM ${nodeId} 的坐标`);
                }
            }
        });
    }
    
    // 处理边数据
    if (rawData.data.graph_edges) {
        Object.entries(rawData.data.graph_edges).forEach(([edgeId, edgeData]) => {
            try {
                const [source, target] = edgeId.split(',');
                edges.push({ source, target });
                console.log(`添加边: ${source} -> ${target}`);
            } catch (e) {
                console.error(`处理边 ${edgeId} 时出错:`, e);
            }
        });
    }

    const processedData = { nodes, edges };
    console.log(`处理完成: ${nodes.length}个节点, ${edges.length}条边`);
    
    // 更新节点和边的计数
    nodeCount.value = nodes.length;
    linkCount.value = edges.length;
    
    return processedData;
  } catch (error) {
    console.error(`加载数据失败:`, error);
    return null;
  }
}

// 实体创建函数
function createSatelliteEntities(frameData) {
  if (!frameData || !frameData.nodes || !frameData.nodes.length) {
    console.error('没有有效的节点数据');
    return;
  }
  
  console.log(`开始创建实体，节点数: ${frameData.nodes.length}`);
  
  frameData.nodes.forEach(node => {
    try {
      // 避免重复创建
      if (viewer.entities.getById(node.id)) {
        return;
      }
      
      // 根据节点类型使用不同的模型和坐标处理
      switch (node.type) {
        case 'satellite':
          // 卫星节点 - 使用模型，xyz坐标
          viewer.entities.add({
            id: node.id,
            name: node.id,
            show: showSatellite.value, // 设置初始可见性
            position: new Cesium.Cartesian3(
              parseFloat(node.position[0]) * 1000, 
              parseFloat(node.position[1]) * 1000, 
              parseFloat(node.position[2]) * 1000
            ),
            model: {
              uri: "/satellite_model/Satellite.gltf",
              scale: 50,
              minimumPixelSize: 50,
            }
          });
          break;
        
        case 'station':
          // 地面站节点 - 使用图标，经纬度
          viewer.entities.add({
            id: node.id,
            name: node.id,
            show: showStation.value, // 设置初始可见性
            position: Cesium.Cartesian3.fromDegrees(
              parseFloat(node.position[0]),
              parseFloat(node.position[1]),
              10 // 高度提高确保可见
            ),
            billboard: {
              image: "/satellite_model/地面站.png",
              scale: 0.1,
              verticalOrigin: Cesium.VerticalOrigin.CENTER
            }
          });
          break;
          
        case 'roadm':
          // ROADM节点 - 使用图标，经纬度
          viewer.entities.add({
            id: node.id,
            name: node.id,
            show: showRoadm.value, // 设置初始可见性
            position: Cesium.Cartesian3.fromDegrees(
              parseFloat(node.position[0]),
              parseFloat(node.position[1]),
              10 // 高度提高确保可见
            ),
            billboard: {
              image: "/satellite_model/核心交换机.png",
              scale: 0.05,
              verticalOrigin: Cesium.VerticalOrigin.CENTER
            }
          });
          break;
      }
    } catch (error) {
      console.error(`创建节点 ${node.id} 失败:`, error);
    }
  });
}


// 新增函数：添加所有ROADM链路（在初始化时调用）
function addRoadmLinks(frameData) {
    if (!frameData || !frameData.edges || !frameData.nodes) {
        console.warn("无法添加地面链路，缺少边或节点数据。");
        return;
    }
    
    console.log("添加地面链路...");
    
    // 筛选出所有地面节点间的链路
    const groundEdges = frameData.edges.filter(edge => {
        const sourceNode = frameData.nodes.find(n => n.id === edge.source);
        const targetNode = frameData.nodes.find(n => n.id === edge.target);
        return sourceNode && targetNode && 
               (sourceNode.type === 'roadm' || sourceNode.type === 'station' ||
                targetNode.type === 'roadm' || targetNode.type === 'station');
    });
    
    let roadmToRoadmCount = 0;
    let stationToRoadmCount = 0;
    
    groundEdges.forEach(edge => {
        const sourceNode = frameData.nodes.find(n => n.id === edge.source);
        const targetNode = frameData.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return;
        
        // 首先检查是否有卫星节点，如果有就跳过
        if (sourceNode.type === 'satellite' || targetNode.type === 'satellite') {
            return; // 卫星相关的链路不在这里处理，而是在点击卫星时处理
        }
        
        // 获取节点位置
        const getPosition = (node) => {
            if (node.type === 'satellite') {
                return new Cesium.Cartesian3(
                    parseFloat(node.position[0]) * 1000,
                    parseFloat(node.position[1]) * 1000,
                    parseFloat(node.position[2]) * 1000
                );
            } else { // 'station' or 'roadm'
                return Cesium.Cartesian3.fromDegrees(
                    parseFloat(node.position[0]),
                    parseFloat(node.position[1]),
                    10
                );
            }
        };
        
        const sourcePosition = getPosition(sourceNode);
        const targetPosition = getPosition(targetNode);
        
        // 根据链路两端节点类型决定颜色
        let linkColor;
        let linkId;
        
        // ROADM与ROADM之间：绿色
        if (sourceNode.type === 'roadm' && targetNode.type === 'roadm') {
            linkColor = Cesium.Color.GREEN.withAlpha(0.7);
            linkId = `roadm-roadm-link-${edge.source}-${edge.target}`;
            roadmToRoadmCount++;
        }
        // 地面站与ROADM之间：黄色
        else if ((sourceNode.type === 'station' && targetNode.type === 'roadm') ||
                 (sourceNode.type === 'roadm' && targetNode.type === 'station')) {
            linkColor = Cesium.Color.YELLOW.withAlpha(0.7);
            linkId = `station-roadm-link-${edge.source}-${edge.target}`;
            stationToRoadmCount++;
        }
        // 其他地面节点间链路（如地面站与地面站）：蓝色
        else {
            linkColor = Cesium.Color.LIGHTSKYBLUE.withAlpha(0.7);
            linkId = `other-ground-link-${edge.source}-${edge.target}`;
        }
        
        // 添加连线实体
        viewer.entities.add({
            id: linkId,
            // 根据链路两端节点类型设置初始可见性
            show: (sourceNode.type === 'roadm' && targetNode.type === 'roadm') ? 
              showRoadm.value : 
              (sourceNode.type === 'station' || targetNode.type === 'roadm') && 
              (targetNode.type === 'station' || targetNode.type === 'roadm') ? 
                (showStation.value && showRoadm.value) : true,
            polyline: {
                positions: [sourcePosition, targetPosition],
                width: 1.5,
                material: linkColor,
                arcType: Cesium.ArcType.GEODESIC,
                clampToGround: true
            }
        });
    });
    
    console.log(`已添加地面链路: ${roadmToRoadmCount} 条ROADM-ROADM链路(绿色), ${stationToRoadmCount} 条站点-ROADM链路(黄色)`);
}

// 修改highlightSatelliteLinks函数，避免清除ROADM链路
function highlightSatelliteLinks(satelliteId, frameData) {
    // 1. 清除之前的高亮链路（但保留ROADM链路）
    highlightedLinks.forEach(entity => viewer.entities.remove(entity));
    highlightedLinks = [];

    const { nodes, edges } = frameData;
    if (!edges || !nodes) return;

    // 2. 找到所有与该卫星相关的链路
    const relatedEdges = edges.filter(edge => 
        edge.source === satelliteId || edge.target === satelliteId
    );

    console.log(`高亮卫星 ${satelliteId} 的 ${relatedEdges.length} 条链路...`);

    // 3. 为每个相关链路创建红色高亮线条
    relatedEdges.forEach(edge => {
        // 跳过已经作为地面链路显示的边
        const roadmRoadmLinkId = `roadm-roadm-link-${edge.source}-${edge.target}`;
        const stationRoadmLinkId = `station-roadm-link-${edge.source}-${edge.target}`;
        const otherLinkId = `other-link-${edge.source}-${edge.target}`;
        
        // 检查是否已存在地面链路
        if (viewer.entities.getById(roadmRoadmLinkId) || 
            viewer.entities.getById(stationRoadmLinkId) || 
            viewer.entities.getById(otherLinkId)) {
            return; // 如果已经是地面链路，就不再高亮显示
        }
        
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return;

        // 根据节点类型获取其三维坐标
        const getPosition = (node) => {
            if (node.type === 'satellite') {
                return new Cesium.Cartesian3(
                    parseFloat(node.position[0]) * 1000,
                    parseFloat(node.position[1]) * 1000,
                    parseFloat(node.position[2]) * 1000
                );
            } else { // 'station' or 'roadm'
                return Cesium.Cartesian3.fromDegrees(
                    parseFloat(node.position[0]),
                    parseFloat(node.position[1]),
                    10
                );
            }
        };

        const sourcePosition = getPosition(sourceNode);
        const targetPosition = getPosition(targetNode);

        // 添加红色高亮连线实体
        const highlightEntity = viewer.entities.add({
            polyline: {
                positions: [sourcePosition, targetPosition],
                width: 2,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.NONE,
            },
            // 根据链路两端节点类型设置初始可见性
            show: (sourceNode.type === 'satellite' && targetNode.type === 'satellite') ? 
              showSatellite.value : 
              (sourceNode.type === 'satellite' && targetNode.type === 'station') || 
              (sourceNode.type === 'station' && targetNode.type === 'satellite') ? 
                (showSatellite.value && showStation.value) :
                (showSatellite.value && showRoadm.value)
        });
        highlightedLinks.push(highlightEntity);
    });
}

// 更新可见性函数
function updateVisibility() {
  if (!viewer) return;
  
  console.log("更新可见性:", { 
    卫星: showSatellite.value, 
    地面站: showStation.value, 
    ROADM: showRoadm.value 
  });
  
  // 遍历所有实体，根据类型和当前设置决定是否显示
  viewer.entities.values.forEach(entity => {
    if (!entity.id) return;
    const entityId = entity.id.toString();
    
    // 首先判断实体是什么类型的节点
    const isSatellite = entityId.startsWith('satellite');
    const isStation = !entityId.startsWith('satellite') && !entityId.startsWith('ROADM') && 
                     (entity.billboard && entity.billboard.image && 
                     String(entity.billboard.image.getValue())?.includes('地面站'));
    const isRoadm = entityId.startsWith('ROADM') || 
                   (entity.billboard && entity.billboard.image && 
                   String(entity.billboard.image.getValue())?.includes('核心交换机'));
    
    // 处理链路（通过ID前缀判断）
    const isRoadmRoadmLink = entityId.includes('roadm-roadm-link');
    const isStationRoadmLink = entityId.includes('station-roadm-link');
    const isSatelliteLink = entity.polyline && !isRoadmRoadmLink && !isStationRoadmLink;
    
    // 设置可见性
    if (isSatellite) {
      entity.show = showSatellite.value;
    } 
    else if (isStation) {
      entity.show = showStation.value;
    }
    else if (isRoadm) {
      entity.show = showRoadm.value;
    }
    // 处理链路可见性 - 修正判断逻辑
    else if (isRoadmRoadmLink) {
      // ROADM-ROADM链路：只有当ROADM可见时才显示
      entity.show = showRoadm.value;
    }
    else if (isStationRoadmLink) {
      // 地面站-ROADM链路：只有当地面站和ROADM都可见时才显示
      entity.show = showStation.value && showRoadm.value;
    }
    else if (isSatelliteLink) {
      // 卫星相关链路
      const linkId = entityId;
      if (linkId.includes('satellite') && !linkId.includes('ROADM') && !linkId.includes('station')) {
        // 卫星到卫星链路：只有当卫星可见时才显示
        entity.show = showSatellite.value;
      }
      else if (linkId.includes('satellite') && linkId.includes('station')) {
        // 卫星到地面站链路：只有当卫星和地面站都可见时才显示
        entity.show = showSatellite.value && showStation.value;
      }
      else if (linkId.includes('satellite') && linkId.includes('ROADM')) {
        // 卫星到ROADM链路：只有当卫星和ROADM都可见时才显示
        entity.show = showSatellite.value && showRoadm.value;
      }
    }
  });
  
  // 强制重新渲染
  viewer.scene.requestRender();
}

onMounted(async () => {
    let graphData = null; // 在 onMounted 作用域内保存数据
    try {
        // 初始化 Cesium viewer
        viewer = new Cesium.Viewer("cesiumContainer", {
            // 先不使用地形，减少加载问题
            // terrainProvider: await Cesium.createWorldTerrainAsync(),
            animation: false,
            timeline: false,
            fullscreenButton: false,
            baseLayerPicker: false,
        });

        // 设置初始视角
        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 20000000.0),
            orientation: {
                heading: 0.0,
                pitch: -Math.PI/2,
                roll: 0.0
            }
        });
        
        // 添加图像层 - 使用OpenStreetMap
        viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
            })
        );
        
        // 清除现有实体
        viewer.entities.removeAll();
        viewer.scene.primitives.removeAll();
        
        // 开始渲染第一帧
        console.log("开始加载初始数据...");
        const data = await loadGraphData(0);
        graphData = data; // 保存数据以供点击事件使用
        
        if (data && data.nodes && data.nodes.length > 0) {
            console.log(`创建实体，节点数量: ${data.nodes.length}`);
            createSatelliteEntities(data);
            
            // 添加地面链路（改名后的函数）
            addRoadmLinks(data);
            
            // !!! 移除这里的 addLinks 调用，不再默认显示所有链路
            // addLinks(data); 
            
            // !!! 移除这里的 addLink 循环
            /*
            if (data.edges && data.edges.length > 0) {
                console.log(`添加连线，数量: ${data.edges.length}`);
                data.edges.forEach(edge => addLink(edge, data.nodes, viewer));
            }
            */
            
            // 强制渲染
            viewer.scene.requestRender();
            console.log("初始化完成，场景应该已渲染");
        } else {
            console.error("没有获取到任何节点数据!");
        }

        // 初始化事件处理器（使用全局变量）
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        // 设置点击事件（只保留此处的一个处理器设置）
        handler.setInputAction(function(click) {
            const pickedObject = viewer.scene.pick(click.position);
            // 检查是否点中了实体
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                const entity = pickedObject.id;
                // 检查实体是否是卫星
                if (entity.id && entity.id.startsWith('satellite')) {
                    highlightSatelliteLinks(entity.id, graphData || currentGraphData);
                } else {
                    // 如果点击的不是卫星，则清除高亮
                    highlightedLinks.forEach(e => viewer.entities.remove(e));
                    highlightedLinks = [];
                }
            } else {
                // 如果点击了空白处，也清除高亮
                highlightedLinks.forEach(e => viewer.entities.remove(e));
                highlightedLinks = [];
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    } catch (err) {
        console.error("初始化过程中出错:", err);
    }
    console.log("初始化更新可见性");
    updateVisibility();
});

// 确保在组件卸载时清除计时器
onUnmounted(() => {

  if (playbackTimer) {
    clearTimeout(playbackTimer);
  }
  
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
  }
});

// 添加这些缺失的变量声明（放在其他全局变量附近）
let animationInProgress = false; // 控制动画是否正在进行
let previousFrameData = null;    // 上一帧数据
let currentGraphData = null;     // 当前帧数据
const dataCache = {};            // 数据缓存对象

// 添加切换播放/暂停状态的函数
function togglePlayback() {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    // 开始播放
    playNextFrame();
  } else {
    // 暂停播放
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
}

// 播放下一帧
function playNextFrame() {
  if (!isPlaying.value) return;
  
  // 如果动画正在进行中，等待它完成
  if (animationInProgress) {
    playbackTimer = setTimeout(playNextFrame, 100);
    return;
  }
  
  const nextTimeFrame = timeFrame.value >= maxTimeFrame ? 1 : timeFrame.value + 1;
  loadTimeFrame(nextTimeFrame);
  
  // 设置下一帧的计时器（在动画完成后才加载下一帧）
  playbackTimer = setTimeout(() => {
    playNextFrame();
  }, TRANSITION_DURATION + 500); // 动画时长 + 额外缓冲时间
}

// 添加加载时间帧函数
async function loadTimeFrame(frame) {
  console.log(`加载时间帧: ${frame}分钟`);
  
  // 如果有正在进行的动画，取消它
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
    currentAnimationFrame = null;
  }
  
  try {
    // 更新显示的时间帧
    timeFrame.value = frame;
    
    // 计算文件名 (第1分钟对应60.00.json，第2分钟对应120.00.json，以此类推)
    const filename = `./data/network_state_${frame * 60}.00.json`;
    
    // 加载数据
    let data;
    if (dataCache[filename]) {
      data = dataCache[filename];
      console.log("使用缓存的数据");
    } else {
      data = await loadGraphData(filename);
      if (data) dataCache[filename] = data;
    }
    
    if (!data) return;
    
    // 保存当前相机位置
    const cameraPosition = viewer.camera.position.clone();
    const cameraHeading = viewer.camera.heading;
    const cameraPitch = viewer.camera.pitch;
    const cameraRoll = viewer.camera.roll;
    
    // 保存当前帧数据供点击事件使用
    currentGraphData = data;
    
    // 如果是第一次加载，直接创建实体
    if (previousFrameData === null) {
      viewer.entities.removeAll();
      highlightedLinks = [];
      createSatelliteEntities(data);
      addRoadmLinks(data);
      
      // 恢复相机位置
      viewer.camera.setView({
        destination: cameraPosition,
        orientation: {
          heading: cameraHeading,
          pitch: cameraPitch,
          roll: cameraRoll
        }
      });
      
      previousFrameData = data;
      updateVisibility();
      return;
    }
    
    // 开始平滑过渡动画
    animateTransition(previousFrameData, data);
    
    // 立即开始预加载下一帧
    const nextFrame = frame >= maxTimeFrame ? 1 : frame + 1;
    const nextFilename = `./data/network_state_${nextFrame * 60}.00.json`;
    setTimeout(async () => {
      if (!dataCache[nextFilename]) {
        console.log(`预加载下一帧: ${nextFrame}分钟`);
        dataCache[nextFilename] = await loadGraphData(nextFilename);
      }
    }, PRELOAD_DELAY);
    
  } catch (error) {
    console.error(`加载时间帧失败:`, error);
  }
}

// 确保在 onMounted 函数末尾添加初始帧加载
onMounted(async () => {
    // ...现有代码...
    
    // 在初始化完成后，加载第一帧数据
    await loadTimeFrame(1);
});
</script>

<style>
/* 添加时间控制器样式 */
.timeline-control {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-control button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 5px;
  border-radius: 3px;
  cursor: pointer;
}

.timeline-control button:hover {
  background-color: #45a049;
}

.timeline-control button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.timeline-control input[type="range"] {
  width: 100%;
  margin: 5px 0;
}

.time-display {
  text-align: center;
  font-weight: bold;
}
#cesiumContainer {
    width: 100%;
    height: 100%;
    position: relative;
}
.frame-info {
    position: absolute;
    top: 10px;
    left: 10px;
    background-color: rgba(40, 40, 40, 0.7);
    color: white;
    padding: 5px;
    border-radius: 5px;
}

.progress-info {
    margin-top: 5px;
    font-weight: bold;
    color: #f39c12;
}

/* 已删除 .progress-bar-container 及相关样式 */

/* 添加控制面板样式 */
.control-panel {
  position: absolute;
  top: 10px;
  left: 10px; /* 改为left */
  background-color: rgba(40, 40, 40, 0.7);
  padding: 10px;
  border-radius: 5px;
  color: white;
  z-index: 1000;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.toggle-item input {
  cursor: pointer;
}

.toggle-item label {
  cursor: pointer;
  user-select: none;
}
</style>
