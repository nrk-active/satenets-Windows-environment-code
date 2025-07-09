<!-- filepath: d:\front end development\Git\salasim-frontend\src\components\simulation_setting.vue -->
<template>
  <div v-if="show" class="sim-setting-modal">
    <div class="sim-setting-box">
      <div class="sim-setting-title">仿真设置</div>
      <div class="sim-setting-divider"></div>
      <div class="sim-setting-form">
        <div class="sim-setting-row">
          <label class="sim-setting-label">轨道步长</label>
          <input class="sim-setting-input" type="number" v-model.number="orbitingStep" min="1" />
        </div>
        <div class="sim-setting-row">
          <label class="sim-setting-label">仿真时长</label>
          <input class="sim-setting-input" type="number" v-model.number="simulationSec" min="1" />
        </div>
        <div class="sim-setting-row">
          <label class="sim-setting-label">采样间隔</label>
          <input class="sim-setting-input" type="number" v-model.number="samplingInterval" min="1" />
        </div>
        <div class="sim-setting-row">
          <label class="sim-setting-label">结果步长</label>
          <input class="sim-setting-input" type="number" v-model.number="dumpReqResultsTimesteps" min="1" />
        </div>
      </div>
      <div class="sim-setting-actions">
        <button class="sim-btn-cancel" @click="close">取消</button>
        <button class="sim-btn-confirm" @click="submit">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
// 新增：引入 js-yaml
import yaml from 'js-yaml'

const show = ref(false)
const orbitingStep = ref(10)
const simulationSec = ref(1000)
const samplingInterval = ref(5)
// 新增：结果步长参数
const dumpReqResultsTimesteps = ref(60)

function open() {
  show.value = true
}
function close() {
  show.value = false
}
async function submit() {
  try {
    // 构造对象
    const data = {
      orbiting_step_sec: orbitingStep.value,
      simulation_sec: simulationSec.value,
      sampling_interval_orbit: samplingInterval.value,
      dump_req_results_timesteps: dumpReqResultsTimesteps.value
    }
    // 转为yaml字符串
    const yamlStr = yaml.dump(data)
    const res = await fetch('/api/simulation/setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-yaml' },
      body: yamlStr
    })
    if (res.ok) {
      alert('设置已保存')
      close()
    } else {
      alert('设置保存失败')
    }
  } catch (e) {
    alert('网络错误，设置保存失败')
  }
}
defineExpose({ open })
</script>

<style scoped>
.sim-setting-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.sim-setting-box {
  background: #232323;
  padding: 28px 32px 18px 32px;
  border-radius: 6px;
  min-width: 340px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.sim-setting-title {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 6px;
  letter-spacing: 1px;
}
.sim-setting-divider {
  height: 3px;
  background: linear-gradient(90deg, #ffb300 60%, #ffd700 100%);
  margin-bottom: 18px;
  border-radius: 2px;
}
.sim-setting-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 18px;
}
.sim-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.sim-setting-label {
  color: #fff;
  font-size: 15px;
  width: 110px;
  text-align: left;
  font-weight: 500;
  letter-spacing: 1px;
}
.sim-setting-input {
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
.sim-setting-input:focus {
  border: 1.5px solid #ffd700;
}
.sim-setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
}
.sim-btn-cancel {
  background: #444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.sim-btn-cancel:hover {
  background: #666;
}
.sim-btn-confirm {
  background: #ffb300;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.sim-btn-confirm:hover {
  background: #ffd700;
  color: #232323;
}
</style>