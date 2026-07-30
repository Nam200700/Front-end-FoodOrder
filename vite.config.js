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
        // Gom React runtime vào 1 chunk ổn định → hash ít đổi giữa các lần deploy, cache lâu.
        // (rolldown/Vite 8 yêu cầu manualChunks dạng HÀM, không phải object.)
        // Các lib nặng (recharts/leaflet/maplibre) đã tự tách chunk theo trang nhờ lazy-load.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
