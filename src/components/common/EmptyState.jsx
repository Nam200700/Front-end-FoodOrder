import React from 'react';
import { Archive, Plus } from 'lucide-react';

export default function EmptyState({ title = 'Danh sách trống', message = 'Chưa có dữ liệu nào trong mục này.', icon: Icon = Archive, actionText, onAction, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-10 text-center bg-white rounded-radius-xl border border-slate-200/40 font-google-sans space-y-4 max-w-sm mx-auto my-6 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="font-extrabold text-sm text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">{message}</p>
      </div>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4.5 py-1.8 bg-md-primary text-white text-xs font-bold rounded-radius-full shadow-sm hover:bg-opacity-95 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          {actionText}
        </button>
      )}
    </div>
  );
}
