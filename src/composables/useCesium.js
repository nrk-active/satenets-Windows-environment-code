// src/composables/useCesium.js
import { ref, onMounted, onUnmounted } from 'vue';
import * as Cesium from "cesium";
import { CESIUM_CONFIG } from '../constants/index.js';
import { createSatelliteEntity, createStationEntity, createRoadmEntity, getEntityPosition } from '../utils/cesiumHelpers.js';

export function useCesium() {
  let viewer = null;
  let handler = null;
  
  const showSatellite = ref(true);
  const showStation = ref(true);
  const showRoadm = ref(true);
  const showLinks = ref(true);
  
  let highlightedLinks = [];

  function initializeCesium(containerId) {
    Cesium.Ion.defaultAccessToken = CESIUM_CONFIG.ACCESS_TOKEN;
    
    console.log('开始创建 Cesium Viewer...');
    
    viewer = new Cesium.Viewer(containerId, {
      animation: true, // 启用动画控件
      timeline: true,  // 启用时间轴
      fullscreenButton: false,
      baseLayerPicker: true, // 启用地图选择按钮
      selectionIndicator: false, // 禁用原生选择指示器，使用自定义的
      infoBox: false, // 禁用默认信息框
      requestRenderMode: false, // 禁用请求渲染模式以支持时间轴
      maximumRenderTimeChange: Infinity,
      targetFrameRate: 30,
      automaticallyTrackDataSourceClocks: false, // 禁用自动跟踪时钟，避免冲突
      shouldAnimate: true // 启用动画
    });

    console.log('Cesium Viewer 创建完成');
    console.log('Viewer timeline exists:', !!viewer.timeline);
    console.log('Viewer animation exists:', !!viewer.animation);
    
    if (viewer.timeline) {
      console.log('Timeline container:', viewer.timeline.container);
      console.log('Timeline container style:', viewer.timeline.container?.style);
    } else {
      console.error('时间轴未创建！检查Cesium配置');
    }
    
    if (viewer.animation) {
      console.log('Animation container:', viewer.animation.container);
      console.log('Animation container style:', viewer.animation.container?.style);
    } else {
      console.error('动画控件未创建！检查Cesium配置');
    }

    // 启用光照和阴影
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.0;
    viewer.scene.globe.atmosphereBrightnessShift = 0.1;
    
    // 启用地球大气层
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    
    // 使用太阳作为光源，确保光照和太阳位置一致
    viewer.scene.light = new Cesium.SunLight();
    
    // 设置当前时间，让太阳位置和光照匹配
    const currentTime = Cesium.JulianDate.now();
    viewer.clock.currentTime = currentTime;
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // 设置为循环模式
    
    // 设置时间轴的时间范围（对应仿真的6个时间帧）
    const startTime = Cesium.JulianDate.now();
    const stopTime = Cesium.JulianDate.addSeconds(startTime, 360, new Cesium.JulianDate()); // 6分钟对应6帧
    
    viewer.clock.startTime = startTime.clone();
    viewer.clock.stopTime = stopTime.clone();
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    viewer.clock.multiplier = 1; // 设置为正常速度，启用时间轴功能
    viewer.clock.shouldAnimate = true; // 启用动画，让时间轴可以工作
    
    console.log('时钟配置完成，开始设置时间轴样式...');
    
    // 立即尝试设置时间轴样式
    setTimeout(() => {
      console.log('第一次设置时间轴样式');
      debugTimelineElements();
      setupTimelineStyles();
      forceShowTimelineControls();
    }, 100);
    
    // 多次尝试确保显示
    setTimeout(() => {
      console.log('第二次设置时间轴样式');
      debugTimelineElements();
      setupTimelineStyles();
      forceShowTimelineControls();
    }, 500);
    
    setTimeout(() => {
      console.log('第三次设置时间轴样式');
      debugTimelineElements();
      setupTimelineStyles();
      forceShowTimelineControls();
    }, 1000);
    
    // 替换星空背景为纯黑色或自定义背景
    // viewer.scene.backgroundColor = Cesium.Color.BLACK;
    // viewer.scene.skyBox.show = false; // 隐藏默认星空
    
    // 调整地球的材质属性以获得更好的光照效果
    // viewer.scene.globe.material = undefined; // 使用默认材质
    // viewer.scene.globe.translucency.enabled = false;
    viewer.scene.globe.material = new Cesium.Material({
      fabric: {
        type: 'Grid',
        uniforms: {
          color: new Cesium.Color(0.3, 0.8, 1.0, 0.3), // 淡蓝色网格
          cellAlpha: 0.1,
          lineCount: new Cesium.Cartesian2(16, 16),
          lineThickness: new Cesium.Cartesian2(1.0, 1.0)
        }
      }
    });

    // 设置一个合适的初始视角（看到完整地球）
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 15000000.0), // 15,000km高度
      orientation: {
        heading: 0.0,
        pitch: -Math.PI/2,
        roll: 0.0
      }
    });
    
    viewer.cesiumWidget.creditContainer.style.display = "none";
    
    // 添加OpenStreetMap作为额外选项，保留Cesium默认选项
    if (viewer.baseLayerPicker) {
      // 添加OpenStreetMap到现有的imagery providers列表
      const openStreetMapProvider = new Cesium.ProviderViewModel({
        name: 'OpenStreetMap',
        iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/openStreetMap.png'),
        tooltip: 'OpenStreetMap - 开源地图',
        creationFunction: function() {
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/'
          });
        }
      });
      
      // 将OpenStreetMap添加到现有列表的开头
      viewer.baseLayerPicker.viewModel.imageryProviderViewModels.splice(0, 0, openStreetMapProvider);
      
      // 设置OpenStreetMap为默认选择
      viewer.baseLayerPicker.viewModel.selectedImagery = openStreetMapProvider;
    }
    
    // 设置默认的imagery layer为OpenStreetMap
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/'
      })
    );
    
    return viewer;
  }

  // 调试时间轴元素的函数
  function debugTimelineElements() {
    console.log('=== 调试时间轴元素 ===');
    
    // 检查 viewer 对象
    if (viewer) {
      console.log('viewer.timeline:', viewer.timeline);
      console.log('viewer.animation:', viewer.animation);
    }
    
    // 查找所有可能的时间轴相关元素
    const selectors = [
      '.cesium-timeline-main',
      '.cesium-timeline-container', 
      '.cesium-timeline-track',
      '.cesium-animation-container',
      '.cesium-animation-widget',
      '.cesium-widget'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`${selector}: 找到 ${elements.length} 个元素`);
      elements.forEach((element, index) => {
        console.log(`  ${selector}[${index}]:`, element);
        console.log(`    display: ${element.style.display || 'default'}`);
        console.log(`    visibility: ${element.style.visibility || 'default'}`);
        console.log(`    position: ${element.style.position || 'default'}`);
        console.log(`    bottom: ${element.style.bottom || 'default'}`);
      });
    });
  }

  // 强制显示时间轴控件的函数
  function forceShowTimelineControls() {
    if (!viewer) return;
    
    console.log('强制显示时间轴控件...');
    
    // 直接通过DOM查找所有可能的时间轴元素并强制显示
    const possibleSelectors = [
      '.cesium-timeline-main',
      '.cesium-timeline-container',
      '.cesium-timeline-track',
      '.cesium-animation-container',
      '.cesium-animation-widget',
      '.cesium-animation-controls'
    ];
    
    possibleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.display = 'block !important';
        element.style.visibility = 'visible !important';
        element.style.opacity = '1 !important';
        element.style.position = 'absolute';
        element.style.zIndex = '9999';
        console.log(`设置元素 ${selector} 为可见`);
      });
    });
    
    // 特别处理时间轴
    const timelineElements = document.querySelectorAll('.cesium-timeline-main');
    timelineElements.forEach(element => {
      element.style.bottom = '200px';
      element.style.left = '170px'; // 为动画控件留出空间
      element.style.right = '0px';
      element.style.height = '27px';
      element.style.backgroundColor = 'rgba(42, 42, 42, 0.8)';
      element.style.border = '1px solid #666';
    });
    
    // 特别处理动画控件
    const animationElements = document.querySelectorAll('.cesium-animation-container, .cesium-animation-widget');
    animationElements.forEach(element => {
      element.style.bottom = '200px';
      element.style.left = '0px';
      element.style.width = '169px';
      element.style.height = '112px';
      element.style.backgroundColor = 'rgba(42, 42, 42, 0.8)';
      element.style.borderRadius = '4px';
    });
  }

  // 设置时间轴样式的独立函数
  function setupTimelineStyles() {
    if (!viewer) return;
    
    console.log('正在设置时间轴样式...');
    
    // 查找并设置时间轴容器
    const timelineContainer = viewer.timeline?.container;
    if (timelineContainer) {
      timelineContainer.style.display = 'block';
      timelineContainer.style.visibility = 'visible';
      timelineContainer.style.position = 'absolute';
      timelineContainer.style.bottom = '200px'; // 初始位置
      timelineContainer.style.left = '0px';
      timelineContainer.style.right = '170px'; // 为动画控件留出空间
      timelineContainer.style.height = '27px';
      timelineContainer.style.zIndex = '1000';
      console.log('时间轴容器样式已设置');
    }
    
    // 查找并设置动画控件容器
    const animationContainer = viewer.animation?.container;
    if (animationContainer) {
      animationContainer.style.display = 'block';
      animationContainer.style.visibility = 'visible';
      animationContainer.style.position = 'absolute';
      animationContainer.style.bottom = '200px'; // 初始位置
      animationContainer.style.left = '0px';
      animationContainer.style.width = '169px';
      animationContainer.style.height = '112px';
      animationContainer.style.zIndex = '1000';
      console.log('动画控件容器样式已设置');
    }
    
    // 通过DOM查找并设置样式（备用方案）
    setTimeout(() => {
      const timelineElements = document.querySelectorAll('.cesium-timeline-main');
      timelineElements.forEach(element => {
        element.style.display = 'block';
        element.style.visibility = 'visible';
        console.log('通过DOM设置了时间轴样式');
      });
      
      const animationElements = document.querySelectorAll('.cesium-animation-container');
      animationElements.forEach(element => {
        element.style.display = 'block';
        element.style.visibility = 'visible';
        console.log('通过DOM设置了动画控件样式');
      });
    }, 100);
  }

  // 动态调整时间轴位置的函数
  function adjustTimelinePosition(bottomOffset = 10) {
    if (!viewer) return;
    
    console.log(`调整时间轴位置，底部偏移: ${bottomOffset}px`);
    
    // 确保时间轴控件始终可见
    forceShowTimelineControls();
    
    // 调整时间轴容器位置
    const timelineContainer = viewer.timeline?.container;
    if (timelineContainer) {
      timelineContainer.style.bottom = `${bottomOffset}px`;
      timelineContainer.style.display = 'block';
      timelineContainer.style.visibility = 'visible';
      timelineContainer.style.position = 'absolute';
      timelineContainer.style.left = '170px'; // 为动画控件留出空间
      timelineContainer.style.right = '0px';
      timelineContainer.style.height = '27px';
      timelineContainer.style.zIndex = '10000';
      console.log('时间轴容器位置已调整');
    }
    
    // 调整动画控件容器位置
    const animationContainer = viewer.animation?.container;
    if (animationContainer) {
      animationContainer.style.bottom = `${bottomOffset}px`;
      animationContainer.style.display = 'block';
      animationContainer.style.visibility = 'visible';
      animationContainer.style.position = 'absolute';
      animationContainer.style.left = '0px';
      animationContainer.style.width = '169px';
      animationContainer.style.height = '112px';
      animationContainer.style.zIndex = '10000';
      console.log('动画控件容器位置已调整');
    }
    
    // 通过DOM查找并调整位置（备用方案）
    const timelineElements = document.querySelectorAll('.cesium-timeline-main');
    timelineElements.forEach(element => {
      element.style.bottom = `${bottomOffset}px`;
      element.style.display = 'block !important';
      element.style.visibility = 'visible !important';
      element.style.position = 'absolute';
      element.style.left = '170px'; // 为动画控件留出空间
      element.style.right = '0px';
      element.style.height = '27px';
      element.style.zIndex = '10000';
      element.style.backgroundColor = 'rgba(42, 42, 42, 0.9)';
      element.style.border = '1px solid #666';
    });
    
    const animationElements = document.querySelectorAll('.cesium-animation-container, .cesium-animation-widget');
    animationElements.forEach(element => {
      element.style.bottom = `${bottomOffset}px`;
      element.style.display = 'block !important';
      element.style.visibility = 'visible !important';
      element.style.position = 'absolute';
      element.style.left = '0px';
      element.style.width = '169px';
      element.style.height = '112px';
      element.style.zIndex = '10000';
      element.style.backgroundColor = 'rgba(42, 42, 42, 0.9)';
      element.style.borderRadius = '4px';
    });
    
    console.log(`时间轴位置已调整到底部 ${bottomOffset}px，并确保可见性`);
  }

  function setupTimelineControl(onTimeChange) {
    if (!viewer) return;
    
    let lastFrame = 1; // 记录上一次的帧数，避免重复触发
    
    // 监听时钟变化事件
    viewer.clock.onTick.addEventListener(function(clock) {
      // 根据当前时间计算应该显示哪一帧
      const elapsed = Cesium.JulianDate.secondsDifference(clock.currentTime, clock.startTime);
      const frameIndex = Math.floor(elapsed / 60) + 1; // 每60秒一帧
      const clampedFrame = Math.max(1, Math.min(6, frameIndex)); // 限制在1-6帧之间
      
      // 只有当帧数真正改变时才触发回调，避免重复调用
      if (clampedFrame !== lastFrame && onTimeChange) {
        lastFrame = clampedFrame;
        console.log(`时间轴帧变化: ${clampedFrame}`);
        onTimeChange(clampedFrame);
      }
    });
    
    // 确保时间轴和动画控件可见并设置样式
    setTimeout(() => {
      console.log('检查时间轴和动画控件...');
      
      const timelineContainer = viewer.timeline?.container;
      if (timelineContainer) {
        timelineContainer.style.display = 'block';
        timelineContainer.style.bottom = '180px';
        timelineContainer.style.left = '0px';
        timelineContainer.style.right = '0px';
        timelineContainer.style.zIndex = '1000';
        timelineContainer.style.visibility = 'visible';
        timelineContainer.style.position = 'absolute';
        console.log('时间轴容器样式已设置:', timelineContainer);
      } else {
        console.warn('时间轴容器未找到, viewer.timeline:', viewer.timeline);
      }
      
      const animationContainer = viewer.animation?.container;
      if (animationContainer) {
        animationContainer.style.display = 'block';
        animationContainer.style.bottom = '180px';
        animationContainer.style.left = '0px';
        animationContainer.style.zIndex = '1000';
        animationContainer.style.visibility = 'visible';
        animationContainer.style.position = 'absolute';
        console.log('动画控件容器样式已设置:', animationContainer);
      } else {
        console.warn('动画控件容器未找到, viewer.animation:', viewer.animation);
      }
      
      // 如果仍然没有找到，尝试查找DOM元素
      if (!timelineContainer) {
        const timelineDiv = document.querySelector('.cesium-timeline-main');
        if (timelineDiv) {
          timelineDiv.style.display = 'block';
          timelineDiv.style.visibility = 'visible';
          console.log('通过DOM选择器找到并设置了时间轴');
        }
      }
      
      if (!animationContainer) {
        const animationDiv = document.querySelector('.cesium-animation-container');
        if (animationDiv) {
          animationDiv.style.display = 'block';
          animationDiv.style.visibility = 'visible';
          console.log('通过DOM选择器找到并设置了动画控件');
        }
      }
    }, 1000); // 增加延迟确保DOM完全加载
  }

  // 跳转到指定时间帧
  function jumpToTimeFrame(frame) {
    if (!viewer) return;
    
    const frameSeconds = (frame - 1) * 60; // 每帧60秒
    const targetTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, frameSeconds, new Cesium.JulianDate());
    viewer.clock.currentTime = targetTime;
    console.log(`跳转到时间帧 ${frame}，时间: ${frameSeconds}秒`);
  }

  // 设置播放速度
  function setPlaybackRate(multiplier) {
    if (!viewer) return;
    viewer.clock.multiplier = multiplier;
    console.log(`设置播放速度: ${multiplier}x`);
  }

  // 启用/禁用时间轴动画
  function setTimelineAnimation(enabled) {
    if (!viewer) return;
    if (enabled) {
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1; // 恢复正常播放速度
    } else {
      viewer.clock.shouldAnimate = false;
      viewer.clock.multiplier = 0; // 暂停时间轴
    }
    console.log(`时间轴动画: ${enabled ? '启用' : '禁用'}`);
  }

  function createEntities(frameData) {
    if (!frameData?.nodes?.length) {
      console.error('没有有效的节点数据');
      return;
    }
    
    frameData.nodes.forEach(node => {
      if (viewer.entities.getById(node.id)) return;
      
      let entityConfig;
      switch (node.type) {
        case 'satellite':
          entityConfig = createSatelliteEntity(node, showSatellite.value);
          break;
        case 'station':
          entityConfig = createStationEntity(node, showStation.value);
          break;
        case 'roadm':
          entityConfig = createRoadmEntity(node, showRoadm.value);
          break;
        default:
          return;
      }
      
      try {
        viewer.entities.add(entityConfig);
      } catch (error) {
        console.error(`创建节点 ${node.id} 失败:`, error);
      }
    });
  }
  
  function addRoadmLinks(frameData) {
    if (!frameData?.edges) return;
    
    const groundEdges = frameData.edges.filter(edge => {
      const sourceNode = frameData.nodes.find(n => n.id === edge.source);
      const targetNode = frameData.nodes.find(n => n.id === edge.target);
      return sourceNode && targetNode && 
             (sourceNode.type === 'roadm' || sourceNode.type === 'station' ||
              targetNode.type === 'roadm' || targetNode.type === 'station');
    });
    
    groundEdges.forEach(edge => {
      const sourceNode = frameData.nodes.find(n => n.id === edge.source);
      const targetNode = frameData.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;
      if (sourceNode.type === 'satellite' || targetNode.type === 'satellite') return;
      
      const sourcePosition = getEntityPosition(sourceNode, viewer);
      const targetPosition = getEntityPosition(targetNode, viewer);
      
      let linkColor, linkId;
      
      if (sourceNode.type === 'roadm' && targetNode.type === 'roadm') {
        linkColor = Cesium.Color.GREEN.withAlpha(0.7);
        linkId = `roadm-roadm-link-${edge.source}-${edge.target}`;
      } else if ((sourceNode.type === 'station' && targetNode.type === 'roadm') ||
                 (sourceNode.type === 'roadm' && targetNode.type === 'station')) {
        linkColor = Cesium.Color.YELLOW.withAlpha(0.7);
        linkId = `station-roadm-link-${edge.source}-${edge.target}`;
      } else {
        linkColor = Cesium.Color.LIGHTSKYBLUE.withAlpha(0.7);
        linkId = `other-ground-link-${edge.source}-${edge.target}`;
      }
      
      viewer.entities.add({
        id: linkId,
        show: (sourceNode.type === 'roadm' && targetNode.type === 'roadm') ? 
          showRoadm.value : 
          (showStation.value && showRoadm.value),
        polyline: {
          positions: [sourcePosition, targetPosition],
          width: 1.5,
          material: linkColor,
          arcType: Cesium.ArcType.GEODESIC,
          clampToGround: true
        }
      });
    });
  }

  function highlightSatelliteLinks(satelliteId, frameData) {
    // 清除之前的高亮链路
    highlightedLinks.forEach(entity => viewer.entities.remove(entity));
    highlightedLinks = [];

    const { nodes, edges } = frameData;
    if (!edges || !nodes) return;

    const relatedEdges = edges.filter(edge => 
      edge.source === satelliteId || edge.target === satelliteId
    );

    relatedEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const sourcePosition = getEntityPosition(sourceNode, viewer);
      const targetPosition = getEntityPosition(targetNode, viewer);

      const highlightEntity = viewer.entities.add({
        polyline: {
          positions: [sourcePosition, targetPosition],
          width: 2,
          material: Cesium.Color.RED,
          arcType: Cesium.ArcType.NONE,
        },
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

  function updateVisibility() {
    if (!viewer) return;
    
    viewer.entities.values.forEach(entity => {
      if (!entity.id) return;
      const entityId = entity.id.toString();
      
      const isSatellite = entityId.startsWith('satellite');
      const isStation = !entityId.startsWith('satellite') && !entityId.startsWith('ROADM') && 
                       (entity.billboard && entity.billboard.image && 
                       String(entity.billboard.image.getValue())?.includes('地面站'));
      const isRoadm = entityId.startsWith('ROADM') || 
                     (entity.billboard && entity.billboard.image && 
                     String(entity.billboard.image.getValue())?.includes('核心交换机'));
      
      const isRoadmRoadmLink = entityId.includes('roadm-roadm-link');
      const isStationRoadmLink = entityId.includes('station-roadm-link');
      const isSatelliteLink = entity.polyline && !isRoadmRoadmLink && !isStationRoadmLink;
      
      if (isSatellite) {
        entity.show = showSatellite.value;
      } else if (isStation) {
        entity.show = showStation.value;
      } else if (isRoadm) {
        entity.show = showRoadm.value;
      } else if (isRoadmRoadmLink) {
        entity.show = showRoadm.value && showLinks.value;
      } else if (isStationRoadmLink) {
        entity.show = showStation.value && showRoadm.value && showLinks.value;
      } else if (isSatelliteLink) {
        // 处理卫星相关链路的可见性逻辑
        const linkId = entityId;
        if (linkId.includes('satellite') && !linkId.includes('ROADM') && !linkId.includes('station')) {
          entity.show = showSatellite.value && showLinks.value;
        } else if (linkId.includes('satellite') && linkId.includes('station')) {
          entity.show = showSatellite.value && showStation.value && showLinks.value;
        } else if (linkId.includes('satellite') && linkId.includes('ROADM')) {
          entity.show = showSatellite.value && showRoadm.value && showLinks.value;
        }
      }
    });
    
    viewer.scene.requestRender();
  }

  // 修改setupClickHandler函数
  function setupClickHandler(onEntityClick) {
    if (!viewer || handler) return;
    
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    handler.setInputAction(function(click) {
      const pickedObject = viewer.scene.pick(click.position);
      
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
        const entity = pickedObject.id;
        if (entity.id) {
          // 处理所有类型的实体点击
          onEntityClick(entity.id);
        } else {
          highlightedLinks.forEach(e => viewer.entities.remove(e));
          highlightedLinks = [];
        }
      } else {
        highlightedLinks.forEach(e => viewer.entities.remove(e));
        highlightedLinks = [];
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function cleanup() {
    if (handler) {
      handler.destroy();
      handler = null;
    }
    
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
  }

  return {
    viewer: () => viewer,
    showSatellite,
    showStation,
    showRoadm,
    showLinks,
    initializeCesium,
    createEntities,
    addRoadmLinks,
    highlightSatelliteLinks,
    updateVisibility,
    setupClickHandler,
    setupTimelineControl,
    setupTimelineStyles,
    debugTimelineElements,
    forceShowTimelineControls,
    adjustTimelinePosition,
    jumpToTimeFrame,
    setPlaybackRate,
    setTimelineAnimation,
    cleanup
  };
}