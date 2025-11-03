import { ref } from 'vue';
import { useAuth } from './useAuth.js';

export function useLogin() {
  const { setTokens, clearTokens } = useAuth();
  
  const username = ref('');
  const password = ref('');
  const loginError = ref('');
  const isLoading = ref(false);

  function clearFields() {
    username.value = '';
    password.value = '';
    loginError.value = '';
  }

  // 发送登录请求
  async function loginUser() {
    try {
      const loginData = {
        username: username.value,
        password: password.value
      };
      
      // console.log('发送登录数据:', loginData);
      
      const response = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });
      
      const responseData = await response.json();
      // console.log('登录响应:', responseData);
      
      if (!response.ok) {
        if (response.status === 401) {
          // 处理认证失败
          if (responseData.detail === "No active account found with the given credentials") {
            throw new Error('用户名或密码错误，请检查后重试');
          } else {
            throw new Error(responseData.detail || '登录失败');
          }
        } else {
          throw new Error(`登录失败: ${response.status} ${response.statusText}`);
        }
      }
      
      // 检查响应是否包含token
      if (responseData.access && responseData.refresh) {
        // 保存token
        setTokens(responseData.access, responseData.refresh);
        // console.log('登录成功，Token已保存');
        return {
          success: true,
          tokens: {
            access: responseData.access,
            refresh: responseData.refresh
          },
          user: {
            username: username.value
          }
        };
      } else {
        throw new Error('登录响应格式错误');
      }
      
    } catch (error) {
      console.error('登录请求失败:', error);
      throw error;
    }
  }

  // 执行登录流程
  async function performLogin() {
    if (!username.value || !password.value) {
      loginError.value = '请输入用户名和密码';
      return { success: false, error: '请输入用户名和密码' };
    }

    isLoading.value = true;
    loginError.value = '';
    
    try {
      // console.log('开始登录...');
      const result = await loginUser();
      
      // console.log('登录成功:', result);
      return {
        success: true,
        data: result,
        user: result.user,
        tokens: result.tokens
      };
    } catch (error) {
      console.error('登录失败:', error);
      const errorMessage = error.message || '登录失败，请重试';
      loginError.value = errorMessage;
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      isLoading.value = false;
    }
  }

  // 登出功能
  function logout() {
    clearTokens();
    clearFields();
    // console.log('用户已登出');
  }

  return {
    // 状态
    username,
    password,
    loginError,
    isLoading,
    
    // 方法
    clearFields,
    performLogin,
    logout
  };
}