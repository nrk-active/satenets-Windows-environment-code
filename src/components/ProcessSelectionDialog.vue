<template>
  <div class="dialog-overlay" @click="closeDialog">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h3>选择仿真进程</h3>
        <button class="close-btn" @click="closeDialog">×</button>
      </div>
      
      <div class="dialog-content">
        <div v-if="loading" class="loading">
          加载中...
        </div>
        
        <div v-else-if="error" class="error">
          {{ error }}
        </div>
        
        <div v-else-if="processes.length === 0" class="no-data">
          暂无仿真进程
        </div>
        
        <div v-else class="process-list">
          <div 
            v-for="process in processes" 
            :key="process.id"
            class="process-item"
            :class="{ selected: selectedProcessId === process.id }"
            @click="selectProcess(process)"
          >
            <div class="process-info">
              <div class="process-id">ID: {{ process.id }}</div>
              <div class="process-name">{{ process.name || '未命名进程' }}</div>
              <div class="process-details">
                <span class="process-owner">创建者: {{ process.owner_username || 'unknown' }}</span>
                <span class="process-type">类型: {{ process.simulator_type || 'unknown' }}</span>
              </div>
              <div class="process-time">
                <span class="created-time">创建时间: {{ formatTime(process.created_at) }}</span>
                <span class="updated-time">更新时间: {{ formatTime(process.updated_at) }}</span>
              </div>
              <div class="process-status" :class="getStatusClass(process.status)">
                状态: {{ process.status || 'unknown' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="btn-cancel" @click="closeDialog">取消</button>
        <button 
          class="btn-confirm" 
          :disabled="!selectedProcessId"
          @click="confirmSelection"
        >
          确认选择
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue';

const emit = defineEmits(['close', 'process-selected']);

// 注入用户凭据
const userCredentials = inject('userCredentials', ref({}));

// 数据状态
const loading = ref(false);
const error = ref('');
const processes = ref([]);
const selectedProcessId = ref(null);

// 获取CSRF Token
async function getCsrfToken() {
  try {
    const response = await fetch('http://localhost:8000/api/csrf/', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取CSRF Token失败');
    }
    
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('获取CSRF Token错误:', error);
    throw error;
  }
}

// 获取仿真进程列表
async function fetchProcesses() {
  try {
    loading.value = true;
    error.value = '';
    
    // 获取CSRF Token
    const csrfToken = await getCsrfToken();
    
    // 准备请求头
    const headers = {
      'Accept': 'application/json',
      'X-CSRFToken': csrfToken
    };
    
    // 如果有token，添加Authorization头
    if (userCredentials.value.token) {
      headers['Authorization'] = `Bearer ${userCredentials.value.token}`;
    }
    
    const response = await fetch('http://127.0.0.1:8000/api/simulations/simulators/', {
      method: 'GET',
      credentials: 'include',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('获取到的进程数据:', data);
    
    // 根据返回的数据结构处理
    if (data.results && Array.isArray(data.results)) {
      processes.value = data.results;
    } else if (Array.isArray(data)) {
      processes.value = data;
    } else {
      processes.value = [];
    }
    
  } catch (err) {
    console.error('获取进程列表失败:', err);
    error.value = err.message || '获取进程列表失败，请重试';
  } finally {
    loading.value = false;
  }
}

// 选择进程
function selectProcess(process) {
  selectedProcessId.value = process.id;
}

// 确认选择
function confirmSelection() {
  if (selectedProcessId.value) {
    const selectedProcess = processes.value.find(p => p.id === selectedProcessId.value);
    emit('process-selected', selectedProcess);
    closeDialog();
  }
}

// 关闭弹窗
function closeDialog() {
  emit('close');
}

// 格式化时间
function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return timeStr;
  }
}

// 获取状态样式类
function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'status-pending';
    case 'running':
      return 'status-running';
    case 'completed':
      return 'status-completed';
    case 'failed':
      return 'status-failed';
    default:
      return 'status-unknown';
  }
}

// 组件挂载时获取数据
onMounted(() => {
  fetchProcesses();
});
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
  z-index: 99999; /* 设置为最高层级 */
}

.dialog-container {
  background-color: #2a2a2a;
  color: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #444;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #555;
  color: #fff;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  min-height: 300px;
}

.loading, .error, .no-data {
  text-align: center;
  padding: 40px;
  font-size: 16px;
}

.error {
  color: #e74c3c;
}

.no-data {
  color: #888;
}

.process-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.process-item {
  background-color: #333;
  border: 2px solid #444;
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.process-item:hover {
  border-color: #4CAF50;
  background-color: #383838;
}

.process-item.selected {
  border-color: #4CAF50;
  background-color: rgba(76, 175, 80, 0.1);
}

.process-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.process-id {
  font-weight: bold;
  font-size: 16px;
  color: #4CAF50;
}

.process-name {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.process-details {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #ccc;
}

.process-time {
  display: flex;
  gap: 20px;
  font-size: 11px;
  color: #999;
}

.process-status {
  font-size: 12px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.status-pending {
  background-color: rgba(255, 193, 7, 0.2);
  color: #FFC107;
  border: 1px solid #FFC107;
}

.status-running {
  background-color: rgba(33, 150, 243, 0.2);
  color: #2196F3;
  border: 1px solid #2196F3;
}

.status-completed {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid #4CAF50;
}

.status-failed {
  background-color: rgba(244, 67, 54, 0.2);
  color: #F44336;
  border: 1px solid #F44336;
}

.status-unknown {
  background-color: rgba(158, 158, 158, 0.2);
  color: #9E9E9E;
  border: 1px solid #9E9E9E;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #444;
}

.btn-cancel, .btn-confirm {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background-color: #555;
  color: #fff;
}

.btn-cancel:hover {
  background-color: #666;
}

.btn-confirm {
  background-color: #4CAF50;
  color: #fff;
}

.btn-confirm:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-confirm:disabled {
  background-color: #888;
  cursor: not-allowed;
}
</style>
