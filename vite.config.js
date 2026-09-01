import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend để Vite proxy chuyển tiếp lúc DEV. Mặc định cùng máy, cổng 8080.
  const backend = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
  plugins: [react()],
  server: {
    // host:true -> điện thoại cùng wifi vào được qua IP LAN (vd http://192.168.1.58:5173).
    host: true,
    // Proxy để FE và API CÙNG một origin (localhost:5173) khi dev — giống hệt bản deploy
    // dùng đường dẫn tương đối. Nhờ vậy cookie refresh token là first-party, KHÔNG bị
    // SameSite=Lax chặn như khi FE (localhost) gọi thẳng API ở host khác (192.168.1.58).
    // Đây là lý do trước đây reload là mất đăng nhập: cookie set ở host khác không được gửi lại.
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: backend, changeOrigin: true, ws: true }, // ws:true để nâng cấp WebSocket
    },
  },
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
  }
})
