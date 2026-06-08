import React from 'react';

export default function FilterTabs({ tabs, activeTab, onTabChange, className = '' }) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 rounded-radius-md text-xs font-bold transition-all cursor-pointer ${
            activeTab === tab.id
              ? 'bg-md-primary text-white shadow-sm shadow-md-primary/25'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
