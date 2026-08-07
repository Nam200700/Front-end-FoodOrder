import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { ShipperScene } from '../components/auth/RoleScenes';

/**
 * PinArt — ghim bản đồ "lạc chỗ" thay cho số 0 giữa "404": ghim lắc lư nhẹ,
 * bên trong là dấu ?, dưới chân có vòng GPS ping lan toả (đang dò tìm địa chỉ).
 */
function PinArt() {
  return (
    <svg width="86" height="118" viewBox="0 0 60 82" fill="none" aria-hidden="true" className="mx-0.5 sm:mx-1">
      {/* Vòng GPS ping dưới chân ghim */}
      <ellipse cx="30" cy="74" rx="14" ry="4" fill="#FF6B35" opacity="0.12" />
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <ellipse cx="30" cy="74" rx="12" ry="3.4" fill="none" stroke="#FF6B35" strokeWidth="2"
          className="animate-halo" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      </g>
      {/* Ghim lắc lư quanh mũi nhọn (đáy) */}
      <g className="animate-wiggle" style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        <path d="M30 72 C14 52 8 40 8 27 A22 22 0 0 1 52 27 C52 40 46 52 30 72 Z"
          fill="#FF6B35" stroke="#E85826" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="30" cy="27" r="13" fill="#FFF0E9" />
        {/* Dấu ? bên trong ghim */}
        <path d="M25.5 22.5 a4.5 4.5 0 1 1 6 4.2 c-1.4 0.6 -1.7 1.4 -1.7 2.8"
          fill="none" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <circle cx="29.8" cy="33.4" r="1.8" fill="#FF6B35" />
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-md-surface-1 font-google-sans px-4 overflow-hidden">
      {/* 404 — số 0 giữa là ghim bản đồ lạc chỗ */}
      <div className="flex items-center animate-rise-in">
        <span className="text-7xl sm:text-8xl font-black text-md-primary animate-float">4</span>
        <PinArt />
        <span className="text-7xl sm:text-8xl font-black text-md-primary animate-float" style={{ animationDelay: '0.6s' }}>4</span>
      </div>

      {/* Con đường nét đứt + shipper đi tuần dò tìm địa chỉ */}
      <div className="relative w-72 h-16 -mt-1 animate-rise-in" style={{ animationDelay: '120ms' }}>
        {/* Dấu ? trôi lơ lửng hai bên */}
        <span className="absolute left-2 top-0 text-lg font-black text-md-primary/40 animate-float-slow">?</span>
        <span className="absolute right-4 top-1 text-sm font-black text-md-primary/30 animate-drift">?</span>

        {/* Đường nét đứt chạy */}
        <svg className="absolute inset-x-0 bottom-3 w-full h-4" viewBox="0 0 288 16" fill="none" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="8" x2="288" y2="8" stroke="#E2D5CC" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="10 12" className="animate-dash" />
        </svg>

        {/* Shipper: outer căn giữa, inner chạy tuần (tách để transform không đè) */}
        <div className="absolute left-1/2 bottom-1.5 -translate-x-1/2">
          <div className="animate-patrol">
            <ShipperScene size={46} play style={{ color: '#FF6B35' }} />
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 animate-rise-in" style={{ animationDelay: '180ms' }}>Trang không tồn tại</h2>
      <p className="text-slate-500 text-sm max-w-xs text-center leading-relaxed animate-rise-in" style={{ animationDelay: '240ms' }}>
        Đường dẫn bạn truy cập không hợp lệ hoặc đã bị thay đổi. Vui lòng quay lại trang chủ.
      </p>
      <Link
        to="/"
        className="group mt-4 px-6 py-3 bg-md-primary text-white text-sm font-bold uppercase tracking-wider rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] transition-all flex items-center gap-2 animate-rise-in"
        style={{ animationDelay: '300ms' }}
      >
        <Home size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
        Về trang chủ
      </Link>
    </div>
  );
}
