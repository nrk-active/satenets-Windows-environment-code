<template>
  <div class="dialog-overlay" @click="closeDialog">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h3>选择数据文件夹</h3>
        <button class="close-btn" @click="closeDialog">×</button>
      </div>
      
      <div class="dialog-content">
        <div v-if="loading" class="loading">
          正在扫描文件夹...
        </div>
        
        <div v-else-if="error" class="error">
          {{ error }}
        </div>
        
        <div v-else-if="folders.length === 0" class="no-data">
          在data目录中未找到可用的文件夹
        </div>
        
        <div v-else class="folder-list">
          <div 
            v-for="folder in folders" 
            :key="folder.name"
            class="folder-item"
            :class="{ selected: selectedFolder === folder.name }"
            @click="selectFolder(folder)"
          >
            <div class="folder-info">
              <div class="folder-icon">📁</div>
              <div class="folder-details">
                <div class="folder-name">{{ folder.name }}</div>
                <div class="folder-stats">
                  <span class="file-count">网络文件: {{ folder.networkFiles }}个</span>
                  <span class="service-count">业务文件: {{ folder.serviceFiles }}个</span>
                </div>
                <div class="folder-description">{{ folder.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="btn-cancel" @click="closeDialog">取消</button>
        <button 
          class="btn-confirm" 
          :disabled="!selectedFolder"
          @click="confirmSelection"
        >
          确认选择
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['close', 'folder-selected']);

// 数据状态
const loading = ref(false);
const error = ref('');
const folders = ref([]);
const selectedFolder = ref(null);

// 扫描data目录中的文件夹
async function scanDataFolders() {
  try {
    loading.value = true;
    error.value = '';
    
    // 预定义的可能文件夹列表 - 包含所有已知的文件夹
    const possibleFolders = [
      'new', 'old', 'test', 'backup', 
      'simulation1', 'simulation2', 
      'Test1', 'Test2',  // 添加你的新文件夹
    ];
    const validFolders = [];
    
    for (const folderName of possibleFolders) {
      try {
        // 尝试加载一个测试文件来验证文件夹是否存在且包含数据
        const testResponse = await fetch(`./data/${folderName}/network_state_60.00.json`);
        
        if (testResponse.ok) {
          // 如果能成功加载文件，说明文件夹存在且有效
          const folderInfo = await analyzeFolderContents(folderName);
          validFolders.push(folderInfo);
        }
      } catch (error) {
        // 忽略无法访问的文件夹
        console.log(`文件夹 ${folderName} 不存在或无法访问`);
      }
    }
    
    // 如果没有找到预定义的文件夹，添加默认描述
    if (validFolders.length === 0) {
      // 至少添加一些常见的文件夹选项
      validFolders.push({
        name: 'new',
        description: '新数据集 - 包含最新的仿真数据',
        networkFiles: '未知',
        serviceFiles: '未知'
      });
      validFolders.push({
        name: 'old',
        description: '旧数据集 - 包含历史仿真数据',
        networkFiles: '未知',
        serviceFiles: '未知'
      });
    }
    
    folders.value = validFolders;
    
  } catch (err) {
    console.error('扫描文件夹失败:', err);
    error.value = '扫描文件夹失败，请检查data目录是否存在';
  } finally {
    loading.value = false;
  }
}

// 分析文件夹内容
async function analyzeFolderContents(folderName) {
  // 尝试检测文件夹中的文件数量
  let networkFiles = 0;
  let serviceFiles = 0;
  
  // 根据实际数据结构，检测更多的时间戳文件
  // 从10秒开始，每10秒一个文件，检测到1500秒（约150个文件）
  const maxChecks = 50; // 限制检查次数，避免太多请求
  const timestamps = [];
  
  // 生成时间戳列表：10, 20, 30, ..., 500
  for (let i = 1; i <= maxChecks; i++) {
    timestamps.push(i * 10);
  }
  
  // 并发检测前50个文件，提高检测效率
  const checkPromises = timestamps.map(async (timestamp) => {
    try {
      const [networkResponse, serviceResponse] = await Promise.all([
        fetch(`./data/${folderName}/network_state_${timestamp}.00.json`),
        fetch(`./data/${folderName}/service_state_${timestamp}.00.json`)
      ]);
      
      return {
        networkExists: networkResponse.ok,
        serviceExists: serviceResponse.ok
      };
    } catch (error) {
      return {
        networkExists: false,
        serviceExists: false
      };
    }
  });
  
  // 等待所有检测完成
  const results = await Promise.all(checkPromises);
  
  // 统计存在的文件数量
  results.forEach(result => {
    if (result.networkExists) networkFiles++;
    if (result.serviceExists) serviceFiles++;
  });
  
  // 如果检测到了maxChecks个文件，说明可能还有更多
  const networkSuffix = networkFiles === maxChecks ? `${networkFiles}+` : networkFiles.toString();
  const serviceSuffix = serviceFiles === maxChecks ? `${serviceFiles}+` : serviceFiles.toString();
  
  return {
    name: folderName,
    description: getFolderDescription(folderName),
    networkFiles: networkFiles > 0 ? networkSuffix : '未知',
    serviceFiles: serviceFiles > 0 ? serviceSuffix : '未知'
  };
}

// 获取文件夹描述
function getFolderDescription(folderName) {
  const descriptions = {
    'new': '新数据集 - 包含最新的仿真数据文件',
    'old': '旧数据集 - 包含历史仿真数据文件',
    'test': '测试数据集 - 用于测试的仿真数据',
    'backup': '备份数据集 - 备份的仿真数据',
    'simulation1': '仿真场景1 - 特定场景的仿真数据',
    'simulation2': '仿真场景2 - 另一个特定场景的仿真数据'
  };
  
  return descriptions[folderName] || `${folderName} - 仿真数据文件夹`;
}

// 选择文件夹
function selectFolder(folder) {
  selectedFolder.value = folder.name;
}

// 确认选择
function confirmSelection() {
  if (selectedFolder.value) {
    const selectedFolderInfo = folders.value.find(f => f.name === selectedFolder.value);
    emit('folder-selected', selectedFolderInfo);
    closeDialog();
  }
}

// 关闭弹窗
function closeDialog() {
  emit('close');
}

// 组件挂载时扫描文件夹
onMounted(() => {
  scanDataFolders();
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
  z-index: 9999;
}

.dialog-container {
  background-color: #2a2a2a;
  color: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
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

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.folder-item {
  background-color: #333;
  border: 2px solid #444;
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  border-color: #4CAF50;
  background-color: #383838;
}

.folder-item.selected {
  border-color: #4CAF50;
  background-color: rgba(76, 175, 80, 0.1);
}

.folder-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.folder-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.folder-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.folder-name {
  font-weight: bold;
  font-size: 16px;
  color: #4CAF50;
}

.folder-stats {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #ccc;
}

.file-count, .service-count {
  background-color: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.folder-description {
  font-size: 13px;
  color: #aaa;
  line-height: 1.4;
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
