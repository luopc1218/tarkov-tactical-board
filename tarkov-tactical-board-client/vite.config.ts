import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const WEB_BASE = '/eftboard/'
const TAURI_BASE = './'
// const PROD_API_ORIGIN = 'https://jump.mawen.site/eftboard/'
const PROD_API_ORIGIN = 'http://localhost:8081/eftboard'

export default defineConfig(({ command, mode }) => {
  const isTauriBuild = mode === 'tauri'
  const base = command === 'serve' ? '/' : isTauriBuild ? TAURI_BASE : WEB_BASE

  return {
    base,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: PROD_API_ORIGIN,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
