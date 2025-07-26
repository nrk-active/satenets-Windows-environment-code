<template>
  <!-- 根据登录状态显示登录页面或主界面 -->
  <LoginPage 
    v-if="!isLoggedIn && !isGuestMode" 
    @login-success="handleLoginSuccess" 
    @guest-login="handleGuestLogin" 
  />
  <template v-else>
    <NavigationBar 
      @simulation-data-selected="handleDataSelection" 
      :isLoggedIn="isLoggedIn" 
      :username="username" 
      @logout="handleLogout"
      @login-success="handleLoginSuccess"
    />
    <div class="main-content-flex">
      <ObjectViewer ref="objectViewerRef" @select-entity="handleEntitySelection" />
      <div class="main-center-content">
        <SatelliteViewer ref="satelliteViewerRef" />
        <LatencyTable />
        <SimulationDataPanel 
          :visible="showDataPanel"
          :selectedData="selectedSimulationData"
          @close="showDataPanel = false"
        />
      </div>
      <EntityInfoPanel 
        :selectedEntity="selectedEntity" 
        :graphData="selectedEntityRawData"
        @close="clearSelectedEntity" 
      />
    </div>
    <!-- <ServerData /> -->
  </template>
</template>

<script setup>
import NavigationBar from "./components/navigation-bar.vue";
import SatelliteViewer from "./components/SatelliteViewer.vue";
// import LatencyTable from "./components/LatencyTable.vue";
import SimulationDataPanel from "./components/SimulationDataPanel.vue";
import ObjectViewer from "./components/ObjectViewer.vue";
import EntityInfoPanel from "./components/EntityInfoPanel.vue";
// import ServerData from './components/serverdata.vue';
import LoginPage from './components/LoginPage.vue';
import { ref, provide, onMounted, watch } from 'vue';
import { useDataLoader } from './composables/useDataLoader.js';

// 登录状态管理
const isLoggedIn = ref(false);
const username = ref('');
const isGuestMode = ref(false); // 新增：游客模式标志

// 提供登录状态给子组件
provide('isLoggedIn', isLoggedIn);
provide('username', username);
provide('isGuestMode', isGuestMode);

// 处理登录成功
function handleLoginSuccess(user) {
  isLoggedIn.value = true;
  isGuestMode.value = false; // 正常登录时关闭游客模式
  username.value = user;
}

// 处理游客登录
function handleGuestLogin() {
  isGuestMode.value = true; // 开启游客模式
  isLoggedIn.value = false; // 游客模式下不是登录状态
}

// 处理登出
function handleLogout() {
  isLoggedIn.value = false;
  username.value = '';
  isGuestMode.value = true; // 退出登录后进入游客模式，而不是回到登录页面
}

const showDataPanel = ref(false);
const selectedSimulationData = ref({
  networkCongestion: false,
  averageDelay: false,
  switchCount: false
});

const handleDataSelection = (data) => {
  selectedSimulationData.value = data;
  showDataPanel.value = true;
};

// 引用组件实例
const objectViewerRef = ref(null);
const satelliteViewerRef = ref(null);

// 初始化数据加载器
const { loadGraphData, dataCache } = useDataLoader();

// 提供数据加载器给子组件
provide('dataLoader', { loadGraphData, dataCache });

// 选中的实体信息
const selectedEntity = ref(null);
const selectedEntityRawData = ref(null);

// 处理实体选择
function handleEntitySelection(entityId) {
  if (satelliteViewerRef.value) {
    // 调用SatelliteViewer中的方法高亮显示选中的实体
    const result = satelliteViewerRef.value.highlightEntity(entityId);
    
    if (result) {
      selectedEntity.value = result.entity;
      selectedEntityRawData.value = result.rawData;
    }
  }
}

// 清除选中的实体
function clearSelectedEntity() {
  selectedEntity.value = null;
  selectedEntityRawData.value = null;
}

// 监听数据加载
onMounted(async () => {
  // 加载初始数据
  const initialData = await loadGraphData('./data/network_state_60.00.json');
  
  // 更新ObjectViewer中的数据
  if (initialData && objectViewerRef.value) {
    objectViewerRef.value.updateData(initialData);
  }
  
  // 监听数据缓存变化，当有新数据加载时更新ObjectViewer
  watch(() => dataCache.size, () => {
    const latestData = dataCache.get('./data/network_state_60.00.json');
    if (latestData && objectViewerRef.value) {
      objectViewerRef.value.updateData(latestData);
    }
  });
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main-content-flex {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-center-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>