<template>
  <!-- 新增顶部细导航栏 -->
  <div class="top-thin-navbar">
    <div
      class="thin-nav-item dropdown"
      @click="toggleSceneDropdown"
    >
      场景
      <div class="dropdown-menu" v-if="showSceneDropdown">
        <!-- <div class="dropdown-item" :class="{ active: currentView === 'sat' }">
          <div @click.stop="switchToSatView(); showSceneDropdown = false">
              三维场景展示
          </div>
        </div>
        <div class="dropdown-item" :class="{ active: currentView === 'topography' }">
          <div @click.stop="switchToTopographyView(); showSceneDropdown = false">
              天地一体化展示
          </div>
        </div> -->
        <div class="dropdown-item">
          <div>
              新建场景
          </div>
        </div>
        <div class="dropdown-item">
          <div @click="openActionMenu">
              读取场景
          </div>
        </div>
        <div class="dropdown-item">
          <div>
              保存
          </div>
        </div>
        <div class="dropdown-item">
          <div>
              另存为
          </div>
        </div>
      </div>
    </div>
    <!-- 模型下拉菜单 -->
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
    <!-- 设置按钮，点击弹出设置弹窗 -->
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
    <!-- 顶部右侧 登录/注册 或 用户名/退出 -->
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
  <div class="navigation-bar">
    <div class="nav-left-group">
      <!-- 左侧按钮 -->
      <div class="nav-item-left" @click="openActionMenu">
          Open
      </div>
      <div class="nav-item-left" @click="saveActionMenu">
          Save
      </div>
      <div class="nav-item-left" @click="saveAsActionMenu">
          Save As
       </div>

        <!-- 仿真相关菜单 -->
      <div class="nav-item-left"
        @click="handleStartSimulationClick" 
        :class="{ 'disabled': isSimulationDisabled }"
        >
          {{ getSimulationButtonText() }}
      </div>
      <div class="nav-item-left" @click="handlePauseSimulation">
          暂停仿真
      </div>
      <div class="nav-item-left">
          停止
      </div>
      <div class="nav-item-left">
          加速
      </div>
    
      <div class="nav-item-left">
        减速
      </div>
      <!-- <div class="nav-item-left">
        链路
      </div> -->
    </div>
    <div class="nav-center-group">
      <!-- 居中内容 -->
      <div class="progress-bar-nav">
        <div class="progress-time">
          <span class="progress-label"><b>仿真时间</b></span>
          <input class="time-input" :value="simulationTime.start" readonly />
          <span style="margin: 0 4px;">→</span>
          <input class="time-input" :value="simulationTime.end" readonly />
        </div>
        <div class="progress-bar-row">
          <span class="progress-label"><b>进度条</b></span>
          <div class="progress-bar-outer">
            <div class="progress-bar-inner" :style="{ width: (simulationProgress * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="nav-right-group">
      <!-- 右侧按钮 -->
      <!-- <div class="nav-item-right" @click="showBusinessDesignDialog">
        业务设置
      </div> -->
      <div class="nav-item-right" @click="showSimulationResultDialog">
        仿真结果展示
      </div>
      <div class="nav-item-right" :class="{ active: currentView === 'sat' }">
        <div id="satButton" @click="switchToSatView">
            三维场景展示
        </div>
      </div>
      <div class="nav-item-right" :class="{ active: currentView === 'topography' }">
        <div id="topographyButton" @click="switchToTopographyView">
            天地一体化展示
        </div>
      </div>
    </div>
  </div>
  
  <!-- 新建想定对话框 -->
  <ScenarioDialog v-if="showDialog" @close="showDialog = false" />
  <!-- 仿真结果对话框 -->
  <SimulationResultDialog 
    v-if="showSimResultDialog" 
    @close="showSimResultDialog = false"
    @data-selected="handleDataSelected"
  />
  <!-- 业务设计对话框 -->
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
  
  <!-- 进程选择弹窗 -->
  <ProcessSelectionDialog 
    v-if="showProcessDialog"
    @close="closeProcessDialog"
    @process-selected="handleProcessSelected"
  />
  
  <!-- 文件夹选择弹窗 -->
  <FolderSelectionDialog 
    v-if="showFolderDialog"
    @close="closeFolderDialog"
    @folder-selected="handleFolderSelected"
  />
  
</template>

<!-- 只修改script部分，其他部分保持不变 -->
<script setup>
// 导入部分保持不变
import { ref, onMounted, onUnmounted, inject, computed } from 'vue';
import ScenarioDialog from './ScenarioDialog.vue';
import SimulationResultDialog from './SimulationResultDialog.vue';
import BusinessDesignDialog from './Service_setting.vue'; //'./BusinessDesignDialog.vue';
import Login from './login.vue'
import Setting from './setting.vue'
import TopologySettingDialog from './TopologySettingDialog.vue'
import SimulationSetting from './simulation_setting.vue'
import TerminalSetting from './terminal_setting.vue'
import TrafficMatrix from './traffic_matrix.vue' // 确认路径和文件名一致
import ConstellationSetting from './constellation_setting.vue'
import ProcessSelectionDialog from './ProcessSelectionDialog.vue' // 新增
import FolderSelectionDialog from './FolderSelectionDialog.vue' // 新增文件夹选择对话框

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
  'pause-local-simulation'
]);

const isSimulating = ref(false);

// 进程选择弹窗状态
const showProcessDialog = ref(false);
const selectedProcessId = ref(null);

// 文件夹选择弹窗状态
const showFolderDialog = ref(false);
const selectedDataFolder = ref(null); // 初始不设置默认值，等待用户选择

// 仿真进度和时间
const simulationProgress = inject('simulationProgress', ref(0));
const simulationTime = inject('simulationTime', ref({ start: '', end: '' }));
function toggleSceneDropdown(event) {
  showSceneDropdown.value = !showSceneDropdown.value;
  showModelDropdown.value = false;
  showSettingDropdown.value = false;
  event && event.stopPropagation();
}
// 添加开始仿真方法
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
    // 登录状态下使用API仿真
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
const toggleDropdown = (menu) => {
  if (activeDropdown.value === menu) {
    activeDropdown.value = null;
  } else {
    activeDropdown.value = menu;
  }
};

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
const trafficMatrixRef = ref(null) // 新增
const constellationSettingRef = ref(null) // 星座设置引用

function openSimulationSetting() {
  simulationSettingRef.value && simulationSettingRef.value.open()
};
function openTerminalSetting() {
  terminalSettingRef.value && terminalSettingRef.value.open()
};
function openTrafficMatrix() { // 新增
  trafficMatrixRef.value && trafficMatrixRef.value.open()
}
function openConstellationSetting() { // 星座设置
  constellationSettingRef.value && constellationSettingRef.value.open()
  showSettingDropdown.value = false // 关闭设置下拉菜单
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

// 添加当前视图状态
const currentView = ref('sat'); // 默认是三维场景视图

// 添加视图切换事件处理器
const switchToSatView = () => {
  if (currentView.value === 'sat') return; // 如果已经是卫星视图则不处理
  
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
  if (currentView.value === 'topography') return; // 如果已经是天地一体化视图则不处理
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
  // 这里可以根据需要处理选中逻辑
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
  // 我们需要从composable中导入setDataFolder函数
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
  // 这里可以实现保存逻辑
}

function saveAsActionMenu() {
  if (!selectedProcessId.value) {
    alert('请先选择一个进程');
    return;
  }
  console.log('另存为操作，当前进程ID:', selectedProcessId.value);
  // 这里可以实现另存为逻辑
}

// 使用从父组件传递的登录状态，不再需要本地状态
// const isLoggedIn = ref(false)
// const username = ref('')

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
.top-thin-navbar {
  width: 100%;
  height: 28px;
  background: #232323;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #333;
  font-size: 13px;
  z-index: 10;
  position: relative;
}
.thin-nav-item {
  color: #eee;
  padding: 0 18px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.thin-nav-item:hover {
  background: #333;
  color: #ffd700;
}

.nav-spacer {
  flex: 1;  /* 添加这个样式让空间占位器占据所有剩余空间 */
}

.header-buttons {
  padding: 0 15px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  position: relative  /* 添加右侧边距 */
}

.simulation-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;  /* 稍微增加按钮大小 */
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  height: 36px;  /* 固定按钮高度 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.simulation-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.simulation-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.navigation-bar {
  position: relative; 
  /* justify-content: center; */
  display: flex;
  align-items: center;
  width: 100%;
  height: 80px;
  background: #1a1a1a;
  border-bottom: 1px solid #fffbfb;
  justify-content: space-between; /* 关键：三栏分布两端和中间 */
}

.nav-left-group {
  width: 7%;
  display: flex;
  align-items: center;
  /* flex: 0 1 auto; 关键：宽度自适应内容 */
  min-width: 0;
}

.nav-center-group {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 0;
}

.nav-right-group {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.nav-left-group,
.nav-right-group {
  color: #fff; /* 新增：让字体变亮 */
  display: flex;
  height: 100%;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  
}

.nav-item-left {
  width: 10%;
  padding: 0 10px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  justify-content: center;
  color: #fff; /* 确保正常状态下显示白色 */
}
.nav-item-left:hover {
  background-color: #333;
}
.nav-item-left.active {
  background-color: #444;
}

.nav-item-left.active:hover {
  background-color: #555;
}

.nav-item-left.disabled {
  color: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

.nav-item-left.disabled:hover {
  background-color: transparent;
}
.nav-item-right {
  width: 14%;
  /* padding: 0 10px; */
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  justify-content: center;
}
.nav-item-right:hover {
  background-color: #333;
}
.nav-item-right.active {
  background-color: #444;
}

.nav-item-:right:hover {
  background-color: #555;
}

.progress-bar-nav {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #232323;
  color: #fff;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 6px 14px 6px 14px;
  margin-left: 0;
  min-width: 220px;
  max-width: 300px;
  height: 56px;
  box-sizing: border-box;
  font-size: 12px;
  margin-top: 0;
  margin-bottom: 0;
  box-shadow: none;
}

.progress-time,
.progress-bar-row{
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.progress-label {
  min-width: 48px;
  font-size: 12px;
  color: #fff;
  font-weight: bold;
}

.time-input {
  background-color: #181818;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  width: 60px;
  text-align: center;
  margin: 0 2px;
  height: 20px;
  font-size: 12px;
  padding: 0 4px;
}

.progress-bar-row {
  margin-bottom: 2px;
}

.progress-bar-outer {
  flex: 1;
  height: 10px;
  background-color: #444;
  border-radius: 6px;
  overflow: hidden;
  margin-left: 8px;
  border: 1px solid #222;
  min-width: 80px;
  max-width: 140px;
}

.progress-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #f39c12, #ffd700);
  transition: width 0.3s;
}

ul {
  list-style: disc inside;
  padding: 0;
  margin: 0;
}
li {
  margin: 12px 0;
  font-size: 15px;
  color: #e0e0e0;
  letter-spacing: 1px;
}

.dropdown {
  position: relative;
}
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: #232323;
  border: 1px solid #333;
  min-width: 100px;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.dropdown-item {
  color: #eee;
  padding: 8px 18px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.dropdown-item:hover {
  background: #333;
  color: #ffd700;
}

.thin-nav-auth {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 登录/注册按钮：绿色风格 */
.thin-nav-signin,
.thin-nav-signup {
  border: none;
  background: #27ae60;
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

.thin-nav-signin:hover,
.thin-nav-signup:hover {
  background: #219150;
  color: #fff;
}

.thin-nav-username {
  color: #fff;
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
</style>
