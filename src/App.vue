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
      <!-- 左侧面板区域 -->
      <ObjectViewer 
        v-if="showLeftPanel"
        ref="objectViewerRef" 
        @select-entity="handleEntitySelection"
        @close="handleLeftPanelClose"
      />
      <LeftCollapsedSidebar 
        v-else 
        @reopen="reopenLeftPanel"
      />
      
      <!-- 中间内容区域 -->
      <div class="main-center-content">
        <SatelliteViewer ref="satelliteViewerRef" />
        <SimulationDataPanel 
          :visible="showDataPanel"
          :selectedData="selectedSimulationData"
          @close="showDataPanel = false"
        />
      </div>
      
      <!-- 右侧面板区域 -->
      <EntityInfoPanel 
        v-if="showRightPanel"
        :selectedEntity="selectedEntity" 
        :graphData="selectedEntityRawData"
        @close="handleRightPanelClose" 
      />
      <RightCollapsedSidebar 
        v-else-if="!showRightPanel && selectedEntity" 
        @reopen="reopenRightPanel"
      />
    </div>
    <!-- <ServerData /> -->
  </template>
</template>

<script setup>
import NavigationBar from "./components/navigation-bar.vue";
import SatelliteViewer from "./components/SatelliteViewer.vue";
import SimulationDataPanel from "./components/SimulationDataPanel.vue";
import ObjectViewer from "./components/ObjectViewer.vue";
import EntityInfoPanel from "./components/EntityInfoPanel.vue";
import LeftCollapsedSidebar from "./components/LeftCollapsedSidebar.vue";
import RightCollapsedSidebar from "./components/RightCollapsedSidebar.vue";
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

// 添加侧边栏显示状态管理
const showLeftPanel = ref(true);
const showRightPanel = ref(false);

// 处理实体选择
function handleEntitySelection(entityId) {
  if (satelliteViewerRef.value) {
    // 调用SatelliteViewer中的方法高亮显示选中的实体
    const result = satelliteViewerRef.value.highlightEntity(entityId);
    
    if (result) {
      selectedEntity.value = result.entity;
      selectedEntityRawData.value = result.rawData;
      // 选择实体时自动展开右侧面板和左侧面板
      showRightPanel.value = true;
      showLeftPanel.value = true;
    }
  }
}

// 清除选中的实体
function clearSelectedEntity() {
  selectedEntity.value = null;
  selectedEntityRawData.value = null;
}

// 处理左侧面板关闭
function handleLeftPanelClose() {
  showLeftPanel.value = false;
}

// 处理右侧面板关闭  
function handleRightPanelClose() {
  showRightPanel.value = false;
  // 不清除选中的实体，保留数据以便重新打开
}

// 重新打开左侧面板
function reopenLeftPanel() {
  showLeftPanel.value = true;
}

// 重新打开右侧面板
function reopenRightPanel() {
  showRightPanel.value = true;
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
  transition: all 0.3s ease;
}

.main-center-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  min-width: 0; /* 确保flex子项能够收缩 */
}
</style>