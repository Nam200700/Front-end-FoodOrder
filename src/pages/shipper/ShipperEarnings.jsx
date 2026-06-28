import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import ErrorState from '../../components/common/ErrorState';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';

export default function ShipperEarnings() {
  const mapEarnings = (data) => {
    const content = data?.content || [];
    
    // Chỉ lấy các đơn đã hoàn thành để tính thu nhập thực tế
    const completedOrders = content.filter(ord => ord.orderStatus === 'COMPLETED');
    const totalEarnings = completedOrders.reduce((sum, ord) => sum + Number(ord.shippingFee), 0);
    
    // Nhóm doanh thu theo thứ trong tuần từ dữ liệu thật
    const dayMap = {
      'T2': 0, 'T3': 0, 'T4': 0, 'T5': 0, 'T6': 0, 'T7': 0, 'CN': 0
    };

    completedOrders.forEach(ord => {
      const date = new Date(ord.createdAt);
      const dayNum = date.getDay(); // 0: CN, 1: T2, 2: T3, ...
      const dayKeys = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayKey = dayKeys[dayNum];
      dayMap[dayKey] += Number(ord.shippingFee);
    });

    // Bố trí sắp xếp thứ tự hiển thị từ Thứ 2 đến Chủ nhật
    const sortedChartData = [
      { day: 'T2', amount: dayMap['T2'] },
      { day: 'T3', amount: dayMap['T3'] },
      { day: 'T4', amount: dayMap['T4'] },
      { day: 'T5', amount: dayMap['T5'] },
      { day: 'T6', amount: dayMap['T6'] },
      { day: 'T7', amount: dayMap['T7'] },
      { day: 'CN', amount: dayMap['CN'] }
    ];

    // Tính điểm đánh giá sao trung bình thật của tài xế từ database
    const ratedOrders = content.filter(ord => ord.reviewed && ord.shipperRating);
    const totalShipperRating = ratedOrders.reduce((sum, ord) => sum + ord.shipperRating, 0);
    const avgShipperRating = ratedOrders.length > 0 ? (totalShipperRating / ratedOrders.length).toFixed(1) : '5.0';

    return {
      totalEarnings: totalEarnings,
      completedCount: completedOrders.length,
      dailyData: sortedChartData,
      rating: avgShipperRating
    };
  };

  const { data: stats, loading, error, refetch } = useFetchData('/shipper/orders', {
    mapFn: mapEarnings,
  });

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="text-md-tertiary" size={24} />
          Thống kê thu nhập
        </h1>
        <div className="space-y-4 animate-pulse">
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const earningsStats = stats || {
    totalEarnings: 0,
    completedCount: 0,
    dailyData: [],
    rating: '5.0'
  };

  // Nếu chưa có đơn hoàn thành nào, hiển thị biểu đồ mặc định với giá trị 0 hoặc mock mờ ảo để người dùng tham khảo cách hiển thị
  const hasData = earningsStats.totalEarnings > 0;
  const displayData = hasData ? earningsStats.dailyData : [
    { day: 'T2', amount: 0 },
    { day: 'T3', amount: 0 },
    { day: 'T4', amount: 0 },
    { day: 'T5', amount: 0 },
    { day: 'T6', amount: 0 },
    { day: 'T7', amount: 0 },
    { day: 'CN', amount: 0 }
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">
      
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <DollarSign className="text-md-tertiary" size={24} />
        Thống kê thu nhập
      </h1>

      {/* Summary card */}
      <div className="bg-[#E8F5E9] border border-[#C8E6C9] rounded-radius-xl p-5 shadow-sm text-slate-800 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-md-tertiary font-bold uppercase tracking-wider block">
            TỔNG THU NHẬP ĐÃ NHẬN
          </span>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">
            {formatCurrency(earningsStats.totalEarnings)}
          </h2>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span>📈 Dữ liệu thực từ database của bạn</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">ĐƠN HOÀN THÀNH</span>
          <h2 className="text-lg font-bold text-slate-700 mt-1">
            {earningsStats.completedCount} đơn
          </h2>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">
            ⭐ {earningsStats.rating} rating TB
          </span>
        </div>
      </div>

      {/* Bar Chart Earnings */}
      <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 font-extrabold">
          Biểu đồ cột: Thu nhập theo ngày tuần này
        </h3>
        
        <div className="h-56 w-full text-xs font-semibold">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip formatter={(value) => [formatCurrency(value), 'Thu nhập']} />
              <Bar dataKey="amount" fill="#34A853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}