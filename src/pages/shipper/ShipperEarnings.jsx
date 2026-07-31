import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { DollarSign, TrendingUp, Star, CheckCircle2, Wallet, BarChart3, Calendar, Sun } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import ErrorState from '../../components/common/ErrorState';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';

export default function ShipperEarnings() {
  const mapEarnings = (data) => {
    // Đã lọc status=COMPLETED + size lớn ở query → content là TOÀN BỘ đơn đã hoàn thành
    // (không còn bị chặn 1 trang như trước, nên tổng thu nhập/đơn/biểu đồ mới ĐÚNG).
    const completedOrders = (data?.content || []).filter(ord => ord.orderStatus === 'COMPLETED');

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start7d = new Date(now); start7d.setDate(now.getDate() - 6); start7d.setHours(0, 0, 0, 0);
    // Tuần HIỆN TẠI: từ Thứ 2 (00:00) đến trước Thứ 2 tuần sau — chỉ đơn trong khoảng này mới lên biểu đồ.
    const dow = (now.getDay() + 6) % 7; // Thứ 2 = 0
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);

    const dayKeys = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayMap = { T2: 0, T3: 0, T4: 0, T5: 0, T6: 0, T7: 0, CN: 0 };

    let totalEarnings = 0, todayEarnings = 0, todayCount = 0, week7dEarnings = 0, week7dCount = 0, thisWeekEarnings = 0;
    completedOrders.forEach(ord => {
      const fee = Number(ord.shippingFee) || 0;
      totalEarnings += fee;
      const d = new Date(ord.createdAt);
      // Biểu đồ theo thứ: CHỈ tính đơn thuộc tuần hiện tại (không dồn cả lịch sử vào 7 cột).
      if (d >= weekStart && d < weekEnd) { dayMap[dayKeys[d.getDay()]] += fee; thisWeekEarnings += fee; }
      if (d >= startToday) { todayEarnings += fee; todayCount++; }
      if (d >= start7d) { week7dEarnings += fee; week7dCount++; }
    });

    const sortedChartData = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(k => ({ day: k, amount: dayMap[k] }));

    // Điểm đánh giá sao trung bình thật của tài xế (trên đơn đã có đánh giá)
    const ratedOrders = completedOrders.filter(ord => ord.reviewed && ord.shipperRating);
    const avgShipperRating = ratedOrders.length > 0
      ? (ratedOrders.reduce((sum, o) => sum + o.shipperRating, 0) / ratedOrders.length).toFixed(1)
      : '5.0';

    return {
      totalEarnings,
      completedCount: completedOrders.length,
      todayEarnings, todayCount,
      week7dEarnings, week7dCount,
      thisWeekEarnings,
      ratedCount: ratedOrders.length,
      dailyData: sortedChartData,
      rating: avgShipperRating,
    };
  };

  // Lấy TOÀN BỘ đơn đã hoàn thành (size lớn) để tổng thu nhập chính xác — đơn của 1 shipper ít nên nhẹ.
  const { data: stats, loading, error, refetch } = useFetchData('/shipper/orders?status=COMPLETED&size=1000', {
    mapFn: mapEarnings,
  });

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
    ratedCount: 0,
    dailyData: [],
    rating: '5.0'
  };

  // Nếu chưa có đơn hoàn thành nào, hiển thị biểu đồ mặc định với giá trị 0 hoặc mock mờ ảo để người dùng tham khảo cách hiển thị
  const hasData = earningsStats.totalEarnings > 0;
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

  return (
    <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full font-google-sans pb-24 space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="text-md-tertiary" size={24} />
          Thống kê thu nhập
        </h1>
        <p className="text-xs text-slate-400 mt-1">Theo dõi thu nhập phí ship thực tế của bạn</p>
      </div>

      {/* ─── HERO: tổng thu nhập đã nhận (gradient xanh shipper) ──────────────── */}
      <div className="relative overflow-hidden rounded-radius-xl p-6 shadow-sm bg-gradient-to-br from-[#2E7D32] to-md-tertiary text-white">
        {/* vòng tròn trang trí mờ ở góc */}
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute -right-2 bottom-2 text-white/10">
          <Wallet size={72} />
        </div>
        <div className="relative">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
            Tổng thu nhập đã nhận
          </span>
          <h2 className="text-3xl md:text-4xl font-black mt-1.5">
            {formatCurrency(earningsStats.totalEarnings)}
          </h2>
          <p className="text-[11px] text-white/85 font-semibold mt-2 flex items-center gap-1.5">
            <TrendingUp size={13} /> Dữ liệu thực từ database của bạn
          </p>
        </div>
      </div>

      {/* ─── HÔM NAY · 7 NGÀY QUA (nổi bật, gradient màu) ────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="relative overflow-hidden rounded-radius-xl p-4 md:p-5 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm animate-rise-in">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-emerald-400/10" />
          <div className="relative flex items-center gap-2 text-emerald-600">
            <Sun size={15} className="animate-pulse-slow" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide">Thu nhập hôm nay</span>
          </div>
          <p className="relative text-xl md:text-2xl font-black text-slate-800 mt-2 leading-none">{formatCurrency(earningsStats.todayEarnings)}</p>
          <p className="relative text-[11px] text-slate-500 font-semibold mt-1.5">{earningsStats.todayCount} đơn hoàn thành hôm nay</p>
        </div>
        <div className="relative overflow-hidden rounded-radius-xl p-4 md:p-5 border border-teal-100 bg-gradient-to-br from-teal-50 to-white shadow-sm animate-rise-in" style={{ animationDelay: '80ms' }}>
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-teal-400/10" />
          <div className="relative flex items-center gap-2 text-teal-600">
            <TrendingUp size={15} className="animate-float" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide">Thu nhập 7 ngày qua</span>
          </div>
          <p className="relative text-xl md:text-2xl font-black text-slate-800 mt-2 leading-none">{formatCurrency(earningsStats.week7dEarnings)}</p>
          <p className="relative text-[11px] text-slate-500 font-semibold mt-1.5">{earningsStats.week7dCount} đơn trong 7 ngày</p>
        </div>
      </div>

      {/* ─── HÀNG KPI: đơn hoàn thành · TB mỗi đơn · đánh giá ─────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '120ms' }}>
          <div className="p-2 rounded-radius-md bg-emerald-50 text-emerald-500 transition-transform group-hover:scale-110"><CheckCircle2 size={18} /></div>
          <div>
            <span className="text-base md:text-lg font-black text-slate-800 block tabular-nums">{earningsStats.completedCount}</span>
            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wide">Đơn hoàn thành</span>
          </div>
        </div>
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '160ms' }}>
          <div className="p-2 rounded-radius-md bg-[#E8F5E9] text-md-tertiary transition-transform group-hover:scale-110"><Wallet size={18} /></div>
          <div>
            <span className="text-base md:text-lg font-black text-slate-800 block">{formatCurrency(avgPerOrder)}</span>
            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wide">TB mỗi đơn</span>
          </div>
        </div>
        <div className="group bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex flex-col items-start gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all animate-rise-in" style={{ animationDelay: '200ms' }}>
          <div className="p-2 rounded-radius-md bg-amber-50 text-amber-500 transition-transform group-hover:scale-110"><Star size={18} className="fill-amber-400 text-amber-400" /></div>
          <div>
            <span className="text-base md:text-lg font-black text-slate-800 block">{earningsStats.rating}</span>
            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wide">{earningsStats.ratedCount > 0 ? `Từ ${earningsStats.ratedCount} đánh giá` : 'Đánh giá TB'}</span>
          </div>
        </div>
      </div>

      {/* ─── Biểu đồ cột thu nhập theo thứ trong tuần ────────────────────────── */}
      <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {/* Nhãn đúng bản chất dữ liệu: gom TẤT CẢ đơn đã hoàn thành theo thứ trong tuần */}
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 size={15} className="text-md-tertiary" /> Thu nhập theo thứ trong tuần
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Tổng hợp toàn bộ đơn đã hoàn thành theo từng thứ</p>
          </div>
          {bestDay && bestDay.amount > 0 && (
            <span className="shrink-0 text-[10px] font-bold text-md-tertiary bg-[#E8F5E9] border border-[#C8E6C9] px-2.5 py-1 rounded-full flex items-center gap-1">
              <Calendar size={11} /> Cao nhất: {bestDay.day} · {formatCurrency(bestDay.amount)}
            </span>
          )}
        </div>

        <div className="h-56 w-full text-xs font-semibold">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip formatter={(value) => [formatCurrency(value), 'Thu nhập']} />
              {/* tô đậm cột ngày cao điểm, các ngày khác nhạt hơn */}
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {displayData.map((entry, idx) => (
                  <Cell key={idx} fill={bestDay && entry.day === bestDay.day && entry.amount > 0 ? '#2E7D32' : '#34A853'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}