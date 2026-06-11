import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ShoppingBag, Check, X, Truck, Ban, Eye, MapPin, Phone, CreditCard, Clock, FileText } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { getStatusConfig } from '../../utils/orderStatusHelper';
import FilterTabs from '../../components/common/FilterTabs';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import { toast } from 'react-toastify';
import OrderCancelModal from '../../components/common/OrderCancelModal';
import Badge from '../../components/common/Badge';
import { useModalState } from '../../hooks/useModalState';


export default function MerchantOrders() {
  const [activeTab, setActiveTab] = useState('pending'); // pending, preparing, delivering, finished
  const [orders, setOrders] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  // STATE CHI TIẾT ĐƠN HÀNG MODAL
  const detailModal = useModalState();
  const [loadingDetail, setLoadingDetail] = useState(false);

  // STATE HỦY ĐƠN HÀNG MODAL
  const cancelModal = useModalState();


  const { subscribe } = useWebSocketContext();

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
        console.warn('OWNER chưa tạo nhà hàng hoặc lỗi:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      let statusParam = '';
      if (activeTab === 'pending') statusParam = 'PENDING';
      else if (activeTab === 'preparing') statusParam = 'PREPARING'; 
      else if (activeTab === 'delivering') statusParam = 'DELIVERING'; 
      else if (activeTab === 'finished') statusParam = 'COMPLETED'; 

      const response = await apiClient.get(`/merchant/orders?restaurantId=${restaurantId}&status=${statusParam}`);
      const realData = response.data?.data?.content || [];
      const mapped = realData.map(ord => ({
        id: ord.orderId.toString(),
        customer: ord.customerName || 'Khách hàng',
        items: (ord.items || []).map(i => ({ name: i.foodName, qty: i.quantity, note: i.note })),
        total: Number(ord.totalAmount),
        time: new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: ord.customerPhone || '0901234567',
        status: ord.orderStatus,
        shipper: ord.shipperName ? `${ord.shipperName} (${ord.shipperPhone || ''})` : null
      }));
      setOrders(mapped);
    } catch (err) {
      console.error('Lỗi lấy đơn hàng:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleConfirm = async (orderId) => {
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/confirm`);
      toast.success(`Đã nhận và xác nhận đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close(); // Đóng modal nếu đang mở
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xác nhận đơn hàng này.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCancelModal = (orderId) => {
    cancelModal.open(orderId);
  };

  const handleCancelSubmit = async (reason) => {
    try {
      setLoading(true);
      const orderIdToCancel = cancelModal.data;
      await apiClient.patch(`/merchant/orders/${orderIdToCancel}/cancel`, {
        reason
      });
      toast.success(`Đã hủy/từ chối đơn hàng #${orderIdToCancel} thành công`);
      cancelModal.close();
      if (detailModal.data && detailModal.data.orderId.toString() === orderIdToCancel.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể hủy/từ chối đơn hàng này.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreparing = async (orderId) => {
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/preparing`);
      toast.success(`Đã bắt đầu chế biến đơn hàng #${orderId}`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật trạng thái làm món.');
    } finally {
      setLoading(false);
    }
  };

  const handleReady = async (orderId) => {
    try {
      setLoading(true);
      await apiClient.patch(`/merchant/orders/${orderId}/ready`);
      toast.success(`Đã báo sẵn sàng giao cho đơn hàng #${orderId}!`);
      if (detailModal.data && detailModal.data.orderId.toString() === orderId.toString()) {
        detailModal.close();
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Không thể báo sẵn sàng.');
    } finally {
      setLoading(false);
    }
  };

  // GỌI API BACKEND XEM CHI TIẾT ĐƠN HÀNG THẬT SỰ CỦA MERCHANT
  const handleViewDetails = async (orderId) => {
    try {
      setLoadingDetail(true);
      const response = await apiClient.get(`/merchant/orders/${orderId}`);
      const realOrder = response.data?.data;
      if (realOrder) {
        detailModal.open(realOrder);
      }
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết đơn hàng của chủ quán:', err);
      toast.error(err.response?.data?.message || 'Không thể xem chi tiết đơn hàng này. Vui lòng thử lại!');
    } finally {
      setLoadingDetail(false);
    }
  };




  if (!restaurantId && !loading) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để quản lý đơn hàng.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full font-google-sans pb-24 relative">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800 mb-6">Quản lý Đơn Hàng</h1>

      <FilterTabs
        tabs={[
          { id: 'pending', label: 'Chờ xác nhận' },
          { id: 'preparing', label: 'Đang chuẩn bị' },
          { id: 'delivering', label: 'Đang giao' },
          { id: 'finished', label: 'Lịch sử đơn' }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {loading && !loadingDetail ? (
        <div className="space-y-4">
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Không có đơn hàng nào"
          description="Hiện tại không có đơn hàng nào thuộc danh mục này."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => {
            return (
              <div 
                key={order.id}
                className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300 animate-slide-up"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-slate-800">
                        Đơn #{order.id} • {order.customer}
                      </span>
                      {order.status && (
                        <Badge status={order.status} className="text-[9px] px-2.5 py-0.5 rounded-full" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1.5 font-bold">
                      Thời gian: {order.time} {order.phone ? `• SĐT: ${order.phone}` : ''}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-slate-850">
                    {formatCurrency(order.total)}
                  </span>
                </div>

                {/* Items detail list */}
                <div className="bg-slate-50/50 rounded-radius-lg p-3.5 my-4 border border-slate-100 text-xs font-bold text-slate-700 space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span>{item.qty}x {item.name}</span>
                      {item.note && (
                        <span className="text-[10px] text-md-primary bg-md-primary-container/20 px-2 py-0.5 rounded italic">
                          Ghi chú: "{item.note}"
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions block based on tab */}
                <div className="flex items-center justify-between border-t border-slate-50 pt-3.5 mt-1 flex-wrap gap-3">
                  <button
                    onClick={() => handleViewDetails(order.id)}
                    className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-md-primary/10 hover:text-md-primary text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102"
                  >
                    <Eye size={13} />
                    Chi tiết 📋
                  </button>

                  <div className="flex gap-2 items-center">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          disabled={loading}
                          onClick={() => handleOpenCancelModal(order.id)}
                          className="px-4 py-2 rounded-radius-full border border-md-error/30 text-md-error text-xs font-bold hover:bg-md-error/5 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                        >
                          Từ chối
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => handleConfirm(order.id)}
                          className="px-4.5 py-2 rounded-radius-full bg-md-secondary text-white font-extrabold text-xs shadow-sm hover:scale-102 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                        >
                          <Check size={12} className="stroke-[3.5px]" />
                          Nhận đơn
                        </button>
                      </>
                    )}

                    {activeTab === 'preparing' && (
                      <>
                        {order.status === 'CONFIRMED' ? (
                          <div className="flex gap-2">
                            <button
                              disabled={loading}
                              onClick={() => handleOpenCancelModal(order.id)}
                              className="px-4 py-2 rounded-radius-full border border-md-error/30 text-md-error text-xs font-bold hover:bg-md-error/5 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                            >
                              Hủy đơn
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => handlePreparing(order.id)}
                              className="px-4 py-2 bg-md-primary hover:bg-opacity-95 text-white font-extrabold text-xs rounded-radius-full shadow-sm hover:scale-102 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                            >
                              Bắt đầu làm món
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={loading}
                            onClick={() => handleReady(order.id)}
                            className="px-4.5 py-2 bg-[#4CAF50] hover:bg-[#45a049] text-white font-extrabold text-xs rounded-radius-full shadow-sm flex items-center gap-1 hover:scale-102 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                          >
                            🚀 Báo sẵn sàng giao
                          </button>
                        )}
                      </>
                    )}

                    {activeTab === 'delivering' && (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1 ${
                        order.status === 'READY_FOR_PICKUP' 
                          ? 'text-amber-600 bg-amber-50' 
                          : 'text-blue-600 bg-blue-50'
                      }`}>
                        <Truck size={12} />
                        {order.status === 'READY_FOR_PICKUP' ? 'Chờ shipper lấy' : 'Shipper đã lấy hàng'}
                      </span>
                    )}

                    {activeTab === 'finished' && (
                      <span className="text-[10px] text-slate-400 font-extrabold">
                        Đơn hàng đã hoàn tất
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MERCHANT DETAILED ORDER MODAL */}
      {detailModal.isOpen && detailModal.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-google-sans animate-fade-in">
          <div className="bg-white rounded-radius-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-shadow-4 relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0">
              <div>
                <span className="text-[10px] text-md-secondary bg-md-secondary-container/20 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  MÃ ĐƠN #{detailModal.data.orderId}
                </span>
                <h3 className="font-extrabold text-base text-slate-800 mt-2">
                  Chi tiết đơn đặt món
                </h3>
              </div>
              <button 
                onClick={() => detailModal.close()}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5.5 text-xs font-semibold text-slate-700">
              
              {/* Khách hàng */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                  👤 Khách Hàng
                </span>
                <div className="bg-slate-50 p-3.5 rounded-radius-lg border border-slate-100 space-y-1.5 font-bold">
                  <div className="text-slate-800 text-sm font-extrabold">{detailModal.data.customerName || 'Khách hàng'}</div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Phone size={13} />
                    <a href={`tel:${detailModal.data.customerPhone || ''}`} className="hover:underline text-md-primary font-bold">
                      {detailModal.data.customerPhone || 'Không cung cấp'}
                    </a>
                  </div>
                </div>
              </div>

              {/* Địa chỉ giao */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                  📍 Địa Chỉ Giao Hàng Thật
                </span>
                <div className="bg-slate-50 p-3.5 rounded-radius-lg border border-slate-100 flex gap-2 font-medium leading-relaxed">
                  <MapPin size={16} className="text-md-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-800 font-bold">{detailModal.data.deliveryAddress}</p>
                    {detailModal.data.deliveryLat && (
                      <span className="text-[9px] text-md-outline block mt-1.5 font-bold">
                        Toạ độ thật: {Number(detailModal.data.deliveryLat).toFixed(5)}, {Number(detailModal.data.deliveryLng).toFixed(5)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Danh sách món ăn */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                  🍜 Danh Sách Món Ăn
                </span>
                <div className="border border-slate-150 rounded-radius-lg overflow-hidden bg-white shadow-sm">
                  {detailModal.data.items && detailModal.data.items.map((item, idx) => (
                    <div key={idx} className="p-3 border-b border-slate-100 last:border-b-0 flex justify-between items-start">
                      <div>
                        <div className="text-slate-800 font-bold">
                           <span className="text-md-secondary font-extrabold">{item.quantity}x</span> {item.foodName}
                        </div>
                        {item.note && (
                          <div className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded italic mt-1.5 font-extrabold border border-red-100/30 flex items-center gap-1 max-w-max">
                            ⚠️ Ghi chú món: "{item.note}"
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-slate-655">
                        {formatCurrency(Number(item.priceAtOrder) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghi chú đơn hàng */}
              {detailModal.data.note && (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                    📝 Lời nhắn của khách
                  </span>
                  <div className="bg-amber-50/50 p-3.5 rounded-radius-lg border border-amber-100 text-amber-800 italic leading-relaxed">
                    "{detailModal.data.note}"
                  </div>
                </div>
              )}

              {/* Phương thức thanh toán */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                  💳 Thanh Toán
                </span>
                <div className="bg-slate-50 p-3.5 rounded-radius-lg border border-slate-100 flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <CreditCard size={15} className="text-md-secondary" />
                    <span>{detailModal.data.paymentMethod}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold border px-2.5 py-0.5 rounded-full ${
                    detailModal.data.paymentStatus === 'PAID' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                  }`}>
                    {detailModal.data.paymentStatus === 'PAID' ? 'Đã Thanh Toán' : 'Chờ Thanh Toán'}
                  </span>
                </div>
              </div>

              {/* Tổng hóa đơn */}
              <div className="border-t border-slate-200/60 pt-4.5 space-y-2 text-slate-650 font-bold">
                <div className="flex justify-between">
                  <span>Tiền món:</span>
                  <span className="text-slate-800">{formatCurrency(Number(detailModal.data.subtotalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phí ship thật:</span>
                  <span className="text-slate-800">{formatCurrency(Number(detailModal.data.shippingFee))}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-100 text-slate-800">
                  <span>Tổng tiền đơn:</span>
                  <span className="text-md-secondary text-base">{formatCurrency(Number(detailModal.data.totalAmount))}</span>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
              <Button variant="outline" onClick={() => detailModal.close()} size="md">
                Đóng
              </Button>
              {detailModal.data.orderStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleOpenCancelModal(detailModal.data.orderId)}
                    className="px-4 py-2 bg-white rounded border border-md-error text-md-error text-xs font-bold hover:bg-md-error/5 cursor-pointer"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleConfirm(detailModal.data.orderId)}
                    className="px-4 py-2 bg-md-secondary text-white text-xs font-extrabold rounded shadow-sm hover:scale-102 flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={12} className="stroke-[3.5px]" />
                    Nhận đơn
                  </button>
                </>
              )}

              {detailModal.data.orderStatus === 'CONFIRMED' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenCancelModal(detailModal.data.orderId)}
                    className="px-4 py-2 bg-white rounded border border-md-error text-md-error text-xs font-bold hover:bg-md-error/5 cursor-pointer"
                  >
                    Hủy đơn
                  </button>
                  <button
                    onClick={() => handlePreparing(detailModal.data.orderId)}
                    className="px-4 py-2 bg-md-primary hover:bg-opacity-95 text-white font-extrabold text-xs rounded shadow-sm hover:scale-102 cursor-pointer"
                  >
                    Bắt đầu làm món
                  </button>
                </div>
              )}

              {detailModal.data.orderStatus === 'PREPARING' && (
                <button
                  onClick={() => handleReady(detailModal.data.orderId)}
                  className="px-4 py-2 bg-[#4CAF50] hover:bg-[#45a049] text-white font-extrabold text-xs rounded shadow-sm flex items-center gap-1 hover:scale-102 cursor-pointer"
                >
                  🚀 Báo sẵn sàng giao
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Loading detail mask */}
      {loadingDetail && <Spinner fullScreen />}

      {/* ─── MODAL HỦY / TỪ CHỐI ĐƠN HÀNG ────────────────────────────────────── */}
      <OrderCancelModal
        isOpen={cancelModal.isOpen}
        onClose={() => {
          cancelModal.close();
        }}
        onConfirm={handleCancelSubmit}
        orderId={cancelModal.data}
        reasons={[
          'Hết nguyên liệu chuẩn bị món',
          'Quán đang bận quá tải',
          'Khách hàng gọi điện yêu cầu hủy',
          'Quán tạm thời đóng cửa nghỉ sớm',
          'Không liên hệ được với khách hàng'
        ]}
        loading={loading}
      />


    </div>
  );
}
