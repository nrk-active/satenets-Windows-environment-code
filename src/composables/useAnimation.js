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
  const continuousMode = ref(true); // 新增：连续运动模式控制
  
  // 动画模式选择
  const uniformMotion = ref(true); // true: 严格匀速运动, false: 恒定帧间隔+平滑插值
  
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
  
  // 暴露动画模式切换到全局，方便调试
  window.toggleAnimationMode = () => {
    uniformMotion.value = !uniformMotion.value;
    // console.log('🎬 动画模式切换为:', uniformMotion.value ? '严格匀速运动' : '恒定帧间隔+平滑插值');
    // console.log('💡 提示: 严格匀速=机械精确, 平滑插值=视觉自然');
  };
  
  window.setUniformMotion = () => {
    uniformMotion.value = true;
    // console.log('🎯 已设置为: 严格匀速运动模式');
  };
  
  window.setSmoothAnimation = () => {
    uniformMotion.value = false;
    // console.log('🌊 已设置为: 超丝滑插值模式');
    // console.log('✨ 特性: 120fps + smootherstep + 正弦平滑 + 多重采样 + EMA滤波');
  };
  
  // 超丝滑度调试函数
  window.getAnimationInfo = () => {
    const mode = uniformMotion.value ? '严格匀速运动' : '超丝滑插值';
    const fps = uniformMotion.value ? '60fps' : '120fps';
    const algorithms = uniformMotion.value ? '线性插值' : 'smootherstep + 正弦平滑 + 多重采样';
    
    // console.log(`🎬 当前动画模式: ${mode}`);
    // console.log(`⚡ 帧率: ${fps}`);
    // console.log(`🔧 算法: ${algorithms}`);
    // console.log(`💡 切换命令: toggleAnimationMode()`);
  };
  
  // 监听animationInProgress变化并同步到全局
  animationInProgress.value = false; // 确保初始状态
  Object.defineProperty(window, 'animationInProgress', {
    get: () => animationInProgress.value,
    set: (value) => { animationInProgress.value = value; }
  });
  
  let currentAnimationFrame = null;
  let playbackTimer = null;
  let previousFrameData = null;
  let animationQueue = []; // 连续模式下的动画队列
  
  // 监听时间轴跳转事件，同步更新timeFrame状态
  window.addEventListener('timeline-frame-update', (event) => {
    const { targetFrame, source, isDragging } = event.detail;
    // 只在关键操作时输出日志，避免播放时大量输出
    if (source === 'timeline-jump' || !isPlaying.value) {
      // console.log(`收到时间轴帧更新事件: 目标帧=${targetFrame}, 来源=${source}, 拖拽模式=${isDragging}`);
    }
    
    // 只有在非拖拽状态或拖拽结束时才更新timeFrame，避免播放过程中的冲突
    if (!isDragging || source === 'timeline-jump') {
      timeFrame.value = targetFrame;
      if (source === 'timeline-jump' || !isPlaying.value) {
        // console.log(`动画系统timeFrame已同步更新到: ${targetFrame}`);
      }
    }
  });
  
  // 添加实体位置缓存，避免频繁创建CallbackProperty
  const entityPositionCache = new Map();

  // 添加强制停止动画的标志
  let forceStopAnimation = false;

  function animateTransition(viewer, fromData, toData, onComplete) {
    // // console.log("开始过渡动画");
    
    // 重置强制停止标志和预加载标志
    forceStopAnimation = false;
    window.preloadTriggered = false;
    
    // 传统模式才清理之前的动画，连续模式允许重叠
    if (!continuousMode.value && currentAnimationFrame) {
      cancelAnimationFrame(currentAnimationFrame);
      currentAnimationFrame = null;
    }
    
    // 只有瞬间模式才直接更新位置，连续模式保持动画
    if (instantMode.value) {
      // // console.log("瞬间模式：直接更新卫星位置");
      
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
        let fromX, fromY, fromZ;
        
        // 连续模式：如果实体已有缓存位置，使用当前实际位置作为起点
        if (continuousMode.value && entityPositionCache.has(fromNode.id)) {
          const currentPos = entityPositionCache.get(fromNode.id).position;
          fromX = currentPos.x;
          fromY = currentPos.y;
          fromZ = currentPos.z;
          // // console.log(`连续模式：卫星 ${fromNode.id} 从当前位置开始动画`);
        } else {
          // 传统模式：使用数据中的起始位置
          fromX = parseFloat(fromPos[0]) * 1000;
          fromY = parseFloat(fromPos[1]) * 1000;
          fromZ = parseFloat(fromPos[2]) * 1000;
        }
        
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
      // // console.log("没有卫星需要移动，跳过动画");
      previousFrameData = toData;
      animationInProgress.value = false;
      if (onComplete) onComplete(satelliteIds);
      return;
    }
    
    // // console.log(`${satellitePairs.length} 个卫星需要动画移动`);
    
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
    
    // 动画时长计算 - 根据实际触发间隔动态调整
    const currentSpeed = getPlaybackSpeed();
    let adaptiveTransitionDuration;
    
    if (continuousMode.value) {
      // 连续运动模式：动画时长略长于实际触发间隔，确保无缝重叠
      const currentFolder = getCurrentDataFolder();
      const folderConfig = parseFolderName(currentFolder);
      const baseInterval = folderConfig.playbackInterval;
      
      // 关键：计算实际触发间隔（播放间隔 - 提前量）
      const basePlaybackInterval = (baseInterval * 0.7) / currentSpeed;
      const advanceTime = Math.min(200, basePlaybackInterval * 0.2);
      const actualTriggerInterval = Math.max(50, basePlaybackInterval - advanceTime);
      
      // 动画时长 = 实际触发间隔 + 30%重叠时间，确保连续性
      const overlapTime = actualTriggerInterval * 0.3;
      adaptiveTransitionDuration = actualTriggerInterval + overlapTime;
      
      // 动态边界：根据速度自适应调整（避免固定上下限限制）
      const minDuration = Math.max(100, 200 / currentSpeed); // 速度越快，最小值越小
      const maxDuration = Math.min(10000, 2000 * (1 / currentSpeed)); // 速度越慢，最大值越大
      adaptiveTransitionDuration = Math.max(minDuration, Math.min(adaptiveTransitionDuration, maxDuration));
      
      // 距离调整：距离越大，适当延长动画时间
      if (maxDistance > 100000) { // 大于100km，增加15%动画时长
        const distanceFactor = 1 + Math.min(0.15, (maxDistance - 100000) / 1000000);
        adaptiveTransitionDuration = Math.min(adaptiveTransitionDuration * distanceFactor, maxDuration);
      }
      
      // // console.log(`连续模式 - 速度:${currentSpeed}x, 距离:${(maxDistance/1000).toFixed(1)}km, 触发间隔:${actualTriggerInterval.toFixed(0)}ms, 动画时长:${adaptiveTransitionDuration.toFixed(0)}ms (${(adaptiveTransitionDuration/actualTriggerInterval).toFixed(2)}x)`);
    } else {
      // 传统模式：根据距离和速度调整动画时长
      adaptiveTransitionDuration = ANIMATION_CONFIG.TRANSITION_DURATION;
      if (maxDistance < 50000) { // 小于50km
        adaptiveTransitionDuration = 800;
      } else if (maxDistance < 200000) { // 小于200km
        adaptiveTransitionDuration = 1500;
      } else { // 大于200km
        adaptiveTransitionDuration = 2000;
      }
      
      adaptiveTransitionDuration = Math.max(100, adaptiveTransitionDuration / currentSpeed);
      // // console.log(`传统模式 - 最大移动距离: ${(maxDistance/1000).toFixed(1)}km, 动画时长: ${adaptiveTransitionDuration}ms, 播放速度: ${currentSpeed}x`);
    }
    
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
        // // console.log('强制停止动画，保持当前位置用于下一动画');
        
        // 保存当前动画位置作为下一个动画的起点
        if (satellitePairs && satellitePairs.length > 0) {
          const currentFrameData = JSON.parse(JSON.stringify(toData)); // 深拷贝目标数据
          
          // 更新节点位置为当前实际位置
          satellitePairs.forEach(pair => {
            const nodeInData = currentFrameData.nodes.find(node => node.id === pair.entity.id);
            if (nodeInData && nodeInData.type === 'satellite' && pair.positionRef) {
              nodeInData.position = [
                pair.positionRef.x / 1000,
                pair.positionRef.y / 1000,
                pair.positionRef.z / 1000
              ];
            }
          });
          
          previousFrameData = currentFrameData;
        }
        
        currentAnimationFrame = null;
        animationInProgress.value = false;
        return;
      }
      
      // 如果暂停了播放，立即停止动画，不再继续
      if (!isPlaying.value) {
        // // console.log('播放已暂停，停止当前动画并保持当前位置');
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
        // // console.log('卫星保持在当前动画进度位置，previousFrameData已更新为当前位置');
        
        if (onComplete) {
          onComplete(satelliteIds);
        }
        return;
      }
      
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      // 超丝滑动画帧间隔控制系统
      const HIGH_FPS_INTERVAL = uniformMotion.value ? 16.67 : 8.33; // 严格匀速60fps，平滑模式120fps
      
      if (timestamp - lastFrameTime < HIGH_FPS_INTERVAL) {
        currentAnimationFrame = requestAnimationFrame(animate);
        return;
      }
      
      lastFrameTime = timestamp;
      const fraction = Math.min(elapsed / adaptiveTransitionDuration, 1.0);
      
      // 预加载机制：当动画进行到70%时开始预加载下一帧
      if (fraction >= 0.7 && !window.preloadTriggered && isPlaying.value) {
        window.preloadTriggered = true;
        // // console.log('动画进行到70%，开始预加载下一帧数据');
        
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
      
      // 超丝滑多重插值动画系统
      satellitePairs.forEach(pair => {
        let interpolatedFraction = fraction;
        
        if (uniformMotion.value) {
          // 模式1: 严格匀速运动 - 线性插值
          interpolatedFraction = fraction;
        } else {
          // 模式2: 超丝滑插值 - 多重插值算法组合
          // 1. smootherstep (6t^5 - 15t^4 + 10t^3) - 更平滑的S曲线
          const smootherstep = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10);
          
          // 2. 额外的正弦插值平滑处理
          const sineSmooth = 0.5 - 0.5 * Math.cos(smootherstep * Math.PI);
          
          // 3. 组合插值 - 75%smootherstep + 25%sine平滑
          interpolatedFraction = smootherstep * 0.75 + sineSmooth * 0.25;
        }
        
        // 多重采样插值 - 在单帧内进行4次子采样以获得更平滑的结果
        const subSamples = uniformMotion.value ? 1 : 4;
        let avgX = 0, avgY = 0, avgZ = 0;
        
        for (let i = 0; i < subSamples; i++) {
          const subFraction = interpolatedFraction + (i - subSamples/2) * 0.001; // 微小偏移
          const clampedFraction = Math.max(0, Math.min(1, subFraction));
          
          avgX += pair.fromX + (pair.toX - pair.fromX) * clampedFraction;
          avgY += pair.fromY + (pair.toY - pair.fromY) * clampedFraction;
          avgZ += pair.fromZ + (pair.toZ - pair.fromZ) * clampedFraction;
        }
        
        // 最终位置 = 多重采样的平均值
        const newX = avgX / subSamples;
        const newY = avgY / subSamples;
        const newZ = avgZ / subSamples;
        
        // 额外的指数平滑滤波，进一步消除微抖动
        if (!uniformMotion.value) {
          const smoothFactor = 0.1; // 轻微平滑，保持响应性
          pair.positionRef.x = pair.positionRef.x * (1 - smoothFactor) + newX * smoothFactor;
          pair.positionRef.y = pair.positionRef.y * (1 - smoothFactor) + newY * smoothFactor;
          pair.positionRef.z = pair.positionRef.z * (1 - smoothFactor) + newZ * smoothFactor;
        } else {
          pair.positionRef.x = newX;
          pair.positionRef.y = newY;
          pair.positionRef.z = newZ;
        }
      });
      
      // 高频率渲染优化 - 平滑模式使用多重渲染确保丝滑
      if (uniformMotion.value) {
        viewer.scene.requestRender();
      } else {
        // 超丝滑模式：双重渲染请求
        viewer.scene.requestRender();
        setTimeout(() => viewer.scene.requestRender(), 0);
      }
      
      if (elapsed < adaptiveTransitionDuration) {
        currentAnimationFrame = requestAnimationFrame(animate);
      } else {
        // // console.log("过渡动画完成");
        
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
    // // console.log(`播放状态切换为: ${isPlaying.value ? '播放' : '暂停'} (之前: ${wasPlaying ? '播放' : '暂停'})`);
    // // console.log(`当前播放将从第 ${timeFrame.value} 帧开始`);
    
    if (isPlaying.value) {
      // 开始播放
      // // console.log('开始播放，强制锁定当前帧：', timeFrame.value);
      
      // 使用强制设置帧数接口，确保精确的帧控制
      if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
        timelineControlRef.viewer.forceSetFrame(timeFrame.value);
        // // console.log('已强制锁定到当前帧:', timeFrame.value);
      }
      
      // 连续模式：立即启动，无延迟
      if (continuousMode.value) {
        if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
          timelineControlRef.setTimelineAnimation(true);
          // // console.log('连续模式：已启用时间轴动画');
        }
        
        // 立即开始播放循环
        if (!animationInProgress.value) {
          playNextFrame(onFrameLoad);
        }
      } else {
        // 传统模式：保持短延迟确保帧锁定生效
        setTimeout(() => {
          if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
            timelineControlRef.setTimelineAnimation(true);
            // console.log('传统模式：已启用时间轴动画');
          }
          
          // 开始播放循环
          if (!animationInProgress.value) {
            playNextFrame(onFrameLoad);
          }
        }, 50); // 减少延迟
      }
      
    } else {
      // 暂停播放
      // console.log('暂停播放，完全锁定当前帧');
      
      // 立即禁用时间轴动画
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(false);
        // console.log('已禁用时间轴动画');
      }
      
      // 清理播放定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
        // console.log('已清理播放定时器');
      }
      
      // 强制锁定到当前帧，防止任何时间漂移
      if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
        timelineControlRef.viewer.forceSetFrame(timeFrame.value);
        // console.log('暂停时强制锁定到当前帧:', timeFrame.value);
      }
    }
  }

  function playNextFrame(onFrameLoad) {
    if (!isPlaying.value) {
      // console.log('播放已停止，终止播放循环');
      return;
    }
    
    if (animationInProgress.value) {
      if (continuousMode.value) {
        // 连续运动模式：创建重叠动画，不等待当前动画完成
        // console.log('连续运动模式：创建重叠动画，无缝衔接');
        // 继续执行，允许多个动画同时进行
      } else {
        // 传统模式：等待当前动画完成
        // console.log('传统模式：等待动画完成后继续播放');
        const currentSpeed = getPlaybackSpeed();
        const checkInterval = Math.max(5, 20 / currentSpeed);
        playbackTimer = setTimeout(() => playNextFrame(onFrameLoad), checkInterval);
        return;
      }
    }
    
    // 根据当前文件夹动态计算最大帧数
    const currentFolder = getCurrentDataFolder();
    const folderConfig = parseFolderName(currentFolder);
    const maxFrames = folderConfig.totalFrames; // 完全依赖配置解析
    
    // 检查是否播放完成：到达最后一帧时停止播放
    if (timeFrame.value >= maxFrames) {
      // console.log(`🏁 播放完成！已播放到最后一帧 (${maxFrames}/${maxFrames})，停止播放`);
      isPlaying.value = false;
      
      // 禁用时间轴动画
      if (timelineControlRef && timelineControlRef.setTimelineAnimation) {
        timelineControlRef.setTimelineAnimation(false);
      }
      
      // 清理定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
      }
      
      return; // 停止播放循环
    }
    
    const nextTimeFrame = timeFrame.value + 1;
    
    // 只在关键帧（每10帧或接近完成）时输出日志
    if (nextTimeFrame % 10 === 1 || nextTimeFrame === 1 || nextTimeFrame >= maxFrames - 5) {
      // console.log(`播放进度: 第 ${timeFrame.value} → ${nextTimeFrame} 帧 (总帧数: ${maxFrames})`);
    }
    
    // 计算播放间隔 - 支持连续运动模式和传统模式
    const baseInterval = folderConfig.playbackInterval;
    const currentSpeed = getPlaybackSpeed();
    
    let playbackInterval;
    if (continuousMode.value) {
      // 连续运动模式：播放间隔稍短于基础间隔，确保动画重叠
      playbackInterval = Math.max(200, (baseInterval * 0.7) / currentSpeed); // 70%的基础间隔
      // console.log(`连续运动模式 - 播放间隔: ${playbackInterval}ms (基础间隔: ${baseInterval}ms, 播放速度: ${currentSpeed}x)`);
    } else {
      // 传统模式：预估动画时长并计算等待时间
      const baseAnimationDuration = 1500;
      const estimatedAnimationDuration = Math.max(100, baseAnimationDuration / currentSpeed);
      const netWaitTime = Math.max(200, baseInterval - estimatedAnimationDuration);
      playbackInterval = Math.max(100, netWaitTime / currentSpeed);
      // console.log(`传统模式 - 播放间隔: ${playbackInterval}ms (基础间隔: ${baseInterval}ms, 预估动画时长: ${estimatedAnimationDuration}ms, 播放速度: ${currentSpeed}x)`);
    }
    
    // 启动下一次播放的定时器
    if (continuousMode.value) {
      // 连续模式：提前启动下一帧，在当前动画完成前就准备
      const advanceTime = Math.min(200, playbackInterval * 0.2); // 提前20%的时间
      const actualInterval = Math.max(50, playbackInterval - advanceTime);
      // // console.log(`连续模式：提前${advanceTime}ms启动下一帧，实际间隔${actualInterval}ms`);
      
      playbackTimer = setTimeout(() => {
        if (isPlaying.value) {
          playNextFrame(onFrameLoad);
        }
      }, actualInterval);
    } else {
      // 传统模式：正常间隔
      playbackTimer = setTimeout(() => {
        if (isPlaying.value) {
          playNextFrame(onFrameLoad);
        }
      }, playbackInterval);
    }
    
    // 立即更新timeFrame的值，确保状态同步
    timeFrame.value = nextTimeFrame;
    
    // 播放时主动更新时间轴位置，确保视觉同步
    if (timelineControlRef && timelineControlRef.viewer && timelineControlRef.viewer.forceSetFrame) {
      timelineControlRef.viewer.forceSetFrame(nextTimeFrame);
      // console.log(`播放模式：更新时间轴到帧 ${nextTimeFrame}`);
    }
    
    // 最后触发数据加载和动画
    if (onFrameLoad) {
      onFrameLoad(nextTimeFrame);
    }
  }

  function cleanup() {
    // console.log('清理动画资源...');
    
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
    
    // console.log('动画资源清理完成');
  }

  return {
    isPlaying,
    timeFrame,
    animationInProgress,
    instantMode,
    continuousMode, // 新增：连续运动模式控制
    uniformMotion, // 新增：动画模式切换 (true: 严格匀速, false: 平滑插值)
    animateTransition,
    togglePlayback,
    cleanup,
    setPreviousFrameData: (data) => { previousFrameData = data; },
    getPreviousFrameData: () => previousFrameData,
    clearEntityPositionCache: () => {
      // // console.log('清除动画系统位置缓存');
      entityPositionCache.clear();
    },
    setEntityPositionCache: (entityId, cacheData) => {
      entityPositionCache.set(entityId, cacheData);
      // // console.log(`设置实体 ${entityId} 的位置缓存`);
    }
  };
}