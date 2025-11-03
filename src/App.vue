<template>
  <div id="app">
    <!-- 路由出口，使用key强制重新渲染 -->
    <router-view :key="$route.fullPath" />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const $route = useRoute();

// 登录状态管理
const isLoggedIn = ref(false);
const username = ref('');
const isGuestMode = ref(false);

// 当前选择的进程ID
const selectedProcessId = ref(null);

// 用户凭据缓存
const userCredentials = ref({
  username: '',
  password: '',
  token: ''
});

// 【新增】主题状态管理
// 默认深色，或根据本地存储恢复。如果本地存储为空，默认为'dark'。
const isDarkTheme = ref(localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme'));

function applyTheme(theme) {
  // 将主题模式应用于 HTML 根元素，触发 CSS 变量切换
  document.documentElement.setAttribute('data-theme', theme);
  console.log(`主题已切换到: ${theme}`);
}

function toggleTheme() {
  const newTheme = isDarkTheme.value ? 'light' : 'dark';
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
}

// 提供登录状态给子组件
provide('isLoggedIn', isLoggedIn);
provide('username', username);
provide('isGuestMode', isGuestMode);
provide('userCredentials', userCredentials);
provide('selectedProcessId', selectedProcessId);

// **【新增】提供主题状态和切换函数给子组件**
provide('isDarkTheme', isDarkTheme);
provide('toggleTheme', toggleTheme);

// 处理登录成功
function handleLoginSuccess(user) {
  isLoggedIn.value = true;
  isGuestMode.value = false;
  username.value = user.username || user;
  
  // 缓存用户凭据
  if (user.username && user.password) {
    userCredentials.value = {
      username: user.username,
      password: user.password,
      token: user.token || ''
    };
    
    // 保存到 localStorage
    localStorage.setItem('userCredentials', JSON.stringify(userCredentials.value));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', user.username);
  }
}

// 处理游客登录
function handleGuestLogin() {
  isGuestMode.value = true;
  isLoggedIn.value = false;
  username.value = '游客模式';
}

// 处理登出
function handleLogout() {
  isLoggedIn.value = false;
  username.value = '';
  isGuestMode.value = false;
  
  // 清除进程ID状态
  selectedProcessId.value = null;
  
  // 清除缓存的凭据
  userCredentials.value = {
    username: '',
    password: '',
    token: ''
  };
  
  // 清除 localStorage
  localStorage.removeItem('userCredentials');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('selectedProcessId');
  localStorage.removeItem('selectedProcessInfo');
  
  console.log('已清除所有用户数据和进程选择');
}

// 从本地存储恢复登录状态
function restoreLoginState() {
  const savedCredentials = localStorage.getItem('userCredentials');
  const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
  const savedUsername = localStorage.getItem('username');
  const savedProcessId = localStorage.getItem('selectedProcessId');
  
  if (savedCredentials && savedIsLoggedIn === 'true' && savedUsername) {
    try {
      userCredentials.value = JSON.parse(savedCredentials);
      isLoggedIn.value = true;
      username.value = savedUsername;
      console.log('恢复登录状态:', { username: savedUsername, isLoggedIn: true });
    } catch (error) {
      console.error('恢复登录状态失败:', error);
      handleLogout(); // 清除可能损坏的数据
    }
  }
  
  // 恢复进程ID
  if (savedProcessId) {
    selectedProcessId.value = savedProcessId;
    console.log('恢复进程ID:', savedProcessId);
  }
}

// 从本地存储恢复主题状态并在DOM上应用
function restoreThemeState() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDarkTheme.value = savedTheme === 'dark';
    applyTheme(savedTheme);
  } else {
    // 默认应用深色主题
    applyTheme('dark');
  }
}

// 暴露方法给路由组件使用
provide('authMethods', {
  handleLoginSuccess,
  handleGuestLogin,
  handleLogout
});

// 在组件挂载时恢复登录和主题状态
onMounted(() => {
  restoreThemeState(); // **【新增】调用主题恢复函数**
  restoreLoginState();
});
</script>


<style>
/* **[主题功能新增]**：定义 CSS 变量 */
:root {
  /* 深色模式变量 (默认) */
  --theme-main-bg: #232323;      /* 主界面背景 (导航栏, 侧边栏, 底部面板) */
  --theme-main-text: #fff;      /* 主界面文字 */
  --theme-secondary-bg: #181818; /* 次级背景 (导航栏顶部细条, 列表项header) */
  --theme-dialog-bg: #2a2a2a;    /* 对话框主体、列表项背景 */
  --theme-accent: #f39c12;       /* 强调色/边框色 */
  --theme-border: #444;          /* 一般边框/分割线 */
  --theme-shadow: rgba(0,0,0,0.28);
}

/* 浅色模式覆盖 */
[data-theme='light'] {
  --theme-main-bg: #f7f7f7;      /* 浅色背景 (接近白色/浅灰) */
  --theme-main-text: #222;      /* 黑色文字 */
  --theme-secondary-bg: #ffffff; /* 白色次级背景 */
  --theme-dialog-bg: #f0f0f0;    /* 浅灰对话框/列表项背景 */
  --theme-accent: #1890ff;       /* 强调色改为蓝色系 */
  --theme-border: #ccc;          /* 浅色边框 */
  --theme-shadow: rgba(0,0,0,0.1);
}

/* 确保整个应用的背景也切换 */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  background-color: var(--theme-main-bg);
  color: var(--theme-main-text);
}

/* 隐藏Cesium原生时间轴和动画控件 */
.cesium-viewer-timelineContainer,
.cesium-timeline-main,
.cesium-timeline-container,
.cesium-timeline-track {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}
</style>