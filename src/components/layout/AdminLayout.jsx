import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
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
  X
} from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const [expanded, setExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);
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
    { path: '/admin', name: 'Dashboard', icon: BarChart3 },
    { path: '/admin/restaurants', name: 'Quản lý quán', icon: Store, badge: pendingResCount },
    { path: '/admin/shippers', name: 'Quản lý shipper', icon: Bike, badge: pendingShipperCount },
    { path: '/admin/users', name: 'Tài khoản', icon: Users },
    { path: '/admin/orders', name: 'Tất cả đơn', icon: Package },
    { path: '/admin/reports', name: 'Báo cáo vi phạm', icon: AlertTriangle, badge: reportCount },
    { path: '/admin/stats', name: 'Thống kê hệ thống', icon: LineChart },
  ];

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
          expanded ? 'w-64' : 'w-20'
        }`}
      >
        <button 
          onClick={() => setExpanded(!expanded)}
          className="absolute -right-3 top-8 bg-slate-950 border border-slate-800 rounded-full p-1 text-slate-400 hover:text-purple-400 shadow-shadow-1 hover:scale-115 transition-transform"
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Logo / Brand */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-850">
          <div className="w-10 h-10 bg-purple-650 rounded-radius-md flex items-center justify-center text-white text-lg font-bold shadow-shadow-2">
            🛡️
          </div>
          {expanded && (
            <div className="flex flex-col">
              <span className="font-bold text-purple-400 text-base leading-none">Admin Panel</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase mt-1">Hệ thống tối cao</span>
            </div>
          )}
        </div>

        {/* Admin profile quick card */}
        {expanded && user && (
          <div className="p-4 mx-3 my-4 bg-purple-950/20 rounded-radius-lg border border-purple-900/30 flex items-center gap-3">
            <img 
              src={user.avatar} 
              alt="Admin Avatar" 
              className="w-10 h-10 rounded-radius-full border border-purple-550 object-cover"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-200 truncate">{user.name}</span>
              <span className="text-[10px] bg-purple-900 text-purple-300 font-bold px-1.5 py-0.5 rounded-full w-max mt-1">
                Root Admin
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-purple-900/30 text-purple-400 font-bold border border-purple-900/20 shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <div className="relative">
                  <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'group-hover:scale-105 transition-transform'} />
                  {item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-md-error text-white text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                {expanded && (
                  <span className="text-sm tracking-wide">{item.name}</span>
                )}
                {!expanded && (
                  <div className="absolute left-20 bg-slate-950 text-slate-100 text-xs px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 border border-slate-800">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Switcher Action */}
        <div className="p-3 border-t border-slate-850">
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all cursor-pointer ${
              theme === 'light' 
                ? 'text-amber-600 hover:bg-slate-100' 
                : 'text-amber-400 hover:bg-slate-900'
            } ${expanded ? 'justify-start' : 'justify-center'}`}
            title="Chuyển đổi giao diện"
          >
            {theme === 'light' ? (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                {expanded && <span className="text-sm font-semibold">Chế độ sáng</span>}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                {expanded && <span className="text-sm font-semibold">Chế độ tối</span>}
              </>
            )}
          </button>
        </div>

        {/* Logout Action */}
        <div className="p-3 border-t border-slate-850">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4 w-full px-4 py-3 text-red-400 rounded-radius-xl hover:bg-red-950/20 transition-colors cursor-pointer ${
              expanded ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOut size={20} />
            {expanded && <span className="text-sm font-semibold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE ADMIN NAVIGATION HEADER ─────────────────────────────────────── */}
      <nav className={`md:hidden fixed top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-4 z-40 shadow-md ${
        theme === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
            🛡️
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
            onClick={() => setIsMobileDrawerOpen(true)}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-900 text-slate-400'
            }`}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* ─── MOBILE ADMIN DRAWER ────────────────────────────────────────────── */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
          ></div>
          
          {/* Drawer Body */}
          <div className={`relative w-64 max-w-xs h-full shadow-xl flex flex-col z-10 animate-slide-left border-l transition-colors duration-250 ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            {/* Header Drawer */}
            <div className={`p-4 flex items-center justify-between border-b ${
              theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-850 bg-slate-900/40'
            }`}>
              <div className="flex items-center gap-3">
                <img 
                  src={user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"} 
                  alt="Admin Avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-purple-500 shadow-sm"
                />
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-bold truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                    {user?.name || 'Admin'}
                  </span>
                  <span className="text-[8px] text-purple-400 font-bold tracking-widest uppercase mt-0.5">Root Admin</span>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`p-1.5 rounded-full transition-colors ${
                  theme === 'light' ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-900 text-slate-400'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu Items list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-purple-900/30 text-purple-400 font-bold border border-purple-900/20 shadow-sm' 
                        : theme === 'light' 
                          ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' 
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    <div className="relative">
                      <Icon size={18} />
                      {item.badge > 0 && (
                        <span className="absolute -top-2 -right-2 bg-md-error text-white text-[8px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-sm">
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
            <div className={`p-3 border-t ${
              theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-850 bg-slate-900/20'
            }`}>
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-950/20 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN ADMIN PORT ───────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col min-w-0 pt-16 md:pt-0 h-screen overflow-y-auto relative transition-colors duration-250 ${
        theme === 'light' ? 'bg-slate-50' : 'bg-slate-900'
      }`}>
        <Outlet />
      </main>

    </div>
  );
}
