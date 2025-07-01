<template>
  <div class="object-viewer">
    <div class="header">
      <span>Object Viewer</span>
      <span class="close-btn" @click="$emit('close')">✖</span>
    </div>
    <div class="content">
      <ul>
        <li>卫星组</li>
        <li>地面站</li>
        <li>链路</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// 可根据需要添加props和事件
</script>

<style scoped>
.object-viewer {
  width: 280px;
  height: 100%;
  background: #232323;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  color: #f1f1f1;
}
.header {
  font-weight: bold;
  padding: 10px 16px;
  background: #181818;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
  color: #fff;
  letter-spacing: 1px;
}
.close-btn {
  cursor: pointer;
  font-size: 14px;
  color: #aaa;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #f39c12;
}
.content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}
ul {
  list-style: disc inside;
  padding: 0;
  margin: 0;
}
li {
  margin: 12px 0;
  font-size: 15px;
  color: #e0e0e0;
  letter-spacing: 1px;
}
</style>