import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, ShoppingBag, Check, X, Ban, Eye, Clock, AlertCircle,
  User, Phone, MapPin, Bike, Wallet, StickyNote, CalendarClock, UtensilsCrossed, Package, BadgeCheck
} from 'lucide-react';
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
import { getFoodImageUrl, DEFAULT_FOOD_IMAGE } from '../../utils/avatarHelper';

// Dải màu viền trái theo trạng thái đơn để owner quét nhanh (giảm tải nhận thức)
const STATUS_ACCENT = {
  PENDING: 'border-l-amber-400',
  CONFIRMED: 'border-l-blue-500',
  PREPARING: 'border-l-indigo-500',
  READY_FOR_PICKUP: 'border-l-teal-500',
  PICKED_UP: 'border-l-cyan-500',
  DELIVERING: 'border-l-sky-500',
  COMPLETED: 'border-l-emerald-500',
  CANCELLED: 'border-l-rose-400',
};

// Pill trạng thái cho modal chi tiết (màu + icon) — làm nổi bật trạng thái đơn
const STATUS_PILL = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Check },
  PREPARING: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: UtensilsCrossed },
  READY_FOR_PICKUP: { bg: 'bg-teal-100', text: 'text-teal-700', icon: Package },
  PICKED_UP: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Bike },
  DELIVERING: { bg: 'bg-sky-100', text: 'text-sky-700', icon: Bike },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: BadgeCheck },
  CANCELLED: { bg: 'bg-rose-100', text: 'text-rose-700', icon: Ban },
};

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
  // Đếm số đơn theo từng trạng thái để hiện badge trên tab (dễ quản lý, không cần bấm vào từng tab)
  const [statusCounts, setStatusCounts] = useState({});
  // Đơn đang xử lý thao tác (nhận/chuẩn bị/sẵn sàng) → disable + spinner, tránh double-click
  const [actionLoadingId, setActionLoadingId] = useState(null);

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

  // Đếm số đơn theo trạng thái (lấy toàn bộ đơn của quán, không phân trang) để hiện badge trên tab
  const fetchStatusCounts = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await apiClient.get('/merchant/orders', { params: { restaurantId, size: 1000 } });
      const all = res.data?.data?.content || [];
      const counts = { ALL: all.length };
      all.forEach((o) => { counts[o.orderStatus] = (counts[o.orderStatus] || 0) + 1; });
      setStatusCounts(counts);
    } catch (err) {
      console.error('Lỗi đếm số đơn theo trạng thái:', err);
    }
  }, [restaurantId]);

  // Refresh badge mỗi khi danh sách đơn thay đổi (sau xác nhận/từ chối/WS) để số luôn khớp thực tế
  useEffect(() => {
    fetchStatusCounts();
  }, [orders, fetchStatusCounts]);

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
    setActionLoadingId(orderId);
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
    } finally {
      setActionLoadingId(null);
    }
  };

  // xác nhận đang chuẩn bị món ăn
  const handlePreparing = async (e, orderId) => {
    e.stopPropagation();
    setActionLoadingId(orderId);
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
    } finally {
      setActionLoadingId(null);
    }
  };

  //Xác nhận đã sẵn sàng giao đơn
  const handleReady = async (e, orderId) => {
    e.stopPropagation();
    setActionLoadingId(orderId);
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
    } finally {
      setActionLoadingId(null);
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
            counts={statusCounts}
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
              {orders.map((order, idx) => (
                <div
                  key={order.id}
                  onClick={() => handleViewDetails(order.id)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`animate-rise-in bg-white rounded-xl border border-slate-100 border-l-4 ${STATUS_ACCENT[order.status] || 'border-l-slate-200'} shadow-sm p-4 md:p-5 flex flex-col gap-4 cursor-pointer group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200`}
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
                              {/* onError: ảnh link hỏng thì thay bằng ảnh mặc định (khỏi hiện icon vỡ) */}
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                              />
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
                            disabled={actionLoadingId === order.id}
                            onClick={(e) => handleOpenCancelModal(e, order.id)}
                            className="w-full sm:w-auto !py-2.5 rounded-lg text-xs"
                          >
                            Từ chối
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Check}
                            loading={actionLoadingId === order.id}
                            disabled={actionLoadingId === order.id}
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
                          loading={actionLoadingId === order.id}
                          disabled={actionLoadingId === order.id}
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
                          loading={actionLoadingId === order.id}
                          disabled={actionLoadingId === order.id}
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
        {detailModal.data && (() => {
          const d = detailModal.data;
          const status = d.orderStatus;
          const pill = STATUS_PILL[status] || STATUS_PILL.PENDING;
          const PillIcon = pill.icon;
          const orderId = d.orderId;
          const busy = actionLoadingId === orderId;
          const subtotal = d.subtotalAmount || d.totalAmount - (d.shippingFee || 0);
          return (
            <div className="space-y-4 -mt-1">
              {/* Hàng đầu: thời gian đặt + pill trạng thái nổi bật */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <CalendarClock size={14} /> Đặt lúc {formatOrderDate(d.createdAt)}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${pill.bg} ${pill.text}`}>
                  <PillIcon size={13} /> {getStatus(status)}
                </span>
              </div>

              {/* 2 thẻ thông tin: khách hàng & giao hàng (có icon, thoáng hơn) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2.5">
                  <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <User size={14} className="text-blue-500" /> Khách hàng
                  </h4>
                  <p className="flex items-center gap-2 text-sm text-slate-700"><User size={13} className="text-slate-400 shrink-0" /> {d.customerName}</p>
                  <p className="flex items-center gap-2 text-sm text-slate-700"><Phone size={13} className="text-slate-400 shrink-0" /> {maskPhone(d.customerPhone)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2.5">
                  <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <Bike size={14} className="text-emerald-500" /> Giao hàng
                  </h4>
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <BadgeCheck size={13} className="text-slate-400 shrink-0" /> {getStatus(status)}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <Bike size={13} className="text-slate-400 shrink-0" /> {d.shipperName ? `${d.shipperName} - ${d.shipperPhone}` : 'Chưa có tài xế nhận'}
                  </p>
                </div>
              </div>

              {/* Địa chỉ giao hàng — dòng riêng có icon */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-sm text-slate-600">
                <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="break-words"><span className="font-semibold text-slate-700">Địa chỉ giao:</span> {d.deliveryAddress}</span>
              </div>

              {/* Danh sách món ăn — thoáng hơn, ảnh to hơn, số lượng dạng badge */}
              <div>
                <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  <UtensilsCrossed size={14} className="text-amber-500" /> Danh sách món ăn ({(d.items || []).length})
                </h4>
                <div className="space-y-2">
                  {(d.items || []).map((item, index) => (
                    <div
                      key={index}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="animate-rise-in flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-xl p-2.5 transition-colors hover:border-slate-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getFoodImageUrl(item.foodImageUrl)}
                          alt={item.foodName}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm leading-tight truncate">{item.foodName}</p>
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
                            ×{item.quantity}
                          </span>
                          {item.note && (
                            <p className="text-[11px] text-amber-600 italic mt-1 flex items-center gap-1">
                              <StickyNote size={11} className="shrink-0" /> "{item.note}"
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="font-extrabold text-slate-900 shrink-0 text-sm text-right">
                        {formatCurrency((item.priceAtOrder) * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thanh toán + ghi chú (trái) · Tổng tiền dạng card (phải) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                    <Wallet size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Thanh toán</span>
                      <span className="text-sm font-semibold text-slate-700">{getPaymentMethodLabel(d.paymentMethod)}</span>
                    </div>
                  </div>
                  {d.note && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/60 border border-amber-100 p-3 text-amber-800">
                      <StickyNote size={16} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block">Ghi chú đơn hàng</span>
                        <span className="text-sm italic">"{d.note}"</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2 self-start">
                  <div className="flex justify-between items-center text-sm text-slate-500 font-medium">
                    <span>Tạm tính</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-500 font-medium">
                    <span>Phí giao hàng</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(d.shippingFee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-300">
                    <span className="text-sm font-extrabold text-slate-800">Tổng cộng</span>
                    <span className="text-blue-600 text-xl font-extrabold">{formatCurrency(d.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Khối điều hướng các Button (có loading/disabled theo đơn) */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={detailModal.close} className="rounded-lg text-xs !py-2 hover:border-blue-600 hover:text-blue-600">
                  Đóng
                </Button>

                {status === 'PENDING' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Check}
                    loading={busy}
                    disabled={busy}
                    onClick={(e) => handleConfirm(e, orderId)}
                    className="rounded-lg text-xs !py-2 !bg-emerald-600"
                  >
                    Nhận đơn
                  </Button>
                )}

                {status === 'CONFIRMED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={UtensilsCrossed}
                    loading={busy}
                    disabled={busy}
                    onClick={(e) => handlePreparing(e, orderId)}
                    className="rounded-lg text-xs !py-2 !bg-blue-600"
                  >
                    Chuẩn bị món
                  </Button>
                )}

                {status === 'PREPARING' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Package}
                    loading={busy}
                    disabled={busy}
                    onClick={(e) => handleReady(e, orderId)}
                    className="rounded-lg text-xs !py-2 !bg-[#34A853] hover:!bg-[#2E8B49]"
                  >
                    Sẵn sàng giao
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}