import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import {
  Map,
  History,
  DollarSign,
  User,
  LogOut,
  Power,
  MessageSquare,
  Menu,
  X
} from 'lucide-react';

export default function ShipperLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

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
    { path: '/shipper', name: 'Nhận Đơn', icon: Map },
    { path: '/shipper/history', name: 'Lịch Sử', icon: History },
    { path: '/shipper/chat', name: 'Tin nhắn', icon: MessageSquare, badge: unreadChatCount },
    { path: '/shipper/earnings', name: 'Thu Nhập', icon: DollarSign },
    { path: '/shipper/profile', name: 'Hồ Sơ', icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F9F5] flex flex-col text-md-on-surface font-google-sans pb-16 md:pb-0 md:pt-16">
      
      {/* ─── DESKTOP HEADER (Hidden on mobile) ─────────────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 border-b border-md-outline-variant bg-white items-center justify-between px-8 z-40 shadow-shadow-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-md-tertiary rounded-radius-md flex items-center justify-center text-white text-lg font-bold">
            🚴
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
            <img 
              src={user.avatar} 
              alt="Shipper Avatar" 
              className="w-8 h-8 rounded-radius-full object-cover border border-md-tertiary/20"
            />
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
        <div className="w-8 h-8 bg-md-tertiary rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
          🚴
        </div>
        <span className="font-bold text-md-tertiary text-sm">Shipper Center</span>
      </div>
      <button 
        onClick={() => setIsMobileDrawerOpen(true)}
        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
      >
        <Menu size={20} />
      </button>
    </header>

    {/* ─── MOBILE BOTTOM NAVIGATION (Hidden on desktop) ─────────────────────────── */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-md-outline-variant bg-white flex items-center justify-around px-2 z-40 shadow-shadow-2">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/shipper' && location.pathname.startsWith(item.path));
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full relative transition-all duration-200 ${
              isActive ? 'text-md-tertiary font-bold' : 'text-md-on-surface-variant'
            }`}
          >
            <div className="relative">
              <Icon size={20} className={isActive ? 'scale-110 stroke-[2.5px]' : ''} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold h-3.5 min-w-3.5 px-0.5 rounded-full flex items-center justify-center animate-pulse">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">{item.name}</span>
          </button>
        );
      })}
    </nav>

    {/* ─── MOBILE SHIPPER DRAWER ────────────────────────────────────────────── */}
    {isMobileDrawerOpen && (
      <div className="md:hidden fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileDrawerOpen(false)}
        ></div>
        
        {/* Drawer Body */}
        <div className="relative w-64 max-w-xs h-full bg-white shadow-xl flex flex-col z-10 animate-slide-left border-l border-md-outline-variant">
          {/* Header Drawer */}
          <div className="p-4 flex items-center justify-between border-b border-md-outline-variant bg-gradient-to-r from-emerald-50 to-transparent">
            {user ? (
              <div className="flex items-center gap-3">
                <img 
                  src={user.avatar} 
                  alt="Shipper Avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-md-tertiary/20 shadow-sm"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-md-on-surface truncate">{user.name}</span>
                  <span className="text-[8px] text-md-tertiary font-bold tracking-widest uppercase mt-0.5">Tài xế</span>
                </div>
              </div>
            ) : (
              <span className="font-bold text-slate-800">Shipper Center</span>
            )}
            <button 
              onClick={() => setIsMobileDrawerOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Menu Items list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/shipper' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-md-tertiary/15 text-md-tertiary font-bold' 
                      : 'text-md-on-surface-variant hover:bg-slate-100'
                  }`}
                >
                  <div className="relative">
                    <Icon size={18} />
                    {item.badge > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Logout button */}
          <div className="p-3 border-t border-md-outline-variant bg-slate-50">
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )}

      {/* ─── MAIN CONTENT VIEWPORT ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 h-full overflow-y-auto relative">
        <Outlet />
      </main>

    </div>
  );
}
