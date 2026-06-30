import React from 'react';

// valueClassName: cho phép override màu/chữ của số liệu chính (mặc định chữ đậm tối cho
// card nền sáng ở Customer/Merchant; Admin dùng card nền tối nên truyền chữ sáng vào).
export default function KPICard({ title, value, description, icon: Icon, color = 'bg-white border-slate-100', badge, trend, valueClassName = 'text-slate-800' }) {
  return (
    <div className={`rounded-radius-xl p-5 border shadow-sm ${color} transition-all duration-300 hover:shadow-md`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{title}</span>
        {Icon && <Icon size={18} className="text-slate-400" />}
      </div>
      <div className="mb-2">
        <span className={`text-2xl font-black tracking-tight ${valueClassName}`}>{value}</span>
        {description && <p className="text-xs text-slate-450 mt-1 font-medium">{description}</p>}
      </div>
      {badge && (
        <div className="flex justify-between items-center border-t pt-2.5 border-slate-100 mt-2">
          <span className="text-[9px] font-extrabold uppercase text-slate-400">{badge}</span>
          {trend && (
            <span className={`text-[10px] font-bold ${trend.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
