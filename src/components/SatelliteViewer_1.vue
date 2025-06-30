<template>
  <div id="cesiumContainer">
    <!-- 修改进度条容器 -->
    <div v-if="simulationProgress < 1" class="progress-bar-container">
      <div class="progress-label">仿真进度</div>
      <div class="progress-bar-vertical">
        <div 
          class="progress-bar-fill"
          :style="{ height: `${Math.round(simulationProgress * 100)}%` }"
        ></div>
      </div>
      <div class="progress-text">{{ Math.round(simulationProgress * 100) }}%</div>
    </div>
  </div>
</template>

<script setup>
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, ref, onUnmounted } from "vue";
import topoData from '../../topo.json';
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5ZmExMzZkNC1hMGI2LTQ0ZTUtYTA2OS1lMTRkYWFlYTAyZWUiLCJpZCI6MzEyNjQzLCJpYXQiOjE3NTAwNzUyNDB9.-9M-9Wqg-IH2FBXb12RsWEMBXSFTOvKOISePRAZsSy8';
const nodeCount = ref(0);
const linkCount = ref(0);
// 全局变量
let viewer;
const MAX_FRAMES_CACHE = 2; // 最大缓存帧数
const POLLING_INTERVAL = 2000; // 轮询间隔（减少到2秒）
const ANIMATION_DURATION = 4000; // 动画持续时间(毫秒)（减少到4秒）
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
let animationFrame = null; // 用于控制动画
let isPlaying = false; // 动画播放状态

// 保存卫星和连线实体引用
const satelliteEntities = [];
const satelliteLinkEntities = [];

const simulationProgress = ref(0);
let progressPollingTimer = null;

// 添加一个变量存储 simulator ID
const simulatorId = ref(null);

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

// 修改 loadGraphData 函数
async function loadGraphData(counter) {
    try {
        const id = await getSimulatorId();
        console.log(`请求第 ${counter} 帧数据`);
        const response = await fetch(`/api/simulators/${id}/network/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ counter }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`成功获取第 ${counter} 帧数据:`, data);
        
        // 更新节点和链路计数
        if (data.nodes) {
            nodeCount.value = data.nodes.length;
            console.log(`节点数量: ${data.nodes.length}`);
        }
        if (data.links) {
            linkCount.value = data.links.length;
            console.log(`链路数量: ${data.links.length}`);
        }

        return data;
    } catch (error) {
        console.error(`加载第 ${counter} 帧数据失败:`, error);
        return null;
    }
}




// 创建卫星实体
function createSatelliteEntities(frameData) {
    if (!frameData?.nodes) {
        console.warn('没有节点数据');
        return;
    }

    console.log(`开始创建卫星实体，总节点数: ${frameData.nodes.length}`);
    
    let satelliteCount = 0;
    frameData.nodes.forEach(node => {
        if (node.id.includes('ground_station')) {
            console.log(`跳过地面站节点: ${node.id}`);
            return;
        }
        satelliteCount++;

        try {
            if (!viewer.entities.getById(node.id)) {
                const x = parseFloat(node.position[0]) * 1000;
                const y = parseFloat(node.position[1]) * 1000;
                const z = parseFloat(node.position[2]) * 1000;

                const entity = viewer.entities.add({
                    id: node.id,
                    name: node.id,
                    position: new Cesium.Cartesian3(x, y, z),
                    model: {
                        uri: "/satellite_model/Satellite.gltf",
                        scale: 100,
                        minimumPixelSize: 32,
                        maximumScale: 2000,
                    },
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        heightReference: Cesium.HeightReference.NONE,
                        show: true
                    },
                    description: new Cesium.CallbackProperty(() => {
                        const position = viewer.entities.getById(node.id).position.getValue(viewer.clock.currentTime);
                        if (!position) return '';
                        
                        // 将米转换为千米并保留2位小数
                        const positionKm = {
                            x: (position.x / 1000).toFixed(2),
                            y: (position.y / 1000).toFixed(2),
                            z: (position.z / 1000).toFixed(2)
                        };
                        
                        return `
                            <table class="cesium-infoBox-defaultTable">
                                <tr><th>卫星ID</th><td>${node.id}</td></tr>
                                <tr><th>X (km)</th><td>${positionKm.x}</td></tr>
                                <tr><th>Y (km)</th><td>${positionKm.y}</td></tr>
                                <tr><th>Z (km)</th><td>${positionKm.z}</td></tr>
                            </table>
                        `;
                    }, false)
                });
                
                console.log(`创建卫星实体: ${node.id}, 位置: (${x/1000}km, ${y/1000}km, ${z/1000}km)`);
            }
        } catch (error) {
            console.error(`创建卫星 ${node.id} 时出错:`, error);
        }
    });
    
    console.log(`成功创建 ${satelliteCount} 个卫星实体`);
    
    // 调整相机视角以显示卫星
    if (satelliteCount > 0) {
        setTimeout(() => {
            try {
                // 设置相机位置以查看卫星
                viewer.camera.setView({
                    destination: Cesium.Cartesian3.fromDegrees(0, 0, 15000000), // 15000km高度
                    orientation: {
                        heading: 0,
                        pitch: -Cesium.Math.PI_OVER_TWO,
                        roll: 0
                    }
                });
                console.log('相机视角已调整');
            } catch (error) {
                console.error('调整相机视角时出错:', error);
            }
        }, 500);
    }
    
    // 确保场景更新
    viewer.scene.requestRender();
}

// 更新卫星位置
// function updateSatellitePositions(currentData, nextData) {
//     if (!currentData?.nodes || !nextData?.nodes) return;

//     const currentTime = viewer.clock.currentTime;
//     const startTime = viewer.clock.startTime;
//     const totalSeconds = Cesium.JulianDate.secondsDifference(currentTime, startTime);
//     const fraction = totalSeconds - Math.floor(totalSeconds);

//     currentData.nodes.forEach(currentNode => {
//         const nextNode = nextData.nodes.find(node => node.id === currentNode.id);
//         const entity = viewer.entities.getById(currentNode.id);

//         if (entity && nextNode) {
//             const interpolatedPosition = new Cesium.Cartesian3(
//                 Cesium.Math.lerp(currentNode.position[0] * 1000, nextNode.position[0] * 1000, fraction),
//                 Cesium.Math.lerp(currentNode.position[1] * 1000, nextNode.position[1] * 1000, fraction),
//                 Cesium.Math.lerp(currentNode.position[2] * 1000, nextNode.position[2] * 1000, fraction)
//             );
//             entity.position = interpolatedPosition;
//         }
//     });

//     viewer.scene.requestRender();
// }
// 修改updateSatellitePositions函数
function updateSatellitePositions(currentData, nextData, fraction) {
    if (!currentData?.nodes || !nextData?.nodes) {
        console.warn('缺少帧数据，跳过更新');
        return;
    }

    // console.log(`正在更新位置，插值比例: ${fraction}`);

    currentData.nodes.forEach(currentNode => {
        if (currentNode.id.includes('ground_station')) return;

        const nextNode = nextData.nodes.find(node => node.id === currentNode.id);
        const entity = viewer.entities.getById(currentNode.id);

        if (entity && nextNode) {
            try {
                const interpolatedPosition = new Cesium.Cartesian3(
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
                );
                
                entity.position = interpolatedPosition;
            } catch (error) {
                console.error(`更新卫星 ${currentNode.id} 位置时出错:`, error);
            }
        }
    });
}


// 轮询数据
async function startPolling() {
    if (isRequesting || isPlaying) return;
    
    try {
        isRequesting = true;
        console.log('开始轮询，isInitialLoading:', isInitialLoading);
        
        if (isInitialLoading) {
            console.log('开始加载2帧初始数据...');
            framesCache.length = 0;
            
            // 加载初始2帧数据
            for (let i = 0; i < MAX_FRAMES_CACHE; i++) {
                const frameData = await loadGraphData(currentCounter++);
                if (frameData) {
                    framesCache.push(frameData);
                    console.log(`成功加载第 ${i + 1} 帧数据`);
                } else {
                    console.error(`初始加载第 ${i} 帧失败`);
                    return;
                }
            }
            
            console.log('创建卫星实体...');
            createSatelliteEntities(framesCache[0]);
            isInitialLoading = false;
            console.log('完成初始加载，准备开始动画');
            
            // 开始第一次动画
            if (calculateInterpolatedFrames()) {
                playAnimation();
                
                // 设置后续的定期轮询
                pollingTimer = setInterval(async () => {
                    if (!isPlaying) {
                        console.log('轮询新帧数据...');
                        const newFrameData = await loadGraphData(currentCounter++);
                        if (newFrameData) {
                            framesCache.shift(); // 移除最旧的帧
                            framesCache.push(newFrameData); // 添加新帧
                            console.log('更新帧缓存，开始新的动画');
                            if (calculateInterpolatedFrames()) {
                                playAnimation();
                            }
                        }
                    }
                }, ANIMATION_DURATION + 500); // 在动画完成后0.5秒开始下一次轮询
            }
        }
    } finally {
        isRequesting = false;
    }
}
// 初始化
onMounted(async () => {
    viewer = new Cesium.Viewer("cesiumContainer", {
        terrainProvider: await Cesium.createWorldTerrainAsync(),
        animation: false,
        timeline: false,
        fullscreenButton: false,
    });
    // window.addEventListener('start-satellite-polling', () => {
    //     console.log('收到开始信号');
    //     if (pollingTimer) {
    //         clearInterval(pollingTimer); // 清除已存在的轮询
    //     }
        
    //     // 10秒后开始第一次轮询
    //     setTimeout(() => {
    //         console.log('开始首次轮询');
    //         startPolling();
            
    //         // 设置后续的定期轮询
    //         pollingTimer = setInterval(() => {
    //             if (!isPlaying) {
    //                 loadGraphData(currentCounter++).then(newFrameData => {
    //                     if (newFrameData) {
    //                         framesCache.shift();
    //                         framesCache.push(newFrameData);
    //                         if (calculateInterpolatedFrames()) {
    //                             playAnimation();
    //                         }
    //                     }
    //                 });
    //             }
    //         }, 8000); // 10秒间隔
    //     }, 8000); // 8秒延迟
    // });
    // await startPolling(); // 初始加载
    // 设置轮询
    // pollingTimer = setInterval(async () => {
    //     if (!isPlaying) {
    //         const newFrameData = await loadGraphData(currentCounter++);
    //         if (newFrameData) {
    //             framesCache.shift();
    //             framesCache.push(newFrameData);
    //             if (calculateInterpolatedFrames()) {
    //                 playAnimation();
    //             }
    //         }
    //     }
    // }, POLLING_INTERVAL);

    // 删除重复的事件监听器，只保留一个，并更新代码如下：
    document.getElementById('topographyButton').addEventListener('click', () => {
        // 移除现有的图层和实体
        viewer.imageryLayers.removeAll();
        viewer.entities.removeAll();
        
        // 添加 OpenStreetMap 地图
        viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
                credit: '© OpenStreetMap contributors'
            })
        );

        // 切换到 Columbus 视图模式
        // viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
        viewer.scene.morphToColumbusView(2.0);

        // 添加节点
        const nodes = topoData.nodes;
        nodeCount.value = nodes.length;
        
        nodes.forEach(node => {
            viewer.entities.add({
                id: `node-${node.id}`,
                position: Cesium.Cartesian3.fromDegrees(
                    node.pos[0],  // 经度
                    node.pos[1],  // 纬度
                    1000         // 高度，用于确保节点在地图上方
                ),
                point: {
                    pixelSize: 4,
                    color: Cesium.Color.BLUE,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                label: {
                    text: node.name || node.id.toString(),
                    font: '12px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    show: false  // 默认不显示标签，鼠标悬停时显示
                }
            });
        });

        // 添加连线
        if (topoData.links) {
            linkCount.value = topoData.links.length;
            topoData.links.forEach(link => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);
                
                if (sourceNode && targetNode) {
                    viewer.entities.add({
                        polyline: {
                            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                                sourceNode.pos[0], sourceNode.pos[1], 1000,
                                targetNode.pos[0], targetNode.pos[1], 1000
                            ]),
                            width: 1.5,
                            material: new Cesium.PolylineOutlineMaterialProperty({
                                color: Cesium.Color.YELLOW.withAlpha(0.8),
                                outlineWidth: 0,
                                outlineColor: Cesium.Color.WHITE
                            })
                        }
                    });
                }
            });
        }

        // 设置相机视角
        // viewer.camera.setView({
        //     destination: Cesium.Rectangle.fromDegrees(
        //         70,   // 西边界经度
        //         15,   // 南边界纬度
        //         135,  // 东边界经度
        //         55    // 北边界纬度
        //     ),
        //     orientation: {
        //         heading: 0,
        //         pitch: Cesium.Math.toRadians(-30),
        //         roll: 0
        //     }
        // });

        // 添加鼠标事件处理
        viewer.screenSpaceEventHandler.setInputAction((movement) => {
            const pickedObject = viewer.scene.pick(movement.endPosition);
            // 显示/隐藏节点标签
            viewer.entities.values.forEach(entity => {
                if (entity.label) {
                    entity.label.show = entity === pickedObject?.id;
                }
            });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 修改卫星配置
        const satellitePositions = [
            // 第一行 - 北部
            { lon: 85, lat: 45, height: 3000000 },
            { lon: 100, lat: 45, height: 3000000 },
            { lon: 115, lat: 45, height: 3000000 },
            // 第二行 - 中部
            { lon: 85, lat: 35, height: 3000000 },
            { lon: 100, lat: 35, height: 3000000 },
            { lon: 115, lat: 35, height: 3000000 },
            // 第三行 - 南部
            { lon: 85, lat: 25, height: 3000000 },
            { lon: 100, lat: 25, height: 3000000 },
            { lon: 115, lat: 25, height: 3000000 }
        ];

        satellitePositions.forEach((satellite, index) => {
            // 先添加卫星
            const entity = viewer.entities.add({
                id: `satellite-${index}`,
                position: Cesium.Cartesian3.fromDegrees(
                    satellite.lon,
                    satellite.lat,
                    satellite.height
                ),
                model: {
                    uri: '../../satellite_model/Satellite.gltf',
                    minimumPixelSize: 64,
                    maximumScale: 2000,
                    scale: 10,
                    color: Cesium.Color.WHITE,
                    colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
                    silhouetteSize: 0.1,
                    silhouetteColor: Cesium.Color.YELLOW
                },
                label: {
                    text: `卫星-${index + 1}`,
                    font: '14px sans-serif',
                    fillColor: Cesium.Color.YELLOW,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    outlineColor: Cesium.Color.BLACK,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -20),
                    show: true,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            satelliteEntities.push(entity);
            // 初始连线
            const link = viewer.entities.add({
                id: `satellite-ground-link-${index}`,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        satellite.lon, satellite.lat, satellite.height,
                        0, 0, 0 // 先占位，后续会更新
                    ]),
                    width: 2,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.2,
                        color: Cesium.Color.RED.withAlpha(0.7)
                    })
                }
            });
            satelliteLinkEntities.push(link);
        });

        // 添加卫星间连接函数
        function connectSatellites(satellitePositions) {
            // 只连接相邻的卫星
            const satelliteLinks = [];
            
            for (let i = 0; i < satellitePositions.length; i++) {
                // 获取当前卫星的行和列位置（基于3x3网格）
                const row = Math.floor(i / 3);
                const col = i % 3;
                
                // 连接右侧卫星（如果存在）
                if (col < 2) {
                    const rightIndex = i + 1;
                    const link = viewer.entities.add({
                        id: `satellite-link-${i}-${rightIndex}`,
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                const fromEntity = viewer.entities.getById(`satellite-${i}`);
                                const toEntity = viewer.entities.getById(`satellite-${rightIndex}`);
                                if (fromEntity && toEntity) {
                                    return [
                                        fromEntity.position.getValue(Cesium.JulianDate.now()),
                                        toEntity.position.getValue(Cesium.JulianDate.now())
                                    ];
                                }
                                return [];
                            }, false),
                            width: 3,
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: Cesium.Color.YELLOW.withAlpha(0.7),
                                dashLength: 8.0
                            })
                        }
                    });
                    satelliteLinks.push(link);
                }
                
                // 连接下方卫星（如果存在）
                if (row < 2) {
                    const bottomIndex = i + 3;
                    const link = viewer.entities.add({
                        id: `satellite-link-${i}-${bottomIndex}`,
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                const fromEntity = viewer.entities.getById(`satellite-${i}`);
                                const toEntity = viewer.entities.getById(`satellite-${bottomIndex}`);
                                if (fromEntity && toEntity) {
                                    return [
                                        fromEntity.position.getValue(Cesium.JulianDate.now()),
                                        toEntity.position.getValue(Cesium.JulianDate.now())
                                    ];
                                }
                                return [];
                            }, false),
                            width: 3,
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: Cesium.Color.YELLOW.withAlpha(0.7),
                                dashLength: 8.0
                            })
                        }
                    });
                    satelliteLinks.push(link);
                }
                
                // 连接右下对角线卫星（如果存在）
                // if (row < 2 && col < 2) {
                //     const diagonalIndex = i + 4;
                //     const link = viewer.entities.add({
                //         id: `satellite-link-${i}-${diagonalIndex}`,
                //         polyline: {
                //             positions: new Cesium.CallbackProperty(() => {
                //                 const fromEntity = viewer.entities.getById(`satellite-${i}`);
                //                 const toEntity = viewer.entities.getById(`satellite-${diagonalIndex}`);
                //                 if (fromEntity && toEntity) {
                //                     return [
                //                         fromEntity.position.getValue(Cesium.JulianDate.now()),
                //                         toEntity.position.getValue(Cesium.JulianDate.now())
                //                     ];
                //                 }
                //                 return [];
                //             }, false),
                //             width: 3,
                //             material: new Cesium.PolylineDashMaterialProperty({
                //                 color: Cesium.Color.RED.withAlpha(0.7),
                //                 dashLength: 8.0
                //             })
                //         }
                //     });
                //     satelliteLinks.push(link);
                // }
            }
            
            return satelliteLinks;
        }

        // 定时移动卫星并更新连线
        setInterval(() => {
            satelliteEntities.forEach((entity, index) => {
                // 取当前经纬度
                const carto = Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now()));
                // 让经度缓慢增加，模拟移动
                let newLon = Cesium.Math.toDegrees(carto.longitude) + 0.05;
                let newLat = Cesium.Math.toDegrees(carto.latitude);
                const height = carto.height;
                
                // 限制在中国上空范围内
                if (newLon > 135) newLon = 73; // 如果超出东边界，回到西边界
                if (newLon < 73) newLon = 73;  // 确保不会低于西边界
                if (newLat > 53) newLat = 53;  // 确保不会超过北边界
                if (newLat < 18) newLat = 18;  // 确保不会低于南边界

                // 更新卫星位置
                entity.position = Cesium.Cartesian3.fromDegrees(newLon, newLat, height);

                // 计算最近地面节点
                let closestCity = null;
                let minDistance = Infinity;
                topoData.nodes.forEach(city => {
                    const distance = Math.sqrt(
                        Math.pow(newLon - city.pos[0], 2) +
                        Math.pow(newLat - city.pos[1], 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCity = city;
                    }
                });

                // 更新连线
                if (closestCity) {
                    satelliteLinkEntities[index].polyline.positions = Cesium.Cartesian3.fromDegreesArrayHeights([
                        newLon, newLat, height,
                        closestCity.pos[0], closestCity.pos[1], 1000
                    ]);
                }
            });
            
            // 强制刷新场景以更新卫星间连线
            viewer.scene.requestRender();
        }, 100); // 每100ms移动一次

        // 创建所有卫星后，添加卫星间连线
        const satelliteLinks = connectSatellites(satellitePositions);
    });

    document.getElementById('satButton').addEventListener('click', async () => {
        // 移除现有的影像图层和所有实体
        viewer.imageryLayers.removeAll();
        viewer.entities.removeAll();
        
    //     // 清理所有卫星实体和链路引用
    //     satelliteEntities.length = 0;
    //     satelliteLinkEntities.length = 0;
    //     isSimulationStarted = false;
    //     // 清理卫星模型
    //     satelliteModels.forEach(entity => {
    //         if (viewer && viewer.entities && viewer.entities.contains(entity)) {
    //             viewer.entities.remove(entity);
    //         }
    //     });
    //     satelliteModels = [];
        
        // 确保切换到3D球体视图
        viewer.scene.mode = Cesium.SceneMode.SCENE3D;
        viewer.scene.morphTo3D(2.0);
        
        // 添加默认的Cesium World Terrain
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
        
    //     // 添加Bing Maps影像
    //     // viewer.imageryLayers.addImageryProvider(
    //     //     new Cesium.IonImageryProvider({
    //     //         assetId: 2 // Bing Maps Aerial
    //     //     })
    //     // );
    //     // Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NDRkYzY1Yi1hYWY3LTQzNTktYTM3OS1jYjc5NGZhMjk3MjgiLCJpZCI6Mjg1MzIwLCJpYXQiOjE3NDcwNzEwNTF9.5oNDHQAO_4-1eVso40xl8g-gCVvENM6Q8VFc8DrhsdE';

        Cesium.IonImageryProvider.fromAssetId(2).then((provider) => {
            viewer.imageryLayers.addImageryProvider(provider);
        }).catch((error) => {
            console.error('影像图层加载失败', error);
        });

        // 强制刷新场景
        viewer.scene.requestRender();
        
        // 设置默认视角 - 调整为与初始视图一致
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(110, 30, 20000000), // 根据图二调整经纬度和高度
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-90.0),
                roll: 0.0
            },
            duration: 2.0, // 动画持续时间

        });
        
        // 重置相关变量
        currentCounter = 0;
        framesCache.length = 0;
        interpolatedFrames.length = 0;
        isInitialLoading = true;
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        isPlaying = false;
        if (progressPollingTimer) {
            clearInterval(progressPollingTimer);
            progressPollingTimer = null;
        }
        simulationProgress.value = 0;
        
        // 强制刷新视图
        viewer.scene.requestRender();
    });


    // document.getElementById('satButton').addEventListener('click', () => {
    //     // 移除现有的影像图层
    //     viewer.imageryLayers.removeAll();
        
        
    //     // 确保切换到3D球体视图
    //     viewer.scene.mode = Cesium.SceneMode.SCENE3D;
    //     viewer.scene.morphTo3D(2.0);
        
        

    //     // 设置默认视角
    //     viewer.camera.setView({
    //         destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
    //         orientation: {
    //             heading: Cesium.Math.toRadians(0),
    //             pitch: Cesium.Math.toRadians(-90),
    //             roll: 0
    //         }
    //     });

    //     // 添加默认地球纹理
    //     const imageryProvider = new Cesium.TileMapServiceImageryProvider({
    //         url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    //     });
        
    //     viewer.imageryLayers.addImageryProvider(imageryProvider);
    //     viewer.camera.setView({
    //         destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9042, 20000000), // 设置一个默认位置
    //         orientation: {
    //             heading: 0,
    //             pitch: -Cesium.Math.PI_OVER_TWO,
    //             roll: 0
    //         }
    //     });

    //     // 强制刷新视图
    //     viewer.scene.requestRender();
        
    // });
});

// 清理
onUnmounted(() => {
    window.removeEventListener('start-satellite-polling', startPolling);
    if (pollingTimer) clearInterval(pollingTimer);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (viewer) viewer.destroy();
    if (progressPollingTimer) clearInterval(progressPollingTimer);
});
</script>

<style>
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

.progress-bar-container {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.progress-label {
  color: white;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 5px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  background-color: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
}

.progress-bar-vertical {
  width: 8px;
  height: 200px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.progress-bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #f39c12;
  transition: height 0.3s ease;
  border-radius: 4px;
}

.progress-text {
  color: white;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

/* 可以移除之前的进度信息样式 */
.frame-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(40, 40, 40, 0.7);
  padding: 5px;
  border-radius: 5px;
}

.progress-info {
  display: none; /* 隐藏原来的进度显示 */
}
</style>
