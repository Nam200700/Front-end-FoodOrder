import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

/**
 * Dropdown chọn mốc thời gian (thay cho hàng nút dàn ngang khi có nhiều mốc).
 * Kiểu analytics dashboard: 1 nút gọn hiện mốc đang chọn → bấm bung menu.
 * props: options [{id,label}], value, onChange, theme 'light'|'dark'
 */
export default function RangeSelect({ options, value, onChange, theme = 'light' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dark = theme === 'dark';
  const current = options.find(o => o.id === value) || options[0];

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
    <div ref={ref} className="relative self-start sm:self-center">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-radius-lg border text-xs font-bold transition-all cursor-pointer shadow-sm ${btnCls}`}
      >
        <Calendar size={14} className={accent} />
        {current.label}
        <ChevronDown size={14} className={`transition-transform opacity-70 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-44 max-w-[calc(100vw-2rem)] max-h-80 overflow-auto rounded-radius-lg border shadow-xl z-50 p-1 ${menuCls}`}>
          {options.map(o => {
            const active = o.id === value;
            return (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-radius-md text-xs font-bold text-left whitespace-nowrap transition-colors cursor-pointer ${active ? itemActive : itemIdle}`}
              >
                {o.label} {active && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
