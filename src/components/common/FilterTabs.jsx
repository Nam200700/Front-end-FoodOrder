import React from 'react';

// FilterTabs dùng chung cho cả Customer (accent cam) và Merchant (accent xanh).
// activeClassName cho phép override màu tab đang chọn theo vai trò; MẶC ĐỊNH giữ
// cam md-primary để các trang Customer hiện có không bị đổi.
export default function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  activeClassName = 'bg-md-primary text-white shadow-sm shadow-md-primary/25',
}) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 rounded-radius-md text-xs font-bold transition-all cursor-pointer ${
            activeTab === tab.id
              ? activeClassName
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
