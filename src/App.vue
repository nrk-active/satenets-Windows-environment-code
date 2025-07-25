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
      <ObjectViewer />
      <div class="main-center-content">
        <SatelliteViewer />
        <LatencyTable />
        <SimulationDataPanel 
          :visible="showDataPanel"
          :selectedData="selectedSimulationData"
          @close="showDataPanel = false"
        />
      </div>
      <SatelliteInfoPanel />
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
import SatelliteInfoPanel from "./components/SatelliteInfoPanel.vue";
// import ServerData from './components/serverdata.vue';
import LoginPage from './components/LoginPage.vue';
import { ref, provide } from 'vue';

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
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.main-center-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>