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
    
    viewer = new Cesium.Viewer(containerId, {
      animation: false,
      timeline: false,
      fullscreenButton: false,
      baseLayerPicker: true, // 启用地图选择按钮
      selectionIndicator: false, // 禁用原生选择指示器，使用自定义的
      infoBox: false, // 禁用默认信息框
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      targetFrameRate: 30,
      automaticallyTrackDataSourceClocks: false,
      shouldAnimate: false
    });

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
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    
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
      
      const sourcePosition = getEntityPosition(sourceNode);
      const targetPosition = getEntityPosition(targetNode);
      
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

      const sourcePosition = getEntityPosition(sourceNode);
      const targetPosition = getEntityPosition(targetNode);

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
    cleanup
  };
}