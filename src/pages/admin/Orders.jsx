import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { toast } from 'react-toastify';
import OrderCancelModal from '../../components/common/OrderCancelModal';
import Badge from '../../components/common/Badge';
import { useModalState } from '../../hooks/useModalState';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <Spinner fullScreen />;
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">
      
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Package className="text-purple-400" size={24} />
          Quản lý tất cả đơn hàng hệ thống
        </h1>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-radius-lg transition-colors cursor-pointer"
        >
          🔄 Làm mới
        </button>
      </div>

      <div className="bg-slate-950 rounded-radius-xl border border-slate-800 overflow-hidden shadow-md">
        {orders.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold">
            📦 Chưa có đơn hàng nào tồn tại trên hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
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
                {orders.map((order) => (
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

