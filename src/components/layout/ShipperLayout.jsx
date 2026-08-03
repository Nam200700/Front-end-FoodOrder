import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import apiClient from '../../services/api';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Map,
  History,
  DollarSign,
  User,
  LogOut,
  Power,
  MessageSquare,
  Menu,
  X,
  Star,
  Bike
} from 'lucide-react';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useLayoutNav } from '../../hooks/useLayoutNav';
import NavMenuList from './NavMenuList';
import MobileDrawer from './MobileDrawer';
import MobileTabBar from './MobileTabBar';

export default function ShipperLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, updateProfile } = useAuthStore();
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  
  const {
    drawerOpen: isMobileDrawerOpen,
    openDrawer: openMobileDrawer,
    closeDrawer: closeMobileDrawer
  } = useLayoutNav('shipper-sidebar-collapsed');

  useEffect(() => {
    closeMobileDrawer();
  }, [location.pathname, closeMobileDrawer]);

  // Kết nối và ngắt kết nối WebSocket chat thời gian thực cho Shipper
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  // Tính số lượng tin nhắn chưa đọc
  const unreadChatCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const menuItems = [
    { path: '/shipper', name: 'Nhận Đơn', icon: Map, end: true },
    { path: '/shipper/history', name: 'Lịch Sử', icon: History },
    { path: '/shipper/chat', name: 'Tin nhắn', icon: MessageSquare, badge: unreadChatCount },
    { path: '/shipper/earnings', name: 'Thu Nhập', icon: DollarSign },
    { path: '/shipper/reviews', name: 'Đánh Giá', icon: Star },
    { path: '/shipper/profile', name: 'Hồ Sơ', icon: User },
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
    <div className="min-h-screen bg-[#F4F9F5] flex flex-col text-md-on-surface font-google-sans pb-16 md:pb-0 md:pt-16">
      
      {/* ─── DESKTOP HEADER (Hidden on mobile) ─────────────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 border-b border-md-outline-variant bg-white items-center justify-between px-8 z-40 shadow-shadow-1">
        <div className="flex items-center gap-3">
          {/* Logo shipper: icon Bike thay emoji 🚴 */}
          <div className="w-10 h-10 bg-md-tertiary rounded-radius-md flex items-center justify-center text-white">
            <Bike size={20} strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-bold text-md-tertiary text-base leading-none block">Shipper Center</span>
            <span className="text-[10px] text-md-outline font-semibold uppercase block mt-0.5">Tài xế giao hàng</span>
          </div>
        </div>

        {/* Navigation Items (Desktop) */}
        <nav className="flex items-center gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/shipper' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-radius-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-md-tertiary/15 text-md-tertiary' 
                    : 'text-md-on-surface-variant hover:bg-slate-100 hover:text-md-on-surface'
                }`}
              >
                <div className="relative">
                  <Icon size={18} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold h-3.5 min-w-3.5 px-0.5 rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      
        {/* User Info / Power Button */}
        <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <div 
              onClick={handleAvatarClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi ảnh đại diện nhanh"
            >
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt="Shipper Avatar" 
                className="w-8 h-8 rounded-radius-full object-cover border border-md-tertiary/20 group-hover:opacity-75 transition-opacity"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-radius-full flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <span className="text-sm font-bold text-md-on-surface">{user.name}</span>
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="p-2 text-red-500 hover:bg-red-50 rounded-radius-full transition-colors"
          title="Đăng xuất"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>

    {/* ─── MOBILE CONTAINER HEADER (Only visible on mobile) ───────────────────────── */}
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-md-outline-variant flex items-center justify-between px-4 z-40 shadow-sm">
      <div className="flex items-center gap-2">
        {/* Logo shipper mobile: icon Bike thay emoji 🚴 */}
        <div className="w-8 h-8 bg-md-tertiary rounded-lg flex items-center justify-center text-white shadow-sm">
          <Bike size={16} strokeWidth={2.5} />
        </div>
        <span className="font-bold text-md-tertiary text-sm">Shipper Center</span>
      </div>
      <button 
        onClick={openMobileDrawer}
        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
      >
        <Menu size={20} />
      </button>
    </header>

    {/* ─── MOBILE BOTTOM NAVIGATION (component dùng chung, tông xanh shipper) ─────── */}
    <MobileTabBar items={menuItems} accent="#34A853" rootPath="/shipper" />

    {/* ─── MOBILE SHIPPER DRAWER ────────────────────────────────────────────── */}
    <MobileDrawer
      isOpen={isMobileDrawerOpen}
      onClose={closeMobileDrawer}
      drawerClass="w-64 max-w-xs bg-white border-l border-md-outline-variant"
    >
      {/* Header Drawer */}
      <div className="p-4 flex items-center justify-between border-b border-md-outline-variant bg-gradient-to-r from-emerald-50 to-transparent">
        {user ? (
          <div className="flex items-center gap-3">
            <div 
              onClick={handleAvatarClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi ảnh đại diện nhanh"
            >
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt="Shipper Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-md-tertiary/20 shadow-sm group-hover:opacity-75 transition-opacity"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-md-on-surface truncate">{user.name}</span>
              <span className="text-[8px] text-md-tertiary font-bold tracking-widest uppercase mt-0.5">Tài xế</span>
            </div>
          </div>
        ) : (
          <span className="font-bold text-slate-800">Shipper Center</span>
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
          activeClass="bg-md-tertiary/15 text-md-tertiary font-bold"
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

      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 h-full overflow-y-auto relative">
        <Outlet />
      </main>
      <ToastContainer />
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
