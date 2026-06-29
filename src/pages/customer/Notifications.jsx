import React, { useEffect } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { Bell, Tag, CheckCircle2, ShieldAlert, Check, Clock, Bike, ShoppingBag, XCircle } from 'lucide-react';
import Spinner from '../../components/common/Spinner';

export default function Notifications() {
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

  if (loading && notifications.length === 0) {
    return <Spinner fullScreen />;
  }

  // Tách danh sách theo trạng thái đọc để nhóm "Chưa đọc" / "Đã đọc"
  const unreadList = notifications.filter((n) => !n.isRead);
  const readList = notifications.filter((n) => n.isRead);

  // Render 1 thẻ thông báo (tách ra để tái dùng cho cả 2 nhóm)
  const renderNotification = (n) => (
    <div
      key={n.id}
      onClick={() => markRead(n.id)}
      className={`bg-white rounded-radius-lg p-4 border transition-all cursor-pointer relative flex gap-3.5 items-start ${
        n.isRead
          ? 'border-md-outline-variant/20 hover:bg-slate-50/50'
          : 'border-md-primary/20 ring-1 ring-md-primary/5 hover:bg-md-primary-container/5 shadow-sm'
      }`}
    >
      {/* Icon theo loại thông báo */}
      <div className={`p-2.5 rounded-radius-md ${getIconBg(n.type)} shrink-0`}>
        {getIcon(n.type)}
      </div>
      {/* Nội dung */}
      <div className="flex-1 min-w-0 pr-4">
        <h3 className={`font-title-small text-xs sm:text-sm leading-tight text-md-on-surface ${!n.isRead ? 'font-bold' : ''}`}>
          {n.title}
        </h3>
        <p className="font-body-medium text-xs text-md-on-surface-variant mt-1.5 leading-relaxed line-clamp-2">
          {n.body}
        </p>
        <span className="font-label-small text-[10px] text-md-outline mt-2.5 block">
          {n.time}
        </span>
      </div>
      {/* Chấm cam báo chưa đọc */}
      {!n.isRead && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-md-primary animate-pulse shrink-0" />
      )}
    </div>
  );

  return (
    <div className="flex-1 p-4 md:p-8 max-w-xl mx-auto w-full font-google-sans pb-24">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="text-md-primary" size={24} />
          <h1 className="text-xl font-bold text-md-on-surface">Thông báo</h1>
          {unreadCount > 0 && (
            <span className="bg-md-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount} mới
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button 
            onClick={markAllRead}
            className="text-xs font-bold text-md-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Check size={14} />
            Đọc tất cả
          </button>
        )}
      </div>

      {/* Notifications list — nhóm "Chưa đọc" / "Đã đọc" */}
      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-radius-xl border border-md-outline-variant/30">
          <Bell size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-md-on-surface-variant">Không có thông báo nào</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unreadList.length > 0 && (
            <div>
              <h2 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3">
                Chưa đọc ({unreadList.length})
              </h2>
              <div className="space-y-3">{unreadList.map(renderNotification)}</div>
            </div>
          )}
          {readList.length > 0 && (
            <div>
              <h2 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3">
                Đã đọc
              </h2>
              <div className="space-y-3">{readList.map(renderNotification)}</div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}