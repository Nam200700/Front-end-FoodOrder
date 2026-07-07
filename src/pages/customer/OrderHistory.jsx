import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { ShoppingBag, RefreshCw, Ban, AlertCircle, MessageSquare, Star, FileText, MapPin, CreditCard, Eye } from 'lucide-react'; 
import { formatCurrency } from '../../utils/format';
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
          image: i.foodImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
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

  // Đóng modal và reset trạng thái dữ liệu
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
              {list.map((order) => (
                <Card 
                  key={order.id}
                  variant="flat" 
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="!border-slate-100 shadow-sm p-4 md:p-5 flex flex-col gap-4 group transition-colors hover:border-slate-200 !rounded-2xl cursor-pointer"
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
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" draggable="false" />
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

                    {/* Đã giảm size button bằng cách đổi grid-cols-3 thành flex, giảm padding và text size xuống text-[11px] */}
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

      {/* MODAL CHI TIẾT ĐƠN HÀNG */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        title={
          <div className="flex flex-col text-left">
            <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
              Chi Tiết Đơn Hàng #{selectedOrder?.id}
            </h2>
            {selectedOrder && (
              <p className="text-[10px] md:text-xs font-normal text-slate-400 pt-0.5">
                Ngày đặt: <span className="font-medium text-slate-500">{selectedOrder.createdAt}</span>
              </p>
            )}
          </div>
        }
        size="md"
        className="[&_h2]:!text-slate-900 [&_h2]:!text-base [&_h2]:md:!text-lg [&_h2]:!font-bold [&>div]:border-slate-100 [&_div.flex.items-center.justify-between]:!pb-3"
      >
        {selectedOrder && (
          <div className="space-y-4 text-slate-700 !-mt-4 !-mb-5">
            <div className="text-xs flex flex-row justify-between items-center gap-3 pt-2">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin giao hàng</p>
                
                <div className="text-slate-700 text-[11px] sm:text-xs pt-0.5 space-y-0.5">
                  <p className="font-bold text-slate-800">
                    {selectedOrder.name} — {selectedOrder.phone}
                  </p>
                  
                  {/* Địa chỉ */}
                  <p className="text-slate-500 leading-tight">
                    <span className="font-bold text-slate-700">Địa chỉ:</span> {selectedOrder.deliveryAddress}
                  </p>
                  
                  {/* Ghi chú đơn hàng - Đã sửa đồng bộ kiểu chữ và màu text-slate-500 với Địa chỉ */}
                  {selectedOrder.note && (
                    <p className="text-slate-500 leading-tight">
                      <span className="font-bold text-slate-700">Ghi chú đơn hàng:</span>
                      <span className="italic"> "{selectedOrder.note}"</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Danh sách món ăn */}
            <div className="space-y-1.5 !-mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh sách món ăn:</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2.5 items-center justify-between border border-slate-100/80 rounded-lg p-1.5 sm:p-2 bg-slate-50/30">
                    <div className="flex gap-2.5 items-center min-w-0 flex-1">
                      <div className="w-12 h-12 rounded md overflow-hidden shrink-0 border border-slate-200 bg-white">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate leading-tight">{item.name}</h4>
                        <p className="text-[11px] text-orange-500 font-bold mt-0.5">
                          {formatCurrency(item.price)}
                          <span className="text-slate-400 font-normal ml-1.5 text-[10px]">x{item.quantity}</span>
                        </p>
                        {item.note && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            <span className="font-medium mr-0.5 text-slate-400">Ghi chú:</span>
                            <span className="italic">"{item.note}"</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 shrink-0 pl-2">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chi tiết dòng tiền tính toán */}
            <div className="border-t border-slate-100 pt-2 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Phương thức thanh toán:</span>
                <span className="font-semibold text-slate-600">
                  {selectedOrder.paymentMethod === 'COD' && 'Tiền mặt'}
                  {selectedOrder.paymentMethod === 'VNPAY' && 'Chuyển khoản'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Tạm tính:</span>
                <span className="font-semibold text-slate-600">{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(selectedOrder.shippingFee)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-slate-200 font-medium">
                <span className="text-slate-700 font-bold">Tổng thanh toán:</span>
                <span className="text-base font-extrabold text-orange-500">
                  {formatCurrency(selectedOrder.total)}
                </span>
              </div>
            </div>
          </div>
        )}
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