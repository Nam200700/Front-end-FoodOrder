import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { DollarSign, TrendingUp, Star, CheckCircle2, Wallet, BarChart3, Calendar, Sun, Info, CalendarDays, Clock, CalendarCheck, CalendarRange, ArrowUpRight, ArrowDownRight, Coins, Target, Trophy } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import ErrorState from '../../components/common/ErrorState';
import { SkeletonStatCard, SkeletonChartCard } from '../../components/common/SkeletonCard';
import InsightHeadline from '../../components/common/InsightHeadline';

// Biểu đồ cột thu nhập dùng chung cho "tuần này theo thứ" & "6 tháng" (khử trùng lặp,
// vẫn giữ nhãn số trên đầu cột + tô đậm cột cao điểm — phần dẫn dắt người đọc).
function EarningsBarChart({ data, xKey = 'day', highlightKey = null, xFontSize = 14, maxBar = 54 }) {
  return (
    <div className="h-64 w-full text-sm font-semibold">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: xFontSize, fontWeight: 700, fill: '#475569' }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={38} tick={{ fontSize: 13, fill: '#94a3b8' }} tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)} />
          <Tooltip formatter={(value) => [formatCurrency(value), 'Thu nhập']} cursor={{ fill: 'rgba(52,168,83,0.06)' }} contentStyle={{ fontSize: 13, fontWeight: 600, borderRadius: 10 }} />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={maxBar} fill="#34A853">
            {highlightKey && data.map((entry, idx) => (
              <Cell key={idx} fill={entry[xKey] === highlightKey && entry.amount > 0 ? '#2E7D32' : '#34A853'} />
            ))}
            <LabelList dataKey="amount" position="top" formatter={(v) => (v > 0 ? `${Math.round(v / 1000)}k` : '')} style={{ fontSize: 13, fontWeight: 800, fill: '#334155' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Tiêu đề nhóm dẫn dắt mạch đọc: Tổng quan → Xu hướng → Gợi ý.
function SectionTitle({ icon: Icon, children, hint }) {
  return (
    <div className="flex items-baseline gap-2 pt-1">
      <h2 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
        {Icon && <Icon size={16} className="text-md-tertiary" />} {children}
      </h2>
      {hint && <span className="text-[11px] text-slate-400 font-medium">· {hint}</span>}
    </div>
  );
}

export default function ShipperEarnings() {
  // Nhận DTO tổng hợp từ server (/shipper/stats/insights) → map về đúng shape UI đang dùng.
  // Ưu điểm: BE gộp trên TOÀN BỘ đơn (không bị chặn 1000), rating lấy từ shipper.avgRating đã lưu.
  const mapInsights = (d) => {
    if (!d) return null;
    return {
      totalEarnings: d.totalEarnings || 0,
      completedCount: d.completedCount || 0,
      todayEarnings: d.todayEarnings || 0,
      todayCount: d.todayCount || 0,
      week7dEarnings: d.week7dEarnings || 0,
      week7dCount: d.week7dCount || 0,
      thisWeekEarnings: d.thisWeekEarnings || 0,
      thisMonthEarnings: d.thisMonthEarnings || 0,
      thisMonthCount: d.thisMonthCount || 0,
      lastMonthEarnings: d.lastMonthEarnings || 0,
      monthDelta: d.monthDelta || 0,
      activeDayCount: d.activeDayCount || 0,
      avgPerActiveDay: d.avgPerActiveDay || 0,
      bestWeekday: { day: d.bestWeekday || null, amount: d.bestWeekdayAmount || 0 },
      peakHourIdx: d.peakHourIdx || 0,
      peakHourAmount: d.peakHourAmount || 0,
      maxFee: d.maxFee || 0,
      monthlyData: (d.monthly || []).map(m => ({ label: m.label, amount: m.amount || 0 })),
      ratedCount: d.ratedCount || 0,
      dailyData: (d.daily || []).map(x => ({ day: x.day, amount: x.amount || 0 })),
      rating: Number(d.rating || 0) > 0 ? Number(d.rating).toFixed(1) : '5.0',
    };
  };


  // Gọi API tổng hợp thu nhập (gộp server-side) thay cho tải size=1000 rồi tự cộng.
  const { data: stats, loading, error, refetch } = useFetchData('/shipper/stats/insights', {
    mapFn: mapInsights,
  });

  // Mục tiêu thu nhập tháng do tài xế tự đặt (lưu localStorage — nhớ giữa các lần vào).
  const GOAL_PRESETS = [3000000, 5000000, 8000000, 10000000];
  const [monthGoal, setMonthGoal] = useState(() => {
    const saved = Number(localStorage.getItem('shipperMonthGoal'));
    return saved > 0 ? saved : 5000000;
  });
  useEffect(() => { localStorage.setItem('shipperMonthGoal', String(monthGoal)); }, [monthGoal]);

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="text-md-tertiary" size={24} />
          Thống kê thu nhập
        </h1>
        <div className="space-y-4 animate-pulse">
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const earningsStats = stats || {
    totalEarnings: 0,
    completedCount: 0,
    todayEarnings: 0, todayCount: 0,
    week7dEarnings: 0, week7dCount: 0,
    thisWeekEarnings: 0,
    thisMonthEarnings: 0, thisMonthCount: 0, lastMonthEarnings: 0, monthDelta: 0,
    activeDayCount: 0, avgPerActiveDay: 0,
    bestWeekday: { day: null, amount: 0 }, peakHourIdx: 0, peakHourAmount: 0, maxFee: 0,
    monthlyData: [],
    ratedCount: 0,
    dailyData: [],
    rating: '5.0'
  };

  // Biểu đồ theo thứ chỉ có ý nghĩa khi tuần NÀY đã có thu nhập; nếu chưa thì hiện 7 cột 0 để tham khảo bố cục.
  const hasData = earningsStats.thisWeekEarnings > 0;
  const displayData = hasData ? earningsStats.dailyData : [
    { day: 'T2', amount: 0 },
    { day: 'T3', amount: 0 },
    { day: 'T4', amount: 0 },
    { day: 'T5', amount: 0 },
    { day: 'T6', amount: 0 },
    { day: 'T7', amount: 0 },
    { day: 'CN', amount: 0 }
  ];

  // Số liệu phụ trợ cho trang trí: trung bình mỗi đơn + ngày cao điểm nhất trong tuần
  const avgPerOrder = earningsStats.completedCount > 0
    ? earningsStats.totalEarnings / earningsStats.completedCount
    : 0;
  const bestDay = hasData
    ? displayData.reduce((max, d) => (d.amount > max.amount ? d : max), displayData[0])
    : null;

  // ─── Dữ liệu cho các phần THÔNG TIN MỞ RỘNG ───
  const monthlyData = earningsStats.monthlyData || [];
  const monthlyHasData = monthlyData.some((m) => m.amount > 0);
  const monthDelta = earningsStats.monthDelta;
  const deltaUp = monthDelta >= 0;
  // Khung giờ vàng: hiển thị dạng "18h–19h"
  const peakHourLabel = earningsStats.peakHourAmount > 0
    ? `${earningsStats.peakHourIdx}h–${(earningsStats.peakHourIdx + 1) % 24}h`
    : '—';
  const weekdayFull = { T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4', T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
  const bestWeekdayLabel = earningsStats.bestWeekday?.day ? weekdayFull[earningsStats.bestWeekday.day] : '—';

  // Mục tiêu tháng: % đạt được + còn thiếu bao nhiêu.
  const goalPct = monthGoal > 0 ? Math.min(100, Math.round((earningsStats.thisMonthEarnings / monthGoal) * 100)) : 0;
  const goalReached = earningsStats.thisMonthEarnings >= monthGoal && monthGoal > 0;
  const goalRemaining = Math.max(0, monthGoal - earningsStats.thisMonthEarnings);

  // 3 ô "mách nước" giúp tài xế kiếm nhiều hơn (đều từ dữ liệu thật)
  const insightTiles = [
    { icon: CalendarDays, tint: 'text-md-tertiary', bg: 'from-[#E8F5E9]/70 to-white border-[#C8E6C9]/60', label: 'Thứ kiếm tốt nhất', value: bestWeekdayLabel, sub: earningsStats.bestWeekday?.amount > 0 ? formatCurrency(earningsStats.bestWeekday.amount) : 'Chưa có dữ liệu' },
    { icon: Clock, tint: 'text-amber-500', bg: 'from-amber-50/70 to-white border-amber-100', label: 'Khung giờ vàng', value: peakHourLabel, sub: earningsStats.peakHourAmount > 0 ? formatCurrency(earningsStats.peakHourAmount) : 'Chưa có dữ liệu' },
    { icon: CalendarCheck, tint: 'text-blue-500', bg: 'from-blue-50/70 to-white border-blue-100', label: 'TB mỗi ngày làm', value: formatCurrency(earningsStats.avgPerActiveDay), sub: `${earningsStats.activeDayCount} ngày chạy tháng này` },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 space-y-6">

      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <DollarSign className="text-md-tertiary" size={26} />
          Thống kê thu nhập
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi thu nhập phí ship thực tế của bạn</p>
      </div>

      {/* ─── HÀNG TRÊN: Tổng thu nhập (2/3) + Mục tiêu tháng (1/3) trên desktop ─── */}
      <div className="grid lg:grid-cols-3 gap-4 items-stretch">
        {/* HERO: tổng thu nhập đã nhận */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-radius-xl p-6 md:p-7 shadow-sm bg-gradient-to-br from-[#2E7D32] to-md-tertiary text-white flex flex-col justify-center">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
          <div className="absolute -right-2 bottom-2 text-white/10">
            <Wallet size={80} />
          </div>
          <div className="relative">
            <span className="text-sm font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
              <Wallet size={16} /> Tổng thu nhập đã nhận
            </span>
            <h2 className="text-4xl md:text-5xl font-black mt-2">
              {formatCurrency(earningsStats.totalEarnings)}
            </h2>
            <p className="text-sm text-white/90 font-semibold mt-2.5 flex items-center gap-1.5">
              <TrendingUp size={15} /> Cộng dồn toàn bộ đơn bạn đã giao xong
            </p>
          </div>
        </div>

        {/* MỤC TIÊU THU NHẬP THÁNG: target + thanh tiến độ + preset */}
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col animate-rise-in">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="p-1.5 rounded-radius-md bg-[#E8F5E9] text-md-tertiary"><Target size={17} /></span>
            <h3 className="text-sm font-extrabold">Mục tiêu tháng này</h3>
          </div>

          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{formatCurrency(earningsStats.thisMonthEarnings)}</p>
              <p className="text-[11px] text-slate-400 font-bold mt-1">/ {formatCurrency(monthGoal)} mục tiêu</p>
            </div>
            <span className={`text-lg font-black tabular-nums ${goalReached ? 'text-md-tertiary' : 'text-slate-500'}`}>{goalPct}%</span>
          </div>

          {/* thanh tiến độ */}
          <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${goalReached ? 'bg-gradient-to-r from-amber-400 to-md-tertiary' : 'bg-gradient-to-r from-[#2E7D32] to-md-tertiary'}`} style={{ width: `${goalPct}%` }} />
          </div>

          <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${goalReached ? 'text-md-tertiary' : 'text-slate-500'}`}>
            {goalReached
              ? <><Trophy size={13} /> Đã đạt mục tiêu tháng này!</>
              : <>Còn <span className="text-md-tertiary">{formatCurrency(goalRemaining)}</span> nữa là đạt</>}
          </p>

          {/* preset chọn nhanh mục tiêu */}
          <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((g) => (
              <button
                key={g}
                onClick={() => setMonthGoal(g)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  monthGoal === g
                    ? 'bg-md-tertiary text-white border-md-tertiary'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-md-tertiary/50 hover:text-md-tertiary'
                }`}
              >
                {g / 1000000}tr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── HÔM NAY · 7 NGÀY · THÁNG NÀY (nổi bật, gradient màu) ─────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className="relative overflow-hidden rounded-radius-xl p-4 md:p-5 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm animate-rise-in">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-emerald-400/10" />
          <div className="relative flex items-center gap-2 text-emerald-700">
            <Sun size={17} className="animate-pulse-slow" />
            <span className="text-xs font-extrabold uppercase tracking-wide">Thu nhập hôm nay</span>
          </div>
          <p className="relative text-2xl md:text-3xl font-black text-slate-800 mt-2 leading-none">{formatCurrency(earningsStats.todayEarnings)}</p>
          <p className="relative text-xs text-slate-500 font-semibold mt-2">{earningsStats.todayCount} đơn hoàn thành hôm nay</p>
        </div>
        <div className="relative overflow-hidden rounded-radius-xl p-4 md:p-5 border border-teal-100 bg-gradient-to-br from-teal-50 to-white shadow-sm animate-rise-in" style={{ animationDelay: '80ms' }}>
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-teal-400/10" />
          <div className="relative flex items-center gap-2 text-teal-700">
            <TrendingUp size={17} className="animate-float" />
            <span className="text-xs font-extrabold uppercase tracking-wide">Thu nhập 7 ngày qua</span>
          </div>
          <p className="relative text-2xl md:text-3xl font-black text-slate-800 mt-2 leading-none">{formatCurrency(earningsStats.week7dEarnings)}</p>
          <p className="relative text-xs text-slate-500 font-semibold mt-2">{earningsStats.week7dCount} đơn trong 7 ngày</p>
        </div>
        {/* Tháng này + so sánh tháng trước (chỉ số người lao động quan tâm nhất) */}
        <div className="relative overflow-hidden rounded-radius-xl p-4 md:p-5 border border-md-tertiary/20 bg-gradient-to-br from-[#E8F5E9] to-white shadow-sm animate-rise-in col-span-2 md:col-span-1" style={{ animationDelay: '160ms' }}>
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-md-tertiary/10" />
          <div className="relative flex items-center gap-2 text-md-tertiary">
            <CalendarRange size={17} className="animate-float" />
            <span className="text-xs font-extrabold uppercase tracking-wide">Thu nhập tháng này</span>
          </div>
          <div className="relative flex items-end gap-2 mt-2">
            <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{formatCurrency(earningsStats.thisMonthEarnings)}</p>
            {(earningsStats.thisMonthEarnings > 0 || earningsStats.lastMonthEarnings > 0) && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.5 rounded-full mb-0.5 ${deltaUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {deltaUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(monthDelta)}%
              </span>
            )}
          </div>
          <p className="relative text-xs text-slate-500 font-semibold mt-2">{earningsStats.thisMonthCount} đơn · so với tháng trước</p>
        </div>
      </div>

      {/* ─── HÀNG KPI: hoàn thành · TB/đơn · đơn phí cao nhất · đánh giá ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '120ms' }}>
          <div className="p-2.5 rounded-radius-md bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110"><CheckCircle2 size={22} /></div>
          <div>
            <span className="text-xl md:text-2xl font-black text-slate-800 block tabular-nums">{earningsStats.completedCount}</span>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Đơn hoàn thành</span>
          </div>
        </div>
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '160ms' }}>
          <div className="p-2.5 rounded-radius-md bg-[#E8F5E9] text-md-tertiary transition-transform group-hover:scale-110"><Wallet size={22} /></div>
          <div>
            <span className="text-xl md:text-2xl font-black text-slate-800 block">{formatCurrency(avgPerOrder)}</span>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">TB mỗi đơn</span>
          </div>
        </div>
        {/* Đơn phí cao nhất */}
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '200ms' }}>
          <div className="p-2.5 rounded-radius-md bg-orange-50 text-orange-500 transition-transform group-hover:scale-110"><Coins size={22} /></div>
          <div>
            <span className="text-xl md:text-2xl font-black text-slate-800 block">{formatCurrency(earningsStats.maxFee)}</span>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Đơn phí cao nhất</span>
          </div>
        </div>
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '240ms' }}>
          <div className="p-2.5 rounded-radius-md bg-amber-50 text-amber-500 transition-transform group-hover:scale-110"><Star size={22} className="fill-amber-400 text-amber-400" /></div>
          <div>
            <span className="text-xl md:text-2xl font-black text-slate-800 block">{earningsStats.rating}</span>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">{earningsStats.ratedCount > 0 ? `Từ ${earningsStats.ratedCount} đánh giá` : 'Đánh giá TB'}</span>
          </div>
        </div>
      </div>

      {/* ─── HAI BIỂU ĐỒ CẠNH NHAU trên desktop: tuần này | 6 tháng ─── */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6 items-start">

      {/* ─── Biểu đồ cột thu nhập theo thứ trong tuần ────────────────────────── */}
      <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            {/* Nhãn đúng bản chất dữ liệu: chỉ gom đơn của TUẦN NÀY theo từng thứ */}
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <BarChart3 size={18} className="text-md-tertiary" /> Thu nhập tuần này theo thứ
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Đơn hoàn thành từ Thứ 2 → Chủ nhật tuần hiện tại
              {hasData && <> · Tổng tuần: <span className="font-black text-md-tertiary">{formatCurrency(earningsStats.thisWeekEarnings)}</span></>}
            </p>
          </div>
          {bestDay && bestDay.amount > 0 && (
            <span className="shrink-0 text-xs font-bold text-md-tertiary bg-[#E8F5E9] border border-[#C8E6C9] px-3 py-1.5 rounded-full flex items-center gap-1">
              <Calendar size={13} /> Cao nhất: {bestDay.day} · {formatCurrency(bestDay.amount)}
            </span>
          )}
        </div>

        {/* Chú thích cách đọc — giúp mọi lứa tuổi hiểu ngay */}
        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-3 bg-slate-50 border border-slate-100 rounded-radius-md px-3 py-2">
          <Info size={14} className="text-md-tertiary shrink-0" /> Cột càng cao là ngày bạn kiếm được càng nhiều. Số tiền ghi ngay trên mỗi cột.
        </p>

        {hasData ? (
          <div className="h-64 w-full text-sm font-semibold">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData} margin={{ top: 22, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 14, fontWeight: 700, fill: '#475569' }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={38} tick={{ fontSize: 13, fill: '#94a3b8' }} tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Thu nhập']} cursor={{ fill: 'rgba(52,168,83,0.06)' }} contentStyle={{ fontSize: 13, fontWeight: 600, borderRadius: 10 }} />
                {/* tô đậm cột ngày cao điểm, các ngày khác nhạt hơn + ghi số tiền trên đầu cột */}
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={54}>
                  {displayData.map((entry, idx) => (
                    <Cell key={idx} fill={bestDay && entry.day === bestDay.day && entry.amount > 0 ? '#2E7D32' : '#34A853'} />
                  ))}
                  <LabelList dataKey="amount" position="top" formatter={(v) => (v > 0 ? `${Math.round(v / 1000)}k` : '')} style={{ fontSize: 13, fontWeight: 800, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Tuần này chưa có đơn → hiện thông báo rõ ràng thay vì biểu đồ trục 0 lỗi */
          <div className="h-56 flex flex-col items-center justify-center text-center gap-3 bg-slate-50/60 rounded-radius-lg border border-dashed border-slate-200">
            <span className="w-16 h-16 rounded-radius-full bg-white border border-slate-200 text-slate-300 flex items-center justify-center animate-float">
              <CalendarDays size={30} />
            </span>
            <div>
              <p className="text-base font-bold text-slate-600">Tuần này chưa có đơn hoàn thành</p>
              <p className="text-sm text-slate-400 font-medium mt-1">Nhận và giao xong đơn để xem thu nhập theo thứ tại đây.</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── BIỂU ĐỒ XU HƯỚNG 6 THÁNG GẦN ĐÂY (bức tranh dài hạn) ─── */}
      <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
        <div className="mb-2">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <BarChart3 size={18} className="text-md-tertiary" /> Xu hướng thu nhập 6 tháng gần đây
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">Tổng phí ship mỗi tháng — xem bạn đang lên hay xuống</p>
        </div>
        {monthlyHasData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 22, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 700, fill: '#475569' }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={38} tick={{ fontSize: 13, fill: '#94a3b8' }} tickFormatter={(v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Thu nhập']} cursor={{ fill: 'rgba(52,168,83,0.06)' }} contentStyle={{ fontSize: 13, fontWeight: 600, borderRadius: 10 }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48} fill="#34A853">
                  <LabelList dataKey="amount" position="top" formatter={(v) => (v > 0 ? `${Math.round(v / 1000)}k` : '')} style={{ fontSize: 12, fontWeight: 800, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center gap-2 bg-slate-50/60 rounded-radius-lg border border-dashed border-slate-200">
            <BarChart3 size={28} className="text-slate-300 animate-float" />
            <p className="text-sm font-bold text-slate-500">Chưa đủ dữ liệu để vẽ xu hướng</p>
          </div>
        )}
      </div>

      </div>{/* đóng grid 2 biểu đồ */}

      {/* ─── 3 Ô MÁCH NƯỚC: thứ kiếm tốt · khung giờ vàng · TB mỗi ngày làm ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {insightTiles.map((t, i) => (
          <div
            key={t.label}
            style={{ animationDelay: `${i * 90}ms` }}
            className={`relative overflow-hidden rounded-radius-xl p-4 border bg-gradient-to-br ${t.bg} shadow-sm animate-rise-in transition-transform hover:-translate-y-0.5`}
          >
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-radius-md bg-white/70 ${t.tint}`}><t.icon size={18} /></span>
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">{t.label}</span>
            </div>
            <p className="text-lg md:text-xl font-black text-slate-800 mt-2.5 leading-none">{t.value}</p>
            <p className="text-xs text-slate-500 font-semibold mt-1.5">{t.sub}</p>
          </div>
        ))}
      </div>

    </div>
  );
}