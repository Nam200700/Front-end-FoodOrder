import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import RoleSwitcher from './components/widget/RoleSwitcher';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAuthStore } from './stores/authStore';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  // Khi mở/F5 app: access token trong bộ nhớ đã mất -> thử silent refresh (cookie HttpOnly)
  // để khôi phục phiên trước khi render route bảo vệ (ProtectedRoute chờ cờ authReady).
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const hydrateSession = useAuthStore((s) => s.hydrateSession);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    if (!hasHydrated) return; // đợi Zustand đọc xong localStorage
    if (useAuthStore.getState().isLoggedIn) {
      hydrateSession();
    } else {
      setAuthReady(true);
    }
  }, [hasHydrated, hydrateSession, setAuthReady]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WebSocketProvider>
          <BrowserRouter>
            {/* Ứng dụng chính */}
            <AppRoutes />

            {/* Floating Demo Tool để chuyển vai trò cực kỳ tiện lợi */}
            <RoleSwitcher />

            {/* Toast dùng chung CHO TOÀN APP — mount 1 lần duy nhất ở đây.
                Trước đây mỗi layout tự mount một cái, nên các trang nằm NGOÀI layout
                (OTP, Đăng ký, Chờ duyệt đối tác) gọi toast mà không có gì hiển thị.
                Đặt ở đây còn tránh toast bị mất khi chuyển giữa các layout. */}
            <ToastContainer />
          </BrowserRouter>
        </WebSocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
