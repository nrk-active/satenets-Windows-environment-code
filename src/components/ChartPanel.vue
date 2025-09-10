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
        
        <!-- 阻塞率图表 -->
        <div v-if="selectedData.blockingRate" class="chart-item">
          <h4>阻塞率</h4>
          <div ref="blockingChart" class="chart"></div>
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
const blockingChart = ref(null);
const hopChart = ref(null);

// ECharts实例
let latencyChartInstance = null;
let blockingChartInstance = null;
let hopChartInstance = null;

// 存储历史数据（最多保留10个切片）
const historyData = ref({
  timestamps: [], // 时间戳
  latency: [], // 平均延迟数据
  blocking: [], // 阻塞率数据
  hop: [] // 平均跳数数据
});

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
    const bandwidth_util = parseFloat(stats.average_bandwidth_utilization) || 0;
    const hop = parseFloat(stats.average_hop_count) || 0;
    
    // 阻塞率计算：(1 - 带宽利用率) * 100
    // 但如果带宽利用率很低，说明网络繁忙，阻塞率应该高
    // 让我们直接使用带宽利用率作为网络负载指标
    const blocking = bandwidth_util * 100; // 直接使用带宽利用率作为负载百分比
    
    const result = {
      latency: latency,
      blocking: blocking,
      hop: hop
    };
    
    console.log('ChartPanel: 计算结果', {
      原始数据: { latency, bandwidth_util, hop },
      计算结果: result
    });
    
    return result;
  }

  // 如果没有network_statistics，则从图数据计算
  const graphData = networkData.data;
  if (!graphData) {
    console.warn('ChartPanel: 无图数据结构');
    return { latency: 0, blocking: 0, hop: 0 };
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
    if (edge.latency_ms !== undefined) {
      totalLatency += parseFloat(edge.latency_ms);
      activeEdges++;
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
    blocking: Math.max(0, Math.min(100, blockingRate)),
    hop: Math.max(1, avgHop)
  };

  console.log('ChartPanel: 从图数据计算结果', result);
  return result;
};

// 添加新的数据点
const addDataPoint = (frame, networkData) => {
  console.log('ChartPanel: addDataPoint调用', { frame, hasData: !!networkData });
  
  if (!networkData) {
    console.warn('ChartPanel: 网络数据为空，跳过添加数据点');
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
    historyData.value.blocking[existingIndex] = metrics.blocking;
    historyData.value.hop[existingIndex] = metrics.hop;
    console.log('ChartPanel: 更新现有数据点', { timestamp, metrics });
  } else {
    // 添加新数据
    historyData.value.timestamps.push(timestamp);
    historyData.value.latency.push(metrics.latency);
    historyData.value.blocking.push(metrics.blocking);
    historyData.value.hop.push(metrics.hop);
    console.log('ChartPanel: 添加新数据点', { timestamp, metrics });
    
    // 按时间戳排序所有数据
    const combined = historyData.value.timestamps.map((ts, index) => ({
      timestamp: ts,
      latency: historyData.value.latency[index],
      blocking: historyData.value.blocking[index],
      hop: historyData.value.hop[index]
    }));
    
    // 按时间戳升序排序
    combined.sort((a, b) => a.timestamp - b.timestamp);
    
    // 重新分配排序后的数据
    historyData.value.timestamps = combined.map(item => item.timestamp);
    historyData.value.latency = combined.map(item => item.latency);
    historyData.value.blocking = combined.map(item => item.blocking);
    historyData.value.hop = combined.map(item => item.hop);
  }

  // 保持最多10个数据点（保留最新的）
  const maxPoints = 10;
  if (historyData.value.timestamps.length > maxPoints) {
    historyData.value.timestamps = historyData.value.timestamps.slice(-maxPoints);
    historyData.value.latency = historyData.value.latency.slice(-maxPoints);
    historyData.value.blocking = historyData.value.blocking.slice(-maxPoints);
    historyData.value.hop = historyData.value.hop.slice(-maxPoints);
    console.log('ChartPanel: 截取最新10个数据点');
  }

  console.log('ChartPanel: 当前历史数据', {
    timestamps: historyData.value.timestamps,
    dataLength: historyData.value.timestamps.length
  });

  // 更新图表
  updateCharts();
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
  
  let data, color, unit, yAxisMax;

  switch (type) {
    case 'latency':
      data = historyData.value.latency;
      color = '#00ff88'; // 绿色，匹配您界面中的绿色元素
      unit = 'ms';
      yAxisMax = null;
      break;
    case 'blocking':
      data = historyData.value.blocking;
      color = '#ff6b35'; // 橙色，匹配您界面中的橙色元素
      unit = '%';
      yAxisMax = 100;
      break;
    case 'hop':
      data = historyData.value.hop;
      color = '#4a9eff'; // 蓝色，匹配您界面中的蓝色元素
      unit = '';
      yAxisMax = null;
      break;
    default:
      return {};
  }

  return {
    backgroundColor: '#000000',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a1a',
      borderColor: '#333333',
      borderWidth: 1,
      textStyle: {
        color: '#ffffff',
        fontSize: 12
      },
      formatter: function(params) {
        const point = params[0];
        return `${point.name}<br/>${point.seriesName}: ${point.value}${unit}`;
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
    series: [{
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
      top: '10%',
      containLabel: true
    }
  };
};

// 获取系列名称
function getSeriesName(type) {
  switch (type) {
    case 'latency':
      return '平均延迟';
    case 'blocking':
      return '阻塞率';
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
    
    if (props.selectedData.blockingRate && blockingChartInstance) {
      blockingChartInstance.setOption(createChartOption('blocking'));
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
    
    // 初始化阻塞率图表
    if (props.selectedData.blockingRate && blockingChart.value) {
      blockingChartInstance = echarts.init(blockingChart.value);
      blockingChartInstance.setOption(createChartOption('blocking'));
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
  
  if (blockingChartInstance) {
    blockingChartInstance.dispose();
    blockingChartInstance = null;
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
  
  if (blockingChartInstance) {
    blockingChartInstance.resize();
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

onMounted(() => {
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
});

onUnmounted(() => {
  destroyCharts();
  window.removeEventListener('resize', resizeCharts);
});

// 对外暴露添加数据点的方法
defineExpose({
  addDataPoint
});
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
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-item {
  background: #000000;
  border: 1px solid #333333;
  border-radius: 0;
  padding: 10px;
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
  height: 200px;
  background: #000000;
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