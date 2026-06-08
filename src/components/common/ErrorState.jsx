import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({ title = 'Đã xảy ra lỗi', message = 'Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại!', onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-radius-xl border border-slate-200/40 font-google-sans space-y-4 max-w-sm mx-auto my-6 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100 animate-bounce">
        <AlertTriangle size={20} />
      </div>
      <div>
        <h3 className="font-extrabold text-sm text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4.5 py-1.8 bg-md-primary text-white text-xs font-bold rounded-radius-full shadow-sm hover:bg-opacity-95 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <RefreshCw size={12} />
          Thử lại
        </button>
      )}
    </div>
  );
}
