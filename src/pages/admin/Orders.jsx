import React, { useState, useMemo } from 'react';
import { Package, RefreshCw, CheckCircle2, Clock, Truck, XCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { toast } from 'react-toastify';
import ErrorState from '../../components/common/ErrorState';
import OrderCancelModal from '../../components/common/OrderCancelModal';
import Badge from '../../components/common/Badge';
import FilterTabs from '../../components/common/FilterTabs';
import { useModalState } from '../../hooks/useModalState';

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('all'); // all | completed | processing | delivering | cancelled
  const [keyword, setKeyword] = useState('');              
  const [page, setPage] = useState(0);                     
  const pageSize = 10;                                     

  const cancelModal = useModalState();

  const handleOpenCancelModal = (orderId) => {
    cancelModal.open(orderId);
  };

  const handleCancelSubmit = async (reason) => {
    try {
      const orderIdToCancel = cancelModal.data;
      await apiClient.post(`/orders/${orderIdToCancel}/cancel`, { reason });
      toast.success(`Đã hủy đơn hàng #${orderIdToCancel} thành công`);
      cancelModal.close();
      refetch();
      refetchKpi();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng này.');
    }
  };

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: pageSize.toString(),
    });

    if (keyword.trim()) {
      params.append('keyword', keyword.trim());
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'processing' || statusFilter === 'delivering') {
        params.append('statusGroup', statusFilter.toUpperCase());
      } else {
        params.append('status', statusFilter.toUpperCase());
      }
    }

    return `/admin/orders?${params.toString()}`;
  }, [page, pageSize, statusFilter, keyword]);

  const mapOrders = (data) => {
    const realData = data?.content || data || [];
    const items = realData.map(ord => {
      const dateObj = ord.createdAt ? new Date(ord.createdAt) : new Date();
      const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      return {
        id: ord.orderId?.toString() || '—',
        resName: ord.restaurantName || 'Quán ăn đối tác',
        customer: ord.customerName || 'Khách hàng',
        customerPhone: ord.customerPhone,
        total: Number(ord.totalAmount) || 0,
        status: ord.orderStatus,
        date: dateStr
      };
    });

    return {
      items,
      totalPages: data?.totalPages || 1,
      totalElements: data?.totalElements || items.length
    };
  };

  const { data: pageData, loading, error, refetch } = useFetchData(apiUrl, {
    mapFn: mapOrders,
  });

  const { data: kpiData, refetch: refetchKpi } = useFetchData('/admin/orders/stats');

  const ordersList = pageData?.items || [];
  const totalPages = pageData?.totalPages || 1;
  const totalElements = pageData?.totalElements || 0;

  const orderSummary = useMemo(() => {
    return {
      totalOrders: kpiData?.totalOrders ?? totalElements,
      completedOrders: kpiData?.completedOrders ?? 0,
      processingOrders: kpiData?.processingOrders ?? 0,
      deliveringOrders: kpiData?.deliveringOrders ?? 0,
      cancelledOrders: kpiData?.cancelledOrders ?? 0
    };
  }, [kpiData, totalElements]);

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(0); 
  };

  const handleSearchChange = (e) => {
    setKeyword(e.target.value);
    setPage(0); 
  };

  if (loading && ordersList.length === 0) {
    return <Spinner fullScreen />;
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-6 w-full font-google-sans text-slate-800 pb-24 flex justify-center items-center bg-white">
        <ErrorState onRetry={() => { refetch(); refetchKpi(); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 py-5 w-full font-google-sans text-slate-800 pb-24 space-y-5 bg-white min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Package className="text-purple-600" size={22} />
          Quản Lý Đơn Hàng
        </h1>
      </div>

      {/* ─── HÀNG KPI TÓM TẮT ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tổng đơn hàng', value: `${orderSummary.totalOrders} đơn`, sub: `Doanh số`, icon: Package, color: 'border-purple-100 bg-purple-50/50 text-purple-600', iconBg: 'bg-purple-100 text-purple-600' },
          { label: 'Đã giao thành công', value: `${orderSummary.completedOrders} đơn`, sub: 'Hoàn tất giao - thanh toán', icon: CheckCircle2, color: 'border-emerald-100 bg-emerald-50/50 text-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600' },
          { label: 'Đang xử lý', value: `${orderSummary.processingOrders} đơn`, sub: 'Chờ xác nhận -> Chuẩn bị món', icon: Clock, color: 'border-amber-100 bg-amber-50/50 text-amber-600', iconBg: 'bg-amber-100 text-amber-600' },
          { label: 'Đang giao', value: `${orderSummary.deliveringOrders} đơn`, sub: 'Đã lấy hàng -> Đang giao', icon: Truck, color: 'border-blue-100 bg-blue-50/50 text-blue-600', iconBg: 'bg-blue-100 text-blue-600' },
          { label: 'Đã hủy', value: `${orderSummary.cancelledOrders} đơn`, sub: 'Bị hủy bởi các bên', icon: XCircle, color: 'border-red-100 bg-red-50/50 text-red-600', iconBg: 'bg-red-100 text-red-600' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`rounded-2xl p-3.5 border shadow-sm flex items-center gap-3 ${kpi.color}`}>
              <div className={`p-2 rounded-xl shrink-0 ${kpi.iconBg}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-bold block truncate uppercase tracking-wider">{kpi.label}</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{kpi.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <FilterTabs
            tabs={[
              { id: 'all', label: `Tất cả` },
              { id: 'processing', label: `Đang xử lý` },
              { id: 'delivering', label: `Đang giao` },
              { id: 'completed', label: `Đã giao` },
              { id: 'cancelled', label: `Đã hủy` },
            ]}
            activeTab={statusFilter}
            onTabChange={handleStatusChange}
            className="bg-transparent p-0 w-max"
            activeClassName="bg-purple-600 text-white shadow-sm font-bold"
          />

          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={keyword}
              onChange={handleSearchChange}
              placeholder="Tìm theo mã đơn, quán ăn, khách hàng..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {ordersList.length === 0 ? (
          <div className="text-center py-14 text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <Package size={36} className="text-slate-300" strokeWidth={1.5} />
            Không tìm thấy đơn hàng nào phù hợp với từ khóa và bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left min-w-[950px] table-fixed">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-24">Mã đơn</th>
                  <th className="py-3.5 px-4 w-44">Quán ăn</th>
                  <th className="py-3.5 px-4 w-36">Khách hàng</th>
                  <th className="py-3.5 px-4 w-32">SĐT khách hàng</th>
                  <th className="py-3.5 px-4 w-32">Tổng tiền</th>
                  <th className="py-3.5 px-4 w-40">Thời gian</th>
                  <th className="py-3.5 px-4 w-36">Trạng thái</th>
                  <th className="py-3.5 px-4 w-28 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {ordersList.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 w-24 font-extrabold text-slate-800 truncate">#{order.id}</td>
                    <td className="py-3.5 px-4 w-44 text-slate-600 font-bold truncate" title={order.resName}>{order.resName}</td>
                    <td className="py-3.5 px-4 w-36 text-slate-600 font-bold truncate" title={order.customer}>{order.customer}</td>
                    <td className="py-3.5 px-4 w-32 text-slate-600 font-bold truncate">{order.customerPhone || '—'}</td>
                    <td className="py-3.5 px-4 w-32 font-extrabold text-purple-600 truncate">{formatCurrency(order.total)}</td>
                    <td className="py-3.5 px-4 w-40 text-slate-500 font-medium truncate">{order.date}</td>
                    <td className="py-3.5 px-4 w-36 truncate">
                      {order.status && (
                        <Badge status={order.status} className="text-[10px] font-bold px-2.5 py-1 rounded-full border inline-block max-w-full truncate" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 w-28 text-center">
                      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ? (
                        <button
                          onClick={() => handleOpenCancelModal(order.id)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-red-50 hover:bg-red-100 text-red-600 border-red-200/60 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1"
                        >
                          <span>Hủy đơn</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 font-bold inline-block w-full text-center">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* THANH PHÂN TRANG */}
        {totalPages > 0 && (
          <div className="py-3.5 px-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="text-slate-800 font-bold">{ordersList.length}</span> / <span className="text-slate-800 font-bold">{totalElements}</span> đơn hàng
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(prev - 1, 0))}
                disabled={page === 0 || loading}
                className="flex items-center gap-1 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-xl"
              >
                <ChevronLeft size={14} /> 
              </Button>

              <div className="flex items-center gap-1 px-1">
                <span className="text-xs text-slate-500">Trang {page + 1}</span>
                <span className="text-xs text-slate-500">/</span>
                <span className="text-xs text-slate-500">{totalPages}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages - 1))}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-xl"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrderCancelModal
        isOpen={cancelModal.isOpen}
        onClose={() => cancelModal.close()}
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