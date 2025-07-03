<!-- filepath: d:\front end development\Git\salasim-frontend\src\components\setting.vue -->
<template>
  <div v-if="show" class="setting-modal">
    <div class="setting-box">
      <h3>系统设置</h3>
      <div class="setting-group">
        <label>
          <span>主题模式：</span>
          <select v-model="theme">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </div>
      <div class="setting-group">
        <label>
          <span>语言：</span>
          <select v-model="language">
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <div class="setting-actions">
        <button @click="save">保存</button>
        <button @click="close">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineExpose } from 'vue'

const show = ref(false)
const theme = ref('light')
const language = ref('zh')

function open() {
  show.value = true
}
function close() {
  show.value = false
}
function save() {
  // 这里可以触发事件或调用接口保存设置
  alert(`设置已保存\n主题：${theme.value}\n语言：${language.value === 'zh' ? '中文' : 'English'}`)
  close()
}

defineExpose({ open })
</script>

<style scoped>
.setting-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.setting-box {
  background: #fff;
  padding: 32px 28px 18px 28px;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.setting-box h3 {
  margin: 0 0 16px 0;
  text-align: center;
}
.setting-group {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
}
.setting-group label {
  font-size: 15px;
  color: #222;
  display: flex;
  align-items: center;
  gap: 10px;
}
.setting-group select {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 14px;
}
.setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.setting-actions button {
  padding: 5px 18px;
  border: none;
  border-radius: 4px;
  background: #27ae60;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
.setting-actions button:last-child {
  background: #aaa;
}
</style>