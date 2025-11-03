<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog-content">
        <div class="dialog-header">
        <h3>业务设计</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <!-- 总业务带宽与保护类型比例 -->
        <div class="rate-section">
          <div class="input-group">
            <label>最小业务带宽</label>
            <input type="number" v-model="total_service.min_bw" placeholder="请输入最小带宽">
          </div>
          <div class="input-group">
            <label>最大业务带宽</label>
            <input type="number" v-model="total_service.max_bw" placeholder="请输入最大带宽">
          </div>
        </div>
        <div class="protection-section">
          <div class="input-group">
            <label>无保护比例(no)</label>
            <input type="number" v-model="total_service.protection_requirement.no" @input="onProtectionInput('no')" min="0" max="1" step="0.01" placeholder="0~1">
          </div>
          <div class="input-group">
            <label>1+1保护比例</label>
            <input type="number" v-model="total_service.protection_requirement['1+1']" @input="onProtectionInput('1+1')" min="0" max="1" step="0.01" placeholder="0~1">
          </div>
          <div class="input-group">
            <label>1:1保护比例</label>
            <input type="number" v-model="total_service.protection_requirement['1:1']" @input="onProtectionInput('1:1')" min="0" max="1" step="0.01" placeholder="0~1">
          </div>
          <div class="input-group">
            <label>1+n保护比例</label>
            <input type="number" :value="protection1nValue" readonly placeholder="自动计算">
          </div>
        </div>
        <div class="rate-section">
          <div class="input-group">
            <label>动态业务到达率</label>
            <input type="number" v-model="dynamic_services.arrival_rate" placeholder="请输入到达率">
          </div>
          <div class="input-group">
            <label>动态业务服务率</label>
            <input type="number" v-model="dynamic_services.service_rate" placeholder="请输入服务率">
          </div>
          <div class="input-group">
            <label>静态业务服务数</label>
            <input type="number" v-model="static_services.service_number" placeholder="请输入静态业务服务数">
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn cancel-btn" @click="$emit('close')">取消</button>
        <button class="btn confirm-btn" @click="confirmSettings" :disabled="isSubmitting">{{ isSubmitting ? '提交中...' : '确定' }}</button>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, watch, ref, onMounted, isRuntimeOnly, computed } from 'vue';

// CSRF令牌相关
let csrfToken = null;

// 1. 获取CSRF令牌
async function sendData(businessDesignData) {
  const csrfToken = await fetch('/api/csrf_token', {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    // console.log("Token:", data);
    return data.csrfToken;
  });

  const id = await fetch('/api/simulators/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    credentials: 'include', 
    body: JSON.stringify({ "simulation_name": "Test Simulator" }),
  })
  .then(res => res.json())
  .then(data => {
    // console.log("ID:", data.id);
    return data.id;
  });

  try {
    const instanizeResponse = await fetch(`/api/simulators/${id}/instanize/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
    });
    
    const instanizeData = await instanizeResponse.json();
    // console.log("Instanize Response:", instanizeData);
  } catch (instanizeError) {
    console.warn("Instanize已经完成，继续执行:", instanizeError);
  }
  

  const response = await fetch(`/api/simulators/${id}/service-settings/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify(businessDesignData)
  });

  if (!response.ok) {
    const text = await response.text(); // 返回 HTML 错误内容
    console.error('请求失败:', response.status, text);
    throw new Error(`请求失败 ${response.status}: ${text}`);
  }

  const result = await response.json();
  // console.log(result);
  return result;
}



// 组件挂载时获取CSRF令牌
onMounted(async () => {
  await fetch('/api/csrf_token', {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });
});

// 到达率和离去率数据
const trafficRates = reactive({
  arrivalRate: 20,
  departureRate: 25
});

const total_service = reactive({
  min_bw: 20,
  max_bw: 400,
  protection_requirement: {
    no: 0.4,
    '1+1': 0.3,
    '1:1': 0.2,
    '1+n': 0 // 1+n由计算得出
  }
});
const dynamic_services = reactive({
  arrival_rate: 0,
  service_rate: 0.01
});
const static_services = reactive({
  service_number: 100
});

// 计算1+n保护比例
const protection1nValue = computed(() => {
  const v = 1 - (Number(total_service.protection_requirement.no) || 0)
    - (Number(total_service.protection_requirement['1+1']) || 0)
    - (Number(total_service.protection_requirement['1:1']) || 0);
  return v > 0 ? +v.toFixed(4) : 0;
});

// 保护类型比例输入联动校正
function onProtectionInput(type) {
  // 保证输入为数字且在0~1区间
  let v = Number(total_service.protection_requirement[type]) || 0;
  if (v < 0) v = 0;
  if (v > 1) v = 1;
  total_service.protection_requirement[type] = v;
  // 限制前三项之和不超过1
  const keys = ['no', '1+1', '1:1'];
  let sum = keys.reduce((s, k) => s + (Number(total_service.protection_requirement[k]) || 0), 0);
  if (sum > 1) {
    // 超出时自动回退本次输入
    total_service.protection_requirement[type] = +(1 - keys.filter(k => k !== type).reduce((s, k) => s + (Number(total_service.protection_requirement[k]) || 0), 0)).toFixed(4);
  }
  // 1+n自动计算
  total_service.protection_requirement['1+n'] = protection1nValue.value;
}

const isSubmitting = ref(false);

const confirmSettings = async () => {
  // 校验
  if (!total_service.min_bw || !total_service.max_bw) {
    alert('请填写完整的带宽参数');
    return;
  }
  const keys = ['no', '1+1', '1:1', '1+n'];
  let sum = keys.reduce((s, k) => s + (Number(total_service.protection_requirement[k]) || 0), 0);
  if (sum > 1.0001) {
    alert('四项保护类型比例之和不能超过1');
    return;
  }
  if (!dynamic_services.arrival_rate || !dynamic_services.service_rate || !static_services.service_number) {
    alert('请填写完整的动态/静态业务参数');
    return;
  }
  // 构造JSON
  const businessDesignData = {
    total_service: {
      min_bw: parseFloat(total_service.min_bw),
      max_bw: parseFloat(total_service.max_bw),
      protection_requirement: {
        no: parseFloat(total_service.protection_requirement.no),
        '1+1': parseFloat(total_service.protection_requirement['1+1']),
        '1:1': parseFloat(total_service.protection_requirement['1:1']),
        '1+n': parseFloat(total_service.protection_requirement['1+n'])
      }
    },
    dynamic_services: {
      arrival_rate: parseFloat(dynamic_services.arrival_rate),
      service_rate: parseFloat(dynamic_services.service_rate)
    },
    static_services: {
      service_number: parseFloat(static_services.service_number)
    }
  };
  try {
    isSubmitting.value = true;
    const result = await sendData(businessDesignData);
    if (result && result.message === "Service settings updated") {
      alert('业务设置成功！\n请点击右上角绿色按钮以开始仿真');
      emit('close');
      emit('settings-confirmed', {
        success: true,
        data: businessDesignData,
        response: result
      });
    } else {
      throw new Error('业务设置未成功完成');
    }
  } catch (error) {
    alert('提交业务设计数据失败，请重试');
    console.error('提交失败:', error);
    emit('settings-confirmed', {
      success: false,
      error: error.message,
      data: businessDesignData
    });
  } finally {
    isSubmitting.value = false;
  }
};

const emit = defineEmits(['close', 'settings-confirmed']);
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100000;
}

.dialog-content {
  width: 600px;
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

.close-btn:hover {
  color: white;
}

.dialog-body {
  padding: 20px;
}

.business-columns {
  display: flex;
  gap: 30px;
}

.column {
  flex: 1;
}

.column h4 {
  color: white;
  margin: 0 0 15px 0;
  text-align: center;
  font-size: 16px;
  border-bottom: 1px solid #555;
  padding-bottom: 8px;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  color: white;
  margin-bottom: 5px;
  font-size: 14px;
}

.input-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #555;
  border-radius: 3px;
  background-color: #444;
  color: white;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #f39c12;
}

.input-group input[readonly] {
  background-color: #333;
  cursor: not-allowed;
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

.confirm-btn:disabled {
  background-color: #666;
  cursor: not-allowed;
}

.cancel-btn:hover {
  background-color: #666;
}

.confirm-btn:hover:not(:disabled) {
  background-color: #e67e22;
}

/* 添加到达率和离去率区域的样式 */
.rate-section {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #444;
}

.rate-section .input-group {
  flex: 1;
}

/* 新增保护类型比例区域样式 */
.protection-section {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #444;
}

.protection-section .input-group {
  flex: 1;
}
</style>
