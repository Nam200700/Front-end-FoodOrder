import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-md-surface-1 font-google-sans">
      <h1 className="text-6xl font-black text-md-primary animate-bounce">404</h1>
      <h2 className="text-2xl font-bold text-slate-800">Trang không tồn tại</h2>
      <p className="text-slate-500 text-sm max-w-xs text-center leading-relaxed">
        Đường dẫn bạn truy cập không hợp lệ hoặc đã bị thay đổi. Vui lòng quay lại trang chủ.
      </p>
      <Link 
        to="/" 
        className="mt-4 px-6 py-3 bg-md-primary text-white text-sm font-bold uppercase tracking-wider rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] transition-all"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
