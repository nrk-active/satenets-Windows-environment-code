<!-- src/components/ServicePanel.vue -->
<template>
  <div class="service-panel">
    <div class="service-header">
      <h3>业务列表</h3>
      <div class="service-stats">
        活跃: {{ serviceData.active_requests?.length || 0 }} | 
        待处理: {{ serviceData.pending_requests?.length || 0 }} |
        失败: {{ serviceData.failed_requests?.length || 0 }}
      </div>
      <span class="close-btn" @click="$emit('close')">▼</span>
    </div>
    <div class="service-list">
      <!-- 活跃业务 -->
      <div v-if="serviceData.active_requests?.length" class="service-category">
        <h4>活跃业务</h4>
        <div v-for="request in serviceData.active_requests" 
             :key="generateServiceId(request)" 
             class="service-item active" 
             @click="$emit('selectService', request, 'active')">
          <span class="service-id">ID: {{ request.id || generateServiceId(request) }}</span>
          <span class="service-status">活跃</span>
        </div>
      </div>

      <!-- 待处理业务 -->
      <div v-if="serviceData.pending_requests?.length" class="service-category">
        <h4>待处理业务</h4>
        <div v-for="request in serviceData.pending_requests" 
             :key="generateServiceId(request)" 
             class="service-item pending" 
             @click="$emit('selectService', request, 'pending')">
          <span class="service-id">ID: {{ request.id || generateServiceId(request) }}</span>
          <span class="service-status">待处理</span>
        </div>
      </div>

      <!-- 失败业务 -->
      <div v-if="serviceData.failed_requests?.length" class="service-category">
        <h4>失败业务</h4>
        <div v-for="request in serviceData.failed_requests" 
             :key="generateServiceId(request)" 
             class="service-item failed" 
             @click="$emit('selectService', request, 'failed')">
          <span class="service-id">ID: {{ request.id || generateServiceId(request) }}</span>
          <span class="service-status">失败</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  serviceData: Object,
  generateServiceId: Function
});

defineEmits(['selectService', 'close']);
</script>

<style scoped>
.service-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  background-color: rgba(30, 30, 30, 0.9);
  border-top: 1px solid #555;
  color: white;
  z-index: 1000;
  overflow: hidden;
}

.service-header {
  padding: 10px 15px;
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.service-header h3 {
  margin: 0;
  font-size: 16px;
  flex: 0 0 auto;
}

.service-stats {
  font-size: 12px;
  color: #ccc;
  flex: 1;
  text-align: center;
}

.close-btn {
  cursor: pointer;
  font-size: 14px;
  color: #aaa;
  transition: color 0.2s;
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 2px;
}

.close-btn:hover {
  color: #f39c12;
  background-color: rgba(255, 255, 255, 0.1);
}

.service-list {
  height: calc(100% - 50px);
  overflow-y: auto;
  padding: 10px;
  display: flex;
  gap: 20px;
}

.service-category {
  flex: 1;
  min-width: 200px;
}

.service-category h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #999;
  border-bottom: 1px solid #444;
  padding-bottom: 5px;
}

.service-item {
  padding: 8px 10px;
  margin-bottom: 5px;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.service-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.service-item.active {
  background-color: rgba(76, 175, 80, 0.2);
  border-left: 3px solid #4CAF50;
}

.service-item.pending {
  background-color: rgba(255, 193, 7, 0.2);
  border-left: 3px solid #FFC107;
}

.service-item.failed {
  background-color: rgba(244, 67, 54, 0.2);
  border-left: 3px solid #F44336;
}

.service-id {
  font-weight: bold;
}

.service-status {
  font-size: 11px;
  opacity: 0.8;
}
</style>