<template>
  <div class="chart-panel">
    <div class="panel-header">
      <h3>仿真结果图表</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="panel-content">
      <div class="chart-container">
        <!-- 平均延迟图表 -->
        <div v-if="selectedData.averageLatency" class="chart-item">
          <h4>平均延迟</h4>
          <div ref="latencyChart" class="chart"></div>
        </div>
        
        <!-- 带宽利用率图表 -->
        <div v-if="selectedData.bandwidthUtil" class="chart-item">
          <h4>带宽利用率</h4>
          <div ref="bandwidthChart" class="chart"></div>
        </div>
        
        <!-- 平均跳数图表 -->
        <div v-if="selectedData.hopCounts" class="chart-item">
          <h4>平均跳数</h4>
          <div ref="hopChart" class="chart"></div>
        </div>
        
        <!-- 链路长度图表 - 业务数量 -->
        <div v-if="selectedData.linkLength" class="chart-item">
          <h4>链路业务数量</h4>
          <div ref="linkLengthServiceCountChart" class="chart"></div>
        </div>
        
        <!-- 链路长度图表 - 最大距离 -->
        <div v-if="selectedData.linkLength" class="chart-item">
          <h4>链路最大距离</h4>
          <div ref="linkLengthMaxDistanceChart" class="chart"></div>
        </div>
        
        <!-- 链路长度图表 - 最小距离 -->
        <div v-if="selectedData.linkLength" class="chart-item">
          <h4>链路最小距离</h4>
          <div ref="linkLengthMinDistanceChart" class="chart"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  selectedData: {
    type: Object,
    required: true
  },
  currentFrameData: {
    type: Object,
    default: null
  },
  timeFrame: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['close']);

// 图表实例引用
const latencyChart = ref(null);
const bandwidthChart = ref(null);
const hopChart = ref(null);
const linkLengthServiceCountChart = ref(null);
const linkLengthMaxDistanceChart = ref(null);
const linkLengthMinDistanceChart = ref(null);

// ECharts实例
let latencyChartInstance = null;
let bandwidthChartInstance = null;
let hopChartInstance = null;
let linkLengthServiceCountChartInstance = null;
let linkLengthMaxDistanceChartInstance = null;
let linkLengthMinDistanceChartInstance = null;

// 存储历史数据（最多保留10个切片）
const historyData = ref({
  timestamps: [], // 时间戳
  latency: [], // 平均延迟数据
  bandwidthUtil: {  // 带宽利用率数据（替换blocking）
    overall: [],     // 总利用率
    isl_inter: [],   // 星间同轨链路
    isl_intra: [],   // 星间异轨链路
    sgl: [],         // 星地链路
    grl: [],         // 地面站-ROADM链路
    backbone: []     // 骨干网
  },
  hop: [], // 平均跳数数据
  linkLength: {  // 链路长度数据（按大洲分类，三个指标）
    serviceCount: {  // 业务数量
      Africa: [],
      'South America': [],
      Oceania: [],
      'Southeast Asia': [],
      Europe: [],
      'North America': [],
      'Middle East': []
    },
    maxDistance: {  // 最大距离
      Africa: [],
      'South America': [],
      Oceania: [],
      'Southeast Asia': [],
      Europe: [],
      'North America': [],
      'Middle East': []
    },
    minDistance: {  // 最小距离
      Africa: [],
      'South America': [],
      Oceania: [],
      'Southeast Asia': [],
      Europe: [],
      'North America': [],
      'Middle East': []
    }
  }
});

// 解析文件夹名称格式：{类型}_{切片间隔}_{总时长}
const parseFolderName = (folderName) => {
  // 默认配置
  const defaultConfig = {
    type: 'unknown',
    interval: 60,  // 秒
    totalDuration: 360 // 秒
  };
  
  if (!folderName) {
    return defaultConfig;
  }
  
  // 尝试解析新格式：如 "old_60s_360s"
  const newFormatMatch = folderName.match(/^(\w+)_(\d+)s_(\d+)s$/);
  if (newFormatMatch) {
    const [, type, intervalStr, durationStr] = newFormatMatch;
    return {
      type: type,
      interval: parseInt(intervalStr, 10),
      totalDuration: parseInt(durationStr, 10)
    };
  }
  
  // 兼容老格式
  if (folderName === 'new') {
    return { type: 'new', interval: 10, totalDuration: 3600 };
  } else if (folderName === 'old') {
    return { type: 'old', interval: 60, totalDuration: 360 };
  }
  
  return defaultConfig;
};

// 加载链路长度数据
const loadLinkLengthData = async (frame) => {
  try {
    // 根据当前选择的文件夹读取对应的链路长度数据
    const currentFolder = localStorage.getItem('selectedDataFolder');
    const orbitNumber = String(frame).padStart(6, '0');
    const filename = `./data/${currentFolder}/link_length/isl_inter_stats_orbit_${orbitNumber}.json`;
    
    console.log(`ChartPanel: 从文件夹 ${currentFolder} 加载链路长度数据:`, filename);
    
    const response = await fetch(filename);
    if (!response.ok) {
      console.warn(`ChartPanel: 无法加载链路长度数据: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('ChartPanel: 链路长度数据加载成功', data);
    
    // 提取各大洲的三个指标：业务数量、最大距离、最小距离
    const areaStats = data.area_interorbit_statistics || {};
    const linkLengthData = {
      serviceCount: {},
      maxDistance: {},
      minDistance: {}
    };
    
    Object.keys(areaStats).forEach(area => {
      const stats = areaStats[area];
      linkLengthData.serviceCount[area] = stats.service_count || 0;
      linkLengthData.maxDistance[area] = stats.max_distance || 0;
      linkLengthData.minDistance[area] = stats.min_distance || 0;
    });
    
    console.log('ChartPanel: 处理后的链路长度数据', linkLengthData);
    return linkLengthData;
  } catch (error) {
    console.error('ChartPanel: 加载链路长度数据失败', error);
    return null;
  }
};

// 从网络数据计算仿真指标
const calculateMetricsFromData = (networkData) => {
  if (!networkData) {
    console.warn('ChartPanel: 网络数据为空');
    return {
      latency: 0,
      blocking: 0,
      hop: 0
    };
  }

  console.log('ChartPanel: 处理网络数据', networkData);

  // 优先从服务数据文件的network_statistics字段读取真实指标
  const stats = networkData.network_statistics;
  if (stats) {
    console.log('ChartPanel: 使用network_statistics数据', stats);
    
    const latency = parseFloat(stats.average_latency) || 0;
    const hop = parseFloat(stats.average_hop_count) || 0;
    
    // 提取带宽利用率数据（包含六种不同类型的链路）
    const bandwidthData = stats.bandwidth_utilization_by_type || {};
    const bandwidthUtil = {
      overall: parseFloat(bandwidthData.overall || 0) * 100,        // 总利用率
      isl_inter: parseFloat(bandwidthData.ISL_INTER || 0) * 100,    // 星间同轨链路
      isl_intra: parseFloat(bandwidthData.ISL_INTRA || 0) * 100,    // 星间异轨链路  
      sgl: parseFloat(bandwidthData.SGL || 0) * 100,                // 星地链路
      grl: parseFloat(bandwidthData.GRL || 0) * 100,                // 地面站-ROADM链路
      backbone: parseFloat(bandwidthData.BACKBONE || 0) * 100      // 骨干网
    };
    
    console.log('ChartPanel: 带宽利用率详细数据', {
      原始带宽数据: bandwidthData,
      转换后: bandwidthUtil,
      时间戳: networkData.timestamp
    });
    
    const result = {
      latency: latency,
      bandwidthUtil: bandwidthUtil,  // 替换原来的blocking字段
      hop: hop
    };
    
    console.log('ChartPanel: 从network_statistics计算结果', {
      原始数据: { 
        平均时延: latency, 
        带宽利用率原始数据: bandwidthData, 
        平均跳数: hop 
      },
      转换结果: { 
        平均时延: result.latency + 'ms', 
        带宽利用率: bandwidthUtil, 
        平均跳数: result.hop 
      }
    });
    
    return result;
  }

  // 如果没有network_statistics，则从图数据计算
  const graphData = networkData.data;
  if (!graphData) {
    console.warn('ChartPanel: 无图数据结构');
    return { latency: 0, bandwidthUtil: { overall: 0, isl_inter: 0, isl_intra: 0, sgl: 0, grl: 0, backbone: 0 }, hop: 0 };
  }

  // 处理图节点和边数据
  let nodes = [];
  let edges = [];

  if (graphData.graph_nodes) {
    nodes = Object.values(graphData.graph_nodes);
  } else if (networkData.nodes) {
    nodes = networkData.nodes;
  }

  if (graphData.graph_edges) {
    edges = Object.values(graphData.graph_edges);
  } else if (networkData.edges) {
    edges = networkData.edges;
  }

  console.log('ChartPanel: 节点数量', nodes.length, '边数量', edges.length);

  // 计算平均延迟
  let totalLatency = 0;
  let activeEdges = 0;
  
  edges.forEach(edge => {
    // 处理可能的数字或字符串类型的延迟值
    const latencyValue = edge.latency_ms !== undefined ? edge.latency_ms : edge.latency;
    
    if (latencyValue !== undefined && latencyValue !== null) {
      try {
        const parsedValue = parseFloat(latencyValue);
        if (!isNaN(parsedValue)) {
          totalLatency += parsedValue;
          activeEdges++;
        }
      } catch (error) {
        console.warn('ChartPanel: 无法解析延迟值', { value: latencyValue, error });
      }
    }
  });

  const avgLatency = activeEdges > 0 ? totalLatency / activeEdges : 0;

  // 计算阻塞率（基于边的状态）
  const totalEdges = edges.length;
  const blockedEdges = edges.filter(edge => 
    edge.congested === true || edge.blocked === true || edge.status === 'blocked'
  ).length;
  const blockingRate = totalEdges > 0 ? (blockedEdges / totalEdges) * 100 : 0;

  // 计算平均跳数（基于网络拓扑复杂度）
  const satelliteNodes = nodes.filter(n => 
    n.type === 'satellite' || (n.object && n.object.includes('Satellite'))
  ).length;
  const avgHop = satelliteNodes > 0 ? Math.log2(satelliteNodes) + 2 : 3;

  const result = {
    latency: Math.max(0, avgLatency),
    bandwidthUtil: { overall: 0, isl_inter: 0, isl_intra: 0, sgl: 0, grl: 0, backbone: 0 },
    hop: Math.max(1, avgHop)
  };

  console.log('ChartPanel: 从图数据计算结果', result);
  return result;
};

// 添加新的数据点
const addDataPoint = async (frame, networkData) => {
  try {
    console.log('ChartPanel: addDataPoint调用', { frame, hasData: !!networkData });
    
    if (!networkData) {
      console.warn('ChartPanel: 网络数据为空，跳过添加数据点');
      return;
    }
    
    // 确保frame是有效的数字
    const frameNumber = Number(frame);
    if (isNaN(frameNumber)) {
      console.error('ChartPanel: 无效的帧数:', frame);
      return;
    }
  
  // 从网络数据中获取时间戳
  let timestamp = networkData.timestamp;
  if (timestamp === undefined) {
    console.warn('ChartPanel: 网络数据中没有时间戳信息，使用帧号计算');
    // 如果没有时间戳，根据帧号和文件夹类型计算
    const currentFolder = localStorage.getItem('selectedDataFolder') || 'new';
    timestamp = currentFolder === 'new' ? frame * 10 : frame * 60;
  }
  
  const metrics = calculateMetricsFromData(networkData);
  
  // 加载链路长度数据
  const linkLengthData = await loadLinkLengthData(frameNumber);
  
  // 检查是否已存在相同时间戳的数据
  const existingIndex = historyData.value.timestamps.indexOf(timestamp);
  if (existingIndex !== -1) {
    // 更新现有数据
    historyData.value.latency[existingIndex] = metrics.latency;
    // 更新带宽利用率的各个字段
    if (metrics.bandwidthUtil) {
      historyData.value.bandwidthUtil.overall[existingIndex] = metrics.bandwidthUtil.overall;
      historyData.value.bandwidthUtil.isl_inter[existingIndex] = metrics.bandwidthUtil.isl_inter;
      historyData.value.bandwidthUtil.isl_intra[existingIndex] = metrics.bandwidthUtil.isl_intra;
      historyData.value.bandwidthUtil.sgl[existingIndex] = metrics.bandwidthUtil.sgl;
      historyData.value.bandwidthUtil.grl[existingIndex] = metrics.bandwidthUtil.grl;
      historyData.value.bandwidthUtil.backbone[existingIndex] = metrics.bandwidthUtil.backbone;
    }
    historyData.value.hop[existingIndex] = metrics.hop;
    // 更新链路长度数据（三个指标）
    if (linkLengthData) {
      const areas = ['Africa', 'South America', 'Oceania', 'Southeast Asia', 'Europe', 'North America', 'Middle East'];
      areas.forEach(area => {
        historyData.value.linkLength.serviceCount[area][existingIndex] = linkLengthData.serviceCount[area] || 0;
        historyData.value.linkLength.maxDistance[area][existingIndex] = linkLengthData.maxDistance[area] || 0;
        historyData.value.linkLength.minDistance[area][existingIndex] = linkLengthData.minDistance[area] || 0;
      });
    }
    console.log('ChartPanel: 更新现有数据点', { timestamp, metrics, linkLengthData });
  } else {
    // 添加新数据
    historyData.value.timestamps.push(timestamp);
    historyData.value.latency.push(metrics.latency);
    // 添加带宽利用率的各个字段
    if (metrics.bandwidthUtil) {
      historyData.value.bandwidthUtil.overall.push(metrics.bandwidthUtil.overall);
      historyData.value.bandwidthUtil.isl_inter.push(metrics.bandwidthUtil.isl_inter);
      historyData.value.bandwidthUtil.isl_intra.push(metrics.bandwidthUtil.isl_intra);
      historyData.value.bandwidthUtil.sgl.push(metrics.bandwidthUtil.sgl);
      historyData.value.bandwidthUtil.grl.push(metrics.bandwidthUtil.grl);
      historyData.value.bandwidthUtil.backbone.push(metrics.bandwidthUtil.backbone);
    }
    historyData.value.hop.push(metrics.hop);
    // 添加链路长度数据（三个指标）
    const areas = ['Africa', 'South America', 'Oceania', 'Southeast Asia', 'Europe', 'North America', 'Middle East'];
    if (linkLengthData) {
      areas.forEach(area => {
        historyData.value.linkLength.serviceCount[area].push(linkLengthData.serviceCount[area] || 0);
        historyData.value.linkLength.maxDistance[area].push(linkLengthData.maxDistance[area] || 0);
        historyData.value.linkLength.minDistance[area].push(linkLengthData.minDistance[area] || 0);
      });
    } else {
      // 如果没有数据，添加0
      areas.forEach(area => {
        historyData.value.linkLength.serviceCount[area].push(0);
        historyData.value.linkLength.maxDistance[area].push(0);
        historyData.value.linkLength.minDistance[area].push(0);
      });
    }
    console.log('ChartPanel: 添加新数据点', { timestamp, metrics, linkLengthData });
    
    // 按时间戳排序所有数据
    const combined = historyData.value.timestamps.map((ts, index) => ({
      timestamp: ts,
      latency: historyData.value.latency[index],
      bandwidthUtil: {
        overall: historyData.value.bandwidthUtil.overall[index],
        isl_inter: historyData.value.bandwidthUtil.isl_inter[index],
        isl_intra: historyData.value.bandwidthUtil.isl_intra[index],
        sgl: historyData.value.bandwidthUtil.sgl[index],
        grl: historyData.value.bandwidthUtil.grl[index],
        backbone: historyData.value.bandwidthUtil.backbone[index]
      },
      hop: historyData.value.hop[index],
      linkLength: {
        serviceCount: {
          Africa: historyData.value.linkLength.serviceCount.Africa[index],
          'South America': historyData.value.linkLength.serviceCount['South America'][index],
          Oceania: historyData.value.linkLength.serviceCount.Oceania[index],
          'Southeast Asia': historyData.value.linkLength.serviceCount['Southeast Asia'][index],
          Europe: historyData.value.linkLength.serviceCount.Europe[index],
          'North America': historyData.value.linkLength.serviceCount['North America'][index],
          'Middle East': historyData.value.linkLength.serviceCount['Middle East'][index]
        },
        maxDistance: {
          Africa: historyData.value.linkLength.maxDistance.Africa[index],
          'South America': historyData.value.linkLength.maxDistance['South America'][index],
          Oceania: historyData.value.linkLength.maxDistance.Oceania[index],
          'Southeast Asia': historyData.value.linkLength.maxDistance['Southeast Asia'][index],
          Europe: historyData.value.linkLength.maxDistance.Europe[index],
          'North America': historyData.value.linkLength.maxDistance['North America'][index],
          'Middle East': historyData.value.linkLength.maxDistance['Middle East'][index]
        },
        minDistance: {
          Africa: historyData.value.linkLength.minDistance.Africa[index],
          'South America': historyData.value.linkLength.minDistance['South America'][index],
          Oceania: historyData.value.linkLength.minDistance.Oceania[index],
          'Southeast Asia': historyData.value.linkLength.minDistance['Southeast Asia'][index],
          Europe: historyData.value.linkLength.minDistance.Europe[index],
          'North America': historyData.value.linkLength.minDistance['North America'][index],
          'Middle East': historyData.value.linkLength.minDistance['Middle East'][index]
        }
      }
    }));
    
    // 按时间戳升序排序
    combined.sort((a, b) => a.timestamp - b.timestamp);
    
    // 重新分配排序后的数据
    historyData.value.timestamps = combined.map(item => item.timestamp);
    historyData.value.latency = combined.map(item => item.latency);
    historyData.value.bandwidthUtil.overall = combined.map(item => item.bandwidthUtil.overall);
    historyData.value.bandwidthUtil.isl_inter = combined.map(item => item.bandwidthUtil.isl_inter);
    historyData.value.bandwidthUtil.isl_intra = combined.map(item => item.bandwidthUtil.isl_intra);
    historyData.value.bandwidthUtil.sgl = combined.map(item => item.bandwidthUtil.sgl);
    historyData.value.bandwidthUtil.grl = combined.map(item => item.bandwidthUtil.grl);
    historyData.value.bandwidthUtil.backbone = combined.map(item => item.bandwidthUtil.backbone);
    historyData.value.hop = combined.map(item => item.hop);
    // 重新分配链路长度数据（三个指标）
    historyData.value.linkLength.serviceCount.Africa = combined.map(item => item.linkLength.serviceCount.Africa);
    historyData.value.linkLength.serviceCount['South America'] = combined.map(item => item.linkLength.serviceCount['South America']);
    historyData.value.linkLength.serviceCount.Oceania = combined.map(item => item.linkLength.serviceCount.Oceania);
    historyData.value.linkLength.serviceCount['Southeast Asia'] = combined.map(item => item.linkLength.serviceCount['Southeast Asia']);
    historyData.value.linkLength.serviceCount.Europe = combined.map(item => item.linkLength.serviceCount.Europe);
    historyData.value.linkLength.serviceCount['North America'] = combined.map(item => item.linkLength.serviceCount['North America']);
    historyData.value.linkLength.serviceCount['Middle East'] = combined.map(item => item.linkLength.serviceCount['Middle East']);
    
    historyData.value.linkLength.maxDistance.Africa = combined.map(item => item.linkLength.maxDistance.Africa);
    historyData.value.linkLength.maxDistance['South America'] = combined.map(item => item.linkLength.maxDistance['South America']);
    historyData.value.linkLength.maxDistance.Oceania = combined.map(item => item.linkLength.maxDistance.Oceania);
    historyData.value.linkLength.maxDistance['Southeast Asia'] = combined.map(item => item.linkLength.maxDistance['Southeast Asia']);
    historyData.value.linkLength.maxDistance.Europe = combined.map(item => item.linkLength.maxDistance.Europe);
    historyData.value.linkLength.maxDistance['North America'] = combined.map(item => item.linkLength.maxDistance['North America']);
    historyData.value.linkLength.maxDistance['Middle East'] = combined.map(item => item.linkLength.maxDistance['Middle East']);
    
    historyData.value.linkLength.minDistance.Africa = combined.map(item => item.linkLength.minDistance.Africa);
    historyData.value.linkLength.minDistance['South America'] = combined.map(item => item.linkLength.minDistance['South America']);
    historyData.value.linkLength.minDistance.Oceania = combined.map(item => item.linkLength.minDistance.Oceania);
    historyData.value.linkLength.minDistance['Southeast Asia'] = combined.map(item => item.linkLength.minDistance['Southeast Asia']);
    historyData.value.linkLength.minDistance.Europe = combined.map(item => item.linkLength.minDistance.Europe);
    historyData.value.linkLength.minDistance['North America'] = combined.map(item => item.linkLength.minDistance['North America']);
    historyData.value.linkLength.minDistance['Middle East'] = combined.map(item => item.linkLength.minDistance['Middle East']);
  }

  // 保持最多10个数据点（保留最新的）
  const maxPoints = 10;
  if (historyData.value.timestamps.length > maxPoints) {
    historyData.value.timestamps = historyData.value.timestamps.slice(-maxPoints);
    historyData.value.latency = historyData.value.latency.slice(-maxPoints);
    historyData.value.bandwidthUtil.overall = historyData.value.bandwidthUtil.overall.slice(-maxPoints);
    historyData.value.bandwidthUtil.isl_inter = historyData.value.bandwidthUtil.isl_inter.slice(-maxPoints);
    historyData.value.bandwidthUtil.isl_intra = historyData.value.bandwidthUtil.isl_intra.slice(-maxPoints);
    historyData.value.bandwidthUtil.sgl = historyData.value.bandwidthUtil.sgl.slice(-maxPoints);
    historyData.value.bandwidthUtil.grl = historyData.value.bandwidthUtil.grl.slice(-maxPoints);
    historyData.value.bandwidthUtil.backbone = historyData.value.bandwidthUtil.backbone.slice(-maxPoints);
    historyData.value.hop = historyData.value.hop.slice(-maxPoints);
    // 截取链路长度数据（三个指标）
    const areas = ['Africa', 'South America', 'Oceania', 'Southeast Asia', 'Europe', 'North America', 'Middle East'];
    areas.forEach(area => {
      historyData.value.linkLength.serviceCount[area] = historyData.value.linkLength.serviceCount[area].slice(-maxPoints);
      historyData.value.linkLength.maxDistance[area] = historyData.value.linkLength.maxDistance[area].slice(-maxPoints);
      historyData.value.linkLength.minDistance[area] = historyData.value.linkLength.minDistance[area].slice(-maxPoints);
    });
    console.log('ChartPanel: 截取最新10个数据点');
  }

  console.log('ChartPanel: 当前历史数据', {
    timestamps: historyData.value.timestamps,
    dataLength: historyData.value.timestamps.length
  });

  // 更新图表
  updateCharts();
  } catch (error) {
    console.error('ChartPanel: 添加数据点时出错:', error);
  }
};

// 创建图表配置
const createChartOption = (type) => {
  // 确保时间戳按正确顺序排列，并格式化为可读的时间标签
  const timestamps = historyData.value.timestamps.map(t => {
    if (t >= 60) {
      const minutes = Math.floor(t / 60);
      const seconds = t % 60;
      return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`;
    } else {
      return `${t}s`;
    }
  });
  
  let data, color, unit, yAxisMax, seriesConfig;

  switch (type) {
    case 'latency':
      data = historyData.value.latency;
      color = '#00ff88'; // 绿色，匹配您界面中的绿色元素
      unit = 'ms';
      yAxisMax = null;
      seriesConfig = {
        data: data,
        type: 'line',
        smooth: true,
        lineStyle: { color: color, width: 2 },
        itemStyle: { color: color },
        areaStyle: { color: color + '20' }
      };
      break;
    case 'bandwidth':
      // 带宽利用率图表使用多条线
      color = ['#ff6b35', '#00ff88', '#4a9eff', '#ff4757', '#3742fa', '#ffa502']; // 不同颜色
      unit = '%';
      yAxisMax = 100;
      seriesConfig = [
        { name: '总利用率', data: historyData.value.bandwidthUtil.overall, type: 'line', smooth: true, lineStyle: { color: color[0], width: 2 }, itemStyle: { color: color[0] } },
        { name: '星间同轨', data: historyData.value.bandwidthUtil.isl_inter, type: 'line', smooth: true, lineStyle: { color: color[1], width: 2 }, itemStyle: { color: color[1] } },
        { name: '星间异轨', data: historyData.value.bandwidthUtil.isl_intra, type: 'line', smooth: true, lineStyle: { color: color[2], width: 2 }, itemStyle: { color: color[2] } },
        { name: '星地链路', data: historyData.value.bandwidthUtil.sgl, type: 'line', smooth: true, lineStyle: { color: color[3], width: 2 }, itemStyle: { color: color[3] } },
        { name: 'GRL链路', data: historyData.value.bandwidthUtil.grl, type: 'line', smooth: true, lineStyle: { color: color[4], width: 2 }, itemStyle: { color: color[4] } },
        { name: '骨干网', data: historyData.value.bandwidthUtil.backbone, type: 'line', smooth: true, lineStyle: { color: color[5], width: 2 }, itemStyle: { color: color[5] } }
      ];
      break;
    case 'hop':
      data = historyData.value.hop;
      color = '#4a9eff'; // 蓝色，匹配您界面中的蓝色元素
      unit = '';
      yAxisMax = null;
      seriesConfig = {
        data: data,
        type: 'line',
        smooth: true,
        lineStyle: { color: color, width: 2 },
        itemStyle: { color: color },
        areaStyle: { color: color + '20' }
      };
      break;
    case 'linkLength_serviceCount':
      // 业务数量图表（按大洲分类）
      color = ['#ff6b35', '#00ff88', '#4a9eff', '#ff4757', '#3742fa', '#ffa502', '#26de81'];
      unit = '';
      yAxisMax = null;
      seriesConfig = [
        { name: '非洲', data: historyData.value.linkLength.serviceCount.Africa, type: 'line', smooth: true, lineStyle: { color: color[0], width: 2 }, itemStyle: { color: color[0] } },
        { name: '南美洲', data: historyData.value.linkLength.serviceCount['South America'], type: 'line', smooth: true, lineStyle: { color: color[1], width: 2 }, itemStyle: { color: color[1] } },
        { name: '大洋洲', data: historyData.value.linkLength.serviceCount.Oceania, type: 'line', smooth: true, lineStyle: { color: color[2], width: 2 }, itemStyle: { color: color[2] } },
        { name: '东南亚', data: historyData.value.linkLength.serviceCount['Southeast Asia'], type: 'line', smooth: true, lineStyle: { color: color[3], width: 2 }, itemStyle: { color: color[3] } },
        { name: '欧洲', data: historyData.value.linkLength.serviceCount.Europe, type: 'line', smooth: true, lineStyle: { color: color[4], width: 2 }, itemStyle: { color: color[4] } },
        { name: '北美洲', data: historyData.value.linkLength.serviceCount['North America'], type: 'line', smooth: true, lineStyle: { color: color[5], width: 2 }, itemStyle: { color: color[5] } },
        { name: '中东', data: historyData.value.linkLength.serviceCount['Middle East'], type: 'line', smooth: true, lineStyle: { color: color[6], width: 2 }, itemStyle: { color: color[6] } }
      ];
      break;
    case 'linkLength_maxDistance':
      // 最大距离图表（按大洲分类）
      color = ['#ff6b35', '#00ff88', '#4a9eff', '#ff4757', '#3742fa', '#ffa502', '#26de81'];
      unit = 'km';
      yAxisMax = null;
      seriesConfig = [
        { name: '非洲', data: historyData.value.linkLength.maxDistance.Africa, type: 'line', smooth: true, lineStyle: { color: color[0], width: 2 }, itemStyle: { color: color[0] } },
        { name: '南美洲', data: historyData.value.linkLength.maxDistance['South America'], type: 'line', smooth: true, lineStyle: { color: color[1], width: 2 }, itemStyle: { color: color[1] } },
        { name: '大洋洲', data: historyData.value.linkLength.maxDistance.Oceania, type: 'line', smooth: true, lineStyle: { color: color[2], width: 2 }, itemStyle: { color: color[2] } },
        { name: '东南亚', data: historyData.value.linkLength.maxDistance['Southeast Asia'], type: 'line', smooth: true, lineStyle: { color: color[3], width: 2 }, itemStyle: { color: color[3] } },
        { name: '欧洲', data: historyData.value.linkLength.maxDistance.Europe, type: 'line', smooth: true, lineStyle: { color: color[4], width: 2 }, itemStyle: { color: color[4] } },
        { name: '北美洲', data: historyData.value.linkLength.maxDistance['North America'], type: 'line', smooth: true, lineStyle: { color: color[5], width: 2 }, itemStyle: { color: color[5] } },
        { name: '中东', data: historyData.value.linkLength.maxDistance['Middle East'], type: 'line', smooth: true, lineStyle: { color: color[6], width: 2 }, itemStyle: { color: color[6] } }
      ];
      break;
    case 'linkLength_minDistance':
      // 最小距离图表（按大洲分类）
      color = ['#ff6b35', '#00ff88', '#4a9eff', '#ff4757', '#3742fa', '#ffa502', '#26de81'];
      unit = 'km';
      yAxisMax = null;
      seriesConfig = [
        { name: '非洲', data: historyData.value.linkLength.minDistance.Africa, type: 'line', smooth: true, lineStyle: { color: color[0], width: 2 }, itemStyle: { color: color[0] } },
        { name: '南美洲', data: historyData.value.linkLength.minDistance['South America'], type: 'line', smooth: true, lineStyle: { color: color[1], width: 2 }, itemStyle: { color: color[1] } },
        { name: '大洋洲', data: historyData.value.linkLength.minDistance.Oceania, type: 'line', smooth: true, lineStyle: { color: color[2], width: 2 }, itemStyle: { color: color[2] } },
        { name: '东南亚', data: historyData.value.linkLength.minDistance['Southeast Asia'], type: 'line', smooth: true, lineStyle: { color: color[3], width: 2 }, itemStyle: { color: color[3] } },
        { name: '欧洲', data: historyData.value.linkLength.minDistance.Europe, type: 'line', smooth: true, lineStyle: { color: color[4], width: 2 }, itemStyle: { color: color[4] } },
        { name: '北美洲', data: historyData.value.linkLength.minDistance['North America'], type: 'line', smooth: true, lineStyle: { color: color[5], width: 2 }, itemStyle: { color: color[5] } },
        { name: '中东', data: historyData.value.linkLength.minDistance['Middle East'], type: 'line', smooth: true, lineStyle: { color: color[6], width: 2 }, itemStyle: { color: color[6] } }
      ];
      break;
    default:
      return {};
  }

  return {
    backgroundColor: '#000000',
    grid: {
      left: '3%',
      right: '4%',
      top: type === 'bandwidth' || type.startsWith('linkLength') ? '55' : '60',  // 为带宽利用率和链路长度图表增加顶部空间
      bottom: '10%',
      containLabel: true
    },
    legend: type === 'bandwidth' ? {
      data: ['总利用率', '星间同轨', '星间异轨', '星地链路', 'GRL链路', '骨干网'],
      textStyle: { color: '#cccccc', fontSize: 10 },
      top: 1,  // 增加图例的顶部距离，避免与标题重叠
      left: 'center',  // 图例居中
      itemGap: 10,  // 图例项之间的间距
      itemWidth: 20,  // 图例标记的宽度
      itemHeight: 10  // 图例标记的高度
    } : (type === 'linkLength_serviceCount' || type === 'linkLength_maxDistance' || type === 'linkLength_minDistance') ? {
      data: ['非洲', '南美洲', '大洋洲', '东南亚', '欧洲', '北美洲', '中东'],
      textStyle: { color: '#cccccc', fontSize: 10 },
      top: 8,
      left: 'center',  // 图例居中
      itemGap: 8,  // 图例项之间的间距
      itemWidth: 20,  // 图例标记的宽度
      itemHeight: 10  // 图例标记的高度
    } : null,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a1a',
      borderColor: '#333333',
      borderWidth: 1,
      appendToBody: true,  // 将tooltip添加到body而不是图表容器
      extraCssText: 'z-index: 10000; box-shadow: 0 2px 8px rgba(0,0,0,0.5);', // 设置最高层级
      textStyle: {
        color: '#ffffff',
        fontSize: 12
      },
      formatter: function(params) {
        if (Array.isArray(params) && params.length > 1) {
          // 多系列图表
          let result = params[0].name + '<br/>';
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}${unit}<br/>`;
          });
          return result;
        } else {
          // 单系列图表
          const point = Array.isArray(params) ? params[0] : params;
          return `${point.name}<br/>${point.seriesName}: ${point.value}${unit}`;
        }
      }
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      axisLabel: {
        rotate: 0,
        fontSize: 10,
        color: '#cccccc'
      },
      axisLine: {
        lineStyle: { color: '#333333' }
      },
      axisTick: {
        lineStyle: { color: '#333333' }
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      max: yAxisMax,
      axisLabel: {
        formatter: `{value}${unit}`,
        color: '#cccccc',
        fontSize: 10
      },
      axisLine: {
        lineStyle: { color: '#333333' }
      },
      axisTick: {
        lineStyle: { color: '#333333' }
      },
      splitLine: {
        lineStyle: { 
          color: '#222222',
          type: 'solid'
        }
      }
    },
    series: Array.isArray(seriesConfig) ? seriesConfig : [{
      name: getSeriesName(type),
      type: 'line',
      data: data,
      smooth: true,
      lineStyle: {
        color: color,
        width: 2
      },
      itemStyle: {
        color: color,
        borderWidth: 0
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: color + '40'
          }, {
            offset: 1,
            color: color + '10'
          }]
        }
      }
    }],
    grid: {
      left: '10%',
      right: '5%',
      bottom: '15%',
      top: (type === 'linkLength_serviceCount' || type === 'linkLength_maxDistance' || type === 'linkLength_minDistance') ? '25%' : '15%',  /* 链路长度图表增加更多顶部间距避免与图例重叠 */
      containLabel: true
    }
  };
};

// 获取系列名称
function getSeriesName(type) {
  switch (type) {
    case 'latency':
      return '平均延迟';
    case 'bandwidth':
      return '带宽利用率';
    case 'hop':
      return '平均跳数';
    case 'linkLength_serviceCount':
      return '业务数量';
    case 'linkLength_maxDistance':
      return '最大距离';
    case 'linkLength_minDistance':
      return '最小距离';
    default:
      return '';
  }
}

// 更新图表
function updateCharts() {
  nextTick(() => {
    if (props.selectedData.averageLatency && latencyChartInstance) {
      latencyChartInstance.setOption(createChartOption('latency'));
    }
    
    if (props.selectedData.bandwidthUtil && bandwidthChartInstance) {
      bandwidthChartInstance.setOption(createChartOption('bandwidth'));
    }
    
    if (props.selectedData.hopCounts && hopChartInstance) {
      hopChartInstance.setOption(createChartOption('hop'));
    }
    
    if (props.selectedData.linkLength) {
      if (linkLengthServiceCountChartInstance) {
        linkLengthServiceCountChartInstance.setOption(createChartOption('linkLength_serviceCount'));
      }
      if (linkLengthMaxDistanceChartInstance) {
        linkLengthMaxDistanceChartInstance.setOption(createChartOption('linkLength_maxDistance'));
      }
      if (linkLengthMinDistanceChartInstance) {
        linkLengthMinDistanceChartInstance.setOption(createChartOption('linkLength_minDistance'));
      }
    }
  });
}

// 初始化图表
function initCharts() {
  nextTick(() => {
    // 初始化延迟图表
    if (props.selectedData.averageLatency && latencyChart.value) {
      latencyChartInstance = echarts.init(latencyChart.value);
      latencyChartInstance.setOption(createChartOption('latency'));
    }
    
    // 初始化带宽利用率图表
    if (props.selectedData.bandwidthUtil && bandwidthChart.value) {
      bandwidthChartInstance = echarts.init(bandwidthChart.value);
      bandwidthChartInstance.setOption(createChartOption('bandwidth'));
    }
    
    // 初始化跳数图表
    if (props.selectedData.hopCounts && hopChart.value) {
      hopChartInstance = echarts.init(hopChart.value);
      hopChartInstance.setOption(createChartOption('hop'));
    }
    
    // 初始化链路长度图表（三个）
    if (props.selectedData.linkLength) {
      if (linkLengthServiceCountChart.value) {
        linkLengthServiceCountChartInstance = echarts.init(linkLengthServiceCountChart.value);
        linkLengthServiceCountChartInstance.setOption(createChartOption('linkLength_serviceCount'));
      }
      if (linkLengthMaxDistanceChart.value) {
        linkLengthMaxDistanceChartInstance = echarts.init(linkLengthMaxDistanceChart.value);
        linkLengthMaxDistanceChartInstance.setOption(createChartOption('linkLength_maxDistance'));
      }
      if (linkLengthMinDistanceChart.value) {
        linkLengthMinDistanceChartInstance = echarts.init(linkLengthMinDistanceChart.value);
        linkLengthMinDistanceChartInstance.setOption(createChartOption('linkLength_minDistance'));
      }
    }
    
    // 如果有当前帧数据，立即添加到图表中
    if (props.currentFrameData) {
      addDataPoint(props.timeFrame, props.currentFrameData);
    }
  });
}

// 销毁图表
function destroyCharts() {
  if (latencyChartInstance) {
    latencyChartInstance.dispose();
    latencyChartInstance = null;
  }
  
  if (bandwidthChartInstance) {
    bandwidthChartInstance.dispose();
    bandwidthChartInstance = null;
  }
  
  if (hopChartInstance) {
    hopChartInstance.dispose();
    hopChartInstance = null;
  }
  
  if (linkLengthServiceCountChartInstance) {
    linkLengthServiceCountChartInstance.dispose();
    linkLengthServiceCountChartInstance = null;
  }
  
  if (linkLengthMaxDistanceChartInstance) {
    linkLengthMaxDistanceChartInstance.dispose();
    linkLengthMaxDistanceChartInstance = null;
  }
  
  if (linkLengthMinDistanceChartInstance) {
    linkLengthMinDistanceChartInstance.dispose();
    linkLengthMinDistanceChartInstance = null;
  }
}

// 响应式调整图表大小
function resizeCharts() {
  if (latencyChartInstance) {
    latencyChartInstance.resize();
  }
  
  if (bandwidthChartInstance) {
    bandwidthChartInstance.resize();
  }
  
  if (hopChartInstance) {
    hopChartInstance.resize();
  }
  
  if (linkLengthServiceCountChartInstance) {
    linkLengthServiceCountChartInstance.resize();
  }
  
  if (linkLengthMaxDistanceChartInstance) {
    linkLengthMaxDistanceChartInstance.resize();
  }
  
  if (linkLengthMinDistanceChartInstance) {
    linkLengthMinDistanceChartInstance.resize();
  }
}

// 监听currentFrameData变化，自动添加数据点
watch(() => props.currentFrameData, (newData, oldData) => {
  console.log('ChartPanel: currentFrameData变化', { 
    newData: !!newData, 
    oldData: !!oldData,
    timeFrame: props.timeFrame,
    hasTimestamp: newData?.timestamp,
    hasNetworkStats: newData?.network_statistics 
  });
  
  if (newData) {
    console.log('ChartPanel: 完整的新数据', newData);
    addDataPoint(props.timeFrame, newData);
  }
}, { immediate: true });

// 监听selectedData变化，重新初始化图表
watch(() => props.selectedData, (newSelection, oldSelection) => {
  console.log('ChartPanel: selectedData变化', {
    new: newSelection,
    old: oldSelection
  });
  
  nextTick(() => {
    // 检查是否需要初始化新的图表
    
    // 平均延迟图表
    if (newSelection.averageLatency && !oldSelection?.averageLatency) {
      console.log('初始化平均延迟图表');
      if (latencyChart.value && !latencyChartInstance) {
        latencyChartInstance = echarts.init(latencyChart.value);
        latencyChartInstance.setOption(createChartOption('latency'));
      }
    } else if (!newSelection.averageLatency && latencyChartInstance) {
      console.log('销毁平均延迟图表');
      latencyChartInstance.dispose();
      latencyChartInstance = null;
    }
    
    // 带宽利用率图表
    if (newSelection.bandwidthUtil && !oldSelection?.bandwidthUtil) {
      console.log('初始化带宽利用率图表');
      if (bandwidthChart.value && !bandwidthChartInstance) {
        bandwidthChartInstance = echarts.init(bandwidthChart.value);
        bandwidthChartInstance.setOption(createChartOption('bandwidth'));
      }
    } else if (!newSelection.bandwidthUtil && bandwidthChartInstance) {
      console.log('销毁带宽利用率图表');
      bandwidthChartInstance.dispose();
      bandwidthChartInstance = null;
    }
    
    // 平均跳数图表
    if (newSelection.hopCounts && !oldSelection?.hopCounts) {
      console.log('初始化平均跳数图表');
      if (hopChart.value && !hopChartInstance) {
        hopChartInstance = echarts.init(hopChart.value);
        hopChartInstance.setOption(createChartOption('hop'));
      }
    } else if (!newSelection.hopCounts && hopChartInstance) {
      console.log('销毁平均跳数图表');
      hopChartInstance.dispose();
      hopChartInstance = null;
    }
    
    // 链路长度图表
    if (newSelection.linkLength && !oldSelection?.linkLength) {
      console.log('初始化链路长度图表');
      if (linkLengthServiceCountChart.value && !linkLengthServiceCountChartInstance) {
        linkLengthServiceCountChartInstance = echarts.init(linkLengthServiceCountChart.value);
        linkLengthServiceCountChartInstance.setOption(createChartOption('linkLength_serviceCount'));
      }
      if (linkLengthMaxDistanceChart.value && !linkLengthMaxDistanceChartInstance) {
        linkLengthMaxDistanceChartInstance = echarts.init(linkLengthMaxDistanceChart.value);
        linkLengthMaxDistanceChartInstance.setOption(createChartOption('linkLength_maxDistance'));
      }
      if (linkLengthMinDistanceChart.value && !linkLengthMinDistanceChartInstance) {
        linkLengthMinDistanceChartInstance = echarts.init(linkLengthMinDistanceChart.value);
        linkLengthMinDistanceChartInstance.setOption(createChartOption('linkLength_minDistance'));
      }
    } else if (!newSelection.linkLength) {
      if (linkLengthServiceCountChartInstance) {
        console.log('销毁链路长度-业务数量图表');
        linkLengthServiceCountChartInstance.dispose();
        linkLengthServiceCountChartInstance = null;
      }
      if (linkLengthMaxDistanceChartInstance) {
        console.log('销毁链路长度-最大距离图表');
        linkLengthMaxDistanceChartInstance.dispose();
        linkLengthMaxDistanceChartInstance = null;
      }
      if (linkLengthMinDistanceChartInstance) {
        console.log('销毁链路长度-最小距离图表');
        linkLengthMinDistanceChartInstance.dispose();
        linkLengthMinDistanceChartInstance = null;
      }
    }
    
    // 延迟调整图表大小，确保正确渲染
    setTimeout(() => {
      resizeCharts();
    }, 100);
  });
}, { deep: true });

// 也监听timeFrame变化
watch(() => props.timeFrame, (newFrame, oldFrame) => {
  console.log('ChartPanel: timeFrame变化', { newFrame, oldFrame, hasCurrentData: !!props.currentFrameData });
  
  if (props.currentFrameData && newFrame !== oldFrame) {
    addDataPoint(newFrame, props.currentFrameData);
  }
});

onMounted(async () => {
  console.log('ChartPanel: 组件挂载', {
    selectedData: props.selectedData,
    hasCurrentFrameData: !!props.currentFrameData,
    timeFrame: props.timeFrame
  });
  
  initCharts();
  window.addEventListener('resize', resizeCharts);
  
  // 如果挂载时就有数据，立即添加
  if (props.currentFrameData) {
    console.log('ChartPanel: 挂载时立即添加数据');
    addDataPoint(props.timeFrame, props.currentFrameData);
  }
  
  // 尝试加载一些历史数据来显示更多数据点
  await loadHistoricalData();
});

onUnmounted(() => {
  destroyCharts();
  window.removeEventListener('resize', resizeCharts);
});

// 对外暴露添加数据点的方法
defineExpose({
  addDataPoint
});

// 加载历史数据以显示更多数据点
const loadHistoricalData = async () => {
  console.log('ChartPanel: 开始加载历史数据');
  
  try {
    const currentFolder = localStorage.getItem('selectedDataFolder') || 'new';
    const config = parseFolderName(currentFolder);
    const timeInterval = config.interval;
    const currentFrame = props.timeFrame || 1;
    
    // 加载当前帧之前的几个数据点
    const framesToLoad = Math.min(5, currentFrame - 1); // 最多加载前5个帧
    console.log(`ChartPanel: 计划加载 ${framesToLoad} 个历史帧`);
    
    for (let i = Math.max(1, currentFrame - framesToLoad); i < currentFrame; i++) {
      const fileTimeValue = (i - 1) * timeInterval + timeInterval;
      const filename = `./data/${currentFolder}/network_state_${fileTimeValue}.00.json`;
      
      try {
        console.log(`ChartPanel: 加载历史数据帧 ${i}, 文件: ${filename}`);
        const response = await fetch(filename);
        if (response.ok) {
          const rawData = await response.json();
          addDataPoint(i, rawData);
        } else {
          console.warn(`ChartPanel: 无法加载历史数据帧 ${i}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`ChartPanel: 加载历史数据帧 ${i} 时出错:`, error);
      }
    }
    
    console.log('ChartPanel: 历史数据加载完成');
  } catch (error) {
    console.error('ChartPanel: 加载历史数据时出错:', error);
  }
};
</script>

<style scoped>
.chart-panel {
  width: 100%;
  height: 100%;
  background: var(--theme-dialog-bg);
  border: 1px solid var(--theme-border);
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: var(--theme-secondary-bg);
  border-bottom: 1px solid #333333;
}

.panel-header h3 {
  margin: 0;
  color: var(--theme-main-text);
  font-size: 14px;
  font-weight: normal;
  font-family: Arial, sans-serif;
}

.close-btn {
  background: var(--theme-border);
  border: 1px solid var(--theme-border);
  color: var(--theme-main-text);
  width: 22px;
  height: 22px;
  border-radius: 0;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: var(--theme-accent);
}

.panel-content {
  flex: 1;
  padding: 10px;
  background: var(--theme-dialog-bg);
  overflow-y: auto;
  overflow-x: visible;  /* 水平方向允许溢出，避免tooltip被裁剪 */
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: visible;  /* 允许子元素溢出 */
}

.chart-item {
  background: var(--theme-dialog-bg);
  border: 1px solid var(--theme-border);
  border-radius: 0;
  padding: 10px;
  position: relative;  /* 确保内部元素定位正确 */
  overflow: visible;   /* 允许tooltip溢出 */
}

.chart-item h4 {
  margin: 0 0 8px 0;
  color: var(--theme-main-text);
  font-size: 12px;
  font-weight: normal;
  font-family: Arial, sans-serif;
}

.chart {
  width: 100%;
  height: 300px;  /* 增加高度以避免标题和轴标签重叠 */
  background: var(--theme-dialog-bg);
  position: relative;  /* 确保tooltip定位正确 */
  overflow: visible;   /* 允许tooltip溢出容器 */
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: var(--theme-secondary-bg);
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--theme-border);
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--theme-accent);
}
</style>