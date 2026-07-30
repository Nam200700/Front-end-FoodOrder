import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Store, Bike, Package, AlertTriangle, TrendingUp, TrendingDown,
  Shield, RefreshCw, XCircle, Activity, Siren, UserPlus, Clock,
  CreditCard, CheckCircle2, RotateCcw, Ban, ArrowRight, BarChart3, ShieldAlert,
} from 'lucide-react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import Spinner from '../../components/common/Spinner';
import { useFetchData } from '../../hooks/useFetchData';

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Số liệu toàn hệ thống — TẤT CẢ tính ở server (không tải đơn size=2000 rồi tính client → tránh sai số toàn sàn)
  const { data: overviewStats, loading: loadingOverview, error: overviewError, refetch: refetchOverview } = useFetchData('/admin/stats/overview');
  const { data: insights, loading: loadingInsights, error: insightsError, refetch: refetchInsights } = useFetchData('/admin/stats/insights');

  const loading = loadingOverview || loadingInsights;
  const hasError = overviewError || insightsError;

  const ov = overviewStats || {};
  const ins = insights || {};

  // Biểu đồ GTV theo ngày (30 ngày) — dữ liệu server-side chính xác, không bị chặn số bản ghi
  const revenueChartData = useMemo(() => {
    return (ins.dailyGmv || []).map(d => {
      // date "yyyy-MM-dd" → "dd/MM"
      const [y, m, day] = (d.date || '').split('-');
      return { day: day && m ? `${day}/${m}` : d.date, amount: Number(d.gmv || 0) };
    });
  }, [ins.dailyGmv]);

  // Giờ cao điểm hệ thống → bar theo khung giờ
  const peakData = useMemo(
    () => (ins.peakHours || []).slice().sort((a, b) => a.hour - b.hour).map(h => ({ label: `${h.hour}h`, count: h.count })),
    [ins.peakHours]
  );
  const peakHour = useMemo(
    () => (ins.peakHours || []).reduce((mx, h) => (h.count > (mx?.count || 0) ? h : mx), null),
    [ins.peakHours]
  );

  if (loading && !overviewStats) {
    return <Spinner fullScreen />;
  }

  if (hasError) {
    const handleRetry = () => {
      if (overviewError) refetchOverview();
      if (insightsError) refetchInsights();
    };
    return (
      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="bg-red-950/20 border border-red-500/30 rounded-radius-xl p-6 text-center space-y-4">
          <div className="text-red-400 text-lg font-bold flex items-center justify-center gap-2">
            <XCircle size={22} /> Lỗi tải dữ liệu
          </div>
          <div className="text-slate-300 text-sm space-y-1">
            {overviewError && <div>• Không thể tải thống kê tổng quan</div>}
            {insightsError && <div>• Không thể tải số liệu nghiệp vụ hệ thống</div>}
          </div>
          <button
            onClick={handleRetry}
            className="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-radius-lg transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ── Số liệu thật ─────────────────────────────────────────────────
  const totalUsers = ov.totalUsers || 0;
  const totalRestaurants = ov.totalRestaurants || 0;
  const totalOrders = ov.totalOrders || 0;
  const completedOrders = ov.completedOrders || 0;
  const cancelledOrders = ov.cancelledOrders || 0;
  const totalRevenue = Number(ov.totalRevenue || 0);
  const activeShippers = ov.activeShippers || 0;
  const lockedUsers = ov.lockedUsers || 0;
  const avgOrderValue = Number(ov.avgOrderValue || 0);
  const cancelRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100) : 0;
  const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100) : 0;

  const pendingOwners = ov.pendingRestaurantRegisters || 0;
  const pendingShippers = ov.pendingShipperRegisters || 0;
  const pendingReports = ov.pendingReports || 0;

  // Xu hướng 7 ngày (chỉ quy ra % khi kỳ trước có dữ liệu → tránh +100% ảo)
  const gmv7d = Number(ins.gmv7d || 0);
  const gmvPrev7d = Number(ins.gmvPrev7d || 0);
  const orders7d = Number(ins.orders7d || 0);
  const ordersPrev7d = Number(ins.ordersPrev7d || 0);
  const trend = (cur, prev) => {
    if (prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      return { has: true, pct, dir: pct >= 0 ? 'up' : 'down' };
    }
    return { has: false, pct: 0, dir: 'flat' };
  };
  const gmvT = trend(gmv7d, gmvPrev7d);
  const ordT = trend(orders7d, ordersPrev7d);

  // Tăng trưởng
  const newUsers7d = ins.newUsers7d || 0;
  const newUsers30d = ins.newUsers30d || 0;
  const newRestaurants30d = ins.newRestaurants30d || 0;
  const newShippers30d = ins.newShippers30d || 0;

  // Toàn vẹn thanh toán
  const paidOrders = ins.paidOrders || 0;
  const pendingPayment = ins.pendingPayment || 0;
  const refundedOrders = ins.refundedOrders || 0;
  const failedPayments = ins.failedPayments || 0;

  // ── Cảnh báo hệ thống (chỉ hiện tín hiệu đáng lưu ý) ──────────────
  const alerts = [];
  if (totalOrders >= 20 && cancelRate > 15)
    alerts.push({ type: 'warn', icon: AlertTriangle, text: `Tỷ lệ huỷ đơn toàn hệ thống đang cao (${cancelRate.toFixed(1)}%). Cần rà soát quán/shipper liên quan.` });
  if (failedPayments > 0)
    alerts.push({ type: 'warn', icon: ShieldAlert, text: `${failedPayments} giao dịch thanh toán thất bại — kiểm tra cổng thanh toán.` });
  if (pendingReports > 0)
    alerts.push({ type: 'info', icon: Siren, text: `${pendingReports} báo cáo vi phạm đang chờ xử lý.`, to: '/admin/reports', action: 'Xử lý báo cáo' });
  if (pendingOwners + pendingShippers > 0)
    alerts.push({ type: 'info', icon: Shield, text: `${pendingOwners + pendingShippers} hồ sơ đối tác đang chờ duyệt (${pendingOwners} quán · ${pendingShippers} shipper).`, to: '/admin/restaurants', action: 'Duyệt hồ sơ' });

  // KPI: số lớn = TỔNG THỂ; dòng phụ = xu hướng 7 ngày kèm Δ%
  const kpis = [
    { title: 'Tổng giao dịch (GTV)', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'border-purple-500/25 bg-purple-950/10 text-purple-400',
      foot: `7 ngày: ${formatCurrency(gmv7d)}`, pct: gmvT.has ? gmvT.pct : null, dir: gmvT.dir },
    { title: 'Đơn hoàn tất', value: `${completedOrders.toLocaleString('vi-VN')} đơn`, icon: Package, color: 'border-emerald-500/25 bg-emerald-950/10 text-emerald-400',
      foot: `7 ngày: ${orders7d} đơn`, pct: ordT.has ? ordT.pct : null, dir: ordT.dir },
    { title: 'Giá trị đơn TB (AOV)', value: formatCurrency(avgOrderValue), icon: BarChart3, color: 'border-blue-500/25 bg-blue-950/10 text-blue-400',
      foot: 'Trung bình mỗi đơn hoàn tất', pct: null },
    { title: 'Tỷ lệ hoàn thành đơn', value: `${completionRate.toFixed(1)}%`, icon: CheckCircle2, color: 'border-cyan-500/25 bg-cyan-950/10 text-cyan-400',
      foot: `${completedOrders}/${totalOrders} đơn`, pct: null },
  ];

  const growth = [
    { label: 'Người dùng mới · 7 ngày', value: newUsers7d, icon: UserPlus, color: 'text-purple-400' },
    { label: 'Người dùng mới · 30 ngày', value: newUsers30d, icon: Users, color: 'text-blue-400' },
    { label: 'Quán mới · 30 ngày', value: newRestaurants30d, icon: Store, color: 'text-emerald-400' },
    { label: 'Shipper mới · 30 ngày', value: newShippers30d, icon: Bike, color: 'text-cyan-400' },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full font-google-sans space-y-6 text-slate-100 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display-small text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="text-purple-400" size={24} /> Admin Control Panel
          </h1>
          <p className="text-xs text-slate-400 mt-1">Tổng quan sức khoẻ toàn hệ thống · số liệu thật, tính trực tiếp trên toàn bộ dữ liệu</p>
        </div>
        <button
          onClick={() => { refetchOverview(); refetchInsights(); }}
          className="self-start sm:self-center inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-purple-400 border border-slate-800 hover:border-purple-900/50 px-3 py-1.5 rounded-radius-lg transition-colors cursor-pointer"
        >
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {/* ─── CẢNH BÁO HỆ THỐNG ─── */}
      <div className="space-y-2.5">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-radius-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-xs font-bold text-emerald-400">
            <CheckCircle2 size={16} className="shrink-0" />
            Hệ thống hoạt động ổn định — không có cảnh báo nào cần xử lý.
          </div>
        ) : (
          alerts.map((a, i) => {
            const Icon = a.icon;
            const warn = a.type === 'warn';
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 rounded-radius-xl border px-4 py-3 text-xs font-bold ${
                  warn ? 'border-red-500/25 bg-red-950/20 text-red-400' : 'border-amber-500/25 bg-amber-950/20 text-amber-400'
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

      {/* ─── KPI XU HƯỚNG ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className={`rounded-radius-xl p-4 border shadow-md flex items-center gap-3 bg-slate-950 ${item.color}`}>
              <div className="p-2.5 rounded-radius-md bg-white/5 shrink-0">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 font-bold block truncate uppercase tracking-wider">{item.title}</span>
                <span className="text-sm sm:text-base font-bold text-slate-100 block mt-0.5">{item.value}</span>
                <span className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                  {item.pct != null && (
                    <span className={`inline-flex items-center gap-0.5 font-bold ${item.dir === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
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

      {/* ─── TĂNG TRƯỞNG HỆ THỐNG ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {growth.map((g, idx) => {
          const Icon = g.icon;
          return (
            <div key={idx} className="rounded-radius-xl p-4 border border-slate-800 bg-slate-950 shadow-md flex items-center gap-3">
              <div className={`p-2 rounded-radius-md bg-white/5 shrink-0 ${g.color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <span className={`text-lg font-extrabold block leading-none ${g.color}`}>+{g.value.toLocaleString('vi-VN')}</span>
                <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-wide">{g.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── GTV 30 NGÀY (server) + GIỜ CAO ĐIỂM ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="text-purple-400" size={18} />
              GTV hệ thống · 30 ngày gần nhất
            </h3>
            <span className="text-[10px] text-purple-400 bg-purple-950/20 px-2.5 py-1 rounded-full border border-purple-900/30 font-bold">
              Hoa hồng sàn ({Math.round((ov.commissionRate ?? 0) * 100)}%): {formatCurrency(ov.totalCommission ?? 0)}
            </span>
          </div>
          <div className="h-60 w-full text-xs">
            {revenueChartData.length > 0 ? (
              <RevenueAreaChart
                data={revenueChartData}
                dataKey="amount"
                xKey="day"
                color="#9334E6"
                height={240}
                yTickFormatter={(v) => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <TrendingUp size={28} className="opacity-40" />
                <span className="text-xs">Chưa có đơn hoàn tất trong 30 ngày để thống kê.</span>
              </div>
            )}
          </div>
        </div>

        {/* Giờ cao điểm hệ thống */}
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 flex flex-col">
          <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="text-purple-400" size={18} /> Giờ cao điểm toàn sàn
          </h3>
          <p className="text-[10px] text-slate-500 font-semibold mb-3">
            {peakHour ? <>Đông nhất lúc <span className="text-purple-400 font-extrabold">{peakHour.hour}h–{peakHour.hour + 1}h</span> ({peakHour.count} đơn)</> : 'Theo số đơn hoàn tất trong ngày'}
          </p>
          <div className="flex-1 min-h-[190px] text-xs">
            {peakData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-500 text-xs font-semibold">
                Chưa có đủ dữ liệu giờ cao điểm.
              </div>
            ) : (
              <RevenueAreaChart data={peakData} dataKey="count" xKey="label" color="#9334E6" height={200} chartType="bar" yTickFormatter={(v) => `${v}`} />
            )}
          </div>
        </div>
      </div>

      {/* ─── KIỂM DUYỆT + VẬN HÀNH + TOÀN VẸN THANH TOÁN ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Hàng chờ kiểm duyệt */}
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 flex flex-col">
          <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <AlertTriangle className="text-yellow-500" size={16} /> Hàng chờ kiểm duyệt
          </h3>
          <div className="space-y-2.5 flex-1">
            {[
              { icon: Store, color: 'text-emerald-400', label: 'Quán chờ duyệt', value: pendingOwners, to: '/admin/restaurants' },
              { icon: Bike, color: 'text-cyan-400', label: 'Shipper chờ duyệt', value: pendingShippers, to: '/admin/shippers' },
              { icon: Siren, color: 'text-red-400', label: 'Báo cáo vi phạm', value: pendingReports, to: '/admin/reports' },
            ].map((r, i) => {
              const Icon = r.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(r.to)}
                  className="w-full flex items-center gap-2.5 rounded-radius-lg bg-slate-900 border border-slate-850 px-3 py-2.5 text-left hover:border-purple-900/50 transition-colors cursor-pointer group"
                >
                  <Icon size={15} className={`${r.color} shrink-0`} />
                  <span className="text-[11px] font-bold text-slate-300 flex-1">{r.label}</span>
                  <span className={`text-sm font-extrabold ${r.value > 0 ? r.color : 'text-slate-600'}`}>{r.value}</span>
                  <ArrowRight size={13} className="text-slate-600 group-hover:text-purple-400 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Sức khoẻ vận hành */}
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 flex flex-col">
          <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Activity className="text-purple-400" size={16} /> Sức khoẻ vận hành
          </h3>
          <div className="space-y-4 text-xs font-semibold flex-1">
            <div className="flex justify-between items-center py-2 border-b border-slate-850">
              <span className="text-slate-400">Đơn đang xử lý:</span>
              <span className="text-cyan-400 font-bold text-[11px]">
                chờ {ov.pendingOrders ?? 0} · nấu {ov.preparingOrders ?? 0} · giao {ov.deliveringOrders ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-850">
              <span className="text-slate-400">Tỷ lệ huỷ đơn:</span>
              <span className="text-red-400 font-bold">{cancelRate.toFixed(1)}% ({cancelledOrders} đơn)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-850">
              <span className="text-slate-400">Shipper đang online:</span>
              <span className="text-emerald-400 font-bold">{activeShippers} / {ov.shipperCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Tài khoản bị khoá:</span>
              <span className={`font-bold ${lockedUsers > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{lockedUsers} tài khoản</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-bold">
            <span>Tổng: {totalUsers.toLocaleString('vi-VN')} user · {totalRestaurants} quán</span>
            <button onClick={() => navigate('/admin/users')} className="text-purple-400 hover:underline inline-flex items-center gap-0.5">
              Quản lý <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Toàn vẹn thanh toán */}
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 flex flex-col">
          <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <CreditCard className="text-purple-400" size={16} /> Toàn vẹn thanh toán
          </h3>
          <div className="space-y-2.5 flex-1">
            {[
              { icon: CheckCircle2, label: 'Đã thanh toán', value: paidOrders, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-500/15' },
              { icon: Clock, label: 'Chờ thanh toán', value: pendingPayment, color: 'text-slate-300', bg: 'bg-slate-900 border-slate-850' },
              { icon: RotateCcw, label: 'Đã hoàn tiền', value: refundedOrders, color: 'text-amber-400', bg: 'bg-amber-950/20 border-amber-500/15' },
              { icon: Ban, label: 'Thất bại', value: failedPayments, color: 'text-red-400', bg: 'bg-red-950/20 border-red-500/15' },
            ].map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className={`flex items-center gap-2.5 rounded-radius-lg border px-3 py-2 ${p.bg}`}>
                  <Icon size={15} className={`${p.color} shrink-0`} />
                  <span className="text-[11px] font-bold text-slate-300 flex-1">{p.label}</span>
                  <span className={`text-sm font-extrabold ${p.color}`}>{p.value.toLocaleString('vi-VN')}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-3 leading-relaxed">
            Hoàn tiền & thất bại là tín hiệu rủi ro dòng tiền — cần theo dõi sát.
          </p>
        </div>
      </div>

      {/* ─── CTA sang phân tích chi tiết ─── */}
      <button
        onClick={() => navigate('/admin/stats')}
        className="w-full flex items-center justify-center gap-2 bg-purple-950/20 border border-purple-900/40 text-purple-300 font-extrabold py-3.5 rounded-radius-xl text-sm hover:bg-purple-950/40 transition-colors"
      >
        <BarChart3 size={18} /> Xem phân tích doanh thu & đối soát dòng tiền hệ thống
        <ArrowRight size={16} />
      </button>

    </div>
  );
}
