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
import { computed, ref } from 'vue';

const props = defineProps({
  selectedEntity: Object,
  graphData: Object,
  serviceData: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close']);

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

// 格式化数字
function formatNumber(num) {
  if (num === undefined || num === null) return 'N/A';
  return parseFloat(num).toFixed(2);
}
</script>

<style scoped>
.entity-info-panel {
  background: #232323;
  border-left: 1px solid #333;
  height: 100%;
  width: 300px;
  color: #f1f1f1;
  display: flex;
  flex-direction: column;
}

.header {
  font-weight: bold;
  padding: 10px 16px;
  background: #181818;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
  color: #fff;
  letter-spacing: 1px;
}

.close-btn {
  cursor: pointer;
  font-size: 14px;
  color: #aaa;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f39c12;
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
  color: #aaa;
}

.info-value {
  flex: 1;
  text-align: right;
}

.info-section-title {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: bold;
  color: #ffd700;
  border-bottom: 1px solid #444;
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
  background: #2a2a2a;
  border-radius: 4px;
  font-size: 12px;
}

.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-message {
  color: #888;
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
  background: #2a2a2a;
  border-radius: 6px;
  padding: 10px;
}

.service-header {
  color: #f39c12;
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
  color: #aaa;
}

.service-value {
  color: #fff;
}

.status-active {
  color: #2ecc71;
}

.no-services-message {
  padding: 12px;
  text-align: center;
  color: #888;
  background: #2a2a2a;
  border-radius: 6px;
  font-size: 14px;
}
</style>