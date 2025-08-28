<template>
  <div class="service-path-panel">
    <div class="panel-header">
      <h3>业务路径控制</h3>
      <button @click="togglePanel" class="toggle-btn">
        {{ isPanelOpen ? '收起' : '展开' }}
      </button>
    </div>
    
    <div v-show="isPanelOpen" class="panel-content">
      <!-- 总体控制 -->
      <div class="control-section">
        <div class="control-row">
          <button @click="drawAllPaths" class="action-btn draw-btn" :disabled="!hasServiceData">
            绘制所有路径
          </button>
          <button @click="clearAllPaths" class="action-btn clear-btn">
            清除所有路径
          </button>
        </div>
      </div>
      
      <!-- 业务类型过滤 -->
      <div class="control-section">
        <h4>业务类型显示</h4>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="pathOptions.showActive" />
            <span class="checkmark active"></span>
            <span class="label-text">活跃业务 ({{ serviceStats.active }})</span>
          </label>
          
          <label class="checkbox-item">
            <input type="checkbox" v-model="pathOptions.showPending" />
            <span class="checkmark pending"></span>
            <span class="label-text">待处理业务 ({{ serviceStats.pending }})</span>
          </label>
          
          <label class="checkbox-item">
            <input type="checkbox" v-model="pathOptions.showBlocked" />
            <span class="checkmark blocked"></span>
            <span class="label-text">阻塞业务 ({{ serviceStats.blocked }})</span>
          </label>
          
          <label class="checkbox-item">
            <input type="checkbox" v-model="pathOptions.showEnded" />
            <span class="checkmark ended"></span>
            <span class="label-text">已结束业务 ({{ serviceStats.ended }})</span>
          </label>
          
          <label class="checkbox-item">
            <input type="checkbox" v-model="pathOptions.showFailed" />
            <span class="checkmark failed"></span>
            <span class="label-text">失败业务 ({{ serviceStats.failed }})</span>
          </label>
        </div>
      </div>
      
      <!-- 路径数量控制 -->
      <div class="control-section">
        <h4>最大显示路径数</h4>
        <div class="slider-container">
          <input 
            type="range" 
            v-model="pathOptions.maxPaths" 
            min="1" 
            max="50" 
            step="1"
            class="path-slider"
          />
          <span class="slider-value">{{ pathOptions.maxPaths }}</span>
        </div>
      </div>
      
      <!-- 实时更新控制 -->
      <div class="control-section">
        <div class="control-row">
          <label class="checkbox-item">
            <input type="checkbox" v-model="autoUpdate" />
            <span class="checkmark auto"></span>
            <span class="label-text">自动更新路径</span>
          </label>
        </div>
      </div>
      
      <!-- 业务列表 -->
      <div class="control-section">
        <h4>业务列表</h4>
        <div class="service-list">
          <div 
            v-for="service in displayedServices" 
            :key="service.request_id"
            class="service-item"
            :class="getServiceStatusClass(service.status)"
            @click="selectService(service)"
          >
            <div class="service-info">
              <span class="service-id">{{ service.request_id }}</span>
              <span class="service-path">{{ service.src_node }} → {{ service.dst_node }}</span>
            </div>
            <div class="service-actions">
              <button @click.stop="drawSinglePath(service)" class="mini-btn draw">
                绘制
              </button>
              <button @click.stop="clearSinglePath(service)" class="mini-btn clear">
                清除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export default {
  name: 'ServicePathPanel',
  props: {
    viewer: {
      type: Object,
      default: null
    },
    serviceData: {
      type: Object,
      default: () => ({
        active_requests: [],
        pending_requests: [],
        ended_requests: [],
        blocked_requests: [],
        failed_requests: []
      })
    },
    networkData: {
      type: Object,
      default: null
    },
    drawServicePath: {
      type: Function,
      required: true
    },
    clearServicePath: {
      type: Function,
      required: true
    },
    clearAllServicePaths: {
      type: Function,
      required: true
    },
    clearAllServicePathsAndCache: {
      type: Function,
      default: null
    },
    drawMultipleServicePaths: {
      type: Function,
      required: true
    }
  },
  emits: ['service-selected'],
  setup(props, { emit }) {
    const isPanelOpen = ref(true);
    const autoUpdate = ref(false);
    
    const pathOptions = ref({
      showActive: true,
      showPending: true,
      showBlocked: true,
      showEnded: false,
      showFailed: false,
      maxPaths: 10
    });
    
    // 计算属性
    const hasServiceData = computed(() => {
      return props.serviceData && Object.values(props.serviceData).some(arr => arr.length > 0);
    });
    
    const serviceStats = computed(() => {
      return {
        active: props.serviceData.active_requests?.length || 0,
        pending: props.serviceData.pending_requests?.length || 0,
        blocked: props.serviceData.blocked_requests?.length || 0,
        ended: props.serviceData.ended_requests?.length || 0,
        failed: props.serviceData.failed_requests?.length || 0
      };
    });
    
    const displayedServices = computed(() => {
      const services = [];
      
      if (pathOptions.value.showActive && props.serviceData.active_requests) {
        services.push(...props.serviceData.active_requests);
      }
      if (pathOptions.value.showPending && props.serviceData.pending_requests) {
        services.push(...props.serviceData.pending_requests);
      }
      if (pathOptions.value.showBlocked && props.serviceData.blocked_requests) {
        services.push(...props.serviceData.blocked_requests);
      }
      if (pathOptions.value.showEnded && props.serviceData.ended_requests) {
        services.push(...props.serviceData.ended_requests);
      }
      if (pathOptions.value.showFailed && props.serviceData.failed_requests) {
        services.push(...props.serviceData.failed_requests);
      }
      
      return services.slice(0, pathOptions.value.maxPaths);
    });
    
    // 方法
    function togglePanel() {
      isPanelOpen.value = !isPanelOpen.value;
    }
    
    function drawAllPaths() {
      if (!props.viewer || !props.networkData || !hasServiceData.value) return;
      
      props.clearAllServicePaths(props.viewer);
      props.drawMultipleServicePaths(props.viewer, props.serviceData, props.networkData, pathOptions.value);
    }
    
    function clearAllPaths() {
      if (!props.viewer) return;
      // 使用 clearAllServicePathsAndCache 来彻底清除路径和缓存
      if (props.clearAllServicePathsAndCache) {
        props.clearAllServicePathsAndCache(props.viewer);
      } else {
        // 兼容旧版本，如果没有提供 clearAllServicePathsAndCache 函数
        props.clearAllServicePaths(props.viewer);
      }
    }
    
    function drawSinglePath(service) {
      if (!props.viewer || !props.networkData) return;
      props.drawServicePath(props.viewer, service, props.networkData);
    }
    
    function clearSinglePath(service) {
      if (!props.viewer) return;
      props.clearServicePath(props.viewer, service.request_id);
    }
    
    function selectService(service) {
      emit('service-selected', service);
    }
    
    function getServiceStatusClass(status) {
      switch (status) {
        case 'IN_SERVICE': return 'status-active';
        case 'PENDING': return 'status-pending';
        case 'BLOCKED': return 'status-blocked';
        case 'ENDED': return 'status-ended';
        case 'FAILED': return 'status-failed';
        default: return '';
      }
    }
    
    // 监听选项变化，自动更新路径
    watch(pathOptions, () => {
      if (autoUpdate.value) {
        drawAllPaths();
      }
    }, { deep: true });
    
    return {
      isPanelOpen,
      autoUpdate,
      pathOptions,
      hasServiceData,
      serviceStats,
      displayedServices,
      togglePanel,
      drawAllPaths,
      clearAllPaths,
      drawSinglePath,
      clearSinglePath,
      selectService,
      getServiceStatusClass
    };
  }
};
</script>

<style scoped>
.service-path-panel {
  position: absolute;
  top: 80px;
  right: 20px;
  width: 320px;
  background: rgba(42, 42, 42, 0.95);
  border: 1px solid #555;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #555;
  background: rgba(33, 33, 33, 0.9);
  border-radius: 8px 8px 0 0;
}

.panel-header h3 {
  margin: 0;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #888;
}

.panel-content {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.control-section {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.control-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.control-section h4 {
  margin: 0 0 8px 0;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.control-row {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.draw-btn {
  background: #4CAF50;
  color: white;
}

.draw-btn:hover:not(:disabled) {
  background: #45a049;
}

.clear-btn {
  background: #f44336;
  color: white;
}

.clear-btn:hover {
  background: #da190b;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.checkbox-item input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  margin-right: 8px;
  position: relative;
  transition: all 0.2s ease;
}

.checkmark.active {
  background: rgba(76, 175, 80, 0.3);
  border: 2px solid #4CAF50;
}

.checkmark.pending {
  background: rgba(255, 193, 7, 0.3);
  border: 2px solid #FFC107;
}

.checkmark.blocked {
  background: rgba(244, 67, 54, 0.3);
  border: 2px solid #f44336;
}

.checkmark.ended {
  background: rgba(158, 158, 158, 0.3);
  border: 2px solid #9e9e9e;
}

.checkmark.failed {
  background: rgba(139, 0, 0, 0.3);
  border: 2px solid #8b0000;
}

.checkmark.auto {
  background: rgba(33, 150, 243, 0.3);
  border: 2px solid #2196F3;
}

.checkbox-item input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  position: absolute;
  left: 2px;
  top: -2px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.label-text {
  color: #ccc;
  font-size: 12px;
  user-select: none;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.path-slider {
  flex: 1;
  height: 4px;
  background: #666;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.path-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #2196F3;
  border-radius: 50%;
  cursor: pointer;
}

.slider-value {
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  min-width: 24px;
  text-align: center;
}

.service-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #555;
  border-radius: 4px;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s ease;
}

.service-item:last-child {
  border-bottom: none;
}

.service-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.service-item.status-active {
  border-left: 3px solid #4CAF50;
}

.service-item.status-pending {
  border-left: 3px solid #FFC107;
}

.service-item.status-blocked {
  border-left: 3px solid #f44336;
}

.service-item.status-ended {
  border-left: 3px solid #9e9e9e;
}

.service-item.status-failed {
  border-left: 3px solid #8b0000;
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.service-id {
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.service-path {
  color: #aaa;
  font-size: 10px;
}

.service-actions {
  display: flex;
  gap: 4px;
}

.mini-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.mini-btn.draw {
  background: #4CAF50;
  color: white;
}

.mini-btn.draw:hover {
  background: #45a049;
}

.mini-btn.clear {
  background: #f44336;
  color: white;
}

.mini-btn.clear:hover {
  background: #da190b;
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar,
.service-list::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.service-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb,
.service-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover,
.service-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
