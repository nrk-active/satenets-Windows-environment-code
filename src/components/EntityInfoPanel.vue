<template>
  <div class="entity-info-panel" v-if="selectedEntity">
    <div class="header">
      <span>{{ panelTitle }}</span>
      <span class="close-btn" @click="$emit('close')">✖</span>
    </div>
    
    <div class="content">
      <!-- 卫星信息 -->
      <div v-if="entityType === 'satellite'" class="entity-details">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">{{ selectedEntity.id }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">轨道面:</div>
          <div class="info-value">{{ satelliteInfo.plane_id }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">卫星编号:</div>
          <div class="info-value">{{ satelliteInfo.sat_id }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">状态:</div>
          <div class="info-value">{{ satelliteInfo.is_active ? '活跃' : '非活跃' }}</div>
        </div>
        <div class="info-section-title">流量信息</div>
        <div class="info-row">
          <div class="info-label">下泄量:</div>
          <div class="info-value">{{ formatNumber(trafficInfo.downlink) }} Gbps</div>
        </div>
        <div class="info-row">
          <div class="info-label">流量通量:</div>
          <div class="info-value">{{ formatNumber(trafficInfo.throughput) }} Gbps</div>
        </div>
        <div class="info-section-title">位置信息</div>
        <div class="info-row">
          <div class="info-label">X:</div>
          <div class="info-value">{{ formatNumber(position.x) }} km</div>
        </div>
        <div class="info-row">
          <div class="info-label">Y:</div>
          <div class="info-value">{{ formatNumber(position.y) }} km</div>
        </div>
        <div class="info-row">
          <div class="info-label">Z:</div>
          <div class="info-value">{{ formatNumber(position.z) }} km</div>
        </div>
        <div class="info-section-title">连接信息</div>
        <div class="info-row">
          <div class="info-label">连接数:</div>
          <div class="info-value">{{ connections.length }}</div>
        </div>
        <div class="connections-list" v-if="connections.length > 0">
          <div v-for="(conn, index) in connections" :key="index" class="connection-item">
            {{ conn }}
          </div>
        </div>
      </div>
      
      <!-- 地面站信息 -->
      <div v-else-if="entityType === 'station'" class="entity-details">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">{{ selectedEntity.id }}</div>
        </div>
        <div class="info-section-title">位置信息</div>
        <div class="info-row">
          <div class="info-label">经度:</div>
          <div class="info-value">{{ formatNumber(position[0]) }}°</div>
        </div>
        <div class="info-row">
          <div class="info-label">纬度:</div>
          <div class="info-value">{{ formatNumber(position[1]) }}°</div>
        </div>
        <div class="info-section-title">连接信息</div>
        <div class="info-row">
          <div class="info-label">连接数:</div>
          <div class="info-value">{{ connections.length }}</div>
        </div>
        <div class="connections-list" v-if="connections.length > 0">
          <div v-for="(conn, index) in connections" :key="index" class="connection-item">
            {{ conn }}
          </div>
        </div>
      </div>
      
      <!-- ROADM信息 -->
      <div v-else-if="entityType === 'roadm'" class="entity-details">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">{{ selectedEntity.id }}</div>
        </div>
        <div class="info-section-title">位置信息</div>
        <div class="info-row">
          <div class="info-label">经度:</div>
          <div class="info-value">{{ formatNumber(position[0]) }}°</div>
        </div>
        <div class="info-row">
          <div class="info-label">纬度:</div>
          <div class="info-value">{{ formatNumber(position[1]) }}°</div>
        </div>
        <div class="info-section-title">连接信息</div>
        <div class="info-row">
          <div class="info-label">连接数:</div>
          <div class="info-value">{{ connections.length }}</div>
        </div>
        <div class="connections-list" v-if="connections.length > 0">
          <div v-for="(conn, index) in connections" :key="index" class="connection-item">
            {{ conn }}
          </div>
        </div>
      </div>
      
      <!-- 链路信息 -->
      <div v-else-if="entityType === 'link'" class="entity-details">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">{{ selectedEntity.id }}</div>
        </div>
        <div class="info-section-title">链路信息</div>
        <div class="info-row">
          <div class="info-label">源节点:</div>
          <div class="info-value">{{ selectedEntity.source }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">目标节点:</div>
          <div class="info-value">{{ selectedEntity.target }}</div>
        </div>
        <div v-if="selectedEntity.weight" class="info-row">
          <div class="info-label">权重:</div>
          <div class="info-value">{{ selectedEntity.weight }}</div>
        </div>
        <div v-if="selectedEntity.distance" class="info-row">
          <div class="info-label">距离:</div>
          <div class="info-value">{{ formatNumber(selectedEntity.distance) }} km</div>
        </div>
        <div v-if="selectedEntity.delay" class="info-row">
          <div class="info-label">延迟:</div>
          <div class="info-value">{{ formatNumber(selectedEntity.delay) }} ms</div>
        </div>
      </div>
      
      <!-- 未知实体类型 -->
      <div v-else class="entity-details">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">{{ selectedEntity.id }}</div>
        </div>
        <div class="info-row">
          <div class="info-label">类型:</div>
          <div class="info-value">未知</div>
        </div>
      </div>

      <!-- 承载业务信息 -->
      <div class="service-section">
        <div class="info-section-title">承载业务</div>
        <div class="services-list" v-if="carriedServices.length > 0">
          <div v-for="service in carriedServices" :key="service.id" class="service-item">
            <div class="service-header">{{ service.id }}</div>
            <div class="service-details">
              <div class="service-info">
                <span class="service-label">源节点:</span>
                <span class="service-value">{{ service.src }}</span>
              </div>
              <div class="service-info">
                <span class="service-label">目标节点:</span>
                <span class="service-value">{{ service.dst }}</span>
              </div>
              <div class="service-info">
                <span class="service-label">带宽:</span>
                <span class="service-value">{{ service.bandwidth }} Gbps</span>
              </div>
              <div class="service-info">
                <span class="service-label">状态:</span>
                <span class="service-value" :class="{'status-active': service.status === 'IN_SERVICE'}">
                  {{ service.status === 'IN_SERVICE' ? '运行中' : service.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-services-message">
          当前实体未承载任何业务
        </div>
      </div>
    </div>
  </div>
  <div v-else class="entity-info-panel empty-panel">
    <div class="empty-message">点击地球上的实体查看详细信息</div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  selectedEntity: Object,
  graphData: Object,
  serviceData: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close']);

// 存储流量数据
const downlinkData = ref(null);
const throughputData = ref(null);

// 加载流量数据
const loadTrafficData = async (timestamp) => {
  try {
    // 根据当前选择的文件夹读取对应的卫星流量数据
    const currentFolder = localStorage.getItem('selectedDataFolder');
    
    // 加载 downlink 数据
    const downlinkResponse = await fetch(`./data/${currentFolder}/satellite_traffic/satellite_downlink_${timestamp}.json`);
    if (downlinkResponse.ok) {
      downlinkData.value = await downlinkResponse.json();
      console.log(`EntityInfoPanel: 从 ${currentFolder} 加载 downlink 数据成功`);
    } else {
      console.warn(`无法加载 downlink 数据: ${timestamp} (文件夹: ${currentFolder})`);
      downlinkData.value = null;
    }
    
    // 加载 throughput 数据
    const throughputResponse = await fetch(`./data/${currentFolder}/satellite_traffic/satellite_throughput_${timestamp}.json`);
    if (throughputResponse.ok) {
      throughputData.value = await throughputResponse.json();
      console.log(`EntityInfoPanel: 从 ${currentFolder} 加载 throughput 数据成功`);
    } else {
      console.warn(`无法加载 throughput 数据: ${timestamp} (文件夹: ${currentFolder})`);
      throughputData.value = null;
    }
  } catch (error) {
    console.error('加载流量数据失败:', error);
    downlinkData.value = null;
    throughputData.value = null;
  }
};

// 监听 graphData 变化以获取当前时间戳
watch(() => props.graphData, (newData) => {
  if (newData && newData.timestamp !== undefined) {
    loadTrafficData(newData.timestamp);
  }
}, { immediate: true });

// 计算当前实体承载的业务
const carriedServices = computed(() => {
  if (!props.selectedEntity || !props.serviceData?.active_requests) return [];
  
  const entityId = props.selectedEntity.id;
  
  // 如果是链路，需要检查业务路径中是否包含该链路的首尾节点对
  if (entityType.value === 'link') {
    return props.serviceData.active_requests.filter(service => {
      const path = service.path;
      // 检查路径中是否存在连续的节点对与当前链路匹配
      for (let i = 0; i < path.length - 1; i++) {
        if (
          (path[i] === props.selectedEntity.source && path[i + 1] === props.selectedEntity.target) ||
          (path[i] === props.selectedEntity.target && path[i + 1] === props.selectedEntity.source)
        ) {
          return true;
        }
      }
      return false;
    }).map(service => ({
      id: service.request_id,
      bandwidth: service.bandwidth,
      src: service.src_node,
      dst: service.dst_node,
      status: service.status
    }));
  } 
  
  // 对于其他类型的实体，保持原有逻辑
  return props.serviceData.active_requests.filter(service => 
    service.path.includes(entityId)
  ).map(service => ({
    id: service.request_id,
    bandwidth: service.bandwidth,
    src: service.src_node,
    dst: service.dst_node,
    status: service.status
  }));
});

// 计算实体类型
const entityType = computed(() => {
  if (!props.selectedEntity) return null;
  // 优先使用 entityType 属性，如果没有则使用 type 属性
  return props.selectedEntity.entityType || props.selectedEntity.type;
});

// 计算面板标题
const panelTitle = computed(() => {
  if (!props.selectedEntity) return '实体信息';
  
  switch (entityType.value) {
    case 'satellite': return '卫星信息';
    case 'station': return '地面站信息';
    case 'roadm': return 'ROADM信息';
    case 'link': return '链路信息';
    default: return '实体信息';
  }
});

// 获取卫星信息
const satelliteInfo = computed(() => {
  if (!props.selectedEntity || !props.graphData || entityType.value !== 'satellite') {
    return {};
  }
  
  const nodeId = props.selectedEntity.id;
  const rawData = props.graphData.data?.graph_nodes?.[nodeId] || {};
  
  return {
    plane_id: rawData.plane_id,
    sat_id: rawData.sat_id,
    is_active: rawData.is_active
  };
});

// 获取位置信息
const position = computed(() => {
  if (!props.selectedEntity) return {};
  
  if (entityType.value === 'satellite') {
    const nodeId = props.selectedEntity.id;
    
    // 尝试从 selectedEntity 本身获取位置信息
    if (props.selectedEntity.position) {
      return {
        x: props.selectedEntity.position[0],
        y: props.selectedEntity.position[1],
        z: props.selectedEntity.position[2]
      };
    }
    
    // 如果没有找到，返回空对象
    return {};
  } else {
    // 对于地面站和 ROADM，位置信息可能在 position 数组中
    return props.selectedEntity.position || [];
  }
});

// 获取连接信息
const connections = computed(() => {
  if (!props.selectedEntity || !props.graphData) return [];
  
  const nodeId = props.selectedEntity.id;
  const connList = [];
  
  if (props.graphData.edges) {
    props.graphData.edges.forEach(edge => {
      if (edge.source === nodeId) {
        connList.push(`连接到: ${edge.target}`);
      } else if (edge.target === nodeId) {
        connList.push(`连接自: ${edge.source}`);
      }
    });
  }
  
  return connList;
});

// 获取流量信息
const trafficInfo = computed(() => {
  if (!props.selectedEntity || entityType.value !== 'satellite') {
    return {
      downlink: null,  // 改为 null，表示无数据
      throughput: null  // 改为 null，表示无数据
    };
  }
  
  const satelliteId = props.selectedEntity.id;
  
  return {
    downlink: downlinkData.value?.data?.[satelliteId] ?? null,  // 使用 ?? null
    throughput: throughputData.value?.data?.[satelliteId] ?? null  // 使用 ?? null
  };
});

// 格式化数字
function formatNumber(num) {
  // 优先检查 null/undefined，显示 NaN
  if (num === undefined || num === null) return 'NaN';
  // 检查是否为数字，如果不是也显示 NaN
  if (typeof num !== 'number' || isNaN(num)) return 'NaN';
  return parseFloat(num).toFixed(2);
}
</script>

<style scoped>
.entity-info-panel {
  background: var(--theme-bg-dark); /* 【修改】使用主题变量 */
  border-left: 1px solid var(--theme-border); /* 【修改】使用主题变量 */
  height: 100%;
  width: 300px;
  color: var(--theme-text-dark); /* 【修改】使用主题变量 */
  display: flex;
  flex-direction: column;
}

.header {
  font-weight: bold;
  padding: 10px 16px;
  background: var(--theme-secondary-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--theme-border); /* 【修改】使用主题变量 */
  color: var(--theme-text-dark); /* 【修改】使用主题变量 */
  letter-spacing: 1px;
}

.close-btn {
  cursor: pointer;
  font-size: 14px;
  color: var(--theme-border); /* 使用边框色 */
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--theme-accent); /* 使用强调色 */
}

.content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.entity-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  padding: 4px 0;
}

.info-label {
  width: 100px;
  font-weight: bold;
  color: var(--theme-border);
}

.info-value {
  flex: 1;
  text-align: right;
  color: var(--theme-main-text); /* 【修改】使用主题变量 */
}

.info-section-title {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: bold;
  color: var(--theme-accent);
  border-bottom: 1px solid var(--theme-border); /* 【修改】使用主题变量 */
  padding-bottom: 4px;
}

.connections-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.connection-item {
  padding: 4px 8px;
  background: var(--theme-main-bg);
  border-radius: 4px;
  font-size: 12px;
  color: var(--theme-text-dark); /* 【修改】使用主题变量 */
}

.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-dialog-bg);
}

.empty-message {
  color: var(--theme-border);
  font-style: italic;
}

.service-section {
  margin-top: 20px;
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.service-item {
  background: var(--theme-main-bg);
  border-radius: 6px;
  padding: 10px;
}

.service-header {
  color: var(--theme-accent);
  font-weight: bold;
  margin-bottom: 8px;
}

.service-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.service-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.service-label {
  color: var(--theme-border);
}

.service-value {
  color: var(--theme-main-text);
}

.status-active {
  color: #2ecc71;
}

.no-services-message {
  padding: 12px;
  text-align: center;
  color: var(--theme-border);
  background: var(--theme-main-bg);
  border-radius: 6px;
  font-size: 14px;
}
</style>