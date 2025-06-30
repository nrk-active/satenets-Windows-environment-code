<!-- src/components/LineChart.vue -->
<template>
    <div>
      <canvas ref="canvasRef"></canvas>
    </div>
  </template>
  
  <script setup>
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale
  } from 'chart.js'
  
  Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale)
  
  const props = defineProps({
    dataSet: {
      type: Array,
      required: true
    },
    label: {
      type: String,
      default: '折线图'
    }
  })
  
  const canvasRef = ref(null)
  let chartInstance = null
  
  const renderChart = () => {
    if (chartInstance) chartInstance.destroy()
  
    chartInstance = new Chart(canvasRef.value, {
      type: 'line',
      data: {
        labels: props.dataSet.map((_, index) => `T-${props.dataSet.length - index}`),
        datasets: [
          {
            label: props.label,
            data: props.dataSet,
            fill: false,
            borderColor: '#f39c12',
            backgroundColor: '#f39c12',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    })
  }
  
  watch(() => props.dataSet, renderChart, { deep: true })
  onMounted(renderChart)
  onUnmounted(() => {
    if (chartInstance) chartInstance.destroy()
  })
  </script>
  
  <style scoped>
  canvas {
    width: 100%;
    height: 100%;
  }
  </style>
  