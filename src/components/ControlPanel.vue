<!-- src/components/ControlPanel.vue -->
<template>
  <div class="control-panel">
    <div class="toggle-group">
      <div class="toggle-item">
        <input 
          type="checkbox" 
          id="show-satellite" 
          :checked="showSatellite" 
          @change="$emit('update:showSatellite', $event.target.checked)"
        >
        <label for="show-satellite">卫星</label>
      </div>
      <div class="toggle-item">
        <input 
          type="checkbox" 
          id="show-station" 
          :checked="showStation" 
          @change="$emit('update:showStation', $event.target.checked)"
        >
        <label for="show-station">地面站</label>
      </div>
      <div class="toggle-item">
        <input 
          type="checkbox" 
          id="show-roadm" 
          :checked="showRoadm" 
          @change="$emit('update:showRoadm', $event.target.checked)"
        >
        <label for="show-roadm">ROADM</label>
      </div>
    </div>
    
    <div class="timeline-control">
      <button @click="$emit('togglePlayback')">{{ isPlaying ? '暂停' : '播放' }}</button>
      <div class="time-display">时间: {{ timeFrame }}分钟</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  showSatellite: Boolean,
  showStation: Boolean,
  showRoadm: Boolean,
  isPlaying: Boolean,
  timeFrame: Number
});

defineEmits([
  'update:showSatellite', 
  'update:showStation', 
  'update:showRoadm', 
  'togglePlayback'
]);
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(40, 40, 40, 0.7);
  padding: 10px;
  border-radius: 5px;
  color: white;
  z-index: 1000;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.toggle-item input {
  cursor: pointer;
}

.toggle-item label {
  cursor: pointer;
  user-select: none;
}

.timeline-control {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-control button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 5px;
  border-radius: 3px;
  cursor: pointer;
}

.timeline-control button:hover {
  background-color: #45a049;
}

.time-display {
  text-align: center;
  font-weight: bold;
}
</style>