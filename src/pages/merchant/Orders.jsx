import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ShoppingBag, Check, X, Ban, Eye, MapPin, Phone, CreditCard, Clock, FileText, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import { toast } from 'react-toastify';
import { useModalState } from '../../hooks/useModalState';
import Modal from '../../components/common/Modal';

// Tabs trạng thái đơn hàng 
const ORDER_STATUS_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ xác nhận' },
  { id: 'CONFIRMED', label: 'Đã xác nhận' },
  { id: 'PREPARING', label: 'Đang chuẩn bị' },
  { id: 'READY_FOR_PICKUP', label: 'Đang sẵn sàng' }, 
  { id: 'CANCELLED', label: 'Đã từ chối' },
];

export default function MerchantOrders() {
  const [activeTab, setActiveTab] = useState('ALL'); 
  const [orders, setOrders] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  // State lý do từ chối đơn hàng 
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // STATE CHI TIẾT ĐƠN HÀNG MODAL
  const detailModal = useModalState();
  const [loadingDetail, setLoadingDetail] = useState(false);

  // STATE HỦY ĐƠN HÀNG MODAL
  const cancelModal = useModalState();

  const { subscribe } = useWebSocketContext();

  // Lấy thông tin nhà hàng 
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
        console.error('Lỗi khi lấy thông tin nhà hàng:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, []);

  // Lấy danh sách đơn hàng của quán
  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const statusParam = activeTab === 'ALL' ? '' : activeTab;

      const response = await apiClient.get(`/merchant/orders?restaurantId=${restaurantId}&status=${statusParam}`);
      const realData = response.data?.data?.content || [];
      
      const mapped = realData.map(ord => {
        const dateObj = new Date(ord.createdAt);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        return {
          id: ord.orderId.toString(),
          customer: ord.customerName,
          items: (ord.items || []).map(i => ({
            name: i.foodName,
            quantity: i.quantity,
            price: Number(i.priceAtOrder || 0),
            note: i.note,
            image: i.foodImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'
          })),
          total: Number(ord.totalAmount),
          createdAt: formattedDate,
          phone: ord.customerPhone,
          status: ord.orderStatus,
          shipper: ord.shipperName ? `${ord.shipperName} (${ord.shipperPhone || ''})` : null
        };
      });
      setOrders(mapped);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách đơn hàng:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Lắng nghe thông báo Đơn hàng mới qua WebSocket 
  useEffect(() => {
    if (!restaurantId) return;

    const destination = `/user/queue/notify`;
    console.log('[Merchant Orders WebSocket]: Subscribing to ' + destination);

    const sub = subscribe(destination, (event) => {
      console.log('[Merchant Orders WebSocket]: Received event', event);
      fetchOrders();
    });

    return () => {
      if (sub) {
        console.log('[Merchant Orders WebSocket]: Unsubscribing from ' + destination);
        sub.unsubscribe();
      }
    };
  }, [restaurantId, fetchOrders, subscribe]);

  // Xác nhận đơn hàng
  const handleConfirm = async (e, orderId) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/confirm`);
      toast.success(`Đã xác nhận thành công đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận đơn hàng:', err);
      toast.error(err.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };

  // xác nhận đang chuẩn bị món ăn
  const handlePreparing = async (e, orderId) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/preparing`);
      toast.success(`Đã xác nhận đang chuẩn bị món thành công đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận chế biên món ăn:', err);
      toast.error(err.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };

  //Xác nhận đã sẵn sàng giao đơn
  const handleReady = async (e, orderId) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/ready`);
      toast.success(`Đã báo sẵn sàng giao cho đơn hàng #${orderId}!`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận đã sẵn sàng giao đơn:', err);
      toast.error(err.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };

  // Mở/Đóng Modal hủy đơn hàng của Chủ quán
  const handleOpenCancelModal = (e, orderId) => {
    e.stopPropagation();
    cancelModal.open(orderId);
    setCancelReasonInput('');
  };

  const handleCloseCancelModal = () => {
    if (submittingCancel) return;
    cancelModal.close();
    setCancelReasonInput('');
  };

  //Từ chối đơn hàng
  const handleCancelSubmit = async () => {
    if (!cancelReasonInput.trim()) {
      toast.error('Vui lòng chọn hoặc nhập lý do từ chối!');
      return;
    }
    setSubmittingCancel(true);
    try {
      const orderIdToCancel = cancelModal.data;
      await apiClient.patch(`/merchant/orders/${orderIdToCancel}/reject`, {
        rejectReason: cancelReasonInput.trim()
      });
      toast.success(`Đã từ chối đơn hàng #${orderIdToCancel} thành công`);
      cancelModal.close();
      if (detailModal.data && detailModal.data.orderId.toString() === orderIdToCancel.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi từ chối đơn hàng', err);
      toast.error(err.response?.data?.message);
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Xem chi tiết đơn hàng
  const handleViewDetails = async (orderId) => {
    try {
      setLoadingDetail(true);
      const response = await apiClient.get(`/merchant/orders/${orderId}`);
      const realOrder = response.data?.data;
      if (realOrder) {
        detailModal.open(realOrder);
      }
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết đơn hàng:', err);
      toast.error(err.response?.data?.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  //  hiển thị nhãn trạng thái đơn hàng
  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return 'Chờ xác nhận';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PREPARING': return 'Đang chuẩn bị';
      case 'READY_FOR_PICKUP': return 'Đang sẵn sàng';
      case 'COMPLETED': return 'Thành công';
      case 'CANCELLED': return 'Đã từ chối';
      default: return status;
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700';
      case 'CANCELLED': return 'bg-rose-50 text-rose-700';
      case 'PENDING': return 'bg-amber-50 text-amber-700';
      case 'CONFIRMED': return 'bg-blue-50 text-blue-700';
      default: return 'bg-orange-50 text-orange-700';
    }
  };

  if (!restaurantId && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center font-google-sans p-6">
        <ClipboardList size={56} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để quản lý đơn hàng.</p>
      </div>
    );
  }

  const list = orders || [];

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 font-google-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900">Quản Lý Đơn Hàng</h1>

        {/*Tabs Trạng thái*/}
        <div className="mb-6 overflow-x-auto scrollbar-none touch-pan-x border-b border-slate-200">
          <div className="flex gap-2.5 min-w-max pb-3">
            {ORDER_STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-center py-2 px-4 text-xs md:text-sm font-bold rounded-lg transition-all border whitespace-nowrap cursor-pointer
                    ${isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Danh sách Đơn hàng */}
        <div className="min-h-[600px] w-full">
          {loading && !loadingDetail ? (
            <div className="space-y-4">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : list.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <EmptyState 
                title="Không tìm thấy đơn hàng" 
                message={
                  activeTab === 'ALL' 
                    ? 'Hiện tại hệ thống cửa hàng chưa ghi nhận đơn đặt hàng nào.' 
                    : `Không tìm thấy đơn hàng nào ở trạng thái "${ORDER_STATUS_TABS.find(t => t.id === activeTab)?.label}".`
                }
                icon={ShoppingBag}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((order) => (
                <div 
                  key={order.id}
                  onClick={() => handleViewDetails(order.id)}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col gap-4 cursor-pointer group transition-colors hover:border-slate-200"
                >
                  {/* Card Header*/}
                  <div className="flex flex-row justify-between items-center gap-2 border-b border-slate-100 pb-3 flex-wrap sm:flex-nowrap">
                    <div className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-wide whitespace-nowrap shrink-0">
                      MÃ ĐƠN <span className="text-slate-900 font-extrabold">#{order.id}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock size={13} />
                        {order.createdAt}
                      </span>
                      <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-semibold text-[10px] sm:text-[11px] transition-colors shrink-0 ${getStatusStyles(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Danh sách món ăn*/}
                  <div className="w-full">
                    <div className="w-full overflow-x-auto scrollbar-none touch-pan-x" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-row gap-3 sm:gap-4 w-max max-w-full pb-1">
                        {order.items.map((item, idx) => (
                          <div 
                            key={idx}
                            className="flex gap-3 items-center border border-slate-100 rounded-lg p-3 bg-slate-50/50 w-[260px] sm:w-[280px] shrink-0 select-none relative"
                          >
                            <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 border border-slate-200 bg-white">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                              <p className="text-xs text-blue-600 font-bold mt-1">
                                {formatCurrency(item.price)}{' '}
                                <span className="text-slate-400 font-normal text-[11px] ml-1">x{item.quantity}</span>
                              </p>
                              {item.note && (
                                <div className="text-[10px] font-medium truncate mt-0.5 italic" title={item.note}>
                                  Ghi chú: "{item.note}"
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer*/}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-t border-slate-100 pt-4 mt-1 gap-3">
                    <div className="text-sm text-slate-500 font-medium">
                      Tổng tiền:{' '}
                      <span className="text-base font-extrabold text-blue-600 ml-1">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                      {/*Xem chi tiết */}
                      <button
                        type="button"
                        onClick={() => handleViewDetails(order.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
                      >
                        <Eye size={13} />
                        Chi tiết
                      </button>

                      {order.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleOpenCancelModal(e, order.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                          >
                            <Ban size={13} />
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleConfirm(e, order.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                          >
                            <Check size={13} className="stroke-[3px]" />
                            Nhận đơn
                          </button>
                        </>
                      )}

                      {order.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={(e) => handlePreparing(e, order.id)}
                          className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                        >
                          Chuẩn bị món
                        </button>
                      )}

                      {order.status === 'PREPARING' && (
                        <button
                          type="button"
                          onClick={(e) => handleReady(e, order.id)}
                          className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                        >
                          Sẵn sàng giao
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL TỪ CHỐI / HỦY ĐƠN HÀNG */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 md:p-6 relative animate-in fade-in zoom-in duration-200 font-google-sans">
            
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base md:text-lg font-bold text-slate-900">Từ Chối Đơn Hàng #{cancelModal.data}</h3>
              <button 
                type="button"
                disabled={submittingCancel}
                onClick={handleCloseCancelModal} 
                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-slate-700">
              <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium border border-rose-100 flex items-start gap-2">
                <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={15} />
                <span>Lưu ý: Hành động từ chối đơn hàng sẽ hủy giao dịch của khách hàng ngay lập tức.</span>
              </div>

              {/* Lợi chọn lý do nhanh dành cho Chủ nhà hàng */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chọn lý do từ chối đơn hàng:</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {['Nhà hàng đã hết món này', 'Quán đang quá tải đơn hàng', 'Cửa hàng đang chuẩn bị đóng cửa', 'Không thể liên hệ giải quyết ghi chú'].map((reason, idx) => (
                    <button 
                      key={idx} 
                      type="button" 
                      disabled={submittingCancel}
                      onClick={() => setCancelReasonInput(reason)} 
                      className={`text-left px-3.5 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                        cancelReasonInput === reason 
                          ? 'border-blue-600 bg-blue-50/50 text-blue-600' 
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hoặc nhập lý do khác:</span>
                <textarea 
                  value={cancelReasonInput} 
                  onChange={(e) => setCancelReasonInput(e.target.value)} 
                  placeholder="Nhập lý do chi tiết từ chối đơn hàng..." 
                  rows={3} 
                  disabled={submittingCancel}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-slate-50/50 text-slate-800 resize-none disabled:opacity-50" 
                  maxLength={300} 
                />
              </div>

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
                  onClick={handleCancelSubmit}
                  disabled={submittingCancel || !cancelReasonInput.trim()}
                  className="px-5 py-2 text-xs font-bold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {submittingCancel ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL CHI TIẾT ĐƠN HÀNG */}
      {detailModal.isOpen && (
        <Modal isOpen={detailModal.isOpen} onClose={detailModal.close} title="Thông Tin Đơn Hàng Chi Tiết">
          <div className="p-2 text-sm font-google-sans">
             <p className="mb-2 font-bold text-slate-800">Mã Đơn Hàng: #{detailModal.data?.orderId}</p>
             <p className="mb-2">Khách hàng: <span className="font-semibold">{detailModal.data?.customerName}</span></p>
             <p className="mb-4">Trạng thái: <span className="text-blue-600 font-bold">{getStatusLabel(detailModal.data?.orderStatus)}</span></p>
          </div>
        </Modal>
      )}
    </div>
  );
}