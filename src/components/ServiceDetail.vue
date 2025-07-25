<!-- src/components/ServiceDetail.vue -->
<template>
  <div class="service-detail-panel">
    <div class="service-detail-header">
      <h3>业务详情</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="service-detail-content">
      <div class="detail-item">
        <label>业务ID:</label>
        <span>{{ selectedService.data.id || '未知' }}</span>
      </div>
      <div class="detail-item">
        <label>状态:</label>
        <span class="status" :class="selectedService.type">{{ getStatusText(selectedService.type) }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.source">
        <label>源节点:</label>
        <span>{{ selectedService.data.source }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.destination">
        <label>目标节点:</label>
        <span>{{ selectedService.data.destination }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.bandwidth">
        <label>带宽要求:</label>
        <span>{{ selectedService.data.bandwidth }} Mbps</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.start_time">
        <label>开始时间:</label>
        <span>{{ selectedService.data.start_time }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.end_time">
        <label>结束时间:</label>
        <span>{{ selectedService.data.end_time }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.failed_at">
        <label>失败时间:</label>
        <span>{{ selectedService.data.failed_at }}</span>
      </div>
      <div class="detail-item" v-if="selectedService.data.path">
        <label>路径:</label>
        <div class="path-info">
          <div v-for="(node, index) in selectedService.data.path" :key="index" class="path-node">
            {{ node }}{{ index < selectedService.data.path.length - 1 ? ' → ' : '' }}
          </div>
        </div>
      </div>
      <!-- 显示所有其他字段 -->
      <div class="detail-item" v-for="(value, key) in getOtherFields(selectedService.data)" :key="key">
        <label>{{ formatFieldName(key) }}:</label>
        <span>{{ formatFieldValue(value) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  selectedService: {
    type: Object,
    required: true
  }
});

defineEmits(['close']);

// 获取状态文本
function getStatusText(type) {
  const statusMap = {
    'active': '活跃',
    'pending': '待处理',
    'failed': '失败',
    'ended': '已结束',
    'blocked': '被阻塞'
  };
  return statusMap[type] || type;
}

// 获取其他字段（排除已显示的字段）
function getOtherFields(data) {
  const excludeFields = ['id', 'source', 'destination', 'bandwidth', 'start_time', 'end_time', 'failed_at', 'path'];
  const otherFields = {};
  
  Object.keys(data).forEach(key => {
    if (!excludeFields.includes(key) && data[key] !== null && data[key] !== undefined) {
      otherFields[key] = data[key];
    }
  });
  
  return otherFields;
}

// 格式化字段名
function formatFieldName(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// 格式化字段值
function formatFieldValue(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
</script>

<style scoped>
.service-detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 350px;
  height: 100%;
  background-color: rgba(20, 20, 20, 0.95);
  border-left: 1px solid #555;
  color: white;
  z-index: 1001;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.service-detail-header {
  padding: 15px;
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(40, 40, 40, 0.8);
}

.service-detail-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.service-detail-content {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.detail-item {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #333;
  animation: fadeIn 0.3s ease-in;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: #aaa;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-item span {
  color: white;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status.active {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid #4CAF50;
}

.status.pending {
  background-color: rgba(255, 193, 7, 0.2);
  color: #FFC107;
  border: 1px solid #FFC107;
}

.status.failed {
  background-color: rgba(244, 67, 54, 0.2);
  color: #F44336;
  border: 1px solid #F44336;
}

.status.ended {
  background-color: rgba(158, 158, 158, 0.2);
  color: #9E9E9E;
  border: 1px solid #9E9E9E;
}

.status.blocked {
  background-color: rgba(255, 87, 34, 0.2);
  color: #FF5722;
  border: 1px solid #FF5722;
}

.path-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border-left: 3px solid #2196F3;
}

.path-node {
  background-color: rgba(33, 150, 243, 0.2);
  color: #2196F3;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  border: 1px solid rgba(33, 150, 243, 0.3);
  transition: all 0.2s ease;
}

.path-node:hover {
  background-color: rgba(33, 150, 243, 0.3);
  border-color: #2196F3;
}

/* 滚动条样式 */
.service-detail-content::-webkit-scrollbar {
  width: 6px;
}

.service-detail-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.service-detail-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.service-detail-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .service-detail-panel {
    width: 100%;
    right: 0;
  }
}

/* JSON 格式化显示 */
.detail-item span:has-text("{\n") {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 8px;
  border-radius: 4px;
  display: block;
  margin-top: 5px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}
</style>