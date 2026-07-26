import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ShoppingBag, Check, X, Ban, Eye, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import { toast } from 'react-toastify';
import { useModalState } from '../../hooks/useModalState';
import FilterTabs from '../../components/common/FilterTabs';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal'; 
import OrderCancelModal from '../../components/common/OrderCancelModal';
import { getStatusConfig } from '../../utils/orderStatusHelper';
import { getFoodImageUrl } from '../../utils/avatarHelper';

const ORDER_STATUS_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ xác nhận' },
  { id: 'CONFIRMED', label: 'Đã xác nhận' },
  { id: 'PREPARING', label: 'Đang chuẩn bị' },
  { id: 'READY_FOR_PICKUP', label: 'Chờ lấy hàng' }, 
  { id: 'COMPLETED', label: 'Thành công' },
  { id: 'CANCELLED', label: 'Đã từ chối' },
];

export default function MerchantOrders() {
  const [activeTab, setActiveTab] = useState('ALL'); 
  const [orders, setOrders] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  // STATE PHÂN TRANG
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 5;

  // State lý do từ chối đơn hàng 
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // STATE CHI TIẾT ĐƠN HÀNG MODAL
  const detailModal = useModalState();
  const [loadingDetail, setLoadingDetail] = useState(false);

  // STATE HỦY ĐƠN HÀNG MODAL
  const cancelModal = useModalState();

  const { subscribe } = useWebSocketContext();

  // Reset về trang 1 khi đổi tab
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

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
        toast.error(err.response?.data?.message || 'Không thể lấy thông tin nhà hàng');
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
      const response = await apiClient.get('/merchant/orders', 
        { 
          params: {
            restaurantId: restaurantId,
            status: activeTab === 'ALL' ? undefined : activeTab,
            page: currentPage - 1,
            size: pageSize
          }
        }        
      );
      
      const realData = response.data?.data?.content || [];
      setTotalPages(response.data?.data?.totalPages || 1);
      
      const mapped = realData.map(ord => {
        return {
          id: ord.orderId.toString(),
          customer: ord.customerName,
          items: (ord.items || []).map(i => ({
            name: i.foodName,
            quantity: i.quantity,
            price: Number(i.priceAtOrder || 0),
            note: i.note,
            // Ảnh món: dùng ảnh thật, thiếu thì fallback ảnh mặc định nội bộ (bỏ ảnh Unsplash hardcode)
            image: getFoodImageUrl(i.foodImageUrl)
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
      toast.error(err.response?.data?.message || 'Lỗi tải danh sách đơn hàng');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeTab, currentPage]);

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
      await apiClient.patch(`/merchant/orders/${orderId}/confirm`);
      toast.success(`Đã xác nhận thành công đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận đơn hàng:', err);
      toast.error(err.response?.data?.message);
    }
  };

  // xác nhận đang chuẩn bị món ăn
  const handlePreparing = async (e, orderId) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/merchant/orders/${orderId}/preparing`);
      toast.success(`Đã xác nhận đang chuẩn bị món thành công đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận đang chuẩn bị món:', err);
      toast.error(err.response?.data?.message);
    }
  };

  //Xác nhận đã sẵn sàng giao đơn
  const handleReady = async (e, orderId) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/merchant/orders/${orderId}/ready`);
      toast.success(`Đã xác nhận sẵn sàng giao thành công đơn hàng #${orderId}!`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error('Lỗi khi xác nhận đã sẵn sàng giao đơn:', err);
      toast.error(err.response?.data?.message);
    }
  };

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
      toast.error('Vui lòng chọn hoặc nhập lý do từ chối đơn hàng!');
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

  const maskPhone = (phone) => {
    if (!phone) return 'Chưa có SĐT';
    const cleaned = phone.toString().trim();
    if (cleaned.length < 6) return '****'; 
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
  };

  const getStatus = (status) => {
    switch (status) {
      case 'PENDING': return 'Chờ xác nhận';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PREPARING': return 'Đang chuẩn bị';
      case 'READY_FOR_PICKUP': return 'Chờ lấy hàng';
      case 'COMPLETED': return 'Thành công';
      case 'CANCELLED': return 'Đã từ chối';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'COD': return 'Thanh toán khi nhận hàng (COD)';
      case 'VNPAY': return 'Chuyển khoản VNPAY';
      default: return method || 'Chưa xác định';
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

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 font-google-sans text-gray-800 relative">
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/10 z-50 flex items-center justify-center pointer-events-auto">
          <div className="bg-white p-3 rounded-lg shadow-md flex items-center gap-2 text-xs font-semibold text-blue-600">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            Đang tải chi tiết...
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900">Quản Lý Đơn Hàng</h1>
        
        <div className="mb-6 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none w-full">
          <FilterTabs 
            tabs={ORDER_STATUS_TABS} 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            className="flex flex-row !flex-nowrap whitespace-nowrap [&_div]:flex [&_div]:flex-row [&_div]:flex-nowrap [&_button]:shrink-0 [&_button.bg-md-primary]:!bg-blue-600 [&_button.bg-md-primary]:!text-white [&_button.bg-md-primary]:!shadow-blue-100" 
          />
        </div>

        <div className="min-h-[600px] w-full">
          {loading ? (
            <div className="space-y-4">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : orders.length === 0 ? (
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
              {orders.map((order) => (
                <div 
                  key={order.id}
                  onClick={() => handleViewDetails(order.id)}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col gap-4 cursor-pointer group transition-colors hover:border-slate-200"
                >
                  <div className="flex flex-row justify-between items-center gap-2 border-b border-slate-100 pb-3 flex-wrap sm:flex-nowrap">
                    <div className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-wide whitespace-nowrap shrink-0">
                      MÃ ĐƠN <span className="text-slate-900 font-extrabold">#{order.id}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock size={13} />
                        {order.createdAt}
                      </span>
                      <Badge status={order.status} className="text-[10px] sm:text-[11px] px-2 py-0.5 sm:px-3 sm:py-1 rounded-full" />
                    </div>
                  </div>

                  {/* Danh sách món ăn */}
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

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-t border-slate-100 pt-4 mt-1 gap-3">
                    <div className="text-sm text-slate-500 font-medium">
                      Tổng tiền:{' '}
                      <span className="text-base font-extrabold text-blue-600 ml-1">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        onClick={(e) => {
                          e.stopPropagation(); 
                          handleViewDetails(order.id);
                        }}
                        className="w-full sm:w-auto !py-2.5 rounded-lg text-xs hover:border-blue-600 hover:text-blue-600"
                      >
                        Chi tiết
                      </Button>

                      {order.status === 'PENDING' && (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Ban}
                            onClick={(e) => handleOpenCancelModal(e, order.id)}
                            className="w-full sm:w-auto !py-2.5 rounded-lg text-xs"
                          >
                            Từ chối
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Check}
                            onClick={(e) => handleConfirm(e, order.id)}
                            className="w-full sm:w-auto !py-2.5 rounded-lg text-xs !bg-emerald-600"
                          >
                            Nhận đơn
                          </Button>
                        </>
                      )}

                      {order.status === 'CONFIRMED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => handlePreparing(e, order.id)}
                          className="w-full sm:w-auto !py-2.5 rounded-lg text-xs !bg-blue-600"
                        >
                          Chuẩn bị món
                        </Button>
                      )}

                      {order.status === 'PREPARING' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleReady(e, order.id)}
                          className="w-full sm:w-auto !py-2.5 rounded-lg text-xs !bg-[#34A853] hover:!bg-[#2E8B49]"
                        >
                          Sẵn sàng giao
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1.5 mt-5 mb-5 pt-2 pb-2 border-t border-slate-100 selection:bg-transparent">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 bg-white shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 disabled:active:scale-100 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang trước"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>

                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    const isActive = currentPage === pageNumber;
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-95 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 bg-white shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 disabled:active:scale-100 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang sau"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={cancelModal.isOpen}
        onClose={handleCloseCancelModal}
        title={`Xác Nhận Từ Chối Đơn Hàng #${cancelModal.data}`}
        size="sm"
      >
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
            <Button 
              variant="outline" 
              size="sm" 
              disabled={submittingCancel}
              onClick={handleCloseCancelModal}
              className="!py-2 rounded-lg text-xs hover:border-blue-600 hover:text-blue-600"
            >
              Đóng
            </Button>
            <Button 
              variant="danger" 
              size="sm" 
              loading={submittingCancel}
              onClick={handleCancelSubmit}
              className="!py-2 rounded-lg text-xs"
            >
              Xác nhận từ chối
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL CHI TIẾT ĐƠN HÀNG */}
      <Modal
        isOpen={detailModal.isOpen && !!detailModal.data}
        onClose={detailModal.close}
        title={detailModal.data ? `Chi Tiết Đơn Hàng #${detailModal.data.orderId}` : ''}
        size="lg"
      >
        {detailModal.data && (
          <>
            <p className="text-xs text-slate-400 -mt-3 mb-3">Thời gian đặt: {formatOrderDate(detailModal.data.createdAt)}</p>
            
            <div className="mb-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 border-b border-slate-200/60">
                <div>
                  <h4 className="font-bold text-slate-500 uppercase tracking-wide mb-0.5">Thông tin khách hàng</h4>
                  <p className="text-slate-600"><span className="font-medium">Họ và tên:</span> {detailModal.data.customerName}</p>
                  <p className="text-slate-600 mt-0.5"><span className="font-medium">SĐT:</span> {maskPhone(detailModal.data?.customerPhone)}</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-500 uppercase tracking-wide mb-0.5">Thông tin giao hàng</h4>
                  <p className="text-slate-600">Trạng thái: {getStatus(detailModal.data?.orderStatus)}</p>
                  <p className="text-slate-600 mt-0.5">Người giao hàng: {detailModal.data.shipperName ? `${detailModal.data.shipperName} - ${detailModal.data.shipperPhone}` : 'Chưa có tài xế nhận'}</p>
                </div>
              </div>
              
              <div className="pt-2">
                <p className="text-slate-600 break-words" title={detailModal.data.deliveryAddress}>
                  <span className="font-medium text-slate-700">Địa chỉ giao hàng:</span> {detailModal.data.deliveryAddress}
                </p>
              </div>
            </div>

            {/* Chi tiết danh sách món ăn */}
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 border-b pb-3 mb-3 scrollbar-thin">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Danh sách món ăn</h4>
              {(detailModal.data.items || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg text-sm shadow-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getFoodImageUrl(item.foodImageUrl)}
                      alt={item.foodName}
                      className="w-9 h-9 object-cover rounded border border-slate-200"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate leading-tight">{item.foodName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Số lượng: {item.quantity}</p>
                      {item.note && <p className="text-[11px] text-amber-600 italic">Ghi chú: "{item.note}"</p>}
                    </div>
                  </div>
                  <p className="font-bold text-slate-900 shrink-0 text-xs text-right">
                    {formatCurrency((item.priceAtOrder) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-3 mb-4 text-xs">
              {/* Phương thức thanh toán & Ghi chú đơn hàng */}
              <div className="flex-1 space-y-2 w-full sm:w-auto">
                <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-slate-700">
                  <span className="font-bold text-slate-600">Phương thức thanh toán:</span>
                  <p className="font-medium mt-0.5">{getPaymentMethodLabel(detailModal.data?.paymentMethod)}</p>
                </div>
                {detailModal.data.note && (
                  <div className="p-2 bg-amber-50/60 border border-amber-100 text-amber-800 rounded-lg italic">
                    <span className="font-bold not-italic">Ghi chú đơn hàng:</span> "{detailModal.data.note}"
                  </div>
                )}
              </div>

              {/* tổng tiền */}
              <div className="w-full sm:max-w-[260px] shrink-0 space-y-1.5 self-end sm:self-auto">
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Tạm tính</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(detailModal.data.subtotalAmount || detailModal.data.totalAmount - (detailModal.data.shippingFee || 0))}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Phí giao hàng</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(detailModal.data.shippingFee || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200">
                  <span className="text-sm font-bold text-slate-800">Tổng cộng</span>
                  <span className="text-blue-600 text-base font-extrabold">{formatCurrency(detailModal.data.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Khối điều hướng các Button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={detailModal.close} className="rounded-lg text-xs !py-1.5 hover:border-blue-600 hover:text-blue-600">
                Đóng
              </Button>
              
              {(detailModal.data.orderStatus === 'PENDING') && (
                <Button 
                    variant="primary" 
                    size="sm" 
                    icon={Check}
                    onClick={(e) => handleConfirm(e, detailModal.data.orderId)}
                    className="rounded-lg text-xs !py-1.5 !bg-emerald-600"
                  >
                    Nhận đơn
                </Button>
              )}

              {(detailModal.data.orderStatus === 'CONFIRMED') && (
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={(e) => handlePreparing(e, detailModal.data.orderId)}
                  className="rounded-lg text-xs !py-1.5 !bg-blue-600"
                >
                  Chuẩn bị món
                </Button>
              )}

              {(detailModal.data.orderStatus === 'PREPARING') && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={(e) => handleReady(e, detailModal.data.orderId)}
                  className="rounded-lg text-xs !py-1.5 !bg-[#34A853] hover:!bg-[#2E8B49]"
                >
                  Sẵn sàng giao
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}