<!-- filepath: d:\front end development\Git\salasim-frontend\src\components\terminal_setting.vue -->
<template>
  <Teleport to="body">
    <div v-if="show" class="terminal-setting-modal">
      <div class="terminal-setting-box">
        <div class="terminal-setting-title">终端参数设置</div>
      <div class="terminal-setting-divider"></div>
      <div class="terminal-setting-form">
        <div class="terminal-setting-row">
          <label class="terminal-setting-label">终端数量</label>
          <input class="terminal-setting-input" type="number" v-model.number="numTerminals" min="0" />
        </div>
        <div class="terminal-setting-row">
          <label class="terminal-setting-label">分布模式</label>
          <select class="terminal-setting-input" v-model="distributionPattern">
            <option value="population_based">人口分布</option>
            <option value="normal_distribution">正态分布</option>
          </select>
        </div>
        <div class="terminal-setting-row">
          <label class="terminal-setting-label">仰角</label>
          <input class="terminal-setting-input" type="number" v-model.number="elevation" min="0" max="90" />
        </div>
        <div class="terminal-setting-row">
          <label class="terminal-setting-label">方位角</label>
          <input class="terminal-setting-input" type="number" v-model.number="azimuth" min="0" max="360" />
        </div>

        <!-- 人口分布参数 -->
        <div v-if="distributionPattern === 'population_based'" class="terminal-setting-subgroup">
          <div class="terminal-setting-subtitle">人口分布区域</div>
          <div v-for="(region, idx) in populationRegions" :key="idx" class="region-row">
            <input class="terminal-setting-input region-input" v-model="region.name" placeholder="区域名" />
            <input class="terminal-setting-input region-input" v-model.number="region.location[0]" type="number" step="0.0001" placeholder="纬度" />
            <input class="terminal-setting-input region-input" v-model.number="region.location[1]" type="number" step="0.0001" placeholder="经度" />
            <input class="terminal-setting-input region-input" v-model.number="region.percentage" type="number" min="0" max="100" placeholder="百分比" />
            <button @click="removeRegion(idx)" class="remove-btn">删除</button>
          </div>
          <button @click="addRegion" class="add-btn">添加区域</button>
        </div>

        <!-- 正态分布参数 -->
        <div v-if="distributionPattern === 'normal_distribution'" class="terminal-setting-subgroup">
          <div class="terminal-setting-subtitle">正态分布参数</div>
          <div class="terminal-setting-row">
            <label class="terminal-setting-label">均值纬度</label>
            <input class="terminal-setting-input" v-model.number="normalMean[0]" type="number" step="0.0001" placeholder="纬度" />
          </div>
          <div class="terminal-setting-row">
            <label class="terminal-setting-label">均值经度</label>
            <input class="terminal-setting-input" v-model.number="normalMean[1]" type="number" step="0.0001" placeholder="经度" />
          </div>
          <div class="terminal-setting-row">
            <label class="terminal-setting-label">标准差</label>
            <input class="terminal-setting-input" v-model.number="normalStddev" type="number" min="0" step="0.01" />
          </div>
        </div>
      </div>
      <div class="terminal-setting-actions">
        <button class="terminal-btn-cancel" @click="close">取消</button>
        <button class="terminal-btn-confirm" @click="submit">确定</button>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue'
// 新增：引入 js-yaml
import yaml from 'js-yaml'

const show = ref(false)
const numTerminals = ref(0)
const distributionPattern = ref('population_based')
const elevation = ref(45)
const azimuth = ref(180)

// 人口分布
const populationRegions = reactive([
  { name: 'North-America', location: [37.0902, -95.7129], percentage: 50 },
  { name: 'Europe', location: [54.526, 15.2551], percentage: 30 },
  { name: 'Asia', location: [34.0479, 100.6197], percentage: 20 }
])

function addRegion() {
  populationRegions.push({ name: '', location: [0, 0], percentage: 0 })
}
function removeRegion(idx) {
  populationRegions.splice(idx, 1)
}

// 正态分布
const normalMean = ref([37.7749, -122.4194])
const normalStddev = ref(5)

function open() {
  show.value = true
}
function close() {
  show.value = false
}
async function submit() {
  // 构造参数对象
  let params = {
    num_terminals: numTerminals.value,
    distribution_pattern: distributionPattern.value,
    elevation: elevation.value,
    azimuth: azimuth.value,
    population_based: {
      regions: populationRegions.map(r => ({
        name: r.name,
        location: r.location,
        percentage: r.percentage
      }))
    },
    normal_distribution: {
      mean_location: normalMean.value,
      stddev: normalStddev.value
    }
  }
  // 发送yaml格式
  try {
    const yamlStr = yaml.dump(params)
    const res = await fetch('/api/terminal/setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-yaml' },
      body: yamlStr
    })
    if (res.ok) {
      alert('终端参数设置已保存')
      close()
    } else {
      alert('保存失败')
    }
  } catch (e) {
    alert('网络错误，保存失败')
  }
}
defineExpose({ open })
</script>

<style scoped>
.terminal-setting-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}
.terminal-setting-box {
  background: #232323;
  padding: 28px 32px 18px 32px;
  border-radius: 6px;
  min-width: 420px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.terminal-setting-title {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 6px;
  letter-spacing: 1px;
}
.terminal-setting-divider {
  height: 3px;
  background: linear-gradient(90deg, #ffb300 60%, #ffd700 100%);
  margin-bottom: 18px;
  border-radius: 2px;
}
.terminal-setting-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 18px;
}
.terminal-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 0;
}
.terminal-setting-label {
  color: #fff;
  font-size: 15px;
  width: 110px;
  text-align: left;
  font-weight: 500;
  letter-spacing: 1px;
}
.terminal-setting-input {
  flex: 1;
  background: #181818;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  height: 32px;
  font-size: 15px;
  padding: 0 10px;
  outline: none;
  transition: border 0.2s;
}
.terminal-setting-input:focus {
  border: 1.5px solid #ffd700;
}
.terminal-setting-subgroup {
  background: #232323;
  border-radius: 4px;
  padding: 8px 0 0 0;
  margin-bottom: 0;
}
.terminal-setting-subtitle {
  color: #ffd700;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 6px;
  margin-top: 2px;
}
.region-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.region-input {
  width: 90px;
  min-width: 70px;
}
.add-btn, .remove-btn {
  padding: 2px 10px;
  border: none;
  border-radius: 4px;
  background: #27ae60;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.remove-btn {
  background: #e74c3c;
}
.terminal-setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
}
.terminal-btn-cancel {
  background: #444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.terminal-btn-cancel:hover {
  background: #666;
}
.terminal-btn-confirm {
  background: #ffb300;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.terminal-btn-confirm:hover {
  background: #ffd700;
  color: #232323;
}
</style>