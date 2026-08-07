import React, { Component } from 'react';
import { RotateCw } from 'lucide-react';

/**
 * ErrorArt — minh hoạ động on-brand cho màn báo lỗi: một TÔ MÌ RAMEN mặt lo lắng (ẩn dụ "có gì đó
 * không ổn"), rung nhẹ như đang hoảng; đũa gác ngang, chả cá naruto, hơi bốc lên theo khung hình,
 * huy hiệu cảnh báo bật lên, vài mẩu vụn trôi. Không emoji — vẽ hoàn toàn bằng SVG; mọi animation
 * đã có guard prefers-reduced-motion ở index.css.
 */
function ErrorArt() {
  return (
    <svg width="196" height="168" viewBox="0 0 160 140" fill="none" aria-hidden="true">
      {/* Nền mềm thở nhẹ */}
      <circle cx="80" cy="66" r="52" fill="#FFF3EC" className="animate-pulse-slow" />
      {/* Bóng đổ dưới tô */}
      <ellipse cx="80" cy="122" rx="38" ry="5.5" fill="#000" opacity="0.06" className="animate-pulse-slow" />

      {/* Hơi bốc lên — 2 sợi lệch pha, chuyển động từng khung */}
      <g stroke="#D7DEE6" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M72 60 q6 -7 0 -14" className="animate-fr-steam"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }} />
        <path d="M88 58 q6 -7 0 -14" className="animate-fr-steam"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: '0.7s' }} />
      </g>

      {/* Đũa gác chéo qua miệng tô (gỗ) */}
      <g stroke="#D79B5C" strokeWidth="3.2" strokeLinecap="round">
        <path d="M60 74 L36 53" />
        <path d="M64 77 L40 57" />
      </g>

      {/* Cả tô run rẩy bồn chồn — nhiều khung hình (origin đáy) */}
      <g className="animate-bowl-jitter" style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
        {/* Thân tô */}
        <path d="M46 79 C48 98 62 110 80 110 C98 110 112 98 114 79 Z"
          fill="#FFE3D5" stroke="#FF6B35" strokeWidth="4.5" strokeLinejoin="round" />
        {/* Vệt sáng cạnh trái (khối) */}
        <path d="M55 84 C56 95 62 102 70 105" stroke="#FFF6F0" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* Miệng tô */}
        <ellipse cx="80" cy="79" rx="34" ry="9.5" fill="#FFF0E9" stroke="#FF6B35" strokeWidth="4.5" />
        {/* Nước dùng */}
        <ellipse cx="80" cy="79.5" rx="27" ry="6.4" fill="#FFC9A6" />
        {/* Sợi mì cuộn trên mặt nước */}
        <path d="M64 79 q7 -5 15 0 t15 0" stroke="#F4A340" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M67 82 q6 -4 13 0 t13 0" stroke="#F4A340" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
        {/* Chả cá naruto (chi tiết ramen) */}
        <circle cx="93" cy="77.5" r="4.6" fill="#fff" stroke="#FF6B35" strokeWidth="1.6" />
        <path d="M93 77.5 m-2.4 0 a2.4 2.4 0 1 1 2.4 2.4" stroke="#FF8FA3" strokeWidth="1.4" fill="none" strokeLinecap="round" />

        {/* GƯƠNG MẶT LO LẮNG trên thân tô */}
        {/* chân mày nhíu (đầu trong nhướn lên) */}
        <path d="M66 88 L73 90" stroke="#8A4B24" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M94 88 L87 90" stroke="#8A4B24" strokeWidth="2.2" strokeLinecap="round" />
        {/* Mắt — nhóm ngoài CHỚP (scaleY), nhóm trong LIẾC (translateX) */}
        <g className="animate-blink-2d" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <g className="animate-dart-eyes" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <circle cx="71" cy="94.5" r="2.6" fill="#8A4B24" />
            <circle cx="89" cy="94.5" r="2.6" fill="#8A4B24" />
          </g>
        </g>
        {/* miệng méo lo lắng (gợn sóng) — run lập cập */}
        <path d="M73 103 q3.5 -4 7 0 t7 0" stroke="#8A4B24" strokeWidth="2.4" strokeLinecap="round" fill="none"
          className="animate-mouth-quiver" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        {/* giọt mồ hôi — nhỏ giọt trượt xuống rồi rơi (nhiều khung) */}
        <path d="M99 91 q2.4 3 0 5 a1.6 1.6 0 1 1 0 -5 Z" fill="#7FC8F5" className="animate-sweat-2d"
          style={{ transformBox: 'fill-box', transformOrigin: 'top' }} />
      </g>

      {/* Mẩu vụn trôi lơ lửng */}
      <circle cx="30" cy="88" r="3" fill="#F4A340" className="animate-float-slow" />
      <circle cx="130" cy="96" r="2.6" fill="#FF6B35" className="animate-float" style={{ animationDelay: '0.4s' }} />
      <circle cx="126" cy="70" r="2.2" fill="#FBBF24" className="animate-drift" />
      <circle cx="34" cy="64" r="2.2" fill="#FF6B35" className="animate-float-slow" style={{ animationDelay: '0.9s' }} opacity="0.7" />

      {/* Huy hiệu CẢNH BÁO — bật lên rồi bồng bềnh, kèm vòng lan toả */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-scale-up">
        <g className="animate-float">
          <circle cx="118" cy="48" r="15.5" fill="#FBBF24" stroke="#fff" strokeWidth="3" />
          <path d="M118 41 L123.6 52.5 L112.4 52.5 Z" fill="#fff" strokeLinejoin="round" />
          <rect x="117" y="44.6" width="2" height="4.6" rx="1" fill="#B45309" />
          <circle cx="118" cy="51" r="1.15" fill="#B45309" />
        </g>
        <circle cx="118" cy="48" r="15.5" fill="none" stroke="#FBBF24" strokeWidth="2" className="animate-halo"
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
