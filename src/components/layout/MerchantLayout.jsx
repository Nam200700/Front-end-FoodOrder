import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useOrderStore } from '../../stores/orderStore';
import apiClient from '../../services/api';
import { getRestaurantBannerUrl } from '../../utils/avatarHelper';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  X
} from 'lucide-react';

export default function MerchantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { conversations, connectWebSocket, disconnectWebSocket } = useChatStore();
  const { orderHistory } = useOrderStore();
  const [expanded, setExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);
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
    { path: '/merchant', name: 'Dashboard', icon: BarChart3 },
    { path: '/merchant/orders', name: 'Đơn hàng', icon: ClipboardList, badge: pendingOrdersCount },
    { path: '/merchant/menu', name: 'Quản lý menu', icon: UtensilsCrossed },
    { path: '/merchant/chat', name: 'Chat', icon: MessageSquare, badge: unreadChatCount },
    { path: '/merchant/reviews', name: 'Đánh giá', icon: Star },
    { path: '/merchant/stats', name: 'Thống kê', icon: LineChart },
    { path: '/merchant/settings', name: 'Cài đặt quán', icon: Settings },
  ];

  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoClick = () => {
    if (!restaurant) {
      toast.warn("Bạn chưa đăng ký nhà hàng. Vui lòng vào Cài đặt quán để đăng ký trước!");
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleLogoChange = async (e) => {
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

    setUploadingLogo(true);
    const rId = restaurant.restaurantId || restaurant.id;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newUrl = uploadRes.data?.data?.url;
      if (!newUrl) throw new Error("Không nhận được URL ảnh!");

      try {
        await apiClient.put(`/merchant/restaurants/${rId}`, {
          restaurantName: restaurant.restaurantName,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          phone: restaurant.phone,
          description: restaurant.description,
          imageUrl: newUrl
        });
        
        // Cập nhật state cục bộ để giao diện đổi ngay lập tức
        setRestaurant(prev => prev ? { ...prev, imageUrl: newUrl } : null);
        toast.success("Cập nhật logo nhà hàng thành công! 🏪");
      } catch (dbErr) {
        console.error("Cập nhật Database thất bại:", dbErr);
        toast.error(dbErr.response?.data?.message || "Cập nhật Database thất bại. Đang giữ nguyên ảnh cũ.");
      }
    } catch (uploadErr) {
      console.error("Upload ảnh thất bại:", uploadErr);
      toast.error(uploadErr.response?.data?.message || "Lỗi khi upload ảnh lên Cloudinary!");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          expanded ? 'w-64' : 'w-20'
        }`}
      >
        <button 
          onClick={() => setExpanded(!expanded)}
          className="absolute -right-3 top-8 bg-white border border-md-outline-variant rounded-full p-1 text-md-outline hover:text-md-secondary shadow-shadow-1 hover:scale-115 transition-transform"
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Brand / Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-md-outline-variant">
          <div className="w-10 h-10 bg-md-secondary rounded-radius-md flex items-center justify-center text-white font-bold text-lg shadow-shadow-2">
            🏪
          </div>
          {expanded && (
            <div className="flex flex-col">
              <span className="font-bold text-md-secondary text-base leading-none">Merchant Hub</span>
              <span className="text-[10px] text-md-outline font-semibold tracking-wider uppercase mt-1">Cơm Tấm Ngon</span>
            </div>
          )}
        </div>

        {/* Store Profile Quick Card */}
        {expanded && user && (
          <div className="p-4 mx-3 my-4 bg-md-secondary-container/20 rounded-radius-lg border border-md-secondary/10 flex items-center gap-3">
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/merchant' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 w-full px-4 py-3 rounded-radius-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-md-secondary-container text-md-secondary font-bold shadow-shadow-1' 
                    : 'text-md-on-surface-variant hover:bg-slate-100 hover:text-md-on-surface'
                }`}
              >
                <div className="relative">
                  <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'group-hover:scale-105 transition-transform'} />
                  {item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-md-error text-white text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-shadow-1 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
                {expanded && (
                  <span className="text-sm tracking-wide">{item.name}</span>
                )}
                {!expanded && (
                  <div className="absolute left-20 bg-md-on-surface text-white text-xs px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Actions */}
        <div className="p-3 border-t border-md-outline-variant">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4 w-full px-4 py-3 text-red-500 rounded-radius-xl hover:bg-red-50 transition-colors ${
              expanded ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOut size={20} />
            {expanded && <span className="text-sm font-semibold">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE MERCHANT NAVIGATION HEADER ───────────────────────────────────── */}
      <nav className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-md-outline-variant bg-white flex items-center justify-between px-4 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-md-secondary rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
            🏪
          </div>
          <span className="font-bold text-md-secondary text-sm">Merchant Hub</span>
        </div>
        <button 
          onClick={() => setIsMobileDrawerOpen(true)}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* ─── MOBILE MERCHANT DRAWER ────────────────────────────────────────────── */}
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
                const isActive = location.pathname === item.path || (item.path !== '/merchant' && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-md-secondary-container text-md-secondary font-bold shadow-sm' 
                        : 'text-md-on-surface-variant hover:bg-slate-100 hover:text-md-on-surface'
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

      {/* ─── MAIN MERCHANT VIEWPORT ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 h-screen overflow-y-auto relative bg-slate-50">
        <Outlet />
      </main>

      <ToastContainer />
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleLogoChange} 
      />
    </div>
  );
}
