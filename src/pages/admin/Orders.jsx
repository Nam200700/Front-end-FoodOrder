import React, { useState, useEffect, useMemo } from 'react';
import { Package, RefreshCw, CheckCircle2, Clock, XCircle, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { toast } from 'react-toastify';
import OrderCancelModal from '../../components/common/OrderCancelModal';
import Badge from '../../components/common/Badge';
import FilterTabs from '../../components/common/FilterTabs';
import { useModalState } from '../../hooks/useModalState';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | processing | cancelled

  // STATE HỦY ĐƠN HÀNG MODAL
  const cancelModal = useModalState();

  const handleOpenCancelModal = (orderId) => {
    cancelModal.open(orderId);
  };

  const handleCancelSubmit = async (reason) => {
    try {
      setLoading(true);
      const orderIdToCancel = cancelModal.data;
      await apiClient.post(`/orders/${orderIdToCancel}/cancel`, { reason });
      toast.success(`Admin đã hủy đơn hàng #${orderIdToCancel} thành công`);
      cancelModal.close();
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng này.');
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/orders?size=1000');
      const realData = response.data?.data?.content || response.data?.data || [];
      
      const mapped = realData.map(ord => {
        const dateObj = ord.createdAt ? new Date(ord.createdAt) : new Date();
        const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        return {
          id: ord.orderId?.toString() || '—',
          resName: ord.restaurantName || 'Quán ăn đối tác',
          customer: ord.customerName || ord.customerPhone || 'Khách hàng',
          total: Number(ord.totalAmount) || 0,
          status: ord.orderStatus || 'PENDING',
          date: dateStr
        };
      });
      
      setOrders(mapped);
    } catch (err) {
      console.warn('Lỗi nạp đơn hàng hệ thống của Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Tổng hợp nhanh trạng thái đơn cho hàng KPI (chỉ đếm từ dữ liệu đã fetch, không gọi thêm API)
  const orderSummary = useMemo(() => {
    const completed = orders.filter(o => o.status === 'COMPLETED');
    const cancelled = orders.filter(o => o.status === 'CANCELLED');
    const processing = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    const gmv = completed.reduce((s, o) => s + (o.total || 0), 0); // doanh số từ đơn đã giao
    return {
      total: orders.length,
      completed: completed.length,
      processing: processing.length,
      cancelled: cancelled.length,
      gmv,
    };
  }, [orders]);

  // Lọc đơn theo trạng thái (chỉ lọc hiển thị phía client, không gọi lại API)
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'completed') return orders.filter(o => o.status === 'COMPLETED');
    if (statusFilter === 'cancelled') return orders.filter(o => o.status === 'CANCELLED');
    if (statusFilter === 'processing') return orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    return orders;
  }, [orders, statusFilter]);

  if (loading) {
    return <Spinner fullScreen />;
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">
      
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="text-purple-400" size={24} />
            Quản lý tất cả đơn hàng hệ thống
          </h1>
          <p className="text-xs text-slate-400 mt-1">Theo dõi & can thiệp toàn bộ đơn hàng trên nền tảng</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-radius-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* ─── HÀNG KPI TÓM TẮT (đếm theo trạng thái từ dữ liệu đã có) ─────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng đơn hàng', value: `${orderSummary.total} đơn`, sub: `Doanh số giao thành công ${formatCurrency(orderSummary.gmv)}`, icon: Package, color: 'border-purple-500/25 bg-purple-950/10 text-purple-400' },
          { label: 'Đã giao thành công', value: `${orderSummary.completed} đơn`, sub: 'Hoàn tất giao - thanh toán', icon: CheckCircle2, color: 'border-emerald-500/25 bg-emerald-950/10 text-emerald-400' },
          { label: 'Đang xử lý', value: `${orderSummary.processing} đơn`, sub: 'Chờ xác nhận / chuẩn bị / giao', icon: Clock, color: 'border-amber-500/25 bg-amber-950/10 text-amber-400' },
          { label: 'Đã hủy', value: `${orderSummary.cancelled} đơn`, sub: 'Bị hủy bởi các bên', icon: XCircle, color: 'border-red-500/25 bg-red-950/10 text-red-400' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`rounded-radius-xl p-4 border shadow-md flex items-center gap-3 bg-slate-950 ${kpi.color}`}>
              <div className="p-2.5 rounded-radius-md bg-white/5 shrink-0">
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block truncate uppercase tracking-wider">{kpi.label}</span>
                <span className="text-base font-bold text-slate-100 block mt-0.5">{kpi.value}</span>
                <span className="text-[9px] text-slate-500 font-medium block mt-0.5 truncate">{kpi.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── FILTER LỌC THEO TRẠNG THÁI (kèm số đếm mỗi nhóm) ───────────────── */}
      <FilterTabs
        tabs={[
          { id: 'all', label: `Tất cả (${orderSummary.total})` },
          { id: 'completed', label: `Đã giao (${orderSummary.completed})` },
          { id: 'processing', label: `Đang xử lý (${orderSummary.processing})` },
          { id: 'cancelled', label: `Đã hủy (${orderSummary.cancelled})` },
        ]}
        activeTab={statusFilter}
        onTabChange={setStatusFilter}
        className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-max"
        activeClassName="bg-purple-650 text-white shadow-sm shadow-purple-650/25"
      />

      <div className="bg-slate-950 rounded-radius-xl border border-slate-800 overflow-hidden shadow-md">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold flex flex-col items-center gap-3">
            {/* icon Package thay emoji 📦 cho trạng thái rỗng */}
            <Package size={40} className="text-slate-600" strokeWidth={1.5} />
            {orders.length === 0
              ? 'Chưa có đơn hàng nào tồn tại trên hệ thống.'
              : 'Không có đơn hàng nào ở trạng thái này.'}
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            {/* Thanh tiêu đề bảng: nhãn + số đơn đang hiển thị theo filter */}
            <div className="flex items-center justify-between px-4.5 py-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Wallet size={14} className="text-purple-400" /> Danh sách đơn hàng
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
                {filteredOrders.length} đơn
              </span>
            </div>
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4.5">Mã đơn</th>
                  <th className="p-4.5">Quán ăn</th>
                  <th className="p-4.5">Khách hàng</th>
                  <th className="p-4.5">Tổng tiền</th>
                  <th className="p-4.5">Thời gian</th>
                  <th className="p-4.5">Trạng thái</th>
                  <th className="p-4.5 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4.5 font-bold text-slate-100">#{order.id}</td>
                    <td className="p-4.5 text-slate-400 font-bold">{order.resName}</td>
                    <td className="p-4.5 font-bold text-slate-100">{order.customer}</td>
                    <td className="p-4.5 font-extrabold text-purple-400">{formatCurrency(order.total)}</td>
                    <td className="p-4.5 text-slate-400 font-medium">{order.date}</td>
                    <td className="p-4.5">
                      {order.status && (
                        <Badge status={order.status} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700/50" />
                      )}
                    </td>
                    <td className="p-4.5 text-center">
                      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ? (
                        <button
                          onClick={() => handleOpenCancelModal(order.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded transition-colors cursor-pointer shadow-sm"
                        >
                          Hủy đơn (Admin)
                        </button>
                      ) : (
                        <span className="text-slate-500 font-bold">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL HỦY ĐƠN HÀNG (ADMIN) ────────────────────────────────────── */}
      <OrderCancelModal
        isOpen={cancelModal.isOpen}
        onClose={() => {
          cancelModal.close();
        }}
        onConfirm={handleCancelSubmit}
        orderId={cancelModal.data}
        reasons={[
          'Đơn hàng gặp sự cố vận chuyển / tai nạn',
          'Đơn đặt ảo / phát hiện hành vi gian lận',
          'Cửa hàng / Khách hàng xảy ra sự cố đột xuất',
          'Quá thời gian giao nhận quá lâu không tìm thấy shipper',
          'Yêu cầu đặc biệt được hỗ trợ trực tiếp'
        ]}
        loading={loading}
      />

    </div>
  );
}

