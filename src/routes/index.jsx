import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

// Layouts
import CustomerLayout from '../components/layout/CustomerLayout';
import MerchantLayout from '../components/layout/MerchantLayout';
import ShipperLayout from '../components/layout/ShipperLayout';
import AdminLayout from '../components/layout/AdminLayout';

// Auth Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import Otp from '../pages/auth/Otp';
import PartnerApproval from '../pages/auth/PartnerApproval';
import NotFound from '../pages/NotFound';

// Customer Pages
import Home from '../pages/customer/Home';
import Explore from '../pages/customer/Explore';
import RestaurantDetail from '../pages/customer/RestaurantDetail';
import Cart from '../pages/customer/Cart';
import OrderTracking from '../pages/customer/OrderTracking';
import OrderHistory from '../pages/customer/OrderHistory';
import Reviews from '../pages/customer/Reviews';
import Favorites from '../pages/customer/Favorites';
import Chat from '../pages/customer/Chat';
import Notifications from '../pages/customer/Notifications';
import Profile from '../pages/customer/Profile';
import AIChatbot from '../pages/customer/AIChatbot';

// Merchant Pages
import MerchantDashboard from '../pages/merchant/Dashboard';
import MerchantOrders from '../pages/merchant/Orders';
import MerchantMenu from '../pages/merchant/Menu';
import MerchantStats from '../pages/merchant/Stats';
import MerchantReviews from '../pages/merchant/Reviews';
import MerchantSettings from '../pages/merchant/Settings';

// Shipper Pages
import ShipperPickup from '../pages/shipper/Pickup';
import ShipperHistory from '../pages/shipper/ShipperHistory';
import ShipperEarnings from '../pages/shipper/ShipperEarnings';
import ShipperProfile from '../pages/shipper/ShipperProfile';

// Admin Pages
import AdminDashboard from '../pages/admin/Dashboard';
import AdminRestaurants from '../pages/admin/Restaurants';
import AdminShippers from '../pages/admin/Shippers';
import AdminUsers from '../pages/admin/Users';
import AdminOrders from '../pages/admin/Orders';
import AdminReports from '../pages/admin/Reports';
import AdminStats from '../pages/admin/Stats';

// Protected Route Component
import { useLocation } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles }) {
  const { isLoggedIn, role, user, hasHydrated, authReady } = useAuthStore();
  const location = useLocation();

  // Access token nay chỉ nằm trong bộ nhớ nên KHÔNG kiểm tra hạn token ở đây nữa:
  // hết hạn giữa phiên sẽ được axios interceptor tự refresh (cookie HttpOnly); refresh
  // thất bại -> hydrateSession/logout hạ isLoggedIn -> điều hướng /login bên dưới.

  // Đợi (1) Zustand đọc xong localStorage và (2) đã thử silent refresh khi mở app,
  // để tránh flash-redirect về /login khi token trong bộ nhớ chưa kịp khôi phục sau F5.
  if (!hasHydrated || !authReady) {
    return (
      <div className="min-h-screen bg-md-surface flex items-center justify-center font-google-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-md-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-md-outline font-bold">Đang khôi phục phiên đăng nhập...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const isApprovalPage = location.pathname === '/partner/approval';

  // Kiểm tra nếu là Owner/Merchant hoặc Shipper mà chưa được duyệt (PENDING hoặc REJECTED)
  if ((role === 'OWNER' || role === 'MERCHANT' || role === 'SHIPPER') &&
      (user?.registerStatus === 'PENDING' || user?.registerStatus === 'REJECTED')) {
    if (!isApprovalPage) {
      return <Navigate to="/partner/approval" replace />;
    }
  } else {
    // Nếu đã được duyệt (APPROVED) hoặc role khác mà cố tình vào trang approval, chuyển về trang tương ứng
    if (isApprovalPage) {
      if (role === 'MERCHANT' || role === 'OWNER') return <Navigate to="/merchant" replace />;
      if (role === 'SHIPPER') return <Navigate to="/shipper" replace />;
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Không đủ quyền thì chuyển hướng về trang chủ mặc định của role hiện tại
    if (role === 'MERCHANT' || role === 'OWNER') return <Navigate to="/merchant" replace />;
    if (role === 'SHIPPER') return <Navigate to="/shipper" replace />;
    if (role === 'ADMIN') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      
      {/* ─── AUTHENTICATION ROUTES ────────────────────────────────────────────── */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/otp" element={<Otp />} />

      <Route path="/partner/approval" element={
        <ProtectedRoute allowedRoles={['MERCHANT', 'OWNER', 'SHIPPER']}>
          <PartnerApproval />
        </ProtectedRoute>
      } />

      {/* ─── CUSTOMER ROUTES (Public-first, but protected for private pages) ─────── */}
      <Route path="/" element={<CustomerLayout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        
        {/* Protected Customer Routes */}
        <Route path="cart" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <Cart />
          </ProtectedRoute>
        } />
        <Route path="orders" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <OrderHistory />
          </ProtectedRoute>
        } />
        <Route path="orders/:id" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <OrderTracking />
          </ProtectedRoute>
        } />
        <Route path="reviews/:orderId" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <Reviews />
          </ProtectedRoute>
        } />
        <Route path="favorites" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <Favorites />
          </ProtectedRoute>
        } />
        <Route path="chat" element={
          <ProtectedRoute allowedRoles={['CUSTOMER', 'MERCHANT', 'OWNER', 'SHIPPER']}>
            <Chat />
          </ProtectedRoute>
        } />
        <Route path="chat/:convId" element={
          <ProtectedRoute allowedRoles={['CUSTOMER', 'MERCHANT', 'OWNER', 'SHIPPER']}>
            <Chat />
          </ProtectedRoute>
        } />
        <Route path="notifications" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <Notifications />
          </ProtectedRoute>
        } />
        <Route path="profile" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="chatbot" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <AIChatbot isPublic={false} />
          </ProtectedRoute>
        } />
      </Route>

      {/* ─── MERCHANT OWNER ROUTES (Protected) ─────────────────────────────────── */}
      <Route path="/merchant" element={
        <ProtectedRoute allowedRoles={['MERCHANT', 'OWNER']}>
          <MerchantLayout />
        </ProtectedRoute>
      }>
        <Route index element={<MerchantDashboard />} />
        <Route path="orders" element={<MerchantOrders />} />
        <Route path="menu" element={<MerchantMenu />} />
        <Route path="stats" element={<MerchantStats />} />
        <Route path="reviews" element={<MerchantReviews />} />
        <Route path="settings" element={<MerchantSettings />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:convId" element={<Chat />} />
      </Route>

      {/* ─── SHIPPER ROUTES (Protected) ────────────────────────────────────────── */}
      <Route path="/shipper" element={
        <ProtectedRoute allowedRoles={['SHIPPER']}>
          <ShipperLayout />
        </ProtectedRoute>
      }>
        <Route index element={<ShipperPickup />} />
        <Route path="history" element={<ShipperHistory />} />
        <Route path="earnings" element={<ShipperEarnings />} />
        <Route path="profile" element={<ShipperProfile />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:convId" element={<Chat />} />
      </Route>

      {/* ─── ADMIN SYSTEM ROUTES (Protected) ───────────────────────────────────── */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="shippers" element={<AdminShippers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="stats" element={<AdminStats />} />
      </Route>

      {/* Fallback NotFound */}
      <Route path="*" element={<NotFound />} />

    </Routes>
  );
}
