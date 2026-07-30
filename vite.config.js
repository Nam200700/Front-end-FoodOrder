import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {},
  define: {
    global: 'globalThis',   // thêm dòng này fix lỗi "global is not defined"
  },
  build: {
    rollupOptions: {
      output: {
        // Gom React vào 1 chunk ổn định → hash ít đổi giữa các lần deploy, cache lâu.
        // Các lib nặng (recharts/leaflet/maplibre) đã tự tách chunk theo trang nhờ lazy-load.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
