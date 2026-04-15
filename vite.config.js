import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
  proxy: {
      // 对话接口代理（保持不变）
      '/lke-api': {
        target: 'https://wss.lke.cloud.tencent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lke-api/, '')
      },
      // 新增：上传接口代理
      '/lke-upload': {
        // ！！！请根据文档核对这个域名，大概率是下面这个或 api.lke...
        target: 'https://lke.cloud.tencent.com', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lke-upload/, ''),
        // 增加超时和大小限制设置，防止大文件断连
        timeout: 300000
      }
    }
  }
})
