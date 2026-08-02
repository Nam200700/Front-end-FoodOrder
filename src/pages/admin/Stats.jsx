import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import KPICard from '../../components/common/KPICard';
import DonutChart from '../../components/common/DonutChart';
import {
  TrendingUp, TrendingDown, Minus, Users, Store, DollarSign, Percent, CreditCard, Shield,
  BarChart3, AreaChart, Flame, Wallet, PackageCheck, XCircle, UserCheck,
  Gauge, CalendarClock, CalendarRange, Search, Sparkles,
} from 'lucide-react';
import RangeSelect from '../../components/common/RangeSelect';
import SeriesFilterBar from '../../components/common/SeriesFilterBar';
import InfoTip from '../../components/common/InfoTip';
import { aggregateDaily, pickGranularity, bucketLabel, granularityCaption } from '../../utils/chartAggregate';
import { availablePeriods, filterSeries, rangeOverRange } from '../../utils/dashboardAnalytics';

const COLORS = ['#8B5CF6', '#10B981', '#F43F5E', '#06B6D4', '#F59E0B', '#3B82F6'];
const PAYMENT_LABELS = { PAID: 'Đã thanh toán', PENDING: 'Chờ thanh toán', REFUNDED: 'Đã hoàn tiền', FAILED: 'Thất bại' };
const RANGE_LABEL = {
  today: 'Hôm nay', '7days': '7 ngày qua', '30days': '30 ngày qua', '90days': '90 ngày qua',
  thisWeek: 'Tuần này', thisMonth: 'Tháng này', lastMonth: 'Tháng trước', thisYear: 'Năm nay', all: 'Tất cả',
};
// Các mốc thời gian cho bộ lọc (FilterTabs tự xuống dòng khi hẹp)
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

export default function AdminStats() {
  const [overview, setOverview] = useState(null);
  const [report, setReport] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [filterRange, setFilterRange] = useState('all');
  const [paymentMode, setPaymentMode] = useState('count');
  const [chartType, setChartType] = useState('area');
  const [hiddenPaymentKeys, setHiddenPaymentKeys] = useState(new Set());
  const [hiddenUserKeys, setHiddenUserKeys] = useState(new Set());
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
  const toggleUserKey = toggleKey(setHiddenUserKeys);

  // Cơ cấu vai trò là tổng toàn hệ thống → chỉ cần overview 1 lần (không tải size=1500 user nữa)
  useEffect(() => {
    (async () => {
      try {
        setLoadingOverview(true);
        const res = await apiClient.get('/admin/stats/overview');
        setOverview(res.data?.data || null);
      } catch (err) {
        console.error('Lỗi tải overview admin:', err);
      } finally {
        setLoadingOverview(false);
      }
    })();
  }, []);

  // Chuỗi GTV theo ngày (toàn lịch sử) — để so sánh kỳ hiện tại vs kỳ trước (endpoint đã có sẵn)
  useEffect(() => {
    apiClient.get('/admin/stats/insights').then(r => setInsights(r.data?.data || null)).catch(() => {});
  }, []);

  // Báo cáo gộp ở server theo range (thay cho tải size=2000 đơn) → nhanh, chính xác
  const fetchReport = useCallback(async () => {
    try {
      setLoadingReport(true);
      const res = await apiClient.get(`/admin/stats/report?range=${filterRange}`);
      setReport(res.data?.data || null);
    } catch (err) {
      console.error('Lỗi tải báo cáo admin:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [filterRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const rate = report?.commissionRate != null ? Number(report.commissionRate) : (overview?.commissionRate ?? 0.1);
  const ratePct = Math.round(rate * 100);

  // Danh sách năm·tháng có trong dữ liệu (để đổ vào bộ lọc). Đầy đủ nhất khi range = "Tất cả".
  const periods = useMemo(() => availablePeriods(report?.daily || []), [report]);
  const seriesActive = seriesFilter.year !== 'ALL' || seriesFilter.month !== 'ALL' || seriesFilter.weekday !== 'ALL';

  // Gom theo ngày/tuần/tháng tuỳ độ dày để biểu đồ giãn ra, dễ đọc xu hướng.
  const { timelineData, chartGranularity } = useMemo(() => {
    const raw = filterSeries((report?.daily || []).map(d => ({
      date: d.date,
      gtv: Number(d.gtv || 0),
      sub: Number(d.subtotal || 0),
    })), seriesFilter);
    const gran = pickGranularity(raw.length);
    const agg = aggregateDaily(raw, 'date', gran);
    const data = agg.map(d => ({
      dateStr: bucketLabel(d, gran),
      'Tổng GTV': d.gtv || 0,
      'Quán đối tác': Math.round((d.sub || 0) * (1 - rate)),
      'Hoa hồng sàn': Math.round((d.sub || 0) * rate),
    }));
    return { timelineData: data, chartGranularity: gran };
  }, [report, rate, seriesFilter]);

  const paymentData = useMemo(() => {
    return (report?.paymentDist || []).map(b => ({
      name: PAYMENT_LABELS[b.key] || b.key,
      value: paymentMode === 'count' ? b.count : Number(b.amount || 0),
      count: b.count, amount: Number(b.amount || 0),
    }));
  }, [report, paymentMode]);

  const userRolesData = useMemo(() => {
    if (!overview) return [];
    return [
      { name: 'Khách hàng', value: overview.customerCount || 0 },
      { name: 'Chủ quán', value: overview.ownerCount || 0 },
      { name: 'Tài xế', value: overview.shipperCount || 0 },
    ].filter(i => i.value > 0);
  }, [overview]);

  // So sánh kỳ ĐANG CHỌN vs kỳ trước tương đương (ẩn khi range = "Tất cả")
  const rangeCompare = useMemo(() => rangeOverRange(insights?.dailyGmv || [], 'gmv', filterRange), [insights, filterRange]);

  // Chỉ số chi tiết suy từ chuỗi ngày của kỳ — TÔN TRỌNG bộ lọc Tháng/Năm/Thứ (lọc theo thứ chạy thật).
  const dailyStats = useMemo(() => {
    const d = filterSeries(report?.daily || [], seriesFilter);
    let peak = null, totalGtv = 0;
    d.forEach(x => { const v = Number(x.gtv || 0); totalGtv += v; if (!peak || v > peak.v) peak = { date: x.date, v }; });
    return { activeDays: d.length, avgPerDay: d.length ? Math.round(totalGtv / d.length) : 0, peak, total: totalGtv };
  }, [report, seriesFilter]);

  // Top quán: gắn hạng thật → lọc theo tìm kiếm → mặc định 5, mở rộng xem 10
  const rankedTop = useMemo(() => (report?.topRestaurants || []).map((r, i) => ({ ...r, rank: i + 1 })), [report]);
  const filteredTop = useMemo(() => {
    const q = topQuery.trim().toLowerCase();
    const matched = q ? rankedTop.filter(r => (r.name || '').toLowerCase().includes(q)) : rankedTop;
    return topExpanded ? matched : matched.slice(0, 5);
  }, [rankedTop, topQuery, topExpanded]);

  if (loadingOverview && !overview && !report) {
    return <Spinner fullScreen />;
  }

  const s = report || {};
  const gtv = Number(s.gtv || 0);
  const subtotal = Number(s.subtotal || 0);
  const commission = Number(s.commission || 0);
  const merchantNet = Number(s.merchantNet || 0);
  const shipping = Number(s.shipping || 0);
  const aov = Number(s.aov || 0);
  const totalOrders = s.totalOrders || 0;
  const completedOrders = s.completedOrders || 0;
  const cancelledOrders = s.cancelledOrders || 0;
  const uniqueCustomers = s.uniqueCustomers || 0;
  const cancelRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100) : 0;
  const takeRate = gtv > 0 ? (commission / gtv) * 100 : 0; // % hoa hồng thực tế trên GTV
  const totalUsers = overview?.totalUsers ?? userRolesData.reduce((a, b) => a + b.value, 0);
  const fmtDay = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans space-y-6 pb-24 text-slate-100 bg-transparent">

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="text-purple-400" size={24} /> Trung Tâm Phân Tích Doanh Thu
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <RangeSelect options={RANGE_TABS} value={filterRange} onChange={setFilterRange} theme="dark" />
          <SeriesFilterBar periods={periods} value={seriesFilter} onChange={setSeriesFilter} theme="dark" />
        </div>
      </div>

      <div className={`space-y-6 transition-opacity duration-200 ${loadingReport ? 'opacity-50' : 'opacity-100'}`}>

        {/* 4 KPI dòng tiền */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title={<>Tổng giao dịch sàn (GTV) <InfoTip theme="dark" text="GTV = tổng giá trị mọi đơn hoàn tất (tiền món + cước ship), loại đơn đã hoàn tiền. Là dòng tiền lưu chuyển qua sàn, chưa trừ chi phí." /></>}
            value={formatCurrency(gtv)} description="Dòng tiền lưu chuyển thực tế"
            icon={DollarSign} color="border-purple-500/20 bg-purple-950/10 text-purple-400 bg-slate-950" valueClassName="text-slate-100" />
          <KPICard title={<>Chiết Khấu Sàn Thu Được <InfoTip theme="dark" text={`Hoa hồng sàn = ${ratePct}% trên TIỀN MÓN ĂN (subtotal) của quán. Đây là doanh thu thực của sàn.`} /></>}
            value={formatCurrency(commission)} description={`${ratePct}% trích trên tiền món ăn của Quán`}
            icon={Percent} color="border-emerald-500/20 bg-emerald-950/10 text-emerald-400 bg-slate-950" valueClassName="text-slate-100" />
          <KPICard title={<>Doanh Thu Quán Đối Tác <InfoTip theme="dark" text={`Phần tiền món ăn chuyển về quán = ${100 - ratePct}% subtotal (sau khi trừ hoa hồng sàn).`} /></>}
            value={formatCurrency(merchantNet)} description={`${100 - ratePct}% tiền món ăn chuyển về Quán`}
            icon={Store} color="border-blue-500/20 bg-blue-950/10 text-blue-400 bg-slate-950" valueClassName="text-slate-100" />
          <KPICard title={<>Cước Giao Hàng Shipper <InfoTip theme="dark" text="Tổng phí vận chuyển của các đơn hoàn tất — khoản này thuộc về tài xế, không phải doanh thu sàn." /></>}
            value={formatCurrency(shipping)} description="Phí vận chuyển thực tế thuộc về Shipper"
            icon={Users} color="border-rose-500/20 bg-rose-950/10 text-rose-400 bg-slate-950" valueClassName="text-slate-100" />
        </div>

        {/* SO SÁNH KỲ ĐANG CHỌN vs KỲ TRƯỚC (ẩn khi range = Tất cả) */}
        {rangeCompare && (
          <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-4 shadow-md">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <CalendarRange size={13} className="text-purple-400" /> So với {rangeCompare.label}
              <InfoTip theme="dark" text="So sánh kỳ đang chọn với kỳ liền trước có cùng độ dài, để thấy đang tăng hay giảm." />
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'GTV kỳ này', cur: formatCurrency(rangeCompare.cur), prev: formatCurrency(rangeCompare.prev), d: rangeCompare.valueDelta },
                { label: 'Đơn hoàn tất kỳ này', cur: rangeCompare.curCount.toLocaleString('vi-VN'), prev: rangeCompare.prevCount.toLocaleString('vi-VN'), d: rangeCompare.countDelta },
              ].map((c, i) => {
                const Dir = c.d.dir === 'up' ? TrendingUp : c.d.dir === 'down' ? TrendingDown : Minus;
                const dc = !c.d.has ? 'text-slate-500' : c.d.dir === 'up' ? 'text-emerald-400' : c.d.dir === 'down' ? 'text-red-400' : 'text-slate-400';
                return (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-radius-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{c.label}</span>
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${dc}`}>
                        <Dir size={12} />{c.d.has ? `${c.d.pct >= 0 ? '+' : ''}${c.d.pct}%` : '—'}
                      </span>
                    </div>
                    <div className="text-base font-black text-slate-100 mt-1 tabular-nums">{c.cur}</div>
                    <div className="text-[9px] text-slate-500 font-semibold mt-0.5">Kỳ trước: {c.prev}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dải chỉ số vận hành (chiều sâu) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Giá trị đơn TB (AOV)', value: formatCurrency(aov), icon: BarChart3, color: 'text-blue-400', tip: 'AOV = tiền món ăn ÷ số đơn tạo doanh thu. Cho biết mỗi đơn trung bình đáng bao nhiêu.' },
            { label: 'Đơn hoàn tất', value: `${completedOrders.toLocaleString('vi-VN')}`, icon: PackageCheck, color: 'text-emerald-400', tip: 'Số đơn đạt trạng thái hoàn tất (kể cả đơn sau đó hoàn tiền — vì đơn vẫn đã giao xong).' },
            { label: 'Khách duy nhất', value: `${uniqueCustomers.toLocaleString('vi-VN')}`, icon: UserCheck, color: 'text-cyan-400', tip: 'Số khách hàng KHÁC NHAU đã đặt đơn trong kỳ (mỗi khách chỉ đếm 1 lần).' },
            { label: 'Tỷ lệ huỷ', value: `${cancelRate.toFixed(1)}%`, icon: XCircle, color: cancelRate > 15 ? 'text-red-400' : 'text-slate-300', tip: 'Đơn huỷ ÷ tổng đơn. Trên 15% là dấu hiệu cần rà soát quán/shipper.' },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="bg-slate-950 border border-slate-800 rounded-radius-xl p-3.5 shadow-md flex items-center gap-2.5">
                <Icon size={18} className={`${c.color} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-extrabold ${c.color} truncate`}>{c.value}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1 min-w-0">
                    <span className="truncate">{c.label}</span> <InfoTip theme="dark" size={11} text={c.tip} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dải chỉ số CHI TIẾT bổ sung: take rate · TB/ngày · ngày cao điểm · số ngày có đơn */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Take rate thực tế', value: `${takeRate.toFixed(1)}%`, icon: Gauge, color: 'text-purple-400', tip: 'Tỷ lệ hoa hồng sàn thực thu trên GTV = chiết khấu ÷ GTV. Cho biết sàn giữ lại bao nhiêu % dòng tiền.' },
            { label: 'Doanh thu TB/ngày', value: formatCurrency(dailyStats.avgPerDay), icon: TrendingUp, color: 'text-emerald-400', tip: 'GTV trung bình mỗi ngày CÓ đơn trong kỳ đang xem.' },
            { label: 'Ngày cao điểm', value: dailyStats.peak ? formatCurrency(dailyStats.peak.v) : '—', icon: Sparkles, color: 'text-amber-400', tip: dailyStats.peak ? `Ngày GTV cao nhất kỳ này: ${fmtDay(dailyStats.peak.date)}` : 'Chưa có dữ liệu.' },
            { label: 'Số ngày có đơn', value: `${dailyStats.activeDays.toLocaleString('vi-VN')} ngày`, icon: CalendarClock, color: 'text-cyan-400', tip: 'Số ngày có ít nhất 1 đơn hoàn tất trong kỳ.' },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="bg-slate-950 border border-slate-800 rounded-radius-xl p-3.5 shadow-md flex items-center gap-2.5">
                <Icon size={18} className={`${c.color} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-extrabold ${c.color} truncate`}>{c.value}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1 min-w-0">
                    <span className="truncate">{c.label}</span> <InfoTip theme="dark" size={11} text={c.tip} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Đối soát dòng tiền */}
        <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Đối Soát Dòng Tiền Giao Dịch Hệ Thống</h3>
            <span className="text-[10px] text-slate-500 font-bold">Chu kỳ: {RANGE_LABEL[filterRange]}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
            {[
              { label: 'Tổng giao dịch hệ thống (GTV)', val: gtv, color: 'text-slate-100' },
              { label: 'Tổng tiền món ăn đối tác', val: subtotal, color: 'text-blue-400' },
              { label: 'Tổng cước phí giao vận Shipper', val: shipping, color: 'text-rose-400' },
            ].map((x, i) => (
              <div key={i} className="bg-slate-900 p-3.5 rounded-radius-lg border border-slate-800 shadow-sm flex flex-col justify-between h-18">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{x.label}</span>
                <span className={`text-sm font-extrabold mt-1 ${x.color}`}>{formatCurrency(x.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Biểu đồ xu hướng + Cơ cấu thành viên */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md lg:col-span-2 space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="text-purple-400" size={18} /> Xu Hướng GTV · Thực Nhận · Hoa Hồng Sàn
                </h3>
                {granularityCaption(chartGranularity) && (
                  <span className="text-[10px] text-purple-400/80 font-semibold">{granularityCaption(chartGranularity)}</span>
                )}
              </div>
              <button onClick={() => setChartType(p => p === 'area' ? 'bar' : 'area')}
                className="px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-400 cursor-pointer text-[10px] font-bold transition-all flex items-center gap-1 shrink-0">
                {chartType === 'area' ? (<><BarChart3 size={13} /> Dạng Cột</>) : (<><AreaChart size={13} /> Dạng Miền</>)}
              </button>
            </div>
            {seriesActive && (
              <p className="text-[10px] text-purple-400/80 font-semibold">Biểu đồ đang lọc theo Tháng/Năm/Thứ chọn ở thanh lọc trên cùng.</p>
            )}
            {timelineData.length === 0 ? (
              <div className="h-68 flex items-center justify-center text-xs font-bold text-slate-500">Chưa có dữ liệu giao dịch trong kỳ này.</div>
            ) : (
              <div className="h-68 w-full text-[10px] font-bold">
                <RevenueAreaChart data={timelineData} xKey="dateStr" height={272} showLegend
                  yTickFormatter={(v) => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`} valueFormatter={formatCurrency} chartType={chartType}
                  areas={[
                    { key: 'Tổng GTV', name: 'Tổng giao dịch (GTV)', color: '#8B5CF6' },
                    { key: 'Quán đối tác', name: 'Quán đối tác thực nhận', color: '#3B82F6' },
                    { key: 'Hoa hồng sàn', name: `Hoa hồng sàn (${ratePct}%)`, color: '#10B981' },
                  ]} />
              </div>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md flex flex-col justify-between min-h-[350px] space-y-4">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="text-emerald-400" size={16} /> Cơ Cấu Thành Viên Hệ Thống
            </h3>
            {userRolesData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-500">Chưa có dữ liệu thành viên.</div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-around gap-4">
                <DonutChart data={userRolesData} label="Tổng User" value={totalUsers} colors={COLORS} size={140} hiddenKeys={hiddenUserKeys} />
                <AdminLegend data={userRolesData} hidden={hiddenUserKeys} onToggle={toggleUserKey} colors={COLORS} unit="thành viên" />
              </div>
            )}
          </div>
        </div>

        {/* Top quán + Thanh toán */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="text-yellow-500" size={16} /> Top Quán Dẫn Đầu Doanh Thu
                <InfoTip theme="dark" text="Xếp hạng theo TIỀN MÓN ĂN (subtotal) trong kỳ. Tìm theo tên quán, bấm 'Xem thêm' để xem tới top 10." />
              </h3>
              <span className="text-[9px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full font-extrabold inline-flex items-center gap-1">
                <Flame size={11} /> GTV Rank
              </span>
            </div>
            {/* Tìm kiếm quán trong bảng xếp hạng */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                value={topQuery}
                onChange={(e) => setTopQuery(e.target.value)}
                placeholder="Tìm quán trong bảng xếp hạng..."
                className="w-full pl-8 pr-3 py-1.5 text-[11px] font-semibold bg-slate-900 border border-slate-800 rounded-radius-lg text-slate-200 placeholder:text-slate-600 focus:border-purple-600 outline-none"
              />
            </div>
            {rankedTop.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-slate-500">Chưa có dữ liệu xếp hạng quán.</div>
            ) : filteredTop.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-500">Không tìm thấy quán khớp "{topQuery}".</div>
            ) : (
              <>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-xs text-left min-w-[500px]">
                    <thead className="bg-slate-900 text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-850">
                      <tr>
                        <th className="p-3">Hạng</th>
                        <th className="p-3">Tên quán</th>
                        <th className="p-3">Đơn</th>
                        <th className="p-3">Tiền món (Subtotal)</th>
                        <th className="p-3">Quán nhận ({100 - ratePct}%)</th>
                        <th className="p-3 text-right">Hoa hồng ({ratePct}%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-semibold text-slate-200">
                      {filteredTop.map((res) => (
                        <tr key={res.rank} className="hover:bg-slate-900/10 transition-colors">
                          <td className="p-3">
                            <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                              res.rank === 1 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                              res.rank === 2 ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' :
                              res.rank === 3 ? 'bg-amber-600/10 text-amber-500 border border-amber-600/20' : 'bg-slate-900 text-slate-400'}`}>#{res.rank}</span>
                          </td>
                          <td className="p-3 font-extrabold text-slate-100">{res.name}</td>
                          <td className="p-3 text-slate-400 font-bold">{res.orders} đơn</td>
                          <td className="p-3 font-bold text-slate-100">{formatCurrency(res.subtotal)}</td>
                          <td className="p-3 text-emerald-400 font-extrabold">{formatCurrency(res.netShare)}</td>
                          <td className="p-3 text-right font-extrabold text-purple-400">{formatCurrency(res.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!topQuery && rankedTop.length > 5 && (
                  <button onClick={() => setTopExpanded(v => !v)}
                    className="w-full text-[11px] font-bold text-purple-400 hover:text-purple-300 py-1.5 rounded-radius-lg border border-slate-800 hover:border-purple-900/50 transition-colors cursor-pointer">
                    {topExpanded ? 'Thu gọn' : `Xem thêm (top ${rankedTop.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md flex flex-col justify-between min-h-[280px] space-y-4 self-start">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="text-purple-400" size={16} /> Trạng Thái Thanh Toán
              </h3>
              <button onClick={() => setPaymentMode(p => p === 'count' ? 'amount' : 'count')}
                className="text-[9px] text-slate-400 font-bold border border-slate-800 rounded px-1.5 py-0.5 hover:text-purple-400">
                {paymentMode === 'count' ? 'Theo số đơn' : 'Theo tiền'}
              </button>
            </div>
            {paymentData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-500">Không có dữ liệu thanh toán.</div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-around gap-4">
                <DonutChart data={paymentData} label={paymentMode === 'count' ? 'Tổng Giao dịch' : 'Tổng doanh thu'}
                  value={paymentMode === 'count' ? `${totalOrders} đơn` : formatCurrency(gtv)}
                  colors={COLORS.slice(3).concat(COLORS.slice(0, 3))} size={130}
                  onClick={() => setPaymentMode(p => p === 'count' ? 'amount' : 'count')} hiddenKeys={hiddenPaymentKeys} />
                <AdminLegend data={paymentData} hidden={hiddenPaymentKeys} onToggle={togglePaymentKey}
                  colors={COLORS.slice(3).concat(COLORS.slice(0, 3))} mode={paymentMode} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/** Chú giải phân bố (dark theme admin). Có thể click ẩn/hiện. */
function AdminLegend({ data, hidden, onToggle, colors, mode, unit }) {
  const visibleSum = data.filter(i => !hidden.has(i.name)).reduce((s, i) => s + i.value, 0);
  return (
    <div className="space-y-1.5 w-full font-semibold text-[10px]">
      {data.map((item, idx) => {
        const isHidden = hidden.has(item.name);
        const pct = !isHidden && visibleSum > 0 ? ((item.value / visibleSum) * 100).toFixed(0) : 0;
        const display = mode
          ? (mode === 'count' ? `${item.count} đơn` : formatCurrency(item.amount))
          : `${item.value} ${unit || ''}`.trim();
        return (
          <div key={idx} onClick={() => onToggle(item.name)}
            className={`flex justify-between items-center py-1 border-b border-slate-900 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-900/50 ${isHidden ? 'opacity-40' : ''}`}
            title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length], opacity: isHidden ? 0.3 : 1 }} />
              <span className={`truncate ${isHidden ? 'line-through text-slate-600' : 'text-slate-400'}`}>{item.name}:</span>
            </div>
            <span className={`font-extrabold shrink-0 ml-2 ${isHidden ? 'text-slate-600' : 'text-slate-100'}`}>
              {isHidden ? '—' : `${display} (${pct}%)`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
