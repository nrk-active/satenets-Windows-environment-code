<template>
  <!-- 顶部合并导航栏容器 -->
  <div class="top-combined-navbar">
    <!-- 左侧空白区域（用于平衡布局） -->
    <div class="nav-spacer"></div>
    
    <!-- 中间：主菜单组 -->
    <div class="top-thin-navbar nav-menu-group">
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
    <div class="thin-nav-item" @click="showSimulationResultDialog">仿真结果展示</div>
    <div class="thin-nav-item">窗口</div>
  </div>

    <!-- 顶部右侧 登录/注册 或 用户名/退出 -->
    <div class="thin-nav-auth nav-auth-group">
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

    <!-- <div class="nav-center-group">
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
    </div> -->
    <!-- <div class="nav-right-group"> -->
      <!-- 右侧按钮 -->
      <!-- <div class="nav-item-right" @click="showBusinessDesignDialog">
        业务设置
      </div> -->
      <!-- <div class="nav-item-right" @click="showSimulationResultDialog">
        仿真结果展示
      </div> -->
      <!-- <div class="nav-item-right" :class="{ active: currentView === 'sat' }">
        <div id="satButton" @click="switchToSatView">
            三维场景展示
        </div>
      </div> -->
      <!-- <div class="nav-item-right" :class="{ active: currentView === 'topography' }">
        <div id="topographyButton" @click="switchToTopographyView">
            天地一体化展示
        </div>
      </div> -->
    <!-- </div> -->
  
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

// 处理停止仿真 - 清除所有仿真相关缓存
function handleStopSimulation() {
  console.log('=== 停止仿真并清除缓存 ===');
  
  // 显示确认对话框
  const confirmed = confirm('确定要停止仿真吗？这将清除所有仿真数据和缓存，需要重新开始。');
  
  if (!confirmed) {
    return;
  }
  
  try {
    // 1. 清除本地组件状态
    isSimulating.value = false;
    selectedProcessId.value = null;
    selectedDataFolder.value = null;
    
    // 2. 清除全局状态
    if (globalSelectedProcessId && globalSelectedProcessId.value !== undefined) {
      globalSelectedProcessId.value = null;
    }
    
    // 3. 清除 localStorage 中的仿真相关数据
    const keysToRemove = [
      // 进程相关
      'selectedProcessId',
      'selectedProcessInfo',
      // 数据文件夹相关
      'selectedDataFolder',
      'hasUserSelectedFolder',
      // 仿真状态相关
      'simulationProgress',
      'simulationTime',
      'currentTimeFrame',
      // 缓存数据
      'networkDataCache',
      'serviceDataCache',
      'entityCache',
      'animationCache',
      // 用户选择状态
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
    
    // 4. 发送停止事件给父组件
    emit('stop-simulation');
    
    // 5. 发送全局事件通知其他组件清除缓存
    const stopEvent = new CustomEvent('simulation-stopped', {
      detail: { 
        message: '仿真已停止，所有缓存已清除',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(stopEvent);
    
    // 6. 清除任何正在运行的定时器或动画
    const clearAnimationEvent = new CustomEvent('clear-all-animations', {
      detail: { message: '清除所有动画和定时器' }
    });
    window.dispatchEvent(clearAnimationEvent);
    
    // 7. 重置仿真进度和时间（如果有的话）
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
// const toggleDropdown = (menu) => {
//   if (activeDropdown.value === menu) {
//     activeDropdown.value = null;
//   } else {
//     activeDropdown.value = menu;
//   }
// };

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

// 播放速度控制函数
// 注释：这些功能已移至 SimulationControl.vue 组件
// const increaseSpeed = () => {
//   emit('increase-speed');
// };

// const decreaseSpeed = () => {
//   emit('decrease-speed');
// };

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
/* 顶级组合导航栏 (top-combined-navbar) */
.top-combined-navbar {
  /* 基础容器样式 */
  width: 100%;
  height: 40px; 
  background: var(--theme-secondary-bg); /* 修复：使用次级背景 */
  border-bottom: 1px solid var(--theme-border); 
  
  /* 关键：使用 Flexbox 实现三段式布局 (左-中-右) */
  display: flex;
  justify-content: space-between; 
  align-items: center;
  padding: 0 10px;
  box-sizing: border-box;
  z-index: 10000; 
  /* 修复：使用主题阴影 */
  box-shadow: 0 2px 6px var(--theme-shadow);
  position: fixed; 
  top: 0;
  left: 0;
  right: 0;
}

/* 左侧空白区域（用于平衡布局） */
.nav-spacer {
  flex: 1;
  min-width: 0;
}

/* 中间菜单组 (nav-menu-group) - 居中显示 */
.nav-menu-group {
  display: flex;
  align-items: center;
  height: 100%;
  flex-grow: 0; 
  flex-shrink: 0; 
  justify-content: center; 
  min-width: 0;
}

/* 3. 右侧认证组 (nav-auth-group) */
.nav-auth-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-grow: 1; 
  flex-shrink: 1;
  flex-basis: 0; 
  justify-content: flex-end; 
  min-width: 0;
}

/* ==========================================================
 * 按钮和菜单项的通用样式 (Spacemap 风格)
 * ========================================================== */

/* 顶部下拉菜单项样式 */
.thin-nav-item {
  color: var(--theme-main-text); /* **修复：使用主文字** */
  padding: 0 12px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  font-size: 14px;
}
.thin-nav-item:hover {
  background: var(--theme-dialog-bg); /* **修复：悬停背景** */
  color: var(--theme-accent); /* 保持强调色 */
  box-shadow: inset 0 -3px 0 var(--theme-accent);
}
/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--theme-main-bg); /* 修复：使用主背景 */
  min-width: 150px;
  z-index: 10005; 
  box-shadow: 0 4px 12px var(--theme-shadow);
  padding: 0;
  margin: 0;
}
.dropdown-item {
  color: var(--theme-main-text); /* 修复：使用主文字 */
  padding: 10px 20px;
  transition: background 0.2s, color 0.2s;
  font-size: 13px;
  line-height: 1;
}
.dropdown-item:hover {
  background: var(--theme-dialog-bg); /* 修复：悬停背景 */
  color: var(--theme-accent);
}

/* Auth 按钮和用户名样式 */
.thin-nav-username {
  color: var(--theme-accent); /* 保持强调色 */
  font-size: 14px;
  font-weight: bold;
}
.thin-nav-signin,
.thin-nav-signup,
.thin-nav-signout {
  border: 1px solid var(--theme-border); 
  background: var(--theme-dialog-bg); /* **修复：按钮背景** */
  color: var(--theme-main-text); /* **修复：按钮文字** */
  padding: 3px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  height: 24px;
  line-height: 24px;
  font-weight: 500;
}
.thin-nav-signin:hover,
.thin-nav-signup:hover,
.thin-nav-signout:hover {
  background: var(--theme-accent); /* 悬停使用强调色 */
  color: #fff; /* 悬停文字保持白色 */
}

/* 统一控制项样式：基础深色按钮 */
.nav-item-center {
  height: 36px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  color: var(--theme-main-text); /* **修复：使用主文字** */
  background: var(--theme-dialog-bg); /* **修复：使用对话框背景** */
  border: 1px solid var(--theme-border); 
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px var(--theme-shadow);
  box-sizing: border-box;
}

/* 统一 Hover/Active 效果 */
.nav-item-center:hover:not(.nav-disabled) {
  background-color: var(--theme-main-bg); /* **修复：悬停使用主背景** */
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  box-shadow: 0 0 5px var(--theme-accent);
  transform: translateY(-1px);
}

/* Start Simulation (突出绿色) - 保持特殊色 */
/* 注释：这些样式已移至 SimulationControl.vue 组件 */
/* .nav-item-start { 
  background: #00ff88;
  color: #101010;
  border-color: #00e077;
  min-width: 90px;
  box-shadow: 0 2px 6px #00ff8850;
}
.nav-item-start:hover:not(.nav-disabled) {
  background: #00e077;
  box-shadow: 0 0 8px #00ff88;
  color: #101010;
  border-color: #00ff88;
} */

/* Pause Simulation (突出红色) - 保持特殊色 */
/* 注释：这些样式已移至 SimulationControl.vue 组件 */
/* .nav-item-pause {
  background: #e74c3c;
  color: #fff;
  border-color: #c0392b;
  box-shadow: 0 2px 6px #e74c3c50;
}
.nav-item-pause:hover:not(.nav-disabled) {
  background: #c0392b;
  box-shadow: 0 0 8px #e74c3c50;
  border-color: #e74c3c;
} */

/* 加速/减速 (深蓝色强调) - 保持特殊色 */
/* 注释：这些样式已移至 SimulationControl.vue 组件 */
/* .nav-item-speed-up,
.nav-item-speed-down {
  background: #34495e;
  border-color: #2c3e50;
  color: #fff;
} */

/* 仿真结果展示 (突出蓝色) - 保持特殊色 */
.nav-item-result-display { 
  background: #3498db;
  color: #fff;
  border-color: #2980b9;
  box-shadow: 0 2px 6px #3498db50;
}
.nav-item-result-display:hover:not(.nav-disabled) {
  background: #2980b9;
  box-shadow: 0 0 8px #3498db50;
  border-color: #3498db;
}

/* 禁用状态 */
.nav-item-center.nav-disabled {
  color: var(--theme-border); /* **修复：使用边框色作为禁用文字色** */
  background: var(--theme-secondary-bg); /* **修复：使用次级背景** */
  border-color: var(--theme-border);
  cursor: not-allowed;
  opacity: 0.8;
  box-shadow: none;
  transform: none;
}
.nav-item-center.nav-disabled:hover {
  background: var(--theme-secondary-bg);
  border-color: var(--theme-border);
}
</style>