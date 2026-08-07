import React, { Component } from 'react';
import { RotateCw } from 'lucide-react';

/**
 * ErrorArt — minh hoạ động on-brand cho màn báo lỗi: một tô mì bị ĐỔ (ẩn dụ "giao hàng gặp sự cố"),
 * lắc lư trên đáy, khói bốc lên theo khung hình, huy hiệu cảnh báo bật lên, vài mẩu vụn trôi lơ lửng.
 * Không dùng emoji — toàn bộ vẽ bằng SVG. Mọi animation đã có guard prefers-reduced-motion ở index.css.
 */
function ErrorArt() {
  return (
    <svg width="188" height="150" viewBox="0 0 160 130" fill="none" className="mb-1" aria-hidden="true">
      {/* Nền mềm thở nhẹ */}
      <circle cx="80" cy="62" r="50" fill="#FFF3EC" className="animate-pulse-slow" />
      {/* Bóng đổ dưới tô — co giãn theo nhịp lắc */}
      <ellipse cx="80" cy="114" rx="34" ry="5" fill="#000" opacity="0.06" className="animate-pulse-slow" />

      {/* Khói bốc lên trên miệng tô — 2 sợi lệch pha, chuyển động từng khung */}
      <g stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M70 62 q6 -7 0 -14" className="animate-fr-steam"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }} />
        <path d="M88 60 q6 -7 0 -14" className="animate-fr-steam"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: '0.7s' }} />
      </g>

      {/* Tô mì + sợi mì tràn ra — cả cụm lắc lư quanh đáy */}
      <g className="animate-rock" style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        {/* thân tô */}
        <path d="M52 80 Q80 112 108 80 Z" fill="#FFE3D5" stroke="#FF6B35" strokeWidth="4" strokeLinejoin="round" />
        {/* miệng tô */}
        <ellipse cx="80" cy="80" rx="28" ry="7.5" fill="#FFF0E9" stroke="#FF6B35" strokeWidth="4" />
        {/* nước dùng */}
        <ellipse cx="80" cy="80.5" rx="21" ry="4.6" fill="#FFC9A6" />
        {/* sợi mì vắt qua miệng, tràn xuống */}
        <path d="M95 76 q8 4 4 12 q-3 6 3 11" stroke="#F4A340" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M88 78 q4 5 0 10" stroke="#F4A340" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>

      {/* Mẩu vụn văng ra — trôi lơ lửng */}
      <circle cx="34" cy="86" r="3" fill="#F4A340" className="animate-float-slow" />
      <circle cx="126" cy="92" r="2.5" fill="#FF6B35" className="animate-float" style={{ animationDelay: '0.4s' }} />
      <circle cx="120" cy="74" r="2" fill="#FBBF24" className="animate-drift" />
      <circle cx="40" cy="66" r="2.2" fill="#FF6B35" className="animate-float-slow" style={{ animationDelay: '0.9s' }} opacity="0.7" />

      {/* Huy hiệu CẢNH BÁO — bật lên rồi bồng bềnh, kèm vòng lan toả */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-scale-up">
        <g className="animate-float">
          <circle cx="115" cy="46" r="15" fill="#FBBF24" stroke="#fff" strokeWidth="3" />
          {/* tam giác cảnh báo trắng */}
          <path d="M115 39.5 L120.5 50.5 L109.5 50.5 Z" fill="#fff" strokeLinejoin="round" />
          <rect x="114" y="43" width="2" height="4.4" rx="1" fill="#B45309" />
          <circle cx="115" cy="49" r="1.15" fill="#B45309" />
        </g>
        {/* vòng lan toả quanh huy hiệu */}
        <circle cx="115" cy="46" r="15" fill="none" stroke="#FBBF24" strokeWidth="2" className="animate-halo"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      </g>
    </svg>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary caught an error]:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center p-4 bg-slate-50 font-google-sans">
          <div className="animate-rise-in">
            <ErrorArt />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight animate-rise-in" style={{ animationDelay: '80ms' }}>
            Đã xảy ra lỗi không mong muốn
          </h2>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed animate-rise-in" style={{ animationDelay: '140ms' }}>
            Ứng dụng gặp sự cố kỹ thuật ngoài ý muốn. Vui lòng làm mới lại trang để tiếp tục sử dụng.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="group mt-4 px-6 py-2.5 bg-md-primary text-white text-xs font-bold uppercase tracking-wider rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] transition-all cursor-pointer flex items-center gap-2 animate-rise-in"
            style={{ animationDelay: '200ms' }}
          >
            <RotateCw size={14} className="transition-transform duration-500 group-hover:rotate-[360deg]" />
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
