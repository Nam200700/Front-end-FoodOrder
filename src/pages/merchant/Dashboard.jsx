import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, TrendingUp, TrendingDown, Star, DollarSign, PackageOpen,
  Users, UserPlus, Repeat, UtensilsCrossed, AlertTriangle, CheckCircle2,
  PackageX, EyeOff, ArrowRight, Sparkles, Clock, BarChart3,
} from 'lucide-react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useFetchData } from '../../hooks/useFetchData';

export default function MerchantDashboard() {
  const navigate = useNavigate();

  // Thông tin nhà hàng
  const { data: restaurant, loading: loadingRes, refetch: refetchRes, error: resError } = useFetchData('/merchant/restaurant');
  const restaurantId = restaurant ? (restaurant.restaurantId || restaurant.id) : null;
  const noRestaurant = resError?.response?.status === 404;

  // Danh sách đơn (cho biểu đồ doanh thu tuần rút gọn + top món + tỉ lệ huỷ)
  const { data: allOrdersData, loading: loadingAll } = useFetchData(
    restaurantId ? `/merchant/orders?restaurantId=${restaurantId}&size=2000` : null
  );
  // Đánh giá (fallback rating khi stats chưa có)
  const { data: reviewsData, loading: loadingReviews } = useFetchData(
    restaurantId ? `/restaurants/${restaurantId}/reviews` : null
  );
  // Báo cáo tài chính (revenue/AOV/rating toàn cục/tỉ lệ...)
  const { data: statsData, loading: loadingStats } = useFetchData(
    restaurantId ? `/merchant/stats?restaurantId=${restaurantId}` : null
  );
  // Tổng quan nghiệp vụ MỚI: xu hướng 7 ngày, giờ cao điểm, khách, sức khoẻ thực đơn
  const { data: insightsData, loading: loadingInsights } = useFetchData(
    restaurantId ? `/merchant/stats/insights?restaurantId=${restaurantId}` : null
  );

  const loading = loadingRes || (restaurantId && (loadingAll || loadingReviews || loadingStats || loadingInsights));

  const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Dữ liệu dẫn xuất ──────────────────────────────────────────────
  const allOrders = useMemo(() => allOrdersData?.content || allOrdersData || [], [allOrdersData]);
  const completedOrders = useMemo(
    () => allOrders.filter(o => o.orderStatus === 'COMPLETED' && o.paymentStatus !== 'REFUNDED'),
    [allOrders]
  );

  // Biểu đồ doanh thu tuần (rút gọn) — subtotal đơn hoàn tất theo thứ trong tuần
  const revenueData = useMemo(() => {
    const daysMap = { Monday: 'T2', Tuesday: 'T3', Wednesday: 'T4', Thursday: 'T5', Friday: 'T6', Saturday: 'T7', Sunday: 'CN' };
    const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const temp = { T2: 0, T3: 0, T4: 0, T5: 0, T6: 0, T7: 0, CN: 0 };
    completedOrders.forEach(o => {
      const mapped = daysMap[new Date(o.createdAt).toLocaleDateString('en-US', { weekday: 'long' })];
      if (mapped) {
        const sub = o.subtotalAmount != null ? Number(o.subtotalAmount) : Number(o.totalAmount || 0) - Number(o.shippingFee || 0);
        temp[mapped] += sub;
      }
    });
    return daysOfWeek.map(d => ({ day: d, amount: temp[d] }));
  }, [completedOrders]);

  // Top 3 món bán chạy (rút gọn — bản đầy đủ ở trang Thống kê)
  const topFoods = useMemo(() => {
    const map = {};
    completedOrders.forEach(o => (o.items || []).forEach(it => {
      map[it.foodName] = (map[it.foodName] || 0) + Number(it.quantity || 0);
    }));
    const sorted = Object.keys(map).map(name => ({ name, count: map[name] })).sort((a, b) => b.count - a.count).slice(0, 3);
    const max = sorted.length ? sorted[0].count : 1;
    const colors = ['bg-md-secondary', 'bg-emerald-500', 'bg-amber-500'];
    return sorted.map((f, i) => ({ name: f.name, count: `${f.count} phần`, pct: `${Math.round((f.count / max) * 100)}%`, color: colors[i % colors.length] }));
  }, [completedOrders]);

  const reviews = useMemo(() => reviewsData?.content || reviewsData || [], [reviewsData]);
  const reviewsCount = statsData?.reviewsCount ?? reviews.length;
  const averageRating = useMemo(() => {
    if (statsData && statsData.avgRating != null) return Number(statsData.avgRating).toFixed(1);
    return reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.restaurantRating || 0), 0) / reviews.length).toFixed(1) : '0.0';
  }, [statsData, reviews]);

  // Số liệu tổng quan
  const s = statsData || {};
  const ins = insightsData || {};
  const totalOrders = s.totalOrders ?? allOrders.length;
  const cancelledOrders = s.cancelledOrders ?? allOrders.filter(o => o.orderStatus === 'CANCELLED').length;
  const cancelRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
  const pendingCount = s.pendingOrders ?? 0;

  // Xu hướng 7 ngày qua vs 7 ngày trước
  const revenue7d = Number(ins.revenue7d || 0);
  const revenuePrev7d = Number(ins.revenuePrev7d || 0);
  const orders7d = Number(ins.orders7d || 0);
  const ordersPrev7d = Number(ins.ordersPrev7d || 0);

  // Xu hướng 7 ngày so với 7 ngày trước — chỉ quy ra % khi kỳ trước có dữ liệu (tránh +100% ảo)
  const trend = (cur, prev) => {
    if (prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      return { has: true, pct, dir: pct >= 0 ? 'up' : 'down' };
    }
    return { has: false, pct: 0, dir: 'flat' };
  };
  const revT = trend(revenue7d, revenuePrev7d);
  const ordT = trend(orders7d, ordersPrev7d);

  // Giờ cao điểm
  const peakData = useMemo(
    () => (ins.peakHours || []).slice().sort((a, b) => a.hour - b.hour).map(h => ({ label: `${h.hour}h`, count: h.count })),
    [ins.peakHours]
  );
  const peakHour = useMemo(
    () => (ins.peakHours || []).reduce((m, h) => (h.count > (m?.count || 0) ? h : m), null),
    [ins.peakHours]
  );

  // Khách hàng
  const uniqueCustomers = ins.uniqueCustomers || 0;
  const returningCustomers = ins.returningCustomers || 0;
  const newCustomers30d = ins.newCustomers30d || 0;
  const repeatRate = uniqueCustomers > 0 ? Math.round((returningCustomers / uniqueCustomers) * 100) : 0;

  // Sức khoẻ thực đơn
  const menuTotal = ins.menuTotal || 0;
  const menuAvailable = ins.menuAvailable || 0;
  const menuOutOfStock = ins.menuOutOfStock || 0;
  const menuHidden = ins.menuHidden || 0;
  const menuNoSales = ins.menuNoSales || 0;

  // Cảnh báo kinh doanh (chỉ hiện cái đáng lưu ý)
  const alerts = [];
  if (totalOrders >= 10 && cancelRate > 15)
    alerts.push({ type: 'warn', icon: AlertTriangle, text: `Tỷ lệ huỷ đơn đang cao (${cancelRate}%). Nên rà soát quy trình nhận đơn.` });
  if (reviewsCount > 0 && Number(averageRating) < 4)
    alerts.push({ type: 'warn', icon: Star, text: `Đánh giá trung bình đang thấp (${averageRating}★). Cần cải thiện chất lượng phục vụ.` });
  if (menuOutOfStock > 0)
    alerts.push({ type: 'info', icon: PackageX, text: `${menuOutOfStock} món đang tạm hết hàng.`, to: '/merchant/menu', action: 'Cập nhật thực đơn' });
  if (pendingCount > 0)
    alerts.push({ type: 'info', icon: ClipboardList, text: `${pendingCount} đơn đang chờ bạn xác nhận.`, to: '/merchant/orders', action: 'Xử lý ở Quản lý đơn' });

  const refetchAllData = useCallback(() => { refetchRes(); }, [refetchRes]);

  const handleToggleRestaurantStatus = async () => {
    setConfirmToggleStatus(false);
    const nextStatus = restaurant.status ? 'SELF_CLOSED' : 'ACTIVE';
    try {
      setSubmitting(true);
      const res = await apiClient.patch(`/merchant/restaurant/status?status=${nextStatus}`);
      if (res.data?.data) {
        toast.success('Cập nhật trạng thái hoạt động của quán thành công!');
        refetchAllData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái hoạt động.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !restaurant && !noRestaurant) return <Spinner fullScreen />;

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

  // KPI: số lớn = TỔNG THỂ (luôn có nghĩa), dòng phụ = xu hướng 7 ngày (kèm % khi có kỳ trước)
  const kpis = [
    { title: 'Doanh thu món', value: formatCurrency(Number(s.subtotal || 0)), icon: DollarSign, color: 'bg-emerald-100 text-emerald-600',
      foot: `7 ngày: ${formatCurrency(revenue7d)}`, pct: revT.has ? revT.pct : null, dir: revT.dir },
    { title: 'Đơn hoàn tất', value: `${s.completedOrders ?? 0} đơn`, icon: PackageOpen, color: 'bg-md-secondary/10 text-md-secondary',
      foot: `7 ngày: ${orders7d} đơn`, pct: ordT.has ? ordT.pct : null, dir: ordT.dir },
    { title: 'Giá trị đơn TB (AOV)', value: formatCurrency(Number(s.avgOrderValue || 0)), icon: BarChart3, color: 'bg-indigo-100 text-indigo-600',
      foot: 'Trung bình mỗi đơn hoàn tất', pct: null },
    { title: 'Đánh giá trung bình', value: `${averageRating} ★`, icon: Star, color: 'bg-amber-100 text-amber-600',
      foot: `Từ ${reviewsCount} đánh giá`, pct: null },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full font-google-sans space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Xin chào, {restaurant.restaurantName}</h1>
        <button
          onClick={() => setConfirmToggleStatus(true)}
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

      {/* ─── CẢNH BÁO KINH DOANH ─── */}
      <div className="space-y-2.5">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-radius-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={16} className="shrink-0" />
            Hoạt động ổn định — không có cảnh báo nào cần xử lý.
          </div>
        ) : (
          alerts.map((a, i) => {
            const Icon = a.icon;
            const warn = a.type === 'warn';
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 rounded-radius-xl border px-4 py-3 text-xs font-bold ${
                  warn ? 'border-rose-200/70 bg-rose-50 text-rose-700' : 'border-amber-200/70 bg-amber-50 text-amber-700'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{a.text}</span>
                {a.to && (
                  <button onClick={() => navigate(a.to)} className="shrink-0 inline-flex items-center gap-1 font-extrabold hover:underline cursor-pointer">
                    {a.action} <ArrowRight size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── KPI (xu hướng 7 ngày) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex items-center gap-3">
              <div className={`p-2.5 rounded-radius-md shrink-0 ${item.color}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 font-bold block truncate uppercase tracking-wider">{item.title}</span>
                <span className="text-sm sm:text-base font-bold text-slate-800 block mt-0.5">{item.value}</span>
                <span className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                  {item.pct != null && (
                    <span className={`inline-flex items-center gap-0.5 font-bold ${item.dir === 'up' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {item.dir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {item.pct >= 0 ? '+' : ''}{item.pct}%
                    </span>
                  )}
                  <span className="text-slate-500 truncate">{item.foot}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── DOANH THU (rút gọn) + GIỜ CAO ĐIỂM ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doanh thu tuần rút gọn */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="text-md-secondary" size={18} /> Doanh thu theo ngày trong tuần
            </h3>
            <button onClick={() => navigate('/merchant/stats')} className="text-[11px] font-bold text-md-secondary hover:underline inline-flex items-center gap-1">
              Xem chi tiết ở Thống kê <ArrowRight size={12} />
            </button>
          </div>
          <div className="h-64 w-full text-xs">
            <RevenueAreaChart data={revenueData} dataKey="amount" xKey="day" color="#10B981" height={256} yTickFormatter={(v) => `${v / 1000}k`} />
          </div>
        </div>

        {/* Giờ cao điểm */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="text-md-secondary" size={18} /> Giờ cao điểm
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mb-3">
            {peakHour ? <>Đông nhất lúc <span className="text-md-secondary font-extrabold">{peakHour.hour}h–{peakHour.hour + 1}h</span> ({peakHour.count} đơn)</> : 'Theo số đơn hoàn tất trong ngày'}
          </p>
          <div className="flex-1 min-h-[190px] text-xs">
            {peakData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs font-semibold">
                Chưa có đủ dữ liệu giờ cao điểm.
              </div>
            ) : (
              <RevenueAreaChart data={peakData} dataKey="count" xKey="label" color="#1A73E8" height={200} chartType="bar" yTickFormatter={(v) => `${v}`} />
            )}
          </div>
        </div>
      </div>

      {/* ─── KHÁCH HÀNG + THỰC ĐƠN + TOP MÓN ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Khách hàng: mới vs quay lại */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Users className="text-md-secondary" size={18} /> Khách hàng
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Đã mua', value: uniqueCustomers, icon: Users, color: 'text-slate-700' },
              { label: 'Quay lại', value: returningCustomers, icon: Repeat, color: 'text-md-secondary' },
              { label: 'Mới 30 ngày', value: newCustomers30d, icon: UserPlus, color: 'text-emerald-600' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-radius-lg bg-slate-50 border border-slate-100 p-2.5 text-center">
                  <Icon size={15} className={`mx-auto mb-1 ${c.color}`} />
                  <div className={`text-base font-extrabold ${c.color}`}>{c.value}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{c.label}</div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
            <span>Tỷ lệ khách quay lại</span>
            <span className="text-md-secondary font-extrabold">{repeatRate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-md-secondary transition-all duration-500" style={{ width: `${repeatRate}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">
            Khách quay lại = từng mua ≥ 2 lần. Tỷ lệ cao cho thấy quán giữ chân khách tốt.
          </p>
        </div>

        {/* Sức khoẻ thực đơn */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <UtensilsCrossed className="text-md-secondary" size={18} /> Tình trạng thực đơn
            </h3>
            <span className="text-[10px] font-bold text-slate-400">{menuTotal} món</span>
          </div>
          <div className="space-y-2.5 flex-1">
            {[
              { label: 'Đang bán', value: menuAvailable, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Tạm hết hàng', value: menuOutOfStock, icon: PackageX, color: 'text-rose-500', bg: 'bg-rose-50' },
              { label: 'Đang ẩn', value: menuHidden, icon: EyeOff, color: 'text-slate-500', bg: 'bg-slate-50' },
              { label: 'Chưa có lượt bán', value: menuNoSales, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className={`flex items-center gap-2.5 rounded-radius-lg ${m.bg} px-3 py-2`}>
                  <Icon size={15} className={`${m.color} shrink-0`} />
                  <span className="text-[11px] font-bold text-slate-600 flex-1">{m.label}</span>
                  <span className={`text-sm font-extrabold ${m.color}`}>{m.value}</span>
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate('/merchant/menu')} className="w-full border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 rounded-radius-lg text-[11px] transition-colors mt-4">
            Quản lý thực đơn
          </button>
        </div>

        {/* Top món (rút gọn) */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="text-amber-500" size={18} /> Top món bán chạy
            </h3>
            <button onClick={() => navigate('/merchant/stats')} className="text-[10px] font-bold text-md-secondary hover:underline inline-flex items-center gap-1">
              Đầy đủ <ArrowRight size={11} />
            </button>
          </div>
          <div className="space-y-4 flex-1">
            {topFoods.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">Chưa bán được món ăn nào.</div>
            ) : (
              topFoods.map((item, idx) => (
                <div key={idx} className="text-xs font-bold">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-700 truncate">{item.name}</span>
                    <span className="text-slate-500 font-extrabold shrink-0 ml-2">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: item.pct }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── CTA sang báo cáo chi tiết ─── */}
      <button
        onClick={() => navigate('/merchant/stats')}
        className="w-full flex items-center justify-center gap-2 bg-md-secondary/5 border border-md-secondary/20 text-md-secondary font-extrabold py-3.5 rounded-radius-xl text-sm hover:bg-md-secondary/10 transition-colors"
      >
        <BarChart3 size={18} /> Xem báo cáo tài chính chi tiết
        <ArrowRight size={16} />
      </button>

      {/* Confirm đóng/mở cửa */}
      {restaurant && (
        <ConfirmDialog
          isOpen={confirmToggleStatus}
          onClose={() => setConfirmToggleStatus(false)}
          onConfirm={handleToggleRestaurantStatus}
          title={restaurant.status ? 'Tạm đóng cửa quán' : 'Mở cửa quán trở lại'}
          message={
            restaurant.status
              ? 'Bạn có chắc chắn muốn TẠM ĐÓNG CỬA quán ăn không? Khách hàng sẽ không thể tìm thấy và đặt món từ quán của bạn.'
              : 'Bạn có muốn MỞ CỬA quán ăn trở lại để tiếp tục đón khách không?'
          }
          confirmLabel={restaurant.status ? 'Tạm đóng cửa' : 'Mở cửa'}
          danger={restaurant.status}
          loading={submitting}
        />
      )}
    </div>
  );
}
