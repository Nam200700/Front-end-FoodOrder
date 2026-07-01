import React, { useState, useEffect, useMemo } from 'react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import KPICard from '../../components/common/KPICard';
import GaugeChart from '../../components/common/GaugeChart';
import {
  ClipboardList, TrendingUp, ShoppingBag, Users, DollarSign,
  Award, Calendar, CreditCard, Percent, Store, Flame, BarChart3, AreaChart
} from 'lucide-react';
import { filterByDateRange } from '../../utils/filterUtils';
import FilterTabs from '../../components/common/FilterTabs';

// Bảng màu báo cáo Merchant: DẪN ĐẦU bằng xanh dương #1A73E8 (màu thương hiệu
// merchant), tuyệt đối KHÔNG dùng cam #FF6B35 của Customer. Các màu sau mang ý
// nghĩa ngữ nghĩa (xanh lá = tốt, vàng = chờ, đỏ = huỷ, tím/teal phụ trợ).
const COLORS = ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#9C27B0', '#00897B'];

export default function MerchantStats() {
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterRange, setFilterRange] = useState('all'); // 7days, 30days, thisMonth, all
  const [merchantPieMode, setMerchantPieMode] = useState('count'); // count, amount
  const [chartType, setChartType] = useState('area'); // area, bar
  const [hiddenPaymentKeys, setHiddenPaymentKeys] = useState(new Set());
  const [hiddenStatusKeys, setHiddenStatusKeys] = useState(new Set());

  const togglePaymentKey = (name) => setHiddenPaymentKeys(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const toggleStatusKey = (name) => setHiddenStatusKeys(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/merchant/restaurant');
        const resData = response.data?.data;
        if (resData) {
          setRestaurantId(resData.restaurantId || resData.id);
        }
      } catch (err) {
        console.warn('OWNER chưa tạo nhà hàng:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, []);

  useEffect(() => {
    const fetchAllOrders = async () => {
      if (!restaurantId) return;
      try {
        setLoading(true);
        // Gọi API lấy toàn bộ đơn hàng thật của quán và stats từ backend
        const [ordersRes, statsRes] = await Promise.all([
          apiClient.get(`/merchant/orders?restaurantId=${restaurantId}&size=2000`),
          apiClient.get(`/merchant/stats?restaurantId=${restaurantId}`)
        ]);
        const content = ordersRes.data?.data?.content || ordersRes.data?.data || [];
        setAllOrders(content);
        setStats(statsRes.data?.data);
      } catch (err) {
        console.error('Lỗi lấy thống kê thật của merchant:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllOrders();
  }, [restaurantId]);

  // Bộ lọc dữ liệu đơn hàng theo thời gian
  const filteredOrders = useMemo(() => {
    return filterByDateRange(allOrders, filterRange);
  }, [allOrders, filterRange]);

  // Phân tích và tính toán các chỉ số KPI tài chính tách bạch rõ ràng
  const statsSummary = useMemo(() => {
    const completed = filteredOrders.filter(ord => ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED');
    const cancelled = filteredOrders.filter(ord => ord.orderStatus === 'CANCELLED');
    
    // Tổng giá trị đơn hoàn tất (Bao gồm phí ship)
    const totalGTV = completed.reduce((sum, ord) => sum + Number(ord.totalAmount || 0), 0);
    
    // Tổng tiền món ăn thật sự (Subtotal Amount) của các đơn hoàn tất
    const totalSubtotal = completed.reduce((sum, ord) => {
      // Nếu có subtotalAmount từ DB thì lấy, nếu không tự tính bằng totalAmount - shippingFee
      const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
        ? Number(ord.subtotalAmount)
        : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
      return sum + sub;
    }, 0);

    // Hoa hồng sàn khấu trừ trên tiền món ăn (đọc động từ stats hoặc mặc định 10%)
    const commission = totalSubtotal * (stats?.commissionRate || 0.1);

    // Doanh thu thực nhận của quán sau khấu trừ
    const merchantEarnings = totalSubtotal - commission;

    // Tổng phí ship của đơn (trả cho Shipper)
    const totalShippingFee = completed.reduce((sum, ord) => sum + Number(ord.shippingFee || 0), 0);

    const totalOrders = filteredOrders.length;
    const completedCount = completed.length;
    const cancelledCount = cancelled.length;
    
    // Giá trị đơn trung bình (AOV) thực tế dựa trên tiền món ăn
    const aov = completedCount > 0 ? totalSubtotal / completedCount : 0;
    
    // Đếm khách hàng duy nhất (Unique Customers)
    const uniqueCustomers = new Set();
    filteredOrders.forEach(ord => {
      if (ord.customerId || ord.customerPhone) {
        uniqueCustomers.add(ord.customerId || ord.customerPhone);
      }
    });

    return {
      gtv: totalGTV,
      subtotal: totalSubtotal,
      commission,
      earnings: merchantEarnings,
      shipping: totalShippingFee,
      totalOrders,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount,
      aov,
      uniqueCustomers: uniqueCustomers.size
    };
  }, [filteredOrders]);

  // Phân tích biểu đồ doanh thu quán & đơn hàng theo chuỗi ngày (ngày thực tế từ dữ liệu thật)
  const timelineChartData = useMemo(() => {
    const dailyMap = {};
    
    filteredOrders.forEach(ord => {
      if (!ord.createdAt) return;
      const date = new Date(ord.createdAt);
      const dateStr = date.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
      
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { dateStr, 'Doanh thu món': 0, 'Thực nhận': 0, 'Đơn hàng': 0 };
      }
      
      dailyMap[dateStr]['Đơn hàng']++;
      if (ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED') {
        const amount = Number(ord.totalAmount || 0);
        const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
          ? Number(ord.subtotalAmount)
          : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
        dailyMap[dateStr]['Doanh thu món'] += sub;
        dailyMap[dateStr]['Thực nhận'] += sub * (1 - (stats?.commissionRate || 0.1)); // Trừ hoa hồng động
      }
    });

    // Sắp xếp theo ngày tăng dần
    return Object.values(dailyMap).sort((a, b) => {
      const [dayA, monthA] = a.dateStr.split('/').map(Number);
      const [dayB, monthB] = b.dateStr.split('/').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
  }, [filteredOrders]);

  // Cơ cấu trạng thái thanh toán (Payment Status Distribution)
  const paymentChartData = useMemo(() => {
    const statusMap = {};
    filteredOrders.forEach(ord => {
      const status = ord.paymentStatus || 'PENDING';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, amount: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].amount += Number(ord.totalAmount || 0);
    });

    const statusLabels = {
      'PAID': 'Đã thanh toán',
      'PENDING': 'Chờ thanh toán',
      'REFUNDED': 'Đã hoàn tiền',
      'FAILED': 'Thất bại'
    };

    return Object.keys(statusMap).map(key => ({
      name: statusLabels[key] || key,
      value: merchantPieMode === 'count' ? statusMap[key].count : statusMap[key].amount,
      count: statusMap[key].count,
      amount: statusMap[key].amount
    }));
  }, [filteredOrders, merchantPieMode]);

  // Cơ cấu trạng thái đơn hàng
  const statusChartData = useMemo(() => {
    const statusMap = {};
    filteredOrders.forEach(ord => {
      const status = ord.orderStatus || 'PENDING';
      if (!statusMap[status]) {
        statusMap[status] = { count: 0, amount: 0 };
      }
      statusMap[status].count += 1;
      statusMap[status].amount += Number(ord.totalAmount || 0);
    });

    const statusLabels = {
      'COMPLETED': 'Thành công',
      'CANCELLED': 'Đã huỷ',
      'DELIVERING': 'Đang giao',
      'PREPARING': 'Chuẩn bị',
      'CONFIRMED': 'Đã nhận',
      'PENDING': 'Chờ duyệt',
      'READY_FOR_PICKUP': 'Chờ shipper',
      'PICKED_UP': 'Shipper lấy'
    };

    return Object.keys(statusMap).map(key => ({
      name: statusLabels[key] || key,
      value: merchantPieMode === 'count' ? statusMap[key].count : statusMap[key].amount,
      count: statusMap[key].count,
      amount: statusMap[key].amount
    }));
  }, [filteredOrders, merchantPieMode]);

  // Top 5 món ăn bán chạy nhất (Deep-dive Top Foods)
  const topSellingFoods = useMemo(() => {
    const foodMap = {};
    const completed = filteredOrders.filter(ord => ord.orderStatus === 'COMPLETED');
    
    completed.forEach(ord => {
      const items = ord.items || [];
      items.forEach(item => {
        const name = item.foodName || item.name;
        if (!name) return;
        const qty = Number(item.quantity || item.qty || 0);
        const price = Number(item.priceAtOrder || 0);
        // Tính toán doanh thu món ăn thật sự từ priceAtOrder * qty
        const itemRevenue = price > 0 ? price * qty : (Number(ord.subtotalAmount || ord.totalAmount - (ord.shippingFee || 0)) / items.length);

        if (!foodMap[name]) {
          foodMap[name] = { name, qty: 0, revenue: 0 };
        }
        foodMap[name].qty += qty;
        foodMap[name].revenue += itemRevenue;
      });
    });

    return Object.values(foodMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredOrders]);

  if (!restaurantId && !loading) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs leading-relaxed">Bạn cần tạo và đăng ký nhà hàng của mình để xem báo cáo thống kê chuyên sâu.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans space-y-6 pb-24 text-slate-800">
      
      {/* Upper Section (Header & Filter Buttons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-radius-md bg-md-secondary/10 text-md-secondary flex items-center justify-center shrink-0">
              <Store size={20} />
            </span>
            Báo Cáo Tài Chính Nhà Hàng
          </h1>
        </div>

        {/* Filter Tabs */}
        <FilterTabs
          tabs={[
            { id: '7days', label: '7 Ngày' },
            { id: '30days', label: '30 Ngày' },
            { id: 'thisMonth', label: 'Tháng Này' },
            { id: 'all', label: 'Tất Cả' }
          ]}
          activeTab={filterRange}
          onTabChange={setFilterRange}
          className="self-start sm:self-center bg-slate-100 p-1 rounded-radius-lg border border-slate-200/40"
          activeClassName="bg-md-secondary text-white shadow-sm shadow-md-secondary/25"
        />
      </div>

      {loading && allOrders.length === 0 ? (
        <Spinner />
      ) : (
        <>
          {/* Bento Grid Financial Details (Tách bạch dòng tiền rõ ràng) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Doanh Thu Thực Nhận"
              value={formatCurrency(statsSummary.earnings)}
              description={`Sau khi trừ ${stats ? Math.round(stats.commissionRate * 100) : 10}% hoa hồng sàn`}
              icon={DollarSign}
              color="border-md-secondary/15 bg-md-secondary-container/5 text-md-secondary bg-white"
            />

            <KPICard
              title="Tổng Tiền Món Ăn"
              value={formatCurrency(statsSummary.subtotal)}
              description="Khớp 100% với tổng doanh thu món"
              icon={ShoppingBag}
              color="border-blue-500/15 bg-blue-500/5 text-blue-600 bg-white"
            />

            <KPICard
              title={`Chiết Khấu Sàn (${stats ? Math.round(stats.commissionRate * 100) : 10}%)`}
              value={formatCurrency(statsSummary.commission)}
              description="Khấu trừ duy trì hệ thống"
              icon={Percent}
              color="border-orange-500/15 bg-orange-500/5 text-orange-600 bg-white"
            />

            <KPICard
              title="Dòng Tiền Giao Vận"
              value={formatCurrency(statsSummary.shipping)}
              description="Phí giao hàng trả cho Shipper"
              icon={Users}
              color="border-purple-500/15 bg-purple-500/5 text-purple-600 bg-white"
            />
          </div>

          {/* Bảng phân bổ dòng tiền thực tế (Merchant Cash Flow Distribution) */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-[1.25rem] p-5 space-y-3.5 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wider font-extrabold">
                Phân Bổ Dòng Tiền Giao Dịch Động
              </h3>
              <span className="text-[10px] text-slate-450 font-bold">
                Chu kỳ: {filterRange === '7days' ? '7 ngày qua' : filterRange === '30days' ? '30 ngày qua' : filterRange === 'thisMonth' ? 'Tháng này' : 'Tất cả'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
              <div className="bg-white p-3.5 rounded-radius-lg border border-slate-150 shadow-sm flex flex-col justify-between h-18">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Tổng giá trị đơn hàng (GTV)</span>
                <span className="text-sm font-extrabold text-slate-800 mt-1">{formatCurrency(statsSummary.gtv)}</span>
              </div>
              <div className="bg-white p-3.5 rounded-radius-lg border border-slate-150 shadow-sm flex flex-col justify-between h-18">
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">Doanh thu món ăn (Subtotal)</span>
                <span className="text-sm font-extrabold text-blue-600 mt-1">{formatCurrency(statsSummary.subtotal)}</span>
              </div>
              <div className="bg-white p-3.5 rounded-radius-lg border border-slate-150 shadow-sm flex flex-col justify-between h-18">
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">Cước phí giao vận (Shipper)</span>
                <span className="text-sm font-extrabold text-purple-605 mt-1">{formatCurrency(statsSummary.shipping)}</span>
              </div>
            </div>
          </div>

          {/* Main Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Timeline Area Chart (Doanh thu món & Thực nhận) */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
                  <TrendingUp className="text-md-secondary" size={18} />
                  Biểu Đồ Xu Hướng Doanh Thu Thực Tế (Khấu Trừ Hoa Hồng)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChartType(prev => prev === 'area' ? 'bar' : 'area')}
                    className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-600 hover:text-md-secondary cursor-pointer text-[10px] font-bold transition-all flex items-center gap-1"
                    title="Click để chuyển đổi giữa biểu đồ miền và biểu đồ cột"
                  >
                    {chartType === 'area'
                      ? (<><BarChart3 size={11} /> Dạng Cột</>)
                      : (<><AreaChart size={11} /> Dạng Miền</>)}
                  </button>
                  <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1">
                    <TrendingUp size={11} /> Chart Trend
                  </span>
                </div>
              </div>

              {timelineChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs font-bold text-slate-400">
                  Chưa có dữ liệu giao dịch trong khoảng thời gian này.
                </div>
              ) : (
                <div className="h-64 w-full text-[10px] font-bold">
                  <RevenueAreaChart
                    data={timelineChartData}
                    xKey="dateStr"
                    height={256}
                    showLegend
                    yTickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v}
                    chartType={chartType}
                    areas={[
                      { key: 'Doanh thu món', name: 'Tiền món ăn', color: '#1A73E8' },
                      // Đổi cam #FF6B35 (màu Customer) → teal #00897B để không lẫn thương hiệu
                      { key: 'Thực nhận', name: 'Quán thực nhận (90%)', color: '#00897B' }
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Payment & Status Donut Charts */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between min-h-[340px] space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
                  <CreditCard className="text-blue-500" size={16} />
                  Cơ Cấu Phương Thức Thanh Toán
                </h3>
              </div>

              {paymentChartData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">
                  Không có dữ liệu thanh toán.
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-around flex-col sm:flex-row lg:flex-col gap-4">
                  <GaugeChart
                    data={paymentChartData}
                    label={merchantPieMode === 'count' ? "Tổng đơn" : "Tổng tiền"}
                    value={merchantPieMode === 'count' ? `${statsSummary.totalOrders} đơn` : formatCurrency(statsSummary.gtv)}
                    colors={COLORS}
                    size={140}
                    onClick={() => setMerchantPieMode(prev => prev === 'count' ? 'amount' : 'count')}
                    hiddenKeys={hiddenPaymentKeys}
                  />

                  <div className="space-y-1.5 w-full font-semibold text-[10px]">
                    {(() => {
                      const visiblePaymentData = paymentChartData.filter(i => !hiddenPaymentKeys.has(i.name));
                      const totalPaymentVal = visiblePaymentData.reduce((sum, item) => sum + item.value, 0);
                      return paymentChartData.map((item, idx) => {
                        const isHidden = hiddenPaymentKeys.has(item.name);
                        const pct = !isHidden && totalPaymentVal > 0 ? ((item.value / totalPaymentVal) * 100).toFixed(0) : 0;
                        const displayVal = merchantPieMode === 'count' ? `${item.value} đơn` : formatCurrency(item.value);
                        return (
                          <div
                            key={idx}
                            onClick={() => togglePaymentKey(item.name)}
                            className={`flex justify-between items-center py-1 border-b border-slate-50 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-50 ${isHidden ? 'opacity-40' : ''}`}
                            title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length], opacity: isHidden ? 0.3 : 1 }} />
                              <span className={`${isHidden ? 'line-through text-slate-300' : 'text-slate-500'}`}>{item.name}:</span>
                            </div>
                            <span className={`font-extrabold ${isHidden ? 'text-slate-300' : 'text-slate-800'}`}>
                              {isHidden ? '—' : `${displayVal} (${pct}%)`}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Lower Section (Top Foods & Order Status Distribution) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top Best-Sellers Deep Dive */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
                  <Award className="text-yellow-500" size={18} />
                  Top 5 Món Ăn Bán Chạy Nhất (Khớp Doanh Thu Món Ăn)
                </h3>
                <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                  <Flame size={11} /> Best-Sellers
                </span>
              </div>

              {topSellingFoods.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  Chưa có món ăn được bán thành công trong khoảng thời gian này.
                </div>
              ) : (
                <div className="space-y-4.5">
                  {topSellingFoods.map((food, idx) => {
                    const contributionPercent = statsSummary.subtotal > 0 ? (food.revenue / statsSummary.subtotal) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1.5 text-xs font-bold">
                        <div className="flex justify-between items-center text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-slate-100 text-slate-700' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-slate-800 font-extrabold">{food.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">Đã bán: <b className="text-slate-750 font-extrabold">{food.qty}</b></span>
                            <span className="text-md-secondary font-extrabold">{formatCurrency(food.revenue)}</span>
                          </div>
                        </div>
                        {/* Progress Bar đóng góp doanh thu */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-md-secondary rounded-full transition-all duration-500"
                            style={{ width: `${contributionPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-medium mt-0.5">
                          <span>Doanh thu đóng góp</span>
                          <span>{contributionPercent.toFixed(1)}% của tổng tiền món ăn ({formatCurrency(statsSummary.subtotal)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trạng thái đơn hàng phân bổ */}
            <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between min-h-[300px] space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
                  <Calendar className="text-purple-500" size={16} />
                  Tỷ Lệ Trạng Thế Đơn Hàng
                </h3>
              </div>

              {statusChartData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">
                  Không có dữ liệu trạng thái đơn.
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-around flex-col sm:flex-row lg:flex-col gap-4">
                  <GaugeChart
                    data={statusChartData}
                    label={merchantPieMode === 'count' ? "Tổng đơn" : "Tổng tiền"}
                    value={merchantPieMode === 'count' ? `${statsSummary.totalOrders} đơn` : formatCurrency(statsSummary.gtv)}
                    colors={COLORS}
                    size={130}
                    onClick={() => setMerchantPieMode(prev => prev === 'count' ? 'amount' : 'count')}
                    hiddenKeys={hiddenStatusKeys}
                  />

                  <div className="space-y-1.5 w-full font-semibold text-[10px]">
                    {(() => {
                      const visibleStatusData = statusChartData.filter(i => !hiddenStatusKeys.has(i.name));
                      const totalStatusVal = visibleStatusData.reduce((sum, item) => sum + item.value, 0);
                      return statusChartData.slice(0, 4).map((item, idx) => {
                        const isHidden = hiddenStatusKeys.has(item.name);
                        const pct = !isHidden && totalStatusVal > 0 ? ((item.value / totalStatusVal) * 100).toFixed(0) : 0;
                        const displayVal = merchantPieMode === 'count' ? `${item.value} đơn` : formatCurrency(item.value);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleStatusKey(item.name)}
                            className={`flex justify-between items-center py-1 border-b border-slate-50 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-50 ${isHidden ? 'opacity-40' : ''}`}
                            title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length], opacity: isHidden ? 0.3 : 1 }} />
                              <span className={`${isHidden ? 'line-through text-slate-300' : 'text-slate-500'}`}>{item.name}:</span>
                            </div>
                            <span className={`font-extrabold ${isHidden ? 'text-slate-300' : 'text-slate-800'}`}>
                              {isHidden ? '—' : `${displayVal} (${pct}%)`}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}