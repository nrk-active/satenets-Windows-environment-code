<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>想定新建</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>名称：</label>
          <input type="text" v-model="scenarioName" placeholder="想定" class="form-input">
        </div>
        <div class="form-group">
          <label>作者：</label>
          <input type="text" v-model="author" class="form-input">
        </div>
        <div class="form-group">
          <label>想定描述：</label>
          <textarea v-model="description" placeholder="请输入内容" class="form-textarea"></textarea>
        </div>
        <div class="form-group">
          <label>开始时间：</label>
          <div class="time-selector">
            <input type="text" v-model="startTime" class="form-input time-input" readonly>
            <span class="dropdown-icon">▼</span>
          </div>
        </div>
        <div class="form-group">
          <label>结束时间：</label>
          <div class="time-selector">
            <input type="text" v-model="endTime" class="form-input time-input" readonly>
            <span class="dropdown-icon">▼</span>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn cancel-btn" @click="$emit('close')">取消</button>
        <button class="btn confirm-btn" @click="confirmCreate">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const scenarioName = ref('想定');
const author = ref('');
const description = ref('');
const startTime = ref('2025/05/19 00:00:00.000 UTC');
const endTime = ref('2025/05/20 00:00:00.000 UTC');

const confirmCreate = () => {
  // 这里可以添加创建想定的逻辑
  console.log('创建新想定:', {
    name: scenarioName.value,
    author: author.value,
    description: description.value,
    startTime: startTime.value,
    endTime: endTime.value
  });
  
  // 关闭对话框
  emit('close');
};

const emit = defineEmits(['close']);
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  width: 400px;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #333;
  border-bottom: 2px solid #f39c12;
}

.dialog-header h3 {
  margin: 0;
  color: white;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  color: #ccc;
  font-size: 20px;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.dialog-body {
  padding: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #ddd;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 10px;
  background-color: #333;
  border: 1px solid #f39c12;
  border-radius: 3px;
  color: white;
  box-sizing: border-box;
}

.form-textarea {
  height: 80px;
  resize: vertical;
}

.time-selector {
  position: relative;
}

.time-input {
  padding-right: 30px;
}

.dropdown-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #ccc;
  pointer-events: none;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 15px;
  background-color: #333;
}

.btn {
  padding: 6px 15px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  margin-left: 10px;
}

.cancel-btn {
  background-color: #555;
  color: white;
}

.confirm-btn {
  background-color: #f39c12;
  color: white;
}

.cancel-btn:hover {
  background-color: #666;
}

.confirm-btn:hover {
  background-color: #e67e22;
}
</style>