<template>
  <div id="app">
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
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}
</style>