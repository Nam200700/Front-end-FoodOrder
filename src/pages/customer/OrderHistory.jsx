import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { ShoppingBag, RefreshCw, Ban, AlertCircle, X, MessageSquare } from 'lucide-react'; // Thêm MessageSquare icon
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';

// Tabs trạng thái đơn hàng
const ORDER_STATUS_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ xác nhận' },
  { id: 'CONFIRMED', label: 'Đã xác nhận' },
  { id: 'PREPARING', label: 'Đang chuẩn bị' },
  { id: 'DELIVERING', label: 'Đang giao' }, 
  { id: 'COMPLETED', label: 'Thành công' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

// Component hiển thị danh sách sản phẩm
function OrderProductRow({ items }) {
  return (
    <div 
      className="w-full overflow-x-auto scrollbar-none touch-pan-x" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-row gap-3 sm:gap-4 w-max max-w-full pb-1">
        {items.map((item, idx) => (
          <div 
            key={idx}
            className="flex gap-3 items-center border border-slate-100 rounded-lg p-3 bg-slate-50/50 w-[260px] sm:w-[280px] shrink-0 select-none"
          >
            <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 border border-slate-200 bg-white">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" draggable="false" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
              <p className="text-xs text-orange-500 font-bold mt-1">
                {formatCurrency(item.price)}{' '}
                <span className="text-slate-400 font-normal text-[11px] ml-1">x{item.quantity}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const replaceCart = useCartStore((state) => state.replaceCart);
  const [activeTab, setActiveTab] = useState('ALL');

  // Các States xử lý nghiệp vụ hủy đơn hàng
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const mapOrders = (data) => {
    const realData = data?.content || [];
    return realData.map((order) => {
      const dateObj = new Date(order.createdAt);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      
      const formattedDate = `${day}-${month}-${year} ${hours}:${minutes}`;

      return {
        id: order.orderId.toString(),
        restaurantId: order.restaurantId.toString(),
        restaurantName: order.restaurantName,
        items: (order.items || []).map((i) => ({
          id: `food-${i.foodId}`,
          name: i.foodName,
          price: Number(i.priceAtOrder),
          quantity: i.quantity,
          image: i.foodImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
        })),
        total: Number(order.totalAmount),
        status: order.orderStatus,
        createdAt: formattedDate,
      };
    });
  };

  const queryParams = activeTab === 'ALL' ? {} : { status: activeTab };

  const { data: orders, loading, error, refetch } = useFetchData('/orders', {
    mapFn: mapOrders,
    params: queryParams, 
  });

  // hiển thị modal hủy đơn
  const handleOpenCancelModal = (e, orderId) => {
    e.stopPropagation(); 
    setSelectedOrderId(orderId);
    setCancelReasonInput('');
    setIsCancelModalOpen(true);
  };

  // Đóng modal và reset trạng thái dữ liệu
  const handleCloseCancelModal = () => {
    if (submittingCancel) return;
    setIsCancelModalOpen(false);
    setSelectedOrderId(null);
    setCancelReasonInput('');
  };

  // hủy đơn hàng
  const handleCancelOrderSubmit = async () => {
    if (!cancelReasonInput.trim()) {
      toast.error('Vui lòng nhập hoặc chọn lý do hủy!');
      return;
    }

    setSubmittingCancel(true);
    try {
      await apiClient.post(`/orders/${selectedOrderId}/cancel`, {
        reason: cancelReasonInput.trim()
      });
      toast.success(`Đã hủy thành công đơn hàng #${selectedOrderId}!`);
      setIsCancelModalOpen(false);
      refetch(); 
    } catch (err) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng!');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // mua lại
  const handleReorder = (e, order) => {
    e.stopPropagation(); 
    const newItems = order.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      note: '',
      image: item.image,
    }));
    
    replaceCart(newItems, order.restaurantId, order.restaurantName);
    navigate('/cart');
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Thành công';
      case 'CANCELLED': return 'Đã hủy';
      case 'PENDING': return 'Chờ xác nhận';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PREPARING': return 'Đang chuẩn bị';
      case 'READY_FOR_PICKUP': return 'Chờ tài xế';
      default: return 'Đang giao hàng';
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'COMPLETED': 
        return 'bg-emerald-50 text-emerald-700';
      case 'CANCELLED': 
        return 'bg-rose-50 text-rose-700';
      case 'PENDING': 
        return 'bg-amber-50 text-amber-700';
      case 'CONFIRMED': 
        return 'bg-blue-50 text-blue-700';
      default: 
        return 'bg-orange-50 text-orange-700';
    }
  };

  const list = orders || [];

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 font-google-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900">Đơn Hàng Của Tôi</h1>

        {/* Thanh điều hướng Tabs Trạng thái */}
        <div className="mb-6 overflow-x-auto scrollbar-none touch-pan-x border-b border-slate-200">
          <div className="flex gap-2.5 min-w-max pb-3">
            {ORDER_STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-center py-2 px-4 text-xs md:text-sm font-bold rounded-lg transition-all border whitespace-nowrap cursor-pointer
                    ${
                      isActive
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[600px] w-full">
          {loading ? (
            <div className="space-y-4">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : error ? (
            <div className="flex justify-center items-center py-12">
              <ErrorState onRetry={refetch} />
            </div>
          ) : list.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <EmptyState 
                title="Không tìm thấy đơn hàng" 
                message={
                  activeTab === 'ALL' 
                    ? 'Lịch sử mua hàng của bạn sẽ hiển thị tại đây khi bạn đặt đơn đầu tiên.' 
                    : `Bạn chưa có đơn hàng nào ở trạng thái "${ORDER_STATUS_TABS.find(t => t.id === activeTab)?.label}".`
                }
                icon={ShoppingBag}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((order) => (
                <div 
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col gap-4 cursor-pointer group transition-colors hover:border-slate-200"
                >
                  {/* Card Header */}
                  <div className="flex flex-row justify-between items-center gap-2 border-b border-slate-100 pb-3 flex-wrap sm:flex-nowrap">
                    <div className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-wide whitespace-nowrap shrink-0">
                      MÃ ĐƠN <span className="text-slate-900 font-extrabold">#{order.id}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1 shrink-0">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {order.createdAt}
                      </span>
                      
                      <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-semibold text-[10px] sm:text-[11px] transition-colors shrink-0 ${getStatusStyles(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="w-full">
                    <OrderProductRow items={order.items} />
                  </div>

                  {/* Card Footer */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-t border-slate-100 pt-4 mt-1 gap-3">
                    <div className="text-sm text-slate-500 font-medium">
                      Tổng tiền thanh toán:{' '}
                      <span className="text-base font-extrabold text-orange-500 ml-1">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {order.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenCancelModal(e, order.id)}
                          className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                        >
                          <Ban size={13} />
                          Hủy đơn hàng
                        </button>
                      ) : (
                        <>
                          {order.status === 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation(); 
                                navigate(`/reviews/${order.id}`);
                              }}
                              className="flex items-center justify-center gap-1.5 px-5 py-2.5 border border-orange-500 text-orange-500 hover:bg-orange-50 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                            >
                              <MessageSquare size={13} />
                              Viết đánh giá
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={(e) => handleReorder(e, order)}
                            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                          >
                            <RefreshCw size={13} />
                            Mua lại
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL HỦY ĐƠN HÀNG */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 md:p-6 relative animate-in fade-in zoom-in duration-200 font-google-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2 text-orange-500">
                <AlertCircle size={22} className="shrink-0" />
                <h3 className="text-base md:text-lg font-bold text-slate-900">Xác Nhận Hủy Đơn Hàng #{selectedOrderId}</h3>
              </div>
              <button 
                type="button"
                disabled={submittingCancel}
                onClick={handleCloseCancelModal} 
                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-slate-700">
              
              <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-100 flex items-start gap-2">
                <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={15} />
                <span>Lưu ý: Hành động hủy đơn hàng không thể hoàn tác sau khi hệ thống đã xác nhận xử lý.</span>
              </div>

              {/* Lựa chọn lý do nhanh */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chọn nhanh lý do gợi ý:</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {['Đổi ý không đặt nữa', 'Đặt nhầm món / nhầm số lượng', 'Thời gian giao hàng quá lâu', 'Muốn thay đổi địa chỉ nhận hàng'].map((reason, idx) => (
                    <button 
                      key={idx} 
                      type="button" 
                      disabled={submittingCancel}
                      onClick={() => setCancelReasonInput(reason)} 
                      className={`text-left px-3.5 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                        cancelReasonInput === reason 
                          ? 'border-orange-500 bg-orange-50/50 text-orange-600' 
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-orange-300'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hoặc nhập lý do cụ thể:</span>
                <textarea 
                  value={cancelReasonInput} 
                  onChange={(e) => setCancelReasonInput(e.target.value)} 
                  placeholder="Nhập lý do hủy đơn hàng" 
                  rows={3} 
                  disabled={submittingCancel}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-slate-50/50 text-slate-800 resize-none disabled:opacity-50" 
                  maxLength={300} 
                />
              </div>

              {/* Modal Actions Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  disabled={submittingCancel}
                  onClick={handleCloseCancelModal}
                  className="px-4 py-2 text-xs font-bold border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Đóng
                </button>
                <button 
                  type="button" 
                  onClick={handleCancelOrderSubmit}
                  disabled={submittingCancel || !cancelReasonInput.trim()}
                  className="px-5 py-2 text-xs font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {submittingCancel ? 'Đang xử lý...' : 'Xác nhận hủy'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}