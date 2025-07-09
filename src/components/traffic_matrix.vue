<template>
  <div v-if="show" class="traffic-matrix-modal">
    <div class="traffic-matrix-box">
      <div class="traffic-matrix-title">流量矩阵设置</div>
      <div class="traffic-matrix-divider"></div>
      <div class="traffic-matrix-table">
        <table>
          <thead>
            <tr>
              <th>区域</th>
              <th v-for="col in continents" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in continents" :key="row">
              <td>{{ row }}</td>
              <td v-for="col in continents" :key="col">
                <input
                  type="number"
                  min="0"
                  class="matrix-input"
                  v-model.number="matrix[row][col]"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="traffic-matrix-actions">
        <button class="matrix-btn-cancel" @click="close">取消</button>
        <button class="matrix-btn-confirm" @click="submit">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
// 新增：引入 js-yaml
import yaml from 'js-yaml'

const show = ref(false)
const continents = [
  'Asia',
  'Europe',
  'North America',
  'Africa',
  'Oceania',
  'South America',
  'Southeast Asia',
  'Middle East'
]

const defaultMatrix = {
  Asia: {
    Europe: 288,
    'North America': 70,
    Asia: 0,
    Africa: 124,
    Oceania: 225,
    'South America': 70,
    'Southeast Asia': 225,
    'Middle East': 225
  },
  Europe: {
    Asia: 0,
    'North America': 0,
    Europe: 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  'North America': {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  Africa: {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  Oceania: {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  'South America': {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  'Southeast Asia': {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  },
  'Middle East': {
    Asia: 0,
    Europe: 0,
    'North America': 0,
    Africa: 0,
    Oceania: 0,
    'South America': 0,
    'Southeast Asia': 0,
    'Middle East': 0
  }
}

const matrix = ref(JSON.parse(JSON.stringify(defaultMatrix)))

function open() {
  show.value = true
}
function close() {
  show.value = false
}
async function submit() {
  // 构造参数对象
  const params = {
    traffic_matrix_continents: matrix.value
  }
  try {
    const yamlStr = yaml.dump(params)
    const res = await fetch('/api/traffic_matrix/setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-yaml' },
      body: yamlStr
    })
    if (res.ok) {
      alert('流量矩阵已保存')
      close()
    } else {
      alert('流量矩阵保存失败')
    }
  } catch (e) {
    alert('网络错误，流量矩阵保存失败')
  }
}

defineExpose({ open })
</script>

<style scoped>
.traffic-matrix-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.traffic-matrix-box {
  background: #232323;
  padding: 28px 32px 18px 32px;
  border-radius: 6px;
  min-width: 540px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.traffic-matrix-title {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 6px;
  letter-spacing: 1px;
}
.traffic-matrix-divider {
  height: 3px;
  background: linear-gradient(90deg, #ffb300 60%, #ffd700 100%);
  margin-bottom: 18px;
  border-radius: 2px;
}
.traffic-matrix-table {
  overflow-x: auto;
  margin-bottom: 18px;
}
table {
  border-collapse: collapse;
  width: 100%;
  background: #232323;
}
th, td {
  border: 1px solid #444;
  padding: 6px 8px;
  text-align: center;
  color: #fff;
  min-width: 60px;
}
.matrix-input {
  width: 60px;
  background: #181818;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  height: 28px;
  font-size: 15px;
  padding: 0 6px;
  outline: none;
  transition: border 0.2s;
}
.matrix-input:focus {
  border: 1.5px solid #ffd700;
}
.traffic-matrix-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
}
.matrix-btn-cancel {
  background: #444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.matrix-btn-cancel:hover {
  background: #666;
}
.matrix-btn-confirm {
  background: #ffb300;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.matrix-btn-confirm:hover {
  background: #ffd700;
  color: #232323;
}
</style>