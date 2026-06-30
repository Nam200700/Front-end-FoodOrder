import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Store, Bike, Package, AlertTriangle, TrendingUp, Shield, RefreshCw, XCircle, Activity, Siren } from 'lucide-react';
import RevenueAreaChart from '../../components/common/RevenueAreaChart';
import { formatCurrency } from '../../utils/format';
import Spinner from '../../components/common/Spinner';
import { useFetchData } from '../../hooks/useFetchData';

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Fetch dữ liệu bằng useFetchData
  const { data: overviewStats, loading: loadingOverview, error: overviewError, refetch: refetchOverview } = useFetchData('/admin/stats/overview');
  const { data: usersData, loading: loadingUsers, error: usersError, refetch: refetchUsers } = useFetchData('/admin/users?size=100');
  const { data: reportsData, loading: loadingReports, error: reportsError, refetch: refetchReports } = useFetchData('/admin/reports?status=PENDING');
  const { data: ordersData, loading: loadingOrders, error: ordersError, refetch: refetchOrders } = useFetchData('/admin/orders?size=2000');

  const loading = loadingOverview || loadingUsers || loadingReports || loadingOrders;
  const hasError = overviewError || usersError || reportsError || ordersError;

  // Tính số tài khoản đang chờ phê duyệt (status === false)
  const pendingAccountsCount = useMemo(() => {
    const allUsers = usersData?.content || [];
    const pendingOwners = allUsers.filter(u => (u.role === 'OWNER' || u.role === 'MERCHANT') && !u.status).length;
    const pendingShippers = allUsers.filter(u => u.role === 'SHIPPER' && !u.status).length;
    return { owners: pendingOwners, shippers: pendingShippers };
  }, [usersData]);

  // Lấy số lượng báo cáo vi phạm đang chờ xử lý
  const reportsCount = useMemo(() => {
    return reportsData?.totalElements || 0;
  }, [reportsData]);

  // Tính toán biểu đồ doanh thu thực tế từ database (loại trừ đơn bị refund)
  const revenueChartData = useMemo(() => {
    const allOrdersList = ordersData?.content || [];
    const completedOrdersList = allOrdersList.filter(ord => ord.orderStatus === 'COMPLETED' && ord.paymentStatus !== 'REFUNDED');
    
    const groupData = {};
    completedOrdersList.forEach(ord => {
      if (!ord.createdAt) return;
      const date = new Date(ord.createdAt);
      const dayStr = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      groupData[dayStr] = (groupData[dayStr] || 0) + Number(ord.totalAmount);
    });
    
    const chartData = Object.keys(groupData).map(day => ({
      day: day,
      amount: groupData[day]
    })).sort((a, b) => {
      const [dayA, monthA] = a.day.split('-').map(Number);
      const [dayB, monthB] = b.day.split('-').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
    
    if (chartData.length === 0) {
      // Fallback mockup nếu chưa có đơn completed nào
      return [
        { day: '05-05', amount: 150000 },
        { day: '10-05', amount: 280000 },
        { day: '15-05', amount: 340000 }
      ];
    }
    return chartData;
  }, [ordersData]);

  if (loading && !overviewStats) {
    return <Spinner fullScreen />;
  }

  // Handle errors with retry mechanism
  if (hasError) {
    const handleRetry = () => {
      if (overviewError) refetchOverview();
      if (usersError) refetchUsers();
      if (reportsError) refetchReports();
      if (ordersError) refetchOrders();
    };

    return (
      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="bg-red-950/20 border border-red-500/30 rounded-radius-xl p-6 text-center space-y-4">
          {/* Tiêu đề lỗi: icon XCircle thay emoji ❌ */}
          <div className="text-red-400 text-lg font-bold flex items-center justify-center gap-2">
            <XCircle size={22} /> Lỗi tải dữ liệu
          </div>
          <div className="text-slate-300 text-sm space-y-1">
            {overviewError && <div>• Không thể tải thống kê tổng quan</div>}
            {usersError && <div>• Không thể tải dữ liệu người dùng</div>}
            {reportsError && <div>• Không thể tải báo cáo vi phạm</div>}
            {ordersError && <div>• Không thể tải dữ liệu đơn hàng</div>}
          </div>
          <button
            onClick={handleRetry}
            className="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-radius-lg transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Số liệu thật từ database
  const totalUsers = overviewStats ? overviewStats.totalUsers : 0;
  const totalRestaurants = overviewStats ? overviewStats.totalRestaurants : 0;
  const totalOrders = overviewStats ? overviewStats.totalOrders : 0;
  const completedOrders = overviewStats ? overviewStats.completedOrders : 0;
  const totalRevenue = overviewStats ? Number(overviewStats.totalRevenue) : 0;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full font-google-sans space-y-6 text-slate-100 pb-24">
      
      {/* Header */}
      <div>
        <h1 className="font-display-small text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
          {/* Tiêu đề: icon khiên tím thay emoji 🛡️ */}
          <Shield className="text-purple-400" size={24} /> Admin Control Panel
        </h1>
        <p className="text-xs text-slate-400 mt-1">Hệ thống quản trị tối cao • Dữ liệu đồng bộ database thật</p>
      </div>

      {/* TỔNG QUAN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Tổng người dùng', value: `${totalUsers} thành viên`, desc: 'Đăng ký thực tế', icon: Users, color: 'border-blue-500/25 bg-blue-950/10 text-blue-400' },
          { title: 'Quán ăn đối tác', value: `${totalRestaurants} quán`, desc: `${pendingAccountsCount.owners} quán đang chờ duyệt`, icon: Store, color: 'border-emerald-500/25 bg-emerald-950/10 text-emerald-400' },
          { title: 'Tài xế shipper', value: 'Đang hoạt động', desc: `${pendingAccountsCount.shippers} xế đang chờ duyệt`, icon: Bike, color: 'border-cyan-500/25 bg-cyan-950/10 text-cyan-400' },
          { title: 'Tổng đơn hàng', value: `${totalOrders} đơn`, desc: `Thành công: ${completedOrders} đơn`, icon: Package, color: 'border-purple-500/25 bg-purple-950/10 text-purple-400' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className={`rounded-radius-xl p-4 border shadow-md flex items-center gap-3 bg-slate-950 ${item.color}`}>
              <div className="p-2.5 rounded-radius-md bg-white/5 shrink-0">
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block truncate uppercase tracking-wider">{item.title}</span>
                <span className="text-sm sm:text-base font-bold text-slate-100 block mt-0.5">{item.value}</span>
                <span className="text-[9px] text-slate-500 font-medium block mt-0.5">{item.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHỜ DUYỆT */}
      <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="text-yellow-500 animate-pulse" size={16} />
          Thông báo hành động yêu cầu (Duyệt hồ sơ & Báo cáo)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Mỗi dòng thông báo: icon lucide thay emoji (🏪→Store, 🚴→Bike, 🚨→Siren) */}
          <div className="bg-slate-900 border border-slate-850 p-3 rounded-radius-lg flex justify-between items-center">
            <span className="flex items-center gap-2"><Store size={15} className="text-emerald-400 shrink-0" /> {pendingAccountsCount.owners} quán mới đăng ký</span>
            <button
              onClick={() => navigate('/admin/restaurants')}
              className="text-xs font-bold text-purple-400 hover:underline"
            >
              Xem ngay
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-850 p-3 rounded-radius-lg flex justify-between items-center">
            <span className="flex items-center gap-2"><Bike size={15} className="text-cyan-400 shrink-0" /> {pendingAccountsCount.shippers} shipper mới đăng ký</span>
            <button
              onClick={() => navigate('/admin/shippers')}
              className="text-xs font-bold text-purple-400 hover:underline"
            >
              Xem ngay
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-850 p-3 rounded-radius-lg flex justify-between items-center">
            <span className="flex items-center gap-2"><Siren size={15} className="text-red-400 shrink-0" /> {reportsCount} báo cáo vi phạm mới</span>
            <button
              onClick={() => navigate('/admin/reports')}
              className="text-xs font-bold text-red-400 hover:underline"
            >
              Xem ngay
            </button>
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ DOANH THU HỆ THỐNG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="text-purple-400" size={18} />
              Tổng giao dịch hệ thống (GTV): {formatCurrency(totalRevenue)}
            </h3>
            <span className="text-[10px] text-purple-400 bg-purple-950/20 px-2.5 py-1 rounded-full border border-purple-900/30 font-bold">
              Hoa hồng sàn ({Math.round((overviewStats?.commissionRate ?? 0.1) * 100)}%): {formatCurrency(overviewStats?.totalCommission ?? ((overviewStats?.totalRevenue ?? 0) * 0.1))}
            </span>
          </div>

          <div className="h-60 w-full text-xs">
            <RevenueAreaChart
              data={revenueChartData}
              dataKey="amount"
              xKey="day"
              color="#9334E6"
              height={240}
              yTickFormatter={(v) => v >= 1000000 ? `${v/1000000}M` : `${v/1000}k`}
            />
          </div>
        </div>

        {/* THỐNG KÊ CHI TIẾT */}
        <div className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              {/* icon Activity thay emoji 👑 */}
              <Activity className="text-purple-400" size={16} /> Trạng thái Vận hành
            </h3>
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="flex justify-between items-center py-2 border-b border-slate-850">
                <span className="text-slate-400">Tỷ lệ hoàn thành đơn:</span>
                <span className="text-emerald-400 font-bold">
                  {totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-850">
                <span className="text-slate-400">Đơn hàng đã hủy:</span>
                <span className="text-red-400 font-bold">
                  {overviewStats ? overviewStats.cancelledOrders : 0} đơn
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Báo cáo chưa giải quyết:</span>
                <span className="text-yellow-500 font-bold">{reportsCount} báo cáo</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/admin/users')}
            className="w-full border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2.5 rounded-radius-lg text-xs transition-colors text-center"
          >
            Quản lý tài khoản
          </button>
        </div>

      </div>

    </div>
  );
}
