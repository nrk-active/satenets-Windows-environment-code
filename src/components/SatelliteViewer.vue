<template>
    <div id="cesiumContainer">
        <div class="frame-info">
            当前帧: {{ currentFrameDisplay }} / {{ MAX_FRAMES_CACHE }}
        </div>
    </div>
</template>

<script setup>
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, ref, onUnmounted } from "vue";

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwZmE2NzBlMC0xYTcwLTQ5NjAtOTA3Yi0wZDI2ZmI5N2MwNTAiLCJpZCI6Mjg1MzIwLCJpYXQiOjE3NDY4NDkwNTB9.UsqfBioefpZ3XRc6C5Fc-UonG7jyjtPJs_binCkkPZk';

// 全局变量
let viewer;
const MAX_FRAMES_CACHE = 6; // 最大缓存帧数
const POLLING_INTERVAL = 5000; // 轮询间隔
const framesCache = []; // 帧缓存
let isInitialLoading = true; // 是否是初始加载
let pollingTimer = null; // 轮询定时器
let isRequesting = false; // 请求锁
let currentCounter = 0; // 当前请求的帧号
const currentFrameDisplay = ref(0); // 当前显示的帧索引

// 加载单帧数据
async function loadGraphData(counter) {
    try {
        console.log(`请求第 ${counter} 帧数据`);
        const response = await fetch('/api/simulators/9/network/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ counter }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 添加详细的响应数据打印
        console.log('完整响应数据:', data);
        console.groupEnd();

        return data;
    } catch (error) {
        console.error(`加载第 ${counter} 帧数据失败:`, error);
        return null;
    }
}

// 创建卫星实体
function createSatelliteEntities(frameData) {
    if (!frameData?.nodes) return;

    frameData.nodes.forEach(node => {
        if (node.id.includes('ground_station')) return;

        try {
            if (!viewer.entities.getById(node.id)) {
                const x = parseFloat(node.position[0]) * 1000;
                const y = parseFloat(node.position[1]) * 1000;
                const z = parseFloat(node.position[2]) * 1000;

                viewer.entities.add({
                    id: node.id,
                    name: node.id,
                    position: new Cesium.Cartesian3(x, y, z),
                    model: {
                        uri: "/public/satellite_model/Satellite.gltf",
                        scale: 100,
                    },
                    label: {
                        text: node.id,
                        font: '14px sans-serif',
                        pixelOffset: new Cesium.Cartesian2(0, 20),
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    },
                });
            }
        } catch (error) {
            console.error(`创建卫星 ${node.id} 时出错:`, error);
        }
    });
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
function updateSatellitePositions(currentData, nextData) {
    if (!currentData?.nodes || !nextData?.nodes) {
        console.warn('缺少帧数据，跳过更新');
        return;
    }

    const currentTime = viewer.clock.currentTime;
    const startTime = viewer.clock.startTime;
    const totalSeconds = Cesium.JulianDate.secondsDifference(currentTime, startTime);
    const fraction = (totalSeconds % 1.0 + 1.0) % 1.0; // 确保 fraction 在 [0,1) 范围内

    console.log('插值比例:', fraction); // 添加调试信息

    currentData.nodes.forEach(currentNode => {
        if (currentNode.id.includes('ground_station')) return;

        const nextNode = nextData.nodes.find(node => node.id === currentNode.id);
        const entity = viewer.entities.getById(currentNode.id);

        if (entity && nextNode) {
            try {
                const interpolatedPosition = new Cesium.Cartesian3(
                    Cesium.Math.lerp(parseFloat(currentNode.position[0]) * 1000, 
                                   parseFloat(nextNode.position[0]) * 1000, 
                                   fraction),
                    Cesium.Math.lerp(parseFloat(currentNode.position[1]) * 1000, 
                                   parseFloat(nextNode.position[1]) * 1000, 
                                   fraction),
                    Cesium.Math.lerp(parseFloat(currentNode.position[2]) * 1000, 
                                   parseFloat(nextNode.position[2]) * 1000, 
                                   fraction)
                );
                entity.position = interpolatedPosition;
            } catch (error) {
                console.error(`更新卫星 ${currentNode.id} 位置时出错:`, error);
            }
        }
    });

    viewer.scene.requestRender();
}


// 轮询数据
async function startPolling() {
    if (isRequesting) return;

    try {
        isRequesting = true;

        if (isInitialLoading) {
            console.log('开始初始加载6帧数据...');
            framesCache.length = 0;

            for (let i = 0; i < MAX_FRAMES_CACHE; i++) {
                const frameData = await loadGraphData(currentCounter++);
                if (frameData) {
                    framesCache.push(frameData);
                } else {
                    console.error(`初始加载第 ${i} 帧失败`);
                    return;
                }
            }

            createSatelliteEntities(framesCache[0]);
            isInitialLoading = false;
            console.log('完成初始加载');
        } else {
            const newFrameData = await loadGraphData(currentCounter++);
            if (newFrameData) {
                framesCache.shift();
                framesCache.push(newFrameData);
                console.log(`更新缓存：添加第 ${currentCounter - 1} 帧`);
            } else {
                console.error('加载新帧数据失败');
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
        animation: true,
        timeline: true,
        fullscreenButton: false,
    });

    // const start = Cesium.JulianDate.fromDate(new Date());
    // const stop = Cesium.JulianDate.addSeconds(start, MAX_FRAMES_CACHE - 1, new Cesium.JulianDate());

    // viewer.clock.startTime = start.clone();
    // viewer.clock.stopTime = stop.clone();
    // viewer.clock.currentTime = start.clone();
    // viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    // viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
    // viewer.clock.multiplier = 0.5;
    // viewer.clock.shouldAnimate = true;

    // viewer.clock.onTick.addEventListener(() => {
    //     if (framesCache.length === MAX_FRAMES_CACHE && !isInitialLoading) {
    //         const currentTime = viewer.clock.currentTime;
    //         const startTime = viewer.clock.startTime;
    //         const totalSeconds = Cesium.JulianDate.secondsDifference(currentTime, startTime);
    //         const frameIndex = Math.floor(totalSeconds % (MAX_FRAMES_CACHE - 1));

    //         if (frameIndex !== currentFrameDisplay.value) {
    //             updateSatellitePositions(framesCache[frameIndex], framesCache[frameIndex + 1]);
    //             currentFrameDisplay.value = frameIndex;
    //         }
    //     }
    // });

    const start = Cesium.JulianDate.fromDate(new Date());
    const stop = Cesium.JulianDate.addSeconds(start, MAX_FRAMES_CACHE * 2, new Cesium.JulianDate());

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
    viewer.clock.multiplier = 1.0; // 调整速度
    viewer.clock.shouldAnimate = true;

    // 修改时钟监听事件
    viewer.clock.onTick.addEventListener(() => {
        if (framesCache.length === MAX_FRAMES_CACHE && !isInitialLoading) {
            const currentTime = viewer.clock.currentTime;
            const startTime = viewer.clock.startTime;
            const totalSeconds = Cesium.JulianDate.secondsDifference(currentTime, startTime);
            const frameIndex = Math.floor(totalSeconds) % (MAX_FRAMES_CACHE - 1);
            
            console.log('帧索引:', frameIndex); // 添加调试信息

            if (frameIndex !== currentFrameDisplay.value) {
                updateSatellitePositions(framesCache[frameIndex], framesCache[frameIndex + 1]);
                currentFrameDisplay.value = frameIndex;
            }
        }
    });

    await startPolling();
    pollingTimer = setInterval(startPolling, POLLING_INTERVAL);
});

// 清理
onUnmounted(() => {
    if (pollingTimer) clearInterval(pollingTimer);
    if (viewer) viewer.destroy();
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
</style>