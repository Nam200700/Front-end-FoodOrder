/**
 * NGUỒN DUY NHẤT cho địa chỉ WebSocket của toàn app.
 *
 * Trước đây mỗi nơi tự đọc một biến khác nhau: WebSocketContext đọc VITE_WS_URL còn
 * chatStore đọc VITE_WS_BASE_URL kèm fallback localhost. Khi deploy chỉ khai một biến,
 * chat lặng lẽ quay về localhost:8080 -> ERR_CONNECTION_REFUSED trên máy người dùng,
 * trong khi thông báo realtime vẫn chạy nên rất khó lần ra.
 *
 * Ưu tiên VITE_WS_URL, chấp nhận VITE_WS_BASE_URL để không phá cấu hình deploy cũ.
 * Ở PROD mà thiếu cả hai thì ném lỗi ngay lúc nạp app — thà vỡ to còn hơn âm thầm
 * trỏ về localhost rồi mãi sau mới phát hiện.
 */
const configured = import.meta.env.VITE_WS_URL || import.meta.env.VITE_WS_BASE_URL;

if (!configured && import.meta.env.PROD) {
  throw new Error('[Config] Phải khai VITE_WS_URL (hoặc VITE_WS_BASE_URL) khi build production!');
}

// SockJS chạy trên HTTP(S), không nhận scheme ws:// — chuyển giúp để dù khai kiểu nào cũng chạy.
export const WS_URL = (configured || 'http://localhost:8080/ws').replace(/^ws/, 'http');

export default WS_URL;
