// src/composables/useServiceData.js
import { ref } from 'vue';
import * as Cesium from 'cesium';
import { LRUCache } from '../utils/lruCache.js';
import { CACHE_CONFIG } from '../constants/index.js';

// 模块初始化标识
const moduleInitTime = Date.now();
console.log(`🔄 useServiceData 模块初始化时间: ${new Date(moduleInitTime).toLocaleTimeString()}`);

// ⭐ 将缓存变量移到模块级别，避免多次函数调用时重置
let moduleDrawnServiceIds = new Set();
let moduleLastDrawOptions = null;
let moduleLastViewer = null;
let moduleLastNetworkData = null;

console.log(`🎯 模块级缓存变量初始化完成`);

export function useServiceData() {
  console.log(`🎯 useServiceData() 函数被调用 - 模块初始化时间: ${new Date(moduleInitTime).toLocaleTimeString()}`);
  console.log(`📊 当前模块级缓存状态: drawnServiceIds=${moduleDrawnServiceIds.size}, lastViewer=${!!moduleLastViewer}`);
  
  const serviceData = ref({
    active_requests: [],
    pending_requests: [],
    ended_requests: [],
    blocked_requests: [],
    failed_requests: []
  });
  
  const selectedService = ref(null);
  
  // 使用 LRU 缓存，从配置中获取最大缓存数量
  const serviceCache = new LRUCache(CACHE_CONFIG.MAX_SERVICE_CACHE);
  
  // 获取当前选择的数据文件夹
  function getCurrentDataFolder() {
    return localStorage.getItem('selectedDataFolder') || 'new';
  }
  
  // ⭐ 使用模块级别的缓存变量，避免多次函数调用时重置
  // 这样确保缓存在不同的函数调用之间保持持久化
  
  // 添加调试函数
  function logCacheState(context = '') {
    console.log(`=== 缓存状态检查 (${context}) ===`);
    console.log('moduleDrawnServiceIds size:', moduleDrawnServiceIds.size);
    console.log('moduleDrawnServiceIds content:', Array.from(moduleDrawnServiceIds));
    console.log('moduleLastViewer exists:', !!moduleLastViewer);
    console.log('moduleLastViewer type:', typeof moduleLastViewer);
    console.log('moduleLastViewer entities:', !!(moduleLastViewer?.entities));
    console.log('moduleLastNetworkData exists:', !!moduleLastNetworkData);
    console.log('Stack trace:', new Error().stack);
  }

  async function loadServiceData(frame) {
    try {
      const currentFolder = getCurrentDataFolder();
      if (!currentFolder) {
        console.log('未选择数据文件夹，跳过业务数据加载');
        return {
          active_requests: [],
          pending_requests: [],
          ended_requests: [],
          blocked_requests: [],
          failed_requests: []
        };
      }
      
      // 动态检测文件夹的时间间隔
      let timeInterval = 60; // 默认60秒间隔
      
      // 尝试检测第一个可用的时间间隔
      const possibleIntervals = [10, 60]; // 常见的时间间隔
      for (const interval of possibleIntervals) {
        const testResponse = await fetch(`./data/${currentFolder}/service_state_${interval}.00.json`);
        if (testResponse.ok) {
          timeInterval = interval;
          break;
        }
      }
      
      const timeSeconds = frame * timeInterval;
      const filename = `./data/${currentFolder}/service_state_${timeSeconds}.00.json`;
      
      console.log(`正在加载业务数据文件: ${filename} (文件夹: ${currentFolder}, 时间帧: ${frame}, 时间间隔: ${timeInterval}秒, 时间: ${timeSeconds}秒)`);
      console.log(`=== 业务数据文件请求详情 ===`);
      console.log(`完整路径: ${filename}`);
      console.log(`时间帧计算: frame(${frame}) * interval(${timeInterval}) = ${timeSeconds}秒`);
      
      if (serviceCache.has(filename)) {
        const cachedData = serviceCache.get(filename);
        serviceData.value = cachedData;
        console.log("使用缓存的业务数据:", cachedData);
        return cachedData;
      }
      
      const response = await fetch(filename);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 获取文本内容并处理 Infinity
      const textData = await response.text();
      const fixedJsonText = textData.replace(/"Infinity"/g, 'null').replace(/Infinity/g, 'null');
      const rawData = JSON.parse(fixedJsonText);
      
      // 处理不同的数据结构格式
      let serviceDataSource = rawData;
      
      // 检查是否是 new 文件夹的格式（数据在 data 字段内）
      if (rawData.data && typeof rawData.data === 'object') {
        console.log('检测到新格式数据结构（数据在 data 字段内）');
        serviceDataSource = rawData.data;
      } else {
        console.log('检测到旧格式数据结构（数据在根级别）');
      }
      
      // 验证数据结构
      const processedData = {
        active_requests: serviceDataSource.active_requests || [],
        pending_requests: serviceDataSource.pending_requests || [],
        ended_requests: serviceDataSource.ended_requests || [],
        blocked_requests: serviceDataSource.blocked_requests || [],
        failed_requests: serviceDataSource.failed_requests || []
      };
      
      serviceData.value = processedData;
      serviceCache.set(filename, processedData);
      
      console.log(`✅ 业务数据加载成功 (${filename}):`, {
        dataFormat: serviceDataSource === rawData ? '旧格式' : '新格式(data字段)',
        active: processedData.active_requests.length,
        pending: processedData.pending_requests.length,
        ended: processedData.ended_requests.length,
        blocked: processedData.blocked_requests.length,
        failed: processedData.failed_requests.length,
        totalRequests: processedData.active_requests.length + processedData.pending_requests.length + 
                      processedData.ended_requests.length + processedData.blocked_requests.length + 
                      processedData.failed_requests.length
      });
      
      // 如果之前有绘制过路径，则重新绘制
      if (moduleDrawnServiceIds.size > 0 && moduleLastViewer && moduleLastNetworkData) {
        console.log('检测到缓存的业务ID，重新绘制路径...');
        logCacheState('loadServiceData中检测到缓存');
        // 延迟一小段时间确保网络数据已更新
        setTimeout(() => {
          redrawCachedServicePaths();
        }, 100);
      }
      
      return processedData;
      
    } catch (error) {
      console.error(`加载业务数据失败 (${filename}):`, error);
      
      // 设置默认空数据
      const defaultData = {
        active_requests: [],
        pending_requests: [],
        ended_requests: [],
        blocked_requests: [],
        failed_requests: []
      };
      serviceData.value = defaultData;
      return defaultData;
    }
  }

  // 从文件对象加载业务数据
  async function loadServiceDataFromFile(file) {
    try {
      console.log(`正在从文件加载业务数据: ${file.name}`);
      
      // 读取文件内容
      const textData = await file.text();
      
      // 处理 Infinity 值
      const fixedJsonText = textData.replace(/"Infinity"/g, 'null').replace(/Infinity/g, 'null');
      const rawData = JSON.parse(fixedJsonText);
      
      // 处理不同的数据结构格式
      let serviceDataSource = rawData;
      
      // 检查是否是 new 文件夹的格式（数据在 data 字段内）
      if (rawData.data && typeof rawData.data === 'object') {
        console.log('检测到新格式数据结构（数据在 data 字段内）');
        serviceDataSource = rawData.data;
      } else {
        console.log('检测到旧格式数据结构（数据在根级别）');
      }
      
      // 验证数据结构
      const processedData = {
        active_requests: serviceDataSource.active_requests || [],
        pending_requests: serviceDataSource.pending_requests || [],
        ended_requests: serviceDataSource.ended_requests || [],
        blocked_requests: serviceDataSource.blocked_requests || [],
        failed_requests: serviceDataSource.failed_requests || []
      };
      
      // 更新业务数据
      serviceData.value = processedData;
      
      console.log(`业务数据加载成功 (${file.name}):`, {
        active: processedData.active_requests.length,
        pending: processedData.pending_requests.length,
        ended: processedData.ended_requests.length,
        blocked: processedData.blocked_requests.length,
        failed: processedData.failed_requests.length
      });
      
      // 如果之前有绘制过路径，则重新绘制
      if (moduleDrawnServiceIds.size > 0 && moduleLastViewer && moduleLastNetworkData) {
        console.log('检测到缓存的业务ID，重新绘制路径...');
        logCacheState('loadServiceDataFromFile中检测到缓存');
        // 延迟一小段时间确保网络数据已更新
        setTimeout(() => {
          redrawCachedServicePaths();
        }, 100);
      }
      
      return processedData;
      
    } catch (error) {
      console.error(`从文件加载业务数据失败 (${file.name}):`, error);
      throw error; // 重新抛出错误，让调用方处理
    }
  }

  function generateServiceId(request) {
    if (request.request_id) return request.request_id;
    if (request.id) return request.id;
    if (request.src_node && request.dst_node) {
      return `${request.src_node}-${request.dst_node}-${Date.now()}`;
    }
    return `service-${Math.random().toString(36).substr(2, 9)}`;
  }

  function selectService(service, type) {
    selectedService.value = { data: service, type };
    console.log("选择业务:", service);
  }

  function closeServiceDetail() {
    selectedService.value = null;
  }

  // 检查并获取有效的viewer
  function getValidViewer(inputViewer = null) {
    console.log('=== getValidViewer 检查 ===');
    
    // 优先使用传入的viewer
    if (inputViewer) {
      console.log('检查传入的viewer:');
      console.log('- 类型:', typeof inputViewer);
      console.log('- 是否为函数:', typeof inputViewer === 'function');
      console.log('- 是否有entities属性:', !!(inputViewer?.entities));
      
      // 如果是函数，尝试调用
      if (typeof inputViewer === 'function') {
        try {
          const actualViewer = inputViewer();
          console.log('- 调用函数后的结果类型:', typeof actualViewer);
          console.log('- 调用函数后是否有entities:', !!(actualViewer?.entities));
          if (actualViewer && typeof actualViewer === 'object' && actualViewer.entities) {
            console.log('使用传入的viewer函数结果');
            return actualViewer;
          }
        } catch (error) {
          console.error('调用viewer函数失败:', error);
        }
      }
      // 如果是对象且有entities
      else if (typeof inputViewer === 'object' && inputViewer.entities) {
        console.log('使用传入的viewer对象');
        return inputViewer;
      }
    }
    
    // 其次使用缓存的viewer
    if (moduleLastViewer) {
      console.log('检查缓存的viewer:');
      console.log('- 类型:', typeof moduleLastViewer);
      console.log('- 是否为函数:', typeof moduleLastViewer === 'function');
      console.log('- 是否有entities属性:', !!(moduleLastViewer?.entities));
      
      // 如果是函数，尝试调用
      if (typeof moduleLastViewer === 'function') {
        try {
          const actualViewer = moduleLastViewer();
          console.log('- 调用缓存函数后的结果类型:', typeof actualViewer);
          console.log('- 调用缓存函数后是否有entities:', !!(actualViewer?.entities));
          if (actualViewer && typeof actualViewer === 'object' && actualViewer.entities) {
            console.log('使用缓存的viewer函数结果');
            return actualViewer;
          }
        } catch (error) {
          console.error('调用缓存viewer函数失败:', error);
        }
      }
      // 如果是对象且有entities
      else if (typeof moduleLastViewer === 'object' && moduleLastViewer.entities) {
        console.log('使用缓存的viewer对象');
        return moduleLastViewer;
      }
    }
    
    console.warn('无法获取有效的viewer');
    return null;
  }

  // 绘制业务路径
  function drawServicePath(viewer, service, networkData, pathColor = null) {
    console.log('=== drawServicePath 被调用 ===');
    console.log('service:', service);
    console.log('service.path:', service.path);
    console.log('networkData nodes count:', networkData?.nodes?.length);
    console.log('viewer 类型:', typeof viewer);
    console.log('viewer 是否有效:', !!viewer);
    
    // 获取实际的viewer对象
    let actualViewer = viewer;
    if (typeof viewer === 'function') {
      try {
        actualViewer = viewer();
        console.log('通过函数获取的viewer类型:', typeof actualViewer);
        console.log('通过函数获取的viewer是否有entities:', !!(actualViewer?.entities));
      } catch (error) {
        console.error('调用viewer函数失败:', error);
        return null;
      }
    }
    
    if (!actualViewer || !service || !service.path || !networkData) {
      console.warn('drawServicePath 缺少必要参数:', { 
        viewer: !!actualViewer, 
        viewerType: typeof actualViewer,
        service: !!service, 
        servicePath: !!service?.path, 
        networkData: !!networkData 
      });
      return null;
    }
    
    const servicePath = service.path;
    if (servicePath.length < 2) {
      console.warn('路径长度不足:', servicePath.length);
      return null;
    }
    
    console.log('服务路径:', servicePath);
    
    // 缓存业务ID和相关信息
    moduleDrawnServiceIds.add(service.request_id);
    console.log(`✅ 添加业务ID到缓存: ${service.request_id}`);
    console.log('当前缓存大小:', moduleDrawnServiceIds.size);
    console.log('调用栈:', new Error().stack?.split('\n').slice(1,4).join('\n'));
    
    moduleLastViewer = viewer; // 保存原始的viewer（可能是函数）
    console.log(`📝 设置 moduleLastViewer - 类型: ${typeof viewer}, 是函数: ${typeof viewer === 'function'}`);
    if (typeof viewer === 'function') {
      try {
        const testResult = viewer();
        console.log(`   函数调用结果类型: ${typeof testResult}, 有entities: ${!!(testResult?.entities)}`);
      } catch (e) {
        console.warn('   函数调用测试失败:', e.message);
      }
    } else if (typeof viewer === 'object') {
      console.log(`   对象有entities: ${!!(viewer?.entities)}`);
    }
    moduleLastNetworkData = networkData;
    
    logCacheState(`绘制业务路径 ${service.request_id} 后`);
    
    // 清除之前的路径（但不从缓存中移除ID）
    clearServicePath(actualViewer, service.request_id, false);
    
    // 创建动态位置回调函数
    const createDynamicPositionCallback = (nodeId, nodeType, staticPosition) => {
      if (nodeType === 'satellite') {
        // 对于卫星节点，创建动态位置回调
        return new Cesium.CallbackProperty(function(time, result) {
          // 尝试从场景中获取实时的卫星实体位置
          const satelliteEntity = actualViewer.entities.getById(nodeId);
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
          return staticPosition;
        }, false);
      } else {
        // 对于地面节点，返回静态位置
        return staticPosition;
      }
    };
    
    // 获取路径节点位置（包括动态位置）
    const dynamicPositions = [];
    const validNodes = [];
    
    servicePath.forEach(nodeId => {
      const node = networkData.nodes.find(n => n.id === nodeId);
      if (node) {
        let staticPosition;
        if (node.type === 'satellite') {
          // 卫星节点使用3D坐标
          staticPosition = new Cesium.Cartesian3(
            parseFloat(node.position[0]) * 1000,
            parseFloat(node.position[1]) * 1000,
            parseFloat(node.position[2]) * 1000
          );
        } else {
          // 地面节点使用经纬度
          staticPosition = Cesium.Cartesian3.fromDegrees(
            parseFloat(node.position[0]),
            parseFloat(node.position[1]),
            node.type === 'station' ? 10 : 10
          );
        }
        
        // 创建动态位置（卫星）或静态位置（地面节点）
        const dynamicPosition = createDynamicPositionCallback(node.id, node.type, staticPosition);
        dynamicPositions.push(dynamicPosition);
        validNodes.push(node);
      }
    });
    
    if (dynamicPositions.length < 2) return null;
    
    // 根据业务状态确定颜色
    let color = pathColor;
    if (!color) {
      switch (service.status) {
        case 'IN_SERVICE':
          color = Cesium.Color.RED;
          break;
        case 'PENDING':
          color = Cesium.Color.RED;
          break;
        case 'BLOCKED':
          color = Cesium.Color.RED;
          break;
        case 'FAILED':
          color = Cesium.Color.RED;
          break;
        default:
          color = Cesium.Color.RED;
      }
    }
    
    // 创建动态路径线
    const pathEntity = actualViewer.entities.add({
      id: `service-path-${service.request_id}`,
      name: `业务路径: ${service.request_id}`,
      polyline: {
        positions: new Cesium.CallbackProperty(function(time, result) {
          // 动态计算所有节点的位置
          const currentPositions = [];
          dynamicPositions.forEach(positionCallback => {
            if (typeof positionCallback.getValue === 'function') {
              const pos = positionCallback.getValue(time);
              if (pos) {
                currentPositions.push(pos);
              }
            } else {
              currentPositions.push(positionCallback);
            }
          });
          return currentPositions;
        }, false),
        width: 3,
        material: new Cesium.PolylineOutlineMaterialProperty({
          color: color.withAlpha(0.8),
          outlineWidth: 1,
          outlineColor: Cesium.Color.WHITE
        }),
        arcType: Cesium.ArcType.NONE,
        clampToGround: false
      },
      description: `
        <div>
          <h3>业务路径详情</h3>
          <p><strong>业务ID:</strong> ${service.request_id}</p>
          <p><strong>状态:</strong> ${service.status}</p>
          <p><strong>源节点:</strong> ${service.src_node}</p>
          <p><strong>目标节点:</strong> ${service.dst_node}</p>
          <p><strong>带宽:</strong> ${service.bandwidth} Mbps</p>
          <p><strong>延迟:</strong> ${service.latency ? service.latency.toFixed(3) : 'N/A'} ms</p>
          <p><strong>跳数:</strong> ${service.hops || 'N/A'}</p>
          <p><strong>路径:</strong> ${servicePath.join(' → ')}</p>
        </div>
      `
    });
    
    // 在路径节点上添加动态标记点
    validNodes.forEach((node, index) => {
      if (index === 0 || index === validNodes.length - 1) {
        // 只在起点和终点添加特殊标记
        const isSource = index === 0;
        const dynamicPosition = dynamicPositions[index];
        
        actualViewer.entities.add({
          id: `service-path-${service.request_id}-marker-${index}`,
          position: dynamicPosition,
          point: {
            pixelSize: 12,
            color: isSource ? Cesium.Color.LIME : Cesium.Color.ORANGE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.NONE
          },
          label: {
            text: isSource ? '起点' : '终点',
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15)
          }
        });
      }
    });
    
    return pathEntity;
  }

  // 清除业务路径
  function clearServicePath(viewer, serviceId, removeFromCache = true) {
    if (!viewer) return;
    
    // 获取实际的viewer对象
    let actualViewer = viewer;
    if (typeof viewer === 'function') {
      try {
        actualViewer = viewer();
      } catch (error) {
        console.error('调用viewer函数失败:', error);
        return;
      }
    }
    
    if (!actualViewer) return;
    
    const pathId = `service-path-${serviceId}`;
    const pathEntity = actualViewer.entities.getById(pathId);
    if (pathEntity) {
      actualViewer.entities.remove(pathEntity);
    }
    
    // 清除路径标记点
    const entities = actualViewer.entities.values.slice();
    entities.forEach(entity => {
      if (entity.id && entity.id.startsWith(`service-path-${serviceId}-marker-`)) {
        actualViewer.entities.remove(entity);
      }
    });
    
    // 只有在明确要求时才从缓存中移除该业务ID
    if (removeFromCache) {
      moduleDrawnServiceIds.delete(serviceId);
      console.log(`🗑️ 从缓存中移除业务ID: ${serviceId}`);
      console.log('移除后缓存大小:', moduleDrawnServiceIds.size);
      console.log('调用栈:', new Error().stack?.split('\n').slice(1,4).join('\n'));
      logCacheState(`移除业务ID ${serviceId} 后`);
    } else {
      console.log(`清除业务路径显示但保留缓存: ${serviceId}`);
    }
  }

  // 清除所有业务路径
  function clearAllServicePaths(viewer) {
    if (!viewer) return;
    
    const entities = viewer.entities.values.slice();
    entities.forEach(entity => {
      if (entity.id && entity.id.startsWith('service-path-')) {
        viewer.entities.remove(entity);
      }
    });
    
    // 注意：不清除业务ID缓存，保持自动重绘功能
    // 如果需要完全停止自动重绘，请使用 clearDrawnServiceIds()
    console.log('清除所有路径显示，但保留缓存的业务ID以支持自动重绘');
  }

  // 完全清除业务路径缓存（停止自动重绘）
  function clearAllServicePathsAndCache(viewer) {
    if (!viewer) return;
    
    const entities = viewer.entities.values.slice();
    entities.forEach(entity => {
      if (entity.id && entity.id.startsWith('service-path-')) {
        viewer.entities.remove(entity);
      }
    });
    
    // 清除所有缓存的业务ID和选项
    moduleDrawnServiceIds.clear();
    console.log(`🗑️🗑️ 清除所有缓存的业务ID`);
    console.log('调用栈:', new Error().stack?.split('\n').slice(1,5).join('\n'));
    moduleLastDrawOptions = null;
    console.log('清除所有路径显示和缓存，停止自动重绘功能');
    logCacheState('完全清除后');
  }

  // 批量绘制业务路径
  function drawMultipleServicePaths(viewer, services, networkData, options = {}) {
    console.log('=== drawMultipleServicePaths 被调用 ===');
    console.log('viewer:', viewer);
    console.log('services:', services);
    console.log('networkData:', networkData);
    console.log('options:', options);
    
    if (!viewer || !services || !networkData) {
      console.warn('缺少必要参数:', { viewer: !!viewer, services: !!services, networkData: !!networkData });
      return;
    }
    
    // 缓存绘制选项和网络数据
    moduleLastDrawOptions = { ...options };
    moduleLastViewer = viewer;
    console.log(`📝 在批量绘制中设置 moduleLastViewer - 类型: ${typeof viewer}, 是函数: ${typeof viewer === 'function'}`);
    if (typeof viewer === 'function') {
      try {
        const testResult = viewer();
        console.log(`   函数调用结果类型: ${typeof testResult}, 有entities: ${!!(testResult?.entities)}`);
      } catch (e) {
        console.warn('   函数调用测试失败:', e.message);
      }
    } else if (typeof viewer === 'object') {
      console.log(`   对象有entities: ${!!(viewer?.entities)}`);
    }
    moduleLastNetworkData = networkData;
    
    const {
      showActive = true,
      showPending = true,
      showEnded = false,
      showBlocked = true,
      showFailed = false,
      maxPaths = 10
    } = options;
    
    let pathCount = 0;
    console.log('开始绘制路径，配置:', { showActive, showPending, showEnded, showBlocked, showFailed, maxPaths });
    console.log('绘制前的缓存业务ID数量:', moduleDrawnServiceIds.size);
    logCacheState('drawMultipleServicePaths开始前');
    
    // 绘制活跃业务路径
    if (showActive && services.active_requests) {
      console.log(`绘制活跃业务: ${services.active_requests.length} 条`);
      services.active_requests.slice(0, maxPaths - pathCount).forEach(service => {
        console.log('绘制活跃业务:', service.request_id);
        drawServicePath(viewer, service, networkData);
        pathCount++;
      });
    }
    
    // 绘制待处理业务路径
    if (showPending && services.pending_requests && pathCount < maxPaths) {
      console.log(`绘制待处理业务: ${services.pending_requests.length} 条`);
      services.pending_requests.slice(0, maxPaths - pathCount).forEach(service => {
        console.log('绘制待处理业务:', service.request_id);
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制阻塞业务路径
    if (showBlocked && services.blocked_requests && pathCount < maxPaths) {
      console.log(`绘制阻塞业务: ${services.blocked_requests.length} 条`);
      services.blocked_requests.slice(0, maxPaths - pathCount).forEach(service => {
        console.log('绘制阻塞业务:', service.request_id);
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制已结束业务路径
    if (showEnded && services.ended_requests && pathCount < maxPaths) {
      console.log(`绘制已结束业务: ${services.ended_requests.length} 条`);
      services.ended_requests.slice(0, maxPaths - pathCount).forEach(service => {
        console.log('绘制已结束业务:', service.request_id);
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制失败业务路径
    if (showFailed && services.failed_requests && pathCount < maxPaths) {
      console.log(`绘制失败业务: ${services.failed_requests.length} 条`);
      services.failed_requests.slice(0, maxPaths - pathCount).forEach(service => {
        console.log('绘制失败业务:', service.request_id);
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    console.log(`✅ 绘制了 ${pathCount} 条业务路径`);
    console.log('绘制后的缓存业务ID数量:', moduleDrawnServiceIds.size);
    console.log('绘制后的缓存业务ID列表:', Array.from(moduleDrawnServiceIds));
    logCacheState('drawMultipleServicePaths完成后');
  }

  // 根据缓存的业务ID重新绘制路径
  function redrawCachedServicePaths() {
    console.log('=== 开始重绘缓存的业务路径 ===');
    logCacheState('redrawCachedServicePaths开始时');
    
    const validViewer = getValidViewer();
    
    if (!validViewer || !moduleLastNetworkData || moduleDrawnServiceIds.size === 0) {
      console.warn('重新绘制路径失败: 缺少必要的缓存信息', {
        viewer: !!validViewer,
        networkData: !!moduleLastNetworkData,
        cachedIds: moduleDrawnServiceIds.size
      });
      return;
    }
    
    console.log(`开始重新绘制 ${moduleDrawnServiceIds.size} 条缓存的业务路径`);
    console.log('缓存的业务ID:', Array.from(moduleDrawnServiceIds));
    
    // 清除当前显示的路径
    const entities = validViewer.entities.values.slice();
    let clearedCount = 0;
    entities.forEach(entity => {
      if (entity.id && entity.id.startsWith('service-path-')) {
        validViewer.entities.remove(entity);
        clearedCount++;
      }
    });
    console.log(`清除了 ${clearedCount} 个旧的路径实体`);
    
    // 收集所有需要重新绘制的业务
    const servicesToRedraw = [];
    const cachedIds = Array.from(moduleDrawnServiceIds);
    
    // 从当前业务数据中查找缓存的业务ID
    const allRequests = [
      ...(serviceData.value.active_requests || []),
      ...(serviceData.value.pending_requests || []),
      ...(serviceData.value.ended_requests || []),
      ...(serviceData.value.blocked_requests || []),
      ...(serviceData.value.failed_requests || [])
    ];
    
    console.log('当前业务数据统计:', {
      active: serviceData.value.active_requests?.length || 0,
      pending: serviceData.value.pending_requests?.length || 0,
      ended: serviceData.value.ended_requests?.length || 0,
      blocked: serviceData.value.blocked_requests?.length || 0,
      failed: serviceData.value.failed_requests?.length || 0,
      total: allRequests.length
    });
    
    cachedIds.forEach(serviceId => {
      const service = allRequests.find(req => req.request_id === serviceId);
      if (service) {
        servicesToRedraw.push(service);
        console.log(`找到业务: ${serviceId} - 状态: ${service.status}`);
      } else {
        console.warn(`未找到业务ID: ${serviceId}，保留在缓存中等待业务数据更新`);
        // 不删除缓存的ID，可能是因为业务数据还没有更新
        // moduleDrawnServiceIds.delete(serviceId);
      }
    });
    
    console.log(`找到 ${servicesToRedraw.length} 个需要重绘的业务`);
    
    // 重新绘制找到的业务路径
    let successCount = 0;
    servicesToRedraw.forEach(service => {
      console.log(`重新绘制业务路径: ${service.request_id}`);
      
      // 根据业务状态确定颜色
      let color = null;
      if (serviceData.value.active_requests.includes(service)) {
        color = Cesium.Color.RED; // 活跃业务
      } else if (serviceData.value.pending_requests.includes(service)) {
        color = Cesium.Color.YELLOW; // 待处理业务
      } else if (serviceData.value.blocked_requests.includes(service)) {
        color = Cesium.Color.ORANGE; // 阻塞业务
      } else if (serviceData.value.ended_requests.includes(service)) {
        color = Cesium.Color.GRAY; // 已结束业务
      } else if (serviceData.value.failed_requests.includes(service)) {
        color = Cesium.Color.DARKRED; // 失败业务
      }
      
      // 绘制路径（不需要临时删除ID，drawServicePath会保持缓存）
      const pathEntity = drawServicePath(validViewer, service, moduleLastNetworkData, color);
      if (pathEntity) {
        successCount++;
      }
    });
    
    console.log(`重新绘制完成: 成功绘制 ${successCount}/${servicesToRedraw.length} 条路径`);
    logCacheState('redrawCachedServicePaths完成后');
    console.log('=== 重绘完成 ===');
  }

  // 手动绘制指定业务路径
  function drawSpecificServicePath(viewer, serviceId, networkData) {
    if (!viewer || !serviceId || !networkData) {
      console.warn('drawSpecificServicePath 缺少必要参数');
      return null;
    }
    
    // 从所有业务数据中查找指定的业务
    const allRequests = [
      ...(serviceData.value.active_requests || []),
      ...(serviceData.value.pending_requests || []),
      ...(serviceData.value.ended_requests || []),
      ...(serviceData.value.blocked_requests || []),
      ...(serviceData.value.failed_requests || [])
    ];
    
    const service = allRequests.find(req => req.request_id === serviceId);
    if (!service) {
      console.warn(`未找到业务ID: ${serviceId}`);
      return null;
    }
    
    // 根据业务状态确定颜色
    let color = null;
    if (serviceData.value.active_requests.includes(service)) {
      color = Cesium.Color.RED;
    } else if (serviceData.value.pending_requests.includes(service)) {
      color = Cesium.Color.YELLOW;
    } else if (serviceData.value.blocked_requests.includes(service)) {
      color = Cesium.Color.ORANGE;
    } else if (serviceData.value.ended_requests.includes(service)) {
      color = Cesium.Color.GRAY;
    } else if (serviceData.value.failed_requests.includes(service)) {
      color = Cesium.Color.DARKRED;
    }
    
    return drawServicePath(viewer, service, networkData, color);
  }

  // 当网络数据更新时重绘路径
  function updateNetworkDataAndRedraw(newNetworkData, viewer = null) {
    if (!newNetworkData) {
      console.warn('updateNetworkDataAndRedraw: 新网络数据为空');
      return;
    }
    
    console.log('=== 网络数据更新事件 ===');
    console.log('新网络数据节点数量:', newNetworkData.nodes?.length || 0);
    console.log('缓存的业务路径数量:', moduleDrawnServiceIds.size);
    console.log('缓存的业务ID列表:', Array.from(moduleDrawnServiceIds));
    console.log('传入的viewer:', !!viewer);
    console.log('传入viewer类型:', typeof viewer);
    console.log('传入viewer有entities:', !!(viewer?.entities));
    console.log('缓存的viewer状态:', !!moduleLastViewer);
    console.log('缓存的lastNetworkData状态:', !!moduleLastNetworkData);
    
    logCacheState('网络数据更新开始时');
    
    // 更新网络数据
    moduleLastNetworkData = newNetworkData;
    
    // 如果传入了viewer，更新缓存的viewer
    if (viewer) {
      moduleLastViewer = viewer;
      console.log(`📝 在网络数据更新中设置 moduleLastViewer - 类型: ${typeof viewer}, 是函数: ${typeof viewer === 'function'}`);
      if (typeof viewer === 'function') {
        try {
          const testResult = viewer();
          console.log(`   函数调用结果类型: ${typeof testResult}, 有entities: ${!!(testResult?.entities)}`);
        } catch (e) {
          console.warn('   函数调用测试失败:', e.message);
        }
      } else if (typeof viewer === 'object') {
        console.log(`   对象有entities: ${!!(viewer?.entities)}`);
      }
      console.log('更新了缓存的viewer');
    }
    
    // 获取有效的viewer
    const validViewer = getValidViewer(viewer);
    console.log('获取到的有效viewer:', !!validViewer);
    console.log('有效viewer类型:', typeof validViewer);
    
    // 详细检查重绘条件
    console.log('重绘条件检查:');
    console.log('- moduleDrawnServiceIds.size > 0:', moduleDrawnServiceIds.size > 0);
    console.log('- validViewer存在:', !!validViewer);
    console.log('- 综合判断:', moduleDrawnServiceIds.size > 0 && validViewer);
    
    // 如果有缓存的业务路径，立即重新绘制
    if (moduleDrawnServiceIds.size > 0 && validViewer) {
      console.log(`🔄 基于新网络数据重绘 ${moduleDrawnServiceIds.size} 条业务路径`);
      // 延迟一小段时间，确保业务数据有时间更新
      setTimeout(() => {
        redrawCachedServicePaths();
      }, 200);
    } else {
      console.log('❌ 没有需要重绘的业务路径或viewer不可用', {
        hasDrawnPaths: moduleDrawnServiceIds.size > 0,
        hasViewer: !!validViewer,
        drawnPathsCount: moduleDrawnServiceIds.size,
        validViewerType: typeof validViewer,
        drawnServiceIdsList: Array.from(moduleDrawnServiceIds)
      });
    }
  }

  return {
    serviceData,
    selectedService,
    loadServiceData,
    loadServiceDataFromFile,
    generateServiceId,
    selectService,
    closeServiceDetail,
    drawServicePath,
    clearServicePath,
    clearAllServicePaths,
    clearAllServicePathsAndCache,
    drawMultipleServicePaths,
    redrawCachedServicePaths,
    drawSpecificServicePath,
    updateNetworkDataAndRedraw,
    getValidViewer,
    clearServiceCache: () => serviceCache.clear(),
    getServiceCacheInfo: () => ({
      size: serviceCache.size(),
      keys: serviceCache.keys()
    }),
    // 新增的路径缓存管理功能
    getDrawnServiceIds: () => Array.from(moduleDrawnServiceIds),
    clearDrawnServiceIds: () => {
      console.log(`🗑️🗑️ 手动清除所有缓存的业务ID (共${moduleDrawnServiceIds.size}个)`);
      console.log('清除前缓存内容:', Array.from(moduleDrawnServiceIds));
      console.log('调用栈:', new Error().stack?.split('\n').slice(1,5).join('\n'));
      moduleDrawnServiceIds.clear();
      moduleLastDrawOptions = null;
      logCacheState('清除所有缓存后');
    },
    getDrawnServiceCount: () => moduleDrawnServiceIds.size,
    isServiceDrawn: (serviceId) => moduleDrawnServiceIds.has(serviceId),
    // 调试函数
    logCacheState
  };
}