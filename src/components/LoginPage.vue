<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-left">
        <img src="../../public/images/Satellitenkommunikation.jpg" alt="卫星网络图" />
      </div>
      <div class="login-right">
        <div class="login-header">
          <img src="../../public/images/User.png" alt="FDControl" class="logo" />
          <h2>{{ isRegister ? '用户注册' : '用户登录' }}</h2>
        </div>
        <div class="login-form" :class="isRegister ? 'register-mode' : 'login-mode'">
          <!-- 显示错误信息 -->
          <div v-if="regSubmitError && isRegister" class="submit-error">{{ regSubmitError }}</div>
          <div v-if="loginError && !isRegister" class="submit-error">{{ loginError }}</div>
          
          <div class="input-group">
            <label for="username">用户名</label>
            <input 
              id="username" 
              v-model="currentUsername" 
              type="text" 
              placeholder="请输入用户名" 
              @input="validateUsername"
            />
            <div v-if="isRegister" class="input-tip">4-16位，仅限字母、数字、下划线</div>
            <div v-if="isRegister && usernameError" class="input-error">{{ usernameError }}</div>
          </div>
          
          <!-- 注册时显示邮箱输入 -->
          <div class="input-group" v-if="isRegister">
            <label for="email">邮箱</label>
            <input 
              id="email" 
              v-model="email" 
              type="email" 
              placeholder="请输入邮箱地址" 
              @input="validateEmail"
            />
            <div class="input-tip">请输入有效的邮箱地址</div>
            <div v-if="emailError" class="input-error">{{ emailError }}</div>
          </div>
          
          <div class="input-group">
            <label for="password">密码</label>
            <input 
              id="password" 
              v-model="currentPassword" 
              type="password" 
              placeholder="请输入密码" 
              @input="validatePassword"
            />
            <div v-if="isRegister" class="input-tip">6-18位，必须包含字母和数字</div>
            <div v-if="isRegister && passwordError" class="input-error">{{ passwordError }}</div>
          </div>
          
          <div class="input-group" v-if="isRegister">
            <label for="confirm-password">确认密码</label>
            <input 
              id="confirm-password" 
              v-model="confirmPassword" 
              type="password" 
              placeholder="请再次输入密码" 
              @input="validateConfirmPassword"
            />
            <div class="input-tip">请再次输入上面的密码</div>
            <div v-if="confirmPasswordError" class="input-error">{{ confirmPasswordError }}</div>
          </div>
          
          <button class="login-button" @click="handleSubmit">{{ isRegister ? '注册' : '登录' }}</button>
          <div class="switch-mode" @click="handleSwitchMode">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </div>
          <div class="guest-login" @click="guestLogin">
            游客登录
          </div>
        </div>
      </div>
    </div>
    <div class="login-footer">
      Copyright © xxxxxx
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRegister } from '../composables/register.js';
import { useLogin } from '../composables/useLogin.js';
import { useAuth } from '../composables/useAuth.js';

const route = useRoute();
const router = useRouter();
const emit = defineEmits(['login-success', 'guest-login']);

// 认证相关
const { setTokens } = useAuth();

// 注入App.vue提供的登录方法
const authMethods = inject('authMethods', {});
const { handleLoginSuccess, handleGuestLogin } = authMethods;

// 注册相关
const {
  isRegister,
  username: regUsername,
  email,
  password: regPassword,
  confirmPassword,
  usernameError,
  emailError,
  passwordError,
  confirmPasswordError,
  submitError: regSubmitError,
  switchMode,
  clearFields: clearRegFields,
  validateUsername,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  submitRegister
} = useRegister();

// 登录相关
const {
  username: loginUsername,
  password: loginPassword,
  loginError,
  isLoading: loginLoading,
  clearFields: clearLoginFields,
  performLogin
} = useLogin();

// 根据URL参数设置初始模式
onMounted(() => {
  const mode = route.query.mode;
  if (mode === 'register') {
    isRegister.value = true;
  } else if (mode === 'login') {
    isRegister.value = false;
  }
});

// 创建计算属性来处理双向绑定
const currentUsername = computed({
  get() {
    return isRegister.value ? regUsername.value : loginUsername.value;
  },
  set(value) {
    if (isRegister.value) {
      regUsername.value = value;
    } else {
      loginUsername.value = value;
    }
  }
});

const currentPassword = computed({
  get() {
    return isRegister.value ? regPassword.value : loginPassword.value;
  },
  set(value) {
    if (isRegister.value) {
      regPassword.value = value;
    } else {
      loginPassword.value = value;
    }
  }
});

// // 游客登录
// function guestLogin() {
//   emit('guest-login');
// }

// 处理表单提交
async function handleSubmit() {
  const submitButton = document.querySelector('.login-button');
  if (!submitButton) return;
  
  const originalText = submitButton.textContent;
  
  submitButton.textContent = isRegister.value ? '注册中...' : '登录中...';
  submitButton.disabled = true;
  
  try {
    if (isRegister.value) {
      // 注册流程
      const success = await submitRegister(
        (userData) => {
          // 保存token到本地存储和状态管理
          if (userData.tokens) {
            setTokens(userData.tokens.access, userData.tokens.refresh);
          }
          
          // 调用App.vue的登录成功方法
          if (handleLoginSuccess) {
            handleLoginSuccess({
              username: userData.username,
              password: regPassword.value, // 注册时的密码
              token: userData.token || userData.tokens?.access || ''
            });
          }
          emit('login-success', userData);
          alert('注册成功，已自动登录');
          router.push('/satellite');  // 跳转到卫星视图
        },
        (error) => {
          console.error('注册失败:', error);
        }
      );
    } else {
      // 登录流程
      const result = await performLogin();
      if (result.success) {
        // 传递完整的用户信息，包括用户名、密码和token
        const userInfo = {
          username: result.user.username,
          password: loginPassword.value, // 包含密码用于后续API调用
          token: result.tokens.access,
          refreshToken: result.tokens.refresh
        };
        
        // 调用App.vue的登录成功方法
        if (handleLoginSuccess) {
          handleLoginSuccess(userInfo);
        }
        
        emit('login-success', userInfo);
        alert('登录成功');
        router.push('/satellite');  // 跳转到卫星视图
      }
    }
  } finally {
    submitButton.textContent = isRegister.value ? '注册' : '登录';
    submitButton.disabled = false;
  }
}

// 游客登录
function guestLogin() {
  console.log('游客登录：当前路由', route.path);
  
  // 设置游客模式标识
  localStorage.setItem('guest_mode', 'true');
  
  // 调用App.vue的游客登录方法
  if (handleGuestLogin) {
    handleGuestLogin();
  }
  
  // 触发事件
  emit('guest-login');
  
  // 直接使用 window.location.href 强制页面完全重新加载
  // 这是最可靠的方式，确保组件完全卸载和重新加载
  window.location.href = '/satellite';
}

// 切换模式时清理字段并更新URL
function handleSwitchMode() {
  switchMode();
  clearLoginFields();
  
  // 更新URL参数
  const newMode = isRegister.value ? 'register' : 'login';
  router.replace({ name: 'login', query: { mode: newMode } });
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  position: relative;
}

.login-container {
  display: flex;
  width: 900px;
  height: 650px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-left {
  flex: 1;
  background-color: #1890ff;
  position: relative;
  overflow: hidden;
}

.login-left img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.login-right {
  flex: 1;
  padding: 40px;
  display: flex;
  flex-direction: column;
}

.login-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.logo {
  width: 40px;
  height: 40px;
  margin-right: 10px;
}

.login-header h2 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

/* 基础表单样式 */
.login-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 登录模式 - 居中对齐 */
.login-form.login-mode {
  justify-content: center;
  padding-top: 20px;
}

.login-form.login-mode .input-group {
  margin-bottom: 24px;
}

.login-form.login-mode .login-button {
  margin-top: 30px;
  margin-bottom: 20px;
}

.login-form.login-mode .switch-mode {
  margin-top: 20px;
  margin-bottom: 15px;
}

.login-form.login-mode .guest-login {
  margin-top: 10px;
}

/* 注册模式 - 均匀分布 */
.login-form.register-mode {
  justify-content: space-between;
}

.login-form.register-mode .input-group {
  margin-bottom: 12px;
}

.login-form.register-mode .login-button {
  margin-top: 15px;
  margin-bottom: 10px;
}

.login-form.register-mode .switch-mode {
  margin-top: 12px;
  margin-bottom: 8px;
}

.login-form.register-mode .guest-login {
  margin-top: 5px;
}

.input-group label {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
  text-align: left;
}

.input-group input {
  width: 100%;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0 12px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.input-group input:focus {
  border-color: #1890ff;
  outline: none;
}

.input-tip {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  text-align: left;
}

.input-error {
  font-size: 12px;
  color: #f5222d;
  margin-top: 4px;
  text-align: left;
}

.login-button {
  height: 45px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-button:hover {
  background-color: #40a9ff;
}

.login-button:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

.login-button:disabled:hover {
  background-color: #d9d9d9;
}

.switch-mode {
  text-align: center;
  color: #1890ff;
  cursor: pointer;
  font-size: 14px;
}

.switch-mode:hover {
  text-decoration: underline;
}

.guest-login {
  text-align: center;
  color: #888;
  cursor: pointer;
  font-size: 14px;
}

.guest-login:hover {
  color: #1890ff;
  text-decoration: underline;
}

.submit-error {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: #f5222d;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 12px;
  text-align: center;
}

.login-footer {
  position: absolute;
  bottom: 20px;
  color: #999;
  font-size: 12px;
}

/* 响应式设计 */
@media (max-height: 800px) {
  .login-container {
    height: 90vh;
    max-height: 700px;
  }
  
  .login-right {
    padding: 30px;
  }
  
  .login-form.login-mode {
    padding-top: 10px;
  }
  
  .login-form.login-mode .input-group {
    margin-bottom: 20px;
  }
  
  .login-form.register-mode .input-group {
    margin-bottom: 10px;
  }
  
  .input-group input {
    height: 36px;
  }
}

@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
    padding: 20px;
  }
  
  .login-left {
    margin-bottom: 20px;
  }
  
  .login-right {
    width: 100%;
    max-width: none;
  }
}
</style>