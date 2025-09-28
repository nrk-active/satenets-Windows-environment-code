// src/composables/useAnimation.js
// 动画播放、暂停、帧切换和过渡效果
// 时间轴与动画的实时联动和同步
// 卫星实体的高效位置动画和缓存管理
// 动画参数自适应和仿真场景兼容
// 全局动画状态管理和资源清理
// 适用于三维场景的卫星网络仿真与动态可视化，保证动画流畅、数据同步和交互体验
import { ref } from 'vue';
import * as Cesium from "cesium";
import { ANIMATION_CONFIG, SIMULATION_CONFIG } from '../constants/index.js';
import { useDataLoader } from './useDataLoader.js';

export function useAnimation(timelineControlRef = null, getPlaybackSpeed = () => 1) {
  const isPlaying = ref(false);
  const timeFrame = ref(1);
  const animationInProgress = ref(false);
  const instantMode = ref(false); // 新增：瞬间模式控制
  
  // 获取数据加载器功能
  const { getCurrentDataFolder } = useDataLoader();

  // 解析文件夹名称格式：{类型}_{切片间隔}_{总时长}
  // 自动识别仿真类型、切片间隔、总时长和播放间隔，支持新旧格式，保证动画参数与仿真数据同步
  function parseFolderName(folderName) {
    // 默认配置
    const defaultConfig = {
      type: 'unknown',
      interval: 60,  // 秒
      totalDuration: 360, // 秒
      playbackInterval: 3000 // 毫秒，播放间隔
    };
    
    if (!folderName) {
      return defaultConfig;
    }
    
    // 尝试解析新格式：如 "old_60s_360s"
    const newFormatMatch = folderName.match(/^(\w+)_(\d+)s_(\d+)s$/);
    if (newFormatMatch) {
      const [, type, intervalStr, durationStr] = newFormatMatch;
      const interval = parseInt(intervalStr, 10);
      const totalDuration = parseInt(durationStr, 10);
      
      // 根据切片间隔计算播放间隔：
      // 60秒间隔 -> 3000ms播放间隔（慢）
      // 10秒间隔 -> 1000ms播放间隔（快）
      const playbackInterval = interval >= 60 ? 3000 : 1000;
      
      return {
        type: type,
        interval: interval,
        totalDuration: totalDuration,
        playbackInterval: playbackInterval
      };
    }
    
    // 兼容旧格式
    if (folderName === 'new') {
      return {
        type: 'new',
        interval: 10,
        totalDuration: 3600,
        playbackInterval: 1000
      };
    } else if (folderName === 'old') {
      return {
        type: 'old', 
        interval: 60,
        totalDuration: 360,
        playbackInterval: 3000
      };
    }
    
    // 如果无法解析，返回默认值
    console.warn(`无法解析文件夹名称格式: ${folderName}，使用默认配置`);
    return defaultConfig;
  }
  
  // 将动画状态暴露到全局，供时间轴检查
  window.animationInProgress = animationInProgress.value;
  
  // 监听animationInProgress变化并同步到全局
  animationInProgress.value = false; // 确保初始状态
  Object.defineProperty(window, 'animationInProgress', {
    get: () => animationInProgress.value,
    set: (value) => { animationInProgress.value = value; }
  });
  
  let currentAnimationFrame = null;
  let playbackTimer = null;
  let previousFrameData = null;
  
  // 监听时间轴跳转事件，同步更新timeFrame状态
  window.addEventListener('timeline-frame-update', (event) => {
    const { targetFrame, source, isDragging } = event.detail;
    console.log(`收到时间轴帧更新事件: 目标帧=${targetFrame}, 来源=${source}, 拖拽模式=${isDragging}`);
    
    // 只有在非拖拽状态或拖拽结束时才更新timeFrame，避免播放过程中的冲突
    if (!isDragging || source === 'timeline-jump') {
      timeFrame.value = targetFrame;
      console.log(`动画系统timeFrame已同步更新到: ${targetFrame}`);
    }
  });
  
  // 添加实体位置缓存，避免频繁创建CallbackProperty
  const entityPositionCache = new Map();

  // 添加强制停止动画的标志
  let forceStopAnimation = false;

  function animateTransition(viewer, fromData, toData, onComplete) {
    console.log("开始过渡动画");
    
    // 重置强制停止标志和预加载标志
    forceStopAnimation = false;
    window.preloadTriggered = false;
    
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
    
    // 根据移动距离和播放速度调整动画时长
    // 增加动画时间以提供更好的视觉体验
    let adaptiveTransitionDuration = ANIMATION_CONFIG.TRANSITION_DURATION;
    if (maxDistance < 50000) { // 小于50km
      adaptiveTransitionDuration = 800; // 800ms
    } else if (maxDistance < 200000) { // 小于200km
      adaptiveTransitionDuration = 1500; // 1500ms
    } else {
      adaptiveTransitionDuration = 2000; // 2000ms
    }
    
    // 根据播放速度调整动画时长
    const currentSpeed = getPlaybackSpeed();
    adaptiveTransitionDuration = Math.max(100, adaptiveTransitionDuration / currentSpeed);
    
    console.log(`最大移动距离: ${(maxDistance/1000).toFixed(1)}km, 基础动画时长: ${adaptiveTransitionDuration * currentSpeed}ms, 播放速度: ${currentSpeed}x, 实际动画时长: ${adaptiveTransitionDuration}ms`);
    
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
      // 检查是否需要强制停止动画
      if (forceStopAnimation) {
        console.log('强制停止动画');
        currentAnimationFrame = null;
        animationInProgress.value = false;
        return;
      }
      
      // 如果暂停了播放，立即停止动画，不再继续
      if (!isPlaying.value) {
        console.log('播放已暂停，停止当前动画并保持当前位置');
        currentAnimationFrame = null;
        animationInProgress.value = false;
        
        // 创建反映当前实际位置的中间帧数据
        // 这样下次播放时会从当前位置继续，而不是从原始位置重新开始
        const currentFrameData = JSON.parse(JSON.stringify(toData)); // 深拷贝目标数据
        
        // 更新节点位置为当前实际位置
        satellitePairs.forEach(pair => {
          const nodeInData = currentFrameData.nodes.find(node => node.id === pair.entity.id);
          if (nodeInData && nodeInData.type === 'satellite') {
            // 将当前位置转换回数据格式（除以1000，因为数据中是km，Cesium中是m）
            nodeInData.position = [
              pair.positionRef.x / 1000,
              pair.positionRef.y / 1000,
              pair.positionRef.z / 1000
            ];
          }
        });
        
        previousFrameData = currentFrameData; // 使用包含当前位置的数据
        
        // 不设置最终位置，保持当前动画进度的位置
        // 卫星会停留在暂停时刻的位置，而不是跳跃到目标位置
        console.log('卫星保持在当前动画进度位置，previousFrameData已更新为当前位置');
        
        if (onComplete) {
          onComplete(satelliteIds);
        }
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
      
      // 预加载机制：当动画进行到70%时开始预加载下一帧
      if (fraction >= 0.7 && !window.preloadTriggered && isPlaying.value) {
        window.preloadTriggered = true;
        console.log('动画进行到70%，开始预加载下一帧数据');
        
        // 计算下一帧
        const currentFolder = getCurrentDataFolder();
        const folderConfig = parseFolderName(currentFolder);
        const maxFrames = folderConfig.totalFrames; // 完全依赖配置解析
        
        const nextFrame = timeFrame.value >= maxFrames ? 1 : timeFrame.value + 1;
        
        // 触发预加载（异步进行，不阻塞当前动画）
        if (window.preloadNextFrame) {
          window.preloadNextFrame(nextFrame);
        }
      }
      
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
    const wasPlaying = isPlaying.value;
    isPlaying.value = !isPlaying.value;
    console.log(`播放状态切换为: ${isPlaying.value ? '播放' : '暂停'} (之前: ${wasPlaying ? '播放' : '暂停'})`);
    console.log(`当前播放将从第 ${timeFrame.value} 帧开始`);
    
    if (isPlaying.value) {
      // 开始播放
      console.log('开始播放，强制锁定当前帧：', timeFrame.value);
      
      // 使用强制设置帧数接口，确保精确的帧控制
      if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
        timelineControlRef.viewer.forceSetFrame(timeFrame.value);
        console.log('已强制锁定到当前帧:', timeFrame.value);
      }
      
      // 短暂延迟后启用动画，确保帧锁定生效
      setTimeout(() => {
        if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
          timelineControlRef.setTimelineAnimation(true);
          console.log('已启用时间轴动画');
        }
        
        // 开始播放循环
        if (!animationInProgress.value) {
          playNextFrame(onFrameLoad);
        }
      }, 100); // 减少延迟，提高响应性
      
    } else {
      // 暂停播放
      console.log('暂停播放，完全锁定当前帧');
      
      // 立即禁用时间轴动画
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(false);
        console.log('已禁用时间轴动画');
      }
      
      // 清理播放定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
        console.log('已清理播放定时器');
      }
      
      // 强制锁定到当前帧，防止任何时间漂移
      if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
        timelineControlRef.viewer.forceSetFrame(timeFrame.value);
        console.log('暂停时强制锁定到当前帧:', timeFrame.value);
      }
    }
  }

  function playNextFrame(onFrameLoad) {
    if (!isPlaying.value) {
      console.log('播放已停止，终止播放循环');
      return;
    }
    
    if (animationInProgress.value) {
      console.log('动画进行中，等待动画完成后继续播放');
      // 根据播放速度调整检查间隔，加速时更频繁检查
      const currentSpeed = getPlaybackSpeed();
      const checkInterval = Math.max(5, 20 / currentSpeed);
      playbackTimer = setTimeout(() => playNextFrame(onFrameLoad), checkInterval);
      return;
    }
    
    // 根据当前文件夹动态计算最大帧数
    const currentFolder = getCurrentDataFolder();
    const folderConfig = parseFolderName(currentFolder);
    const maxFrames = folderConfig.totalFrames; // 完全依赖配置解析
    
    const nextTimeFrame = timeFrame.value >= maxFrames ? 1 : timeFrame.value + 1;
    console.log(`播放逻辑: 当前帧 ${timeFrame.value} → 下一帧 ${nextTimeFrame} (最大帧数: ${maxFrames}, 文件夹: ${currentFolder})`);
    
    // 计算播放间隔并立即设置下一次播放的定时器
    // 关键改进：从当前帧开始计时，并考虑动画时长
    const baseInterval = folderConfig.playbackInterval;
    const currentSpeed = getPlaybackSpeed();
    
    // 预估动画时长（与animateTransition中的逻辑保持一致）
    // 基础动画时长1500ms，根据播放速度调整
    const baseAnimationDuration = 1500;
    const estimatedAnimationDuration = Math.max(100, baseAnimationDuration / currentSpeed);
    
    // 播放间隔应该是总间隔减去动画时长，确保帧与帧之间无缝衔接
    const netWaitTime = Math.max(200, baseInterval - estimatedAnimationDuration); // 最少等待200ms
    const playbackInterval = Math.max(100, netWaitTime / currentSpeed);
    
    console.log(`设置播放间隔: ${playbackInterval}ms (基础间隔: ${baseInterval}ms, 预估动画时长: ${estimatedAnimationDuration}ms, 净等待: ${netWaitTime}ms, 播放速度: ${currentSpeed}x)`);
    
    // 立即启动下一次播放的定时器（这是关键改进）
    playbackTimer = setTimeout(() => {
      if (isPlaying.value) {
        playNextFrame(onFrameLoad);
      }
    }, playbackInterval);
    
    // 立即更新timeFrame的值，确保状态同步
    timeFrame.value = nextTimeFrame;
    
    // 播放时主动更新时间轴位置，确保视觉同步
    if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
      timelineControlRef.viewer.forceSetFrame(nextTimeFrame);
      console.log(`播放模式：更新时间轴到帧 ${nextTimeFrame}`);
    }
    
    // 最后触发数据加载和动画
    if (onFrameLoad) {
      onFrameLoad(nextTimeFrame);
    }
  }

  function cleanup() {
    console.log('清理动画资源...');
    
    // 设置强制停止标志
    forceStopAnimation = true;
    
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
    
    // 重置动画状态
    animationInProgress.value = false;
    
    // 清理位置缓存以释放内存
    entityPositionCache.clear();
    
    // 重置强制停止标志
    forceStopAnimation = false;
    
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
    getPreviousFrameData: () => previousFrameData,
    clearEntityPositionCache: () => {
      console.log('清除动画系统位置缓存');
      entityPositionCache.clear();
    },
    setEntityPositionCache: (entityId, cacheData) => {
      entityPositionCache.set(entityId, cacheData);
      console.log(`设置实体 ${entityId} 的位置缓存`);
    }
  };
}