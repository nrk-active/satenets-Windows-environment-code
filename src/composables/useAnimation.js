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

  function animateTransition(viewer, fromData, toData, onComplete) {
    console.log("开始过渡动画");
    
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
            const finalPosition = new Cesium.Cartesian3(
              parseFloat(toNode.position[0]) * 1000,
              parseFloat(toNode.position[1]) * 1000,
              parseFloat(toNode.position[2]) * 1000
            );
            entity.position = new Cesium.CallbackProperty(function(time, result) {
              return finalPosition;
            }, false);
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
          const finalPosition = new Cesium.Cartesian3(toX, toY, toZ);
          entity.position = new Cesium.CallbackProperty(function(time, result) {
            return finalPosition;
          }, false);
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
    
    let startTime = null;
    let lastFrameTime = 0;
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      if (timestamp - lastFrameTime < ANIMATION_CONFIG.FRAME_INTERVAL && 
          elapsed < adaptiveTransitionDuration) {
        currentAnimationFrame = requestAnimationFrame(animate);
        return;
      }
      
      lastFrameTime = timestamp;
      const fraction = Math.min(elapsed / adaptiveTransitionDuration, 1.0);
      
      satellitePairs.forEach(pair => {
        const newX = pair.fromX + (pair.toX - pair.fromX) * fraction;
        const newY = pair.fromY + (pair.toY - pair.fromY) * fraction;
        const newZ = pair.fromZ + (pair.toZ - pair.fromZ) * fraction;
        
        // 使用 CallbackProperty 来创建动态位置，这样业务路径可以实时跟随
        const newPosition = new Cesium.Cartesian3(newX, newY, newZ);
        
        // 更新实体位置为 CallbackProperty
        pair.entity.position = new Cesium.CallbackProperty(function(time, result) {
          return newPosition;
        }, false);
      });
      
      viewer.scene.requestRender();
      
      if (elapsed < adaptiveTransitionDuration) {
        currentAnimationFrame = requestAnimationFrame(animate);
      } else {
        console.log("过渡动画完成");
        
        // 动画完成后，设置最终位置，保持为 CallbackProperty 形式以便业务路径继续跟随
        satellitePairs.forEach(pair => {
          const finalPosition = new Cesium.Cartesian3(pair.toX, pair.toY, pair.toZ);
          pair.entity.position = new Cesium.CallbackProperty(function(time, result) {
            return finalPosition;
          }, false);
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
    
    if (isPlaying.value) {
      // 禁用时间轴自动播放
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(false);
      }
      playNextFrame(onFrameLoad);
    } else {
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
      }
      // 重新启用时间轴
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(true);
      }
    }
  }

  function playNextFrame(onFrameLoad) {
    if (!isPlaying.value) return;
    
    if (animationInProgress.value) {
      playbackTimer = setTimeout(() => playNextFrame(onFrameLoad), 100);
      return;
    }
    
    const nextTimeFrame = timeFrame.value >= SIMULATION_CONFIG.MAX_TIME_FRAME ? 1 : timeFrame.value + 1;
    
    if (onFrameLoad) {
      onFrameLoad(nextTimeFrame);
    }
    
    // 增加延迟以配合较慢的动画速度
    playbackTimer = setTimeout(() => {
      playNextFrame(onFrameLoad);
    }, 500); // 500ms延迟，让用户有时间观察动画
  }

  function cleanup() {
    if (playbackTimer) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    
    if (currentAnimationFrame) {
      cancelAnimationFrame(currentAnimationFrame);
      currentAnimationFrame = null;
    }
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