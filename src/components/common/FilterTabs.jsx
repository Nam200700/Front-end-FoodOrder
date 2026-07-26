import React from 'react';

// FilterTabs dùng chung cho cả Customer (accent cam) và Merchant (accent xanh).
// activeClassName cho phép override màu tab đang chọn theo vai trò; MẶC ĐỊNH giữ
// cam md-primary để các trang Customer hiện có không bị đổi.
// counts (tuỳ chọn): object { [tab.id]: number } — hiện badge số lượng sau nhãn để
// người dùng biết mỗi trạng thái đang có bao nhiêu mục mà không cần bấm vào.
export default function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  activeClassName = 'bg-md-primary text-white shadow-sm shadow-md-primary/25',
  counts = null,
}) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        // Số đếm ưu tiên counts[tab.id], fallback tab.count nếu truyền sẵn trong mảng tabs
        const count = counts?.[tab.id] ?? tab.count;
        const hasCount = count !== undefined && count !== null;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 rounded-radius-md text-xs font-bold transition-all cursor-pointer inline-flex items-center ${
              isActive
                ? activeClassName
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tab.label}
            {hasCount && (
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold leading-none ${
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
