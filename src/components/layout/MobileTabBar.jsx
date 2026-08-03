import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Thanh điều hướng đáy trên MOBILE dùng chung cho các role.
 * Phong cách Material 3 (pill chỉ báo sau icon) + iOS (label luôn rõ) — có animation:
 *  - pill nền nhạt theo màu role hiện ra & icon nhấc nhẹ khi active
 *  - icon phóng to + đổi màu role, label đậm màu role
 *  - badge có viền trắng, nhấp nháy nhẹ; nhấn có phản hồi (scale)
 *
 * Props:
 *  - items: [{ path?, name, icon, badge?, action?, exact? }]  (action → nút mở ngăn kéo "Thêm")
 *  - accent: mã màu role (vd '#FF6B35' khách, '#34A853' shipper)
 *  - rootPath: path gốc để so khớp active theo tiền tố ('/' hoặc '/shipper')
 */
export default function MobileTabBar({ items, accent = '#FF6B35', rootPath = '/' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (item) => {
    if (item.action) return false;
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || (item.path !== rootPath && location.pathname.startsWith(item.path));
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-1.5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.path || item.name}
              onClick={() => (item.action ? item.action() : navigate(item.path))}
              aria-label={item.name}
              aria-current={active ? 'page' : undefined}
              className="group relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full cursor-pointer select-none"
            >
              {/* Icon trong pill chỉ báo (active indicator) */}
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

              {/* Label luôn hiển thị, rõ ràng */}
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
