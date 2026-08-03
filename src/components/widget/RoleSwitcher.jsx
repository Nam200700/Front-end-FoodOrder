import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Shield, User, Store, Bike, ChevronLeft,
  Home, ClipboardList, Map, Settings, ArrowRight,
  Search, ShoppingBag, Heart, MessageSquare, BookOpen, BarChart3, Star, Wallet, Users, AlertTriangle,
  Eye, EyeOff, LogOut
} from 'lucide-react';

export default function RoleSwitcher() {
  const { role, isLoggedIn } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    return sessionStorage.getItem('demoWidgetHidden') === 'true';
  });

  // Ẩn hoàn toàn widget ở trang đăng nhập, đăng ký, duyệt hồ sơ hoặc khi chưa đăng nhập
  const authPaths = ['/login', '/register', '/partner/approval'];
  const isAuthPage = authPaths.some(path => location.pathname.startsWith(path));

  if (!isLoggedIn || isAuthPage) {
    return null;
  }

  const roles = [
    {
      id: 'CUSTOMER',
      name: 'Khách Hàng',
      desc: 'Đặt món & theo dõi',
      icon: User,
      color: 'bg-orange-500 text-white',
      activeBorder: 'border-orange-500/20 ring-2 ring-orange-500/5',
      chip: 'bg-orange-100 text-orange-600',
      linkActive: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    {
      id: 'OWNER',
      name: 'Đối Tác Quán',
      desc: 'Quản lý thực đơn & đơn',
      icon: Store,
      color: 'bg-blue-600 text-white',
      activeBorder: 'border-blue-500/20 ring-2 ring-blue-500/5',
      chip: 'bg-blue-100 text-blue-600',
      linkActive: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'SHIPPER',
      name: 'Tài Xế Giao Hàng',
      desc: 'Nhận đơn & giao nhận',
      icon: Bike,
      color: 'bg-emerald-600 text-white',
      activeBorder: 'border-emerald-500/20 ring-2 ring-emerald-500/5',
      chip: 'bg-emerald-100 text-emerald-600',
      linkActive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'ADMIN',
      name: 'Hệ Thống Admin',
      desc: 'Quản trị & phê duyệt',
      icon: Shield,
      color: 'bg-purple-600 text-white',
      activeBorder: 'border-purple-500/20 ring-2 ring-purple-500/5',
      chip: 'bg-purple-100 text-purple-600',
      linkActive: 'bg-purple-50 text-purple-700 border-purple-200',
    },
  ];

  const handleDismiss = (e) => {
    e.stopPropagation();
    setIsHidden(true);
    sessionStorage.setItem('demoWidgetHidden', 'true');
    setExpanded(false);
  };

  const handleRestore = () => {
    setIsHidden(false);
    sessionStorage.removeItem('demoWidgetHidden');
  };

  const getQuickLinks = (currentRole) => {
    switch (currentRole) {
      case 'CUSTOMER':
        return [
          { label: 'Trang chủ đặt món', path: '/', icon: Home },
          { label: 'Tìm kiếm & khám phá', path: '/explore', icon: Search },
          { label: 'Giỏ hàng của tôi', path: '/cart', icon: ShoppingBag },
          { label: 'Theo dõi đơn hàng', path: '/orders', icon: Map },
          { label: 'Danh sách yêu thích', path: '/favorites', icon: Heart },
          { label: 'Tin nhắn hỗ trợ', path: '/chat', icon: MessageSquare },
          { label: 'Thông tin cá nhân', path: '/profile', icon: User }
        ];
      case 'OWNER':
      case 'MERCHANT':
        return [
          { label: 'Bảng thống kê quán', path: '/merchant', icon: Home },
          { label: 'Quản lý đơn hàng', path: '/merchant/orders', icon: ClipboardList },
          { label: 'Quản lý thực đơn (menu)', path: '/merchant/menu', icon: BookOpen },
          { label: 'Thống kê doanh thu', path: '/merchant/stats', icon: BarChart3 },
          { label: 'Xem phản hồi/đánh giá', path: '/merchant/reviews', icon: Star },
          { label: 'Tin nhắn của quán', path: '/merchant/chat', icon: MessageSquare },
          { label: 'Cài đặt thông tin quán', path: '/merchant/settings', icon: Settings }
        ];
      case 'SHIPPER':
        return [
          { label: 'Bàn làm việc Shipper', path: '/shipper', icon: Home },
          { label: 'Lịch sử giao hàng', path: '/shipper/history', icon: ClipboardList },
          { label: 'Ví thu nhập & thống kê', path: '/shipper/earnings', icon: Wallet },
          { label: 'Tin nhắn khách hàng/quán', path: '/shipper/chat', icon: MessageSquare },
          { label: 'Hồ sơ tài xế', path: '/shipper/profile', icon: User }
        ];
      case 'ADMIN':
        return [
          { label: 'Dashboard điều hành', path: '/admin', icon: Home },
          { label: 'Quản lý cửa hàng', path: '/admin/restaurants', icon: Store },
          { label: 'Quản lý shipper', path: '/admin/shippers', icon: Bike },
          { label: 'Quản lý người dùng', path: '/admin/users', icon: Users },
          { label: 'Xem tất cả đơn hàng', path: '/admin/orders', icon: ClipboardList },
          { label: 'Xử lý báo cáo vi phạm', path: '/admin/reports', icon: AlertTriangle },
          { label: 'Thống kê toàn hệ thống', path: '/admin/stats', icon: BarChart3 }
        ];
      default:
        return [];
    }
  };

  const currentRoleObj = roles.find((r) => r.id === role) || roles[0];
  const CurrentIcon = currentRoleObj.icon;
  const quickLinks = getQuickLinks(role || 'CUSTOMER');

  // Trả về nút siêu nhỏ mờ khi người dùng chọn ẩn widget
  if (isHidden) {
    return (
      <button
        onClick={handleRestore}
        className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-[9999] w-7 h-7 rounded-full bg-slate-500/20 hover:bg-slate-500/40 text-slate-500/50 hover:text-slate-700 backdrop-blur-sm border border-slate-200/20 flex items-center justify-center cursor-pointer transition-all duration-200 opacity-40 hover:opacity-100 shadow-sm"
        title="Hiện bảng điều khiển nhanh"
      >
        <Eye size={12} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-[9999] flex flex-col items-end gap-3 font-google-sans select-none">

      {/* Expanded Panel */}
      {expanded && (
        <div className="w-[280px] backdrop-blur-xl bg-white/90 border border-slate-200/60 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] flex flex-col gap-4 animate-scale-up origin-bottom-right">

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${currentRoleObj.color}`}>
                <CurrentIcon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-none">
                  {currentRoleObj.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-none">
                  Phân hệ đang hoạt động
                </p>
              </div>
            </div>

            {/* Nút ẩn widget */}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Ẩn widget này"
            >
              <EyeOff size={14} />
            </button>
          </div>

          {/* Current Active Role Card */}
          <div className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 bg-white shadow-sm ${currentRoleObj.activeBorder}`}>
            <div className={`p-2.5 rounded-xl ${currentRoleObj.color} shrink-0`}>
              <CurrentIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h5 className="text-xs font-extrabold leading-none text-slate-800">
                  {currentRoleObj.name}
                </h5>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              </div>
              <p className="text-[9px] text-slate-400 font-medium mt-1.5 leading-tight">
                {currentRoleObj.desc}
              </p>
            </div>
          </div>

          {/* Quick Navigation Links */}
          {quickLinks.length > 0 && (
            <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-3.5 space-y-2.5 max-h-[200px] overflow-y-auto scrollbar-thin">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Liên kết đi nhanh
              </span>
              <div className="flex flex-col gap-1.5">
                {quickLinks.map((link, idx) => {
                  const LinkIcon = link.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(link.path);
                        setExpanded(false);
                      }}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      className="animate-rise-in w-full flex items-center justify-between text-left px-3 py-2 rounded-xl hover:bg-white hover:shadow-sm text-xs font-semibold text-slate-700 hover:text-slate-900 border border-transparent hover:border-slate-100 transition-all duration-200 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <LinkIcon size={14} className="text-slate-400 group-hover:text-slate-600" />
                        <span>{link.label}</span>
                      </div>
                      <ArrowRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={() => {
              logout();
              setExpanded(false);
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-200/50 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
          >
            <LogOut size={14} />
            Đăng xuất tài khoản
          </button>

        </div>
      )}

      {/* Floating Action Button (FAB) — gọn dạng tròn, chỉ bung nhãn khi hover/mở để
          không đè nội dung phía sau. Entrance 1 lần + thả trôi nhẹ (pause khi hover). */}
      <div className="animate-fab-in">
        <div className="animate-float hover:[animation-play-state:paused]">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={currentRoleObj.name}
            className={`group flex items-center h-14 min-w-14 pl-4 pr-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.18)] text-white transition-all duration-300 hover:shadow-[0_10px_34px_rgb(0,0,0,0.24)] active:scale-95 cursor-pointer border border-white/15 ${currentRoleObj.color}`}
            title={currentRoleObj.name}
          >
            <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-110">
              <CurrentIcon size={20} className={`transition-transform duration-500 ${expanded ? 'rotate-[360deg]' : ''}`} />
              <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>
            {/* Nhãn ẩn mặc định (max-w-0) → bung khi hover hoặc khi panel mở */}
            <span
              className={`text-xs font-black uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 ${
                expanded ? 'max-w-[170px] opacity-100 ml-2' : 'max-w-0 opacity-0 group-hover:max-w-[170px] group-hover:opacity-100 group-hover:ml-2'
              }`}
            >
              {currentRoleObj.name}
            </span>
            <ChevronLeft
              size={14}
              className={`shrink-0 overflow-hidden transition-all duration-300 ${
                expanded ? 'max-w-[14px] opacity-100 ml-1 rotate-180' : 'max-w-0 opacity-0 group-hover:max-w-[14px] group-hover:opacity-100 group-hover:ml-1'
              }`}
            />
          </button>
        </div>
      </div>

    </div>
  );
}
