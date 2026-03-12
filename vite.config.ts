import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    /* 
    VitePWA({
      registerType: 'autoUpdate',
      ...
    })
    */
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ['**/.wrangler/**']
    }
  }
})
