import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    // 開発時は /api をローカル or 環境変数の API へプロキシ。
    proxy: (() => {
      const target = process.env.VITE_API_BASE_URL || 'http://localhost:3000'
      return {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
      }
    })(),
  },
})