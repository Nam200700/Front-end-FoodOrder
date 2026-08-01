import React from 'react';
import { Calendar, ChevronDown, RotateCcw } from 'lucide-react';
import { WEEKDAY_OPTIONS } from '../../utils/dashboardAnalytics';

/**
 * Bộ lọc chuỗi thời gian theo NĂM · THÁNG · THỨ cho biểu đồ Thống kê.
 * props:
 *  - periods: availablePeriods(series) → { years:[], months:['yyyy-MM'] }
 *  - value: { year, month, weekday }
 *  - onChange: (nextValue) => void
 *  - theme: 'light' | 'dark'
 */
export default function SeriesFilterBar({ periods, value, onChange, theme = 'light' }) {
  const dark = theme === 'dark';
  const { year = 'ALL', month = 'ALL', weekday = 'ALL' } = value || {};
  const set = (patch) => onChange({ year, month, weekday, ...patch });

  const selCls = dark
    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-purple-900/60 focus:border-purple-600'
    : 'bg-white border-slate-200 text-slate-600 hover:border-md-secondary/50 focus:border-md-secondary';
  const iconCls = dark ? 'text-slate-500' : 'text-slate-400';
  const active = year !== 'ALL' || month !== 'ALL' || weekday !== 'ALL';

  const monthLabel = (ym) => {
    const [y, m] = ym.split('-');
    return `Tháng ${Number(m)}/${y}`;
  };

  const Select = ({ val, onSel, children, title }) => (
    <div className="relative">
      <select
        value={val}
        onChange={(e) => onSel(e.target.value)}
        title={title}
        className={`appearance-none pl-8 pr-7 py-1.5 text-[11px] font-bold rounded-radius-lg border outline-none cursor-pointer transition-all ${selCls}`}
      >
        {children}
      </select>
      <Calendar size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${iconCls}`} />
      <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconCls}`} />
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Chọn tháng cụ thể (ưu tiên) — khi chọn tháng thì năm bị vô hiệu */}
      <Select val={month} onSel={(v) => set({ month: v })} title="Lọc theo tháng">
        <option value="ALL">Mọi tháng</option>
        {(periods?.months || []).map((ym) => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
      </Select>

      {/* Chọn năm (chỉ khi không chọn tháng cụ thể) */}
      <Select val={month === 'ALL' ? year : 'ALL'} onSel={(v) => set({ year: v, month: 'ALL' })} title="Lọc theo năm">
        <option value="ALL">Mọi năm</option>
        {(periods?.years || []).map((y) => <option key={y} value={y}>Năm {y}</option>)}
      </Select>

      {/* Chọn thứ trong tuần */}
      <Select val={weekday} onSel={(v) => set({ weekday: v })} title="Lọc theo thứ trong tuần">
        {WEEKDAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>

      {active && (
        <button
          onClick={() => onChange({ year: 'ALL', month: 'ALL', weekday: 'ALL' })}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-radius-lg border transition-all cursor-pointer ${
            dark ? 'border-slate-800 text-slate-400 hover:text-purple-400' : 'border-slate-200 text-slate-500 hover:text-md-secondary'
          }`}
          title="Xoá bộ lọc"
        >
          <RotateCcw size={12} /> Xoá lọc
        </button>
      )}
    </div>
  );
}
