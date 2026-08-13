import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Câu "insight" dẫn dắt đầu trang thống kê — nói NGAY điều quan trọng nhất bằng lời,
 * kèm 1 huy hiệu xu hướng. Màu nhấn theo vai (OWNER #1A73E8, SHIPPER #34A853).
 *
 * Props:
 *  - icon: lucide icon component
 *  - accent: mã màu vai (hex 6 ký tự)
 *  - eyebrow: nhãn nhỏ phía trên (VD "TUẦN NÀY")
 *  - children: câu insight (in đậm số quan trọng ở phía gọi)
 *  - trend: { pct: number } — % thay đổi (dương = tăng, 0 = đi ngang, âm = giảm)
 */
export default function InsightHeadline({ icon: Icon, accent = '#1A73E8', eyebrow, children, trend, className = '' }) {
  const hasTrend = trend && typeof trend.pct === 'number';
  const flat = hasTrend && trend.pct === 0;
  const up = hasTrend && trend.pct > 0;
  const TrendIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const trendColor = flat
    ? 'text-slate-500 bg-slate-100'
    : up ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';

  return (
    <div className={`relative overflow-hidden rounded-radius-xl border border-slate-200/70 bg-white shadow-shadow-1 p-4 md:p-5 flex items-start gap-3.5 ${className}`}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} aria-hidden />
      {Icon && (
        <span
          className="shrink-0 w-9 h-9 rounded-radius-md flex items-center justify-center"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">{eyebrow}</p>
        )}
        <p className="text-sm md:text-[15px] font-semibold text-slate-700 leading-snug">{children}</p>
      </div>
      {hasTrend && (
        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${trendColor}`}>
          <TrendIcon size={13} /> {up ? '+' : ''}{trend.pct}%
        </span>
      )}
    </div>
  );
}
