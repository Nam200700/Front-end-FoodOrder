import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useOrderStore } from '../../stores/orderStore';
import apiClient from '../../services/api';
import { getRestaurantBannerUrl } from '../../utils/avatarHelper';
import { toast } from 'react-toastify';
import {
  BarChart3,
  ClipboardList,
  UtensilsCrossed,
  MessageSquare,
  Star,
  LineChart,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  X,
  Store
} from 'lucide-react';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useLayoutNav } from '../../hooks/useLayoutNav';
import NavMenuList from './NavMenuList';
import MobileDrawer from './MobileDrawer';
import MobileTabBar from './MobileTabBar';

export default function MerchantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  const { orderHistory } = useOrderStore();
  
  const {
    sidebarCollapsed,
    drawerOpen: isMobileDrawerOpen,
    toggleSidebar,
    openDrawer: openMobileDrawer,
    closeDrawer: closeMobileDrawer
  } = useLayoutNav('merchant-sidebar-collapsed');

  const expanded = !sidebarCollapsed;

  useEffect(() => {
    closeMobileDrawer();
  }, [location.pathname, closeMobileDrawer]);
  const [restaurant, setRestaurant] = useState(null);

  // Kết nối và ngắt kết nối WebSocket chat thời gian thực cho Merchant
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Lấy thông tin nhà hàng thực tế từ DB và tính toán đơn hàng PENDING thật
  useEffect(() => {
    const fetchRestaurantAndOrders = async () => {
      try {
        const response = await apiClient.get('/merchant/restaurant');
        if (response.data?.data) {
          const resData = response.data.data;
          setRestaurant(resData);
          
          const currentResId = resData.restaurantId || resData.id;
          const ordersRes = await apiClient.get(`/merchant/orders?restaurantId=${currentResId}&status=PENDING`);
          setPendingOrdersCount(ordersRes.data?.data?.content?.length || 0);
        }
      } catch (err) {
        console.warn('[MerchantLayout]: Không tìm thấy thông tin nhà hàng hoặc chưa đăng ký.');
      }
    };
    fetchRestaurantAndOrders();
  }, [location.pathname]);

  // Tính unread chat
  const unreadChatCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const menuItems = [
    { path: '/merchant', name: 'Dashboard', icon: BarChart3, end: true },
    { path: '/merchant/orders', name: 'Đơn hàng', icon: ClipboardList, badge: pendingOrdersCount },
    { path: '/merchant/menu', name: 'Quản lý menu', icon: UtensilsCrossed },
    { path: '/merchant/chat', name: 'Chat', icon: MessageSquare, badge: unreadChatCount },
    { path: '/merchant/reviews', name: 'Đánh giá', icon: Star },
    { path: '/merchant/stats', name: 'Thống kê', icon: LineChart },
    { path: '/merchant/settings', name: 'Cài đặt quán', icon: Settings },
  ];

  const fileInputRef = useRef(null);

  const { uploading: uploadingLogo, handleAvatarChange: handleLogoChange } = useAvatarUpload(async (newUrl) => {
    if (!restaurant) return;
    const rId = restaurant.restaurantId || restaurant.id;
    await apiClient.put(`/merchant/restaurants/${rId}`, {
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      phone: restaurant.phone,
      description: restaurant.description,
      imageUrl: newUrl
    });
    setRestaurant(prev => prev ? { ...prev, imageUrl: newUrl } : null);
    toast.success("Cập nhật logo nhà hàng thành công!");
  });

  const handleLogoClick = () => {
    if (!restaurant) {
      toast.warn("Bạn chưa đăng ký nhà hàng. Vui lòng vào Cài đặt quán để đăng ký trước!");
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-md-on-surface font-google-sans">
      
      {/* ─── SIDE DRAWER ──────────────────────────────────────────────────────── */}
      <aside 
        className={`hidden md:flex flex-col border-r border-md-outline-variant bg-white transition-all duration-300 relative z-30 shadow-shadow-1 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-40 bg-white border border-md-outline-variant rounded-full p-1.5 text-md-outline hover:text-md-secondary hover:border-md-secondary/40 shadow-shadow-2 hover:scale-110 transition-all"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand / Logo — banner gradient xanh tạo nhận diện riêng cho khu Merchant */}
        <div className="p-5 flex items-center gap-3 bg-gradient-to-br from-md-secondary to-blue-700 text-white relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-radius-md flex items-center justify-center text-white shadow-shadow-2 border border-white/20 shrink-0">
            <Store size={20} />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0 relative z-10">
              <span className="font-extrabold text-white text-base leading-none">Merchant Hub</span>
              {/* Tên quán thật thay cho chuỗi hardcode "Cơm Tấm Ngon" */}
              <span className="text-[10px] text-white/70 font-semibold tracking-wider uppercase mt-1 truncate max-w-[140px]">{restaurant ? restaurant.restaurantName : 'Quán của bạn'}</span>
            </div>
          )}
        </div>

        {/* Store Profile Quick Card */}
        {!sidebarCollapsed && user && (
          <div className="p-4 mx-3 my-4 bg-md-secondary-container/20 rounded-radius-lg border border-md-secondary/10 flex items-center gap-3 animate-rise-in">
            <div 
              onClick={handleLogoClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi nhanh logo quán"
            >
              <img 
                src={getRestaurantBannerUrl(restaurant ? restaurant.imageUrl : "")} 
                alt="Store Avatar" 
                className="w-12 h-12 rounded-radius-md object-cover border border-md-secondary/20 shadow-shadow-1 group-hover:opacity-75 transition-opacity"
              />
              {uploadingLogo && (
                <div className="absolute inset-0 bg-black/40 rounded-radius-md flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-md-on-surface truncate">
                {restaurant ? restaurant.restaurantName : "Chưa đăng ký quán"}
              </span>
              {restaurant ? (
                <span className="text-[10px] bg-md-secondary/15 text-md-secondary font-bold px-1.5 py-0.5 rounded-full w-max mt-1">
                  {restaurant.status ? 'Đang Mở Cửa' : 'Tạm Đóng Cửa'}
                </span>
              ) : (
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full w-max mt-1">
                  Chờ Đăng Ký
                </span>
              )}
            </div>
          </div>
        )}


        {/* Menu Items */}
        <div className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
          {!sidebarCollapsed && (
            <span className="block px-4 mb-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Điều hành quán</span>
          )}
          <NavMenuList
            items={menuItems}
            collapsed={sidebarCollapsed}
            itemClass="flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all duration-200 group relative cursor-pointer hover:translate-x-0.5"
            activeClass="bg-md-secondary-container text-md-secondary font-bold shadow-shadow-1"
            inactiveClass="text-md-on-surface-variant hover:bg-slate-100 hover:text-md-on-surface"
            iconSize={20}
            tooltipClass="absolute left-20 bg-md-on-surface text-white text-xs px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50"
          />
        </div>

        {/* Logout Actions */}
        <div className="p-3 border-t border-md-outline-variant">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4 w-full px-4 py-3 text-red-500 rounded-radius-xl hover:bg-red-50 transition-colors ${
              sidebarCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span className="text-sm font-semibold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE MERCHANT NAVIGATION HEADER ───────────────────────────────────── */}
      <nav className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-md-outline-variant bg-white flex items-center justify-between px-4 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-md-secondary rounded-lg flex items-center justify-center text-white shadow-sm">
            <Store size={16} />
          </div>
          <span className="font-bold text-md-secondary text-sm">Merchant Hub</span>
        </div>
        <button 
          onClick={openMobileDrawer}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* ─── MOBILE BOTTOM NAV (giúp thấy rõ điều hướng, "Đơn hàng" nổi giữa) ────── */}
      <MobileTabBar
        accent="#1A73E8"
        rootPath="/merchant"
        items={[
          { ...menuItems[0], name: 'Tổng quan' },   // Dashboard
          { ...menuItems[2], name: 'Thực đơn' },    // Quản lý menu
          { ...menuItems[1], primary: true },       // Đơn hàng — nút nổi trung tâm
          menuItems[4],                             // Đánh giá
          { name: 'Thêm', icon: Menu, action: openMobileDrawer },
        ]}
      />

      {/* ─── MOBILE MERCHANT DRAWER ────────────────────────────────────────────── */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={closeMobileDrawer}
        drawerClass="w-64 max-w-xs bg-white border-l border-md-outline-variant"
      >
        {/* Header Drawer */}
        <div className="p-4 flex items-center justify-between border-b border-md-outline-variant bg-gradient-to-r from-md-secondary-container/10 to-transparent">
          <div className="flex items-center gap-3">
            <div 
              onClick={handleLogoClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi nhanh logo quán"
            >
              <img 
                src={getRestaurantBannerUrl(restaurant ? restaurant.imageUrl : "")} 
                alt="Store Avatar" 
                className="w-10 h-10 rounded-lg object-cover border border-md-secondary/20 shadow-sm group-hover:opacity-75 transition-opacity"
              />
              {uploadingLogo && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-md-on-surface truncate">
                {restaurant ? restaurant.restaurantName : "Chưa đăng ký quán"}
              </span>
              <span className="text-[8px] text-md-secondary font-bold tracking-widest uppercase mt-0.5">Đối tác Quán</span>
            </div>
          </div>
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
            activeClass="bg-md-secondary-container text-md-secondary font-bold shadow-sm"
            inactiveClass="text-md-on-surface-variant hover:bg-slate-100 hover:text-md-on-surface"
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

      {/* ─── MAIN MERCHANT VIEWPORT ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 pb-16 md:pb-0 h-screen overflow-y-auto relative bg-slate-50">
        <Outlet />
      </main>

      <input
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => handleLogoChange(e.target.files?.[0])} 
      />
    </div>
  );
}
