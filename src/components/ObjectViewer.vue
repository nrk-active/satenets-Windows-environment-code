<template>
  <div class="object-viewer">
    <div class="header">
      <span>Object Viewer</span>
      <span class="close-btn" @click="$emit('close')">✖</span>
    </div>
    <div class="content">
      <div class="category">
        <div class="category-header" @click="toggleCategory('satellite')">
          <span class="toggle-icon">{{ satelliteExpanded ? '▼' : '►' }}</span>
          <span>卫星组</span>
        </div>
        <div v-if="satelliteExpanded" class="category-items">
          <div 
            v-for="satellite in satellites" 
            :key="satellite.id"
            class="item"
            :class="{ 'selected': selectedEntity === satellite.id }"
            @click="selectEntity(satellite.id)"
          >
            <img src="/satellite_model/Satellite.gltf" class="item-icon" alt="卫星" />
            <span class="item-name">{{ satellite.id }}</span>
          </div>
          <div v-if="satellites.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('station')">
          <span class="toggle-icon">{{ stationExpanded ? '▼' : '►' }}</span>
          <span>地面站</span>
        </div>
        <div v-if="stationExpanded" class="category-items">
          <div 
            v-for="station in stations" 
            :key="station.id"
            class="item"
            :class="{ 'selected': selectedEntity === station.id }"
            @click="selectEntity(station.id)"
          >
            <img src="/satellite_model/地面站.png" class="item-icon" alt="地面站" />
            <span class="item-name">{{ station.id }}</span>
          </div>
          <div v-if="stations.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('roadm')">
          <span class="toggle-icon">{{ roadmExpanded ? '▼' : '►' }}</span>
          <span>ROADM</span>
        </div>
        <div v-if="roadmExpanded" class="category-items">
          <div 
            v-for="roadm in roadms" 
            :key="roadm.id"
            class="item"
            :class="{ 'selected': selectedEntity === roadm.id }"
            @click="selectEntity(roadm.id)"
          >
            <img src="/satellite_model/核心交换机.png" class="item-icon" alt="ROADM" />
            <span class="item-name">{{ roadm.id }}</span>
          </div>
          <div v-if="roadms.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>

      <div class="category">
        <div class="category-header" @click="toggleCategory('link')">
          <span class="toggle-icon">{{ linkExpanded ? '▼' : '►' }}</span>
          <span>链路</span>
        </div>
        <div v-if="linkExpanded" class="category-items">
          <div v-if="links.length === 0" class="empty-message">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';

// 定义props和事件
const emit = defineEmits(['close', 'select-entity']);

// 注入数据加载器
const dataLoader = inject('dataLoader', null);

// 状态变量
const satellites = ref([]);
const stations = ref([]);
const roadms = ref([]);
const links = ref([]);
const selectedEntity = ref(null);

// 分类展开状态
const satelliteExpanded = ref(true);
const stationExpanded = ref(true);
const roadmExpanded = ref(true);
const linkExpanded = ref(true);

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

// 选择实体
function selectEntity(entityId) {
  selectedEntity.value = entityId;
  emit('select-entity', entityId);
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

// 暴露方法给父组件
defineExpose({
  updateData
});

// 初始化时尝试获取数据
onMounted(() => {
  if (dataLoader) {
    const cachedData = dataLoader.dataCache.get('./data/network_state_60.00.json');
    if (cachedData) {
      updateData(cachedData);
    }
  }
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
  width: 20px;
  height: 20px;
  margin-right: 8px;
  object-fit: contain;
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
</style>