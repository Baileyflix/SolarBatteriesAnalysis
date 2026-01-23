import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/octopus': {
        target: 'https://api.octopus.energy',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/octopus/, ''),
        secure: true,
      },
      '/api/nasa-power': {
        target: 'https://power.larc.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nasa-power/, ''),
        secure: true,
      },
      '/api/postcodes': {
        target: 'https://api.postcodes.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/postcodes/, ''),
        secure: true,
      },
    },
  },
})
