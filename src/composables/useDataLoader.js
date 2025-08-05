// src/composables/useDataLoader.js
import { ref, inject } from 'vue';
import { processGraphData } from '../utils/dataProcessors.js';
import { useAuth } from './useAuth.js';
import { useApi } from './useApi.js';

export function useDataLoader() {
  const nodeCount = ref(0);
  const linkCount = ref(0);
  const dataCache = new Map();
  
  // 获取认证和API工具
  const { getTokens } = useAuth();
  const { getCsrfToken } = useApi();

  // 新的API数据加载函数
  async function loadGraphDataFromAPI(simulatorId, timestamp) {
    try {
      const cacheKey = `api_${simulatorId}_${timestamp}`;
      console.log(`=== 开始加载API数据 ===`);
      console.log(`进程ID: ${simulatorId}, 时间戳: ${timestamp}`);
      console.time(`加载API数据:${cacheKey}`);
      
      if (dataCache.has(cacheKey)) {
        console.log("使用缓存的API数据");
        return dataCache.get(cacheKey);
      }

      // 获取CSRF Token
      console.log('正在获取CSRF Token...')
      const csrfToken = await getCsrfToken();
      console.log('CSRF Token获取成功');
      
      // 获取认证信息
      const tokens = getTokens();
      const userCredentials = JSON.parse(localStorage.getItem('userCredentials') || '{}');
      console.log('认证tokens:', tokens);
      
      // 准备请求头
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      };
      
      // 如果有Authorization token，添加到请求头
      if (tokens.access) {
        headers['Authorization'] = `Bearer ${tokens.access}`;
        console.log('已添加Authorization头');
      } else {
        console.warn('没有access token，可能会导致认证失败');
      }
    
      
      // const url = `http://127.0.0.1:8000/api/simulations/simulators/${simulatorId}/data/network-state/?timestamp=${timestamp}`;
      const url = `http://127.0.0.1:8000/api/simulations/simulators/${simulatorId}/data/snapshot/?timestamp=${timestamp}`;
      
      console.log('请求URL:', url);
      console.log('请求头:', headers);
      
      console.log('发送API请求...');
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: headers,
      });
      
      console.log('API响应状态:', response.status);
      
      // 检查特定的错误响应
      if (!response.ok) {
        const errorData = await response.json();
        console.log('API错误响应:', errorData);
        
        if (errorData.detail === "No ControlSimulator matches the given query.") {
          // 弹出特定提示
          alert("当前进程启动仿真");
          return null;
        }
        
        throw new Error(`加载API数据失败: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('API数据加载成功:', rawData);
      console.timeEnd(`加载API数据:${cacheKey}`);
      
      console.time('处理API数据');
      const processedData = processGraphData(rawData);
      console.timeEnd('处理API数据');
      
      // 更新节点和边的计数
      nodeCount.value = processedData.nodes.length;
      linkCount.value = processedData.edges.length;
      
      // 缓存数据
      dataCache.set(cacheKey, processedData);
      
      return processedData;
    } catch (error) {
      console.error(`加载API数据失败:`, error);
      
      // 如果错误信息包含特定内容，也弹出提示
      if (error.message && error.message.includes("No ControlSimulator matches the given query.")) {
        alert("当前进程启动仿真");
      }
      
      return null;
    }
  }

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
    loadGraphDataFromAPI,
    dataCache
  };
}