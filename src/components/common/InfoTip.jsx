import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

/**
 * Nút ⓘ giải thích ý nghĩa 1 chỉ số/khu vực — "hỗ trợ" cho người xem không rành thuật ngữ.
 * Hover (desktop) hoặc bấm (mobile) để hiện tooltip. Theme-aware light/dark.
 *
 * props: text (nội dung giải thích), theme 'light'|'dark', size (px icon), className
 */
export default function InfoTip({ text, theme = 'light', size = 13, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dark = theme === 'dark';

  // Bấm ra ngoài → đóng (cho mobile/tap)
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const iconCls = dark ? 'text-slate-500 hover:text-purple-400' : 'text-slate-300 hover:text-md-secondary';
  const bubbleCls = dark
    ? 'bg-slate-800 text-slate-200 border-slate-700'
    : 'bg-slate-800 text-white border-slate-700';

  return (
    <span
      ref={ref}
      className={`relative inline-flex group align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center justify-center cursor-help transition-colors ${iconCls}`}
        aria-label="Giải thích"
        title=""
      >
        <Info size={size} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 px-3 py-2 rounded-lg border text-[11px] font-medium leading-relaxed shadow-xl ${bubbleCls}`}
        >
          {text}
          <span className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 border-r border-b ${bubbleCls}`} />
        </span>
      )}
    </span>
  );
}
