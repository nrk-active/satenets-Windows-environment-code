<template>
  <div class="serverdata-table-wrapper">
    <table class="serverdata-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>路径</th>
          <th>阻塞</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.path }}</td>
          <td>{{ item.blocked ? '是' : '否' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 示例业务数据
const data = ref([
  { id: 1, path: 'A-B-C', blocked: false },
  { id: 2, path: 'B-D-E', blocked: true },
  { id: 3, path: 'C-E-F', blocked: false }
])
</script>

<style scoped>
.serverdata-table-wrapper {
  width: 100%;
  background: #232323;
  padding: 0 0 0 0;
  display: flex;
  justify-content: center;
}
.serverdata-table {
  border-collapse: collapse;
  width: 100%;
  background: #232323;
  color: #fff;
  font-size: 15px;
}
.serverdata-table th, .serverdata-table td {
  border: 1px solid #444;
  padding: 8px 16px;
  text-align: center;
}
.serverdata-table th {
  background: #181818;
  color: #ffd700;
  font-weight: bold;
}
</style>