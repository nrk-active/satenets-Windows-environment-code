<template>
    <div class="latency-table">
        <div class="latency-header">网络延迟数据</div>
        <div class="latency-content">
            <!-- 固定显示10行，不足时显示占位符 -->
            <div v-for="i in MAX_ROWS" :key="i" class="latency-row">
                {{ i <= latencyData.length ? latencyData[i-1].toFixed(2) : '---' }} 
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const MAX_ROWS = 10;
const latencyData = ref([]);
let currentIndex = 0;
let timer = null;

// 初始延迟数据列表
const initialLatencyList = [
    63.85681465683943,
    53.43380920260499,
    61.639027547925174,
    63.64146454301401,
    59.056463144532955,
    57.68218912347344,
    59.25318844968379,
    61.31927234552141,
    59.3994024814789,
    60.227895971740985,
    58.640507121295855
];

// 添加新的延迟数据
const addLatency = (newLatency) => {
    latencyData.value.unshift(newLatency);
    if (latencyData.value.length > MAX_ROWS) {
        latencyData.value.pop();
    }
};

// 定时添加数据
const startAddingData = () => {
    timer = setInterval(() => {
        if (currentIndex < initialLatencyList.length) {
            addLatency(initialLatencyList[currentIndex]);
            currentIndex++;
        } else {
            // 所有数据都添加完后，清除定时器
            clearInterval(timer);
        }
    }, 8000); // 每5秒添加一个数据
};

onMounted(() => {
    // 启动定时添加数据
    startAddingData();
});

// 组件卸载时清理定时器
onUnmounted(() => {
    if (timer) {
        clearInterval(timer);
    }
});

defineExpose({
    addLatency
});
</script>

<style scoped>
.latency-table {
    position: fixed;
    /* 修改位置为垂直居中 */
    top: 50%;
    transform: translateY(-50%);
    left: 20px;
    width: 120px;
    background-color: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    overflow: hidden;
    z-index: 1000;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.latency-header {
    padding: 10px;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    font-weight: bold;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.latency-content {
    padding: 5px;
}

.latency-row {
    padding: 8px;
    color: white;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: background-color 0.2s;
}

.latency-row:last-child {
    border-bottom: none;
}

.latency-row:hover {
    background-color: rgba(255, 255, 255, 0.1);
}
</style>