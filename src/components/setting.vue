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
import { ref, inject } from 'vue'

const show = ref(false)
// 【新增】注入全局主题状态和切换函数 (来自 App.vue)
const isDarkTheme = inject('isDarkTheme', ref(true));
const toggleTheme = inject('toggleTheme', () => {});

// 本地状态，用于绑定 select，并与全局状态同步
const theme = ref(isDarkTheme.value ? 'dark' : 'light'); 
const language = ref('zh')

function open() {
  show.value = true
  // 【修改】打开时，同步本地主题选择与当前全局主题状态
  theme.value = isDarkTheme.value ? 'dark' : 'light'; 
}
function close() {
  show.value = false
}
function save() {
  // 根据选择和当前状态判断是否需要切换
  const targetIsDark = theme.value === 'dark';
  
  // 只有在目标主题与当前全局主题不一致时才调用切换函数
  if (targetIsDark !== isDarkTheme.value) {
    toggleTheme(); // App.vue 中的函数会处理实际的切换
  }
  
  alert(`设置已保存\n主题：${theme.value}\n语言：${language.value === 'zh' ? '中文' : 'English'}`)
  close()
}

defineExpose({ open })
</script>

<style scoped>
.setting-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); /* 确保背景色透明度 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001; /* **修复 1: 提高 Z-index 以确保底板可见** */
}
.setting-box {
  background: var(--theme-secondary-bg); /* **弹窗背景使用次级背景 (浅色下为白色)** */
  color: var(--theme-main-text); /* **弹窗文字使用主文字色** */
  padding: 32px 28px 18px 28px;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 2px 16px var(--theme-shadow);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.setting-box h3 {
  margin: 0 0 16px 0;
  text-align: center;
  color: var(--theme-main-text); 
}
.setting-group {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
}
.setting-group label {
  font-size: 15px;
  color: var(--theme-main-text); 
  display: flex;
  align-items: center;
  gap: 10px;
}
.setting-group select {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--theme-border);
  font-size: 14px;
  background: var(--theme-dialog-bg); /* 下拉框背景使用对话框背景 */
  color: var(--theme-main-text); 
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
  background: var(--theme-accent); 
  color: #fff; 
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.setting-actions button:hover {
  opacity: 0.8;
}
.setting-actions button:last-child {
  background: var(--theme-border); 
  color: var(--theme-main-text);
}
</style>