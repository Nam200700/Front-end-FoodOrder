import React, { useState, useEffect, useMemo } from 'react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import KPICard from '../../components/common/KPICard';
import DonutChart from '../../components/common/DonutChart';
import {
  TrendingUp, Award, Users, Store, Package, DollarSign,
  Percent, Calendar, CreditCard, Shield, BarChart3, AreaChart, Flame
} from 'lucide-react';
import { filterByDateRange } from '../../utils/filterUtils';
import FilterTabs from '../../components/common/FilterTabs';

const COLORS = ['#8B5CF6', '#10B981', '#F43F5E', '#06B6D4', '#F59E0B', '#3B82F6'];

export default function AdminStats() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [overviewStats, setOverviewStats] = useState(null);
  const [filterRange, setFilterRange] = useState('all'); // 7days, 30days, thisMonth, all
  const [paymentViewMode, setPaymentViewMode] = useState('count'); // count, amount
  const [chartType, setChartType] = useState('area'); // area, bar
  const [hiddenPaymentKeys, setHiddenPaymentKeys] = useState(new Set());
  const [hiddenUserKeys, setHiddenUserKeys] = useState(new Set());

  const togglePaymentKey = (name) => setHiddenPaymentKeys(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const toggleUserKey = (name) => setHiddenUserKeys(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const fetchAdminStatsData = async () => {
    try {
      setLoading(true);
      const [ordersRes, usersRes, overviewRes] = await Promise.all([
        apiClient.get('/admin/orders?size=2000'),
        apiClient.get('/admin/users?size=1500'),
        apiClient.get('/admin/stats/overview')
      ]);

      setOrders(ordersRes.data?.data?.content || ordersRes.data?.data || []);
      setUsers(usersRes.data?.data?.content || []);
      setOverviewStats(overviewRes.data?.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu phân tích hệ thống Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStatsData();
  }, []);

  // Lọc đơn hàng theo thời gian
  const filteredOrders = useMemo(() => {
    return filterByDateRange(orders, filterRange);
  }, [orders, filterRange]);

  // Phân tích KPIs tổng quát hệ thống (Phân chia dòng tiền minh bạch GTV, Quán ăn, Shipper, Sàn)
  const adminKPIs = useMemo(() => {
    const completed = filteredOrders.filter(ord => ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED');
    const cancelled = filteredOrders.filter(ord => ord.orderStatus === 'CANCELLED');
    
    // GTV (Gross Transaction Value) - Tổng giao dịch chảy qua hệ thống (Bao gồm phí ship)
    const gtv = completed.reduce((sum, ord) => sum + Number(ord.totalAmount || 0), 0);
    
    // Tổng giá trị món ăn (Phần tiền quán ăn tạo ra)
    const totalMerchantGoods = completed.reduce((sum, ord) => {
      const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
        ? Number(ord.subtotalAmount)
        : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
      return sum + sub;
    }, 0);

    // Tổng phí ship (Phần tiền thuộc về Shipper)
    const totalShipperShare = completed.reduce((sum, ord) => sum + Number(ord.shippingFee || 0), 0);

    // Chiết khấu sàn thực nhận (đọc động từ stats)
    const rate = overviewStats?.commissionRate || 0.1;
    const platformCommission = totalMerchantGoods * rate;

    // Số tiền thực tế chuyển về túi các Quán ăn
    const merchantNetShare = totalMerchantGoods - platformCommission;
    
    return {
      gtv,
      merchantGoods: totalMerchantGoods,
      shipperShare: totalShipperShare,
      platformCommission,
      merchantNetShare,
      totalOrders: filteredOrders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length
    };
  }, [filteredOrders, overviewStats]);

  // Phân tích biểu đồ xu hướng (Doanh thu & Lợi nhuận sàn theo ngày thực tế từ database)
  const timelineChartData = useMemo(() => {
    const dailyMap = {};
    
    filteredOrders.forEach(ord => {
      if (!ord.createdAt) return;
      const date = new Date(ord.createdAt);
      const dateStr = date.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
      
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { dateStr, 'Tổng GTV': 0, 'Quán ăn kiếm': 0, 'Hoa hồng sàn': 0 };
      }
      
      if (ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED') {
        const amount = Number(ord.totalAmount || 0);
        const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
          ? Number(ord.subtotalAmount)
          : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
          
        const rate = overviewStats?.commissionRate || 0.1;
        dailyMap[dateStr]['Tổng GTV'] += amount;
        dailyMap[dateStr]['Quán ăn kiếm'] += sub * (1 - rate); // Thuộc về quán sau chiết khấu
        dailyMap[dateStr]['Hoa hồng sàn'] += sub * rate; // Hoa hồng sàn
      }
    });

    // Sắp xếp ngày
    return Object.values(dailyMap).sort((a, b) => {
      const [dayA, monthA] = a.dateStr.split('/').map(Number);
      const [dayB, monthB] = b.dateStr.split('/').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
  }, [filteredOrders, overviewStats]);

  // Phân tích cơ cấu vai trò người dùng (User Roles Distribution từ dữ liệu thật)
  const userRolesChartData = useMemo(() => {
    // Ưu tiên số thật toàn hệ thống từ overview (không còn số giả 80/15/5, không giới hạn trang)
    if (overviewStats) {
      const arr = [
        { name: 'Khách hàng', value: overviewStats.customerCount || 0 },
        { name: 'Chủ quán', value: overviewStats.ownerCount || 0 },
        { name: 'Tài xế', value: overviewStats.shipperCount || 0 },
      ].filter(i => i.value > 0);
      if (arr.length > 0) return arr;
    }
    // Fallback: đếm từ danh sách user đã tải (khi overview lỗi); rỗng thì trả mảng rỗng
    if (users.length === 0) {
      return [];
    }
    const roleMap = {};
    users.forEach(u => {
      const role = u.role || 'CUSTOMER';
      roleMap[role] = (roleMap[role] || 0) + 1;
    });

    const roleLabels = {
      'CUSTOMER': 'Khách hàng',
      'OWNER': 'Chủ quán',
      'MERCHANT': 'Chủ quán',
      'SHIPPER': 'Tài xế',
      'ADMIN': 'Ban quản trị'
    };

    return Object.keys(roleMap).map(key => ({
      name: roleLabels[key] || key,
      value: roleMap[key]
    }));
  }, [users]);

  // Phân tích cơ cấu trạng thái thanh toán toàn hệ thống (Payment Status Distribution)
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
      value: paymentViewMode === 'count' ? statusMap[key].count : statusMap[key].amount,
      count: statusMap[key].count,
      amount: statusMap[key].amount
    }));
  }, [filteredOrders, paymentViewMode]);

  // Bảng xếp hạng quán ăn có doanh thu cao nhất (Top 5 Restaurants Leaderboard - Tách hoa hồng)
  const topRestaurants = useMemo(() => {
    const resMap = {};
    const completed = filteredOrders.filter(ord => ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED');
    
    completed.forEach(ord => {
      const resName = ord.restaurantName || 'Quán ăn đối tác';
      const totalAmt = Number(ord.totalAmount || 0);
      const sub = ord.subtotalAmount !== undefined && ord.subtotalAmount !== null
        ? Number(ord.subtotalAmount)
        : Number(ord.totalAmount || 0) - Number(ord.shippingFee || 0);
      
      const rate = overviewStats?.commissionRate || 0.1;
      if (!resMap[resName]) {
        resMap[resName] = { resName, ordersCount: 0, gtv: 0, goods: 0, commission: 0, netShare: 0 };
      }
      resMap[resName].ordersCount++;
      resMap[resName].gtv += totalAmt;
      resMap[resName].goods += sub;
      resMap[resName].commission += sub * rate; // commission
      resMap[resName].netShare += sub * (1 - rate); // net share
    });

    return Object.values(resMap)
      .sort((a, b) => b.gtv - a.gtv)
      .slice(0, 5);
  }, [filteredOrders, overviewStats]);

  if (loading && orders.length === 0) {
    return <Spinner fullScreen />;
  }

  // Lấy các chỉ số tổng quan từ overview API hoặc tính toán
  const totalUsersCount = overviewStats ? overviewStats.totalUsers : users.length;
  const totalRestaurantsCount = overviewStats ? overviewStats.totalRestaurants : 0;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans space-y-6 pb-24 text-slate-100 bg-transparent">
      
      {/* Upper Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
            {/* icon khiên tím thay emoji 🛡️ */}
            <Shield className="text-purple-400" size={24} /> Trung Tâm Phân Tích Doanh Thu
          </h1>
          <p className="text-xs text-slate-400 mt-1">Phân bổ dòng tiền hệ thống • Tách bạch Hoa hồng sàn, Thu nhập của Quán & Shipper</p>
        </div>

        {/* Filters */}
        <FilterTabs
          tabs={[
            { id: '7days', label: '7 Ngày' },
            { id: '30days', label: '30 Ngày' },
            { id: 'thisMonth', label: 'Tháng Này' },
            { id: 'all', label: 'Tất Cả' }
          ]}
          activeTab={filterRange}
          onTabChange={setFilterRange}
          className="self-start sm:self-center bg-slate-900 p-1 rounded-radius-lg border border-slate-800"
          activeClassName="bg-purple-650 text-white shadow-sm shadow-purple-650/25"
        />
      </div>

      {/* 4 KPIs Bento Grid (Dark Mode Style - Phân chia dòng tiền) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tổng giao dịch sàn (GTV)"
          value={formatCurrency(adminKPIs.gtv)}
          description="Dòng tiền lưu chuyển thực tế"
          icon={DollarSign}
          color="border-purple-500/20 bg-purple-950/10 text-purple-400 bg-slate-950"
          valueClassName="text-slate-100"
       
        />
        <KPICard
          title="Chiết Khấu Sàn Thu Được"
          value={formatCurrency(overviewStats ? overviewStats.totalCommission : adminKPIs.platformCommission)}
          description={`${overviewStats ? Math.round(overviewStats.commissionRate * 100) : 10}% trích trên tiền món ăn của Quán`}
          icon={Percent}
          color="border-emerald-500/20 bg-emerald-950/10 text-emerald-400 bg-slate-950"
          valueClassName="text-slate-100"
        
        />
        <KPICard
          title="Doanh Thu Quán Đối Tác"
          value={formatCurrency(overviewStats ? overviewStats.totalMerchantNet : adminKPIs.merchantNetShare)}
          description={`${overviewStats ? Math.round((1 - overviewStats.commissionRate) * 100) : 90}% tiền món ăn chuyển về Quán`}
          icon={Store}
          color="border-blue-500/20 bg-blue-950/10 text-blue-400 bg-slate-950"
          valueClassName="text-slate-100"
       
        />
        <KPICard
          title="Cước Giao Hàng Shipper"
          value={formatCurrency(overviewStats ? overviewStats.totalShipperShare : adminKPIs.shipperShare)}
          description="Phí vận chuyển thực tế thuộc về Shipper"
          icon={Users}
          color="border-rose-500/20 bg-rose-950/10 text-rose-400 bg-slate-950"
          valueClassName="text-slate-100"
      
        />
      </div>

      {/* Bảng đối soát dòng tiền hệ thống tối cao (System Reconciliation Ledger) */}
      <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 space-y-4 shadow-md">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-extrabold">
            Đối Soát Dòng Tiền Giao Dịch Hệ Thống
          </h3>
          <span className="text-[10px] text-slate-500 font-bold">
            Chu kỳ: {filterRange === '7days' ? '7 ngày qua' : filterRange === '30days' ? '30 ngày qua' : filterRange === 'thisMonth' ? 'Tháng này' : 'Tất cả'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div className="bg-slate-900 p-3.5 rounded-radius-lg border border-slate-800 shadow-sm flex flex-col justify-between h-18">
            <span className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider">Tổng giao dịch hệ thống (GTV)</span>
            <span className="text-sm font-extrabold text-slate-100 mt-1">{formatCurrency(adminKPIs.gtv)}</span>
          </div>
          <div className="bg-slate-900 p-3.5 rounded-radius-lg border border-slate-800 shadow-sm flex flex-col justify-between h-18">
            <span className="text-[9px] text-slate-450 font-extrabold tracking-wider uppercase">Tổng tiền món ăn đối tác</span>
            <span className="text-sm font-extrabold text-blue-400 mt-1">{formatCurrency(adminKPIs.merchantGoods)}</span>
          </div>
          <div className="bg-slate-900 p-3.5 rounded-radius-lg border border-slate-800 shadow-sm flex flex-col justify-between h-18">
            <span className="text-[9px] text-slate-450 font-extrabold tracking-wider uppercase">Tổng cước phí giao vận Shipper</span>
            <span className="text-sm font-extrabold text-rose-450 mt-1">{formatCurrency(adminKPIs.shipperShare)}</span>
          </div>
        </div>
      </div>

      {/* Main Analysis Chart: Area Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Platform GTV & Earnings Chart */}
        <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
              <TrendingUp className="text-purple-400" size={18} />
              Biểu Đồ Xu Hướng Doanh Thu, Net-Earnings & Hoa Hồng Sàn
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChartType(prev => prev === 'area' ? 'bar' : 'area')}
                className="px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-400 cursor-pointer text-[10px] font-bold transition-all flex items-center gap-1"
                title="Click để chuyển đổi giữa biểu đồ miền và biểu đồ cột"
              >
                {/* icon thay emoji 📊/📈 tùy chế độ biểu đồ */}
                {chartType === 'area'
                  ? <><BarChart3 size={13} /> Dạng Cột</>
                  : <><AreaChart size={13} /> Dạng Miền</>}
              </button>
              {/* Badge chỉ hiện khi thực sự có dữ liệu giao dịch — tránh gây hiểu nhầm khi rỗng */}
              {timelineChartData.length > 0 && (
                <span className="text-[9px] text-purple-400 bg-purple-950/40 border border-purple-900/40 px-2.5 py-1 rounded-full font-bold">
                  Dữ liệu thật (Live)
                </span>
              )}
            </div>
          </div>

          {timelineChartData.length === 0 ? (
            <div className="h-68 flex items-center justify-center text-xs font-bold text-slate-500">
              Chưa có dữ liệu giao dịch thật nào phát sinh trong chu kỳ này.
            </div>
          ) : (
            <div className="h-68 w-full text-[10px] font-bold">
              <RevenueAreaChart
                data={timelineChartData}
                xKey="dateStr"
                height={272}
                showLegend
                yTickFormatter={(v) => v >= 1000000 ? `${v/1000000}M` : `${v/1000}k`}
                chartType={chartType}
                areas={[
                  { key: 'Tổng GTV', name: 'Tổng giao dịch (GTV)', color: '#8B5CF6' },
                  { key: 'Quán ăn kiếm', name: 'Quán đối tác thực nhận', color: '#3B82F6' },
                  { key: 'Hoa hồng sàn', name: `Hoa hồng sàn (${overviewStats ? Math.round(overviewStats.commissionRate * 100) : 10}%)`, color: '#10B981' }
                ]}
              />
            </div>
          )}
        </div>

        {/* User Roles Distribution (Donut Chart) */}
        <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md flex flex-col justify-between min-h-[350px] space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
              <Users className="text-emerald-400" size={16} />
              Cơ Cấu Thành Viên Hệ Thống
            </h3>
          </div>

          {userRolesChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-500">
              Chưa có dữ liệu thành viên.
            </div>
          ) : (
          <div className="flex-1 flex flex-col items-center justify-around gap-4">
              <DonutChart
                data={userRolesChartData}
                label="Tổng User"
                value={totalUsersCount}
                colors={COLORS}
                size={140}
                hiddenKeys={hiddenUserKeys}
              />

            <div className="space-y-1.5 w-full font-semibold text-[10px]">
              {userRolesChartData.slice(0, 4).map((item, idx) => {
                const isHidden = hiddenUserKeys.has(item.name);
                const visibleTotal = userRolesChartData.filter(i => !hiddenUserKeys.has(i.name)).reduce((s, i) => s + i.value, 0);
                const pct = !isHidden && visibleTotal > 0 ? ((item.value / visibleTotal) * 100).toFixed(0) : 0;
                return (
                  <div
                    key={idx}
                    onClick={() => toggleUserKey(item.name)}
                    className={`flex justify-between items-center py-1 border-b border-slate-900 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-900/50 ${isHidden ? 'opacity-40' : ''}`}
                    title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length], opacity: isHidden ? 0.3 : 1 }} />
                      <span className={isHidden ? 'line-through text-slate-600' : 'text-slate-400'}>{item.name}:</span>
                    </div>
                    <span className={`font-extrabold ${isHidden ? 'text-slate-600' : 'text-slate-100'}`}>
                      {isHidden ? '—' : `${item.value} thành viên (${pct}%)`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Lower Section: Top Restaurants Leaderboard & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Restaurants Leaderboard (Bảng xếp hạng quán ăn) */}
        <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
              <Store className="text-yellow-500" size={16} />
              Bảng Xếp Hạng 5 Quán Ăn Dẫn Đầu Doanh Thu (Chiết Khấu)
            </h3>
            <span className="text-[9px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full font-extrabold inline-flex items-center gap-1">
              {/* icon Flame thay emoji 🔥 */}
              <Flame size={11} /> GTV Rank
            </span>
          </div>

          {topRestaurants.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Chưa có dữ liệu xếp hạng nhà hàng.
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-slate-900 text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-3">Hạng</th>
                    <th className="p-3">Tên quán ăn</th>
                    <th className="p-3">Đơn hàng</th>
                    <th className="p-3">Tiền món ăn (Subtotal)</th>
                    <th className="p-3">Quán thực nhận ({overviewStats ? Math.round((1 - overviewStats.commissionRate) * 100) : 90}%)</th>
                    <th className="p-3 text-right">Hoa hồng sàn ({overviewStats ? Math.round(overviewStats.commissionRate * 100) : 10}%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 font-semibold text-slate-200">
                  {topRestaurants.map((res, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/10 transition-colors">
                      <td className="p-3">
                        <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                          idx === 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                          idx === 1 ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' :
                          idx === 2 ? 'bg-amber-600/10 text-amber-500 border border-amber-600/20' : 'bg-slate-900 text-slate-400'
                        }`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-100">{res.resName}</td>
                      <td className="p-3 text-slate-400 font-bold">{res.ordersCount} đơn</td>
                      <td className="p-3 font-bold text-slate-100">{formatCurrency(res.goods)}</td>
                      <td className="p-3 text-emerald-400 font-extrabold">{formatCurrency(res.netShare)}</td>
                      <td className="p-3 text-right font-extrabold text-purple-400">{formatCurrency(res.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COD vs VNPAY Platform Distribution */}
        <div className="bg-slate-950 border border-slate-850 rounded-[1.25rem] p-5 shadow-md flex flex-col justify-between min-h-[280px] space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
              <CreditCard className="text-purple-400" size={16} />
              Trạng Thái Thanh Toán Toàn Hệ Thống
            </h3>
          </div>

          {paymentChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-500">
              Không có dữ liệu thanh toán.
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-around gap-4">
              <DonutChart
                data={paymentChartData}
                label={paymentViewMode === 'count' ? "Tổng Giao dịch" : "Tổng doanh thu"}
                value={paymentViewMode === 'count' ? `${adminKPIs.totalOrders} đơn` : formatCurrency(adminKPIs.gtv)}
                colors={COLORS.slice(3).concat(COLORS.slice(0, 3))}
                size={130}
                onClick={() => setPaymentViewMode(prev => prev === 'count' ? 'amount' : 'count')}
                hiddenKeys={hiddenPaymentKeys}
              />

              <div className="space-y-1.5 w-full font-semibold text-[10px]">
                {paymentChartData.map((item, idx) => {
                  const isHidden = hiddenPaymentKeys.has(item.name);
                  const visibleTotal = paymentViewMode === 'count' ? adminKPIs.totalOrders : adminKPIs.gtv;
                  const visiblePayment = paymentChartData.filter(i => !hiddenPaymentKeys.has(i.name));
                  const visibleSum = visiblePayment.reduce((sum, i) => sum + i.value, 0);
                  const pct = !isHidden && visibleSum > 0 ? ((item.value / visibleSum) * 100).toFixed(0) : 0;
                  const itemLabel = paymentViewMode === 'count' ? `${item.value} đơn` : formatCurrency(item.value);
                  return (
                    <div
                      key={idx}
                      onClick={() => togglePaymentKey(item.name)}
                      className={`flex justify-between items-center py-1 border-b border-slate-900 last:border-b-0 cursor-pointer rounded px-1 transition-all hover:bg-slate-900/50 ${isHidden ? 'opacity-40' : ''}`}
                      title={isHidden ? 'Click để hiện lại' : 'Click để ẩn'}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(idx + 3) % COLORS.length], opacity: isHidden ? 0.3 : 1 }} />
                        <span className={isHidden ? 'line-through text-slate-600' : 'text-slate-400'}>{item.name}:</span>
                      </div>
                      <span className={`font-extrabold ${isHidden ? 'text-slate-600' : 'text-slate-100'}`}>
                        {isHidden ? '—' : `${itemLabel} (${pct}%)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}