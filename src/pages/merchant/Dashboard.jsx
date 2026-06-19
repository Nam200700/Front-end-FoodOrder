import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Check, X, ShieldAlert, Sparkles, TrendingUp, Star, DollarSign, PackageOpen } from 'lucide-react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { useFetchData } from '../../hooks/useFetchData';
import { useModalState } from '../../hooks/useModalState';

const REVENUE_DATA = [
  { day: 'T2', amount: 850000 },
  { day: 'T3', amount: 1100000 },
  { day: 'T4', amount: 950000 },
  { day: 'T5', amount: 1200000 },
  { day: 'T6', amount: 1450000 },
  { day: 'T7', amount: 2100000 },
  { day: 'CN', amount: 2450000 },
];

export default function MerchantDashboard() {
  const navigate = useNavigate();

  // Fetch thông tin nhà hàng qua useFetchData
  const { data: restaurant, loading: loadingRes, refetch: refetchRes, error: resError } = useFetchData('/merchant/restaurant');
  const restaurantId = restaurant ? (restaurant.restaurantId || restaurant.id) : null;
  const noRestaurant = resError?.response?.status === 404;

  // Fetch các dữ liệu liên quan qua useFetchData
  const { data: pendingOrdersData, loading: loadingPending, refetch: refetchPending } = useFetchData(
    restaurantId ? `/merchant/orders?restaurantId=${restaurantId}&status=PENDING` : null,
    {
      mapFn: (data) => (data?.content || []).map(ord => {
        const createdAtTime = new Date(ord.createdAt).getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        const diffMs = (createdAtTime + tenMinutesMs) - Date.now();
        const timeLeftSec = Math.max(0, Math.floor(diffMs / 1000));
        return {
          id: ord.orderId.toString(),
          name: ord.customerName || 'Khách hàng',
          itemsCount: (ord.items || []).reduce((sum, item) => sum + item.quantity, 0),
          total: Number(ord.totalAmount),
          time: new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeLeft: timeLeftSec
        };
      })
    }
  );

  const { data: allOrdersData, loading: loadingAll, refetch: refetchAll } = useFetchData(
    restaurantId ? `/merchant/orders?restaurantId=${restaurantId}&size=2000` : null
  );

  const { data: reviewsData, loading: loadingReviews, refetch: refetchReviews } = useFetchData(
    restaurantId ? `/restaurants/${restaurantId}/reviews` : null
  );

  const { data: statsData, loading: loadingStats, refetch: refetchStats } = useFetchData(
    restaurantId ? `/merchant/stats?restaurantId=${restaurantId}` : null
  );

  const loading = loadingRes || (restaurantId && (loadingPending || loadingAll || loadingReviews || loadingStats));

  const refetchAllData = useCallback(() => {
    refetchRes();
    refetchPending();
    refetchAll();
    refetchReviews();
    refetchStats();
  }, [refetchRes, refetchPending, refetchAll, refetchReviews, refetchStats]);

  const [pendingOrders, setPendingOrders] = useState([]);

  // Đồng bộ pendingOrdersData sang local state để quản lý countdown
  useEffect(() => {
    if (pendingOrdersData) {
      setPendingOrders(pendingOrdersData);
    }
  }, [pendingOrdersData]);

  const allOrders = useMemo(() => allOrdersData?.content || allOrdersData || [], [allOrdersData]);
  const completedOrders = useMemo(() => allOrders.filter(ord => ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED'), [allOrders]);

  // Tính toán thống kê động qua useMemo
  const stats = useMemo(() => {
    if (!statsData) return null;
    return {
      revenue: Number(statsData.revenue || 0),
      subtotal: Number(statsData.subtotal || 0),
      commission: Number(statsData.commission || 0),
      commissionRate: Number(statsData.commissionRate || 0.10),
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: allOrders.filter(ord => ord.orderStatus === 'CANCELLED').length
    };
  }, [statsData, allOrders, completedOrders]);

  const revenueData = useMemo(() => {
    const daysMap = { 'Monday': 'T2', 'Tuesday': 'T3', 'Wednesday': 'T4', 'Thursday': 'T5', 'Friday': 'T6', 'Saturday': 'T7', 'Sunday': 'CN' };
    const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const tempRevenue = { 'T2': 0, 'T3': 0, 'T4': 0, 'T5': 0, 'T6': 0, 'T7': 0, 'CN': 0 };

    completedOrders.forEach(ord => {
      const date = new Date(ord.createdAt);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const mappedDay = daysMap[dayName];
      if (mappedDay) {
        const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
          ? Number(ord.subtotalAmount)
          : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
        tempRevenue[mappedDay] += sub;
      }
    });

    return daysOfWeek.map(day => ({
      day,
      amount: tempRevenue[day]
    }));
  }, [completedOrders]);

  const topFoods = useMemo(() => {
    const foodSalesMap = {};
    completedOrders.forEach(ord => {
      const items = ord.items || [];
      items.forEach(item => {
        const foodName = item.foodName;
        const quantity = Number(item.quantity || 0);
        foodSalesMap[foodName] = (foodSalesMap[foodName] || 0) + quantity;
      });
    });

    const sortedFoods = Object.keys(foodSalesMap)
      .map(name => ({
        name,
        count: foodSalesMap[name]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const maxCount = sortedFoods.length > 0 ? sortedFoods[0].count : 1;
    const colorClasses = ['bg-md-primary', 'bg-md-secondary', 'bg-md-tertiary', 'bg-purple-500'];
    return sortedFoods.map((f, idx) => ({
      name: f.name,
      count: `${f.count} phần`,
      pct: `${Math.round((f.count / maxCount) * 100)}%`,
      color: colorClasses[idx % colorClasses.length]
    }));
  }, [completedOrders]);

  const reviews = useMemo(() => reviewsData?.content || reviewsData || [], [reviewsData]);
  const reviewsCount = reviews.length;
  const averageRating = useMemo(() => {
    return reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.restaurantRating || 0), 0) / reviews.length).toFixed(1)
      : '0.0';
  }, [reviews]);

  // Modal states dùng useModalState
  const rejectModal = useModalState();
  const [rejectReason, setRejectReason] = useState('');
  const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Countdown timer cho các đơn hàng đang hiển thị
  useEffect(() => {
    if (pendingOrders.length === 0) return;
    const timer = setInterval(() => {
      setPendingOrders((prev) =>
        prev
          .map((order) => ({ ...order, timeLeft: order.timeLeft > 0 ? order.timeLeft - 1 : 0 }))
          .filter((order) => order.timeLeft > 0)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOrders]);

  const handleAccept = async (orderId) => {
    try {
      setSubmitting(true);
      await apiClient.patch(`/merchant/orders/${orderId}/confirm`);
      toast.success(`Đã xác nhận chuẩn bị đơn hàng #${orderId}!`);
      refetchPending();
      refetchAll();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xác nhận đơn hàng này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = (orderId) => {
    setRejectReason('');
    rejectModal.open(orderId);
  };

  const handleRejectConfirm = async () => {
    const orderId = rejectModal.data;
    if (!orderId || !rejectReason.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối!');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.patch(`/merchant/orders/${orderId}/reject`, { cancelReason: rejectReason.trim() });
      toast.success(`Đã từ chối đơn hàng #${orderId} với lý do: "${rejectReason.trim()}"`);
      rejectModal.close();
      refetchPending();
      refetchAll();
    } catch (err) {
      console.error(err);
      toast.error('Không thể từ chối đơn hàng này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClick = () => {
    setConfirmToggleStatus(true);
  };

  const handleToggleRestaurantStatus = async () => {
    setConfirmToggleStatus(false);
    const nextStatus = restaurant.status ? 'SELF_CLOSED' : 'ACTIVE';
    try {
      setSubmitting(true);
      const res = await apiClient.patch(`/merchant/restaurant/status?status=${nextStatus}`);
      if (res.data?.data) {
        toast.success('Cập nhật trạng thái hoạt động của quán thành công!');
        refetchRes();
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái hoạt động.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeLeft = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading && !restaurant && !noRestaurant) {
    return <Spinner fullScreen />;
  }

  if (noRestaurant) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để bắt đầu kinh doanh.</p>
        <button
          onClick={() => navigate('/merchant/settings')}
          className="mt-6 bg-md-secondary text-white font-bold px-6 py-2.5 rounded-radius-lg shadow-sm hover:scale-105 transition-all text-xs"
        >
          Đăng ký ngay
        </button>
      </div>
    );
  }

  // Thống kê động
  const displayRevenue = stats ? stats.subtotal : 0;
  const displayTotalOrders = stats ? stats.totalOrders : 0;
  const displayCompletedOrders = stats ? stats.completedOrders : 0;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full font-google-sans space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            Xin chào, {restaurant.restaurantName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-1">Cửa hàng của bạn hoạt động trên cổng API động</p>
        </div>
        
        <button
          onClick={handleToggleClick}
          disabled={loading}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold w-max self-start sm:self-center shadow-sm transition-all duration-200 cursor-pointer ${
            restaurant.status
              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-500/20'
          }`}
          title="Click để đóng hoặc mở cửa quán ăn"
        >
          <span className={`w-2 h-2 rounded-full inline-block ${restaurant.status ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
          <span>{restaurant.status ? 'QUÁN ĐANG MỞ CỬA' : 'QUÁN ĐANG ĐÓNG CỬA'}</span>
        </button>
      </div>

      {/* THỐNG KÊ HÔM NAY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Doanh thu món ăn', value: formatCurrency(displayRevenue), change: `Thực nhận: ${formatCurrency(stats?.revenue || 0)} (đã trừ ${stats ? Math.round(stats.commissionRate * 100) : 10}% hoa hồng)`, icon: DollarSign, color: 'bg-md-primary/10 text-md-primary' },
          { title: 'Đơn mới chờ duyệt', value: pendingOrders.length + ' đơn', change: 'Đang đợi bạn bấm nhận', icon: ClipboardList, color: 'bg-md-secondary/10 text-md-secondary' },
          { title: 'Tổng đơn hoàn tất', value: displayCompletedOrders + ' đơn', change: `Tỉ lệ trên tổng ${displayTotalOrders} đơn`, icon: PackageOpen, color: 'bg-md-tertiary/10 text-md-tertiary' },
          { title: 'Đánh giá trung bình', value: `${averageRating} ★`, change: `Từ ${reviewsCount} đánh giá`, icon: Star, color: 'bg-amber-100 text-amber-600' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex items-center gap-3">
              <div className={`p-2.5 rounded-radius-md shrink-0 ${item.color}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block truncate uppercase tracking-wider">{item.title}</span>
                <span className="text-sm sm:text-base font-bold text-slate-800 block mt-0.5">{item.value}</span>
                <span className="text-[9px] text-slate-500 font-medium block mt-0.5">{item.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ĐƠN ĐANG CHỜ XỬ LÝ (Countdown Timer) */}
      <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
            <ClipboardList className="text-md-secondary" size={18} />
            Đơn đang chờ xác nhận ({pendingOrders.length})
          </h2>
          <button 
            onClick={() => navigate('/merchant/orders')}
            className="text-xs font-bold text-md-secondary hover:underline"
          >
            Quản lý đơn →
          </button>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-semibold">
            🎉 Tuyệt vời! Không còn đơn hàng nào đang chờ duyệt.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingOrders.map((order) => {
              const isUrgent = order.timeLeft < 120; // Dưới 2 phút thì gấp (chuyển đỏ)
              return (
                <div 
                  key={order.id}
                  className={`rounded-radius-xl p-4 border transition-all flex flex-col justify-between ${
                    isUrgent 
                      ? 'border-md-error bg-md-error-container/10 ring-1 ring-md-error/5' 
                      : 'border-slate-200/60 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-800">
                          #{order.id} • {order.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Đặt lúc: {order.time} • {order.itemsCount} phần ăn
                      </span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm inline-flex items-center gap-1 ${
                      isUrgent 
                        ? 'bg-md-error text-white animate-pulse' 
                        : 'bg-md-primary/10 text-md-primary'
                    }`}>
                      ⏰ Còn {formatTimeLeft(order.timeLeft)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                    <span className="text-xs font-bold text-slate-800">
                      Tổng tiền: {formatCurrency(order.total)}
                    </span>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectClick(order.id)}
                        className="p-1.5 rounded-radius-full border border-md-error/30 text-md-error hover:bg-md-error/10 transition-colors"
                        title="Từ chối đơn"
                      >
                        <X size={15} />
                      </button>
                      <button
                        onClick={() => handleAccept(order.id)}
                        className="px-3.5 py-1.5 rounded-radius-full bg-md-secondary text-white font-bold text-xs shadow-sm hover:scale-105 transition-all flex items-center gap-1"
                      >
                        <Check size={12} className="stroke-[3px]" />
                        Xác nhận
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BIỂU ĐỒ DOANH THU & TOP MÓN BÁN CHẠY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart Doanh thu 7 ngày */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="text-md-secondary" size={18} />
              Biểu đồ doanh thu tuần này (Thống kê thực tế)
            </h3>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">
              Doanh thu ẩm thực tuần này
            </span>
          </div>

          <div className="h-64 w-full text-xs">
            <RevenueAreaChart
              data={revenueData}
              dataKey="amount"
              xKey="day"
              color="#1A73E8"
              height={256}
              yTickFormatter={(v) => `${v/1000}k`}
            />
          </div>
        </div>

        {/* Top Món Ăn Bán Chạy */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Sparkles className="text-amber-500" size={18} />
              Top món bán chạy nhất
            </h3>
            
            <div className="space-y-4">
              {topFoods.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  Chưa bán được món ăn nào trong tuần này.
                </div>
              ) : (
                topFoods.map((item, idx) => (
                  <div key={idx} className="text-xs font-bold">
                    <div className="flex justify-between items-center font-bold mb-1">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="text-slate-500 font-extrabold">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: item.pct }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button 
            onClick={() => navigate('/merchant/menu')}
            className="w-full border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2.5 rounded-radius-lg text-xs transition-colors mt-6 text-center"
          >
            Quản lý thực đơn
          </button>
        </div>

      </div>

      {/* Confirm đóng/mở cửa hàng */}
      {restaurant && (
        <ConfirmDialog
          isOpen={confirmToggleStatus}
          onClose={() => setConfirmToggleStatus(false)}
          onConfirm={handleToggleRestaurantStatus}
          title={restaurant.status ? "Tạm đóng cửa quán" : "Mở cửa quán trở lại"}
          message={
            restaurant.status 
              ? "Bạn có chắc chắn muốn TẠM ĐÓNG CỬA quán ăn không? Khách hàng sẽ không thể tìm thấy và đặt món từ quán của bạn."
              : "Bạn có muốn MỞ CỬA quán ăn trở lại để tiếp tục đón khách không?"
          }
          confirmLabel={restaurant.status ? "Tạm đóng cửa" : "Mở cửa"}
          danger={restaurant.status}
          loading={submitting}
        />
      )}

      {/* Modal từ chối đơn hàng (thay window.prompt) */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => rejectModal.close()}
        title={`Từ chối đơn hàng #${rejectModal.data}`}
        size="sm"
      >
        <div className="space-y-4 font-google-sans">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Lý do từ chối (Bắt buộc)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-md-primary text-slate-800"
              rows={3}
              placeholder="Nhập lý do từ chối..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => rejectModal.close()}
              disabled={submitting}
              size="sm"
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              loading={submitting}
              disabled={!rejectReason.trim()}
              size="sm"
            >
              Từ chối đơn
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}