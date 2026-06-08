import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function RevenueAreaChart({ 
  data, 
  dataKey = 'revenue', 
  color = '#6366f1', 
  height = 200, 
  xKey = 'date',
  areas = [], // Mảng cấu hình các đường vẽ: [{ key, name, color }]
  showLegend = false,
  yTickFormatter,
  chartType = 'area' // 'area' hoặc 'bar'
}) {
  // Nếu có areas, dùng areas. Ngược lại dùng dataKey/color mặc định
  const activeAreas = areas.length > 0 ? areas : [{ key: dataKey, name: 'Doanh thu', color: color }];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            {activeAreas.map((area, idx) => {
              const gradientId = `gradient-area-${idx}`;
              return (
                <linearGradient key={idx} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={area.color || color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={area.color || color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
          <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '11px', fontFamily: 'sans-serif' }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: '10px', marginTop: '5px' }} />}
          {activeAreas.map((area, idx) => {
            const gradientId = `gradient-area-${idx}`;
            return chartType === 'bar' ? (
              <Bar 
                key={idx}
                name={area.name}
                dataKey={area.key} 
                fill={area.color || color} 
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
            ) : (
              <Area 
                key={idx}
                type="monotone" 
                name={area.name}
                dataKey={area.key} 
                stroke={area.color || color} 
                fill={`url(#${gradientId})`} 
                strokeWidth={2.5} 
                dot={{ r: 3, strokeWidth: 1, fill: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
