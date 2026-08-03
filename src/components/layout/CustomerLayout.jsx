import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useChatStore } from '../../stores/chatStore';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  Home,
  Search,
  ShoppingCart,
  Package,
  User,
  Heart,
  MessageSquare,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { parseOrderEvent, notifyStatusChange } from '../../utils/orderStatusHelper';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useLayoutNav } from '../../hooks/useLayoutNav';
import NavMenuList from './NavMenuList';
import MobileDrawer from './MobileDrawer';
import MobileTabBar from './MobileTabBar';

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const carts = useCartStore((state) => state.carts);
  const cartCount = carts.reduce((total, cart) => total + (cart.items || []).reduce((sum, item) => sum + item.quantity, 0), 0);
  const total = carts.reduce((sum, cart) => sum + (cart.subtotal || 0), 0);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  const { unreadCount } = useNotificationStore();
  const { logout, user, isLoggedIn, role, updateProfile } = useAuthStore();

  useEffect(() => {
    if (isLoggedIn && role === 'CUSTOMER') {
      fetchCart();
    }
  }, [isLoggedIn, role, fetchCart]);

  const { subscribe } = useWebSocketContext();

  // Tự động chuyển hướng nếu người dùng đã đăng nhập với role đặc thù sang trang chủ của họ (trừ phi đang ở trang dùng chung như /chat)
  if (isLoggedIn && !location.pathname.startsWith('/chat')) {
    if (role === 'OWNER' || role === 'MERCHANT') {
      return <Navigate to="/merchant" replace />;
    }
    if (role === 'SHIPPER') {
      return <Navigate to="/shipper" replace />;
    }
    if (role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
  }

  // Kết nối và ngắt kết nối WebSocket chat thời gian thực
  useEffect(() => {
    if (isLoggedIn) {
      connectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [isLoggedIn, connectWebSocket, disconnectWebSocket]);

  // WEBSOCKET THEO DÕI HÀNG ĐỢI THÔNG BÁO CÁ NHÂN (Global Notification & Toast)
  useEffect(() => {
    if (!isLoggedIn || role !== 'CUSTOMER') return;

    const destination = `/user/queue/notify`;
    console.log('[Global Notification Track]: Subscribing to ' + destination);

    const sub = subscribe(destination, (notifEvent) => {
      console.log('[Global Notification]: Received event', notifEvent);
      if (!notifEvent || !notifEvent.refId || !notifEvent.type) return;

      const parsed = parseOrderEvent(notifEvent);
      if (parsed) {
        // Nổ Toast thông báo global (đã có cơ chế dedupe tự động)
        notifyStatusChange(parsed);
      }
    });

    return () => {
      if (sub && sub.unsubscribe) {
        console.log('[Global Notification Track]: Unsubscribing from ' + destination);
        sub.unsubscribe();
      }
    };
  }, [isLoggedIn, role, subscribe]);
  
  const {
    sidebarCollapsed,
    drawerOpen: isMobileDrawerOpen,
    toggleSidebar,
    openDrawer: openMobileDrawer,
    closeDrawer: closeMobileDrawer
  } = useLayoutNav('customer-sidebar-collapsed');

  useEffect(() => {
    closeMobileDrawer();
  }, [location.pathname, closeMobileDrawer]);

  // Tính số unread chat
  const unreadChatCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const menuItems = [
    { path: '/', name: 'Trang chủ', icon: Home, end: true },
    { path: '/explore', name: 'Khám phá', icon: Search },
    { path: '/cart', name: 'Giỏ hàng', icon: ShoppingCart, badge: cartCount },
    { path: '/orders', name: 'Đơn hàng', icon: Package },
    { path: '/favorites', name: 'Yêu thích', icon: Heart },
    { path: '/chat', name: 'Tin nhắn', icon: MessageSquare, badge: unreadChatCount },
    { path: '/notifications', name: 'Thông báo', icon: Bell, badge: unreadCount },
    { path: '/profile', name: 'Tài khoản', icon: User },
  ];

  const fileInputRef = useRef(null);
  const { uploading, handleAvatarChange } = useAvatarUpload();

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col md:flex-row text-md-on-surface font-google-sans">
      
      {/* ─── DESKTOP NAV RAIL (Left side, hidden on mobile) ───────────────────────── */}
      <aside 
        className={`hidden md:flex flex-col border-r border-md-outline-variant bg-white transition-all duration-300 relative z-30 ${
          sidebarCollapsed ? 'w-22' : 'w-68'
        }`}
      >
        {/* Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-8 bg-white border border-md-outline-variant rounded-full p-1.5 text-md-outline hover:text-md-primary shadow-shadow-2 hover:scale-115 transition-all cursor-pointer"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand / Logo */}
        <div className="p-5 flex items-center gap-3.5 border-b border-md-outline-variant">
          <div className="w-12 h-12 bg-gradient-to-tr from-md-primary to-md-secondary rounded-radius-lg flex items-center justify-center text-white font-extrabold text-xl shadow-shadow-3 shrink-0">
            MD
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-800 text-lg leading-none tracking-tight">
                <span className="text-md-primary">Meal</span>
                <span className="text-md-secondary">Dash</span>
              </span>
              <span className="text-[9px] text-md-outline font-bold tracking-widest uppercase mt-1.5">Food System</span>
            </div>
          )}
        </div>

        {/* User Quick Info */}
        {!sidebarCollapsed && user && (
          <div className="p-4 mx-4 my-4 bg-gradient-to-r from-md-primary-container/20 to-md-secondary-container/10 border border-md-primary/5 rounded-radius-xl flex items-center gap-3.5 shadow-sm animate-fade-in">
            <div 
              onClick={handleAvatarClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi ảnh đại diện nhanh"
            >
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt="Avatar" 
                className="w-11 h-11 rounded-radius-full border-2 border-md-primary/20 object-cover shadow-sm group-hover:opacity-75 transition-opacity"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-radius-full flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-extrabold text-md-on-surface truncate">{user.name}</span>
              <span className="text-[10px] text-md-primary font-bold tracking-wide uppercase mt-1">
                Khách hàng
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
          <NavMenuList
            items={menuItems}
            collapsed={sidebarCollapsed}
            itemClass="flex items-center gap-4.5 w-full px-4 py-3.5 rounded-radius-xl transition-all duration-200 group relative cursor-pointer"
            activeClass="bg-md-primary text-white font-extrabold shadow-shadow-2"
            inactiveClass="text-md-on-surface-variant hover:bg-md-primary-container/20 hover:text-md-primary"
            iconSize={22}
            tooltipClass="absolute left-22 bg-md-on-surface text-white text-xs px-2.5 py-1.5 rounded-radius-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50"
          />
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-md-outline-variant">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4.5 w-full px-4 py-3.5 text-red-500 rounded-radius-xl hover:bg-red-50 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <LogOut size={22} />
            {!sidebarCollapsed && <span className="text-sm font-bold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE TOP HEADER ─────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-md-outline-variant bg-white flex items-center justify-between px-4 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-md-primary to-md-secondary rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
            MD
          </div>
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">
            <span className="text-md-primary">Meal</span>
            <span className="text-md-secondary">Dash</span>
          </span>
        </div>
        <button 
          onClick={openMobileDrawer}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* ─── MOBILE BOTTOM NAV (component dùng chung, animation + pill chỉ báo) ───── */}
      <MobileTabBar
        accent="#FF6B35"
        rootPath="/"
        items={[
          ...menuItems.slice(0, 4),
          { name: 'Thêm', icon: Menu, action: openMobileDrawer },
        ]}
      />

      {/* ─── MOBILE DRAWER OVERLAY ─────────────────── */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={closeMobileDrawer}
        drawerClass="w-64 max-w-xs bg-white border-l border-md-outline-variant"
      >
        {/* Header Drawer */}
        <div className="p-4 flex items-center justify-between border-b border-md-outline-variant bg-gradient-to-r from-md-primary-container/10 to-transparent">
          {user ? (
            <div className="flex items-center gap-3">
              <div 
                onClick={handleAvatarClick}
                className="relative cursor-pointer group shrink-0"
                title="Click để đổi ảnh đại diện nhanh"
              >
                <img 
                  src={getAvatarUrl(user.avatar)} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-md-primary/20 shadow-sm group-hover:opacity-75 transition-opacity"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-extrabold text-slate-800 truncate">{user.name}</span>
                <span className="text-[8px] text-md-primary font-bold tracking-widest uppercase">Khách hàng</span>
              </div>
            </div>
          ) : (
            <span className="font-bold text-slate-800">MealDash</span>
          )}
          <button 
            onClick={closeMobileDrawer}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavMenuList
            items={menuItems}
            collapsed={false}
            itemClass="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all cursor-pointer"
            activeClass="bg-md-primary text-white font-extrabold shadow-sm"
            inactiveClass="text-md-on-surface-variant hover:bg-slate-100"
            iconSize={18}
            onItemClick={closeMobileDrawer}
          />
        </div>

        {/* Logout button */}
        <div className="p-3 border-t border-md-outline-variant bg-slate-50">
          <button
            onClick={() => {
              closeMobileDrawer();
              handleLogout();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </MobileDrawer>

      {/* ─── MAIN CONTENT AREA ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 pb-16 md:pb-0 h-screen overflow-y-auto relative bg-md-surface">
        <Outlet />
      </main>

      {/* TOAST POPUP TOÀN CỤC THỜI GIAN THỰC */}
      <ToastContainer />

      {/* Input file ẩn phục vụ upload nhanh avatar */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => handleAvatarChange(e.target.files?.[0])} 
      />

    </div>
  );
}
