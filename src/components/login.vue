<template>
  <div v-if="show" class="login-modal">
    <div class="login-box">
      <h3>{{ isRegister ? '注册' : '登录' }}</h3>
      <div class="input-group">
        <label for="username-input">用户名</label>
        <input id="username-input" v-model="username" placeholder="请输入用户名" @input="validateUsername" />
        <div v-if="isRegister" class="input-tip">4-16位，仅限字母、数字、下划线</div>
        <div v-if="isRegister && usernameError" class="input-error">{{ usernameError }}</div>
      </div>
      <div class="input-group">
        <label for="password-input">密码</label>
        <input id="password-input" v-model="password" type="password" placeholder="请输入密码" @input="validatePassword" />
        <div v-if="isRegister" class="input-tip">6-18位，必须包含字母和数字</div>
        <div v-if="isRegister && passwordError" class="input-error">{{ passwordError }}</div>
      </div>
      <div class="input-group" v-if="isRegister">
        <label for="confirm-password-input">确认密码</label>
        <input id="confirm-password-input" v-model="confirmPassword" type="password" placeholder="请再次输入密码" @input="validateConfirmPassword" />
        <div class="input-tip">请再次输入上面的密码</div>
        <div v-if="confirmPasswordError" class="input-error">{{ confirmPasswordError }}</div>
      </div>
      <div class="login-actions">
        <button @click="submit">{{ isRegister ? '注册' : '登录' }}</button>
        <button @click="close">取消</button>
      </div>
      <div class="switch-link" @click="switchMode">
        {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineExpose, defineEmits } from 'vue'

const emit = defineEmits(['login-success'])

const show = ref(false)
const isRegister = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')

// 错误提示
const usernameError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')

function openLogin() {
  show.value = true
  isRegister.value = false
  clearFields()
}
function openRegister() {
  show.value = true
  isRegister.value = true
  clearFields()
}
function close() {
  show.value = false
  clearFields()
}
function clearFields() {
  username.value = ''
  password.value = ''
  confirmPassword.value = ''
  usernameError.value = ''
  passwordError.value = ''
  confirmPasswordError.value = ''
}
function switchMode() {
  isRegister.value = !isRegister.value
  clearFields()
}

// 校验用户名：4-16位，仅字母数字下划线
function validateUsername() {
  if (!isRegister.value) return
  if (!/^[a-zA-Z0-9_]{4,16}$/.test(username.value)) {
    usernameError.value = '用户名需4-16位，仅限字母、数字、下划线'
  } else {
    usernameError.value = ''
  }
}

// 校验密码：6-18位，必须包含字母和数字
function validatePassword() {
  if (!isRegister.value) return
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{6,18}$/.test(password.value)) {
    passwordError.value = '密码需6-18位，必须包含字母和数字'
  } else {
    passwordError.value = ''
  }
}

// 校验确认密码
function validateConfirmPassword() {
  if (!isRegister.value) return
  if (confirmPassword.value !== password.value) {
    confirmPasswordError.value = '两次输入的密码不一致'
  } else {
    confirmPasswordError.value = ''
  }
}

function submit() {
  if (isRegister.value) {
    validateUsername()
    validatePassword()
    validateConfirmPassword()
    if (usernameError.value || passwordError.value || confirmPasswordError.value) {
      return
    }
    if (!username.value || !password.value || !confirmPassword.value) {
      alert('请填写完整信息')
      return
    }
    emit('login-success', username.value)
    alert('注册成功，已自动登录')
    close()
  } else {
    if (!username.value || !password.value) {
      alert('请输入用户名和密码')
      return
    }
    emit('login-success', username.value)
    alert('登录成功')
    close()
  }
}

// 让父组件可以调用openLogin/openRegister
defineExpose({ openLogin, openRegister })
</script>

<style scoped>
.login-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.login-box {
  background: #fff;
  padding: 32px 28px 18px 28px;
  border-radius: 8px;
  min-width: 280px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.login-box h3 {
  margin: 0 0 16px 0;
  text-align: center;
}
.input-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}
.input-group label {
  font-size: 15px;
  color: #222;
  margin-bottom: 4px;
  margin-left: 2px;
  text-align: left;    /* 保证label靠左 */
  font-weight: 500;
  /* 去除任何可能的居中 */
  display: block;
}
.login-box input {
  margin-bottom: 0;
  padding: 7px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 15px;
  background: #f8fafc;
}
.input-tip {
  color: #888;
  font-size: 12px;
  margin: 2px 0 0 2px;
}
.input-error {
  color: #e74c3c;
  font-size: 12px;
  margin: 2px 0 0 2px;
}
.login-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.login-actions button {
  padding: 5px 18px;
  border: none;
  border-radius: 4px;
  background: #27ae60;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
.login-actions button:last-child {
  background: #aaa;
}
.switch-link {
  color: #27ae60;
  text-align: center;
  cursor: pointer;
  font-size: 13px;
  margin-top: 2px;
}
.switch-link:hover {
  text-decoration: underline;
}
</style>