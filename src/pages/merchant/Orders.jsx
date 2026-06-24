import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ShoppingBag, Check, X, Ban, Eye, MapPin, Phone, CreditCard, Clock, FileText, AlertCircle, ShoppingCart, DollarSign, Truck } from 'lucide-react';
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

  // Hàm định dạng ngày tháng hiển thị
  const formatOrderDate = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  };

  // Lấy danh sách đơn hàng của quán
  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const statusParam = activeTab === 'ALL' ? '' : activeTab;

      const response = await apiClient.get(`/merchant/orders?restaurantId=${restaurantId}&status=${statusParam}`);
      const realData = response.data?.data?.content || [];
      
      const mapped = realData.map(ord => {
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
          createdAt: formatOrderDate(ord.createdAt),
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
      console.error('Lỗi khi xác nhận đang chuẩn bị món ăn:', err);
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
      toast.success(`Đã xác nhận sẵn sàng giao thành công đơn hàng #${orderId}!`);
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
      toast.success(`Đã từ chối thành công đơn hàng #${orderIdToCancel}`);
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
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'CANCELLED': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'CONFIRMED': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-orange-50 text-orange-700 border-orange-100';
    }
  };

  // Hiển thị nhãn loại thanh toán mượt mà hơn
  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'COD': return 'Thanh toán khi nhận hàng (COD)';
      case 'VNPAY': return 'Chuyển khoản VNPAY';
      default: return method || 'Chưa xác định';
    }
  };

  const maskPhone = (phone) => {
    if (!phone) return 'Chưa có SĐT';
    const cleaned = phone.toString().trim();
    if (cleaned.length < 6) return '****'; 
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
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
                      <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-semibold text-[10px] sm:text-[11px] border transition-colors shrink-0 ${getStatusStyles(order.status)}`}>
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

      {/* MODAL TỪ CHỐI / HỦY ĐƠN HÀNG */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 md:p-6 relative animate-in fade-in zoom-in duration-200 font-google-sans">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base md:text-lg font-bold text-slate-900">Xác Nhận Từ Chối Đơn Hàng #{cancelModal.data}</h3>
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

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chọn nhanh lý do từ chối đơn hàng:</span>
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
                  placeholder="Nhập lý do chi tiết từ chối đơn hàng" 
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

      {/* MODAL CHI TIẾT ĐƠN HÀNG */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-4 md:p-6 relative animate-in fade-in zoom-in duration-200 font-google-sans max-h-[82vh] md:max-h-[90vh] flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b pb-2.5 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600 shrink-0" size={20} />
                <h3 className="text-sm md:text-lg font-bold text-slate-900 truncate max-w-[240px] sm:max-w-none">
                  Chi Tiết Đơn Hàng #{detailModal.data?.orderId}
                </h3>
              </div>
              <button 
                type="button"
                onClick={detailModal.close} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung Modal dạng Scroll */}
            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 text-slate-700 text-xs md:text-sm custom-scrollbar">
              
              {/* THÔNG TIN ĐƠN HÀNG */}
              <div className="bg-slate-50 rounded-xl p-3 md:p-5 border border-slate-100">
                <span className="text-[11px] md:text-[12px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2.5 border-b border-slate-200/60 pb-1">
                  Thông tin đơn hàng
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-semibold text-xs">Mã đơn:</span>
                    <span className="text-slate-900 font-medium">#{detailModal.data?.orderId}</span>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 block text-[11px] font-semibold text-xs">Ngày đặt:</span>
                    <span className="text-slate-800 font-medium">
                      {formatOrderDate(detailModal.data?.createdAt)}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 block text-[11px] font-semibold mb-0.5 text-xs">Trạng thái:</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-bold border ${getStatusStyles(detailModal.data?.orderStatus)}`}>
                      {getStatusLabel(detailModal.data?.orderStatus)}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 block text-[11px] font-semibold text-xs">Khách hàng:</span>
                    <span className="text-slate-900 font-medium">
                      {detailModal.data?.customerName} | {maskPhone(detailModal.data?.customerPhone)}
                    </span>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 flex items-center gap-1 text-[11px] font-semibold mb-0.5 text-xs">
                       Địa chỉ giao hàng:
                    </span>
                    <span className="text-slate-800 font-medium block leading-normal bg-white/60 p-2 rounded-lg border border-slate-100 text-[11px] md:text-sm">
                      {detailModal.data?.deliveryAddress}
                    </span>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 flex items-center gap-1 text-[11px] font-semibold mb-0.5 text-xs">
                       Ghi chú đơn hàng:
                    </span>
                    {detailModal.data?.note ? (
                      <span className="text-slate-800 font-medium block leading-normal bg-white/60 p-2 rounded-lg border border-slate-100 text-[11px] md:text-sm">
                        "{detailModal.data?.note}"
                      </span>
                    ) : (
                      <div className="bg-slate-100/60 border border-slate-200/40 rounded-lg p-2 text-slate-400 text-[11px] italic">
                        Không có ghi chú đơn hàng từ khách hàng
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* THÔNG TIN SẢN PHẨM */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Danh sách sản phẩm ({detailModal.data?.items?.length || 0})
                </span>
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] md:text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-1.5 px-2.5">Sản phẩm</th>
                          <th className="py-1.5 px-2.5 text-right">Đơn giá</th>
                          <th className="py-1.5 px-2.5 text-center">SL</th>
                          <th className="py-1.5 px-2.5 text-right">Tổng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(detailModal.data?.items || []).map((item, idx) => {
                          const price = Number(item.priceAtOrder || 0);
                          const qty = Number(item.quantity || 0);
                          const subTotal = price * qty;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-[11px] md:text-sm">
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden shrink-0 bg-slate-50 hidden sm:block">
                                    <img 
                                      src={item.foodImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'} 
                                      alt={item.foodName} 
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate max-w-[140px] sm:max-w-xs">
                                      {item.foodName}
                                    </p>
                                    {item.note && (
                                      <span className="text-[10px] text-slate-400 block truncate mt-0.5 italic">
                                        Chu thích: {item.note}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2.5 text-right font-medium text-slate-600">
                                {formatCurrency(price)}
                              </td>
                              <td className="py-2 px-2.5 text-center font-medium text-slate-600">
                                {qty}
                              </td>
                              <td className="py-2 px-2.5 text-right font-medium text-slate-600">
                                {formatCurrency(subTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* HÌNH THỨC THANH TOÁN */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1.5 mb-3">
                      Hình thức thanh toán
                    </span>
                    <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                      <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                        <CreditCard size={16} />
                      </div>
                      <span className="text-slate-800 font-medium">
                        {getPaymentMethodLabel(detailModal.data?.paymentMethod)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CHI TIẾT THANH TOÁN */}
                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1.5 mb-2">
                    Chi tiết thanh toán
                  </span>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-xs font-semibold">Tổng tiền hàng:</span>
                    <span className="font-medium">
                      {formatCurrency(Number(detailModal.data?.totalAmount || 0) - Number(detailModal.data?.shippingFee || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-semibold">Phí vận chuyển:</span>
                    <span className="font-medium">
                      {formatCurrency(Number(detailModal.data?.shippingFee || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-slate-800 text-xs md:text-sm">Tổng cộng:</span>
                    <span className="text-base md:text-lg font-extrabold text-blue-600">
                      {formatCurrency(Number(detailModal.data?.totalAmount || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal*/}
            <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-slate-100 shrink-0">
              <button 
                type="button" 
                onClick={detailModal.close}
                className="px-4 py-2 text-xs font-bold border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>

              {detailModal.data?.orderStatus === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleOpenCancelModal(e, detailModal.data.orderId)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <Ban size={13} />
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleConfirm(e, detailModal.data.orderId)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <Check size={13} className="stroke-[3px]" />
                    Nhận đơn
                  </button>
                </>
              )}

              {detailModal.data?.orderStatus === 'CONFIRMED' && (
                <button
                  type="button"
                  onClick={(e) => handlePreparing(e, detailModal.data.orderId)}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                > 
                  Chuẩn bị món
                </button>
              )}

              {detailModal.data?.orderStatus === 'PREPARING' && (
                <button
                  type="button"
                  onClick={(e) => handleReady(e, detailModal.data.orderId)}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto cursor-pointer"
                >
                  Sẵn sàng giao
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}