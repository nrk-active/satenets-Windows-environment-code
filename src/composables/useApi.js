import { ref } from 'vue';

export function useApi() {
  const loading = ref(false);
  const error = ref('');

  // 获取CSRF Token
  async function getCsrfToken() {
    try {
      const response = await fetch('http://localhost:8000/api/csrf/', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`获取CSRF Token失败: ${response.status}`);
      }
      
      const data = await response.json();
      return data.csrfToken;
    } catch (err) {
      console.error('获取CSRF Token失败:', err);
      throw err;
    }
  }

  // 通用POST请求 - 支持自定义headers
  async function postRequest(url, data, options = {}) {
    const { 
      needCsrf = true, 
      extraHeaders = {},
      needAuth = false,
      authToken = null 
    } = options;
    
    loading.value = true;
    error.value = '';
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        // 合并额外的headers
        ...extraHeaders
      };

      // 添加CSRF Token
      if (needCsrf) {
        const csrfToken = await getCsrfToken();
        headers['X-CSRFToken'] = csrfToken;
      }

      // 添加Authorization Header
      if (needAuth && authToken) {
        headers['Authorization'] = authToken;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || `请求失败: ${response.status}`);
      }

      return responseData;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 专门的认证请求函数
  async function authRequest(url, data, authToken) {
    return postRequest(url, data, {
      needCsrf: true,
      needAuth: true,
      authToken: authToken
    });
  }

  return {
    loading,
    error,
    getCsrfToken,
    postRequest,
    authRequest
  };
}