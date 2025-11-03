// src/composables/useServiceData.js
import { ref } from 'vue';

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
      
      // console.log(`正在加载业务数据文件: ${filename}`);
      
      if (serviceCache.has(filename)) {
        const cachedData = serviceCache.get(filename);
        serviceData.value = cachedData;
        // console.log("使用缓存的业务数据:", cachedData);
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
      
      // console.log(`业务数据加载成功 (${filename}):`, {
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
    // console.log("选择业务:", service);
  }

  function closeServiceDetail() {
    selectedService.value = null;
  }

  return {
    serviceData,
    selectedService,
    loadServiceData,
    generateServiceId,
    selectService,
    closeServiceDetail
  };
}