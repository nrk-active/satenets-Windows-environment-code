<template>
  <div id="app" :class="{'theme-dark': isDarkTheme, 'theme-light': !isDarkTheme}">
    <!-- 路由出口 -->
    <router-view />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';

// 登录状态管理
const isLoggedIn = ref(false);
const username = ref('');
const isGuestMode = ref(false);

// 当前选择的进程ID
const selectedProcessId = ref(null);

// 新增主题状态管理
const isDarkTheme = ref(true); // 默认启用深色模式

function toggleTheme() {
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('theme', isDarkTheme.value ? 'dark' : 'light');
  console.log(`主题已切换到: ${isDarkTheme.value ? '深色' : '浅色'}`);
}

// 用户凭据缓存
const userCredentials = ref({
  username: '',
  password: '',
  token: ''
});

// 提供登录状态给子组件
provide('isLoggedIn', isLoggedIn);
provide('username', username);
provide('isGuestMode', isGuestMode);
provide('userCredentials', userCredentials);
provide('selectedProcessId', selectedProcessId);

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
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    isDarkTheme.value = false;
  }
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

// 提供全局主题状态和切换函数
provide('isDarkTheme', isDarkTheme);
provide('toggleTheme', toggleTheme);

// 提供登录状态给子组件
provide('isLoggedIn', isLoggedIn);
provide('username', username);
provide('isGuestMode', isGuestMode);
provide('userCredentials', userCredentials);
provide('selectedProcessId', selectedProcessId);

// 暴露方法给路由组件使用
provide('authMethods', {
  handleLoginSuccess,
  handleGuestLogin,
  handleLogout
});

// 在组件挂载时恢复登录状态
onMounted(() => {
  restoreLoginState();
});
</script>
<style>

/* 根样式变量 - 深色主题 (默认) */
:root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #232323;
    --bg-tertiary: #2a2a2a;
    --color-text: #f1f1f1;
    --color-text-dim: #aaa;
    --color-border: #333;
    --color-highlight: #f39c12;
    --color-accent: #4CAF50;
    --color-shadow: rgba(0, 0, 0, 0.4);
    --tooltip-bg: rgba(0, 0, 0, 0.8);
    --nav-height: 50px; /* 简化导航栏高度 */
}

/* 浅色主题 */
#app.theme-light {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f7fa;
    --bg-tertiary: #eeeeee;
    --color-text: #222222;
    --color-text-dim: #555555;
    --color-border: #cccccc;
    --color-highlight: #3498db;
    --color-accent: #2ecc71;
    --color-shadow: rgba(0, 0, 0, 0.15);
    --tooltip-bg: rgba(255, 255, 255, 0.9);
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-primary); /* 使用主题变量 */
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