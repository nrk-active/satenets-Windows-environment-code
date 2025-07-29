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
  graphData: Object
});

const emit = defineEmits(['close']);

// 计算实体类型
const entityType = computed(() => {
  if (!props.selectedEntity) return null;
  return props.selectedEntity.type;
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
    const posData = props.graphData.data?.satellite_positions_summary?.[nodeId]?.current_position || 
                   props.graphData.data?.graph_nodes?.[nodeId]?.current_position || {};
    return posData;
  } else {
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
</style>