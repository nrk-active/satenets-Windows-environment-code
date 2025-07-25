// src/composables/useDataLoader.js
import { ref } from 'vue';
import { processGraphData } from '../utils/dataProcessors.js';

export function useDataLoader() {
  const nodeCount = ref(0);
  const linkCount = ref(0);
  const dataCache = new Map();

  async function loadGraphData(filename) {
    try {
      console.time(`加载文件:${filename}`);
      
      if (dataCache.has(filename)) {
        console.log("使用缓存的数据");
        return dataCache.get(filename);
      }
      
      const response = await fetch(filename);
      if (!response.ok) {
        throw new Error(`加载数据失败: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.timeEnd(`加载文件:${filename}`);
      
      console.time('处理数据');
      const processedData = processGraphData(rawData);
      console.timeEnd('处理数据');
      
      // 更新节点和边的计数
      nodeCount.value = processedData.nodes.length;
      linkCount.value = processedData.edges.length;
      
      // 缓存数据
      dataCache.set(filename, processedData);
      
      return processedData;
    } catch (error) {
      console.error(`加载数据失败:`, error);
      return null;
    }
  }

  return {
    nodeCount,
    linkCount,
    loadGraphData,
    dataCache
  };
}