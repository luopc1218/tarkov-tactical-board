import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const WEB_BASE = '/eftboard/'
const TAURI_BASE = './'

export default defineConfig(({ mode }) => {
  const isTauriBuild = mode === 'tauri'

  return {
    base: isTauriBuild ? TAURI_BASE : WEB_BASE,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          ws: true,
        },
        '/eftboard/api': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
