<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>仿真结果数据选择</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.averageLatency">
            <span>平均延迟</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.bandwidthUtil">
            <span>带宽利用率</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.hopCounts">
            <span>平均跳数</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.linkLength">
            <span>链路长度</span>
          </label>
          <!-- <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.spicesCounts">
            <span>经过的切片数</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.intraplaneCounts">
            <span>轨道内链路平均占用数量</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="selectedData.interplaneCounts">
            <span>轨道间链路平均占用数量</span>
          </label> -->
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn cancel-btn" @click="$emit('close')">取消</button>
        <button class="btn confirm-btn" @click="confirmSelection">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';

const selectedData = reactive({
  averageLatency: true,
  bandwidthUtil: true,
  hopCounts: true,
  linkLength: true,
  spicesCounts: true,
  intraplaneCounts: true,
  interplaneCounts: true
});

const confirmSelection = () => {
  emit('close');
  emit('data-selected', selectedData);
};

const emit = defineEmits(['close', 'data-selected']);
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

.dialog-content {
  width: 400px;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
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

.dialog-body {
  padding: 20px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  color: white;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  margin-right: 10px;
  cursor: pointer;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 15px;
  background-color: #333;
  gap: 10px;
}

.btn {
  padding: 6px 15px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
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