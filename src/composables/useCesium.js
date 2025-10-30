// src/composables/useCesium.js
// 2000多行代码，看不懂啊。
// 该模块是卫星网络仿真系统三维场景的核心控制器
// 负责 Cesium 初始化、地球与星空渲染、仿真时间轴、实体和链路管理、场景交互、2D/3D兼容、动画与数据同步、资源清理等功能。
// 保证仿真动画流畅、数据与场景实时联动、交互体验友好，适用于复杂卫星网络仿真与可视化应用
import { ref, onMounted, onUnmounted } from 'vue';
import * as Cesium from "cesium";
import { CESIUM_CONFIG } from '../constants/index.js';
import { createSatelliteEntity, createStationEntity, createRoadmEntity, getEntityPosition } from '../utils/cesiumHelpers.js';
import { useDataLoader } from './useDataLoader.js';
import { parseFolderName } from '../utils/folderParser.js';

export function useCesium() {
  let viewer = null;
  let handler = null;
  
  // 获取数据加载器的功能
  const { getCurrentDataFolder } = useDataLoader();
  
  // 光照状态 10.27新增
  const lightingEnabled = ref(true);
  //新增结束
  
  // 国界线状态 10.27新增
  const borderEnabled = ref(true);
  //新增结束
  
  // 经纬线网格状态 10.28新增
  const gridEnabled = ref(true);
  //新增结束
  
  // 星空背景状态 10.28新增
  const skyEnabled = ref(true);
  //新增结束

  // 当前时间轴配置（避免重复解析）
  let currentTimelineConfig = { isDefault: true, interval: 60, totalDuration: 360 };
  
  // 创建经纬线网格函数 10.28新增
  function createGridLines(gridDataSource) {
    // 清除现有的网格线
    gridDataSource.entities.removeAll();
    
    // 统一设置网格密度（不按距离设置，全一样）
    // 减少经纬线数量：经度间隔为10度，纬度间隔为10度
    let lonInterval = 10; // 经度间隔改为10度，减少经线数量
    let latInterval = 10; // 纬度间隔改为10度，减少纬线数量
    
    // 创建经线
    for (let lon = -180; lon <= 180; lon += lonInterval) {
      // 确保经度在有效范围内
      const normalizedLon = Math.max(-180, Math.min(180, lon));
      
      // 使用SampledPositionProperty而不是直接创建polyline，避免几何计算错误
      const positions = [];
      // 生成从南极到北极的点，避免直接连接两极
      for (let lat = -90; lat <= 90; lat += 10) { // 增加点间隔到10度
        positions.push(Cesium.Cartesian3.fromDegrees(normalizedLon, lat, 10)); // 降低高度到10米，更贴近地球表面
      }
      
      gridDataSource.entities.add({
        polyline: {
          positions: positions,
          width: 1,
          material: Cesium.Color.GRAY.withAlpha(0.5), // 改为灰黑色
          clampToGround: false
        }
      });
    }
    
    // 创建纬线
    for (let lat = -90; lat <= 90; lat += latInterval) {
      // 确保纬度在有效范围内，并避免极点
      const normalizedLat = Math.max(-85, Math.min(85, lat));
      
      // 使用SampledPositionProperty而不是直接创建polyline，避免几何计算错误
      const positions = [];
      // 生成从西向东的点
      for (let lon = -180; lon <= 180; lon += 10) { // 增加点间隔到10度
        positions.push(Cesium.Cartesian3.fromDegrees(lon, normalizedLat, 10)); // 降低高度到10米，更贴近地球表面
      }
      
      gridDataSource.entities.add({
        polyline: {
          positions: positions,
          width: 1,
          material: Cesium.Color.GRAY.withAlpha(0.5), // 改为灰黑色
          clampToGround: false
        }
      });
    }
    
    console.log(`经纬线网格已生成，经度间隔: ${lonInterval}°, 纬度间隔: ${latInterval}°`);
  }
  
  // 更新网格密度函数 10.28新增 - 修复旋转地球时经纬线消失问题
  function updateGridDensity(gridDataSource) {
    if (!gridDataSource) return;
    
    // 无论网格当前是否显示，都重新生成网格线
    // 这样可以确保在旋转地球或缩放时网格不会消失
    createGridLines(gridDataSource);
    
    // 根据当前状态设置可见性
    gridDataSource.show = gridEnabled.value;
  } //新增结束
  
  // 显示状态管理
  const showSatellite = ref(true);
  const showStation = ref(true);
  const showRoadm = ref(true);
  const showLinks = ref(true);
  
  let highlightedLinks = [];

  function initializeCesium(containerId) {
    // 不再需要Cesium Ion访问令牌，完全使用本地资源
    // Cesium.Ion.defaultAccessToken = CESIUM_CONFIG.ACCESS_TOKEN;
    
    console.log('初始化Cesium (仅本地资源模式)...');
    
    // 添加全局错误处理，抑制瓦片加载错误
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      // 忽略OSM和其他地图瓦片加载错误
      if (message.includes('OpenStreetMapImageryProvider') || 
          message.includes('Failed to obtain image tile') ||
          message.includes('imagery tile') ||
          message.includes('TileMapServiceImageryProvider')) {
        return; // 不输出这些错误
      }
      originalConsoleError.apply(console, args);
    };
    
    viewer = new Cesium.Viewer(containerId, {
      animation: false, // 禁用动画控件（移除左下角的球形控件）
      timeline: true,  // 启用时间轴
      fullscreenButton: false,
      baseLayerPicker: false, // 禁用地图选择按钮，只使用本地资源
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

    // 配置本地地球纹理资源
    try {
      // 移除所有默认图层
      if (viewer.imageryLayers.length > 0) {
        viewer.imageryLayers.removeAll();
      }
      
      // 直接使用本地图片文件，不通过复杂的Provider
      // 创建一个简单的纹理URL
      const textureUrl = window.location.origin + '/texture/earth.jpg';
      console.log('尝试加载纹理URL:', textureUrl);
      
      // 使用最简单的方式：UrlTemplateImageryProvider配置为单张图片
      const earthImageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: textureUrl,
        rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
        tilingScheme: new Cesium.GeographicTilingScheme({
          numberOfLevelZeroTilesX: 1,
          numberOfLevelZeroTilesY: 1
        }),
        maximumLevel: 0,
        credit: 'Natural Earth'
      });
      
      viewer.imageryLayers.addImageryProvider(earthImageryProvider);
      
      console.log('Cesium: 正在加载本地地球纹理...');
    } catch (error) {
      console.warn('Cesium: 本地底图配置失败', error);
      useBackupEarthRendering();
    }

    // 初始化经纬线网格 10.28新增 - 使用自定义实体方式
    let gridEntities = null;
    try {
      // 创建经纬线网格数据源
      gridEntities = new Cesium.CustomDataSource('gridLines');
      viewer.dataSources.add(gridEntities);
      
      // 生成经纬线网格
      createGridLines(gridEntities);
      
      // 根据初始状态设置可见性
      gridEntities.show = gridEnabled.value;
      
      // 移除相机移动事件监听器，避免频繁重新生成网格线导致闪烁
      // viewer.camera.moveEnd.addEventListener(function() {
      //   updateGridDensity(gridEntities);
      // });
      
      console.log('Cesium: 经纬线网格初始化完成');
    } catch (error) {
      console.warn('Cesium: 经纬线网格初始化失败', error);
    }
    // 新增结束

    // 启用光照和阴影 - 大幅提高地球亮度
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.5; // 大幅提高地球光照强度
    viewer.scene.globe.atmosphereBrightnessShift = 0.3; // 增加地球亮度偏移
    
    // 禁用地球大气层以获得更清晰的宇宙背景
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    
    // 初始化星空背景 10.28新增
    viewer.scene.skyBox = new Cesium.SkyBox({
      sources: {
        positiveX: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_px.jpg',
        negativeX: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_mx.jpg',
        positiveY: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_py.jpg',
        negativeY: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_my.jpg',
        positiveZ: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_pz.jpg',
        negativeZ: 'https://zimiao.oss-cn-beijing.aliyuncs.com/images/tycho2t3_80_mz.jpg'
      }
    });
    // 根据初始状态设置星空可见性
    viewer.scene.skyBox.show = skyEnabled.value;
    //新增结束
    
    // 基础渲染质量优化
    viewer.scene.globe.maximumScreenSpaceError = 0.5; // 提高地形质量
    
    // 使用太阳作为光源，确保光照方向与太阳位置一致
    viewer.scene.light = new Cesium.SunLight();
    
    // 设置太阳位置，使其与视觉中的太阳位置匹配
    viewer.scene.sun = new Cesium.Sun();
    viewer.scene.sun.show = true;
    
    // 确保光照方向跟随太阳位置，同时尊重lightingEnabled状态
    viewer.scene.postRender.addEventListener(() => {
      if (viewer.scene.sun && viewer.scene.light instanceof Cesium.SunLight) {
        // 太阳光自动跟随太阳位置，但根据lightingEnabled状态决定是否启用光照，10.27新增
        viewer.scene.globe.enableLighting = lightingEnabled.value;
      }
    });
    
    // 设置仿真时钟配置
    const currentTime = Cesium.JulianDate.now();
    // 调整时间以获得更好的光照角度（可以根据需要调整）
    const adjustedTime = Cesium.JulianDate.addHours(currentTime, 6, new Cesium.JulianDate()); // 调整6小时
    
    // 配置时钟以支持仿真同步 - 从0:00:00开始，但允许全时间轴拖拽
    viewer.clock.startTime = adjustedTime;
    // 初始设置一个默认的stopTime，会在resetClockRange中被正确设置
    viewer.clock.stopTime = Cesium.JulianDate.addSeconds(adjustedTime, 360, new Cesium.JulianDate()); 
    // 设置为起始时间，显示0:00:00
    viewer.clock.currentTime = adjustedTime;
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED; // 不限制范围，允许任意时间跳转
    viewer.clock.multiplier = 1; // 默认1倍速度
    viewer.clock.shouldAnimate = false; // 默认不自动播放，等待仿真控制
    
    console.log('Cesium时钟已配置为仿真同步模式，从0:00:00开始');
    
    // 移除有问题的闪烁定时器，改用事件拦截方法
    setTimeout(() => {
      if (viewer.timeline) {
        console.log('时间轴初始化完成，设置全范围拖拽事件');
        
        // 拦截时间轴的鼠标事件，允许点击任意位置
        const timelineElement = document.querySelector('.cesium-timeline-main');
        if (timelineElement) {
          timelineElement.addEventListener('mousedown', function(event) {
            // 计算点击位置对应的时间
            const rect = timelineElement.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const timelineWidth = rect.width;
            const percentage = clickX / timelineWidth;
            
            // 计算对应的时间
            const totalSeconds = Cesium.JulianDate.secondsDifference(viewer.clock.stopTime, viewer.clock.startTime);
            const targetSeconds = totalSeconds * percentage;
            const targetTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, targetSeconds, new Cesium.JulianDate());
            
            // 直接设置时间
            viewer.clock.currentTime = targetTime;
            
            console.log(`时间轴点击跳转: ${percentage.toFixed(2)}% -> ${targetSeconds.toFixed(1)}秒`);
            
            // 阻止默认行为
            event.preventDefault();
            event.stopPropagation();
          }, true); // 使用capture模式确保事件被拦截
          
          console.log('时间轴全范围点击已启用');
        }
      }
    }, 1000);
    
    // 重新启用原生Cesium时间轴以获得完整的拖拽功能
    if (viewer.animation && viewer.animation.container) {
      viewer.animation.container.style.display = 'block';
    }
    
    if (viewer.timeline && viewer.timeline.container) {
      viewer.timeline.container.style.display = 'block';
      
      // 关键修复：强制允许向前拖拽时间轴
      setTimeout(() => {
        if (viewer.timeline && viewer.timeline._timeBarSeekFunction) {
          // 保存原始的seek函数
          const originalSeek = viewer.timeline._timeBarSeekFunction;
          // 重写seek函数，移除时间限制
          viewer.timeline._timeBarSeekFunction = function(e) {
            const timeline = viewer.timeline;
            if (!timeline) return;
            
            const timeBar = timeline._timeBarSeekFunction.timeBar || timeline._timeBar;
            if (!timeBar) return;
            
            // 计算目标时间，不受currentTime限制
            const rect = timeBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            const totalDuration = Cesium.JulianDate.secondsDifference(viewer.clock.stopTime, viewer.clock.startTime);
            const targetTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, percentage * totalDuration, new Cesium.JulianDate());
            
            // 直接设置时间，不检查限制
            viewer.clock.currentTime = targetTime;
          };
        }
      }, 1000);
    }
      
    
    
    // 定义自定义时间轴函数
      window.createSimulationTimeline = function() {
        console.log('创建仿真时间轴...');
        
        // 移除现有的时间轴（包括Cesium原生和自定义的）
        const existingCesiumTimeline = document.querySelector('.cesium-timeline-main');
        if (existingCesiumTimeline) {
          existingCesiumTimeline.style.display = 'none';
        }
        
        const existingCustomTimeline = document.querySelector('.simulation-timeline');
        if (existingCustomTimeline) {
          existingCustomTimeline.remove();
        }
        
        // 创建仿真时间轴容器
        const simulationTimeline = document.createElement('div');
        simulationTimeline.className = 'simulation-timeline';
        simulationTimeline.style.cssText = `
          position: absolute;
          bottom: 60px;  /* 降低高度避免遮挡底部面板 */
          left: 360px;  /* 增加左侧偏移以给节点跳转框留出空间 */
          right: 5px;
          height: 27px;
          background: rgba(42, 42, 42, 0.95);
          border: 1px solid #666;
          border-radius: 3px;
          z-index: 9999;  /* 降低z-index避免遮挡重要UI元素 */
          display: flex;
          align-items: center;
          padding: 0 8px;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        // 创建时间显示（当前时间）
        const currentTimeDisplay = document.createElement('div');
        currentTimeDisplay.style.cssText = `
          color: #00ff00;
          font-size: 11px;
          font-weight: bold;
          min-width: 70px;
          text-align: center;
          margin-right: 8px;
          font-family: monospace;
        `;
        
        // 初始化当前时间显示，根据数据文件夹状态设置
        const currentFolder = getCurrentDataFolder();
        const currentConfig = parseFolderName(currentFolder);
        
        // 更新全局时间轴配置
        currentTimelineConfig = currentConfig;
        
        if (currentConfig.isDefault) {
          currentTimeDisplay.textContent = '--:--:--';
        } else {
          currentTimeDisplay.textContent = '00:00:00';
        }
        
        // 创建时间轴轨道容器
        const trackContainer = document.createElement('div');
        trackContainer.style.cssText = `
          flex: 1;
          height: 20px;
          position: relative;
          margin: 0 8px;
        `;
        
        // 创建背景轨道
        const backgroundTrack = document.createElement('div');
        backgroundTrack.style.cssText = `
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(80, 80, 80, 0.9) 0%,
            rgba(60, 60, 60, 0.9) 50%,
            rgba(40, 40, 40, 0.9) 100%);
          border: 1px solid #555;
          border-radius: 10px;
          position: absolute;
          top: 0;
          left: 0;
          cursor: pointer;
          user-select: none;
        `;
        
        // 创建已运行区域（绿色渐变）
        const runTrack = document.createElement('div');
        runTrack.style.cssText = `
          width: 0%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(0, 200, 100, 0.8) 0%,
            rgba(0, 180, 80, 0.8) 50%,
            rgba(0, 160, 60, 0.8) 100%);
          border-radius: 10px;
          position: absolute;
          top: 0;
          left: 0;
          cursor: pointer;
          user-select: none;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
        `;
        
        // 创建当前时间指针（滑块样式）
        const needle = document.createElement('div');
        needle.style.cssText = `
          position: absolute;
          left: 0%;
          top: -4px;
          width: 16px;
          height: 28px;
          background: linear-gradient(
            to bottom,
            #ff4444 0%,
            #ff0000 50%,
            #cc0000 100%);
          border: 2px solid #fff;
          border-radius: 8px;
          z-index: 3;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          cursor: grab;
          transform: translateX(-50%);
          user-select: none;
        `;
        
        // 添加滑块内部的指示线
        const needleInner = document.createElement('div');
        needleInner.style.cssText = `
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          height: 12px;
          background: #fff;
          transform: translate(-50%, -50%);
          border-radius: 1px;
        `;
        needle.appendChild(needleInner);
        
        // 创建总时间显示 - 根据数据文件夹动态计算
        const totalTimeDisplay = document.createElement('div');
        totalTimeDisplay.id = 'custom-total-time-display'; // 添加ID便于后续更新
        totalTimeDisplay.style.cssText = `
          color: #ccc;
          font-size: 11px;
          min-width: 70px;
          text-align: center;
          margin-left: 8px;
          font-family: monospace;
        `;
        
        // 根据数据文件夹计算总时间 - 使用全局配置  
        if (currentTimelineConfig.isDefault) {
          // 默认状态显示虚线
          totalTimeDisplay.textContent = '--:--:--';
        } else {
          const totalSeconds = currentTimelineConfig.totalDuration; // 直接使用解析得到的总时长
          const totalMinutes = Math.floor(totalSeconds / 60);
          const remainingSeconds = totalSeconds % 60;
          const totalHours = Math.floor(totalMinutes / 60);
          const displayMinutes = totalMinutes % 60;
          totalTimeDisplay.textContent = `${totalHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        
        // 创建刻度标记容器
        const tickContainer = document.createElement('div');
        tickContainer.style.cssText = `
          position: absolute;
          top: -8px;
          left: 0;
          right: 0;
          height: 6px;
        `;
        
        // 添加时间刻度标记
        for (let i = 0; i <= 6; i++) {
          const tick = document.createElement('div');
          tick.style.cssText = `
            position: absolute;
            left: ${(i / 6) * 100}%;
            top: 0;
            width: 1px;
            height: 6px;
            background: #888;
          `;
          tickContainer.appendChild(tick);
          
          // 添加时间标签
          const label = document.createElement('div');
          label.style.cssText = `
            position: absolute;
            left: ${(i / 6) * 100}%;
            top: -18px;
            transform: translateX(-50%);
            color: #aaa;
            font-size: 9px;
            white-space: nowrap;
            font-family: monospace;
          `;
          label.textContent = `${i}:00`;
          tickContainer.appendChild(label);
        }
        
        // 组装时间轴
        trackContainer.appendChild(backgroundTrack);
        trackContainer.appendChild(runTrack);
        trackContainer.appendChild(needle);
        trackContainer.appendChild(tickContainer);
        
        simulationTimeline.appendChild(currentTimeDisplay);
        simulationTimeline.appendChild(trackContainer);
        simulationTimeline.appendChild(totalTimeDisplay);
        
        // 添加到Cesium容器
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
          cesiumContainer.appendChild(simulationTimeline);
          console.log('仿真时间轴已添加到页面');
        }
        
        // 动态调整时间轴位置以避免遮挡底部面板
        // 防循环标志
        let isAdjusting = false;
        
        function adjustTimelinePosition() {
          // 防止循环调用
          if (isAdjusting) {
            console.log('位置调整进行中，跳过重复调用');
            return;
          }
          
          isAdjusting = true;
          
          try {
            const bottomPanels = [
              document.querySelector('.service-panel'),
              document.querySelector('.chart-panel'),
              document.querySelector('.data-panel')
            ];
            
            let maxBottomHeight = 60; // 默认底部距离
            
            bottomPanels.forEach(panel => {
              if (panel) {
                const rect = panel.getBoundingClientRect();
                const isVisible = rect.height > 0 && 
                                getComputedStyle(panel).display !== 'none' &&
                                getComputedStyle(panel).visibility !== 'hidden';
                
                if (isVisible && rect.height > 50) {
                  // 面板可见且有合理高度，计算需要的底部距离
                  const panelHeight = rect.height;
                  const bottomDistance = panelHeight + 10; // 面板高度 + 10px间距
                  maxBottomHeight = Math.max(maxBottomHeight, bottomDistance);
                  console.log(`发现展开的面板，高度: ${panelHeight}px`);
                }
              }
            });
            
            // 检查收起的底部面板
            const collapsedBottomPanel = document.querySelector('.collapsed-bottom-panel');
            if (collapsedBottomPanel) {
              const rect = collapsedBottomPanel.getBoundingClientRect();
              if (rect.height > 0) {
                const bottomDistance = rect.height + 10;
                maxBottomHeight = Math.max(maxBottomHeight, bottomDistance);
                console.log(`发现收起的面板，高度: ${rect.height}px`);
              }
            }
            
            // 只有当位置真正需要改变时才更新
            const currentBottom = parseInt(simulationTimeline.style.bottom) || 60;
            if (Math.abs(currentBottom - maxBottomHeight) > 5) { // 5px的容差，避免微小变化
              simulationTimeline.style.bottom = maxBottomHeight + 'px';
              console.log(`时间轴位置已调整，底部距离: ${currentBottom}px -> ${maxBottomHeight}px`);
              
              // 通知其他组件同步位置变化
              window.dispatchEvent(new CustomEvent('ui-positions-changed', {
                detail: { 
                  bottomHeight: maxBottomHeight,
                  source: 'timeline'
                }
              }));
            } else {
              console.log(`位置差异不足5px，跳过调整: ${currentBottom}px vs ${maxBottomHeight}px`);
            }
          } catch (error) {
            console.error('时间轴位置调整错误:', error);
          } finally {
            // 确保标志被释放
            isAdjusting = false;
          }
        }
        
        // 防抖函数，避免频繁调用
        let adjustTimeout = null;
        function debouncedAdjustPosition() {
          if (adjustTimeout) {
            clearTimeout(adjustTimeout);
          }
          adjustTimeout = setTimeout(adjustTimelinePosition, 200);
        }
        
        // 初始调整位置
        adjustTimelinePosition();
        
        // 监听窗口大小变化
        window.addEventListener('resize', debouncedAdjustPosition);
        
        // 监听自定义面板状态变化事件，而不是使用MutationObserver
        window.addEventListener('panel-state-changed', (event) => {
          console.log('收到面板状态变化事件:', event.detail);
          debouncedAdjustPosition();
        });
        
        // 添加DOM变化监听器，监听底部面板的变化
        const observeBottomPanels = () => {
          const observer = new MutationObserver((mutations) => {
            let shouldAdjust = false;
            
            mutations.forEach((mutation) => {
              // 检查是否有面板相关的DOM变化
              if (mutation.type === 'attributes' && 
                  (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                const target = mutation.target;
                if (target.classList.contains('service-panel') || 
                    target.classList.contains('chart-panel') ||
                    target.classList.contains('data-panel') ||
                    target.classList.contains('collapsed-bottom-panel')) {
                  shouldAdjust = true;
                  console.log(`检测到面板DOM变化: ${target.className}`);
                }
              }
              
              // 检查是否有新的面板被添加或移除
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType === 1 && 
                      (node.classList?.contains('service-panel') ||
                       node.classList?.contains('chart-panel') ||
                       node.classList?.contains('data-panel'))) {
                    shouldAdjust = true;
                    console.log(`检测到新面板添加: ${node.className}`);
                  }
                });
              }
            });
            
            if (shouldAdjust) {
              debouncedAdjustPosition();
            }
          });
          
          // 观察整个文档的变化
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
          
          // 保存observer到清理函数中
          let timelineCleanupFunctions = [];
          
          timelineCleanupFunctions.push(() => observer.disconnect());
          
          console.log('已启动底部面板DOM变化监听器');
          
          // 定期检查位置（作为备用机制）
          const intervalCheck = setInterval(() => {
            if (!isAdjusting) {
              debouncedAdjustPosition();
            }
          }, 1000); // 每秒检查一次
          
          timelineCleanupFunctions.push(() => clearInterval(intervalCheck));
          
          // 统一保存清理函数
          window.cleanupTimelinePosition = function() {
            window.removeEventListener('resize', debouncedAdjustPosition);
            window.removeEventListener('panel-state-changed', debouncedAdjustPosition);
            if (adjustTimeout) {
              clearTimeout(adjustTimeout);
            }
            // 执行所有清理函数
            timelineCleanupFunctions.forEach(cleanup => cleanup());
            console.log('时间轴位置调整系统已清理');
          };
        };
        
        // 启动DOM监听
        observeBottomPanels();
        
        console.log('时间轴位置调整系统已初始化');
        
        // 仿真状态管理
        let currentFrame = 1;
        let maxRunFrame = 1; // 已经运行过的最大帧数
        
        // 动态获取总帧数
        function getTotalFrames() {
          const currentFolder = getCurrentDataFolder();
          const config = parseFolderName(currentFolder);
          return config.totalFrames; // 完全依赖配置解析，不使用硬编码回退
        }
        
        let totalFrames = getTotalFrames(); // 动态计算总帧数
        let isSimulationRunning = false;
        
        // 暴露更新totalFrames的全局函数
        window.updateTimelineTotalFrames = function(newTotalFrames) {
          if (newTotalFrames) {
            totalFrames = newTotalFrames;
          } else {
            totalFrames = getTotalFrames(); // 如果没有提供参数，重新计算
          }
          console.log(`时间轴总帧数已更新: ${totalFrames} (文件夹: ${getCurrentDataFolder()})`);
        };
        
        // 更新时间轴显示
        function updateTimelineDisplay(frame, maxFrame = null, skipNeedleUpdate = false) {
          if (maxFrame !== null) {
            maxRunFrame = Math.max(maxRunFrame, maxFrame);
          }
          
          // 确保帧数在有效范围内
          const clampedFrame = Math.max(1, Math.min(totalFrames, frame));
          const clampedMaxRunFrame = Math.max(1, Math.min(totalFrames, maxRunFrame));
          
          currentFrame = clampedFrame;
          
          // 计算百分比并确保在 0-100% 范围内
          const percentage = Math.max(0, Math.min(1, (clampedFrame - 1) / (totalFrames - 1)));
          const maxPercentage = Math.max(0, Math.min(1, (clampedMaxRunFrame - 1) / (totalFrames - 1)));
          
          // 更新指针位置 - 在仿真运行时避免任何过渡动画
          if (!isDragging && !skipNeedleUpdate) {
            needle.style.transition = isSimulationRunning ? 'none' : 'left 0.1s ease-out';
            needle.style.left = (percentage * 100) + '%';
          }
          
          // 更新已运行区域 - 在仿真运行时避免任何过渡动画
          runTrack.style.transition = isSimulationRunning ? 'none' : 'width 0.1s ease-out';
          runTrack.style.width = (maxPercentage * 100) + '%';
          
          // 更新时间显示 - 使用全局配置，避免重复解析
          const timeInterval = currentTimelineConfig.interval;
          const totalSeconds = frame * timeInterval; // 修改公式：帧1对应1个间隔
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          
          // 检查是否超过停止时间
          const stopTime = currentTimelineConfig.totalDuration;
          const shouldStop = totalSeconds >= stopTime;
          
          if (currentTimelineConfig.isDefault) {
            // 默认状态下显示虚线，表示未选择文件夹
            currentTimeDisplay.textContent = '--:--:--';
          } else {
            // 如果达到或超过停止时间，显示停止时间
            if (shouldStop) {
              const stopMinutes = Math.floor(stopTime / 60);
              const stopSeconds = stopTime % 60;
              currentTimeDisplay.textContent = `${Math.floor(stopMinutes/60).toString().padStart(2, '0')}:${(stopMinutes%60).toString().padStart(2, '0')}:${stopSeconds.toString().padStart(2, '0')}`;
            } else {
              currentTimeDisplay.textContent = `${Math.floor(minutes/60).toString().padStart(2, '0')}:${(minutes%60).toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
          }
        }
        
        // 拖拽和点击功能变量
        let isDragging = false;
        let dragStartX = 0;
        
        // 计算目标帧的通用函数
        function calculateTargetFrame(clientX) {
          const rect = backgroundTrack.getBoundingClientRect();
          const x = clientX - rect.left;
          const percentage = Math.max(0, Math.min(1, x / rect.width));
          return Math.round(percentage * (totalFrames - 1)) + 1;
        }
        
        // 跳转到指定帧的通用函数
        function jumpToFrame(targetFrame, isDragging = false) {
          // 允许跳转到任何有效的帧，不限制于已运行的帧
          if (targetFrame < 1 || targetFrame > totalFrames) {
            console.log(`无法跳转到帧${targetFrame}，有效范围是1-${totalFrames}`);
            return false;
          }
          
          // 检查是否有动画正在进行中，如果有则跳过这次跳转
          if (window.animationInProgress) {
            console.log(`动画进行中，跳过帧切换到${targetFrame}`);
            return false;
          }
          
          console.log(`跳转到帧: ${targetFrame}, 拖拽模式: ${isDragging}`);
          
          // 更新currentFrame状态
          currentFrame = targetFrame;
          
          // 如果跳转到的帧超过了之前的最大运行帧，更新maxRunFrame
          // 这样用户可以从跳转的位置开始播放
          if (targetFrame > maxRunFrame) {
            maxRunFrame = targetFrame;
            console.log(`更新最大运行帧到: ${maxRunFrame}`);
          }
          
          // 关键修复：同步更新动画系统的timeFrame状态
          // 通过全局事件通知动画系统更新当前帧
          const frameUpdateEvent = new CustomEvent('timeline-frame-update', {
            detail: { 
              targetFrame: targetFrame,
              source: 'timeline-jump',
              isDragging: isDragging
            }
          });
          window.dispatchEvent(frameUpdateEvent);
          console.log(`已通知动画系统更新到帧 ${targetFrame}`);
          
          // 只有在非拖拽状态下才触发数据加载事件
          if (!isDragging) {
            // 触发帧切换事件
            const frameChangeEvent = new CustomEvent('timeline-frame-change', {
              detail: { frame: targetFrame, forceUpdate: true }
            });
            window.dispatchEvent(frameChangeEvent);
          }
          
          // 更新时间轴显示
          const clampedTargetFrame = Math.max(1, Math.min(totalFrames, targetFrame));
          const clampedMaxRunFrame = Math.max(1, Math.min(totalFrames, maxRunFrame));
          
          const needlePosition = Math.max(0, Math.min(1, (clampedTargetFrame - 1) / (totalFrames - 1)));
          needle.style.left = (needlePosition * 100) + '%';
          
          // 更新已运行区域显示
          const maxPercentage = Math.max(0, Math.min(1, (clampedMaxRunFrame - 1) / (totalFrames - 1)));
          runTrack.style.width = (maxPercentage * 100) + '%';
          
          // 更新时间显示 - 使用全局配置，避免重复解析
          const timeInterval = currentTimelineConfig.interval;
          const totalSeconds = targetFrame * timeInterval; // 修改公式：帧1对应1个间隔
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          
          // 检查是否超过停止时间
          const stopTime = currentTimelineConfig.totalDuration;
          const shouldStop = totalSeconds >= stopTime;
          
          if (currentTimelineConfig.isDefault) {
            currentTimeDisplay.textContent = '--:--:--';
          } else {
            // 如果达到或超过停止时间，显示停止时间
            if (shouldStop) {
              const stopMinutes = Math.floor(stopTime / 60);
              const stopSeconds = stopTime % 60;
              currentTimeDisplay.textContent = `${Math.floor(stopMinutes/60).toString().padStart(2, '0')}:${(stopMinutes%60).toString().padStart(2, '0')}:${stopSeconds.toString().padStart(2, '0')}`;
            } else {
              currentTimeDisplay.textContent = `${Math.floor(minutes/60).toString().padStart(2, '0')}:${(minutes%60).toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
          }
          
          return true;
        }
        
        // 鼠标按下事件（开始拖拽）
        backgroundTrack.addEventListener('mousedown', function(e) {
          isDragging = true;
          dragStartX = e.clientX;
          backgroundTrack.style.cursor = 'grabbing';
          
          // 立即跳转到点击位置，但不触发数据加载（拖拽开始）
          const targetFrame = calculateTargetFrame(e.clientX);
          jumpToFrame(targetFrame, true);
          
          e.preventDefault();
        });
        
        // 拖拽防抖相关变量
        let dragDebounceTimer = null;
        let lastDragFrame = null;
        
        // 鼠标移动事件（拖拽中）
        document.addEventListener('mousemove', function(e) {
          if (!isDragging) return;
          
          const targetFrame = calculateTargetFrame(e.clientX);
          
          // 确保目标帧在有效范围内
          const clampedTargetFrame = Math.max(1, Math.min(totalFrames, targetFrame));
          
          // 基于有效的目标帧计算正确的百分比位置
          const validPercentage = (clampedTargetFrame - 1) / (totalFrames - 1);
          
          // 只在有效范围内移动滑块
          if (clampedTargetFrame >= 1 && clampedTargetFrame <= totalFrames) {
            needle.style.left = (validPercentage * 100) + '%';
            
            // 更新时间显示但不立即触发帧切换 - 使用全局配置，避免重复解析
            const timeInterval = currentTimelineConfig.interval;
            const totalSeconds = clampedTargetFrame * timeInterval; // 修改公式：帧1对应1个间隔
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            
            // 检查是否超过停止时间
            const stopTime = currentTimelineConfig.totalDuration;
            const shouldStop = totalSeconds >= stopTime;
            
            // 使用已有的currentTimeDisplay元素
            if (currentTimeDisplay) {
              if (currentTimelineConfig.isDefault) {
                currentTimeDisplay.textContent = '--:--:--';
              } else {
                // 如果达到或超过停止时间，显示停止时间
                if (shouldStop) {
                  const stopMinutes = Math.floor(stopTime / 60);
                  const stopSeconds = stopTime % 60;
                  currentTimeDisplay.textContent = `${Math.floor(stopMinutes/60).toString().padStart(2, '0')}:${(stopMinutes%60).toString().padStart(2, '0')}:${stopSeconds.toString().padStart(2, '0')}`;
                } else {
                  currentTimeDisplay.textContent = `${Math.floor(minutes/60).toString().padStart(2, '0')}:${(minutes%60).toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
              }
            }
            
            // 防抖处理：拖拽过程中允许一些实时反馈，但限制频率
            lastDragFrame = clampedTargetFrame;
            if (dragDebounceTimer) {
              clearTimeout(dragDebounceTimer);
            }
            
            // 减少防抖时间，提供更好的响应性，但检查动画状态
            dragDebounceTimer = setTimeout(() => {
              if (lastDragFrame !== null && !window.animationInProgress) {
                jumpToFrame(lastDragFrame, true); // 拖拽期间不触发数据加载
                lastDragFrame = null;
              } else if (window.animationInProgress) {
                // 如果动画还在进行，延迟重试
                setTimeout(() => {
                  if (lastDragFrame !== null && !window.animationInProgress) {
                    jumpToFrame(lastDragFrame, true); // 拖拽期间不触发数据加载
                    lastDragFrame = null;
                  }
                }, 100);
              }
            }, 50);
          }
          
          e.preventDefault();
        });
        
        // 鼠标释放事件（结束拖拽）
        document.addEventListener('mouseup', function(e) {
          if (isDragging) {
            isDragging = false;
            backgroundTrack.style.cursor = 'pointer';
            
            // 拖拽结束时立即触发帧切换，清除防抖定时器
            if (dragDebounceTimer) {
              clearTimeout(dragDebounceTimer);
              dragDebounceTimer = null;
            }
            
            if (lastDragFrame !== null && !window.animationInProgress) {
              jumpToFrame(lastDragFrame, false); // 拖拽结束时触发数据加载
              lastDragFrame = null;
            } else if (window.animationInProgress) {
              // 如果动画还在进行，等待动画完成后再切换
              console.log('动画进行中，等待完成后切换帧');
              const waitForAnimation = () => {
                if (!window.animationInProgress && lastDragFrame !== null) {
                  jumpToFrame(lastDragFrame, false); // 拖拽结束时触发数据加载
                  lastDragFrame = null;
                } else if (window.animationInProgress) {
                  setTimeout(waitForAnimation, 50);
                }
              };
              setTimeout(waitForAnimation, 50);
            }
          }
        });
        
        // 鼠标悬停效果
        backgroundTrack.addEventListener('mouseenter', function() {
          backgroundTrack.style.cursor = 'pointer';
        });
        
        backgroundTrack.addEventListener('mouseleave', function() {
          backgroundTrack.style.cursor = 'default';
        });
        
        // 也为runTrack（绿色区域）添加同样的交互
        runTrack.addEventListener('mousedown', function(e) {
          isDragging = true;
          dragStartX = e.clientX;
          runTrack.style.cursor = 'grabbing';
          
          // 立即跳转到点击位置
          const targetFrame = calculateTargetFrame(e.clientX);
          jumpToFrame(targetFrame);
          
          e.preventDefault();
        });
        
        runTrack.addEventListener('mouseenter', function() {
          runTrack.style.cursor = 'pointer';
        });
        
        runTrack.addEventListener('mouseleave', function() {
          runTrack.style.cursor = 'default';
        });
        
        // 为滑块添加专门的拖拽功能
        needle.addEventListener('mousedown', function(e) {
          isDragging = true;
          dragStartX = e.clientX;
          needle.style.cursor = 'grabbing';
          needle.style.transform = 'translateX(-50%) scale(1.1)'; // 拖拽时稍微放大
          
          e.preventDefault();
          e.stopPropagation(); // 防止触发背景轨道的事件
        });
        
        // 滑块悬停效果
        needle.addEventListener('mouseenter', function() {
          if (!isDragging) {
            needle.style.transform = 'translateX(-50%) scale(1.05)';
            needle.style.boxShadow = '0 3px 12px rgba(255, 0, 0, 0.6)';
          }
        });
        
        needle.addEventListener('mouseleave', function() {
          if (!isDragging) {
            needle.style.transform = 'translateX(-50%) scale(1)';
            needle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
          }
        });
        
        // 更新鼠标释放事件，处理滑块的样式重置
        document.addEventListener('mouseup', function(e) {
          if (isDragging) {
            isDragging = false;
            backgroundTrack.style.cursor = 'pointer';
            runTrack.style.cursor = 'pointer';
            needle.style.cursor = 'grab';
            needle.style.transform = 'translateX(-50%) scale(1)';
            needle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
          }
        });
        
        // 暴露控制接口
        window.simulationTimelineControl = {
          updateFrame: updateTimelineDisplay,
          setTotalFrames: function(frames) {
            totalFrames = frames;
            console.log(`时间轴总帧数设置为: ${frames}`);
          },
          setSimulationRunning: function(running) {
            isSimulationRunning = running;
            
            // 运行状态变化时，重置过渡效果
            if (running) {
              // 进入运行状态：禁用所有过渡动画
              needle.style.transition = 'none';
              runTrack.style.transition = 'none';
              simulationTimeline.style.boxShadow = '0 0 8px rgba(0, 255, 0, 0.3)';
              console.log('仿真开始，禁用时间轴位置调整');
            } else {
              // 退出运行状态：恢复过渡动画
              needle.style.transition = 'left 0.1s ease-out';
              runTrack.style.transition = 'width 0.1s ease-out';
              simulationTimeline.style.boxShadow = 'none';
              console.log('仿真停止，重新启用时间轴位置调整');
              
              // 仿真停止后重新调整位置，确保时间轴在正确位置
              setTimeout(() => {
                adjustTimelinePosition();
              }, 100);
            }
            
            // 保持完全可操作
            simulationTimeline.style.opacity = '1';
            
            console.log(`仿真运行状态: ${running ? '运行中（流畅模式）' : '已停止（过渡模式）'}`);
          },
          getCurrentFrame: function() {
            return currentFrame;
          },
          getMaxRunFrame: function() {
            return maxRunFrame;
          },
          reset: function() {
            currentFrame = 1;
            maxRunFrame = 1;
            updateTimelineDisplay(1, 1);
            console.log('时间轴已重置');
          }
        };
        
        console.log('仿真时间轴创建完成，可通过 window.simulationTimelineControl 控制');
      return simulationTimeline;
    };
    
    // 创建自定义时间轴
    window.createSimulationTimeline();
    
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
    
    console.log('Cesium viewer初始化完成，仅使用本地地图资源');
    
    // 添加场景模式变化监听，处理2D模式的实体位置问题
    setupSceneModeHandling(viewer);
    
    // 延迟加载国界线数据，确保地球纹理先加载完成
    setTimeout(() => {
      loadLocalCountryBorders();
    }, 2000);
    
    // 将光照控制方法挂载到window对象，便于其他组件访问 10.27新增
    window.toggleLighting = function(enabled) {
      if (viewer && viewer.scene && viewer.scene.globe) {
        viewer.scene.globe.enableLighting = enabled;
        lightingEnabled.value = enabled;
        console.log(`光照效果已${enabled ? '开启' : '关闭'}`);
      }
    }; //新增结束
    
    // 将地球纹理切换方法挂载到window对象，便于其他组件访问 新增
    window.toggleEarthTexture = function(texturePath) {
      if (viewer && viewer.imageryLayers) {
        try {
          // 移除所有现有图层
          viewer.imageryLayers.removeAll();
          
          // 创建新的地球纹理提供者
          const earthImageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: window.location.origin + texturePath,
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            tilingScheme: new Cesium.GeographicTilingScheme({
              numberOfLevelZeroTilesX: 1,
              numberOfLevelZeroTilesY: 1
            }),
            maximumLevel: 0,
            credit: 'Natural Earth'
          });
          
          // 添加新图层
          viewer.imageryLayers.addImageryProvider(earthImageryProvider);
          
          console.log(`地球纹理已切换为: ${texturePath}`);
          
          // 强制刷新场景
          viewer.scene.requestRender();
        } catch (error) {
          console.error('切换地球纹理失败:', error);
        }
      }
    }; //新增结束
    
    return viewer;
  }

  // 简单地球纹理测试
  function testSimpleEarthTexture() {
    if (!viewer) return;
    
    console.log('🌍 开始简单地球纹理测试...');
    
    // 尝试最直接的方法
    const img = new Image();
    img.onload = function() {
      console.log('图片可以直接访问，尺寸:', img.width, 'x', img.height);
      
      // 创建canvas
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 转换为data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      try {
        // 移除现有图层
        viewer.imageryLayers.removeAll();
        
        // 使用data URL创建纹理
        const provider = new Cesium.SingleTileImageryProvider({
          url: dataUrl,
          rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0)
        });
        
        viewer.imageryLayers.addImageryProvider(provider);
        
        console.log('🎉 地球纹理通过canvas加载成功！');
        viewer.scene.requestRender();
        
      } catch (error) {
        console.error('Canvas纹理创建失败:', error);
        useBackupEarthRendering();
      }
    };
    
    img.onerror = function() {
      console.error('无法访问地球纹理图片');
      useBackupEarthRendering();
    };
    
    // 尝试加载图片
    img.crossOrigin = 'anonymous';
    img.src = './texture/earth.jpg';
  }
  
  // 备用地球渲染方案
  function useBackupEarthRendering() {
    if (!viewer) return;
    
    console.log('应用备用地球渲染方案...');
    
    // 移除所有图层
    viewer.imageryLayers.removeAll();
    
    // 设置更逼真的地球颜色
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#4a5d23'); // 地球绿褐色
    
    // 启用地形和大气效果以增强视觉
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.0;
    viewer.scene.globe.atmosphereBrightnessShift = 0.2;
    
    viewer.scene.requestRender();
  }

  // 测试并加载地球纹理
  async function testAndLoadEarthTexture() {
    if (!viewer) return;
    
    console.log('🌍 开始测试地球纹理加载...');
    
    // 尝试最简单直接的方法：创建canvas纹理
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const imageLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          console.log(`图片加载成功 (尺寸: ${img.width}x${img.height})`);
          resolve(img);
        };
        img.onerror = (error) => {
          console.log(`图片加载失败:`, error);
          reject(error);
        };
      });
      
      // 尝试多个可能的路径
      const texturePaths = [
        './texture/earth.jpg',
        '/texture/earth.jpg', 
        'texture/earth.jpg',
        window.location.origin + '/texture/earth.jpg'
      ];
      
      let loadedImage = null;
      let successPath = null;
      
      for (const path of texturePaths) {
        try {
          console.log(`尝试路径: ${path}`);
          img.src = path;
          loadedImage = await imageLoadPromise;
          successPath = path;
          break;
        } catch (error) {
          console.log(`路径 ${path} 失败`);
          continue;
        }
      }
      
      if (!loadedImage) {
        throw new Error('所有路径都无法加载图片');
      }
      
      // 创建canvas并绘制图片
      const canvas = document.createElement('canvas');
      canvas.width = 1024;  // 降低分辨率以提高性能
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      // 绘制地球图片到canvas
      ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
      
      // 将canvas转换为data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // 移除现有图层
      viewer.imageryLayers.removeAll();
      
      // 使用data URL创建Single Tile Imagery Provider
      const earthImageryProvider = new Cesium.SingleTileImageryProvider({
        url: dataUrl,
        rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
        credit: 'Natural Earth'
      });
      
      const layer = viewer.imageryLayers.addImageryProvider(earthImageryProvider);
      
      console.log(`🎉 地球纹理加载成功! 使用路径: ${successPath}`);
      console.log(`Canvas纹理尺寸: ${canvas.width}x${canvas.height}`);
      
      // 强制刷新场景
      viewer.scene.requestRender();
      
      return; // 成功加载，退出
      
    } catch (error) {
      console.error('Canvas纹理方法失败:', error);
    }
    
    // 如果canvas方法失败，尝试原来的方法
    await tryOriginalTextureMethod();
  }
  
  // 原始纹理加载方法
  async function tryOriginalTextureMethod() {
    console.log('尝试原始纹理加载方法...');
    
    // 可能的纹理路径
    const texturePaths = [
      './texture/earth.jpg',
      '/texture/earth.jpg', 
      'texture/earth.jpg'
    ];
    
    for (const path of texturePaths) {
      try {
        console.log(`尝试加载纹理路径: ${path}`);
        
        // 移除现有图层
        viewer.imageryLayers.removeAll();
        
        let earthImageryProvider;
        
        try {
          // 方法1: 使用TileMapServiceImageryProvider（更适合单张图片）
          earthImageryProvider = new Cesium.TileMapServiceImageryProvider({
            url: path,
            maximumLevel: 0, // 只使用最低级别（单张图片）
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            credit: 'Natural Earth - Local'
          });
        } catch (tmsError) {
          console.log('TileMapService方法失败，尝试UrlTemplateImageryProvider:', tmsError);
          
          // 方法2: 使用UrlTemplateImageryProvider
          earthImageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: path,
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            credit: 'Natural Earth - Local',
            maximumLevel: 0
          });
        }
        
        const layer = viewer.imageryLayers.addImageryProvider(earthImageryProvider);
        
        // 等待图层准备就绪
        await layer.readyPromise;
        
        console.log(`🎉 地球纹理加载成功! 使用路径: ${path}`);
        
        // 强制刷新场景
        viewer.scene.requestRender();
        
        return; // 成功加载，退出循环
        
      } catch (error) {
        console.log(`纹理路径 ${path} 加载失败:`, error);
        continue; // 尝试下一个路径
      }
    }
    
    // 如果所有路径都失败，使用备用方案
    console.warn('所有纹理路径都失败，使用备用地球渲染方案');
    useBackupEarthRendering();
  }
  
  // 备用地球渲染方案
  function useBackupEarthRendering() {
    if (!viewer) return;
    
    console.log('应用备用地球渲染方案...');
    
    // 移除所有图层
    viewer.imageryLayers.removeAll();
    
    // 设置更逼真的地球颜色
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#4a5d23'); // 地球绿褐色
    
    // 启用地形和大气效果以增强视觉
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.0;
    viewer.scene.globe.atmosphereBrightnessShift = 0.2;
    
    // 添加简单的程序化地球材质
    try {
      const earthMaterial = new Cesium.Material({
        fabric: {
          type: 'Color',
          uniforms: {
            color: new Cesium.Color(0.3, 0.4, 0.15, 1.0) // 深绿褐色
          }
        }
      });
      
      viewer.scene.globe.material = earthMaterial;
      console.log('备用地球材质应用成功');
      
    } catch (error) {
      console.warn('备用材质创建失败:', error);
    }
    
    viewer.scene.requestRender();
  }

  // 加载本地矢量国界线数据，9月28日修改了边界线表现形式，由青色改为白与黑色
  async function loadLocalCountryBorders() {
    if (!viewer) return;
    
    try {
      console.log('开始加载本地国界线数据...');
      
      // 加载本地GeoJSON文件
      const dataSource = await Cesium.GeoJsonDataSource.load('/maps/countries.geo.json', {
        strokeColor: Cesium.Color.DARKSLATEGRAY.withAlpha(1.0),  // 亮黑色
        strokeWidth: 15,  // 调细线宽
        fillColor: Cesium.Color.TRANSPARENT,
        clampToGround: true  // 贴地显示
      });
      
      // 添加到viewer
      await viewer.dataSources.add(dataSource);
      
      // 设置显示样式  
      const entities = dataSource.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.polygon) {
          entity.polygon.material = Cesium.Color.TRANSPARENT;
          entity.polygon.outline = true;
          entity.polygon.outlineColor = Cesium.Color.DIMGRAY.withAlpha(1.0); // 亮黑色
          entity.polygon.outlineWidth = 15;
          entity.polygon.height = 0;  // 贴地显示
          entity.polygon.extrudedHeight = 0;
        }
        if (entity.polyline) {
          entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
            glowPower: 3,  // 荧光强度
            taperPower: 0.8, // 渐变效果
            color: Cesium.Color.DIMGRAY  // 亮黑色作为主色
          });
          entity.polyline.width = 5;  // 稍微加宽以突出荧光效果
          entity.polyline.clampToGround = true;
        }
      }
      // 9月28日国界线修改到此结束👆

      console.log(`本地国界线数据加载成功，共加载 ${entities.length} 个国家/地区边界`);
      
      // 强制刷新场景以确保国界线显示
      viewer.scene.requestRender();
      
      // 输出第一个实体的详细信息用于调试
      if (entities.length > 0) {
        console.log('第一个国界线实体:', entities[0]);
        console.log('实体显示状态:', entities[0].show);
      }
      
    } catch (error) {
      console.warn('加载本地国界线数据失败:', error);
    }
  }

  // 调试时间轴元素的函数
  function debugTimelineElements() {
    // 调试函数已禁用以减少控制台输出
    return;
  }

  // 隐藏原生时间轴控件的函数（重命名自forceShowTimelineControls）
  function forceShowTimelineControls() {
    if (!viewer) return;
    
    // console.log('隐藏原生时间轴控件...');
    
    // 隐藏原生时间轴控件
    if (viewer.timeline) {
      viewer.timeline.container.style.display = 'none';
      viewer.timeline.container.style.visibility = 'hidden';
      viewer.timeline.container.style.visibility = 'visible';
    }
    
    // 隐藏原生时间轴元素，我们使用自定义时间轴
    const timelineSelectors = [
      '.cesium-timeline-main',
      '.cesium-timeline-container',
      '.cesium-timeline-track'
    ];
    
    timelineSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.display = 'none !important';
        element.style.visibility = 'hidden !important';
        element.style.opacity = '0 !important';
        // console.log(`隐藏原生时间轴元素 ${selector}`);
      });
    });
    
    // 原生时间轴已隐藏，不需要设置位置样式
  }

  // 设置时间轴样式的独立函数
  function setupTimelineStyles() {
    if (!viewer) return;
    
    console.log('正在设置时间轴样式...');
    
    // 隐藏原生时间轴容器，我们使用自定义时间轴
    const timelineContainer = viewer.timeline?.container;
    if (timelineContainer) {
      timelineContainer.style.display = 'none';
      timelineContainer.style.visibility = 'hidden';
      console.log('原生时间轴容器已隐藏');
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
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        console.log('通过DOM隐藏了原生时间轴');
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
  function setTimelinePosition(bottomOffset = 10) {
    if (!viewer) return;
    
    // console.log(`设置时间轴位置，底部偏移: ${bottomOffset}px`);
    
    // 调整自定义时间轴位置
    const simulationTimeline = document.querySelector('.simulation-timeline');
    if (simulationTimeline) {
      simulationTimeline.style.bottom = `${bottomOffset}px`;
      // console.log('自定义时间轴位置已设置到:', bottomOffset);
    }
    
    // 原生时间轴容器已隐藏，不需要调整位置
    
    // 原生动画控件也隐藏
    const animationContainer = viewer.animation?.container;
    if (animationContainer) {
      animationContainer.style.display = 'none';
      animationContainer.style.visibility = 'hidden';
    }
    
    // 通过DOM查找并隐藏原生时间轴元素（与我们的目标一致）
    const timelineElements = document.querySelectorAll('.cesium-timeline-main');
    timelineElements.forEach(element => {
      element.style.display = 'none'; // 隐藏而不是显示
      element.style.visibility = 'hidden';
    });
    
    const animationElements = document.querySelectorAll('.cesium-animation-container, .cesium-animation-widget');
    animationElements.forEach(element => {
      element.style.display = 'none'; // 隐藏而不是显示
      element.style.visibility = 'hidden';
    });
    
    // console.log(`时间轴位置已调整到底部 ${bottomOffset}px，并确保可见性`);
  }

  function setupTimelineControl(onTimeChange) {
    if (!viewer) return;
    
    let lastFrame = 1; // 记录上一次的帧数，避免重复触发
    let isInitialized = false; // 防止初始化时的误触发
    let isManualDrag = false; // 标记是否正在手动拖拽
    let ignoreNextChange = false; // 标记是否忽略下次变化（用于程序化设置时间）
    
    // 延迟启用监听器，避免初始化时的自动触发
    setTimeout(() => {
      isInitialized = true;
      console.log('时间轴控制已初始化，使用事件驱动模式');
    }, 2000);
    
    // 简化时间轴监听逻辑 - 支持任何状态下的拖拽
    let lastProcessedTime = null;
    
    // 监听时钟变化，响应用户拖拽
    viewer.clock.onTick.addEventListener(function(clock) {
      // 只有在初始化完成时才响应
      if (!isInitialized) return;
      
      if (!onTimeChange) {
        console.warn('时间轴监听器：onTimeChange回调未设置');
        return;
      }
      
      const currentTime = Cesium.JulianDate.clone(clock.currentTime);
      
      // 计算当前帧数
      const elapsed = Cesium.JulianDate.secondsDifference(currentTime, clock.startTime);
      const timeInterval = currentTimelineConfig.interval;
      const maxFrames = Math.ceil(currentTimelineConfig.totalDuration / currentTimelineConfig.interval);
      
      const frameIndex = Math.floor(elapsed / timeInterval) + 1;
      const clampedFrame = Math.max(1, Math.min(maxFrames, frameIndex));
      
      // 只有当帧数真正改变时才触发
      if (clampedFrame !== lastFrame) {
        lastFrame = clampedFrame;
        lastProcessedTime = Cesium.JulianDate.clone(currentTime);
        
        // console.log(`🎯 时间轴变化到帧: ${clampedFrame} (播放状态: ${clock.shouldAnimate}, 经过时间: ${elapsed.toFixed(1)}s)`);
        onTimeChange(clampedFrame);
      }
    });
    
    // 提供强制设置帧数的接口，支持向前向后跳转
    viewer.forceSetFrame = function(frame) {
      const timeInterval = currentTimelineConfig.interval;
      const maxFrames = Math.ceil(currentTimelineConfig.totalDuration / currentTimelineConfig.interval);
      
      const clampedFrame = Math.max(1, Math.min(maxFrames, frame));
      
      const targetTime = Cesium.JulianDate.addSeconds(
        viewer.clock.startTime, 
        clampedFrame * timeInterval, 
        new Cesium.JulianDate()
      );
      
      // 直接设置时钟时间，不做额外限制
      viewer.clock.currentTime = targetTime;
      lastFrame = clampedFrame;
      
      console.log(`强制设置到帧: ${clampedFrame} (${currentFolder}文件夹)`);
      
      // 立即触发数据加载
      if (onTimeChange) {
        onTimeChange(clampedFrame);
      }
    };
    
    console.log('时间轴控制设置完成，支持强制帧设置接口');
  }

  // 设置时间轴样式的函数
  function setupTimelineStyles() {
    if (!viewer) return;
    
    // 确保时间轴和动画控件可见并设置样式
    setTimeout(() => {
      const timelineContainer = viewer.timeline?.container;
      if (timelineContainer) {
        timelineContainer.style.display = 'none';
        timelineContainer.style.visibility = 'hidden';
        console.log('原生时间轴容器已隐藏（延迟设置）');
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
    
    // 根据当前文件夹动态计算时间间隔 - 使用全局配置
    const timeInterval = currentTimelineConfig.interval;
    
    const frameSeconds = frame * timeInterval; // 修改公式：帧1对应1个间隔
    const targetTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, frameSeconds, new Cesium.JulianDate());
    
    // 确保目标时间在有效范围内
    if (Cesium.JulianDate.compare(targetTime, viewer.clock.stopTime) <= 0) {
      // 暂停动画，防止自动播放导致的时间跳跃
      const wasAnimating = viewer.clock.shouldAnimate;
      viewer.clock.shouldAnimate = false;
      
      // 设置目标时间
      viewer.clock.currentTime = targetTime;
      
      // 如果之前在播放，恢复播放状态
      if (wasAnimating) {
        setTimeout(() => {
          viewer.clock.shouldAnimate = true;
        }, 100); // 短暂延迟后恢复播放
      }
      
      console.log(`手动跳转到帧 ${frame} (时间: ${frameSeconds}s, 间隔: ${timeInterval}s)`);
    } else {
      console.warn(`跳转帧 ${frame} 超出范围，最大帧数: ${Math.floor(Cesium.JulianDate.secondsDifference(viewer.clock.stopTime, viewer.clock.startTime) / timeInterval) + 1}`);
    }
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
      viewer.clock.canAnimate = true; // 确保可以动画
      console.log(`时间轴动画启用，当前帧时间: ${Cesium.JulianDate.toIso8601(viewer.clock.currentTime)}`);
    } else {
      // 暂停时的强制停止措施
      const currentTime = Cesium.JulianDate.clone(viewer.clock.currentTime);
      
      viewer.clock.shouldAnimate = false;
      viewer.clock.multiplier = 0; // 设置倍率为0，完全停止时间推进
      viewer.clock.canAnimate = false; // 禁止动画
      
      // 强制固定当前时间，防止任何形式的时间推进
      setTimeout(() => {
        viewer.clock.currentTime = currentTime;
        viewer.clock.shouldAnimate = false;
        viewer.clock.multiplier = 0;
      }, 50);
      
      console.log(`时间轴动画暂停，时间已完全冻结，当前帧时间: ${Cesium.JulianDate.toIso8601(currentTime)}`);
    }
    
    // 强制更新时间轴显示
    setTimeout(() => {
      if (viewer.timeline) {
        viewer.timeline.updateFromClock();
      }
    }, 50);
  }

  function createEntities(frameData) {
    console.log('createEntities 开始创建实体，数据:', frameData);
    
    if (!frameData?.nodes?.length) {
      console.error('没有有效的节点数据');
      return;
    }
    
    console.log(`节点数据数量: ${frameData.nodes.length}`);
    
    // 确保viewer可用
    if (!viewer) {
      console.error('Cesium viewer 未初始化');
      return;
    }
    
    console.log('Cesium viewer可用，开始创建节点实体...');
    
    let createdCount = 0;
    frameData.nodes.forEach((node, index) => {
      if (viewer.entities.getById(node.id)) {
        console.log(`节点 ${node.id} 已存在，跳过`);
        return;
      }
      
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
          console.log(`未知节点类型: ${node.type} (节点ID: ${node.id})`);
          return;
      }
      
      try {
        const entity = viewer.entities.add(entityConfig);
        // 在实体上保存原始类型信息，便于后续识别
        entity.nodeType = node.type;
        
        // 确保原始坐标信息被正确保存到实体上
        if (entityConfig.originalLatLon) {
          entity.originalLatLon = entityConfig.originalLatLon;
        }
        if (entityConfig.originalCartesian) {
          entity.originalCartesian = entityConfig.originalCartesian;
        }
        
        createdCount++;
        if (index < 5) { // 只打印前5个实体的详细信息
          console.log(`创建节点 ${node.id} (${node.type}) 成功:`, entity);
        }
      } catch (error) {
        console.error(`创建节点 ${node.id} 失败:`, error);
      }
    });
    
    console.log(`当前场景中实体总数: ${viewer.entities.values.length}`);
  }
  
  // 9月28日新增代码片段，地面链路显示
  // 主要功能是在预览模式中，用绿线和黄线连接地面链路，做出预览效果。

  function clearGroundLinks() {
    if (!viewer) return;
    
    // 优化：直接使用removeById，避免遍历所有实体
    const entitiesToRemove = viewer.entities.values.filter(entity => 
      entity.entityType === 'ground-link' || 
      entity.id?.includes('roadm-roadm-link') || 
      entity.id?.includes('station-roadm-link') ||
      entity.id?.includes('other-ground-link')
    );
    
    // 暂停场景更新以提高批量删除性能
    viewer.scene.requestRenderMode = true;
    
    entitiesToRemove.forEach(entity => {
      viewer.entities.remove(entity);
    });
    
    // 恢复场景更新
    viewer.scene.requestRenderMode = false;
    viewer.scene.requestRender();
  }


  function addRoadmLinks(frameData) {
    if (!frameData?.edges || !viewer) {
      return;
    }
    
    // 暂时禁用场景更新以提高性能
    viewer.scene.requestRenderMode = true;
    viewer.scene.maximumRenderTimeChange = Infinity;
    
    // 创建节点索引以提高查找性能
    const nodeMap = new Map();
    frameData.nodes.forEach(node => {
      nodeMap.set(node.id, node);
    });
    
    // 过滤出地面链路（非卫星间链路）
    const groundEdges = frameData.edges.filter(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      
      return sourceNode && targetNode && 
             sourceNode.type !== 'satellite' && 
             targetNode.type !== 'satellite';
    });

    groundEdges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      
      if (!sourceNode || !targetNode) return;
      
      try {
        const sourcePosition = getEntityPosition(sourceNode, viewer);
        const targetPosition = getEntityPosition(targetNode, viewer);
        
        if (!sourcePosition || !targetPosition) return;
        
        let linkConfig;
        
        // 简洁的连线类型配置，可以调整预览效果，选择连线材质
        let linkColor, linkId, description;
        
        if (sourceNode.type === 'roadm' && targetNode.type === 'roadm') {
          // ROADM-ROADM 连线：偏深的绿色
          linkColor = Cesium.Color.fromCssColorString('#228B22').withAlpha(0.8);
          linkId = `roadm-roadm-link-${edge.source}-${edge.target}`;
          description = 'ROADM骨干连接';
        } else if ((sourceNode.type === 'station' && targetNode.type === 'roadm') ||
                   (sourceNode.type === 'roadm' && targetNode.type === 'station')) {
          // 地面站-ROADM 连线：偏深的黄色
          linkColor = Cesium.Color.fromCssColorString('#DAA520').withAlpha(0.8);
          linkId = `station-roadm-link-${edge.source}-${edge.target}`;
          description = '地面接入连接';
        } else {
          // 其他类型连线：蓝色
          linkColor = Cesium.Color.fromCssColorString('#1E90FF').withAlpha(0.8);
          linkId = `other-ground-link-${edge.source}-${edge.target}`;
          description = '地面连接';
        }
        
        // 检查链路是否已存在
        if (viewer.entities.getById(linkId)) {
          return;
        }
        
        // 检查显示开关状态
        const shouldShow = showLinks.value && (
          ((sourceNode.type === 'station' || targetNode.type === 'station') && showStation.value) ||
          ((sourceNode.type === 'roadm' || targetNode.type === 'roadm') && showRoadm.value)
        );

        // 纯色材质
        const simpleMaterial = new Cesium.ColorMaterialProperty(linkColor);

        const linkEntity = viewer.entities.add({
          id: linkId,
          name: `地面链路: ${edge.source} → ${edge.target}`,
          show: shouldShow,
          polyline: {
            positions: [sourcePosition, targetPosition],
            width: new Cesium.CallbackProperty(() => {
              // 简单的LOD：根据相机高度调整线宽（更细的线条）
              const height = viewer.camera.positionCartographic.height;
              if (height > 10000000) return 0.8;
              if (height > 5000000) return 1.2;
              if (height > 1000000) return 1.6;
              return 2.0;
            }, false),
            material: simpleMaterial,
            arcType: Cesium.ArcType.NONE,
            clampToGround: false,
            depthFailMaterial: linkColor.withAlpha(0.3)
          },
        });
        
        // 标记实体类型，便于后续识别
        linkEntity.entityType = 'ground-link';
        linkEntity.linkType = edge.type;
        
      } catch (error) {
        console.warn(`创建地面链路失败: ${edge.source} -> ${edge.target}`, error);
      }
    });
    
    // 恢复场景更新
    viewer.scene.requestRenderMode = false;
    viewer.scene.maximumRenderTimeChange = 0.0;
    viewer.scene.requestRender();
  }  
  
  // 地面链路交互效果管理
  let selectedLinkEntity = null;
  let hoveredLinkEntity = null;

  // 9月28日新增/修改地面链路显示模块代码片段到这里结束

  // 修改 setupClickHandler 函数，添加鼠标悬停事件处理
  function setupClickHandler(onEntityClick) {
    if (!viewer || handler) return;
    
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // 添加悬停实体变量
    let hoveredEntity = null;
    
    // 鼠标移动事件 - 处理悬停效果
    handler.setInputAction(function(movement) {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      
      // 清除之前的悬停状态
      if (hoveredEntity) {
        // 恢复之前悬停实体的原始样式
        if (hoveredEntity.point) {
          hoveredEntity.point.color = hoveredEntity._originalColor || Cesium.Color.WHITE;
          hoveredEntity.point.pixelSize = hoveredEntity._originalPixelSize || 5;
          hoveredEntity.point.outline = hoveredEntity._originalOutline || false;
          hoveredEntity.point.outlineColor = hoveredEntity._originalOutlineColor || Cesium.Color.BLACK;
          hoveredEntity.point.outlineWidth = hoveredEntity._originalOutlineWidth || 1;
        }
        hoveredEntity = null;
      }
      
      // 检查当前悬停的实体
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
        const entity = pickedObject.id;
        
        // 只处理卫星实体，忽略链路和其他实体
        if (entity.id && entity.id.startsWith('satellite')) {
          hoveredEntity = entity;
          
          // 保存原始样式
          if (entity.point) {
            entity._originalColor = entity.point.color ? entity.point.color.getValue() : Cesium.Color.WHITE;
            entity._originalPixelSize = entity.point.pixelSize ? entity.point.pixelSize.getValue() : 5;
            entity._originalOutline = entity.point.outline ? entity.point.outline.getValue() : false;
            entity._originalOutlineColor = entity.point.outlineColor ? entity.point.outlineColor.getValue() : Cesium.Color.BLACK;
            entity._originalOutlineWidth = entity.point.outlineWidth ? entity.point.outlineWidth.getValue() : 1;
            
            // 设置悬停效果 - 绿色圆圈
            entity.point.color = Cesium.Color.LIME;
            entity.point.pixelSize = 8; // 调小尺寸以显示圆圈效果
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    // 鼠标点击事件 - 保持原有逻辑
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
    
    let entityCount = { satellite: 0, station: 0, roadm: 0, links: 0, other: 0 };
    
    viewer.entities.values.forEach(entity => {
      if (!entity.id) return;
      const entityId = entity.id.toString();
      
      // 优先使用保存的节点类型信息
      if (entity.nodeType) {
        switch (entity.nodeType) {
          case 'satellite':
            entity.show = showSatellite.value;
            entityCount.satellite++;
            break;
          case 'station':
            entity.show = showStation.value;
            entityCount.station++;
            break;
          case 'roadm':
            entity.show = showRoadm.value;
            entityCount.roadm++;
            break;
        }
        return;
      }
      
      // 回退到原来的识别逻辑（用于链路等其他实体）
      const isSatellite = entityId.startsWith('satellite');
      const isRoadm = entityId.startsWith('ROADM');
      const isStation = !isSatellite && !isRoadm && entity.point && !entityId.includes('-');
      
      const isRoadmRoadmLink = entityId.includes('roadm-roadm-link');
      const isStationRoadmLink = entityId.includes('station-roadm-link');
      const isSatelliteLink = entity.polyline && !isRoadmRoadmLink && !isStationRoadmLink;
      
      if (isSatellite) {
        entity.show = showSatellite.value;
        entityCount.satellite++;
      } else if (isStation) {
        entity.show = showStation.value;
        entityCount.station++;
      } else if (isRoadm) {
        entity.show = showRoadm.value;
        entityCount.roadm++;
      } else if (isRoadmRoadmLink) {
        entity.show = showRoadm.value && showLinks.value;
        entityCount.links++;
      } else if (isStationRoadmLink) {
        entity.show = showStation.value && showRoadm.value && showLinks.value;
        entityCount.links++;
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
        entityCount.links++;
      } else {
        // 未分类的实体，可能是国界线或其他
        entityCount.other++;
      }
    });
    
    console.log('实体统计:', entityCount);
    viewer.scene.requestRender();
  }

  // 修改setupClickHandler函数，添加鼠标悬停事件处理
  function setupClickHandler(onEntityClick) {
    if (!viewer || handler) return;
    
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // 添加悬停实体变量
    let hoveredEntity = null;
    
    // 鼠标移动事件 - 处理悬停效果
    handler.setInputAction(function(movement) {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      
      // 清除之前的悬停状态
      if (hoveredEntity) {
        // 恢复之前悬停实体的原始样式
        if (hoveredEntity.point) {
          hoveredEntity.point.color = hoveredEntity._originalColor || Cesium.Color.WHITE;
          hoveredEntity.point.pixelSize = hoveredEntity._originalPixelSize || 5;
          hoveredEntity.point.outline = hoveredEntity._originalOutline || false;
          hoveredEntity.point.outlineColor = hoveredEntity._originalOutlineColor || Cesium.Color.BLACK;
          hoveredEntity.point.outlineWidth = hoveredEntity._originalOutlineWidth || 1;
        }
        hoveredEntity = null;
      }
      
      // 检查当前悬停的实体
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
        const entity = pickedObject.id;
        
        // 只处理卫星实体，忽略链路和其他实体
        if (entity.id && entity.id.startsWith('satellite')) {
          hoveredEntity = entity;
          
          // 保存原始样式
          if (entity.point) {
            entity._originalColor = entity.point.color ? entity.point.color.getValue() : Cesium.Color.WHITE;
            entity._originalPixelSize = entity.point.pixelSize ? entity.point.pixelSize.getValue() : 5;
            entity._originalOutline = entity.point.outline ? entity.point.outline.getValue() : false;
            entity._originalOutlineColor = entity.point.outlineColor ? entity.point.outlineColor.getValue() : Cesium.Color.BLACK;
            entity._originalOutlineWidth = entity.point.outlineWidth ? entity.point.outlineWidth.getValue() : 1;
            
            // 设置悬停效果 - 绿色圆圈
            entity.point.color = Cesium.Color.LIME;
            entity.point.pixelSize = 8; // 调小尺寸以显示圆圈效果
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    // 鼠标点击事件 - 保持原有逻辑
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

  // 处理场景模式变化，修复2D模式下实体位置问题
  function setupSceneModeHandling(viewer) {
    console.log('设置场景模式变化监听');
    
    // 监听场景模式变化
    viewer.scene.morphComplete.addEventListener(() => {
      const sceneMode = viewer.scene.mode;
      console.log(`场景模式切换完成: ${getSceneModeName(sceneMode)}`);
      
      if (sceneMode === Cesium.SceneMode.SCENE2D || 
          sceneMode === Cesium.SceneMode.COLUMBUS_VIEW) {
        // 延迟一下，确保场景完全切换完成
        setTimeout(() => {
          // 2D模式或哥伦布视图模式下，重新计算所有实体位置
          recalculateEntityPositionsFor2D(viewer);
          optimize2DMode(viewer);
        }, 100);
      } else if (sceneMode === Cesium.SceneMode.SCENE3D) {
        // 3D模式下，恢复星空背景显示 10.28新增
        setTimeout(() => {
          if (viewer.scene.skyBox && skyEnabled.value) {
            viewer.scene.skyBox.show = true;
            console.log('3D模式下恢复星空背景显示');
          }
        }, 100);
        //新增结束
      }
    });
    
    // 也监听开始切换事件，用于调试
    viewer.scene.morphStart.addEventListener(() => {
      const fromMode = viewer.scene.mode;
      console.log(`开始切换场景模式，当前模式: ${getSceneModeName(fromMode)}`);
    });
  }

  function getSceneModeName(mode) {
    switch (mode) {
      case Cesium.SceneMode.SCENE3D:
        return '3D模式';
      case Cesium.SceneMode.SCENE2D:
        return '2D模式';
      case Cesium.SceneMode.COLUMBUS_VIEW:
        return '哥伦布视图';
      default:
        return '未知模式';
    }
  }

  function recalculateEntityPositionsFor2D(viewer) {
    console.log('重新计算2D模式下的实体位置');
    const entities = viewer.entities.values;
    let updatedCount = 0;
    let satelliteCount = 0;
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // 跳过没有position属性的实体
      if (!entity.position) {
        continue;
      }
      
      // 检查是否是卫星实体
      const isSatellite = entity.id && (entity.id.startsWith('Sat') || entity.id.includes('satellite'));
      
      if (isSatellite) {
        satelliteCount++;
        // 对于卫星，检查其position是否为CallbackProperty
        if (entity.position && typeof entity.position.getValue === 'function') {
          console.log(`卫星 ${entity.id} 保持动态位置属性 (CallbackProperty)`);
        } else {
          console.warn(`卫星 ${entity.id} 没有动态位置属性，可能已被静态化`);
        }
        continue; // 跳过卫星，不重新设置其位置
      }
      
      // 处理地面站和ROADM（有原始经纬度数据）
      if (entity.originalLatLon) {
        const { longitude, latitude, height = 0 } = entity.originalLatLon;
        
        console.log(`更新地面站/ROADM ${entity.id} 位置: ${longitude}, ${latitude}`);
        
        // 在2D模式下，需要完全重新创建位置属性
        const newPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
        
        // 强制更新实体位置
        entity.position = newPosition;
        
        // 如果实体有point属性，短暂隐藏再显示以触发重新渲染
        if (entity.point) {
          const originalShow = entity.point.show;
          entity.point.show = false;
          // 立即重新显示
          requestAnimationFrame(() => {
            entity.point.show = originalShow;
          });
        }
        
        updatedCount++;
        console.log(`${entity.id} 位置已更新为 (${longitude.toFixed(2)}, ${latitude.toFixed(2)})`);
      }
      // 处理卫星（有原始笛卡尔坐标）
      else if (entity.originalCartesian) {
        // 对于卫星，不要重写动态位置属性，因为它们需要保持动态更新
        // 卫星位置由动画系统管理，在2D模式下应该继续动态更新
        console.log(`跳过卫星 ${entity.id} 位置重写，保持动态位置属性`);
      }
      // 如果没有原始坐标但是地面站或ROADM，尝试从当前位置提取
      else if (entity.id && (entity.id.startsWith('ROADM') || entity.id.includes('station') || entity.id.startsWith('station')) 
               && !entity.id.startsWith('Sat') && !entity.id.includes('satellite')) {
        try {
          let currentPosition = entity.position;
          
          // 安全地获取当前位置
          if (currentPosition && typeof currentPosition.getValue === 'function') {
            try {
              currentPosition = currentPosition.getValue(Cesium.JulianDate.now());
            } catch (error) {
              console.warn(`无法获取实体 ${entity.id} 的CallbackProperty值:`, error);
              continue;
            }
          }
          
          if (currentPosition && currentPosition instanceof Cesium.Cartesian3) {
            // 将笛卡尔坐标转换为经纬度
            const cartographic = Cesium.Cartographic.fromCartesian(currentPosition);
            if (cartographic) {
              const longitude = Cesium.Math.toDegrees(cartographic.longitude);
              const latitude = Cesium.Math.toDegrees(cartographic.latitude);
              
              console.log(`从当前位置提取 ${entity.id} 坐标: ${longitude}, ${latitude}`);
              
              // 保存原始坐标并重新设置位置
              entity.originalLatLon = { longitude, latitude, height: 10 };
              
              // 强制重新创建位置
              const newPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, 10);
              entity.position = newPosition;
              
              // 强制触发重新渲染
              if (entity.point) {
                const originalShow = entity.point.show;
                entity.point.show = false;
                requestAnimationFrame(() => {
                  entity.point.show = originalShow;
                });
              }
              
              updatedCount++;
              console.log(`${entity.id} 位置已重新设置为 (${longitude.toFixed(2)}, ${latitude.toFixed(2)})`);
            }
          }
        } catch (error) {
          console.warn(`无法处理实体 ${entity.id} 的位置:`, error);
        }
      }
    }
    
    console.log(`已更新 ${updatedCount} 个实体的2D位置`);
    console.log(`保持 ${satelliteCount} 个卫星的动态位置属性`);
    
    // 强制场景重新渲染
    viewer.scene.requestRender();
    
    console.log('场景重新渲染已请求');
  }

  function optimize2DMode(viewer) {
    console.log('优化2D模式显示');
    
    if (viewer.scene.mode === Cesium.SceneMode.SCENE2D) {
      // 设置2D模式的最佳视图
      viewer.camera.setView({
        destination: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0.0
        }
      });
      
      // 调整2D模式下的渲染设置
      viewer.scene.globe.enableLighting = false;
      viewer.scene.fog.enabled = false;
      viewer.scene.skyAtmosphere.show = false;
      
      // 在2D模式下隐藏星空背景 10.28新增
      if (viewer.scene.skyBox) {
        viewer.scene.skyBox.show = false;
      }
      //新增结束
      
      // 设置合适的缩放级别下显示标签
      viewer.scene.camera.changed.addEventListener(() => {
        const height = viewer.camera.positionCartographic.height;
        const showLabels = height < 10000000; // 小于1000万米时显示标签
        showEntityLabels(viewer, showLabels);
      });
    }
  }

  function showEntityLabels(viewer, show) {
    const entities = viewer.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.label) {
        entity.label.show = show;
      }
    }
  }

  function cleanup() {
    // 清理时间轴位置监听器
    if (window.cleanupTimelinePosition) {
      window.cleanupTimelinePosition();
      delete window.cleanupTimelinePosition;
    }
    
    if (handler) {
      handler.destroy();
      handler = null;
    }
    
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
  }

  // 手动触发2D模式位置重计算（用于测试）
  function manuallyFixEntitiesFor2D() {
    console.log('手动修复2D模式实体位置');
    if (!viewer.current) {
      console.log('viewer 不可用');
      return;
    }
    
    const entities = viewer.current.entities.values;
    let fixedCount = 0;
    
    console.log(`🔍 找到 ${entities.length} 个实体`);
    
    // 先移除所有地面站和ROADM，然后重新创建
    const toRecreate = [];
    
    entities.forEach(entity => {
      if (entity.id && (entity.id.includes('ROADM') || entity.id.includes('station'))) {
        if (entity.originalLatLon) {
          // 保存实体信息用于重新创建
          toRecreate.push({
            id: entity.id,
            originalLatLon: entity.originalLatLon,
            label: entity.label ? {
              text: entity.label.text,
              font: entity.label.font,
              fillColor: entity.label.fillColor,
              outlineColor: entity.label.outlineColor,
              outlineWidth: entity.label.outlineWidth,
              style: entity.label.style,
              pixelOffset: entity.label.pixelOffset,
              showBackground: entity.label.showBackground,
              backgroundColor: entity.label.backgroundColor
            } : null,
            point: entity.point ? {
              pixelSize: entity.point.pixelSize,
              color: entity.point.color,
              outlineColor: entity.point.outlineColor,
              outlineWidth: entity.point.outlineWidth,
              show: entity.point.show
            } : null
          });
          
          // 移除原实体
          viewer.current.entities.remove(entity);
        }
      }
    });
    
    console.log(`移除了 ${toRecreate.length} 个实体，准备重新创建`);
    
    // 重新创建所有实体
    toRecreate.forEach(entityInfo => {
      const { longitude, latitude } = entityInfo.originalLatLon;
      
      // 在2D模式下创建新实体
      const newEntity = viewer.current.entities.add({
        id: entityInfo.id,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
        originalLatLon: entityInfo.originalLatLon, // 保留原始坐标
        point: {
          pixelSize: entityInfo.point?.pixelSize || 8,
          color: entityInfo.point?.color || Cesium.Color.YELLOW,
          outlineColor: entityInfo.point?.outlineColor || Cesium.Color.BLACK,
          outlineWidth: entityInfo.point?.outlineWidth || 1,
          show: true,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      
      // 如果有标签，也重新添加
      if (entityInfo.label) {
        newEntity.label = {
          text: entityInfo.label.text,
          font: entityInfo.label.font || '12pt sans-serif',
          fillColor: entityInfo.label.fillColor || Cesium.Color.WHITE,
          outlineColor: entityInfo.label.outlineColor || Cesium.Color.BLACK,
          outlineWidth: entityInfo.label.outlineWidth || 1,
          style: entityInfo.label.style || Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: entityInfo.label.pixelOffset || new Cesium.Cartesian2(0, -20),
          showBackground: entityInfo.label.showBackground || false,
          backgroundColor: entityInfo.label.backgroundColor || Cesium.Color.BLACK.withAlpha(0.7),
          show: true
        };
      }
      
      fixedCount++;
      console.log(`重新创建 ${entityInfo.id}: (${longitude.toFixed(2)}, ${latitude.toFixed(2)})`);
    });
    
    // 强制重新渲染和布局
    viewer.current.scene.requestRender();
    
    // 触发场景模式变化事件以强制重新布局
    setTimeout(() => {
      viewer.current.scene.morphTo2D(0);
    }, 100);
    
    console.log(`手动修复完成，共重新创建 ${fixedCount} 个实体`);
    
    return fixedCount;
  }

  // 将函数暴露到全局，方便调试
  window.manuallyFixEntitiesFor2D = manuallyFixEntitiesFor2D;

  // 重置时钟范围（用于文件夹切换）
  function resetClockRange(folderName) {
    if (!viewer) return;
    
    // 解析文件夹名称获取配置
    const config = parseFolderName(folderName);
    
    // 更新全局时间轴配置
    currentTimelineConfig = config;
    
    // 使用固定的基准时间，避免与系统时间同步导致的跳跃
    const baseTime = Cesium.JulianDate.fromDate(new Date('2024-01-01T00:00:00Z'));
    
    const timeInterval = config.interval; // 每帧的时间间隔（秒）
    const totalDuration = config.totalDuration; // 总时长（秒）
    const calculatedTotalFrames = Math.ceil(totalDuration / timeInterval); // 计算总帧数
    
    console.log(`解析文件夹配置:`, {
      folderName,
      type: config.type,
      interval: timeInterval,
      totalDuration,
      totalFrames: calculatedTotalFrames,
      isDefault: config.isDefault
    });
    
    // 更新全局totalFrames变量（如果setupTimelineControl已经执行）
    if (typeof window !== 'undefined' && window.updateTimelineTotalFrames) {
      window.updateTimelineTotalFrames(calculatedTotalFrames);
    }
    
    const startTime = baseTime;
    const endTime = Cesium.JulianDate.addSeconds(startTime, totalDuration, new Cesium.JulianDate());
    
    // 停止动画
    viewer.clock.shouldAnimate = false;
    
    // 重新设置时钟 - 使用正确的时间间隔，允许任意跳转
    viewer.clock.startTime = startTime;
    viewer.clock.currentTime = startTime; // 总是从第一帧开始
    viewer.clock.stopTime = endTime;
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED; // 使用UNBOUNDED，允许完全自由的时间跳转
    viewer.clock.multiplier = timeInterval; // 设置multiplier为时间间隔，这样每个时钟tick对应一帧的时间跳跃
    
    // 允许时钟交互，但默认不播放
    viewer.clock.canAnimate = true; // 允许动画，这样时间轴才能正常交互
    viewer.clock.shouldAnimate = false; // 但默认不播放
    
    console.log(`时钟重置完成 - 文件夹: ${folderName}, 时间间隔: ${timeInterval}秒, 总时长: ${totalDuration}秒, 总帧数: ${calculatedTotalFrames}`);
    console.log(`时间范围: ${Cesium.JulianDate.toIso8601(startTime)} 到 ${Cesium.JulianDate.toIso8601(endTime)}`);
    
    // 更新自定义时间轴的总时间显示
    const totalTimeDisplay = document.querySelector('#custom-total-time-display');
    if (totalTimeDisplay) {
      if (config.isDefault) {
        totalTimeDisplay.textContent = '--:--:--';
        console.log(`总时间显示已更新为默认状态: ${totalTimeDisplay.textContent}`);
      } else {
        const totalMinutes = Math.floor(totalDuration / 60);
        const remainingSeconds = totalDuration % 60;
        const totalHours = Math.floor(totalMinutes / 60);
        const displayMinutes = totalMinutes % 60;
        totalTimeDisplay.textContent = `${totalHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        console.log(`总时间显示已更新: ${totalTimeDisplay.textContent}`);
      }
    }
    
    // 强制刷新时间轴并确保可交互
    setTimeout(() => {
      if (viewer.timeline) {
        viewer.timeline.updateFromClock();
        viewer.timeline.resize();
      }
      
      // 重新启用时钟控制，确保可以拖拽
      viewer.clock.canAnimate = true;
      viewer.clock.shouldAnimate = false;
      
      // 确保原生时间轴可见和可交互
      const timelineElement = document.querySelector('.cesium-timeline-main');
      if (timelineElement) {
        timelineElement.style.display = 'block';
        timelineElement.style.visibility = 'visible';
        timelineElement.style.pointerEvents = 'auto'; // 确保可以交互
        console.log('Cesium原生时间轴已启用交互');
      }
    }, 200);
  }

  return {
    viewer: () => viewer,
    showSatellite,
    showStation,
    showRoadm,
    showLinks,
    lightingEnabled,
    initializeCesium,
    createEntities,
    addRoadmLinks,
    clearGroundLinks,
    highlightSatelliteLinks,
    updateVisibility,
    setupClickHandler,
    setupTimelineControl,
    setupTimelineStyles,
    debugTimelineElements,
    forceShowTimelineControls,
    setTimelinePosition,
    jumpToTimeFrame,
    setPlaybackRate,
    setTimelineAnimation,
    resetClockRange,
    highlightSelectedLink,
    resetLinkHighlight,
    cleanup,
    manuallyFixEntitiesFor2D,
    parseFolderName,
    // 切换光照效果
    toggleLighting: function(enabled) {
      if (viewer && viewer.scene && viewer.scene.globe) {
        viewer.scene.globe.enableLighting = enabled;
        lightingEnabled.value = enabled;
        console.log(`光照效果已${enabled ? '开启' : '关闭'}`);
      }
    },
    // 获取光照状态
    getLightingEnabled: function() {
      return lightingEnabled.value;
    },
    // 切换国界线显示 10.27新增 - 修复国界线按钮不工作问题
    toggleBorder: function(enabled) {
      if (viewer && viewer.dataSources) {
        // 直接标记国界线可见性状态
        borderEnabled.value = enabled;
        
        // 遍历所有数据源，查找并控制国界线
        let found = false;
        for (let i = 0; i < viewer.dataSources.length; i++) {
          const dataSource = viewer.dataSources.get(i);
          // 标记国界线数据源以便后续查找
          if (!dataSource._isCountryBorderDataSource && dataSource.entities && dataSource.entities.values.length > 0) {
            const firstEntity = dataSource.entities.values[0];
            // 判断是否为GeoJSON加载的国界线数据
            if ((firstEntity.polygon || firstEntity.polyline) && 
                ((firstEntity.polygon && firstEntity.polygon.outline) || 
                 (firstEntity.polyline && firstEntity.polyline.width > 10))) {
              dataSource._isCountryBorderDataSource = true;
            }
          }
          
          // 根据标记查找国界线数据源并设置可见性
          if (dataSource._isCountryBorderDataSource) {
            dataSource.show = enabled;
            found = true;
            console.log(`国界线显示已${enabled ? '开启' : '关闭'}`);
            break;
          }
        }
        
        // 如果未找到且开启状态，尝试重新加载国界线数据
        if (!found && enabled) {
          console.warn('未找到国界线数据源，尝试重新加载...');
          loadLocalCountryBorders().then(() => {
            // 设置新加载的国界线为可见
            for (let i = 0; i < viewer.dataSources.length; i++) {
              const dataSource = viewer.dataSources.get(i);
              if (!dataSource._isCountryBorderDataSource && dataSource.entities && dataSource.entities.values.length > 0) {
                const firstEntity = dataSource.entities.values[0];
                if ((firstEntity.polygon || firstEntity.polyline) && 
                    ((firstEntity.polygon && firstEntity.polygon.outline) || 
                     (firstEntity.polyline && firstEntity.polyline.width > 10))) {
                  dataSource._isCountryBorderDataSource = true;
                  dataSource.show = true;
                  console.log(`国界线显示已开启`);
                  break;
                }
              }
            }
          });
        }
        
        // 强制刷新场景
        viewer.scene.requestRender();
      }
    },
    // 获取国界线状态 10.27新增
    getBorderEnabled: function() {
      return borderEnabled.value;
    },
    // 切换经纬线网格显示 10.28新增
    toggleGrid: function(enabled) {
      if (viewer && viewer.dataSources) {
        // 查找网格数据源
        for (let i = 0; i < viewer.dataSources.length; i++) {
          const dataSource = viewer.dataSources.get(i);
          if (dataSource.name === 'gridLines') {
            // 设置显示状态
            dataSource.show = enabled;
            gridEnabled.value = enabled;
            console.log(`经纬线网格显示已${enabled ? '开启' : '关闭'}`);
            
            // 如果开启网格且没有实体，重新生成网格线
            if (enabled && dataSource.entities.values.length === 0) {
              createGridLines(dataSource);
            }
            
            // 强制刷新场景
            viewer.scene.requestRender();
            break;
          }
        }
      }
    },
    // 获取经纬线网格状态 10.28新增
    getGridEnabled: function() {
      return gridEnabled.value;
    },
    // 切换星空背景显示 10.28新增
    toggleSky: function(enabled) {
      if (viewer && viewer.scene) {
        viewer.scene.skyBox.show = enabled;
        skyEnabled.value = enabled;
        console.log(`星空背景显示已${enabled ? '开启' : '关闭'}`);
        // 强制刷新场景
        viewer.scene.requestRender();
      }
    },
    // 获取星空背景状态 10.28新增
    getSkyEnabled: function() {
      return skyEnabled.value;
    },
    // 切换地球纹理显示 新增
    toggleEarthTexture: function(texturePath) {
      if (viewer && viewer.imageryLayers) {
        try {
          // 移除所有现有图层
          viewer.imageryLayers.removeAll();
          
          // 创建新的地球纹理提供者
          const earthImageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: window.location.origin + texturePath,
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
            tilingScheme: new Cesium.GeographicTilingScheme({
              numberOfLevelZeroTilesX: 1,
              numberOfLevelZeroTilesY: 1
            }),
            maximumLevel: 0,
            credit: 'Natural Earth'
          });
          
          // 添加新图层
          viewer.imageryLayers.addImageryProvider(earthImageryProvider);
          
          console.log(`地球纹理已切换为: ${texturePath}`);
          
          // 强制刷新场景
          viewer.scene.requestRender();
        } catch (error) {
          console.error('切换地球纹理失败:', error);
        }
      }
    }
  };
}