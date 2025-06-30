<template>
  <div class="navigation-bar">
    <!-- <div class="nav-item dropdown" @click="toggleDropdown('scenario')">
      想定管理
      <span class="dropdown-icon">▼</span>
      <div class="dropdown-menu" v-show="activeDropdown === 'scenario'">
        <div class="dropdown-item" @click="showNewScenarioDialog">新建想定</div>
        <div class="dropdown-item">加载想定</div>
        <div class="dropdown-item">保存想定</div>
        <div class="dropdown-item">另存为想定</div>
      </div>
    </div>
    <div class="nav-item dropdown" @click="toggleDropdown('analysis')">
      分析计算
      <span class="dropdown-icon">▼</span>
      <div class="dropdown-menu" v-show="activeDropdown === 'analysis'">
        <div class="dropdown-item">访问分析计算</div>
        <div class="dropdown-item">覆盖分析计算</div>
      </div>
    </div>
    <div class="nav-item dropdown" @click="toggleDropdown('database')">
      数据库管理
      <span class="dropdown-icon">▼</span>
      <div class="dropdown-menu" v-show="activeDropdown === 'database'">
        <div class="dropdown-item">卫星数据库</div>
        <div class="dropdown-item">地面站数据库</div>
        <div class="dropdown-item">城市数据库</div>
        <div class="dropdown-item">恒星数据库</div>
        <div class="dropdown-item">发射站数据库</div>
      </div>
    </div> -->
    <div class="nav-item" @click="showBusinessDesignDialog">
      业务设置
    </div>
    <div class="nav-item" @click="showSimulationResultDialog">
      仿真结果展示
    </div>
    <!-- <div class="nav-item">
      星座设计
    </div>
    <div class="nav-item">
      需求规划
    </div>
    <div class="nav-item dropdown">
      帮助
      <span class="dropdown-icon">▼</span>
    </div>
    <div class="nav-item dropdown">
      工具
      <span class="dropdown-icon">▼</span>
    </div> -->
    <div class="nav-center">
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
    </div>
    <!-- <div class="nav-item">
      我的MAC
    </div> -->

    <div class="nav-spacer"></div>  <!-- 添加这个空间占位器 -->
    <div class="header-buttons">
      <button 
        class="simulation-btn" 
        @click="startSimulation" 
        :disabled="isSimulating"
      >
        {{ isSimulating ? '运行中...' : '开始仿真' }}
      </button>
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
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import ScenarioDialog from './ScenarioDialog.vue';
import SimulationResultDialog from './SimulationResultDialog.vue';
import BusinessDesignDialog from './BusinessDesignDialog.vue';

const isSimulating = ref(false);


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
.nav-spacer {
  flex: 1;  /* 添加这个样式让空间占位器占据所有剩余空间 */
}

.header-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-right: 20px;  /* 添加右侧边距 */
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
  height: 80px;  /* 修改为80px */
  align-items: center;
  width: 100%;
  border-bottom: 1px solid #333;
  position: relative;  /* 添加这行 */
}

.nav-item {
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
  min-width: 150px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  border-left: 3px solid #f39c12;
}

.dropdown-item {
  padding: 10px 15px;
  text-align: left;
  cursor: pointer;
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
</style>
