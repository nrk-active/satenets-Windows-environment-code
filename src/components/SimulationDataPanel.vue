<template>
  <div class="data-panel" v-if="visible">
    <div class="panel-header">
      仿真结果数据
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="panel-content">
      <div v-if="selectedData.averageLatency" class="data-item">
        <h3>平均延迟</h3>
        <div class="chart-container">
          <vue-echarts :option="averageLatencyOption" :autoresize="true" />
        </div>
      </div>
      <div v-if="selectedData.blockingRate" class="data-item">
        <h3>阻塞率</h3>
        <div class="chart-container">
          <vue-echarts :option="blockingRateOption" :autoresize="true" />
        </div>
      </div>
      <div v-if="selectedData.hopCounts" class="data-item">
        <h3>平均跳数</h3>
        <div class="chart-container">
          <vue-echarts :option="hopCountsOption" :autoresize="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted, onUnmounted, watch, ref, computed } from 'vue';

// 使用宏语法直接定义 props
const props = defineProps({
  visible: Boolean,
  selectedData: Object
});

const displayData = reactive({
  averageLatency: [],
  blockingRate: [],
  hopCounts: [],
  spicesCounts: [],
  intraplaneCounts: [],
  interplaneCounts: []
});

let dataIndex = 0;
let timer = null;
let counter = 0; // 添加counter用于API请求
const resultData = ref(null);

// 从后端API加载数据
const loadResultData = async () => {
  try {
    // 获取CSRF令牌
    const csrfToken = await fetch('/api/csrf_token', {
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })
    .then(res => res.json())
    .then(data => data.csrfToken)
    .catch(error => {
      console.error('获取CSRF令牌失败:', error);
      return null;
    });

    // 获取当前模拟器ID
    const simulatorResponse = await fetch('/api/simulators/', {
      method: 'GET',
      credentials: 'include',
    });

    if (!simulatorResponse.ok) {
      throw new Error('获取模拟器ID失败');
    }

    const simulatorData = await simulatorResponse.json();
    
    if (!simulatorData.simulators || simulatorData.simulators.length === 0) {
      throw new Error('没有可用的模拟器数据');
    }

    const id = simulatorData.simulators[simulatorData.simulators.length - 1].id;
    console.log("当前模拟器ID:", id);

    // 请求仿真数据
    const response = await fetch(`/api/simulators/${id}/average-latency/`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`获取仿真数据失败: ${response.status}`);
    }

    const data = await response.json();
    console.log('成功获取仿真数据:', data);

    // 初始化或更新 resultData
    if (!resultData.value) {
      resultData.value = {
        blocking_rate: [],
        average_latency: [],
        hop_counts_statics: [],
        spices_counts_statics: [],
        intra_plane_links_statics: [],
        inter_plane_links_statics: []
      };
    }

    // 更新数据
    resultData.value.blocking_rate.push(data.blocking_rate);
    resultData.value.average_latency.push(data.average_latency);
    resultData.value.hop_counts_statics = data.hop_counts_statics;
    resultData.value.spices_counts_statics = data.spices_counts_statics;
    resultData.value.intra_plane_links_statics = data.intra_plane_links_statics;
    resultData.value.inter_plane_links_statics = data.inter_plane_links_statics;

    counter++;
    
  } catch (error) {
    console.error('获取仿真数据失败:', error);
    // 抛出错误，但不影响轮询继续
    throw error;
  }
};

// 初始化每个数据类型为固定的3个空位
const initializeDisplayData = () => {
  displayData.averageLatency = [0, 0, 0, 0, 0];
  displayData.blockingRate = [0, 0, 0, 0, 0];
  displayData.hopCounts = [0, 0, 0, 0, 0];
  displayData.spicesCounts = [0, 0, 0, 0, 0];
  displayData.intraplaneCounts = [0, 0, 0, 0, 0];
  displayData.interplaneCounts = [0, 0, 0, 0, 0];
};

// 添加一个变量用于存储上一次的数据
const previousData = ref({
  average_latency: null,
  blocking_rate: null,
  hop_counts_statics: null,
  spices_counts_statics: null,
  intra_plane_links_statics: null,
  inter_plane_links_statics: null
});

// 更新显示数据
// 修改更新显示数据的方法
const updateDisplayData = () => {
  if (!resultData.value) return;
  
  // 平均延迟数据
  if (props.selectedData.averageLatency && resultData.value.average_latency.length > 0) {
    const newValue = resultData.value.average_latency[resultData.value.average_latency.length - 1];
    if (newValue !== previousData.value.average_latency) {
      displayData.averageLatency.unshift(newValue);
      displayData.averageLatency = displayData.averageLatency.slice(0, 5);
      previousData.value.average_latency = newValue;
    }
  }
  
  // 阻塞率数据
  if (props.selectedData.blockingRate && resultData.value.blocking_rate.length > 0) {
    const newValue = resultData.value.blocking_rate[resultData.value.blocking_rate.length - 1];
    if (newValue !== previousData.value.blocking_rate) {
      displayData.blockingRate.unshift(newValue);
      displayData.blockingRate = displayData.blockingRate.slice(0, 5);
      previousData.value.blocking_rate = newValue;
    }
  }
  
  // 跳数数据
  if (props.selectedData.hopCounts && resultData.value.hop_counts_statics.length > 0) {
    const newValue = resultData.value.hop_counts_statics[resultData.value.hop_counts_statics.length - 1];
    if (newValue !== previousData.value.hop_counts_statics) {
      displayData.hopCounts.unshift(newValue);
      displayData.hopCounts = displayData.hopCounts.slice(0, 5);
      previousData.value.hop_counts_statics = newValue;
    }
  }
  
  // 如果有新的切片数数据，则更新切片数
  if (props.selectedData.spicesCounts && resultData.value.spices_counts_statics.length > 0) {
    const latestSpicesCount = resultData.value.spices_counts_statics[resultData.value.spices_counts_statics.length - 1];
    displayData.spicesCounts.unshift(latestSpicesCount);
    displayData.spicesCounts = displayData.spicesCounts.slice(0, 5);
  }
  
  // 轨道内链路数据
  if (props.selectedData.intraplaneCounts && resultData.value.intra_plane_links_statics.length > 0) {
    const latestIntraPlaneCount = resultData.value.intra_plane_links_statics[resultData.value.intra_plane_links_statics.length - 1];
    displayData.intraplaneCounts.unshift(latestIntraPlaneCount);
    displayData.intraplaneCounts = displayData.intraplaneCounts.slice(0, 5);
  }
  
  // 轨道间链路数据
  if (props.selectedData.interplaneCounts && resultData.value.inter_plane_links_statics.length > 0) {
    const latestInterPlaneCount = resultData.value.inter_plane_links_statics[resultData.value.inter_plane_links_statics.length - 1];
    displayData.interplaneCounts.unshift(latestInterPlaneCount);
    displayData.interplaneCounts = displayData.interplaneCounts.slice(0, 5);
  }
};

// 修改 watch 函数中的轮询逻辑
watch(() => props.visible, (newValue) => {
  if (newValue) {
    // 不再重置数据，只在第一次初始化时设置
    if (!displayData.averageLatency.length) {
      initializeDisplayData();
    }
    
    // 重置计数器，不重置数据
    dataIndex = 0;
    counter = 0;

    // 设置定时轮询
    if (timer) {
      clearInterval(timer);
    }
    
    // 立即开始第一次轮询
    loadResultData()
      .then(() => updateDisplayData())
      .catch(error => console.error('首次数据加载失败:', error));
    
    timer = setInterval(() => {
      console.log('执行定时轮询...');
      loadResultData()
        .then(() => updateDisplayData())
        .catch(error => console.error('轮询获取数据失败:', error));
    }, 8000);
  }
}, { immediate: true });

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

// 添加三个图表的配置
const baseOption = {
  grid: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 40,
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: ['T', 'T-1', 'T-2', 'T-3', 'T-4'],
    axisLine: { lineStyle: { color: '#fff' } },
    axisLabel: { color: '#fff' }
  },
  yAxis: {
    type: 'value',
    axisLine: { lineStyle: { color: '#fff' } },
    axisLabel: { color: '#fff' }
  }
};

// 平均延迟图表配置
const averageLatencyOption = computed(() => ({
  ...baseOption,
  series: [{
    data: displayData.averageLatency,
    type: 'line',
    smooth: true,
    lineStyle: { color: '#f39c12', width: 2 }
  }]
}));

// 阻塞率图表配置
const blockingRateOption = computed(() => ({
  ...baseOption,
  series: [{
    data: displayData.blockingRate,
    type: 'line',
    smooth: true,
    lineStyle: { color: '#e74c3c', width: 2 }
  }]
}));

// 跳数图表配置
const hopCountsOption = computed(() => ({
  ...baseOption,
  series: [{
    data: displayData.hopCounts,
    type: 'line',
    smooth: true,
    lineStyle: { color: '#3498db', width: 2 }
  }]
}));

defineEmits(['close']);
</script>

<style scoped>
.data-panel {
  position: fixed;
  right: 0;
  top: 80px; /* 与导航栏高度对应 */
  bottom: 0px;
  width: 400px;
  background-color: rgba(42, 42, 42, 0.95);
  border-left: 1px solid #444;
  color: white;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 15px;
  background-color: #333;
  border-bottom: 2px solid #f39c12;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  color: #ccc;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.data-item {
  margin-bottom: 10px; 
}

.data-item h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #f39c12;
}

.chart-container {
  height: 185px;     
  background: #333;
  padding: 10px;     
  border-radius: 4px;
  margin: 5px 0;     
}
</style>
