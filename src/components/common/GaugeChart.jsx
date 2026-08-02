import React, { useState, useEffect } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// GaugeChart
// Biểu đồ "đồng hồ" cung 270° tự vẽ bằng SVG (KHÔNG dùng thư viện chart) để
// tránh kiểu donut generic dễ bị "AI slop". Mỗi hạng mục là một đoạn cung màu
// có đầu bo tròn, ở giữa hiển thị số tổng + nhãn; legend % do component cha vẽ.
//
// PROPS giữ TƯƠNG THÍCH 1-1 với DonutChart cũ để thay thế mà không phải sửa
// state/logic ở trang Stats:
//   - data:       [{ name, value }]
//   - label:      nhãn nhỏ ở giữa (vd "Tổng đơn")
//   - value:      giá trị lớn ở giữa (vd "1.2M")
//   - colors:     mảng màu theo thứ tự hạng mục
//   - size:       đường kính px
//   - onClick:    bấm để đổi chế độ xem (số đơn / số tiền)
//   - hiddenKeys: Set tên hạng mục đang bị ẩn (vẫn giữ index màu khớp legend)
// ──────────────────────────────────────────────────────────────────────────

// Cấu hình hình học của cung: mở 90° ở đáy, vẽ 270° vòng lên trên.
const SWEEP = 270;        // tổng góc quét (độ)
const START = 225;        // góc bắt đầu (đáy-trái), tính từ đỉnh, theo chiều kim đồng hồ
const GAP_DEG = 4;        // khoảng hở giữa 2 đoạn (độ) cho thoáng
const STROKE = 11;        // độ dày nét cung (trên hệ toạ độ viewBox 100)
const R = 42;             // bán kính cung

// Đổi toạ độ cực -> Đề-các. Quy ước: 0° = đỉnh (12h), tăng theo chiều kim đồng hồ.
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Tạo chuỗi path cho một cung từ startDeg -> endDeg (theo chiều kim đồng hồ).
function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  // sweep-flag = 1: vẽ theo chiều kim đồng hồ (khớp quy ước góc ở trên).
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function GaugeChart({ data, label, value, colors = [], size = 140, onClick, hiddenKeys }) {
  const cx = 50;
  const cy = 50;

  // Giữ index gốc để màu khớp legend; ẩn hạng mục => value = 0 (không vẽ đoạn).
  const items = (data || []).map((item, i) => ({
    name: item.name,
    _originalIndex: i,
    value: hiddenKeys && hiddenKeys.has(item.name) ? 0 : Number(item.value) || 0,
  }));

  const total = items.reduce((sum, it) => sum + it.value, 0);

  // Tính từng đoạn cung theo tỉ lệ value/total trong tổng góc 270°.
  let cursor = START;
  const segments = [];
  items.forEach((it) => {
    if (it.value <= 0 || total <= 0) return;
    const span = (it.value / total) * SWEEP;
    // Thụt mỗi đầu nửa khoảng hở để tạo khe giữa các đoạn (chỉ khi đoạn đủ rộng).
    const inset = span > GAP_DEG ? GAP_DEG / 2 : 0;
    segments.push({
      d: arcPath(cx, cy, R, cursor + inset, cursor + span - inset),
      color: colors[it._originalIndex % colors.length] || '#1A73E8',
    });
    cursor += span;
  });

  // Animation vẽ cung: chạy lại mỗi khi dữ liệu/chế độ đổi (ẩn/hiện hạng mục, đổi số đơn↔tiền).
  const sig = items.map((it) => it.value).join(',');
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    const t = setTimeout(() => setDrawn(true), 40);
    return () => clearTimeout(t);
  }, [sig]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center mx-auto ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{ width: size, height: size }}
      title={onClick ? 'Click để đổi chế độ xem (Số đơn / Số tiền)' : undefined}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
        {/* Cung nền (track) chạy đủ 270° làm khung mờ phía sau */}
        <path
          d={arcPath(cx, cy, R, START, START + SWEEP)}
          fill="none"
          stroke="currentColor"
          className="text-slate-200/70"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Các đoạn cung màu theo từng hạng mục — vẽ dần (draw-in) lệch nhịp */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={100}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: drawn ? 0 : 100,
              transition: `stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1) ${i * 0.12}s`,
            }}
          />
        ))}
      </svg>

      {/* Số tổng + nhãn ở chính giữa (tái dùng class donut-* để khớp theme sáng/tối) */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none font-google-sans p-2 transition-all duration-500"
        style={{ opacity: drawn ? 1 : 0, transform: drawn ? 'scale(1)' : 'scale(0.86)' }}
      >
        <span className="donut-label text-[9px] font-extrabold uppercase tracking-wider leading-tight mb-1 text-center max-w-[85px] break-words">
          {label}
        </span>
        <span className="donut-value text-sm font-black leading-none text-center max-w-[95px] break-words">
          {value}
        </span>
      </div>
    </div>
  );
}
