// src/composables/useCesium.js
import { ref, onMounted, onUnmounted } from 'vue';
import * as Cesium from "cesium";
import { CESIUM_CONFIG } from '../constants/index.js';
import { createSatelliteEntity, createStationEntity, createRoadmEntity, getEntityPosition } from '../utils/cesiumHelpers.js';
import { useDataLoader } from './useDataLoader.js';

export function useCesium() {
  let viewer = null;
  let handler = null;
  
  // 获取数据加载器的函数
  const { getCurrentDataFolder } = useDataLoader();
  
  const showSatellite = ref(true);
  const showStation = ref(true);
  const showRoadm = ref(true);
  const showLinks = ref(true);
  
  let highlightedLinks = [];

  function initializeCesium(containerId) {
    Cesium.Ion.defaultAccessToken = CESIUM_CONFIG.ACCESS_TOKEN;
    
    viewer = new Cesium.Viewer(containerId, {
      animation: true, // 启用动画控件
      timeline: true,  // 启用时间轴
      fullscreenButton: false,
      baseLayerPicker: true, // 启用地图选择按钮
      selectionIndicator: false, // 禁用原生选择指示器，使用自定义的
      infoBox: false, // 禁用默认信息框
      requestRenderMode: false, // 改为连续渲染以获得更好的视觉效果
      maximumRenderTimeChange: Infinity,
      targetFrameRate: 60, // 提高帧率以获得更流畅的体验
      automaticallyTrackDataSourceClocks: false,
      shouldAnimate: false,
      // 启用超高分辨率渲染以支持8K星空
      resolutionScale: Math.min(window.devicePixelRatio * 2, 3.0), // 最高3倍分辨率
      // 优化WebGL设置以支持高分辨率纹理
      contextOptions: {
        webgl: {
          powerPreference: "high-performance",
          antialias: true,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        }
      }
    });

    // 启用光照和阴影 - 大幅提高地球亮度
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.5; // 大幅提高地球光照强度
    viewer.scene.globe.atmosphereBrightnessShift = 0.3; // 增加地球亮度偏移
    
    // 禁用地球大气层以获得更清晰的宇宙背景
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    
    // 基础渲染质量优化
    viewer.scene.globe.maximumScreenSpaceError = 0.5; // 提高地形质量
    
    // 使用太阳作为光源，确保光照方向与太阳位置一致
    viewer.scene.light = new Cesium.SunLight();
    
    // 设置太阳位置，使其与视觉中的太阳位置匹配
    viewer.scene.sun = new Cesium.Sun();
    viewer.scene.sun.show = true;
    
    // 确保光照方向跟随太阳位置
    viewer.scene.postRender.addEventListener(() => {
      if (viewer.scene.sun && viewer.scene.light instanceof Cesium.SunLight) {
        // 太阳光自动跟随太阳位置，这是最真实的光照
        viewer.scene.globe.enableLighting = true;
      }
    });
    
    // 设置特定时间以获得理想的太阳光照角度
    const currentTime = Cesium.JulianDate.now();
    // 调整时间以获得更好的光照角度（可以根据需要调整）
    const adjustedTime = Cesium.JulianDate.addHours(currentTime, 6, new Cesium.JulianDate()); // 调整6小时
    
    // 设置时钟的开始和结束时间范围，根据文件夹推断时间间隔
    const currentFolder = getCurrentDataFolder();
    let timeInterval = 60; // 默认60秒间隔
    let totalFrames = 6;   // 默认6帧
    
    // 根据文件夹名称推断时间间隔（避免异步调用）
    if (currentFolder === 'new') {
      timeInterval = 10;
      totalFrames = 360; // new文件夹有360个文件，总共3600秒
    } else {
      timeInterval = 60;
      totalFrames = 6;   // old文件夹通常6帧
    }
    
    const startTime = adjustedTime;
    const endTime = Cesium.JulianDate.addSeconds(startTime, totalFrames * timeInterval, new Cesium.JulianDate());
    
    viewer.clock.startTime = startTime;
    viewer.clock.currentTime = startTime; // 从第一帧开始
    viewer.clock.stopTime = endTime;
    viewer.clock.clockRange = Cesium.ClockRange.CLAMPED; // 改为CLAMPED，避免循环
    
    // 确保时钟初始状态为完全停止
    viewer.clock.shouldAnimate = false;
    viewer.clock.multiplier = 0;
    
    console.log('时钟设置完成 - 范围:', 
      Cesium.JulianDate.toIso8601(startTime), 
      '到', 
      Cesium.JulianDate.toIso8601(endTime)
    );
    console.log(`时钟总时长: ${Cesium.JulianDate.secondsDifference(endTime, startTime)}秒`);
    
    // 强制刷新时间轴设置
    setTimeout(() => {
      if (viewer.timeline) {
        viewer.timeline.updateFromClock();
        viewer.timeline.resize();
      }
    }, 500);
    
    // 启用真实的太阳光照计算
    viewer.scene.globe.atmosphereHueShift = 0.0;
    viewer.scene.globe.atmosphereSaturationShift = 0.0;
    
    // 设置超清晰宇宙背景
    
    // 创建8K分辨率的程序化星空背景
    try {
      // 创建高分辨率canvas作为星空纹理
      // const createHighResStarTexture = (size = 2048) => { // 降低到2K以减少内存使用
      const createHighResStarTexture = (size = 4096) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 设置深空背景
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, '#000814');
        gradient.addColorStop(0.3, '#001122');
        gradient.addColorStop(0.7, '#000511');
        gradient.addColorStop(1, '#000000');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // 添加星星（优化数量以减少内存使用）
        const starCount = 4000; // 从15000降低到8000
        for (let i = 0; i < starCount; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const brightness = Math.random() * 0.8 + 0.1; // 轻微降低：从0-1改为0.1-0.9
          const starSize = Math.random() * 2 + 0.5;
          
          // 星星颜色变化（蓝色、白色、黄色、红色）
          let color;
          const colorRand = Math.random();
          if (colorRand < 0.7) {
            color = `rgba(240, 240, 240, ${brightness * 0.9})`; // 轻微降低白色星星亮度
          } else if (colorRand < 0.85) {
            color = `rgba(190, 210, 240, ${brightness * 0.85})`; // 轻微降低蓝色星星亮度
          } else if (colorRand < 0.95) {
            color = `rgba(240, 220, 190, ${brightness * 0.85})`; // 轻微降低黄色星星亮度
          } else {
            color = `rgba(240, 190, 140, ${brightness * 0.8})`; // 轻微降低红色星星亮度
          }
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, starSize, 0, Math.PI * 2);
          ctx.fill();
          
          // 为明亮的星星添加光晕（轻微降低光晕强度）
          if (brightness > 0.8) {
            ctx.fillStyle = `rgba(240, 240, 240, ${brightness * 0.25})`; // 从0.3降低到0.25
            ctx.beginPath();
            ctx.arc(x, y, starSize * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // 添加星云效果（轻微降低透明度）
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const nebulaSize = Math.random() * 200 + 50;
          
          const nebulaGradient = ctx.createRadialGradient(x, y, 0, x, y, nebulaSize);
          nebulaGradient.addColorStop(0, 'rgba(90, 140, 230, 0.08)'); // 从0.1轻微降低到0.08
          nebulaGradient.addColorStop(0.5, 'rgba(140, 90, 230, 0.04)'); // 从0.05轻微降低到0.04
          nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = nebulaGradient;
          ctx.fillRect(x - nebulaSize, y - nebulaSize, nebulaSize * 2, nebulaSize * 2);
        }
        
        return canvas.toDataURL();
      };
      
      // 为天空盒的6个面创建不同的纹理
      const faces = ['positiveX', 'negativeX', 'positiveY', 'negativeY', 'positiveZ', 'negativeZ'];
      const sources = {};
      
      faces.forEach(face => {
        // sources[face] = createHighResStarTexture(2048); // 2K分辨率每面以减少内存
        sources[face] = createHighResStarTexture(4096); // 2K分辨率每面以减少内存
      });
      
      // 应用8K星空背景
      viewer.scene.skyBox = new Cesium.SkyBox({
        sources: sources
      });
      
      console.log('8K分辨率星空背景创建成功');
      
    } catch (error) {
      console.warn('8K星空背景创建失败，使用备用方案:', error);
      
      // 备用方案：增强默认星空
      viewer.scene.skyBox.show = true;
      viewer.scene.sun.show = true;
      viewer.scene.moon.show = true;
      
      // 增强太阳的视觉效果
      try {
        viewer.scene.sun.glowFactor = 2.0; // 增强太阳光晕
        viewer.scene.sun.size = 1.5; // 增大太阳大小
        console.log('太阳视觉增强成功');
      } catch (error) {
        console.warn('太阳增强设置失败:', error);
      }
    }
    
    // 设置纯黑背景色以增强对比度
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    
    // 禁用雾化效果，让远处物体更清晰
    viewer.scene.fog.enabled = false;
    
    console.log('8K分辨率星空背景设置完成');
    
    // 设置专门的地球照明增强
    setTimeout(() => {
      if (viewer && viewer.scene && viewer.scene.globe) {
        viewer.scene.globe.lambertDiffuseMultiplier = 1.8; // 增强漫反射，让地球更亮
        viewer.scene.globe.nightFadeOutDistance = 1e8; // 延长夜晚淡出距离
        viewer.scene.globe.nightFadeInDistance = 1e7; // 延长夜晚淡入距离
        
        // 确保光照跟随太阳位置
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
        
        console.log('地球照明增强已启用');
      }
    }, 1000); // 延迟设置确保globe已初始化
    
    // 添加额外的8K优化
    try {
      // 启用高质量纹理过滤
      viewer.scene.context._gl.texParameteri(
        viewer.scene.context._gl.TEXTURE_2D,
        viewer.scene.context._gl.TEXTURE_MAG_FILTER,
        viewer.scene.context._gl.LINEAR
      );
      
      // 设置最高质量的纹理设置
      viewer.scene.context._gl.texParameteri(
        viewer.scene.context._gl.TEXTURE_2D,
        viewer.scene.context._gl.TEXTURE_MIN_FILTER,
        viewer.scene.context._gl.LINEAR_MIPMAP_LINEAR
      );
      
      console.log('8K纹理优化应用成功');
    } catch (error) {
      console.warn('高级纹理优化失败，但不影响基本功能:', error);
    }
    
    // 使用默认清晰地球材质并增强亮度
    viewer.scene.globe.material = undefined; // 使用清晰的默认材质
    viewer.scene.globe.translucency.enabled = false;
    
    // 额外的地球亮度增强设置
    viewer.scene.globe.baseColor = Cesium.Color.WHITE.clone(); // 设置基础颜色为白色增强亮度
    viewer.scene.globe.luminanceAtZenith = 0.8; // 增加天顶亮度
    
    // 调整地球表面反射率
    try {
      viewer.scene.globe._surface._tileProvider._material = undefined;
      console.log('地球亮度增强设置完成');
    } catch (error) {
      console.warn('部分地球亮度设置失败，但不影响主要效果:', error);
    }

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
    // 调试函数已禁用以减少控制台输出
    return;
  }

  // 强制显示时间轴控件的函数
  function forceShowTimelineControls() {
    if (!viewer) return;
    
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
    let isInitialized = false; // 防止初始化时的误触发
    
    // 延迟启用监听器，避免初始化时的自动触发
    setTimeout(() => {
      isInitialized = true;
    }, 2000); // 2秒后才启用，确保初始化完成
    
    // 监听时钟变化事件
    viewer.clock.onTick.addEventListener(function(clock) {
      // 只有在初始化完成且时钟真是在播放时才响应
      if (!isInitialized || !clock.shouldAnimate) {
        return;
      }
      
      // 根据当前时间计算应该显示哪一帧
      const elapsed = Cesium.JulianDate.secondsDifference(clock.currentTime, clock.startTime);
      
      // 根据文件夹动态计算时间间隔
      const currentFolder = getCurrentDataFolder();
      let timeInterval, maxFrames;
      
      if (currentFolder === 'new') {
        timeInterval = 10; // 每10秒一帧
        maxFrames = 360; // 支持360个文件
      } else {
        timeInterval = 60; // 每60秒一帧
        maxFrames = 6;
      }
      
      const frameIndex = Math.floor(elapsed / timeInterval) + 1;
      const clampedFrame = Math.max(1, Math.min(maxFrames, frameIndex));
      
      // 添加详细的调试日志
      if (frameIndex !== clampedFrame) {
        console.warn(`⚠️ 帧数被限制: 计算帧=${frameIndex}, 最大帧=${maxFrames}, 限制后=${clampedFrame}`);
        console.warn(`当前文件夹=${currentFolder}, 时间间隔=${timeInterval}, 已播放时间=${elapsed}秒`);
        console.warn(`时钟状态: 开始=${Cesium.JulianDate.toIso8601(clock.startTime)}, 当前=${Cesium.JulianDate.toIso8601(clock.currentTime)}, 结束=${Cesium.JulianDate.toIso8601(clock.stopTime)}`);
      }
      
      // 检查是否到达时钟结束时间
      const isAtEnd = Cesium.JulianDate.compare(clock.currentTime, clock.stopTime) >= 0;
      if (isAtEnd) {
        console.warn(`🔄 时钟已到达结束时间，当前帧=${clampedFrame}`);
      }
      
      // 只有当帧数真正改变时才触发回调，避免重复调用
      if (clampedFrame !== lastFrame && onTimeChange) {
        lastFrame = clampedFrame;
        console.log(`🎬 时间轴帧变化: ${clampedFrame} (elapsed: ${elapsed.toFixed(1)}s, frameIndex: ${frameIndex}, folder: ${currentFolder})`);
        onTimeChange(clampedFrame);
      }
    });
    
    // 确保时间轴和动画控件可见并设置样式
    setTimeout(() => {
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
    
    // 根据当前文件夹动态计算时间间隔
    const currentFolder = getCurrentDataFolder();
    const timeInterval = currentFolder === 'new' ? 10 : 60;
    
    const frameSeconds = (frame - 1) * timeInterval;
    const targetTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, frameSeconds, new Cesium.JulianDate());
    viewer.clock.currentTime = targetTime;
  }

  // 设置播放速度
  function setPlaybackRate(multiplier = 1) {
    if (!viewer) return;
    viewer.clock.multiplier = multiplier;
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

  let selectedLinkEntity = null;

  // 修改 setupClickHandler 函数
  function setupClickHandler(onEntityClick) {
    if (!viewer || handler) return;
    
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    handler.setInputAction(function(click) {
      const pickedObject = viewer.scene.pick(click.position);
      
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
        const entity = pickedObject.id;
        if (entity.id) {
          // 检查是否为链路实体
          if (entity.entityType === 'link') {
            // 高亮显示选中的链路
            highlightSelectedLink(entity);
            
            // 传递链路ID
            onEntityClick(entity.id);
          } else {
            // 点击非链路实体时，清除链路选中状态
            if (selectedLinkEntity) {
              resetLinkHighlight(selectedLinkEntity);
              selectedLinkEntity = null;
            }
            
            // 其他实体处理保持不变
            onEntityClick(entity.id);
          }
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

  // 添加高亮选中链路的函数
  function highlightSelectedLink(linkEntity) {
    // 如果之前有选中的链路，先恢复其样式
    if (selectedLinkEntity && selectedLinkEntity.id !== linkEntity.id) {
      resetLinkHighlight(selectedLinkEntity);
    }
    
    // 保存当前选中的链路
    selectedLinkEntity = linkEntity;
    
    // 修改链路样式以显示选中效果
    if (linkEntity.polyline) {
      // 保存原始宽度和颜色以便后续还原
      linkEntity._originalWidth = linkEntity.polyline.width.getValue();
      linkEntity._originalColor = linkEntity.polyline.material.color ? 
        linkEntity.polyline.material.color.getValue().clone() : 
        Cesium.Color.RED;
        
      // 设置选中效果：加粗和发光效果
      linkEntity.polyline.width = 4; // 加粗线条
      linkEntity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.YELLOW.withAlpha(0.8)
      });
    }
  }

  // 恢复链路原始样式
  function resetLinkHighlight(linkEntity) {
    if (linkEntity && linkEntity.polyline) {
      // 恢复原始宽度和颜色
      if (linkEntity._originalWidth) {
        linkEntity.polyline.width = linkEntity._originalWidth;
      }
      if (linkEntity._originalColor) {
        linkEntity.polyline.material = linkEntity._originalColor;
      } else {
        linkEntity.polyline.material = Cesium.Color.RED;
      }
    }
  }

  // 在 highlightSatelliteLinks 函数中添加对选中链路的处理
  function highlightSatelliteLinks(satelliteId, frameData) {
    // 记录当前选中的链路ID，如果有的话
    const selectedLinkId = selectedLinkEntity ? selectedLinkEntity.id : null;
    
    // 清除之前的高亮链路
    highlightedLinks.forEach(entity => viewer.entities.remove(entity));
    highlightedLinks = [];
    selectedLinkEntity = null;

    const { nodes, edges } = frameData;
    if (!edges || !nodes) return;

    const relatedEdges = edges.filter(edge => 
      edge.source === satelliteId || edge.target === satelliteId
    );

    // 创建动态位置回调函数
    const createDynamicPositionCallback = (node) => {
      if (node.type === 'satellite') {
        // 对于卫星节点，创建动态位置回调
        return new Cesium.CallbackProperty(function(time, result) {
          // 尝试从场景中获取实时的卫星实体位置
          const satelliteEntity = viewer.entities.getById(node.id);
          if (satelliteEntity && satelliteEntity.position) {
            // 如果是CallbackProperty，获取其值
            if (typeof satelliteEntity.position.getValue === 'function') {
              return satelliteEntity.position.getValue(time, result);
            }
            // 如果是Cartesian3，直接返回
            else if (satelliteEntity.position instanceof Cesium.Cartesian3) {
              return satelliteEntity.position;
            }
          }
          // 如果无法获取实时位置，返回静态位置
          return getEntityPosition(node, viewer);
        }, false);
      } else {
        // 对于地面节点，返回静态位置
        return getEntityPosition(node, viewer);
      }
    };

    relatedEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      // 创建动态位置数组
      const dynamicPositions = new Cesium.CallbackProperty(function(time, result) {
        const sourcePos = sourceNode.type === 'satellite' ? 
          createDynamicPositionCallback(sourceNode).getValue(time) : 
          getEntityPosition(sourceNode, viewer);
        const targetPos = targetNode.type === 'satellite' ? 
          createDynamicPositionCallback(targetNode).getValue(time) : 
          getEntityPosition(targetNode, viewer);
        
        return [sourcePos, targetPos];
      }, false);

      // 添加可点击的实体属性
      const highlightEntity = viewer.entities.add({
        id: `${edge.source}-${edge.target}`,
        entityType: 'link',
        source: edge.source,
        target: edge.target,
        polyline: {
          positions: dynamicPositions,
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
      
      // 如果这条链路之前被选中，恢复选中状态
      if (selectedLinkId === `${edge.source}-${edge.target}`) {
        highlightSelectedLink(highlightEntity);
      }
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
          // 检查是否为链路实体
          if (entity.entityType === 'link') {
            // 传递链路ID（与ObjectViewer中相同格式），这样父组件可以正确处理
            onEntityClick(entity.id);
          } else {
            // 其他实体（卫星、地面站等）保持原有逻辑
            onEntityClick(entity.id);
          }
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
    console.log('清理Cesium资源...');
    
    if (handler) {
      handler.destroy();
      handler = null;
    }
    
    if (viewer) {
      try {
        // 清理所有实体
        viewer.entities.removeAll();
        
        // 清理数据源
        viewer.dataSources.removeAll();
        
        // 销毁viewer
        viewer.destroy();
        viewer = null;
        console.log('Cesium viewer已销毁');
      } catch (error) {
        console.error('清理Cesium时出错:', error);
      }
    }
  }

  // 重置时钟范围（用于文件夹切换）
  function resetClockRange(folderName) {
    if (!viewer) return;
    
    const currentTime = Cesium.JulianDate.now();
    const adjustedTime = Cesium.JulianDate.addHours(currentTime, 6, new Cesium.JulianDate());
    
    let timeInterval = 60;
    let totalFrames = 6;
    
    if (folderName === 'new') {
      timeInterval = 10;
      totalFrames = 360; // 360个文件，总共3600秒
    } else {
      timeInterval = 60;
      totalFrames = 6;
    }
    
    const startTime = adjustedTime;
    const endTime = Cesium.JulianDate.addSeconds(startTime, totalFrames * timeInterval, new Cesium.JulianDate());
    
    // 停止动画
    viewer.clock.shouldAnimate = false;
    
    // 重新设置时钟
    viewer.clock.startTime = startTime;
    viewer.clock.currentTime = startTime;
    viewer.clock.stopTime = endTime;
    viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
    viewer.clock.multiplier = 0;
    
    console.log(`✅ 时钟重置完成 - 文件夹: ${folderName}, 时间间隔: ${timeInterval}秒, 总帧数: ${totalFrames}`);
    
    // 强制刷新时间轴
    setTimeout(() => {
      if (viewer.timeline) {
        viewer.timeline.updateFromClock();
        viewer.timeline.resize();
      }
    }, 200);
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
    resetClockRange,
    highlightSelectedLink,
    resetLinkHighlight,
    cleanup
  };
}