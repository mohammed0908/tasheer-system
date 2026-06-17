import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl =
  process.env.VITE_API_URL || 'https://tasheer-system-production.up.railway.app'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
      '/uploads': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['tasheer.up.railway.app'],
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
      '/uploads': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
