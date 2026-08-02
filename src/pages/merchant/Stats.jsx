import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { aggregateDaily, pickGranularity, bucketLabel, granularityCaption } from '../../utils/chartAggregate';
import { availablePeriods, rangeOverRange, WEEKDAY_OPTIONS } from '../../utils/dashboardAnalytics';
import SeriesFilterBar from '../../components/common/SeriesFilterBar';
import RangeSelect from '../../components/common/RangeSelect';
import InfoTip from '../../components/common/InfoTip';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import KPICard from '../../components/common/KPICard';
import GaugeChart from '../../components/common/GaugeChart';
import {
  ClipboardList, TrendingUp, TrendingDown, Minus, ShoppingBag, Users, DollarSign,
  Award, Calendar, CreditCard, Percent, Store, Flame, BarChart3, AreaChart,
  Wallet, PackageCheck, XCircle, UserCheck, Gauge, CalendarClock, CalendarRange, Search, Sparkles,
} from 'lucide-react';

// Bảng màu báo cáo Merchant: DẪN ĐẦU xanh dương #1A73E8 (thương hiệu merchant),
// KHÔNG dùng cam #FF6B35 của Customer. Màu sau mang ý nghĩa (xanh lá=tốt, vàng=chờ, đỏ=huỷ).
const COLORS = ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#9C27B0', '#00897B'];

const PAYMENT_LABELS = { PAID: 'Đã thanh toán', PENDING: 'Chờ thanh toán', REFUNDED: 'Đã hoàn tiền', FAILED: 'Thất bại' };
const STATUS_LABELS = {
  COMPLETED: 'Thành công', CANCELLED: 'Đã huỷ', DELIVERING: 'Đang giao', PREPARING: 'Chuẩn bị',
  CONFIRMED: 'Đã nhận', PENDING: 'Chờ duyệt', READY_FOR_PICKUP: 'Chờ shipper', PICKED_UP: 'Shipper lấy',
};
const RANGE_LABEL = {
  today: 'Hôm nay', '7days': '7 ngày qua', '30days': '30 ngày qua', '90days': '90 ngày qua',
  thisWeek: 'Tuần này', thisMonth: 'Tháng này', lastMonth: 'Tháng trước', thisYear: 'Năm nay', all: 'Tất cả',
};
const RANGE_TABS = [
  { id: 'today', label: 'Hôm Nay' },
  { id: '7days', label: '7 Ngày' },
  { id: '30days', label: '30 Ngày' },
  { id: '90days', label: '90 Ngày' },
  { id: 'thisWeek', label: 'Tuần Này' },
  { id: 'thisMonth', label: 'Tháng Này' },
  { id: 'lastMonth', label: 'Tháng Trước' },
  { id: 'thisYear', label: 'Năm Nay' },
  { id: 'all', label: 'Tất Cả' },
];

export default function MerchantStats() {
  const [restaurantId, setRestaurantId] = useState(null);
  const [loadingRes, setLoadingRes] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState(null);
  const [filterRange, setFilterRange] = useState('all');
  const [pieMode, setPieMode] = useState('count'); // count | amount
  const [chartType, setChartType] = useState('area');
  const [hiddenPaymentKeys, setHiddenPaymentKeys] = useState(new Set());
  const [hiddenStatusKeys, setHiddenStatusKeys] = useState(new Set());
  const [seriesFilter, setSeriesFilter] = useState({ year: 'ALL', month: 'ALL', weekday: 'ALL' });
  const [insights, setInsights] = useState(null);
  const [topQuery, setTopQuery] = useState('');
  const [topExpanded, setTopExpanded] = useState(false);

  const toggleKey = (setter) => (name) => setter(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const togglePaymentKey = toggleKey(setHiddenPaymentKeys);
  const toggleStatusKey = toggleKey(setHiddenStatusKeys);

  // 1) Lấy nhà hàng của owner
  useEffect(() => {
    (async () => {
      try {
        setLoadingRes(true);
        const res = await apiClient.get('/merchant/restaurant');
        const d = res.data?.data;
        if (d) setRestaurantId(d.restaurantId || d.id);
      } catch (err) {
        console.warn('OWNER chưa tạo nhà hàng:', err);
      } finally {
        setLoadingRes(false);
      }
    })();
  }, []);

  // 2) Lấy báo cáo đã gộp ở server (server lọc theo range → nhanh, chính xác, không cap)
  // Quy đổi bộ lọc Tháng/Năm/Thứ → tham số server (dow: MySQL DAYOFWEEK 1=CN..7=T7)
  const reportParams = useMemo(() => {
    const p = {};
    if (seriesFilter.month !== 'ALL') { const [y, m] = seriesFilter.month.split('-'); p.year = Number(y); p.month = Number(m); }
    else if (seriesFilter.year !== 'ALL') { p.year = Number(seriesFilter.year); }
    if (seriesFilter.weekday !== 'ALL') p.dow = Number(seriesFilter.weekday) + 1;
    return p;
  }, [seriesFilter]);

  const fetchReport = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoadingReport(true);
      const qs = new URLSearchParams({ restaurantId: String(restaurantId), range: filterRange });
      if (reportParams.dow) qs.append('dow', reportParams.dow);
      if (reportParams.month) qs.append('month', reportParams.month);
      if (reportParams.year) qs.append('year', reportParams.year);
      const res = await apiClient.get(`/merchant/stats/report?${qs.toString()}`);
      setReport(res.data?.data || null);
    } catch (err) {
      console.error('Lỗi lấy báo cáo thống kê merchant:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [restaurantId, filterRange, reportParams]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Chuỗi doanh thu theo ngày (toàn lịch sử) — để so sánh kỳ hiện tại vs kỳ trước (endpoint đã có sẵn)
  useEffect(() => {
    if (!restaurantId) return;
    apiClient.get(`/merchant/stats/insights?restaurantId=${restaurantId}`)
      .then(r => setInsights(r.data?.data || null)).catch(() => {});
  }, [restaurantId]);

  const rate = report?.commissionRate != null ? Number(report.commissionRate) : 0.1;
  const ratePct = Math.round(rate * 100);

  // Danh sách năm·tháng đổ vào bộ lọc — lấy từ chuỗi ĐẦY ĐỦ (insights), không phải report đã lọc.
  const periods = useMemo(() => availablePeriods(insights?.dailyRevenue || []), [insights]);
  const seriesActive = seriesFilter.year !== 'ALL' || seriesFilter.month !== 'ALL' || seriesFilter.weekday !== 'ALL';

  // Biểu đồ xu hướng — report.daily ĐÃ được server lọc theo Tháng/Năm/Thứ, chỉ cần gom mốc.
  const { timelineData, chartGranularity } = useMemo(() => {
    const raw = (report?.daily || []).map(d => ({
      date: d.date,
      sub: Number(d.subtotal || 0),
      orders: Number(d.orders || 0),
    }));
    const gran = pickGranularity(raw.length);
    const agg = aggregateDaily(raw, 'date', gran);
    const data = agg.map(d => ({
      dateStr: bucketLabel(d, gran),
      'Doanh thu món': d.sub || 0,
      'Thực nhận': Math.round((d.sub || 0) * (1 - rate)),
      orders: d.orders || 0,
    }));
    return { timelineData: data, chartGranularity: gran };
  }, [report, rate]);

  const paymentData = useMemo(() => {
    return (report?.paymentDist || []).map(b => ({
      name: PAYMENT_LABELS[b.key] || b.key,
      value: pieMode === 'count' ? b.count : Number(b.amount || 0),
      count: b.count, amount: Number(b.amount || 0),
    }));
  }, [report, pieMode]);

  const statusData = useMemo(() => {
    return (report?.statusDist || []).map(b => ({
      name: STATUS_LABELS[b.key] || b.key,
      value: pieMode === 'count' ? b.count : Number(b.amount || 0),
      count: b.count, amount: Number(b.amount || 0),
    })).sort((a, b) => b.count - a.count);
  }, [report, pieMode]);

  // So sánh kỳ đang chọn vs kỳ trước tương đương (ẩn khi range = "Tất cả")
  const rangeCompare = useMemo(() => rangeOverRange(insights?.dailyRevenue || [], 'revenue', filterRange), [insights, filterRange]);

  // Chỉ số chi tiết suy từ chuỗi ngày (report.daily đã được server lọc theo Tháng/Năm/Thứ).
  const dailyStats = useMemo(() => {
    const d = report?.daily || [];
    let peak = null, totalSub = 0;
    d.forEach(x => { const v = Number(x.subtotal || 0); totalSub += v; if (!peak || v > peak.v) peak = { date: x.date, v }; });
    return { activeDays: d.length, avgPerDay: d.length ? Math.round(totalSub / d.length) : 0, peak, total: totalSub };
  }, [report]);

  // Top món: gắn hạng thật → lọc theo tìm kiếm → mặc định 5, mở rộng xem 10
  const rankedTop = useMemo(() => (report?.topFoods || []).map((f, i) => ({ ...f, rank: i + 1 })), [report]);
  const filteredTop = useMemo(() => {
    const q = topQuery.trim().toLowerCase();
    const matched = q ? rankedTop.filter(f => (f.name || '').toLowerCase().includes(q)) : rankedTop;
    return topExpanded ? matched : matched.slice(0, 5);
  }, [rankedTop, topQuery, topExpanded]);

  if (!restaurantId && !loadingRes) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs leading-relaxed">Bạn cần tạo và đăng ký nhà hàng để xem báo cáo thống kê chuyên sâu.</p>
      </div>
    );
  }

  // Số liệu tổng hợp (đã gộp ở server)
  const s = report || {};
  const gtv = Number(s.gtv || 0);
  const subtotal = Number(s.subtotal || 0);
  const commission = Number(s.commission || 0);
  const earnings = Number(s.earnings || 0);
  const shipping = Number(s.shipping || 0);
  const aov = Number(s.aov || 0);
  const totalOrders = s.totalOrders || 0;
  const completedOrders = s.completedOrders || 0;
  const cancelledOrders = s.cancelledOrders || 0;
  const uniqueCustomers = s.uniqueCustomers || 0;
  const cancelRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100) : 0;
  const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100) : 0;
  const fmtDay = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const filterSummary = [
    seriesFilter.month !== 'ALL' ? `Tháng ${Number(seriesFilter.month.split('-')[1])}/${seriesFilter.month.split('-')[0]}`
      : (seriesFilter.year !== 'ALL' ? `Năm ${seriesFilter.year}` : null),
    seriesFilter.weekday !== 'ALL' ? WEEKDAY_OPTIONS.find(o => o.value === seriesFilter.weekday)?.label : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans space-y-6 pb-24 text-slate-800">

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-radius-md bg-md-secondary/10 text-md-secondary flex items-center justify-center shrink-0">
              <Store size={20} />
            </span>
            Báo Cáo Tài Chính Nhà Hàng
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <RangeSelect options={RANGE_TABS} value={filterRange} onChange={setFilterRange} theme="light" />
          <SeriesFilterBar periods={periods} value={seriesFilter} onChange={setSeriesFilter} theme="light" />
        </div>
      </div>

      {(loadingRes || (loadingReport && !report)) ? (
        <Spinner />
      ) : (
        <div className={`space-y-6 transition-opacity duration-200 ${loadingReport ? 'opacity-50' : 'opacity-100'}`}>

          {seriesActive && (
            <div className="flex items-center gap-2 rounded-radius-lg bg-md-secondary/5 border border-md-secondary/20 px-3.5 py-2 text-[11px] font-bold text-md-secondary">
              <CalendarRange size={13} /> Toàn bộ số liệu đang lọc theo: <span className="text-slate-700">{filterSummary || 'bộ lọc đã chọn'}</span>
            </div>
          )}

          {/* KPI dòng tiền (4) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title={<>Doanh Thu Thực Nhận <InfoTip theme="light" text={`Số tiền quán thực sự nhận được = tiền món ăn sau khi trừ ${ratePct}% hoa hồng sàn. Chưa gồm cước ship (thuộc về tài xế).`} /></>}
              value={formatCurrency(earnings)}
              description={`Sau khi trừ ${ratePct}% hoa hồng sàn`} icon={DollarSign}
              color="border-md-secondary/15 bg-md-secondary-container/5 text-md-secondary bg-white" />
            <KPICard title={<>Tổng Tiền Món Ăn <InfoTip theme="light" text="Tổng giá trị món ăn (subtotal) của các đơn hoàn tất, TRƯỚC khi trừ hoa hồng sàn." /></>}
              value={formatCurrency(subtotal)}
              description="Doanh thu món trước chiết khấu" icon={ShoppingBag}
              color="border-blue-500/15 bg-blue-500/5 text-blue-600 bg-white" />
            <KPICard title={<>Chiết Khấu Sàn ({ratePct}%) <InfoTip theme="light" text={`Phần sàn giữ lại = ${ratePct}% tiền món ăn, để duy trì vận hành hệ thống.`} /></>}
              value={formatCurrency(commission)}
              description="Khấu trừ duy trì hệ thống" icon={Percent}
              color="border-orange-500/15 bg-orange-500/5 text-orange-600 bg-white" />
            <KPICard title={<>Dòng Tiền Giao Vận <InfoTip theme="light" text="Tổng phí giao hàng khách trả — khoản này chuyển cho tài xế, không phải doanh thu của quán." /></>}
              value={formatCurrency(shipping)}
              description="Phí giao hàng trả cho Shipper" icon={Users}
              color="border-purple-500/15 bg-purple-500/5 text-purple-600 bg-white" />
          </div>

          {/* SO SÁNH KỲ ĐANG CHỌN vs KỲ TRƯỚC (ẩn khi range = Tất cả hoặc đang lọc Tháng/Năm/Thứ) */}
          {rangeCompare && !seriesActive && (
            <div className="bg-white border border-slate-200/60 rounded-radius-xl p-4 shadow-sm">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <CalendarRange size={13} className="text-md-secondary" /> So với {rangeCompare.label}
                <InfoTip theme="light" text="So sánh kỳ đang chọn với kỳ liền trước có cùng độ dài, để thấy quán đang tăng hay giảm." />
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Doanh thu món kỳ này', cur: formatCurrency(rangeCompare.cur), prev: formatCurrency(rangeCompare.prev), d: rangeCompare.valueDelta },
                  { label: 'Đơn hoàn tất kỳ này', cur: rangeCompare.curCount.toLocaleString('vi-VN'), prev: rangeCompare.prevCount.toLocaleString('vi-VN'), d: rangeCompare.countDelta },
                ].map((c, i) => {
                  const Dir = c.d.dir === 'up' ? TrendingUp : c.d.dir === 'down' ? TrendingDown : Minus;
                  const dc = !c.d.has ? 'text-slate-400' : c.d.dir === 'up' ? 'text-emerald-600' : c.d.dir === 'down' ? 'text-rose-500' : 'text-slate-500';
                  return (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-radius-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${dc}`}>
                          <Dir size={12} />{c.d.has ? `${c.d.pct >= 0 ? '+' : ''}${c.d.pct}%` : '—'}
                        </span>
                      </div>
                      <div className="text-base font-black text-slate-800 mt-1 tabular-nums">{c.cur}</div>
                      <div className="text-[9px] text-slate-400 font-semibold mt-0.5">Kỳ trước: {c.prev}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dải chỉ số vận hành (5) — chiều sâu thêm */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Tổng giá trị đơn (GTV)', value: formatCurrency(gtv), icon: Wallet, color: 'text-slate-800', tip: 'GTV = tiền món + cước ship của các đơn hoàn tất. Là tổng dòng tiền qua quán.' },
              { label: 'Giá trị đơn TB (AOV)', value: formatCurrency(aov), icon: BarChart3, color: 'text-blue-600', tip: 'AOV = tiền món ăn ÷ số đơn tạo doanh thu. Mỗi đơn trung bình đáng bao nhiêu.' },
              { label: 'Đơn hoàn tất', value: `${completedOrders}`, icon: PackageCheck, color: 'text-md-secondary', tip: 'Số đơn đã giao xong (kể cả đơn sau đó hoàn tiền — vì đơn vẫn đã hoàn tất).' },
              { label: 'Khách duy nhất', value: `${uniqueCustomers}`, icon: UserCheck, color: 'text-emerald-600', tip: 'Số khách KHÁC NHAU đã đặt đơn ở quán trong kỳ.' },
              { label: 'Tỷ lệ huỷ', value: `${cancelRate.toFixed(1)}%`, icon: XCircle, color: cancelRate > 15 ? 'text-red-600' : 'text-slate-700', tip: 'Đơn huỷ ÷ tổng đơn. Trên 15% nên rà soát quy trình nhận/chuẩn bị đơn.' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="bg-white border border-slate-200/60 rounded-radius-xl p-3.5 shadow-sm flex items-center gap-2.5">
                  <Icon size={18} className={`${c.color} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-extrabold ${c.color} truncate`}>{c.value}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1 min-w-0">
                      <span className="truncate">{c.label}</span> <InfoTip theme="light" size={11} text={c.tip} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dải chỉ số CHI TIẾT — tất cả đều theo range + bộ lọc Tháng/Năm/Thứ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Doanh thu TB/ngày', value: formatCurrency(dailyStats.avgPerDay), icon: TrendingUp, color: 'text-md-secondary', tip: 'Tiền món ăn trung bình mỗi ngày CÓ đơn trong phạm vi đang lọc.' },
              { label: 'Ngày cao điểm', value: dailyStats.peak ? formatCurrency(dailyStats.peak.v) : '—', icon: Sparkles, color: 'text-amber-600', tip: dailyStats.peak ? `Ngày bán chạy nhất: ${fmtDay(dailyStats.peak.date)}` : 'Chưa có dữ liệu khớp bộ lọc.' },
              { label: 'Số ngày có đơn', value: `${dailyStats.activeDays} ngày`, icon: CalendarClock, color: 'text-blue-600', tip: 'Số ngày có ít nhất 1 đơn trong phạm vi đang lọc.' },
              { label: 'Tỷ lệ hoàn thành', value: `${completionRate.toFixed(1)}%`, icon: Gauge, color: completionRate < 70 ? 'text-orange-600' : 'text-emerald-600', tip: 'Đơn hoàn tất ÷ tổng đơn trong phạm vi đang lọc.' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="bg-white border border-slate-200/60 rounded-radius-xl p-3.5 shadow-sm flex items-center gap-2.5">
                  <Icon size={18} className={`${c.color} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-extrabold ${c.color} truncate`}>{c.value}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1 min-w-0">
                      <span className="truncate">{c.label}</span> <InfoTip theme="light" size={11} text={c.tip} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phân bổ dòng tiền */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-[1.25rem] p-5 space-y-3.5 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Phân Bổ Dòng Tiền Giao Dịch</h3>
              <span className="text-[10px] text-slate-500 font-bold">Chu kỳ: {RANGE_LABEL[filterRange]}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
              {[
                { label: 'Tổng giá trị đơn (GTV)', val: gtv, color: 'text-slate-800' },
                { label: 'Doanh thu món ăn (Subtotal)', val: subtotal, color: 'text-blue-600' },
                { label: 'Cước phí giao vận (Shipper)', val: shipping, color: 'text-purple-600' },
              ].map((x, i) => (
                <div key={i} className="bg-white p-3.5 rounded-radius-lg border border-slate-200 shadow-sm flex flex-col justify-between h-18">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{x.label}</span>
                  <span className={`text-sm font-extrabold mt-1 ${x.color}`}>{formatCurrency(x.val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Biểu đồ xu hướng + Thanh toán */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="text-md-secondary" size={18} /> Xu Hướng Doanh Thu (Khấu Trừ Hoa Hồng)
                  </h3>
                  {granularityCaption(chartGranularity) && (
                    <span className="text-[10px] text-md-secondary/80 font-semibold">{granularityCaption(chartGranularity)}</span>
                  )}
                </div>
                <button onClick={() => setChartType(p => p === 'area' ? 'bar' : 'area')}
                  className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-600 hover:text-md-secondary cursor-pointer text-[10px] font-bold transition-all flex items-center gap-1 shrink-0">
                  {chartType === 'area' ? (<><BarChart3 size={11} /> Dạng Cột</>) : (<><AreaChart size={11} /> Dạng Miền</>)}
                </button>
              </div>
              {timelineData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs font-bold text-slate-400">Chưa có dữ liệu giao dịch trong kỳ này.</div>
              ) : (
                <div className="h-64 w-full text-[10px] font-bold">
                  <RevenueAreaChart data={timelineData} xKey="dateStr" height={256} showLegend
                    yTickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} valueFormatter={formatCurrency} chartType={chartType}
                    areas={[
                      { key: 'Doanh thu món', name: 'Tiền món ăn', color: '#1A73E8' },
                      { key: 'Thực nhận', name: `Quán thực nhận (${100 - ratePct}%)`, color: '#00897B' },
                    ]} />
                </div>
              )}
            </div>

            {/* Thanh toán donut */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between min-h-[340px] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="text-blue-500" size={16} /> Trạng Thái Thanh Toán
                </h3>
                <button onClick={() => setPieMode(p => p === 'count' ? 'amount' : 'count')}
                  className="text-[9px] text-slate-500 font-bold border border-slate-200 rounded px-1.5 py-0.5 hover:text-blue-600">
                  {pieMode === 'count' ? 'Theo số đơn' : 'Theo tiền'}
                </button>
              </div>
              {paymentData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">Không có dữ liệu thanh toán.</div>
              ) : (
                <div className="flex-1 flex items-center justify-around flex-col gap-4">
                  <GaugeChart data={paymentData} label={pieMode === 'count' ? 'Tổng đơn' : 'Tổng tiền'}
                    value={pieMode === 'count' ? `${totalOrders} đơn` : formatCurrency(gtv)}
                    colors={COLORS} size={140} onClick={() => setPieMode(p => p === 'count' ? 'amount' : 'count')}
                    hiddenKeys={hiddenPaymentKeys} />
                  <DistLegend data={paymentData} hidden={hiddenPaymentKeys} onToggle={togglePaymentKey} mode={pieMode} colors={COLORS} />
                </div>
              )}
            </div>
          </div>

          {/* Top món + Trạng thái đơn */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="text-yellow-500" size={18} /> Top Món Ăn Bán Chạy
                  <InfoTip theme="light" text="Xếp theo doanh thu món trong kỳ. Tìm theo tên món, bấm 'Xem thêm' để xem tới top 10." />
                </h3>
                <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                  <Flame size={11} /> Best-Sellers
                </span>
              </div>
              {/* Tìm kiếm món trong bảng xếp hạng */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={topQuery}
                  onChange={(e) => setTopQuery(e.target.value)}
                  placeholder="Tìm món trong bảng xếp hạng..."
                  className="w-full pl-8 pr-3 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-radius-lg text-slate-700 placeholder:text-slate-400 focus:border-md-secondary focus:bg-white outline-none"
                />
              </div>
              {rankedTop.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">Chưa có món ăn bán thành công trong kỳ này.</div>
              ) : filteredTop.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400">Không tìm thấy món khớp "{topQuery}".</div>
              ) : (
                <>
                  <div className={`space-y-4.5 ${topExpanded ? 'max-h-[440px] overflow-y-auto pr-1' : ''}`}>
                    {filteredTop.map((food) => {
                      const revenue = Number(food.revenue || 0);
                      const pct = subtotal > 0 ? (revenue / subtotal) * 100 : 0;
                      return (
                        <div key={food.rank} className="space-y-1.5 text-xs font-bold">
                          <div className="flex justify-between items-center text-slate-700">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                                food.rank === 1 ? 'bg-yellow-100 text-yellow-700' : food.rank === 2 ? 'bg-slate-100 text-slate-700' :
                                food.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>{food.rank}</span>
                              <span className="text-slate-800 font-extrabold truncate">{food.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-400">Đã bán: <b className="text-slate-700 font-extrabold">{food.qty}</b></span>
                              <span className="text-md-secondary font-extrabold">{formatCurrency(revenue)}</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-md-secondary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400 font-medium mt-0.5">
                            <span>Đóng góp doanh thu</span>
                            <span>{pct.toFixed(1)}% của tổng tiền món ({formatCurrency(subtotal)})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!topQuery && rankedTop.length > 5 && (
                    <button onClick={() => setTopExpanded(v => !v)}
                      className="w-full text-[11px] font-bold text-md-secondary hover:text-md-secondary/80 py-1.5 rounded-radius-lg border border-slate-200 hover:border-md-secondary/40 transition-colors cursor-pointer">
                      {topExpanded ? 'Thu gọn' : `Xem thêm (top ${rankedTop.length})`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Trạng thái đơn donut */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between min-h-[300px] space-y-4 self-start">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="text-purple-500" size={16} /> Tỷ Lệ Trạng Thái Đơn
              </h3>
              {statusData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">Không có dữ liệu trạng thái đơn.</div>
              ) : (
                <div className="flex-1 flex items-center justify-around flex-col gap-4">
                  <GaugeChart data={statusData} label={pieMode === 'count' ? 'Tổng đơn' : 'Tổng tiền'}
                    value={pieMode === 'count' ? `${totalOrders} đơn` : formatCurrency(gtv)}
                    colors={COLORS} size={130} onClick={() => setPieMode(p => p === 'count' ? 'amount' : 'count')}
                    hiddenKeys={hiddenStatusKeys} />
                  <DistLegend data={statusData.slice(0, 5)} hidden={hiddenStatusKeys} onToggle={toggleStatusKey} mode={pieMode} colors={COLORS} />
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/** Chú giải phân bố dùng chung cho các donut (click để ẩn/hiện). */
function DistLegend({ data, hidden, onToggle, mode, colors }) {
  const visibleSum = data.filter(i => !hidden.has(i.name)).reduce((s, i) => s + i.value, 0);
  return (
    <div className="space-y-1.5 w-full font-semibold text-[10px]">
      {data.map((item, idx) => {
        const isHidden = hidden.has(item.name);
        const pct = !isHidden && visibleSum > 0 ? ((item.value / visibleSum) * 100).toFixed(0) : 0;
        const display = mode === 'count' ? `${item.count} đơn` : formatCurrency(item.amount);
        return (
          <div key={idx} onClick={() => onToggle(item.name)}
            className={`flex justify-between items-center py-1 border-b border-slate-50 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-50 ${isHidden ? 'opacity-40' : ''}`}
            title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length], opacity: isHidden ? 0.3 : 1 }} />
              <span className={`truncate ${isHidden ? 'line-through text-slate-300' : 'text-slate-500'}`}>{item.name}:</span>
            </div>
            <span className={`font-extrabold shrink-0 ml-2 ${isHidden ? 'text-slate-300' : 'text-slate-800'}`}>
              {isHidden ? '—' : `${display} (${pct}%)`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
