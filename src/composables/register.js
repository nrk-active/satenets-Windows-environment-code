import { ref } from 'vue';

export function useRegister() {
  const isRegister = ref(false);
  const username = ref('');
  const email = ref('');
  const password = ref('');
  const confirmPassword = ref('');

  // 错误提示
  const usernameError = ref('');
  const emailError = ref('');
  const passwordError = ref('');
  const confirmPasswordError = ref('');
  const submitError = ref('');

  function switchMode() {
    isRegister.value = !isRegister.value;
    clearFields();
  }

  function clearFields() {
    username.value = '';
    email.value = '';
    password.value = '';
    confirmPassword.value = '';
    usernameError.value = '';
    emailError.value = '';
    passwordError.value = '';
    confirmPasswordError.value = '';
    submitError.value = '';
  }

  // 校验用户名：4-16位，仅字母数字下划线
  function validateUsername() {
    if (!isRegister.value) return;
    if (!/^[a-zA-Z0-9_]{4,16}$/.test(username.value)) {
      usernameError.value = '用户名需4-16位，仅限字母、数字、下划线';
    } else {
      usernameError.value = '';
    }
  }

  // 校验邮箱格式
  function validateEmail() {
    if (!isRegister.value) return;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.value) {
      emailError.value = '请输入邮箱地址';
    } else if (!emailRegex.test(email.value)) {
      emailError.value = '请输入有效的邮箱地址';
    } else {
      emailError.value = '';
    }
  }

  // 校验密码：6-18位，必须包含字母和数字
  function validatePassword() {
    if (!isRegister.value) return;
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{6,18}$/.test(password.value)) {
      passwordError.value = '密码需6-18位，必须包含字母和数字';
    } else {
      passwordError.value = '';
    }
  }

  // 校验确认密码
  function validateConfirmPassword() {
    if (!isRegister.value) return;
    if (confirmPassword.value !== password.value) {
      confirmPasswordError.value = '两次输入的密码不一致';
    } else {
      confirmPasswordError.value = '';
    }
  }

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
      // console.log('获取到CSRF Token:', data);
      return data.csrfToken;
    } catch (error) {
      console.error('获取CSRF Token失败:', error);
      throw error;
    }
  }

  // 发送注册请求
  async function registerUser(csrfToken) {
    try {
      const registerData = {
        username: username.value,
        email: email.value,
        password: password.value,
        password2: confirmPassword.value
      };
      
      // console.log('发送注册数据:', registerData);
      
      const response = await fetch('http://127.0.0.1:8000/api/accounts/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(registerData)
      });
      
      const responseData = await response.json();
      // console.log('注册响应:', responseData);
      
      if (!response.ok) {
        if (response.status === 400) {
          let errorMessage = '注册失败：';
          if (responseData.username) {
            errorMessage += `用户名：${responseData.username[0]} `;
          }
          if (responseData.email) {
            errorMessage += `邮箱：${responseData.email[0]} `;
          }
          if (responseData.password) {
            errorMessage += `密码：${responseData.password[0]} `;
          }
          if (responseData.non_field_errors) {
            errorMessage += responseData.non_field_errors[0];
          }
          throw new Error(errorMessage);
        } else {
          throw new Error(`注册失败: ${response.status} ${response.statusText}`);
        }
      }
      
      return responseData;
    } catch (error) {
      console.error('注册请求失败:', error);
      throw error;
    }
  }

  // 自动登录功能
  async function performAutoLogin() {
    try {
      const loginData = {
        username: username.value,
        password: password.value
      };
      
      // console.log('注册成功后自动登录:', loginData);
      
      const response = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });
      
      const responseData = await response.json();
      // console.log('自动登录响应:', responseData);
      
      if (!response.ok) {
        throw new Error(`自动登录失败: ${response.status} ${response.statusText}`);
      }
      
      // 检查响应是否包含token
      if (responseData.access && responseData.refresh) {
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
        throw new Error('自动登录响应格式错误');
      }
      
    } catch (error) {
      console.error('自动登录失败:', error);
      throw error;
    }
  }

  // 执行注册流程
  async function performRegister() {
    try {
      // console.log('开始获取CSRF Token...');
      const csrfToken = await getCsrfToken();
      
      // console.log('开始发送注册请求...');
      const registerResult = await registerUser(csrfToken);
      
      // console.log('注册成功:', registerResult);
      
      // 注册成功后自动登录
      // console.log('开始自动登录...');
      const loginResult = await performAutoLogin();
      
      // console.log('自动登录成功:', loginResult);
      
      return {
        success: true,
        data: registerResult,
        user: {
          username: username.value,
          email: email.value
        },
        tokens: loginResult.tokens,
        token: loginResult.tokens.access  // 为了向后兼容
      };
    } catch (error) {
      console.error('注册或自动登录过程失败:', error);
      return {
        success: false,
        error: error.message || '注册失败，请重试'
      };
    }
  }

  // 提交表单
  async function submit(onSuccess, onError) {
    submitError.value = '';
    
    if (isRegister.value) {
      // 注册模式校验
      validateUsername();
      validateEmail();
      validatePassword();
      validateConfirmPassword();
      
      if (usernameError.value || emailError.value || passwordError.value || confirmPasswordError.value) {
        return false;
      }
      
      if (!username.value || !email.value || !password.value || !confirmPassword.value) {
        submitError.value = '请填写完整信息';
        return false;
      }
      
      const result = await performRegister();
      
      if (result.success) {
        if (onSuccess) {
          // 传递包含token的完整用户信息
          onSuccess({
            username: result.user.username,
            email: result.user.email,
            token: result.token,
            tokens: result.tokens
          });
        }
        return true;
      } else {
        submitError.value = result.error;
        if (onError) {
          onError(result.error);
        }
        return false;
      }
    } else {
      // 登录模式校验
      if (!username.value || !password.value) {
        submitError.value = '请输入用户名和密码';
        return false;
      }
      
      // TODO: 实现登录逻辑
      if (onSuccess) {
        onSuccess({ username: username.value });
      }
      return true;
    }
  }

  return {
    // 状态
    isRegister,
    username,
    email,
    password,
    confirmPassword,
    
    // 错误提示
    usernameError,
    emailError,
    passwordError,
    confirmPasswordError,
    submitError,
    
    // 方法
    switchMode,
    clearFields,
    validateUsername,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
    submit,
    submitRegister: submit  // 为了向后兼容，同时导出为submitRegister
  };
}