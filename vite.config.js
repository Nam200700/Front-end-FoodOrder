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
        // Tách các lib NẶNG ra chunk riêng để KHÔNG lọt vào bundle entry (index):
        // map (maplibre ~800KB) & chart chỉ tải khi mở trang bản đồ / thống kê.
        // (rolldown/Vite 8 yêu cầu manualChunks dạng HÀM, không phải object.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/(leaflet|maplibre-gl|@maplibre)\//.test(id)) return 'map-vendor';
          if (/node_modules\/(recharts|d3-|victory-vendor|internmap|delaunator|robust-predicates)\//.test(id)) return 'charts-vendor';
        },
      },
    },
  },
})
