import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Thanh điều hướng đáy MOBILE dùng chung cho các role.
 * Phong cách hiện đại (ngân hàng/Instagram): 5 mục, MỘT mục chính được "nâng nổi" (elevated,
 * docked) ở giữa như nút hành động chủ đạo — kèm animation:
 *  - mục thường: pill chỉ báo Material 3 sau icon, icon nhấc + đổi màu role, label đậm màu role.
 *  - mục chính (primary): nút tròn nổi lên trên mép thanh, nền màu role, icon trắng, có quầng sáng
 *    + nhún khi nhấn; đang mở đúng trang thì có vòng ring nổi bật hơn.
 *  - label luôn hiện & canh đáy đồng đều; badge có viền trắng nhấp nháy.
 *
 * Props:
 *  - items: [{ path?, name, icon, badge?, action?, exact?, primary? }]  (đặt primary ở giữa mảng)
 *  - accent: mã màu role ('#FF6B35' khách · '#34A853' shipper)
 *  - rootPath: path gốc để so khớp active theo tiền tố
 */
export default function MobileTabBar({ items, accent = '#FF6B35', rootPath = '/' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (item) => {
    if (item.action) return false;
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || (item.path !== rootPath && location.pathname.startsWith(item.path));
  };

  const go = (item) => (item.action ? item.action() : navigate(item.path));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-1.5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          // ── MỤC CHÍNH: nút tròn nổi lên (elevated center action) ──
          if (item.primary) {
            return (
              <button
                key={item.path || item.name}
                onClick={() => go(item)}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
                className="group relative flex flex-col items-center justify-end pb-1.5 flex-1 min-w-0 h-full cursor-pointer select-none"
              >
                <span
                  className={`absolute -top-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center text-white ring-4 ring-white transition-all duration-300 ease-out group-active:scale-90 ${
                    active ? 'scale-105' : 'group-hover:scale-105'
                  }`}
                  style={{ backgroundColor: accent, boxShadow: `0 8px 20px ${accent}66` }}
                >
                  <Icon size={24} strokeWidth={2.4} className="transition-transform duration-300" />
                  {item.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-white text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow" style={{ color: accent }}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] leading-none tracking-tight font-extrabold truncate max-w-full" style={{ color: accent }}>
                  {item.name}
                </span>
              </button>
            );
          }

          // ── MỤC THƯỜNG: pill chỉ báo Material 3 ──
          return (
            <button
              key={item.path || item.name}
              onClick={() => go(item)}
              aria-label={item.name}
              aria-current={active ? 'page' : undefined}
              className="group relative flex flex-col items-center justify-end pb-1.5 gap-1 flex-1 min-w-0 h-full cursor-pointer select-none"
            >
              <span
                className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 ease-out ${
                  active ? 'w-11 h-7 -translate-y-0.5' : 'w-9 h-7 group-active:scale-90'
                }`}
                style={active ? { backgroundColor: `${accent}1F` } : undefined}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.6 : 2}
                  className={`transition-all duration-300 ${active ? 'scale-110' : 'text-slate-400 group-hover:text-slate-500'}`}
                  style={active ? { color: accent } : undefined}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[8px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] leading-none tracking-tight transition-all duration-200 truncate max-w-full ${
                  active ? 'font-extrabold' : 'font-medium text-slate-400'
                }`}
                style={active ? { color: accent } : undefined}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
