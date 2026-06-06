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

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const carts = useCartStore((state) => state.carts);
  const cartCount = carts.reduce((total, cart) => total + (cart.items || []).reduce((sum, item) => sum + item.quantity, 0), 0);
  const total = carts.reduce((sum, cart) => sum + (cart.subtotal || 0), 0);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  const { unreadCount } = useNotificationStore();
  const { logout, user, isLoggedIn, role } = useAuthStore();

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
  
  const [navRailExpanded, setNavRailExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Tính số unread chat
  const unreadChatCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const menuItems = [
    { path: '/', name: 'Trang chủ', icon: Home },
    { path: '/explore', name: 'Khám phá', icon: Search },
    { path: '/cart', name: 'Giỏ hàng', icon: ShoppingCart, badge: cartCount },
    { path: '/orders', name: 'Đơn hàng', icon: Package },
    { path: '/favorites', name: 'Yêu thích', icon: Heart },
    { path: '/chat', name: 'Tin nhắn', icon: MessageSquare, badge: unreadChatCount },
    { path: '/notifications', name: 'Thông báo', icon: Bell, badge: unreadCount },
    { path: '/profile', name: 'Tài khoản', icon: User },
  ];

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kích thước file tối đa là 5MB!");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(file.type.toLowerCase()) && ext !== 'heic' && ext !== 'heif') {
      toast.error("Chỉ chấp nhận các định dạng hình ảnh JPEG, PNG, WEBP, HEIC, HEIF!");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newUrl = uploadRes.data?.data?.url;
      if (!newUrl) throw new Error("Không nhận được URL ảnh!");

      try {
        await apiClient.put('/users/profile', {
          avatar: newUrl
        });
        updateProfile({ avatar: newUrl });
        toast.success("Cập nhật ảnh đại diện thành công! 🎉");
      } catch (dbErr) {
        console.error("Cập nhật Database thất bại:", dbErr);
        toast.error(dbErr.response?.data?.message || "Cập nhật Database thất bại. Đang giữ nguyên ảnh cũ.");
      }
    } catch (uploadErr) {
      console.error("Upload ảnh thất bại:", uploadErr);
      toast.error(uploadErr.response?.data?.message || "Lỗi khi upload ảnh lên Cloudinary!");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          navRailExpanded ? 'w-68' : 'w-22'
        }`}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setNavRailExpanded(!navRailExpanded)}
          className="absolute -right-3.5 top-8 bg-white border border-md-outline-variant rounded-full p-1.5 text-md-outline hover:text-md-primary shadow-shadow-2 hover:scale-115 transition-all cursor-pointer"
        >
          {navRailExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Brand / Logo */}
        <div className="p-5 flex items-center gap-3.5 border-b border-md-outline-variant">
          <div className="w-12 h-12 bg-gradient-to-tr from-md-primary to-md-secondary rounded-radius-lg flex items-center justify-center text-white font-extrabold text-xl shadow-shadow-3 shrink-0">
            MD
          </div>
          {navRailExpanded && (
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
        {navRailExpanded && user && (
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
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4.5 w-full px-4 py-3.5 rounded-radius-xl transition-all duration-200 group relative cursor-pointer ${
                  isActive 
                    ? 'bg-md-primary text-white font-extrabold shadow-shadow-2' 
                    : 'text-md-on-surface-variant hover:bg-md-primary-container/20 hover:text-md-primary'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'group-hover:scale-105 transition-transform'} />
                  {item.badge > 0 && (
                    <span className={`absolute -top-2.5 -right-2.5 text-white text-[9px] font-extrabold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-shadow-1 ${
                      isActive ? 'bg-md-secondary' : 'bg-md-error'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {navRailExpanded && (
                  <span className="text-sm tracking-wide font-semibold">{item.name}</span>
                )}
                {!navRailExpanded && (
                  <div className="absolute left-22 bg-md-on-surface text-white text-xs px-2.5 py-1.5 rounded-radius-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-md-outline-variant">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4.5 w-full px-4 py-3.5 text-red-500 rounded-radius-xl hover:bg-red-50 transition-colors cursor-pointer ${
              navRailExpanded ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOut size={22} />
            {navRailExpanded && <span className="text-sm font-bold">Đăng xuất</span>}
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
          onClick={() => setIsMobileDrawerOpen(true)}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* ─── MOBILE BOTTOM NAV ───────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-md-outline-variant bg-white flex items-center justify-around px-2 z-40 shadow-shadow-3">
        {menuItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 w-14 h-full relative transition-all duration-200 cursor-pointer ${
                isActive ? 'text-md-primary font-bold' : 'text-md-on-surface-variant'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'stroke-[2.5px] scale-110' : ''} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-md-error text-white text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-shadow-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.name}</span>
            </button>
          );
        })}
        {/* Nút thứ 5: Thêm (Menu) */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-14 h-full relative transition-all duration-200 cursor-pointer text-md-on-surface-variant"
        >
          <Menu size={20} />
          <span className="text-[10px] tracking-tight">Thêm</span>
        </button>
      </nav>

      {/* ─── MOBILE DRAWER OVERLAY ─────────────────── */}
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
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-md-primary text-white font-extrabold shadow-sm' 
                        : 'text-md-on-surface-variant hover:bg-slate-100'
                    }`}
                  >
                    <div className="relative">
                      <Icon size={18} />
                      {item.badge > 0 && (
                        <span className={`absolute -top-2 -right-2 text-white text-[8px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-sm ${
                          isActive ? 'bg-md-secondary' : 'bg-md-error'
                        }`}>
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
        onChange={handleAvatarChange} 
      />

    </div>
  );
}
