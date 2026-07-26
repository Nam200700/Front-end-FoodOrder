import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import {
  ShoppingBag, RefreshCw, Ban, AlertCircle, MessageSquare, Star, FileText, MapPin, CreditCard, Eye,
  User, Phone, Bike, Wallet, StickyNote, CalendarClock, UtensilsCrossed, Package, BadgeCheck, Clock, Check
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { getFoodImageUrl, DEFAULT_FOOD_IMAGE } from '../../utils/avatarHelper';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';
import FilterTabs from '../../components/common/FilterTabs';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card';

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

// Dải màu viền trái theo trạng thái để khách quét nhanh lịch sử đơn
const STATUS_ACCENT = {
  PENDING: 'border-l-amber-400',
  CONFIRMED: 'border-l-blue-500',
  PREPARING: 'border-l-indigo-500',
  READY_FOR_PICKUP: 'border-l-sky-500',
  DELIVERING: 'border-l-orange-500',
  COMPLETED: 'border-l-emerald-500',
  CANCELLED: 'border-l-rose-400',
};

// Icon trạng thái cho pill modal (màu nền/chữ tái dùng getStatusStyles)
const STATUS_ICON = {
  PENDING: Clock,
  CONFIRMED: Check,
  PREPARING: UtensilsCrossed,
  READY_FOR_PICKUP: Package,
  DELIVERING: Bike,
  COMPLETED: BadgeCheck,
  CANCELLED: Ban,
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const replaceCart = useCartStore((state) => state.replaceCart);
  const [activeTab, setActiveTab] = useState('ALL');

  // Các States xử lý dữ liệu và lỗi
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Các States xử lý nghiệp vụ hủy đơn hàng
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Các States xử lý Modal Chi tiết đơn hàng
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          image: getFoodImageUrl(i.foodImageUrl),
          note: i.note
        })),
        total: Number(order.totalAmount),
        subtotal: Number(order.subtotalAmount || order.totalAmount - (order.shippingFee || 0)),
        shippingFee: Number(order.shippingFee || 0),
        status: order.orderStatus,
        paymentMethod: order.paymentMethod || 'Tiền mặt',
        deliveryAddress: order.deliveryAddress || 'Chưa cập nhật địa chỉ',
        createdAt: formattedDate,
        reviewed: order.reviewed || false, 
        rating: order.restaurantRating || 5,
        note: order.note,
        name: order.customerName,
        phone: order.customerPhone
      };
    });
  };

  const fetchOrderHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'ALL' ? {} : { status: activeTab};
      const response = await apiClient.get('/orders', { params: statusParam });
      const mappedData = mapOrders(response.data?.data || response.data);
      setOrders(mappedData);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách đơn hàng:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  // hiển thị modal hủy đơn
  const handleOpenCancelModal = (e, orderId) => {
    e.stopPropagation(); 
    setSelectedOrderId(orderId);
    setCancelReasonInput('');
    setIsCancelModalOpen(true);
  };

  // Đóng modal hủy đơn
  const handleCloseCancelModal = () => {
    if (submittingCancel) return;
    setIsCancelModalOpen(false);
    setSelectedOrderId(null);
    setCancelReasonInput('');
  };

  // hiển thị modal chi tiết đơn hàng
  const handleOpenDetailModal = (e, order) => {
    e.stopPropagation();
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  // đóng modal chi tiết đơn hàng
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
  };

  // Hủy đơn hàng
  const handleCancelOrder = async () => {
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
      fetchOrderHistory(); 
    } catch (err) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.response?.data?.message);
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Mua lại
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
      case 'DELIVERING': return 'Đang giao hàng';
      default: return 'Không hợp lệ';
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
      case 'PREPARING': 
        return 'bg-indigo-50 text-indigo-700'; 
      case 'READY_FOR_PICKUP': 
        return 'bg-sky-50 text-sky-700'; 
      case 'DELIVERING':
        return 'bg-orange-50 text-orange-700'; 
      default: 
        return 'bg-slate-50 text-slate-700'; 
    }
  };

  const list = orders || [];

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 font-google-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900">Đơn Hàng Của Tôi</h1>

        {/* Thanh điều hướng Tabs Trạng thái */}
        <div className="mb-6 overflow-x-auto scrollbar-none touch-pan-x border-b border-slate-200">
          <FilterTabs
            tabs={ORDER_STATUS_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="min-w-max pb-3 gap-2.5 !flex-nowrap [&_button]:text-center [&_button]:!py-2 [&_button]:!px-4 [&_button]:text-xs [&_button]:md:text-sm [&_button]:font-bold [&_button]:!rounded-lg [&_button]:whitespace-nowrap [&_button]:!border-transparent [&_button]:cursor-pointer"
            activeClassName="!bg-orange-500 !text-white !border-orange-500 shadow-sm"
          />
        </div>

        <div className="min-h-[600px] w-full">
          {loading ? (
            <div className="space-y-4">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : error ? (
            <div className="flex justify-center items-center py-12">
              <ErrorState onRetry={fetchOrderHistory} />
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {list.map((order, idx) => (
                <Card
                  key={order.id}
                  variant="flat"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`animate-rise-in !border-slate-100 border-l-4 ${STATUS_ACCENT[order.status] || 'border-l-slate-200'} shadow-sm p-4 md:p-5 flex flex-col gap-4 group hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200 !rounded-2xl cursor-pointer`}
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

                  {/* danh sách món ăn */}
                  <div className="w-full">
                    <div 
                      className="w-full overflow-x-auto scrollbar-none touch-pan-x" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-row gap-3 sm:gap-4 w-max max-w-full pb-1">
                        {order.items.map((item, idx) => (
                          <div 
                            key={idx}
                            className="flex gap-3 items-center border border-slate-100 rounded-lg p-3 bg-slate-50/50 w-[260px] sm:w-[280px] shrink-0 select-none"
                          >
                            <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 border border-slate-200 bg-white">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                draggable="false"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                              <p className="text-xs text-orange-500 font-bold mt-1">
                                {formatCurrency(item.price)}
                                <span className="text-slate-500 font-medium text-[12px] ml-1.5">x{item.quantity}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-t border-slate-100 pt-3 mt-0.5 gap-3">
                    <div className="text-xs sm:text-sm text-slate-500 font-medium">
                      Tổng thanh toán:{' '}
                      <span className="text-sm sm:text-base font-extrabold text-orange-500 ml-1">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'PENDING' ? (
                        <Button
                          type="button"
                          onClick={(e) => handleOpenCancelModal(e, order.id)}
                          icon={Ban}
                          className="!px-2.5 !py-1.5 !bg-red-500 hover:!bg-red-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm w-full sm:w-auto"
                        >
                          Hủy đơn
                        </Button>
                      ) : (
                        <>
                          {order.status === 'COMPLETED' && (
                            <>
                              <Button
                                type="button"
                                onClick={(e) => handleReorder(e, order)}
                                icon={RefreshCw}
                                className="!px-2.5 !py-1.5 !bg-orange-500 hover:!bg-orange-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm whitespace-nowrap flex-1 sm:flex-none sm:w-auto"
                              >
                                Mua lại
                              </Button>
                               
                              {order.reviewed ? (
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); 
                                    navigate(`/reviews/${order.id}`);
                                  }}
                                  icon={Star}
                                  className="!px-2.5 !py-1.5 !bg-slate-100 !text-slate-500 !border-none !rounded-lg text-[11px] !font-bold !shadow-none whitespace-nowrap flex-1 sm:flex-none sm:w-auto cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                  Đã đánh giá ({order.rating}★)
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); 
                                    navigate(`/reviews/${order.id}`);
                                  }}
                                  icon={MessageSquare}
                                  className="!px-2.5 !py-1.5 !bg-indigo-600 hover:!bg-indigo-700 !text-white !border-none !rounded-lg text-[11px] !font-bold !shadow-none whitespace-nowrap flex-1 sm:flex-none sm:w-auto"
                                >
                                  Đánh giá
                                </Button>
                              )}
                            </>
                          )}                        
                        </>
                      )}

                      {order.status === 'CANCELLED' && (
                        <Button
                          type="button"
                          onClick={(e) => handleReorder(e, order)}
                          icon={RefreshCw}
                          className="!px-2.5 !py-1.5 !bg-orange-500 hover:!bg-orange-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm whitespace-nowrap w-full sm:w-auto"
                        >
                          Mua lại
                        </Button>                          
                      )}

                      <Button
                        type="button"
                        onClick={(e) => handleOpenDetailModal(e, order)}
                        icon={Eye}
                        className="!px-2.5 !py-1.5 !bg-blue-500 hover:!bg-blue-600 !text-white !border-none !rounded-lg text-[11px] !font-bold !shadow-none whitespace-nowrap w-full sm:w-auto"
                      >
                        Chi tiết
                      </Button>                            
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHI TIẾT ĐƠN HÀNG — phong cách customer (tông cam) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        title={`Chi Tiết Đơn Hàng #${selectedOrder?.id}`}
        size="lg"
      >
        {selectedOrder && (() => {
          const o = selectedOrder;
          const StatusIcon = STATUS_ICON[o.status] || Clock;
          const payLabel = o.paymentMethod === 'VNPAY' ? 'Chuyển khoản VNPAY' : 'Thanh toán khi nhận hàng (COD)';
          return (
            <div className="space-y-4 text-slate-700 -mt-1">
              {/* Hàng đầu: thời gian đặt + pill trạng thái */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <CalendarClock size={14} /> Đặt lúc {o.createdAt}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${getStatusStyles(o.status)}`}>
                  <StatusIcon size={13} /> {getStatusLabel(o.status)}
                </span>
              </div>

              {/* Thông tin giao hàng — card tông cam, có icon */}
              <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 space-y-2.5">
                <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-orange-600 uppercase tracking-wider">
                  <MapPin size={14} /> Thông tin giao hàng
                </h4>
                <p className="flex items-center gap-2 text-sm text-slate-700"><User size={13} className="text-slate-400 shrink-0" /> {o.name}</p>
                <p className="flex items-center gap-2 text-sm text-slate-700"><Phone size={13} className="text-slate-400 shrink-0" /> {o.phone}</p>
                <p className="flex items-start gap-2 text-sm text-slate-700"><MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" /> <span className="break-words">{o.deliveryAddress}</span></p>
                {o.note && (
                  <p className="flex items-start gap-2 text-sm text-amber-700"><StickyNote size={13} className="shrink-0 mt-0.5" /> <span className="italic">"{o.note}"</span></p>
                )}
              </div>

              {/* Danh sách món ăn — ảnh to hơn, số lượng dạng badge, hiện lần lượt */}
              <div>
                <h4 className="flex items-center gap-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  <UtensilsCrossed size={14} className="text-orange-500" /> Danh sách món ăn ({o.items.length})
                </h4>
                <div className="space-y-2">
                  {o.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{ animationDelay: `${idx * 45}ms` }}
                      className="animate-rise-in flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-xl p-2.5 transition-colors hover:border-orange-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm leading-tight truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-orange-500 font-bold text-xs">{formatCurrency(item.price)}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">×{item.quantity}</span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-slate-400 italic mt-1 flex items-center gap-1">
                              <StickyNote size={11} className="shrink-0" /> "{item.note}"
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="font-extrabold text-slate-900 shrink-0 text-sm">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thanh toán (trái) · Tổng tiền dạng card cam (phải) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-3 self-start">
                  <Wallet size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Thanh toán</span>
                    <span className="text-sm font-semibold text-slate-700">{payLabel}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-orange-50/50 border border-orange-100 p-4 space-y-2 self-start">
                  <div className="flex justify-between items-center text-sm text-slate-500 font-medium">
                    <span>Tạm tính</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(o.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-500 font-medium">
                    <span>Phí vận chuyển</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(o.shippingFee)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-orange-200">
                    <span className="text-sm font-extrabold text-slate-800">Tổng thanh toán</span>
                    <span className="text-orange-500 text-xl font-extrabold">{formatCurrency(o.total)}</span>
                  </div>
                </div>
              </div>

              {/* Hành động: Mua lại (đơn xong/huỷ) + Đóng */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseDetailModal}
                  className="rounded-lg text-xs !py-2 hover:!border-orange-500 hover:!text-orange-600"
                >
                  Đóng
                </Button>
                {(o.status === 'COMPLETED' || o.status === 'CANCELLED') && (
                  <Button
                    size="sm"
                    icon={RefreshCw}
                    onClick={(e) => handleReorder(e, o)}
                    className="rounded-lg text-xs !py-2 !bg-orange-500 hover:!bg-orange-600 !text-white"
                  >
                    Mua lại
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL HỦY ĐƠN HÀNG */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={handleCloseCancelModal}
        title={`Xác Nhận Hủy Đơn Hàng #${selectedOrderId}`}
        size="sm"
        className="[&_h2]:!text-slate-900 [&_h2]:!text-base [&_h2]:md:!text-lg [&_h2]:!font-bold [&_button]:disabled:opacity-50"
      >
        <div className="space-y-4 text-slate-700 !-mt-3">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={15} />
            <span>Lưu ý: Hành động hủy đơn hàng không thể hoàn tác sau khi hệ thống đã xử lý.</span>
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

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">            
            <Button 
              type="button" 
              onClick={handleCancelOrder}
              disabled={submittingCancel || !cancelReasonInput.trim()}
              className="!px-5 !py-2 !text-xs !font-bold !bg-orange-500 !text-white !rounded-lg hover:!bg-orange-600 disabled:!bg-slate-300 !shadow-sm"
            >
              {submittingCancel ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}