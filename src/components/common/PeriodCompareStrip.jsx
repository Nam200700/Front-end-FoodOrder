import React from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarDays, CalendarRange, CalendarCheck } from 'lucide-react';

/**
 * Dải SO SÁNH KỲ: Hôm nay↔hôm qua · Tuần này↔tuần trước · Tháng này↔tháng trước.
 * Dùng cho cả admin (theme='dark') lẫn owner (theme='light').
 *
 * props:
 *  - comparison: kết quả periodComparison() → { day, week, month }
 *  - formatValue: (number) => string  (vd formatCurrency)
 *  - theme: 'light' | 'dark'
 *  - accent: tailwind text color cho icon (vd 'text-purple-400' / 'text-md-secondary')
 *  - unit: đơn vị đếm phụ (mặc định 'đơn')
 */
export default function PeriodCompareStrip({ comparison, formatValue, theme = 'light', accent = 'text-md-secondary', unit = 'đơn' }) {
  if (!comparison) return null;
  const dark = theme === 'dark';
  const items = [
    { key: 'day', label: 'Hôm nay', sub: 'so với hôm qua', icon: CalendarDays, d: comparison.day },
    { key: 'week', label: 'Tuần này', sub: 'so với tuần trước', icon: CalendarRange, d: comparison.week },
    { key: 'month', label: 'Tháng này', sub: 'so với tháng trước', icon: CalendarCheck, d: comparison.month },
  ];

  const cardCls = dark
    ? 'bg-slate-950 border-slate-800'
    : 'bg-white border-slate-200/60';
  const labelCls = dark ? 'text-slate-400' : 'text-slate-400';
  const valueCls = dark ? 'text-slate-100' : 'text-slate-800';
  const subCls = dark ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map(({ key, label, sub, icon: Icon, d }) => {
        const dl = d.valueDelta;
        const DirIcon = dl.dir === 'up' ? TrendingUp : dl.dir === 'down' ? TrendingDown : Minus;
        const dirCls = !dl.has
          ? (dark ? 'text-slate-500' : 'text-slate-400')
          : dl.dir === 'up' ? (dark ? 'text-emerald-400' : 'text-emerald-600')
          : dl.dir === 'down' ? (dark ? 'text-red-400' : 'text-rose-500')
          : (dark ? 'text-slate-400' : 'text-slate-500');
        return (
          <div key={key} className={`rounded-radius-xl border p-4 shadow-sm ${cardCls}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${labelCls}`}>
                <Icon size={13} className={accent} /> {label}
              </span>
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${dirCls}`}>
                <DirIcon size={12} />
                {dl.has ? `${dl.pct >= 0 ? '+' : ''}${dl.pct}%` : '—'}
              </span>
            </div>
            <div className={`text-lg font-black mt-1.5 tabular-nums ${valueCls}`}>{formatValue(d.cur)}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${subCls}`}>
              {d.curCount} {unit} · {sub}: {formatValue(d.prev)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
