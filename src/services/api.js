import axios from 'axios';

// Cấu hình URL cơ sở của Spring Boot Backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials để trình duyệt gửi kèm cookie HttpOnly (refresh token) tới BE.
  // Cần CORS allowCredentials(true) + allowedOrigins cụ thể (đã cấu hình ở SecurityConfig).
  withCredentials: true,
  timeout: 10000, // 10 giây
});

// ─── AXIOS REQUEST INTERCEPTOR ─────────────────────────────────────────────
// Tự động đính kèm Bearer Token JWT vào Header của outgoing request nếu có
apiClient.interceptors.request.use(
  async (config) => {
    const { useAuthStore } = await import('../stores/authStore');
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── AXIOS RESPONSE INTERCEPTOR (Tự động Refresh Token khi gặp lỗi 401) ─────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Lỗi 401 Unauthorized và chưa từng thử refresh cho request này, đồng thời KHÔNG phải là request login
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      if (isRefreshing) {
        // Đang có request refresh token khác chạy, xếp hàng chờ
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { useAuthStore } = await import('../stores/authStore');
        // Refresh token nằm trong cookie HttpOnly -> KHÔNG gửi trong body, chỉ cần
        // withCredentials để trình duyệt tự đính kèm cookie.
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });

        // Bóc tách token từ ApiResponse<RefreshResponse> envelope
        const { token: newAccessToken } = response.data.data;
        
        // Lưu Access Token mới vào store
        useAuthStore.setState({ token: newAccessToken });

        // Chạy lại hàng đợi các request bị lỗi
        processQueue(null, newAccessToken);

        // Chạy lại request bị lỗi ban đầu với token mới
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        const { useAuthStore } = await import('../stores/authStore');
        // Refresh token cũng thất bại (hết hạn hoàn toàn) -> Đăng xuất
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
