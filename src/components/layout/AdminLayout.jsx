import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  BarChart3,
  Store,
  Bike,
  Users,
  Package,
  AlertTriangle,
  LineChart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Menu,
  X,
  Shield
} from 'lucide-react';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useLayoutNav } from '../../hooks/useLayoutNav';
import NavMenuList from './NavMenuList';
import MobileDrawer from './MobileDrawer';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const {
    sidebarCollapsed,
    drawerOpen: isMobileDrawerOpen,
    toggleSidebar,
    openDrawer: openMobileDrawer,
    closeDrawer: closeMobileDrawer
  } = useLayoutNav('admin-sidebar-collapsed');

  const expanded = !sidebarCollapsed;

  useEffect(() => {
    closeMobileDrawer();
  }, [location.pathname, closeMobileDrawer]);
  const [theme, setTheme] = useState(localStorage.getItem('admin-theme') || 'light');

  const [pendingResCount, setPendingResCount] = useState(0);
  const [pendingShipperCount, setPendingShipperCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('admin-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [usersRes, reportsRes] = await Promise.all([
          apiClient.get('/admin/users?size=100'),
          apiClient.get('/admin/reports?status=PENDING')
        ]);
        
        const allUsers = usersRes.data?.data?.content || [];
        const pendingOwners = allUsers.filter(u => (u.role === 'OWNER' || u.role === 'MERCHANT') && !u.status).length;
        const pendingShippers = allUsers.filter(u => u.role === 'SHIPPER' && !u.status).length;
        
        setPendingResCount(pendingOwners);
        setPendingShipperCount(pendingShippers);
        setReportCount(reportsRes.data?.data?.totalElements || 0);
      } catch (err) {
        console.warn('Lỗi khi tải số lượng chờ duyệt trên Sidebar:', err);
      }
    };
    fetchCounts();
  }, [location.pathname]);

  const menuItems = [
    { path: '/admin', name: 'Dashboard', icon: BarChart3, end: true },
    { path: '/admin/restaurants', name: 'Quản lý quán', icon: Store, badge: pendingResCount },
    { path: '/admin/shippers', name: 'Quản lý shipper', icon: Bike, badge: pendingShipperCount },
    { path: '/admin/users', name: 'Tài khoản', icon: Users },
    { path: '/admin/orders', name: 'Tất cả đơn', icon: Package },
    { path: '/admin/vouchers', name: 'Voucher', icon: Package },
    { path: '/admin/reports', name: 'Báo cáo vi phạm', icon: AlertTriangle, badge: reportCount },
    { path: '/admin/stats', name: 'Thống kê hệ thống', icon: LineChart },
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
    <div className={`min-h-screen flex flex-col md:flex-row font-google-sans transition-colors duration-250 ${
      theme === 'light' ? 'theme-light bg-slate-50 text-slate-800' : 'bg-slate-900 text-slate-100'
    }`}>
      
      {/* ─── ADMIN SIDE DRAWER ─────────────────────────────────────────────────── */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 relative z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3 top-8 bg-slate-950 border border-slate-800 rounded-full p-1 text-slate-400 hover:text-purple-400 shadow-shadow-1 hover:scale-115 transition-transform"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo / Brand */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-850">
          {/* Logo admin: icon khiên thay cho emoji 🛡️, đồng bộ bản sắc tím */}
          <div className="w-10 h-10 bg-purple-650 rounded-radius-md flex items-center justify-center text-white shadow-shadow-2">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-purple-400 text-base leading-none">Admin Panel</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase mt-1">Hệ thống Admin</span>
            </div>
          )}
        </div>

        {/* Admin profile quick card */}
        {!sidebarCollapsed && user && (
          <div className="p-4 mx-3 my-4 bg-purple-950/20 rounded-radius-lg border border-purple-900/30 flex items-center gap-3">
            <div 
              onClick={handleAvatarClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi ảnh đại diện nhanh"
            >
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt="Admin Avatar" 
                className="w-10 h-10 rounded-radius-full border border-purple-550 object-cover group-hover:opacity-75 transition-opacity"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-radius-full flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-200 truncate">{user.name}</span>
              <span className="text-[10px] bg-purple-900 text-purple-300 font-bold px-1.5 py-0.5 rounded-full w-max mt-1">
                Root Admin
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          <NavMenuList
            items={menuItems}
            collapsed={sidebarCollapsed}
            itemClass="flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all duration-200 group relative cursor-pointer"
            activeClass="bg-purple-900/30 text-purple-400 font-bold border border-purple-900/20 shadow-lg"
            inactiveClass="text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            iconSize={20}
            tooltipClass="absolute left-20 bg-slate-950 text-slate-100 text-xs px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 border border-slate-800"
          />
        </div>

        {/* Theme Switcher Action */}
        <div className="p-3 border-t border-slate-850">
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all cursor-pointer ${
              theme === 'light' 
                ? 'text-amber-600 hover:bg-slate-100' 
                : 'text-amber-400 hover:bg-slate-900'
            } ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            title="Chuyển đổi giao diện"
          >
            {theme === 'light' ? (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                {!sidebarCollapsed && <span className="text-sm font-semibold">Chế độ sáng</span>}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                {!sidebarCollapsed && <span className="text-sm font-semibold">Chế độ tối</span>}
              </>
            )}
          </button>
        </div>

        {/* Logout Action */}
        <div className="p-3 border-t border-slate-850">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4 w-full px-4 py-3 text-red-400 rounded-radius-xl hover:bg-red-950/20 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span className="text-sm font-semibold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE ADMIN NAVIGATION HEADER ─────────────────────────────────────── */}
      <nav className={`md:hidden fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-4 z-40 shadow-md ${
        theme === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'
      }`}>
        <div className="flex items-center gap-2">
          {/* Logo admin trên header mobile: icon khiên thay emoji 🛡️ */}
          <div className="w-8 h-8 bg-purple-650 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Shield size={16} strokeWidth={2.5} />
          </div>
          <span className={`font-bold text-sm ${theme === 'light' ? 'text-purple-650' : 'text-purple-400'}`}>Admin Panel</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Theme switcher on header */}
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-full transition-all cursor-pointer ${
              theme === 'light' ? 'text-amber-600 hover:bg-slate-100' : 'text-amber-400 hover:bg-slate-900'
            }`}
            title="Chuyển đổi giao diện"
          >
            {theme === 'light' ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          <button 
            onClick={openMobileDrawer}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-900 text-slate-400'
            }`}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>



      {/* ─── MOBILE ADMIN DRAWER ────────────────────────────────────────────── */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={closeMobileDrawer}
        drawerClass={`w-64 max-w-xs bg-white border-l transition-colors duration-250 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}
      >
        {/* Header Drawer */}
        <div className={`p-4 flex items-center justify-between border-b ${
          theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-850 bg-slate-900/40'
        }`}>
          <div className="flex items-center gap-3">
            <div 
              onClick={handleAvatarClick}
              className="relative cursor-pointer group shrink-0"
              title="Click để đổi ảnh đại diện nhanh"
            >
              <img 
                src={getAvatarUrl(user?.avatar)} 
                alt="Admin Avatar" 
                className="w-10 h-10 rounded-full object-cover border border-purple-550 shadow-sm group-hover:opacity-75 transition-opacity"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-bold truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                {user?.name || 'Admin'}
              </span>
              <span className="text-[8px] text-purple-400 font-bold tracking-widest uppercase mt-0.5">Root Admin</span>
            </div>
          </div>
          <button 
            onClick={closeMobileDrawer}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'light' ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-900 text-slate-400'
            }`}
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
            activeClass="bg-purple-900/30 text-purple-400 font-bold border border-purple-900/20 shadow-sm"
            inactiveClass={theme === 'light' ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}
            iconSize={18}
            onItemClick={closeMobileDrawer}
          />
        </div>

        {/* Logout button */}
        <div className={`p-3 border-t ${
          theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-850 bg-slate-900/20'
        }`}>
          <button
            onClick={() => {
              closeMobileDrawer();
              handleLogout();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-950/20 rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </MobileDrawer>

      {/* ─── MAIN ADMIN PORT ───────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col min-w-0 pt-16 md:pt-0 h-screen overflow-y-auto relative transition-colors duration-250 ${
        theme === 'light' ? 'bg-slate-50' : 'bg-slate-900'
      }`}>
        <Outlet />
      </main>

      {/* TOAST POPUP TOÀN CỤC THỜI GIAN THỰC */}
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
