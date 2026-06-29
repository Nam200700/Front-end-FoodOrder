import React, { useState, useEffect } from 'react';
import { Star, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// HeroCarousel
// Carousel ảnh lớn cho các quán NỔI BẬT — tạo "điểm nhấn thèm ăn" ở đầu trang
// Home để khách dễ đặt món hơn. Thuần TRÌNH BÀY: nhận sẵn danh sách quán đã
// fetch ở Home (không tự gọi API) + callback onSelect khi bấm chọn quán.
//
// Hành vi: tự động trượt sau mỗi 4.5s, có nút trái/phải + chấm chỉ vị trí,
// tạm dừng khi hover. Mọi dữ liệu lấy từ props, không đụng store/logic.
// ──────────────────────────────────────────────────────────────────────────
export default function HeroCarousel({ items = [], onSelect }) {
  const [index, setIndex] = useState(0);   // slide đang hiển thị
  const [paused, setPaused] = useState(false); // tạm dừng auto khi hover
  const count = items.length;

  // Vòng tự động trượt; dừng khi hover hoặc chỉ có 1 item.
  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 4500);
    return () => clearInterval(timer);
  }, [paused, count]);

  // Nếu danh sách co lại nhỏ hơn index hiện tại thì đưa về 0 cho an toàn.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  // Chuyển slide theo hướng dir (-1 lùi, +1 tiến), cuộn vòng.
  const go = (dir) => setIndex((i) => (i + dir + count) % count);

  return (
    <div
      className="relative w-full overflow-hidden rounded-radius-xl shadow-shadow-3 group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Khung tỉ lệ 16:7 giữ ảnh hero gọn trên cả mobile & desktop */}
      <div className="relative aspect-[16/7] w-full bg-slate-100">
        {items.map((res, i) => (
          <button
            key={res.id}
            type="button"
            onClick={() => onSelect?.(res)}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            className={`absolute inset-0 w-full h-full text-left transition-opacity duration-700 ease-out ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <img src={res.image} alt={res.name} className="w-full h-full object-cover" />
            {/* Lớp phủ gradient ấm để chữ nổi rõ & kích thích thèm ăn */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

            <div className="absolute left-5 right-5 bottom-5 md:left-8 md:bottom-8">
              <div className="flex flex-wrap gap-2 mb-2">
                {(res.tags || []).slice(0, 2).map((tag, k) => (
                  <span key={k} className="text-[11px] bg-white/90 text-md-on-surface font-extrabold px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-white font-extrabold text-2xl md:text-3xl leading-tight drop-shadow">
                {res.name}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-white/90 text-sm font-bold">
                <span className="flex items-center gap-1 text-amber-300">
                  <Star size={16} className="fill-amber-300" /> {res.rating}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={15} /> {res.time}
                </span>
                <span>{res.distance}</span>
              </div>
              <span className="inline-flex items-center gap-2 mt-4 bg-md-primary text-white font-extrabold text-sm px-5 py-2.5 rounded-radius-full shadow-shadow-2">
                Đặt ngay <ArrowRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Nút điều hướng trái/phải (hiện rõ khi hover khung) */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Quán trước"
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white text-md-on-surface p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Quán kế tiếp"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white text-md-on-surface p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Chấm chỉ vị trí slide (thanh dài = slide hiện tại) */}
      {count > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Tới slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
