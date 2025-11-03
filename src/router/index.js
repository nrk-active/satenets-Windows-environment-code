import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../components/LoginPage.vue'
import SatelliteViewer from '../components/SatelliteViewer.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { keepAlive: false }
  },
  {
    path: '/register',
    name: 'register', 
    component: LoginPage,
    meta: { keepAlive: false }
  },
  {
    path: '/satellite',
    name: 'satellite',
    component: SatelliteViewer,
    meta: { keepAlive: false }
  },
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 添加全局导航守卫，帮助调试
router.beforeEach((to, from, next) => {
  // console.log(`路由导航: ${from.path} → ${to.path}`);
  next();
});

router.afterEach((to, from) => {
  // console.log(`路由完成: ${from.path} → ${to.path}`);
});

export default router