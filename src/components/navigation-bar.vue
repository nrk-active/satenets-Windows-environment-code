<template>
  <!-- 新增顶部细导航栏 -->
  <div class="top-thin-navbar">
    <div class="thin-nav-item">场景</div>
    <div class="thin-nav-item">模型</div>
    <div class="thin-nav-item">设置</div>
    <div class="thin-nav-item">计算分析</div>
    <div class="thin-nav-item">信息显示</div>
    <div class="thin-nav-item">窗口</div>
  </div>
  <div class="navigation-bar">
    <!-- 操作下拉菜单 -->

      <div class="nav-item" @click="openActionMenu">
        Open
      </div>
      <div class="nav-item" @click="saveActionMenu">
        Save
      </div>
      <div class="nav-item" @click="saveAsActionMenu">
        Save As
      </div>

      <!-- 仿真相关菜单 -->
      <div class="nav-item"
      @click="startSimulation" 
      :disabled="isSimulating"
      >
        <!-- <button 
          class="simulation-btn" 
          @click="startSimulation" 
          :disabled="isSimulating"
        > -->
          {{ isSimulating ? '运行中...' : '开始仿真' }}
        <!-- </button> -->
      </div>
      <div class="nav-item">
        暂停仿真
      </div>
      <div class="nav-item">
        停止
      </div>
      <div class="nav-item">
        加速
      </div>
  
    <div class="nav-item">
      减速
    </div>
    <div class="nav-item">
      链路
    </div>
    <div class="nav-item">
      任务命令
    </div>

    <div class="nav-item" @click="showBusinessDesignDialog">
      业务设置
    </div>
    <div class="nav-item" @click="showSimulationResultDialog">
      仿真结果展示
    </div>
    
      <div class="nav-item" :class="{ active: currentView === 'sat' }">
        <div id="satButton" class="nav-link" @click="switchToSatView">
          三维场景展示
        </div>
      </div>
      <div class="nav-item" :class="{ active: currentView === 'topography' }">
        <div id="topographyButton" class="nav-link" @click="switchToTopographyView">
          天地一体化展示
        </div>
      </div>
      <div  class="nav-center">
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
    <div class="nav-spacer"></div>
    <!-- <div class="header-buttons">
      <button 
        class="simulation-btn" 
        @click="startSimulation" 
        :disabled="isSimulating"
      >
        {{ isSimulating ? '运行中...' : '开始仿真' }}
      </button>
    </div> -->
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
  
  
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject } from 'vue';
import ScenarioDialog from './ScenarioDialog.vue';
import SimulationResultDialog from './SimulationResultDialog.vue';
import BusinessDesignDialog from './BusinessDesignDialog.vue';

const isSimulating = ref(false);

// 仿真进度和时间
const simulationProgress = inject('simulationProgress', ref(0));
const simulationTime = inject('simulationTime', ref({ start: '', end: '' }));

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

const emit = defineEmits(['simulation-data-selected', 'business-settings-confirmed']);

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
  position: relative;  /* 添加右侧边距 */
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
  display: flex;
  background-color: #1a1a1a;
  color: white;
  padding: 0;
  height: 80px;
  align-items: center;
  width: 100%;
  border-bottom: 1px solid #333;
  /* 新增：让内容靠左排列 */
  justify-content: flex-start;
}

.nav-item {
  width: 6.5%;
  padding: 0 15px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  position: relative;
}

.nav-item:hover {
  background-color: #333;
}

.dropdown {
  position: relative;
  user-select: none;
}

.dropdown-icon {
  font-size: 10px;
  margin-left: 5px;
}

.active {
  background-color: #444;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #333;
  min-width: 120px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.2);
  z-index: 1000;
  border-left: 3px solid #f39c12;
  border-radius: 0 0 4px 4px;
  padding: 4px 0;
}

.dropdown-item {
  padding: 8px 16px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background-color: #444;
}

.nav-link {
  color: white;
  text-decoration: none;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.nav-item.active {
  background-color: #444;
}

.nav-item.active:hover {
  background-color: #555;
}

.nav-left {
  display: flex;
  align-items: center;
}

/* .nav-center {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  margin-left: 20px; /* 可根据需要微调间距 */

.nav-center {
  display: flex;
  align-items: center;
  gap: 20px;
  position: absolute;
  left: 50%;
  height: 100%;
  transform: translateX(-50%);
}

.nav-right {
  display: flex;
  align-items: center;
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
.progress-bar-row,
.progress-label-row {
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

.progress-label-row {
  justify-content: flex-start;
  gap: 8px;
  font-size: 12px;
}

.progress-percent {
  font-weight: bold;
  color: #ffd700;
  font-size: 12px;
}

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
.nav-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  background: #232323;
  border-bottom: 1px solid #333;
}
.nav-btn {
  background: #181818;
  color: #ffd700;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.2s, color 0.2s;
}
.nav-btn:hover {
  background: #ffd700;
  color: #181818;
}
.content {
  flex: 1;
  padding: 16px;
  overflow: auto;
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
</style>
