import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/**
 * Nút ⓘ giải thích 1 chỉ số ("hỗ trợ" cho người xem không rành thuật ngữ).
 * Tooltip render qua PORTAL + position:fixed → KHÔNG bao giờ bị cắt bởi ô có overflow/truncate.
 * Hover (desktop) hoặc bấm (mobile). Theme-aware light/dark.
 */
export default function InfoTip({ text, theme = 'light', size = 13, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const dark = theme === 'dark';

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Ghim vào giữa icon nhưng kẹp trong viewport để không tràn mép trái/phải
    const left = Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120);
    setPos({ top: r.top, left });
  };
  const show = () => { place(); setOpen(true); };
  const hide = () => setOpen(false);

  // Cuộn/đổi kích thước khi đang mở → đóng để tránh tooltip "trôi" khỏi icon
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const bubbleCls = dark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-800 text-white border-slate-700';
  const iconCls = dark ? 'text-slate-500 hover:text-purple-400' : 'text-slate-300 hover:text-md-secondary';

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
        className={`inline-flex items-center justify-center align-middle shrink-0 cursor-help transition-colors ${iconCls} ${className}`}
        aria-label="Giải thích"
      >
        <Info size={size} />
      </button>
      {open && pos && createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', top: pos.top - 8, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
          className={`w-56 px-3 py-2 rounded-lg border text-[11px] font-medium leading-relaxed shadow-xl pointer-events-none ${bubbleCls}`}
        >
          {text}
          <span className={`absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 rotate-45 border-r border-b ${bubbleCls}`} />
        </div>,
        document.body
      )}
    </>
  );
}
