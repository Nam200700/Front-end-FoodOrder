import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import RoleSwitcher from './components/widget/RoleSwitcher';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WebSocketProvider>
          <BrowserRouter>
            {/* Ứng dụng chính */}
            <AppRoutes />

            {/* Floating Demo Tool để chuyển vai trò cực kỳ tiện lợi */}
            <RoleSwitcher />
          </BrowserRouter>
        </WebSocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
