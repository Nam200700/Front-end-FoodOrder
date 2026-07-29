import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import RoleSwitcher from './components/widget/RoleSwitcher';
import ChatbotWidget from './components/widget/ChatbotWidget';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAuthStore } from './stores/authStore';

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

            {/* Reusable Floating Chatbot widget */}
            <ChatbotWidget />
          </BrowserRouter>
        </WebSocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
