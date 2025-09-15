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

// ECharts实例
let latencyChartInstance = null;
let bandwidthChartInstance = null;
let hopChartInstance = null;

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
  hop: [] // 平均跳数数据
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
const addDataPoint = (frame, networkData) => {
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
    console.log('ChartPanel: 更新现有数据点', { timestamp, metrics });
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
    console.log('ChartPanel: 添加新数据点', { timestamp, metrics });
    
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
      hop: historyData.value.hop[index]
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
    default:
      return {};
  }

  return {
    backgroundColor: '#000000',
    legend: type === 'bandwidth' ? {
      data: ['总利用率', '星间同轨', '星间异轨', '星地链路', 'GRL链路', '骨干网'],
      textStyle: { color: '#cccccc', fontSize: 10 },
      top: 5
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
      top: '15%',  /* 增加顶部间距避免标题重叠 */
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
  background: #000000;
  border: 1px solid #333333;
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
  background: #1a1a1a;
  border-bottom: 1px solid #333333;
}

.panel-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  font-weight: normal;
  font-family: Arial, sans-serif;
}

.close-btn {
  background: #333333;
  border: 1px solid #555555;
  color: #ffffff;
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
  background: #555555;
}

.panel-content {
  flex: 1;
  padding: 10px;
  background: #000000;
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
  background: #000000;
  border: 1px solid #333333;
  border-radius: 0;
  padding: 10px;
  position: relative;  /* 确保内部元素定位正确 */
  overflow: visible;   /* 允许tooltip溢出 */
}

.chart-item h4 {
  margin: 0 0 8px 0;
  color: #ffffff;
  font-size: 12px;
  font-weight: normal;
  font-family: Arial, sans-serif;
}

.chart {
  width: 100%;
  height: 300px;  /* 增加高度以避免标题和轴标签重叠 */
  background: #000000;
  position: relative;  /* 确保tooltip定位正确 */
  overflow: visible;   /* 允许tooltip溢出容器 */
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #555555;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #777777;
}
</style>