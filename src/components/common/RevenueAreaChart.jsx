import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Brush } from 'recharts';

export default function RevenueAreaChart({
  data,
  dataKey = 'revenue',
  color = '#6366f1',
  height = 200,
  xKey = 'date',
  areas = [], // Mảng cấu hình các đường vẽ: [{ key, name, color }]
  showLegend = false,
  yTickFormatter,
  chartType = 'area', // 'area' hoặc 'bar'
  brush = false,      // hiện thanh kéo trượt (scroll) để kéo dữ liệu qua lại
  brushWindow = 21    // số điểm hiển thị mặc định khi có brush (mới nhất)
}) {
  // Nếu có areas, dùng areas. Ngược lại dùng dataKey/color mặc định
  const activeAreas = areas.length > 0 ? areas : [{ key: dataKey, name: 'Doanh thu', color: color }];

  // DÀY (nhiều ngày) → tắt chấm marker ở từng điểm để đường mượt, đỡ "răng cưa" & rối mắt;
  // THƯA (≤ 31 điểm) mới hiện chấm cho dễ đọc giá trị từng ngày.
  const pointCount = data?.length || 0;
  const dense = pointCount > 31;
  // Có brush: mặc định hiện cửa sổ brushWindow điểm gần nhất, kéo trượt để xem phần còn lại.
  const showBrush = brush && pointCount > brushWindow;
  const brushStart = showBrush ? pointCount - brushWindow : 0;
  // Nhiều đường chồng nhau → fill nhạt hơn để không bị đục màu; ít đường thì đậm cho nổi khối.
  const fillTop = activeAreas.length > 1 ? 0.12 : 0.22;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -25, bottom: showBrush ? 4 : 0 }}>
          <defs>
            {activeAreas.map((area, idx) => {
              const gradientId = `gradient-area-${idx}`;
              return (
                <linearGradient key={idx} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={area.color || color} stopOpacity={fillTop} />
                  <stop offset="95%" stopColor={area.color || color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            minTickGap={dense ? 28 : 8}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} width={56} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '11px', fontFamily: 'sans-serif', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} iconType="circle" iconSize={9} />}
          {activeAreas.map((area, idx) => {
            const gradientId = `gradient-area-${idx}`;
            const c = area.color || color;
            return chartType === 'bar' ? (
              <Bar
                key={idx}
                name={area.name}
                dataKey={area.key}
                fill={c}
                radius={[4, 4, 0, 0]}
                barSize={dense ? undefined : 18}
                maxBarSize={18}
              />
            ) : (
              <Area
                key={idx}
                type="monotone"
                name={area.name}
                dataKey={area.key}
                stroke={c}
                fill={`url(#${gradientId})`}
                strokeWidth={dense ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={dense ? false : { r: 2.5, strokeWidth: 1.5, fill: '#fff', stroke: c }}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: c }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
