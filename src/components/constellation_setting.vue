<template>
  <Teleport to="body">
    <div v-if="show" class="constellation-setting-modal">
      <div class="constellation-setting-box">
        <div class="constellation-setting-title">星座设置</div>
      <div class="constellation-setting-divider"></div>
      <div class="constellation-setting-form">
        <div class="constellation-setting-row">
          <label class="constellation-setting-label">轨道平面数量</label>
          <input class="constellation-setting-input" type="number" v-model.number="numPlanes" min="1" />
        </div>
        <div class="constellation-setting-row">
          <label class="constellation-setting-label">每平面卫星数</label>
          <input class="constellation-setting-input" type="number" v-model.number="satsPerPlane" min="1" />
        </div>
        <div class="constellation-setting-row">
          <label class="constellation-setting-label">轨道高度 (km)</label>
          <input class="constellation-setting-input" type="number" v-model.number="altitude" min="1" />
        </div>
        <div class="constellation-setting-row">
          <label class="constellation-setting-label">轨道倾斜角 (°)</label>
          <input class="constellation-setting-input" type="number" v-model.number="inclination" min="0" max="180" step="0.1" />
        </div>
        <div class="constellation-setting-row">
          <label class="constellation-setting-label">轨道间距 (°)</label>
          <input class="constellation-setting-input" type="number" v-model.number="orbitalSpacing" min="0" max="360" step="0.1" />
        </div>
      </div>
      <div class="constellation-setting-actions">
        <button class="constellation-btn-cancel" @click="close">取消</button>
        <button class="constellation-btn-confirm" @click="submit">确定</button>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import yaml from 'js-yaml'

const show = ref(false)
const numPlanes = ref(30)
const satsPerPlane = ref(30)
const altitude = ref(508)
const inclination = ref(53)
const orbitalSpacing = ref(12.0)

function open() {
  show.value = true
}

function close() {
  show.value = false
}

async function submit() {
  try {
    // 构造星座配置对象
    const data = {
      constellation: {
        num_planes: numPlanes.value,
        sats_per_plane: satsPerPlane.value,
        altitude: altitude.value,
        inclination: inclination.value,
        orbital_spacing: orbitalSpacing.value
      }
    }
    
    // 转为yaml字符串
    const yamlStr = yaml.dump(data)
    
    const res = await fetch('/api/constellation/setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-yaml' },
      body: yamlStr
    })
    
    if (res.ok) {
      alert('星座设置已保存')
      close()
    } else {
      alert('星座设置保存失败')
    }
  } catch (e) {
    alert('网络错误，星座设置保存失败')
    console.error('星座设置保存错误:', e)
  }
}

defineExpose({ open })
</script>

<style scoped>
.constellation-setting-modal {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}

.constellation-setting-box {
  background: #232323;
  padding: 28px 32px 18px 32px;
  border-radius: 6px;
  min-width: 380px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.constellation-setting-title {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.constellation-setting-divider {
  height: 3px;
  background: linear-gradient(90deg, #ffb300 60%, #ffd700 100%);
  margin-bottom: 18px;
  border-radius: 2px;
}

.constellation-setting-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 18px;
}

.constellation-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.constellation-setting-label {
  color: #fff;
  font-size: 15px;
  width: 130px;
  text-align: left;
  font-weight: 500;
  letter-spacing: 1px;
}

.constellation-setting-input {
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

.constellation-setting-input:focus {
  border: 1.5px solid #ffd700;
}

.constellation-setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
}

.constellation-btn-cancel {
  background: #444;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.constellation-btn-cancel:hover {
  background: #666;
}

.constellation-btn-confirm {
  background: #ffb300;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 28px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.constellation-btn-confirm:hover {
  background: #ffd700;
  color: #232323;
}
</style> 