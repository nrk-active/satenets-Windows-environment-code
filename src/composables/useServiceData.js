// src/composables/useServiceData.js
import { ref } from 'vue';
import * as Cesium from 'cesium';

export function useServiceData() {
  const serviceData = ref({
    active_requests: [],
    pending_requests: [],
    ended_requests: [],
    blocked_requests: [],
    failed_requests: []
  });
  
  const selectedService = ref(null);
  const serviceCache = new Map();

  async function loadServiceData(frame) {
    try {
      const filename = `./data/service_state_${frame * 60}.00.json`;
      
      console.log(`正在加载业务数据文件: ${filename}`);
      
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
      const data = JSON.parse(fixedJsonText);
      
      // 验证数据结构
      const processedData = {
        active_requests: data.active_requests || [],
        pending_requests: data.pending_requests || [],
        ended_requests: data.ended_requests || [],
        blocked_requests: data.blocked_requests || [],
        failed_requests: data.failed_requests || []
      };
      
      serviceData.value = processedData;
      serviceCache.set(filename, processedData);
      
      console.log(`业务数据加载成功 (${filename}):`, {
        active: processedData.active_requests.length,
        pending: processedData.pending_requests.length,
        ended: processedData.ended_requests.length,
        blocked: processedData.blocked_requests.length,
        failed: processedData.failed_requests.length
      });
      
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

  // 绘制业务路径
  function drawServicePath(viewer, service, networkData, pathColor = null) {
    if (!viewer || !service || !service.path || !networkData) return null;
    
    const servicePath = service.path;
    if (servicePath.length < 2) return null;
    
    // 清除之前的路径
    clearServicePath(viewer, service.request_id);
    
    // 获取路径节点位置
    const positions = [];
    const validNodes = [];
    
    servicePath.forEach(nodeId => {
      const node = networkData.nodes.find(n => n.id === nodeId);
      if (node) {
        let position;
        if (node.type === 'satellite') {
          // 卫星节点使用3D坐标
          position = new Cesium.Cartesian3(
            parseFloat(node.position[0]) * 1000,
            parseFloat(node.position[1]) * 1000,
            parseFloat(node.position[2]) * 1000
          );
        } else {
          // 地面节点使用经纬度
          position = Cesium.Cartesian3.fromDegrees(
            parseFloat(node.position[0]),
            parseFloat(node.position[1]),
            node.type === 'station' ? 10 : 10
          );
        }
        positions.push(position);
        validNodes.push(node);
      }
    });
    
    if (positions.length < 2) return null;
    
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
    
    // 创建路径线
    const pathEntity = viewer.entities.add({
      id: `service-path-${service.request_id}`,
      name: `业务路径: ${service.request_id}`,
      polyline: {
        positions: positions,
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
    
    // 在路径节点上添加标记点
    validNodes.forEach((node, index) => {
      if (index === 0 || index === validNodes.length - 1) {
        // 只在起点和终点添加特殊标记
        const isSource = index === 0;
        viewer.entities.add({
          id: `service-path-${service.request_id}-marker-${index}`,
          position: positions[index],
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
  function clearServicePath(viewer, serviceId) {
    if (!viewer) return;
    
    const pathId = `service-path-${serviceId}`;
    const pathEntity = viewer.entities.getById(pathId);
    if (pathEntity) {
      viewer.entities.remove(pathEntity);
    }
    
    // 清除路径标记点
    const entities = viewer.entities.values.slice();
    entities.forEach(entity => {
      if (entity.id && entity.id.startsWith(`service-path-${serviceId}-marker-`)) {
        viewer.entities.remove(entity);
      }
    });
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
  }

  // 批量绘制业务路径
  function drawMultipleServicePaths(viewer, services, networkData, options = {}) {
    if (!viewer || !services || !networkData) return;
    
    const {
      showActive = true,
      showPending = true,
      showEnded = false,
      showBlocked = true,
      showFailed = false,
      maxPaths = 10
    } = options;
    
    let pathCount = 0;
    
    // 绘制活跃业务路径
    if (showActive && services.active_requests) {
      services.active_requests.slice(0, maxPaths - pathCount).forEach(service => {
        drawServicePath(viewer, service, networkData);
        pathCount++;
      });
    }
    
    // 绘制待处理业务路径
    if (showPending && services.pending_requests && pathCount < maxPaths) {
      services.pending_requests.slice(0, maxPaths - pathCount).forEach(service => {
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制阻塞业务路径
    if (showBlocked && services.blocked_requests && pathCount < maxPaths) {
      services.blocked_requests.slice(0, maxPaths - pathCount).forEach(service => {
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制已结束业务路径
    if (showEnded && services.ended_requests && pathCount < maxPaths) {
      services.ended_requests.slice(0, maxPaths - pathCount).forEach(service => {
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    // 绘制失败业务路径
    if (showFailed && services.failed_requests && pathCount < maxPaths) {
      services.failed_requests.slice(0, maxPaths - pathCount).forEach(service => {
        drawServicePath(viewer, service, networkData, Cesium.Color.RED);
        pathCount++;
      });
    }
    
    console.log(`绘制了 ${pathCount} 条业务路径`);
  }

  return {
    serviceData,
    selectedService,
    loadServiceData,
    generateServiceId,
    selectService,
    closeServiceDetail,
    drawServicePath,
    clearServicePath,
    clearAllServicePaths,
    drawMultipleServicePaths
  };
}