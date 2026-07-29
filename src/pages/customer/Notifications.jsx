import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../stores/notificationStore';
import { Bell, Tag, CheckCircle2, ShieldAlert, Check, Clock, Bike, ShoppingBag, XCircle, Sparkles, Inbox, Compass, ChevronRight } from 'lucide-react';
import Spinner from '../../components/common/Spinner';

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'ORDER_NEW':
        return <ShoppingBag size={16} className="text-blue-500" />;
      case 'ORDER_CONFIRMED':
        return <CheckCircle2 size={16} className="text-teal-500" />;
      case 'ORDER_PREPARING':
        return <Clock size={16} className="text-orange-500" />;
      case 'ORDER_READY_PICKUP':
        return <Bell size={16} className="text-yellow-600" />;
      case 'SHIPPER_ASSIGNED':
        return <Bike size={16} className="text-indigo-500" />;
      case 'ORDER_COMPLETED':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'ORDER_CANCELLED':
        return <XCircle size={16} className="text-red-500" />;
      case 'PROMOTION':
        return <Tag size={16} className="text-orange-500" />;
      case 'SYSTEM':
        return <ShieldAlert size={16} className="text-blue-500" />;
      default:
        return <Bell size={16} className="text-slate-400" />;
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'ORDER_NEW': return 'bg-blue-50';
      case 'ORDER_CONFIRMED': return 'bg-teal-50';
      case 'ORDER_PREPARING': return 'bg-orange-50';
      case 'ORDER_READY_PICKUP': return 'bg-yellow-50';
      case 'SHIPPER_ASSIGNED': return 'bg-indigo-50';
      case 'ORDER_COMPLETED': return 'bg-emerald-50';
      case 'ORDER_CANCELLED': return 'bg-red-50';
      case 'PROMOTION': return 'bg-orange-50';
      case 'SYSTEM': return 'bg-blue-50';
      default: return 'bg-slate-50';
    }
  };

  // Nhãn danh mục (suy từ type) + màu chip — giúp lướt nhanh phân loại thông báo
  const getCategory = (type) => {
    switch (type) {
      case 'SHIPPER_ASSIGNED': return { label: 'Tài xế', cls: 'bg-indigo-50 text-indigo-600' };
      case 'PROMOTION': return { label: 'Ưu đãi', cls: 'bg-orange-50 text-orange-600' };
      case 'SYSTEM': return { label: 'Hệ thống', cls: 'bg-slate-100 text-slate-600' };
      case 'ORDER_CANCELLED': return { label: 'Đơn hàng', cls: 'bg-red-50 text-red-600' };
      case 'ORDER_COMPLETED': return { label: 'Đơn hàng', cls: 'bg-emerald-50 text-emerald-600' };
      default: return { label: 'Đơn hàng', cls: 'bg-blue-50 text-blue-600' };
    }
  };

  // Thông báo liên quan đơn hàng có refId = mã đơn → bấm vào nhảy tới trang theo dõi đơn
  const ORDER_TYPES = ['ORDER_NEW', 'ORDER_CONFIRMED', 'ORDER_PREPARING', 'ORDER_READY_PICKUP', 'SHIPPER_ASSIGNED', 'ORDER_COMPLETED', 'ORDER_CANCELLED'];
  const getLink = (n) => (n.refId && ORDER_TYPES.includes(n.type)) ? `/orders/${n.refId}` : null;

  const handleNotifClick = (n) => {
    markRead(n.id);
    const link = getLink(n);
    if (link) navigate(link);
  };

  if (loading && notifications.length === 0) {
    return <Spinner fullScreen />;
  }

  // Tách danh sách theo trạng thái đọc để nhóm "Chưa đọc" / "Đã đọc"
  const unreadList = notifications.filter((n) => !n.isRead);
  const readList = notifications.filter((n) => n.isRead);

  // Render 1 thẻ thông báo. `idx` dùng để so le hiệu ứng xuất hiện (frame-by-frame cascade).
  const renderNotification = (n, idx) => {
    const cat = getCategory(n.type);
    const link = getLink(n); // có link = bấm được để mở đơn
    return (
      <div
        key={n.id}
        onClick={() => handleNotifClick(n)}
        style={{ animationDelay: `${idx * 55}ms` }}
        className={`group relative flex gap-3.5 items-start rounded-radius-lg p-4 pr-5 border cursor-pointer overflow-hidden animate-rise-in card-float ${
          n.isRead
            ? 'bg-white border-md-outline-variant/20 hover:bg-slate-50/60'
            : 'bg-gradient-to-r from-md-primary-container/15 to-white border-md-primary/25 shadow-sm'
        }`}
      >
        {/* Thanh nhấn cạnh trái cho thông báo chưa đọc */}
        {!n.isRead && <span className="absolute left-0 top-0 bottom-0 w-1 bg-md-primary" />}

        {/* Icon theo loại thông báo — chưa đọc thì có vòng loang nhẹ */}
        <div className={`relative p-2.5 rounded-radius-md ${getIconBg(n.type)} shrink-0 transition-transform group-hover:scale-110`}>
          {!n.isRead && <span className="absolute inset-0 rounded-radius-md ring-2 ring-md-primary/30 animate-pulse-slow" />}
          {getIcon(n.type)}
        </div>

        {/* Nội dung */}
        <div className="flex-1 min-w-0">
          {/* Hàng trên: chip danh mục (trái) + thời gian (phải) tận dụng chiều ngang */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${cat.cls}`}>
              {cat.label}
            </span>
            <span className="font-label-small text-[10px] text-md-outline flex items-center gap-1 shrink-0">
              <Clock size={10} className="shrink-0" /> {n.time}
            </span>
          </div>
          <h3 className={`font-title-small text-xs sm:text-sm leading-tight text-md-on-surface ${!n.isRead ? 'font-bold' : 'font-semibold'}`}>
            {n.title}
          </h3>
          <p className="font-body-medium text-xs text-md-on-surface-variant mt-1 leading-relaxed line-clamp-2">
            {n.body}
          </p>
          {/* Gợi ý hành động cho thông báo mở được đơn */}
          {link && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-md-primary mt-2 group-hover:gap-1.5 transition-all">
              Xem đơn hàng <ChevronRight size={13} />
            </span>
          )}
        </div>

        {/* Cột phải: chấm chưa đọc hoặc mũi tên gợi ý bấm được */}
        <div className="shrink-0 self-center flex items-center">
          {!n.isRead ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-md-primary opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-md-primary" />
            </span>
          ) : link ? (
            <ChevronRight size={18} className="text-md-outline group-hover:text-md-primary group-hover:translate-x-0.5 transition-all" />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans pb-24">

      {/* ─── HERO HEADER (gradient cam, đồng bộ trang Yêu thích) ─────────────────────
          Trang trí đầu trang cho có "sức sống": chuông lớn mờ + đốm lấp lánh + vệt sáng chạy. */}
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-md-primary to-[#FF8C42] text-white p-6 md:p-7 mb-7 shadow-shadow-2 animate-rise-in">
        {/* Hoạ tiết nền */}
        <Bell className="absolute -right-5 -bottom-6 text-white/10 fill-white/10" size={140} strokeWidth={1} />
        <Sparkles className="absolute right-28 top-5 text-white/20 animate-twinkle" size={22} />
        <Sparkles className="absolute right-10 bottom-6 text-white/15 animate-twinkle" size={14} style={{ animationDelay: '900ms' }} />
        {/* Vệt sáng quét ngang */}
        <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
              <Bell size={11} className="fill-white" /> Trung tâm thông báo
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight flex items-center gap-2.5">
              Thông báo
              {unreadCount > 0 && (
                <span className="bg-white text-md-primary text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm animate-scale-up">
                  {unreadCount} mới
                </span>
              )}
            </h1>
            <p className="text-sm text-white/85 font-semibold mt-1.5 max-w-md leading-relaxed">
              Cập nhật trạng thái đơn hàng và ưu đãi mới nhất dành cho bạn.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-radius-full text-xs font-extrabold bg-white text-md-primary shadow-shadow-2 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Check size={15} />
              Đọc tất cả
            </button>
          )}
        </div>
      </div>

      {/* Notifications list — nhóm "Chưa đọc" / "Đã đọc" */}
      {notifications.length === 0 ? (
        <div className="relative overflow-hidden text-center py-14 bg-white rounded-radius-xl border border-md-outline-variant/30 animate-rise-in max-w-2xl mx-auto">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-md-primary-container/20 to-transparent pointer-events-none" />
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-md-primary-container/30 text-md-primary mb-4 animate-float">
            <Inbox size={30} />
            <Sparkles size={14} className="absolute -top-1 -right-1 text-md-primary/70 animate-twinkle" />
          </div>
          <p className="text-base font-extrabold text-md-on-surface">Chưa có thông báo nào</p>
          <p className="text-xs font-semibold text-md-on-surface-variant mt-1.5 max-w-xs mx-auto leading-relaxed">
            Các cập nhật đơn hàng và ưu đãi sẽ xuất hiện tại đây.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-radius-full text-sm font-extrabold bg-md-primary text-white shadow-shadow-2 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Compass size={16} /> Khám phá quán ăn
          </button>
        </div>
      ) : (
        // 2 cột trên desktop: feed thông báo (rộng) + cột phụ tổng quan/phân loại để lấp khoảng trống
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

          {/* ─── CỘT FEED (chính) ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {unreadList.length > 0 && (
              <div>
                <h2 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-md-primary animate-pulse" />
                  Chưa đọc
                  <span className="text-md-primary">({unreadList.length})</span>
                </h2>
                <div className="space-y-3">{unreadList.map((n, i) => renderNotification(n, i))}</div>
              </div>
            )}
            {readList.length > 0 && (
              <div>
                <h2 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  Đã đọc
                </h2>
                {/* Nối tiếp delay sau nhóm chưa đọc để cascade liền mạch */}
                <div className="space-y-3">{readList.map((n, i) => renderNotification(n, unreadList.length + i))}</div>
              </div>
            )}
          </div>

          {/* ─── CỘT PHỤ (chỉ desktop, dính theo cuộn) — tổng quan + phân loại + truy cập nhanh ─── */}
          <aside className="hidden lg:flex flex-col gap-4 lg:sticky lg:top-8 animate-rise-in" style={{ animationDelay: '120ms' }}>

            {/* Tổng quan (số liệu thật) */}
            <div className="bg-white rounded-radius-xl border border-md-outline-variant/20 shadow-sm p-5">
              <h3 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-4">Tổng quan</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-extrabold text-md-on-surface tabular-nums leading-none">{notifications.length}</p>
                  <p className="text-[10px] font-semibold text-md-on-surface-variant mt-1">Tổng</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-md-primary tabular-nums leading-none">{unreadList.length}</p>
                  <p className="text-[10px] font-semibold text-md-on-surface-variant mt-1">Chưa đọc</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-emerald-500 tabular-nums leading-none">{readList.length}</p>
                  <p className="text-[10px] font-semibold text-md-on-surface-variant mt-1">Đã đọc</p>
                </div>
              </div>
              {unreadList.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-radius-full text-xs font-extrabold bg-md-primary-container/40 text-md-primary hover:bg-md-primary-container/60 transition-all cursor-pointer"
                >
                  <Check size={14} /> Đánh dấu đã đọc tất cả
                </button>
              )}
            </div>

            {/* Truy cập nhanh */}
            <div className="bg-white rounded-radius-xl border border-md-outline-variant/20 shadow-sm p-5">
              <h3 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3">Truy cập nhanh</h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/orders')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-radius-lg text-sm font-bold text-md-on-surface hover:bg-md-primary-container/20 transition-all cursor-pointer group"
                >
                  <span className="p-1.5 rounded-radius-md bg-blue-50 text-blue-600"><ShoppingBag size={15} /></span>
                  Đơn hàng của tôi
                  <ChevronRight size={15} className="ml-auto text-md-outline group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => navigate('/explore')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-radius-lg text-sm font-bold text-md-on-surface hover:bg-md-primary-container/20 transition-all cursor-pointer group"
                >
                  <span className="p-1.5 rounded-radius-md bg-orange-50 text-md-primary"><Compass size={15} /></span>
                  Khám phá quán ăn
                  <ChevronRight size={15} className="ml-auto text-md-outline group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}
