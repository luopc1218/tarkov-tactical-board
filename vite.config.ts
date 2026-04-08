import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/eftboard/',
  plugins: [react()],
  server: {
    port: 10001,
    proxy: {
      '/api': {
        target: 'http://localhost:10002/eftboard-server',
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: 'http://localhost:10002/eftboard-server',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
