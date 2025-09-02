// src/composables/useAnimation.js
import { ref } from 'vue';
import * as Cesium from "cesium";
import { ANIMATION_CONFIG, SIMULATION_CONFIG } from '../constants/index.js';

export function useAnimation(timelineControlRef = null) {
  const isPlaying = ref(false);
  const timeFrame = ref(1);
  const animationInProgress = ref(false);
  const instantMode = ref(false); // 新增：瞬间模式控制
  
  let currentAnimationFrame = null;
  let playbackTimer = null;
  let previousFrameData = null;
  
  // 添加实体位置缓存，避免频繁创建CallbackProperty
  const entityPositionCache = new Map();

  function animateTransition(viewer, fromData, toData, onComplete) {
    console.log("开始过渡动画");
    
    // 先清理可能存在的动画
    if (currentAnimationFrame) {
      cancelAnimationFrame(currentAnimationFrame);
      currentAnimationFrame = null;
    }
    
    // 如果启用瞬间模式，直接更新位置不使用动画
    if (instantMode.value) {
      console.log("瞬间模式：直接更新卫星位置");
      const toNodeMap = new Map();
      toData.nodes.forEach(node => {
        if (node.type === 'satellite') {
          toNodeMap.set(node.id, node);
        }
      });
      
      const satelliteIds = new Set();
      
      viewer.entities.values.forEach(entity => {
        if (entity.id && String(entity.id).startsWith('satellite')) {
          const toNode = toNodeMap.get(entity.id);
          if (toNode) {
            // 使用缓存的CallbackProperty避免频繁创建
            const entityId = entity.id;
            if (!entityPositionCache.has(entityId)) {
              const position = new Cesium.Cartesian3(
                parseFloat(toNode.position[0]) * 1000,
                parseFloat(toNode.position[1]) * 1000,
                parseFloat(toNode.position[2]) * 1000
              );
              const callbackProperty = new Cesium.CallbackProperty(function(time, result) {
                return Cesium.Cartesian3.clone(position, result);
              }, false);
              entityPositionCache.set(entityId, { position, callbackProperty });
              entity.position = callbackProperty;
            } else {
              // 更新已有的位置
              const cached = entityPositionCache.get(entityId);
              cached.position.x = parseFloat(toNode.position[0]) * 1000;
              cached.position.y = parseFloat(toNode.position[1]) * 1000;
              cached.position.z = parseFloat(toNode.position[2]) * 1000;
            }
            satelliteIds.add(entity.id);
          }
        }
      });
      
      viewer.scene.requestRender();
      previousFrameData = toData;
      
      if (onComplete) {
        onComplete(satelliteIds);
      }
      return;
    }
    
    animationInProgress.value = true;
    
    const toNodeMap = new Map();
    toData.nodes.forEach(node => {
      if (node.type === 'satellite') {
        toNodeMap.set(node.id, node);
      }
    });
    
    const entityMap = new Map();
    viewer.entities.values.forEach(entity => {
      if (entity.id && String(entity.id).startsWith('satellite')) {
        entityMap.set(entity.id, entity);
      }
    });
    
    const satellitePairs = [];
    const satelliteIds = new Set();
    
    fromData.nodes.forEach(fromNode => {
      if (fromNode.type !== 'satellite') return;
      
      const toNode = toNodeMap.get(fromNode.id);
      if (!toNode) return;
      
      const entity = entityMap.get(fromNode.id);
      if (!entity) return;
      
      const fromPos = fromNode.position;
      const toPos = toNode.position;
      
      if (fromPos && toPos) {
        const fromX = parseFloat(fromPos[0]) * 1000;
        const fromY = parseFloat(fromPos[1]) * 1000;
        const fromZ = parseFloat(fromPos[2]) * 1000;
        const toX = parseFloat(toPos[0]) * 1000;
        const toY = parseFloat(toPos[1]) * 1000;
        const toZ = parseFloat(toPos[2]) * 1000;
        
        // 计算位置变化距离
        const distance = Math.sqrt(
          Math.pow(toX - fromX, 2) + 
          Math.pow(toY - fromY, 2) + 
          Math.pow(toZ - fromZ, 2)
        );
        
        // 如果位置变化很小（小于1km），跳过动画直接更新位置
        if (distance < 1000) {
          const entityId = fromNode.id;
          if (!entityPositionCache.has(entityId)) {
            const position = new Cesium.Cartesian3(toX, toY, toZ);
            const callbackProperty = new Cesium.CallbackProperty(function(time, result) {
              return Cesium.Cartesian3.clone(position, result);
            }, false);
            entityPositionCache.set(entityId, { position, callbackProperty });
            entity.position = callbackProperty;
          } else {
            // 更新已有的位置
            const cached = entityPositionCache.get(entityId);
            cached.position.x = toX;
            cached.position.y = toY;
            cached.position.z = toZ;
          }
          satelliteIds.add(fromNode.id);
        } else {
          satellitePairs.push({
            entity,
            fromX,
            fromY,
            fromZ,
            toX,
            toY,
            toZ
          });
          satelliteIds.add(fromNode.id);
        }
      }
    });
    
    if (satellitePairs.length === 0) {
      console.log("没有卫星需要移动，跳过动画");
      previousFrameData = toData;
      animationInProgress.value = false;
      if (onComplete) onComplete(satelliteIds);
      return;
    }
    
    console.log(`${satellitePairs.length} 个卫星需要动画移动`);
    
    // 计算最大移动距离，用于调整动画时长
    let maxDistance = 0;
    satellitePairs.forEach(pair => {
      const distance = Math.sqrt(
        Math.pow(pair.toX - pair.fromX, 2) + 
        Math.pow(pair.toY - pair.fromY, 2) + 
        Math.pow(pair.toZ - pair.fromZ, 2)
      );
      maxDistance = Math.max(maxDistance, distance);
    });
    
    // 根据移动距离调整动画时长
    // 增加动画时间以提供更好的视觉体验
    let adaptiveTransitionDuration = ANIMATION_CONFIG.TRANSITION_DURATION;
    if (maxDistance < 50000) { // 小于50km
      adaptiveTransitionDuration = 800; // 800ms
    } else if (maxDistance < 200000) { // 小于200km
      adaptiveTransitionDuration = 1500; // 1500ms
    } else {
      adaptiveTransitionDuration = 2000; // 2000ms
    }
    
    console.log(`最大移动距离: ${(maxDistance/1000).toFixed(1)}km, 动画时长: ${adaptiveTransitionDuration}ms`);
    
    // 为每个卫星准备或复用CallbackProperty
    satellitePairs.forEach(pair => {
      const entityId = pair.entity.id;
      if (!entityPositionCache.has(entityId)) {
        const position = new Cesium.Cartesian3(pair.fromX, pair.fromY, pair.fromZ);
        const callbackProperty = new Cesium.CallbackProperty(function(time, result) {
          return Cesium.Cartesian3.clone(position, result);
        }, false);
        entityPositionCache.set(entityId, { position, callbackProperty });
        pair.entity.position = callbackProperty;
      } else {
        // 设置起始位置
        const cached = entityPositionCache.get(entityId);
        cached.position.x = pair.fromX;
        cached.position.y = pair.fromY;
        cached.position.z = pair.fromZ;
      }
      // 为动画过程添加位置引用
      pair.positionRef = entityPositionCache.get(entityId).position;
    });
    
    let startTime = null;
    let lastFrameTime = 0;
    
    function animate(timestamp) {
      // 检查动画是否应该停止
      if (!isPlaying.value || !animationInProgress.value) {
        console.log('动画被暂停或停止');
        currentAnimationFrame = null;
        return;
      }
      
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      if (timestamp - lastFrameTime < ANIMATION_CONFIG.FRAME_INTERVAL && 
          elapsed < adaptiveTransitionDuration) {
        currentAnimationFrame = requestAnimationFrame(animate);
        return;
      }
      
      lastFrameTime = timestamp;
      const fraction = Math.min(elapsed / adaptiveTransitionDuration, 1.0);
      
      // 更新位置，直接修改缓存的位置对象，避免创建新的CallbackProperty
      satellitePairs.forEach(pair => {
        const newX = pair.fromX + (pair.toX - pair.fromX) * fraction;
        const newY = pair.fromY + (pair.toY - pair.fromY) * fraction;
        const newZ = pair.fromZ + (pair.toZ - pair.fromZ) * fraction;
        
        // 直接更新缓存的位置对象
        pair.positionRef.x = newX;
        pair.positionRef.y = newY;
        pair.positionRef.z = newZ;
      });
      
      viewer.scene.requestRender();
      
      if (elapsed < adaptiveTransitionDuration) {
        currentAnimationFrame = requestAnimationFrame(animate);
      } else {
        console.log("过渡动画完成");
        
        // 动画完成后，设置最终位置
        satellitePairs.forEach(pair => {
          pair.positionRef.x = pair.toX;
          pair.positionRef.y = pair.toY;
          pair.positionRef.z = pair.toZ;
        });
        
        animationInProgress.value = false;
        previousFrameData = toData;
        currentAnimationFrame = null;
        
        if (onComplete) {
          onComplete(satelliteIds);
        }
      }
    }
    
    currentAnimationFrame = requestAnimationFrame(animate);
  }

  function togglePlayback(onFrameLoad) {
    isPlaying.value = !isPlaying.value;
    console.log(`播放状态切换为: ${isPlaying.value ? '播放' : '暂停'}`);
    
    if (isPlaying.value) {
      // 开始播放
      animationInProgress.value = false; // 重置动画状态
      
      // 禁用时间轴自动播放
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(false);
      }
      playNextFrame(onFrameLoad);
    } else {
      // 停止播放
      console.log('停止播放，清理定时器和动画');
      
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
      }
      
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame);
        currentAnimationFrame = null;
      }
      
      animationInProgress.value = false;
      
      // 重新启用时间轴
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(true);
      }
    }
  }

  function playNextFrame(onFrameLoad) {
    if (!isPlaying.value) {
      console.log('播放已停止，终止播放循环');
      return;
    }
    
    if (animationInProgress.value) {
      console.log('动画进行中，延迟播放下一帧');
      playbackTimer = setTimeout(() => playNextFrame(onFrameLoad), 100);
      return;
    }
    
    const nextTimeFrame = timeFrame.value >= SIMULATION_CONFIG.MAX_TIME_FRAME ? 1 : timeFrame.value + 1;
    console.log(`播放逻辑: 当前帧 ${timeFrame.value} → 下一帧 ${nextTimeFrame}`);
    
    // 立即更新timeFrame的值，确保状态同步
    timeFrame.value = nextTimeFrame;
    
    if (onFrameLoad) {
      onFrameLoad(nextTimeFrame);
    }
    
    // 增加延迟以配合较慢的动画速度，但要检查播放状态
    playbackTimer = setTimeout(() => {
      if (isPlaying.value) { // 只有在仍在播放时才继续
        playNextFrame(onFrameLoad);
      }
    }, 500); // 500ms延迟，让用户有时间观察动画
  }

  function cleanup() {
    console.log('清理动画资源...');
    
    // 停止播放
    isPlaying.value = false;
    
    // 清理定时器
    if (playbackTimer) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    
    // 清理动画帧
    if (currentAnimationFrame) {
      cancelAnimationFrame(currentAnimationFrame);
      currentAnimationFrame = null;
    }
    
    // 清理位置缓存以释放内存
    entityPositionCache.clear();
    console.log('动画资源清理完成');
  }

  return {
    isPlaying,
    timeFrame,
    animationInProgress,
    instantMode,
    animateTransition,
    togglePlayback,
    cleanup,
    setPreviousFrameData: (data) => { previousFrameData = data; },
    getPreviousFrameData: () => previousFrameData
  };
}