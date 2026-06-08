import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // VPS: read VITE_* from repo root .env (same file as backend pm2)
  envDir: '..',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/img': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
