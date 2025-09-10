<template>
  <div class="object-viewer">
    <div class="header">
      <span>Object Viewer</span>
      <span class="close-btn" @click="handleClose">◄</span>
    </div>
    <div class="content">
      <!-- 显示当前进程ID -->
      <div v-if="currentProcessId" class="current-process">
        当前进程ID：{{ currentProcessId }}
      </div>
      
      <!-- 显示当前选择的数据文件夹 -->
      <div v-if="!currentProcessId && hasValidSelection()" class="current-folder">
        当前选择：{{ getCurrentFolderDisplay() }}
      </div>
      
      <!-- 显示当前加载的文件信息 -->
      <div v-if="!currentProcessId && hasValidSelection() && currentLoadedFiles" class="current-files">
        <div class="file-info">网络数据：{{ currentLoadedFiles.network || '未加载' }}</div>
        <div class="file-info">业务数据：{{ currentLoadedFiles.service || '未加载' }}</div>
      </div>
      
      <div class="category">
        <div class="category-header" @click="toggleCategory('satellite')">
          <div class="header-left">
            <span class="toggle-icon">{{ satelliteExpanded ? '▼' : '►' }}</span>
            <span>卫星组 ({{ satellites.length }})</span>
          </div>
          <div class="header-controls">
            <button 
              class="control-btn visibility-btn"
              :class="{ active: showSatellite }"
              @click.stop="toggleVisibility('satellite')"
              :title="showSatellite ? '隐藏卫星' : '显示卫星'"
            >
              {{ showSatellite ? '👁️' : '🚫' }}
            </button>
          </div>
        </div>
        <div v-if="satelliteExpanded" class="category-items">
          <div 
            v-for="satellite in satellites" 
            :key="satellite.id"
            class="item"
            :class="{ 'selected': selectedEntity === satellite.id }"
            @click="selectEntity(satellite.id)"
          >
            <div class="item-icon satellite-dot"></div>
            <span class="item-name">{{ satellite.id }}</span>
          </div>
          <div v-if="satellites.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('station')">
          <div class="header-left">
            <span class="toggle-icon">{{ stationExpanded ? '▼' : '►' }}</span>
            <span>地面站 ({{ stations.length }})</span>
          </div>
          <div class="header-controls">
            <button 
              class="control-btn visibility-btn"
              :class="{ active: showStation }"
              @click.stop="toggleVisibility('station')"
              :title="showStation ? '隐藏地面站' : '显示地面站'"
            >
              {{ showStation ? '👁️' : '🚫' }}
            </button>
          </div>
        </div>
        <div v-if="stationExpanded" class="category-items">
          <div 
            v-for="station in stations" 
            :key="station.id"
            class="item"
            :class="{ 'selected': selectedEntity === station.id }"
            @click="selectEntity(station.id)"
          >
            <div class="item-icon station-dot"></div>
            <span class="item-name">{{ station.id }}</span>
          </div>
          <div v-if="stations.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('roadm')">
          <div class="header-left">
            <span class="toggle-icon">{{ roadmExpanded ? '▼' : '►' }}</span>
            <span>ROADM ({{ roadms.length }})</span>
          </div>
          <div class="header-controls">
            <button 
              class="control-btn visibility-btn"
              :class="{ active: showRoadm }"
              @click.stop="toggleVisibility('roadm')"
              :title="showRoadm ? '隐藏ROADM' : '显示ROADM'"
            >
              {{ showRoadm ? '👁️' : '🚫' }}
            </button>
          </div>
        </div>
        <div v-if="roadmExpanded" class="category-items">
          <div 
            v-for="roadm in roadms" 
            :key="roadm.id"
            class="item"
            :class="{ 'selected': selectedEntity === roadm.id }"
            @click="selectEntity(roadm.id)"
          >
            <div class="item-icon roadm-dot"></div>
            <span class="item-name">{{ roadm.id }}</span>
          </div>
          <div v-if="roadms.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('link')">
          <div class="header-left">
            <span class="toggle-icon">{{ linkExpanded ? '▼' : '►' }}</span>
            <span>链路 ({{ links.length }})</span>
          </div>
          <div class="header-controls">
            <button 
              class="control-btn visibility-btn"
              :class="{ active: showLinks }"
              @click.stop="toggleVisibility('links')"
              :title="showLinks ? '隐藏链路' : '显示链路'"
            >
              {{ showLinks ? '👁️' : '🚫' }}
            </button>
          </div>
        </div>
        <div v-if="linkExpanded" class="category-items">
          <div 
            v-for="link in links" 
            :key="`${link.source}-${link.target}`"
            class="item"
            :class="{ 'selected': selectedEntity === `${link.source}-${link.target}` }"
            @click="selectEntity(`${link.source}-${link.target}`)"
          >
            <div class="item-icon link-dot"></div>
            <span class="item-name">{{ link.source }} → {{ link.target }}</span>
          </div>
          <div v-if="links.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, computed } from 'vue';

// 定义props和事件
const emit = defineEmits(['close', 'select-entity', 'update:showSatellite', 'update:showStation', 'update:showRoadm', 'update:showLinks']);

// 获取当前文件夹显示文本的方法
const currentFolderDisplay = ref('未选择');
// 当前加载的文件信息
const currentLoadedFiles = ref({
  network: null,
  service: null
});
// 标记用户是否已主动选择过文件夹
const hasUserSelected = ref(false);

function getCurrentFolderDisplay() {
  return currentFolderDisplay.value;
}

function hasValidSelection() {
  return hasUserSelected.value && currentFolderDisplay.value !== '未选择';
}

function updateCurrentFolderDisplay() {
  const folder = localStorage.getItem('selectedDataFolder');
  const userSelected = localStorage.getItem('hasUserSelectedFolder');
  
  currentFolderDisplay.value = folder || '未选择';
  hasUserSelected.value = userSelected === 'true';
}

// 更新当前加载的文件信息
function updateLoadedFiles(networkFile, serviceFile) {
  currentLoadedFiles.value.network = networkFile;
  currentLoadedFiles.value.service = serviceFile;
}

// 定义props
const props = defineProps({
  currentProcessId: {
    type: [String, Number],
    default: null
  },
  showSatellite: {
    type: Boolean,
    default: true
  },
  showStation: {
    type: Boolean,
    default: true
  },
  showRoadm: {
    type: Boolean,
    default: true
  },
  showLinks: {
    type: Boolean,
    default: true
  },
  selectedEntityId: {
    type: String,
    default: null
  }
});

// 注入数据加载器
const dataLoader = inject('dataLoader', null);

// 状态变量
const satellites = ref([]);
const stations = ref([]);
const roadms = ref([]);
const links = ref([]);

// 计算选中的实体ID
const selectedEntity = computed(() => props.selectedEntityId);

// 分类展开状态 - 默认收起
const satelliteExpanded = ref(false);
const stationExpanded = ref(false);
const roadmExpanded = ref(false);
const linkExpanded = ref(false);

// 切换分类展开状态
function toggleCategory(category) {
  switch(category) {
    case 'satellite':
      satelliteExpanded.value = !satelliteExpanded.value;
      break;
    case 'station':
      stationExpanded.value = !stationExpanded.value;
      break;
    case 'roadm':
      roadmExpanded.value = !roadmExpanded.value;
      break;
    case 'link':
      linkExpanded.value = !linkExpanded.value;
      break;
  }
}

// 切换显示状态
function toggleVisibility(type) {
  switch(type) {
    case 'satellite':
      emit('update:show-satellite', !props.showSatellite);
      break;
    case 'station':
      emit('update:show-station', !props.showStation);
      break;
    case 'roadm':
      emit('update:show-roadm', !props.showRoadm);
      break;
    case 'links':
      emit('update:show-links', !props.showLinks);
      break;
  }
}

// 选择实体
function selectEntity(entityId) {
  emit('select-entity', entityId);
}

// 处理关闭
function handleClose() {
  emit('close');
}

// 更新数据
function updateData(graphData) {
  if (!graphData || !graphData.nodes) return;
  
  satellites.value = graphData.nodes.filter(node => node.type === 'satellite');
  stations.value = graphData.nodes.filter(node => node.type === 'station');
  roadms.value = graphData.nodes.filter(node => node.type === 'roadm');
  
  // 处理链路数据
  if (graphData.edges) {
    links.value = graphData.edges;
  }
}

// 从本地文件加载数据（用于未登录状态）
async function loadLocalData(timeFrame = 60) {
  if (!dataLoader) return;
  
  try {
    const filename = `./data/network_state_${timeFrame}.00.json`;
    console.log(`ObjectViewer: 正在加载本地文件 ${filename}`);
    
    const localData = await dataLoader.loadGraphData(filename);
    if (localData) {
      updateData(localData);
      console.log('ObjectViewer: 本地数据加载成功');
      return localData;
    }
  } catch (error) {
    console.error('ObjectViewer: 加载本地数据失败:', error);
  }
  return null;
}

// 暴露方法给父组件
defineExpose({
  updateData,
  loadLocalData,
  updateLoadedFiles
});

// 初始化时尝试获取数据
onMounted(async () => {
  // 初始化当前文件夹显示
  updateCurrentFolderDisplay();
  
  // 添加文件夹变更事件监听器
  const handleDataFolderChange = (event) => {
    console.log('ObjectViewer: 检测到文件夹变更事件');
    updateCurrentFolderDisplay();
  };
  
  window.addEventListener('data-folder-changed', handleDataFolderChange);
  
  // 移除自动加载逻辑，等待用户选择文件夹或进程
  console.log('ObjectViewer: 等待用户选择数据源...');
});
</script>

<style scoped>
.object-viewer {
  width: 280px;
  height: 100%;
  background: #232323;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  color: #f1f1f1;
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
  padding: 0;
  overflow: auto;
}
.category {
  border-bottom: 1px solid #333;
}
.category-header {
  padding: 12px 16px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2a2a2a;
}
.category-header:hover {
  background: #333;
}
.toggle-icon {
  margin-right: 8px;
  font-size: 12px;
}
.category-items {
  padding: 8px 0;
}
.item {
  padding: 8px 16px 8px 32px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
}
.item:hover {
  background: #333;
}
.item.selected {
  background: #3498db;
  color: white;
}
.item-icon {
  width: 12px;
  height: 12px;
  margin-right: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.satellite-dot {
  background-color: #e74c3c; /* 红色 - 卫星 */
  box-shadow: 0 0 4px rgba(231, 76, 60, 0.5);
}

.station-dot {
  background-color: #2ecc71; /* 绿色 - 地面站 */
  box-shadow: 0 0 4px rgba(46, 204, 113, 0.5);
}

.roadm-dot {
  background-color: #f39c12; /* 橙色 - ROADM */
  box-shadow: 0 0 4px rgba(243, 156, 18, 0.5);
}

.link-dot {
  background-color: #9b59b6; /* 紫色 - 链路 */
  box-shadow: 0 0 4px rgba(155, 89, 182, 0.5);
}

/* 选中状态下的特殊效果 */
.item.selected .item-icon {
  background-color: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

.link-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.item-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty-message {
  padding: 8px 16px 8px 32px;
  font-style: italic;
  color: #888;
  font-size: 14px;
}

.current-process {
  padding: 12px 16px;
  background: #1a4a7a;
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid #333;
  margin-bottom: 8px;
}

.current-folder {
  padding: 12px 16px;
  background: #1a7a4a;
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid #333;
  margin-bottom: 8px;
  border-left: 4px solid #4CAF50;
}

.current-files {
  padding: 8px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #333;
  margin-bottom: 8px;
}

.file-info {
  font-size: 12px;
  color: #ccc;
  margin: 2px 0;
  padding: 2px 0;
  font-family: monospace;
}

/* 分类头部样式更新 */
.category-header {
  padding: 12px 16px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2a2a2a;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.control-btn {
  padding: 4px 8px;
  border: 1px solid #555;
  background: #404040;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  background: #505050;
  border-color: #777;
}

.control-btn.active {
  background: #3498db;
  border-color: #2980b9;
  color: white;
}

.visibility-btn {
  font-size: 14px;
}
</style>