// src/composables/useAnimation.js
import { ref } from 'vue';
import * as Cesium from "cesium";
import { ANIMATION_CONFIG, SIMULATION_CONFIG } from '../constants/index.js';

export function useAnimation() {
  const isPlaying = ref(false);
  const timeFrame = ref(1);
  const animationInProgress = ref(false);
  
  let currentAnimationFrame = null;
  let playbackTimer = null;
  let previousFrameData = null;

  function animateTransition(viewer, fromData, toData, onComplete) {
    console.log("开始过渡动画");
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
        satellitePairs.push({
          entity,
          fromX: parseFloat(fromPos[0]) * 1000,
          fromY: parseFloat(fromPos[1]) * 1000,
          fromZ: parseFloat(fromPos[2]) * 1000,
          toX: parseFloat(toPos[0]) * 1000,
          toY: parseFloat(toPos[1]) * 1000,
          toZ: parseFloat(toPos[2]) * 1000
        });
        satelliteIds.add(fromNode.id);
      }
    });
    
    if (satellitePairs.length === 0) {
      console.log("没有卫星需要移动，跳过动画");
      previousFrameData = toData;
      animationInProgress.value = false;
      if (onComplete) onComplete();
      return;
    }
    
    let startTime = null;
    let lastFrameTime = 0;
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      if (timestamp - lastFrameTime < ANIMATION_CONFIG.FRAME_INTERVAL && 
          elapsed < ANIMATION_CONFIG.TRANSITION_DURATION) {
        currentAnimationFrame = requestAnimationFrame(animate);
        return;
      }
      
      lastFrameTime = timestamp;
      const fraction = Math.min(elapsed / ANIMATION_CONFIG.TRANSITION_DURATION, 1.0);
      
      satellitePairs.forEach(pair => {
        const newX = pair.fromX + (pair.toX - pair.fromX) * fraction;
        const newY = pair.fromY + (pair.toY - pair.fromY) * fraction;
        const newZ = pair.fromZ + (pair.toZ - pair.fromZ) * fraction;
        
        pair.entity.position = new Cesium.Cartesian3(newX, newY, newZ);
      });
      
      viewer.scene.requestRender();
      
      if (elapsed < ANIMATION_CONFIG.TRANSITION_DURATION) {
        currentAnimationFrame = requestAnimationFrame(animate);
      } else {
        console.log("过渡动画完成");
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
      playNextFrame(onFrameLoad);
    } else {
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
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
    
    playbackTimer = setTimeout(() => {
      playNextFrame(onFrameLoad);
    }, ANIMATION_CONFIG.TRANSITION_DURATION + 500);
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
    animateTransition,
    togglePlayback,
    cleanup,
    setPreviousFrameData: (data) => { previousFrameData = data; },
    getPreviousFrameData: () => previousFrameData
  };
}