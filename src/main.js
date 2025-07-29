import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 引入路由配置
import 'cesium/Build/Cesium/Widgets/widgets.css';
import VueECharts from 'vue-echarts'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent
} from 'echarts/components'
import {
  CanvasRenderer
} from 'echarts/renderers'

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LineChart,
  CanvasRenderer
])

const app = createApp(App)
app.component('vue-echarts', VueECharts)
app.use(router) // 使用路由
app.mount('#app')