<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-left">
        <img src="../../public/images/login-illustration.png" alt="卫星网络图" />
      </div>
      <div class="login-right">
        <div class="login-header">
          <img src="../../public/images/logo.png" alt="FDControl" class="logo" />
          <h2>用户登录</h2>
        </div>
        <div class="login-form">
          <div class="input-group">
            <label for="username">用户名</label>
            <input 
              id="username" 
              v-model="username" 
              type="text" 
              placeholder="请输入用户名" 
              @input="validateUsername"
            />
            <div v-if="isRegister" class="input-tip">4-16位，仅限字母、数字、下划线</div>
            <div v-if="isRegister && usernameError" class="input-error">{{ usernameError }}</div>
          </div>
          <div class="input-group">
            <label for="password">密码</label>
            <input 
              id="password" 
              v-model="password" 
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
          <button class="login-button" @click="submit">{{ isRegister ? '注册' : '登录' }}</button>
          <div class="switch-mode" @click="switchMode">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </div>
          <div class="guest-login" @click="guestLogin">
            游客登录
          </div>
        </div>
      </div>
    </div>
    <div class="login-footer">
      Copyright © 2023-2024 FDControl.com.cn
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['login-success', 'guest-login']);

const isRegister = ref(false);
const username = ref('');
const password = ref('');
const confirmPassword = ref('');

// 错误提示
const usernameError = ref('');
const passwordError = ref('');
const confirmPasswordError = ref('');

function switchMode() {
  isRegister.value = !isRegister.value;
  clearFields();
}

function clearFields() {
  username.value = '';
  password.value = '';
  confirmPassword.value = '';
  usernameError.value = '';
  passwordError.value = '';
  confirmPasswordError.value = '';
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

// 游客登录函数
function guestLogin() {
  emit('guest-login');
}

function submit() {
  if (isRegister.value) {
    validateUsername();
    validatePassword();
    validateConfirmPassword();
    if (usernameError.value || passwordError.value || confirmPasswordError.value) {
      return;
    }
    if (!username.value || !password.value || !confirmPassword.value) {
      alert('请填写完整信息');
      return;
    }
    emit('login-success', username.value);
    alert('注册成功，已自动登录');
  } else {
    if (!username.value || !password.value) {
      alert('请输入用户名和密码');
      return;
    }
    emit('login-success', username.value);
    alert('登录成功');
  }
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
  height: 500px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-left {
  flex: 1;
  background-color: #1890ff;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.login-left img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
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
  margin-bottom: 30px;
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

.login-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-group {
  margin-bottom: 20px;
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
  height: 40px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-top: 10px;
}

.login-button:hover {
  background-color: #40a9ff;
}

.switch-mode {
  margin-top: 16px;
  text-align: center;
  color: #1890ff;
  cursor: pointer;
  font-size: 14px;
}

.switch-mode:hover {
  text-decoration: underline;
}

.login-footer {
  position: absolute;
  bottom: 20px;
  color: #999;
  font-size: 12px;
}

.guest-login {
  margin-top: 10px;
  text-align: center;
  color: #888;
  cursor: pointer;
  font-size: 14px;
}

.guest-login:hover {
  color: #1890ff;
  text-decoration: underline;
}
</style>