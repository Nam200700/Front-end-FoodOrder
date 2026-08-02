import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { WEEKDAY_OPTIONS } from '../../utils/dashboardAnalytics';

/** 1 dropdown gọn (đồng bộ kiểu với RangeSelect), theme-aware. options: [{value,label}] */
function Dropdown({ options, value, onChange, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dark = theme === 'dark';
  const current = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const btnCls = dark
    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-purple-900/60'
    : 'bg-white border-slate-200 text-slate-700 hover:border-md-secondary/50';
  const menuCls = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const itemActive = dark ? 'bg-purple-950/40 text-purple-300' : 'bg-md-secondary/10 text-md-secondary';
  const itemIdle = dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50';
  const accent = dark ? 'text-purple-400' : 'text-md-secondary';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-radius-lg border text-[11px] font-bold transition-all cursor-pointer shadow-sm ${btnCls}`}
      >
        <Calendar size={12} className={accent} />
        {current.label}
        <ChevronDown size={12} className={`opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 mt-1.5 w-40 max-h-72 overflow-auto rounded-radius-lg border shadow-xl z-50 p-1 ${menuCls}`}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-radius-md text-[11px] font-bold text-left transition-colors cursor-pointer ${active ? itemActive : itemIdle}`}
              >
                {o.label} {active && <Check size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Bộ lọc chuỗi thời gian theo THÁNG · NĂM · THỨ — dropdown đồng bộ kiểu RangeSelect.
 * props: periods {years,months}, value {year,month,weekday}, onChange, theme 'light'|'dark'
 */
export default function SeriesFilterBar({ periods, value, onChange, theme = 'light' }) {
  const dark = theme === 'dark';
  const { year = 'ALL', month = 'ALL', weekday = 'ALL' } = value || {};
  const set = (patch) => onChange({ year, month, weekday, ...patch });
  const active = year !== 'ALL' || month !== 'ALL' || weekday !== 'ALL';

  const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `Tháng ${Number(m)}/${y}`; };
  const monthOpts = [{ value: 'ALL', label: 'Mọi tháng' }, ...(periods?.months || []).map(ym => ({ value: ym, label: monthLabel(ym) }))];
  const yearOpts = [{ value: 'ALL', label: 'Mọi năm' }, ...(periods?.years || []).map(y => ({ value: String(y), label: `Năm ${y}` }))];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Chọn tháng cụ thể (ưu tiên) — khi chọn tháng thì năm về "Mọi năm" */}
      <Dropdown options={monthOpts} value={month} onChange={(v) => set({ month: v })} theme={theme} />
      {/* Năm (chỉ tác dụng khi không chọn tháng cụ thể) */}
      <Dropdown options={yearOpts} value={month === 'ALL' ? year : 'ALL'} onChange={(v) => set({ year: v, month: 'ALL' })} theme={theme} />
      {/* Thứ trong tuần */}
      <Dropdown options={WEEKDAY_OPTIONS} value={weekday} onChange={(v) => set({ weekday: v })} theme={theme} />
      {active && (
        <button
          onClick={() => onChange({ year: 'ALL', month: 'ALL', weekday: 'ALL' })}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-radius-lg border transition-all cursor-pointer ${
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
