<template>
  <div class="top-thin-navbar">
    
    <div class="nav-left-group">
      <div
        class="thin-nav-item dropdown"
        @click="toggleSceneDropdown"
      >
        场景
        <div class="dropdown-menu" v-if="showSceneDropdown">
          <div class="dropdown-item">
            <div>新建场景</div>
          </div>
          <div class="dropdown-item">
            <div @click="openActionMenu">读取场景</div>
          </div>
          <div class="dropdown-item">
            <div>保存</div>
          </div>
          <div class="dropdown-item">
            <div>另存为</div>
          </div>
        </div>
      </div>
      <div
        class="thin-nav-item dropdown"
        @click.stop="showModelDropdown = !showModelDropdown; showSceneDropdown = false; showSettingDropdown = false"
      >
        模型
        <div class="dropdown-menu" v-if="showModelDropdown">
          <div class="dropdown-item" @click="selectModel('backend')">backend</div>
          <div class="dropdown-item" @click="selectModel('NS3')">NS3</div>
        </div>
      </div>
      <div
        class="thin-nav-item dropdown"
        @click.stop="showSettingDropdown = !showSettingDropdown; showSceneDropdown = false; showModelDropdown = false"
      >
        设置
        <div class="dropdown-menu" v-if="showSettingDropdown">
          <div class="dropdown-item" @click="openConstellationSetting">星座设置</div>
          <div class="dropdown-item" @click="showBusinessDesignDialog">业务设置</div>
          <div class="dropdown-item" @click="openSimulationSetting">仿真设置</div>
          <div class="dropdown-item" @click="openTerminalSetting">终端设置</div>
          <div class="dropdown-item" @click="openTopologyDialog">拓扑设置</div>
          <div class="dropdown-item" @click="">地面站设置</div>
          <div class="dropdown-item" @click="openTrafficMatrix">流量矩阵设置</div>
          <div class="dropdown-item" @click="openSettingDialog">界面设置</div>
        </div>
      </div>
      <div class="thin-nav-item">计算分析</div>
      <div class="thin-nav-item">信息显示</div>
      <div class="thin-nav-item">窗口</div>
    </div>
    
    <div class="thin-nav-controls">
      <button 
        class="control-button nav-sim-button"
        @click="handleStartSimulationClick" 
        :class="{ 'control-disabled': isSimulationDisabled }"
        :title="getSimulationButtonText()"
      >
        {{ isSimulationDisabled ? '运行中' : '开始' }}
      </button>
      <button 
        class="control-button" 
        @click="handlePauseSimulation"
        title="暂停仿真"
      >
        暂停
      </button>
      <button 
        class="control-button" 
        @click="increaseSpeed"
        title="加速"
      >
        + 速度
      </button>
      <button 
        class="control-button" 
        @click="decreaseSpeed"
        title="减速"
      >
        - 速度
      </button>
      <button 
        class="control-button nav-stop-button"
        @click="handleStopSimulation"
        title="停止仿真并清除数据"
      >
        停止
      </button>
      <div class="thin-nav-item thin-nav-item-button" @click="showSimulationResultDialog">结果</div>
    </div>
    
    <div class="thin-nav-auth">
      <template v-if="!isLoggedIn">
        <button class="thin-nav-signin" @click="openLoginDialog">登录</button>
        <button class="thin-nav-signup" @click="openRegisterDialog">注册</button>
      </template>
      <template v-else>
        <span class="thin-nav-username">{{ username }}</span>
        <button class="thin-nav-signout" @click="logout">退出</button>
      </template>
    </div>
    <login ref="loginRef" @login-success="handleLoginSuccess" />
    <setting ref="settingRef" />
  </div>
  
  <ScenarioDialog v-if="showDialog" @close="showDialog = false" />
  <SimulationResultDialog 
    v-if="showSimResultDialog" 
    @close="showSimResultDialog = false"
    @data-selected="handleDataSelected"
  />
  <BusinessDesignDialog 
    v-if="showBusinessDialog" 
    @close="showBusinessDialog = false"
    @settings-confirmed="handleBusinessSettings"
  />
  <TopologySettingDialog
    v-if="showTopologyDialog"
    @save="handleTopologySave"
    @close="showTopologyDialog = false"
  />
  <SimulationSetting ref="simulationSettingRef" />
  <TerminalSetting ref="terminalSettingRef" />
  <TrafficMatrix ref="trafficMatrixRef" />
  <ConstellationSetting ref="constellationSettingRef" />
  
  <ProcessSelectionDialog 
    v-if="showProcessDialog"
    @close="closeProcessDialog"
    @process-selected="handleProcessSelected"
  />
  
  <FolderSelectionDialog 
    v-if="showFolderDialog"
    @close="closeFolderDialog"
    @folder-selected="handleFolderSelected"
  />
  
</template>


<script setup>
import { ref, onMounted, onUnmounted, inject, computed } from 'vue';
import ScenarioDialog from './ScenarioDialog.vue';
import SimulationResultDialog from './SimulationResultDialog.vue';
import BusinessDesignDialog from './Service_setting.vue'; 
import Login from './login.vue'
import Setting from './setting.vue'
import TopologySettingDialog from './TopologySettingDialog.vue'
import SimulationSetting from './simulation_setting.vue'
import TerminalSetting from './terminal_setting.vue'
import TrafficMatrix from './traffic_matrix.vue' 
import ConstellationSetting from './constellation_setting.vue'
import ProcessSelectionDialog from './ProcessSelectionDialog.vue'
import FolderSelectionDialog from './FolderSelectionDialog.vue'

// 接收从父组件传递的登录状态和用户名
const props = defineProps({
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    default: ''
  },
  isLocalSimulationRunning: {
    type: Boolean,
    default: false
  }
});

// 注入用户凭据
const userCredentials = inject('userCredentials', ref({}));

// 注入全局进程ID状态
const globalSelectedProcessId = inject('selectedProcessId', ref(null));

// 修改emit以包含所有需要的事件
const emit = defineEmits([
  'simulation-data-selected', 
  'business-settings-confirmed', 
  'logout', 
  'login-success',
  'start-local-simulation',
  'pause-local-simulation',
  'stop-simulation',
  'increase-speed',
  'decrease-speed'
]);

const isSimulating = ref(false);

// 进程选择弹窗状态
const showProcessDialog = ref(false);
const selectedProcessId = ref(null);

// 文件夹选择弹窗状态
const showFolderDialog = ref(false);
const selectedDataFolder = ref(null);

// 仿真进度和时间
const simulationProgress = inject('simulationProgress', ref(0));
const simulationTime = inject('simulationTime', ref({ start: '', end: '' }));
function toggleSceneDropdown(event) {
  showSceneDropdown.value = !showSceneDropdown.value;
  showModelDropdown.value = false;
  showSettingDropdown.value = false;
  event && event.stopPropagation();
}

// 添加开始仿真方法 (逻辑保持不变)
async function startSimulation() {
  try {
    isSimulating.value = true;

    const csrfToken = await fetch('/api/csrf_token', {
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })
    .then(res => res.json())
    .then(data => {
      console.log("Token:", data);
      return data.csrfToken;
    });

    // 获取当前模拟器ID
    const simulatorResponse = await fetch('/api/simulators/', {
      method: 'GET',
      credentials: 'include',
    });
    const simulatorData = await simulatorResponse.json();
    const id = simulatorData.simulators[simulatorData.simulators.length - 1].id;
    console.log("ID2:", id);

    const event = new CustomEvent('start-satellite-polling', { detail: { message: '开始轮询' } });
    window.dispatchEvent(event);

    // 调用 run 接口
    const response = await fetch(`/api/simulators/${id}/run/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`仿真失败: ${response.status}`);
    }

    const result = await response.json();
    console.log('仿真完成:', result);
    alert('仿真完成！');
    
  } catch (error) {
    console.error('仿真错误:', error);
    alert('仿真失败，请重试');
  } finally {
    isSimulating.value = false;
  }
}

// 处理仿真控制 - 统一入口
function handleStartSimulation() {
  if (props.isLoggedIn) {
    // 登录状态下使用 API 仿真
    startSimulation();
  } else {
    // 未登录状态下使用本地数据仿真
    emit('start-local-simulation');
  }
}

// 处理暂停仿真
function handlePauseSimulation() {
  if (props.isLoggedIn) {
    // 登录状态下的暂停逻辑（如果有的话）
    console.log('暂停API仿真');
  } else {
    // 未登录状态下暂停本地仿真
    emit('pause-local-simulation');
  }
}

// 处理停止仿真 - 清除所有仿真相关缓存 (逻辑保持不变)
function handleStopSimulation() {
  console.log('=== 停止仿真并清除缓存 ===');
  
  const confirmed = confirm('确定要停止仿真吗？这将清除所有仿真数据和缓存，需要重新开始。');
  
  if (!confirmed) {
    return;
  }
  
  try {
    isSimulating.value = false;
    selectedProcessId.value = null;
    selectedDataFolder.value = null;
    
    if (globalSelectedProcessId && globalSelectedProcessId.value !== undefined) {
      globalSelectedProcessId.value = null;
    }
    
    const keysToRemove = [
      'selectedProcessId',
      'selectedProcessInfo',
      'selectedDataFolder',
      'hasUserSelectedFolder',
      'simulationProgress',
      'simulationTime',
      'currentTimeFrame',
      'networkDataCache',
      'serviceDataCache',
      'entityCache',
      'animationCache',
      'selectedEntityId',
      'selectedSimulationData',
      'chartPanelData',
      'showSatellite',
      'showStation', 
      'showRoadm',
      'showLinks'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`已清除 localStorage: ${key}`);
    });
    
    emit('stop-simulation');
    
    const stopEvent = new CustomEvent('simulation-stopped', {
      detail: { 
        message: '仿真已停止，所有缓存已清除',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(stopEvent);
    
    const clearAnimationEvent = new CustomEvent('clear-all-animations', {
      detail: { message: '清除所有动画和定时器' }
    });
    window.dispatchEvent(clearAnimationEvent);
    
    if (simulationProgress && simulationProgress.value !== undefined) {
      simulationProgress.value = 0;
    }
    if (simulationTime && simulationTime.value !== undefined) {
      simulationTime.value = { start: '', end: '' };
    }
    
    console.log('仿真已停止，所有缓存已清除');
    alert('仿真已停止，所有数据已清除。请重新从Open菜单选择文件夹开始。');
    
  } catch (error) {
    console.error('停止仿真时发生错误:', error);
    alert('停止仿真时发生错误，请刷新页面重试。');
  }
}

// 获取仿真按钮文本
function getSimulationButtonText() {
  if (props.isLoggedIn) {
    return isSimulating.value ? '运行中...' : '开始仿真';
  } else {
    return props.isLocalSimulationRunning ? '运行中...' : '开始仿真';
  }
}

// 计算是否应该禁用仿真按钮
const isSimulationDisabled = computed(() => {
  if (props.isLoggedIn) {
    return isSimulating.value;
  } else {
    return props.isLocalSimulationRunning;
  }
});

// 处理仿真按钮点击（带禁用检查）
function handleStartSimulationClick() {
  if (isSimulationDisabled.value) {
    return; // 如果按钮被禁用，不执行任何操作
  }
  handleStartSimulation();
}


// 当前激活的下拉菜单
const activeDropdown = ref(null);
// 控制对话框显示
const showDialog = ref(false);

// 切换下拉菜单的显示状态
// const toggleDropdown = (menu) => { /* ... */ };

// 显示新建想定对话框
const showNewScenarioDialog = () => {
  showDialog.value = true;
  activeDropdown.value = null; // 关闭下拉菜单
};

// 点击页面其他地方关闭下拉菜单
const closeDropdowns = (event) => {
  if (!event.target.closest('.dropdown')) {
    activeDropdown.value = null;
  }
};

// 添加全局点击事件监听器
onMounted(() => {
  document.addEventListener('click', closeDropdowns);
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns);
});

// 控制仿真结果对话框显示
const showSimResultDialog = ref(false);

// 显示仿真结果对话框
const showSimulationResultDialog = () => {
  showSimResultDialog.value = true;
};

// 控制业务设计对话框显示
const showBusinessDialog = ref(false);

// 显示业务设计对话框
const showBusinessDesignDialog = () => {
  showBusinessDialog.value = true;
};

// 控制拓扑设置对话框显示
const showTopologyDialog = ref(false);
const simulationSettingRef = ref(null)
const terminalSettingRef = ref(null)
const trafficMatrixRef = ref(null) 
const constellationSettingRef = ref(null) 

function openSimulationSetting() {
  simulationSettingRef.value && simulationSettingRef.value.open()
};
function openTerminalSetting() {
  terminalSettingRef.value && terminalSettingRef.value.open()
};
function openTrafficMatrix() {
  trafficMatrixRef.value && trafficMatrixRef.value.open()
}
function openConstellationSetting() {
  constellationSettingRef.value && constellationSettingRef.value.open()
  showSettingDropdown.value = false 
}
// 显示拓扑设置对话框
const openTopologyDialog = () => {
  showTopologyDialog.value = true;
};

const handleDataSelected = (data) => {
  emit('simulation-data-selected', data);
};

const handleBusinessSettings = (settings) => {
  emit('business-settings-confirmed', settings);
  console.log('业务设计设置:', settings);
};

// 播放速度控制函数
const increaseSpeed = () => {
  emit('increase-speed');
};

const decreaseSpeed = () => {
  emit('decrease-speed');
};

// 添加当前视图状态
const currentView = ref('sat'); // 默认是三维场景视图

// 添加视图切换事件处理器
const switchToSatView = () => {
  if (currentView.value === 'sat') return; 
  
  currentView.value = 'sat';
  // 清理天地一体化视图
  const topographyElement = document.getElementById('topographyContainer');
  if (topographyElement) {
    topographyElement.innerHTML = '';
  }

  // 重新初始化三维场景
  const event = new CustomEvent('initialize-sat-view', {
    detail: { message: 'initialize satellite view' }
  });
  window.dispatchEvent(event);
};

const switchToTopographyView = () => {
  if (currentView.value === 'topography') return; 
  console.log('切换到天地一体化', currentView.value);
  currentView.value = 'topography';
  // 清理三维场景
  const satElement = document.getElementById('satContainer');
  if (satElement) {
    satElement.innerHTML = '';
  }
  
  // 初始化天地一体化视图
  const event = new CustomEvent('initialize-topography-view', {
    detail: { message: 'initialize topography view' }
  });
  window.dispatchEvent(event);
};

const showModelDropdown = ref(false)
const showSettingDropdown = ref(false)
const showSceneDropdown = ref(false)
function selectModel(model) {
  console.log('选择模型:', model)
  showModelDropdown.value = false
  showSettingDropdown.value = false
  showSceneDropdown.value = false
}

// 点击页面其他地方关闭下拉菜单
function handleClickOutside(event) {
  if (!event.target.closest('.dropdown')) {
    showModelDropdown.value = false
    showSettingDropdown.value = false
    showSceneDropdown.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // 恢复之前缓存的进程ID
  const cachedProcessId = localStorage.getItem('selectedProcessId');
  if (cachedProcessId) {
    selectedProcessId.value = cachedProcessId;
    globalSelectedProcessId.value = cachedProcessId; // 同时更新全局状态
    console.log('恢复缓存的进程ID:', cachedProcessId);
  }
  
  // 恢复之前选择的数据文件夹（仅在用户主动选择过的情况下）
  const hasUserSelected = localStorage.getItem('hasUserSelectedFolder');
  if (hasUserSelected === 'true') {
    const cachedFolder = localStorage.getItem('selectedDataFolder');
    if (cachedFolder) {
      selectedDataFolder.value = cachedFolder;
      console.log('恢复缓存的数据文件夹:', cachedFolder);
    }
  }
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const loginRef = ref(null)
const settingRef = ref(null)
function openLoginDialog() {
  loginRef.value && loginRef.value.openLogin()
}
function openRegisterDialog() {
  loginRef.value && loginRef.value.openRegister()
}
function openSettingDialog() {
  settingRef.value && settingRef.value.open()
}

// 打开文件夹选择弹窗（用于未登录状态）
function openActionMenu() {
  // 检查动画是否正在播放，如果是则不执行
  if (isSimulationDisabled.value) {
    console.log('动画播放中，Open按钮被禁用');
    return;
  }
  
  if (props.isLoggedIn) {
    // 已登录状态：显示进程选择弹窗
    showProcessDialog.value = true;
  } else {
    // 未登录状态：显示文件夹选择弹窗
    showFolderDialog.value = true;
  }
}

// 处理文件夹选择
function handleFolderSelected(folderInfo) {
  console.log('=== 处理文件夹选择 ===');
  console.log('选择的文件夹:', folderInfo);
  
  selectedDataFolder.value = folderInfo.name;
  
  // 通知useDataLoader更新文件夹设置
  localStorage.setItem('selectedDataFolder', folderInfo.name);
  localStorage.setItem('hasUserSelectedFolder', 'true'); // 标记用户已主动选择
  
  console.log(`数据文件夹已设置为: ${folderInfo.name}`);
  
  // 发送自定义事件通知其他组件文件夹已更改
  const event = new CustomEvent('data-folder-changed', {
    detail: { folderName: folderInfo.name, folderInfo }
  });
  window.dispatchEvent(event);
  
  alert(`已选择数据文件夹: ${folderInfo.name}`);
}

// 关闭文件夹选择弹窗
function closeFolderDialog() {
  showFolderDialog.value = false;
}

// 处理进程选择
function handleProcessSelected(process) {
  console.log('=== 处理进程选择 ===');
  console.log('选择的进程:', process);
  console.log('进程ID:', process.id);
  
  selectedProcessId.value = process.id;
  globalSelectedProcessId.value = process.id; // 更新全局状态
  
  console.log('本地进程ID已更新:', selectedProcessId.value);
  console.log('全局进程ID已更新:', globalSelectedProcessId.value);
  console.log('缓存的进程ID:', selectedProcessId.value);
  
  // 可以将进程ID保存到localStorage以便持久化
  localStorage.setItem('selectedProcessId', process.id);
  localStorage.setItem('selectedProcessInfo', JSON.stringify(process));
  
  console.log('进程信息已保存到localStorage');
  
  // 检查全局状态是否正确更新
  setTimeout(() => {
    console.log('延迟检查全局状态:', globalSelectedProcessId.value);
  }, 100);
  
  alert(`已选择进程: ${process.name || process.id}`);
}

// 关闭进程选择弹窗
function closeProcessDialog() {
  showProcessDialog.value = false;
}

// 其他Action菜单方法
function saveActionMenu() {
  if (!selectedProcessId.value) {
    alert('请先选择一个进程');
    return;
  }
  console.log('保存操作，当前进程ID:', selectedProcessId.value);
}

function saveAsActionMenu() {
  if (!selectedProcessId.value) {
    alert('请先选择一个进程');
    return;
  }
  console.log('另存为操作，当前进程ID:', selectedProcessId.value);
}

// 使用从父组件传递的登录状态，不再需要本地状态
function handleLoginSuccess(user) {
  // 通知父组件登录成功
  emit('login-success', user);
}

function logout() {
  // 清理本地进程选择状态
  selectedProcessId.value = null;
  globalSelectedProcessId.value = null;
  
  // 通知父组件登出
  emit('logout');
}

</script>

<style scoped>
/* 简化导航栏样式，使用主题变量 */
.top-thin-navbar {
  width: 100%;
  height: var(--nav-height); 
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
  
  /* *** 关键修复 1: 改为固定定位和高 z-index *** */
  position: fixed; 
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000; /* 确保在 Cesium 上方 */
  
  padding: 0 10px;
  box-sizing: border-box;
  
  /* *** 关键修复 2: 使用 space-between 强制左中右分离 *** */
  justify-content: space-between; 
}

/* 1. 左侧菜单组 */
.nav-left-group {
  display: flex;
  align-items: center;
  flex-shrink: 0; /* 保证不被压缩 */
  margin-right: 20px;
}

.thin-nav-item {
  color: var(--color-text);
  padding: 0 12px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.thin-nav-item:hover {
  background: var(--bg-secondary);
  color: var(--color-highlight);
}

/* 2. 中间仿真控制组 */
.thin-nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  
  /* *** 关键修复 3a: 占据中间所有剩余空间 *** */
  flex-grow: 1; 
  /* *** 关键修复 3b: 在占据的空间内居中内容 *** */
  justify-content: center; 

  /* 移除所有 auto margin，依赖 flex-grow 和 justify-content */
  margin-left: 0;
  margin-right: 0;
}

/* 3. 右侧登录/注册/用户组 */
.thin-nav-auth {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; 
  /* 移除冲突的 auto margin，依赖 space-between */
}

.thin-nav-item-button {
  padding: 0 12px;
}

.control-button {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  background: var(--bg-tertiary); 
  color: var(--color-text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.control-button:hover {
  background: var(--bg-secondary);
}

.control-button.nav-sim-button {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--bg-primary);
}

.control-button.nav-sim-button:hover {
  background: var(--color-accent);
  opacity: 0.8;
}

.control-button.nav-stop-button {
  background: #e74c3c;
  border-color: #e74c3c;
  color: var(--bg-primary);
}

.control-button.nav-stop-button:hover {
  background: #c0392b;
}

.control-button.control-disabled {
  background: var(--bg-tertiary);
  border-color: var(--color-border);
  color: var(--color-text-dim);
  cursor: not-allowed;
  opacity: 0.8;
}

.control-button.control-disabled:hover {
  background: var(--bg-tertiary);
}

/* 下拉菜单样式使用主题变量 */
.dropdown {
  position: relative;
}
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0; 
  background: var(--bg-primary);
  border: 1px solid var(--color-border);
  min-width: 120px;
  z-index: 10005; /* 确保下拉菜单高于导航栏本身 */
  box-shadow: 0 2px 8px var(--color-shadow);
  padding: 5px 0;
}
.dropdown-item:hover {
  background: var(--color-highlight);
  color: var(--bg-primary);
}

.thin-nav-username {
  color: var(--color-text);
  font-size: 14px;
  margin-right: 8px;
}
.thin-nav-signout {
  border: none;
  background: #e74c3c;
  color: #fff;
  padding: 3px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  height: 24px;
  line-height: 24px;
  font-weight: 500;
}
.thin-nav-signout:hover {
  background: #c0392b;
}

/* 移除不再需要的厚导航栏样式 */
.navigation-bar,
.nav-center-group,
.nav-right-group,
.nav-item-left,
.nav-item-right {
  display: none;
}
</style>