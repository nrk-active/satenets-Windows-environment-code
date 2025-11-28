// src/composables/useDataLoader.js
// 卫星网络仿真系统的数据加载与缓存管理
// 根据用户登录状态自动选择数据源，未登录时从本地文件夹加载仿真数据，已登录时通过 API 请求后端仿真快照数据
// 加载的数据会结构化处理，并自动统计当前帧的节点数和链路数，便于界面展示和性能分析

import { ref, inject } from 'vue';
import { processGraphData } from '../utils/dataProcessors.js';
import { useAuth } from './useAuth.js';
import { useApi } from './useApi.js';
import { LRUCache } from '../utils/lruCache.js';
import { CACHE_CONFIG } from '../constants/index.js';

// 🔥 关键修复：全局单例状态，确保所有组件共享同一个文件夹设置
const globalSelectedDataFolder = ref(null);
const globalDataCache = new LRUCache(CACHE_CONFIG.MAX_NETWORK_CACHE);

export function useDataLoader() {
  const nodeCount = ref(0);
  const linkCount = ref(0);
  
  // 🔥 使用全局缓存，而不是每次创建新的
  const dataCache = globalDataCache;
  
  // 获取认证和API工具
  const { getTokens } = useAuth();
  const { getCsrfToken } = useApi();

  // 🔥 使用全局状态，确保所有组件共享同一个文件夹设置
  const selectedDataFolder = globalSelectedDataFolder;

  // 设置数据文件夹
  function setDataFolder(folderName) {
    selectedDataFolder.value = folderName;
    // 保存到本地存储
    localStorage.setItem('selectedDataFolder', folderName);
    console.log(`✅ 数据文件夹已设置为: ${folderName} (全局状态)`);
  }

  // 从本地存储恢复文件夹设置
  function restoreDataFolderSetting() {
    const savedFolder = localStorage.getItem('selectedDataFolder');
    if (savedFolder) {
      selectedDataFolder.value = savedFolder;
      console.log(`✅ 从本地存储恢复数据文件夹设置: ${savedFolder} (全局状态)`);
    } else {
      console.log('⚠️ 未找到保存的文件夹设置');
    }
  }

  // 获取当前选择的数据文件夹
  function getCurrentDataFolder() {
    const folder = selectedDataFolder.value;
    console.log(`📁 getCurrentDataFolder 返回: ${folder} (全局状态)`);
    return folder; // 返回null如果没有设置
  }

  // 检查登录状态的函数
  function isLoggedIn() {
    try {
      // 尝试获取注入的登录状态
      const isLoggedInRef = inject('isLoggedIn', null);
      if (isLoggedInRef && isLoggedInRef.value !== undefined) {
        return isLoggedInRef.value;
      }
      
      // 如果注入失败，检查本地存储
      const userCredentials = localStorage.getItem('userCredentials');
      const tokens = getTokens();
      return !!(userCredentials && tokens.access);
    } catch (error) {
      console.warn('检查登录状态失败:', error);
      return false;
    }
  }

  // 新的API数据加载函数（智能切换数据源）
  async function loadGraphDataFromAPI(simulatorId, timestamp) {
    // 检查登录状态，如果未登录则从本地文件加载
    const loginStatus = isLoggedIn();
    // console.log(`=== loadGraphDataFromAPI 被调用 ===`);
    // console.log(`登录状态: ${loginStatus}`);
    // console.log(`进程ID: ${simulatorId}, 时间戳: ${timestamp}`);
    
    if (!loginStatus) {
      // console.log('用户未登录，从本地文件加载数据');
      
      // 检查是否已选择文件夹
      if (!selectedDataFolder.value) {
        // console.warn('未选择数据文件夹，请先选择文件夹');
        return null;
      }
      
      // 将时间戳转换为文件名格式，使用当前选择的文件夹
      const filename = `./data/${selectedDataFolder.value}/network_state_${timestamp}.00.json`;
      // // console.log(`从本地文件加载: ${filename}`);
      
      // 使用本地文件加载方法
      return await loadGraphData(filename);
    }
    
    // 用户已登录，使用API加载
    // console.log('用户已登录，从API加载数据');
    return await loadGraphDataFromAPIInternal(simulatorId, timestamp);
  }

  // 内部API数据加载函数（原来的loadGraphDataFromAPI逻辑）
  async function loadGraphDataFromAPIInternal(simulatorId, timestamp) {
    try {
      const cacheKey = `api_${simulatorId}_${timestamp}`;
      // console.log(`=== 开始加载API数据 ===`);
      // console.log(`进程ID: ${simulatorId}, 时间戳: ${timestamp}`);
      console.time(`加载API数据:${cacheKey}`);
      
      if (dataCache.has(cacheKey)) {
        // console.log("使用缓存的API数据");
        return dataCache.get(cacheKey);
      }

      // 获取CSRF Token
      // console.log('正在获取CSRF Token...')
      const csrfToken = await getCsrfToken();
      // console.log('CSRF Token获取成功');
      
      // 获取认证信息
      const tokens = getTokens();
      const userCredentials = JSON.parse(localStorage.getItem('userCredentials') || '{}');
      // console.log('认证tokens:', tokens);
      
      // 准备请求头
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      };
      
      // 如果有Authorization token，添加到请求头
      if (tokens.access) {
        headers['Authorization'] = `Bearer ${tokens.access}`;
        // console.log('已添加Authorization头');
      } else {
        console.warn('没有access token，可能会导致认证失败');
      }
    
      
      // const url = `http://127.0.0.1:8000/api/simulations/simulators/${simulatorId}/data/network-state/?timestamp=${timestamp}`;
      const url = `http://127.0.0.1:8000/api/simulations/simulators/${simulatorId}/data/snapshot/?timestamp=${timestamp}`;
      
      // console.log('请求URL:', url);
      // console.log('请求头:', headers);
      
      // console.log('发送API请求...');
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: headers,
      });
      
      // console.log('API响应状态:', response.status);
      
      // 检查特定的错误响应
      if (!response.ok) {
        const errorData = await response.json();
        // console.log('API错误响应:', errorData);
        
        if (errorData.detail === "No ControlSimulator matches the given query.") {
          // 弹出特定提示
          alert("当前进程启动仿真");
          return null;
        }
        
        throw new Error(`加载API数据失败: ${response.status} ${response.statusText}`);
      }
      
      // 修复：处理 JSON 中的 Infinity 值
      const rawText = await response.text();
      const sanitizedText = rawText
        .replace(/:\s*Infinity/g, ': null')  // 将 Infinity 替换为 null
        .replace(/:\s*-Infinity/g, ': null'); // 将 -Infinity 替换为 null
      const rawData = JSON.parse(sanitizedText);
      
      // console.log('API数据加载成功:', rawData);
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
      
      if (dataCache.has(filename)) {
        // console.log("使用缓存的数据");
        return dataCache.get(filename);
      }
      
      const response = await fetch(filename);
      if (!response.ok) {
        throw new Error(`加载数据失败: ${response.status} ${response.statusText}`);
      }
      
      // 修复：处理 JSON 中的 Infinity 值
      const rawText = await response.text();
      const sanitizedText = rawText
        .replace(/:\s*Infinity/g, ': null')  // 将 Infinity 替换为 null
        .replace(/:\s*-Infinity/g, ': null'); // 将 -Infinity 替换为 null
      const rawData = JSON.parse(sanitizedText);

  
      const processedData = processGraphData(rawData);
      
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
    dataCache,
    clearCache: () => dataCache.clear(),
    getCacheInfo: () => ({
      size: dataCache.size(),
      keys: dataCache.keys()
    }),
    // 新增的文件夹管理功能
    setDataFolder,
    getCurrentDataFolder,
    restoreDataFolderSetting,
    selectedDataFolder
  };
}