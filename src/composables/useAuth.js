import { ref } from 'vue';

// 全局的token状态
const accessToken = ref(localStorage.getItem('access_token') || '');
const refreshToken = ref(localStorage.getItem('refresh_token') || '');
const isAuthenticated = ref(!!accessToken.value);

export function useAuth() {
  // 保存token到localStorage和内存
  function setTokens(access, refresh) {
    accessToken.value = access;
    refreshToken.value = refresh;
    isAuthenticated.value = true;
    
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    // console.log('Token已保存:', { access, refresh });
  }

  // 清除token
  function clearTokens() {
    accessToken.value = '';
    refreshToken.value = '';
    isAuthenticated.value = false;
    
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('selectedProcessId');
    localStorage.removeItem('selectedProcessInfo');
    
    // console.log('Token和进程选择已清除');
  }

  // 获取当前token
  function getTokens() {
    return {
      access: accessToken.value,
      refresh: refreshToken.value
    };
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    setTokens,
    clearTokens,
    getTokens
  };
}