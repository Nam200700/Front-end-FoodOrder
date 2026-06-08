import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';

const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function DonutChart({ data, label, value, colors = DEFAULT_COLORS, size = 130, onClick, hiddenKeys }) {
  // Lọc các segment bị ẩn, nhưng giữ nguyên index để màu sắc khớp với legend
  const visibleData = data.map((item, i) => ({
    ...item,
    _originalIndex: i,
    value: hiddenKeys && hiddenKeys.has(item.name) ? 0 : item.value
  }));

  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center justify-center mx-auto ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{ width: size, height: size }}
      title={onClick ? "Click để đổi chế độ xem (Số đơn / Số tiền)" : undefined}
    >
      <PieChart width={size} height={size}>
        <Pie 
          data={visibleData} 
          cx="50%" 
          cy="50%" 
          innerRadius="60%" 
          outerRadius="80%" 
          paddingAngle={3} 
          dataKey="value"
        >
          {visibleData.map((item, i) => (
            <Cell key={i} fill={colors[item._originalIndex % colors.length]} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none font-google-sans p-2">
        <span className="donut-label text-[9px] font-extrabold uppercase tracking-wider leading-tight mb-1 text-center max-w-[85px] break-words">{label}</span>
        <span className="donut-value text-sm font-black leading-none text-center max-w-[95px] break-words">{value}</span>
      </div>
    </div>
  );
}

