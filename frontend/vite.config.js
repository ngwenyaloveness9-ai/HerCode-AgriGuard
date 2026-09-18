import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 1572,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:1573',
        changeOrigin: true
      }
    }
  }
})
