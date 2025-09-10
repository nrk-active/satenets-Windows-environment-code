<template>
  <div class="topology-dialog-mask">
    <div class="topology-dialog">
      <div class="topology-dialog-header">
        <span>拓扑设置</span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <form class="topology-form" @submit.prevent="handleSave">
        <div class="form-grid">
          <div class="section-title">网络拓扑</div>
          <div class="form-item">
            <label>空间网络模式</label>
            <select v-model="form.space_network_topology.linking_pattern">
              <option value="full-mesh">全互连</option>
              <option value="ring">环形</option>
              <option value="star">星型</option>
            </select>
          </div>
          <div class="form-item">
            <label>骨干拓扑源</label>
            <input v-model="form.backbone_network_topology.topology_source" type="text" />
          </div>
          <div class="form-item">
            <label>骨干拓扑名</label>
            <input v-model="form.backbone_network_topology.topology_name" type="text" />
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">卫星能力</div>
          <div class="form-item">
            <label>最大星间链路数</label>
            <input v-model.number="form.satellite_capability.max_isl_per_sat" type="number" />
          </div>
          <div class="form-item">
            <label>最大星地链路数</label>
            <input v-model.number="form.satellite_capability.max_sgl_per_sat" type="number" />
          </div>
          <div class="form-item">
            <label>功率预算(W)</label>
            <input v-model.number="form.satellite_capability.power_budget" type="number" step="any"/>
          </div>
          <div class="form-item">
            <label>覆盖角(°)</label>
            <input v-model.number="form.satellite_capability.coverage_angle" type="number" step="any"/>
          </div>
          <div class="form-item">
            <label>指向精度(角秒)</label>
            <input v-model.number="form.satellite_capability.pointing_accuracy" type="number" step="any"/>
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">地面站能力</div>
          <div class="form-item">
            <label>最大星地链路数</label>
            <input v-model.number="form.station_capability.max_sgl_per_station" type="number" />
          </div>
          <div class="form-item">
            <label>最大地面链路数</label>
            <input v-model.number="form.station_capability.max_grl_per_station" type="number" />
          </div>
          <div class="form-item">
            <label>功率预算(W)</label>
            <input v-model.number="form.station_capability.power_budget" type="number" step="any"/>
          </div>
          <div class="form-item">
            <label>最小仰角(°)</label>
            <input v-model.number="form.station_capability.min_elevation" type="number" step="any"/>
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">星间链路</div>
          <div class="form-item">
            <label>是否启用</label>
            <input type="checkbox" v-model="form.isl_links_capability.isl_enabled" />
          </div>
          <div class="form-item">
            <label>带宽(Mbps)</label>
            <input v-model.number="form.isl_links_capability.isl_bandwidth" type="number" />
          </div>
          <div class="form-item">
            <label>故障率(%)</label>
            <input v-model.number="form.isl_links_capability.isl_failure_rate" type="number" step="any"/>
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">星地链路</div>
          <div class="form-item">
            <label>是否启用</label>
            <input type="checkbox" v-model="form.sgl_links_capability.sgl_enabled" />
          </div>
          <div class="form-item">
            <label>带宽(Mbps)</label>
            <input v-model.number="form.sgl_links_capability.sgl_bandwidth" type="number" />
          </div>
          <div class="form-item">
            <label>最小仰角(°)</label>
            <input v-model.number="form.sgl_links_capability.min_elevation" type="number" step="any"/>
          </div>
          <div class="form-item">
            <label>故障率(%)</label>
            <input v-model.number="form.sgl_links_capability.isl_failure_rate" type="number" step="any"/>
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">地面链路</div>
          <div class="form-item">
            <label>是否启用</label>
            <input type="checkbox" v-model="form.grl_links_capability.grl_enabled" />
          </div>
          <div class="form-item">
            <label>带宽(Mbps)</label>
            <input v-model.number="form.grl_links_capability.grl_bandwidth" type="number" />
          </div>
          <div class="form-item">
            <label>故障率(%)</label>
            <input v-model.number="form.grl_links_capability.grl_failure_rate" type="number" step="any"/>
          </div>
        </div>
        <div class="form-grid">
          <div class="section-title">骨干链路</div>
          <div class="form-item">
            <label>是否启用</label>
            <input type="checkbox" v-model="form.bkb_links_capability.bkb_enabled" />
          </div>
          <div class="form-item">
            <label>带宽(Mbps)</label>
            <input v-model.number="form.bkb_links_capability.bkb_bandwidth" type="number" />
          </div>
          <div class="form-item">
            <label>故障率(%)</label>
            <input v-model.number="form.bkb_links_capability.bkb_failure_rate" type="number" step="any"/>
          </div>
        </div>
        
        <div class="topology-dialog-footer">
          <button type="button" @click="$emit('close')">取消</button>
          <button type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const emit = defineEmits(['save', 'close'])
const saving = ref(false)

const form = ref({
  satellite_capability: {
    max_isl_per_sat: 4,
    max_sgl_per_sat: 2,
    power_budget: 2000,
    coverage_angle: 60,
    pointing_accuracy: 0.5
  },
  station_capability: {
    enabled: true,
    max_sgl_per_station: 4,
    max_grl_per_station: 2,
    power_budget: 500,
    min_elevation: 25
  },
  isl_links_capability: {
    isl_enabled: true,
    isl_bandwidth: 4000,
    isl_failure_rate: 1.0
  },
  sgl_links_capability: {
    sgl_enabled: true,
    sgl_bandwidth: 4000,
    min_elevation: 25,
    isl_failure_rate: 1.0
  },
  grl_links_capability: {
    grl_enabled: true,
    grl_bandwidth: 1000,
    grl_failure_rate: 0.5
  },
  bkb_links_capability: {
    bkb_enabled: true,
    bkb_bandwidth: 10000,
    bkb_failure_rate: 0.1
  },
  space_network_topology: {
    linking_pattern: 'full-mesh'
  },
  backbone_network_topology: {
    topology_source: 'topohub',
    topology_name: 'world'
  }
})

async function handleSave() {
  saving.value = true
  try {
    const res = await fetch('/XXX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (!res.ok) throw new Error('保存失败')
    emit('save', { ...form.value })
    emit('close')
  } catch (e) {
    alert('保存失败！')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.topology-dialog-mask {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  z-index: 99999; /* 设置为最高层级 */
  display: flex;
  align-items: center;
  justify-content: center;
}
.topology-dialog {
  background: #232323;
  color: #fff;
  border-radius: 8px;
  width: 70%;
  max-width: 80%;
  box-shadow: 0 4px 24px #0008;
  padding: 0 0 16px 0;
}
.topology-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px 20px;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 2px solid #ffb300;
}
.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.topology-form {
  padding: 18px 24px 0 24px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 24px;
  align-items: center;
  margin-bottom: 18px;
  background: none;
}
.section-title {
  grid-column: 1 / -1;
  font-size: 16px;
  font-weight: bold;
  margin: 8px 0 4px 0;
  color: #ffd700;
}
.form-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-item label {
  min-width: 90px;
  color: #eee;
}
.form-item input[type="number"],
.form-item input[type="text"],
.form-item select {
  width: 110px;
  background: #181818;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 14px;
}
.form-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
}
.topology-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 24px 0 0;
}
.topology-dialog-footer button {
  background: #27ae60;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 32px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.topology-dialog-footer button[type="button"] {
  background: #666;
}
.topology-dialog-footer button:disabled {
  background: #aaa;
  cursor: not-allowed;
}
.topology-dialog-footer button:hover:not(:disabled) {
  background: #219150;
}
</style>
