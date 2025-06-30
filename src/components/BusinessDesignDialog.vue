<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>业务设计</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <!-- 到达率和离去率栏 -->
        <div class="rate-section">
          <div class="input-group">
            <label>到达率</label>
            <input type="number" v-model="trafficRates.arrivalRate" placeholder="请输入到达率">
          </div>
          <div class="input-group">
            <label>服务率</label>
            <input type="number" v-model="trafficRates.departureRate" placeholder="请输入服务率">
          </div>
        </div>
        
        <div class="business-columns">
          <!-- 星-地 栏 -->
          <div class="column">
            <h4>星-地</h4>
            <div class="input-group">
              <label>最大业务带宽</label>
              <input type="number" v-model="satelliteToGround.maxBandwidth" placeholder="请输入最大带宽">
            </div>
            <div class="input-group">
              <label>最小业务带宽</label>
              <input type="number" v-model="satelliteToGround.minBandwidth" placeholder="请输入最小带宽">
            </div>
            <div class="input-group">
              <label>比例 (0-1)</label>
              <input type="number" v-model="satelliteToGround.ratio" @input="updateSatelliteRatio" min="0" max="1" step="0.01" placeholder="请输入比例">
            </div>
          </div>
          
          <!-- 星-星 栏 -->
          <div class="column">
            <h4>星-星</h4>
            <div class="input-group">
              <label>最大业务带宽</label>
              <input type="number" v-model="satelliteToSatellite.maxBandwidth" placeholder="请输入最大带宽">
            </div>
            <div class="input-group">
              <label>最小业务带宽</label>
              <input type="number" v-model="satelliteToSatellite.minBandwidth" placeholder="请输入最小带宽">
            </div>
            <div class="input-group">
              <label>比例</label>
              <input type="number" v-model="satelliteToSatellite.ratio" readonly placeholder="自动计算">
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn cancel-btn" @click="$emit('close')">取消</button>
        <button class="btn confirm-btn" @click="confirmSettings" :disabled="isSubmitting">{{ isSubmitting ? '提交中...' : '确定' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, ref, onMounted, isRuntimeOnly } from 'vue';

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
    console.log("Token:", data);
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
    console.log("ID:", data.id);
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
    console.log("Instanize Response:", instanizeData);
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
  console.log(result);
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

const satelliteToGround = reactive({
  maxBandwidth: 100,
  minBandwidth: 20,
  ratio: 0
});

const satelliteToSatellite = reactive({
  maxBandwidth: 100,
  minBandwidth: 20,
  ratio: 1  // 由于星-地比例为0，星-星比例自动设为1
});

const isSubmitting = ref(false);


// 更新星-星比例
const updateSatelliteRatio = () => {
  let ratio = parseFloat(satelliteToGround.ratio);
  
  // 验证输入值
  if (isNaN(ratio)) {
    satelliteToGround.ratio = 0;
    ratio = 0;
  } else if (ratio < 0) {
    satelliteToGround.ratio = 0;
    ratio = 0;
  } else if (ratio > 1) {
    satelliteToGround.ratio = 1;
    ratio = 1;
  }
  
  satelliteToSatellite.ratio = 1 - ratio;
};

// 监听星-地比例变化
watch(() => satelliteToGround.ratio, updateSatelliteRatio);

// 发送业务设计数据到API
// async function sendBusinessDesignData(businessData) {
//   try {
//     // 确保每次请求前重新获取token
//     const token = await fetchCSRFToken();
    
//     console.log('发送请求使用的token:', token);

//     const response = await fetch('/api/simulators/38/service-settings/', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//         'X-CSRFToken': token
//       },
//       credentials: 'include',
//       body: JSON.stringify(businessData),
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error('请求失败详情:', {
//         status: response.status,
//         statusText: response.statusText,
//         errorText: errorText
//       });
//       throw new Error(`请求失败: ${response.status} ${response.statusText}`);
//     }

//     return await response.json();
//   } catch (error) {
//     console.error('业务设计数据提交失败:', error);
//     throw error;
//   }
// }

const confirmSettings = async () => {
  // 验证输入数据
  if (!satelliteToGround.maxBandwidth || !satelliteToGround.minBandwidth || 
      !satelliteToSatellite.maxBandwidth || !satelliteToSatellite.minBandwidth ||
      !trafficRates.arrivalRate || !trafficRates.departureRate ||
      satelliteToGround.ratio === null) {
    alert('请填写完整的业务设计参数');
    return;
  }

  if (satelliteToGround.ratio < 0 || satelliteToGround.ratio > 1) {
    alert('星-地比例必须在0-1之间');
    return;
  }

  // 构造要发送的JSON数据，按照指定格式
  const businessDesignData = {
    arrival_rate: parseFloat(trafficRates.arrivalRate),
    departure_rate: parseFloat(trafficRates.departureRate),
    service_types: [
      {
        service_type: "ground_station",
        min_bandwidth: parseFloat(satelliteToGround.minBandwidth),
        max_bandwidth: parseFloat(satelliteToGround.maxBandwidth),
        proportion: parseFloat(satelliteToGround.ratio)
      },
      {
        service_type: "inter_satellite",
        min_bandwidth: parseFloat(satelliteToSatellite.minBandwidth),
        max_bandwidth: parseFloat(satelliteToSatellite.maxBandwidth),
        proportion: parseFloat(satelliteToSatellite.ratio)
      }
    ]
  };

  try {
    isSubmitting.value = true;
    
    // 发送数据到API
    const result = await sendData(businessDesignData);
    
    // 检查返回的消息
    if (result && result.message === "Service settings updated") {
      // 显示成功提示
      alert('业务设置成功！\n请点击右上角绿色按钮以开始仿真');
      
      // 发送成功后关闭对话框并通知父组件
      emit('close');
      emit('settings-confirmed', {
        success: true,
        data: businessDesignData,
        response: result
      });
    } else {
      // 如果消息不匹配，视为失败
      throw new Error('业务设置未成功完成');
    }
    
  } catch (error) {
    // 处理错误
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
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
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
</style>
