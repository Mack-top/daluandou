import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 代理 /api 到后端 Express 服务器（CORS 已在后端配置允许 uniapp 来源）
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
