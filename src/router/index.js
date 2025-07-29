import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../components/LoginPage.vue'
import SatelliteViewer from '../components/SatelliteViewer.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage
  },
  {
    path: '/register',
    name: 'register', 
    component: LoginPage
  },
  {
    path: '/satellite',
    name: 'satellite',
    component: SatelliteViewer
  },
  {
    path: '/',
    redirect: '/login'  // 默认跳转到卫星视图
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/satellite'  // 404也跳转到卫星视图
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router