import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

/**
 * Thẻ DỰ BÁO CUỐI THÁNG theo tốc độ (run-rate) — số dự phóng, ghi rõ "dự báo" để
 * không nhầm là số đã đạt. So với tháng trước để thấy đang trên/dưới đà.
 *
 * props:
 *  - forecast: kết quả monthEndForecast()
 *  - formatValue: (number) => string
 *  - theme: 'light' | 'dark'
 *  - accent: { text, bar } tailwind classes (mặc định tím admin)
 *  - title: tiêu đề (mặc định 'Dự báo cuối tháng')
 */
export default function ForecastCard({ forecast, formatValue, theme = 'dark', accent, title = 'Dự báo cuối tháng' }) {
  if (!forecast) return null;
  const dark = theme === 'dark';
  const ac = accent || { text: dark ? 'text-purple-400' : 'text-md-secondary', bar: dark ? 'bg-purple-500' : 'bg-md-secondary' };

  const vs = forecast.vsLastMonth;
  const DirIcon = vs.dir === 'up' ? TrendingUp : vs.dir === 'down' ? TrendingDown : Minus;
  const dirCls = !vs.has
    ? (dark ? 'text-slate-500' : 'text-slate-400')
    : vs.dir === 'up' ? (dark ? 'text-emerald-400' : 'text-emerald-600')
    : vs.dir === 'down' ? (dark ? 'text-red-400' : 'text-rose-500')
    : (dark ? 'text-slate-400' : 'text-slate-500');

  const cardCls = dark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/60';
  const headCls = dark ? 'text-slate-200' : 'text-slate-800';
  const mutedCls = dark ? 'text-slate-500' : 'text-slate-400';
  const strongCls = dark ? 'text-slate-100' : 'text-slate-800';
  const trackCls = dark ? 'bg-slate-800' : 'bg-slate-100';

  // Tiến độ so với tháng trước (mốc = tổng tháng trước). Cap thanh ở 100% để dễ nhìn.
  const pct = forecast.progressPct;
  const barPct = pct == null ? 0 : Math.min(100, pct);

  return (
    <div className={`rounded-radius-xl border p-5 shadow-sm ${cardCls}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${headCls}`}>
          <Sparkles size={15} className={ac.text} /> {title}
        </h3>
        <span className={`text-[10px] font-bold ${mutedCls}`}>
          Ngày {forecast.daysElapsed}/{forecast.daysInMonth}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-wide ${mutedCls}`}>Đến hôm nay</div>
          <div className={`text-base font-black tabular-nums ${strongCls}`}>{formatValue(forecast.mtdValue)}</div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] font-bold uppercase tracking-wide ${mutedCls} flex items-center gap-1 justify-end`}>
            <Target size={11} className={ac.text} /> Dự báo cả tháng
          </div>
          <div className={`text-xl font-black tabular-nums ${ac.text}`}>~{formatValue(forecast.projValue)}</div>
        </div>
      </div>

      {/* Thanh tiến độ so với tháng trước */}
      <div className="mt-3">
        <div className={`flex items-center justify-between text-[10px] font-bold mb-1 ${mutedCls}`}>
          <span>So tháng trước: {formatValue(forecast.lastMonthValue)}</span>
          <span className={`inline-flex items-center gap-0.5 ${dirCls}`}>
            <DirIcon size={11} /> {vs.has ? `${vs.pct >= 0 ? '+' : ''}${vs.pct}% (dự báo)` : 'chưa đủ mốc'}
          </span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${trackCls}`}>
          <div className={`h-full rounded-full ${ac.bar} transition-all duration-700`} style={{ width: `${barPct}%` }} />
        </div>
        <p className={`text-[10px] font-medium mt-1.5 leading-relaxed ${mutedCls}`}>
          Ước tính theo tốc độ trung bình {forecast.daysElapsed} ngày đầu tháng · còn {forecast.daysLeft} ngày.
        </p>
      </div>
    </div>
  );
}
