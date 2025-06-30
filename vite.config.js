import { fileURLToPath, URL } from 'node:url'
 
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium' //导入cesium 
 
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(), cesium() //添加插件
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // rewrite: path => path.replace(/^\/api/, '/api'), // 保持路径不变
      }
    }
  }
	
})
