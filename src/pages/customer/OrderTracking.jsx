import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { useChatStore } from '../../stores/chatStore';
import { ArrowLeft, Phone, MessageSquare, ChevronDown, ChevronUp, CheckCircle, Clock, Ban, AlertCircle, Map, AlertTriangle, Store, Bike } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import { useAuthStore } from '../../stores/authStore';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';
import { STATUS_META, parseOrderEvent, notifyStatusChange } from '../../utils/orderStatusHelper';
import { mapOrder } from '../../utils/mappers';
import { useModalState } from '../../hooks/useModalState';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Thiết lập default icon cho Leaflet để tránh mất ảnh marker
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const { subscribe } = useWebSocketContext();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [orderCollapsed, setOrderCollapsed] = useState(true);
  
  const reportModal = useModalState();
  const cancelModal = useModalState();
  
  const [reportReason, setReportReason] = useState('');
  const [reportTarget, setReportTarget] = useState('RESTAURANT'); // RESTAURANT | SHIPPER
  const [submittingReport, setSubmittingReport] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // TOẠ ĐỘ QUÁN ĂN NẠP TỪ BACKEND
  const [restaurantCoords, setRestaurantCoords] = useState({ lat: null, lng: null });

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ restaurant: null, customer: null });

  // 1. Tải thông tin đơn hàng chi tiết từ Backend và đồng bộ thời gian thực
  useEffect(() => {
    const fetchOrderDetails = async (showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        setErrorMsg('');
        const response = await apiClient.get(`/orders/${id}`);
        const realData = response.data?.data;
        if (realData) {
          const mapped = mapOrder(realData);
          if (mapped) {
            mapped.timestamps = {
              PENDING: mapped.createdAtTime,
              CONFIRMED: mapped.confirmedAt,
              PREPARING: mapped.preparingAt,
              READY_FOR_PICKUP: mapped.readyAt,
              PICKED_UP: mapped.pickedUpAt,
              DELIVERING: mapped.pickedUpAt,
              COMPLETED: mapped.completedAt,
            };
          }
          setOrder(mapped);
        } else {
          setErrorMsg('Đơn hàng không tồn tại hoặc bạn không có quyền truy cập đơn hàng này.');
        }
      } catch (error) {
        console.error('Lỗi khi tải chi tiết đơn hàng từ Backend:', error);
        setErrorMsg('Không thể tải thông tin đơn hàng từ Backend. Vui lòng kiểm tra lại!');
      } finally {
        if (showSpinner) setLoading(false);
      }
    };

    fetchOrderDetails(true);

    const destination = `/topic/order/${id}`;
    console.log('[WebSocket Subscribe]: Subscribing to ' + destination);
    const sub = subscribe(destination, (updatedOrder) => {
      console.log('[WebSocket Order Update]: Received updated order', updatedOrder);
      const parsed = parseOrderEvent(updatedOrder);
      if (parsed && parsed.status) {
        // Tự động tải lại thông tin đơn hàng mới nhất từ API (gồm cả thông tin shipper mới được gán)
        // mà không hiện spinner để tránh giật lag giao diện của người dùng
        fetchOrderDetails(false);
      }
    });

    return () => {
      if (sub) {
        console.log('[WebSocket Unsubscribe]: Unsubscribing from ' + destination);
        sub.unsubscribe();
      }
    };
  }, [id]);

  // 2. Tải thông tin toạ độ Quán ăn từ Backend
  useEffect(() => {
    if (!order?.restaurantId) return;
    const fetchRestaurantCoords = async () => {
      try {
        const response = await apiClient.get(`/restaurants/${order.restaurantId}`);
        const realRes = response.data?.data;
        if (realRes && realRes.latitude && realRes.longitude) {
          setRestaurantCoords({
            lat: Number(realRes.latitude),
            lng: Number(realRes.longitude)
          });
        }
      } catch (err) {
        console.warn('Lỗi lấy toạ độ quán ăn:', err);
      }
    };
    fetchRestaurantCoords();
  }, [order?.restaurantId]);

  // 3. Khởi tạo bản đồ Leaflet(chỉ hiển thị Quán ăn và Khách hàng)
  useEffect(() => {
    if (!order || !restaurantCoords.lat || !order.deliveryLat || !mapContainerRef.current) return;

    const rLat = restaurantCoords.lat;
    const rLng = restaurantCoords.lng;
    const cLat = order.deliveryLat;
    const cLng = order.deliveryLng;

    // Tạo bản đồ
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false // Tránh vô tình zoom khi cuộn trang
      }).setView([(rLat + cLat) / 2, (rLng + cLng) / 2], 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const resIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.restaurant = L.marker([rLat, rLng], { icon: resIcon }).addTo(map)
        .bindPopup(`<b>${order.restaurantName}</b><br/>Nơi chế biến món ăn.`);

      const custIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.customer = L.marker([cLat, cLng], { icon: custIcon }).addTo(map)
        .bindPopup(`<b>Địa chỉ của bạn</b><br/>${order.address}`);

      map.fitBounds([[rLat, rLng], [cLat, cLng]], { padding: [40, 40] });
    }
  }, [restaurantCoords, order?.deliveryLat]);

  // 4. Cleanup bản đồ khi huỷ component
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = { restaurant: null, customer: null };
      }
    };
  }, []);

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      toast.warn('Vui lòng nhập lý do báo cáo vi phạm!');
      return;
    }
    if (reportReason.trim().length < 10) {
      toast.warn('Nội dung báo cáo phải chi tiết tối thiểu 10 ký tự!');
      return;
    }
    
    setSubmittingReport(true);
    try {
      // Backend CreateReportRequest yêu cầu targetType (enum) + targetId + reason.
      // Báo cáo quán -> RESTAURANT + id quán; báo cáo tài xế -> SHIPPER + userId tài xế.
      let targetType, targetId;
      if (reportTarget === 'RESTAURANT') {
        targetType = 'RESTAURANT';
        targetId = order.restaurantId;
      } else {
        targetType = 'SHIPPER';
        targetId = order.shipper?.id;
      }

      if (!targetId) {
        toast.error('Không tìm thấy thông tin đối tượng cần báo cáo!');
        setSubmittingReport(false);
        return;
      }

      await apiClient.post('/reports', {
        targetType,
        targetId,
        reason: reportReason.trim()
      });
      toast.success('Báo cáo vi phạm đơn hàng đã được gửi thành công. Cảm ơn phản hồi của bạn!');
      reportModal.close();
      setReportReason('');
    } catch (err) {
      console.error('Lỗi gửi báo cáo vi phạm đơn hàng:', err);
      toast.error('Không thể gửi báo cáo vi phạm. Vui lòng thử lại sau!');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen />;
  }

  if (errorMsg || !order) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Ban size={28} />
        </div>
        <h2 className="text-xl font-bold text-md-on-surface">Không tìm thấy đơn hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">{errorMsg || 'Đơn hàng không tồn tại hoặc đã bị xóa.'}</p>
        <Button onClick={() => navigate('/history')} size="md" className="mt-6">
          Xem lịch sử đơn hàng
        </Button>
      </div>
    );
  }

  const displayOrder = order;

  const steps = [
    { key: 'PENDING', label: STATUS_META.PENDING?.label || 'Đặt hàng thành công' },
    { key: 'CONFIRMED', label: STATUS_META.CONFIRMED?.label || 'Quán đã xác nhận' },
    { key: 'PREPARING', label: STATUS_META.PREPARING?.label || 'Đang chuẩn bị món' },
    { key: 'READY_FOR_PICKUP', label: STATUS_META.READY_FOR_PICKUP?.label || 'Chờ shipper lấy hàng' },
    { key: 'DELIVERING', label: STATUS_META.DELIVERING?.label || 'Đang giao tới bạn' },
    { key: 'COMPLETED', label: STATUS_META.COMPLETED?.label || 'Giao hàng thành công' },
  ];

  const getStepIndex = (status) => {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'CONFIRMED':
        return 1;
      case 'PREPARING':
        return 2;
      case 'READY_FOR_PICKUP':
        return 3;
      case 'PICKED_UP':
      case 'DELIVERING':
        return 4;
      case 'COMPLETED':
        return 5;
      default:
        return -1;
    }
  };

  const activeIndex = getStepIndex(displayOrder.status);
  const isCancelled = displayOrder.status === 'CANCELLED';

  const handleChatWithShipper = async () => {
    if (!displayOrder.shipper || !displayOrder.shipper.id) return;
    const convId = await startNewConversation(
      displayOrder.shipper.id,
      displayOrder.shipper.name,
      displayOrder.shipper.avatar,
      'SHIPPER'
    );
    if (convId) {
      navigate(`/chat/${convId}?orderId=${displayOrder.id}&status=${displayOrder.status}`);
    }
  };

  const submitCancel = async () => {
    if (!cancelReasonInput.trim()) {
      toast.error('Vui lòng nhập lý do hủy!');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/orders/${id}/cancel`, {
        reason: cancelReasonInput.trim()
      });
      
      const response = await apiClient.get(`/orders/${id}`);
      if (response.data?.data) {
        const mapped = mapOrder(response.data.data);
        if (mapped) {
          mapped.timestamps = {
            PENDING: mapped.createdAtTime,
            CONFIRMED: mapped.confirmedAt,
            PREPARING: mapped.preparingAt,
            READY_FOR_PICKUP: mapped.readyAt,
            PICKED_UP: mapped.pickedUpAt,
            DELIVERING: mapped.pickedUpAt,
            COMPLETED: mapped.completedAt,
          };
        }
        setOrder(mapped);
      }
      toast.success('Đã hủy đơn hàng thành công!');
      cancelModal.close();
      setCancelReasonInput('');
    } catch (err) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng vào lúc này!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 px-4 md:px-8 pt-4 md:pt-6 w-full font-google-sans pb-24 space-y-6">      
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => navigate('/')}
          className="p-2.5 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors cursor-pointer"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-md-on-surface leading-none tracking-tight">
            Theo Dõi Đơn Hàng #{displayOrder.id}
          </h1>
        </div>
      </div>

      {/* 2 cột: trạng thái + bản đồ | tài xế + hóa đơn*/}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
        {/* ── CỘT TRÁI: trạng thái + bản đồ ── */}
        <div className="space-y-6 w-full">

      {/* Stepper Status Box */}
      <Card variant="elevated" className="p-6.5 md:p-8 shadow-shadow-2">
        {isCancelled ? (
          <div className="flex items-center gap-4 text-md-error bg-md-error-container/20 p-5 rounded-radius-lg border border-md-error/15 animate-fade-in">
            <Ban size={28} />
            <div>
              <h3 className="font-extrabold text-base">Đơn hàng đã bị hủy</h3>
              <p className="text-sm text-md-on-surface-variant mt-1">Tiếc quá, đơn hàng của bạn đã bị hủy.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <h3 className="text-xs font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-3">
              Trạng thái đơn hàng
            </h3>

            {/* Vertical Stepper */}
            <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.75 before:bg-slate-100">
              {steps.map((step, idx) => {
                const isCompleted = idx < activeIndex || (displayOrder.status === 'COMPLETED' && idx === activeIndex);
                const isActive = idx === activeIndex && displayOrder.status !== 'COMPLETED';
                const timestamp = displayOrder.timestamps?.[step.key];

                let pointStyle = 'bg-slate-200 text-slate-400';

                if (isCompleted) {
                  pointStyle = 'bg-md-tertiary text-white';
                } else if (isActive) {
                  pointStyle = 'bg-md-primary text-white scale-110 shadow-shadow-3 relative z-10';
                }

                return (
                  <div key={step.key} className="flex items-start gap-5 relative animate-fade-in">
                    {idx > 0 && (
                      <div 
                        className={`absolute -left-[21.5px] -top-8 w-0.75 h-8 transition-colors duration-300 ${
                          idx <= activeIndex ? 'bg-md-tertiary' : 'bg-slate-100'
                        }`}
                      />
                    )}

                    {/* Step Circle Pin */}
                    <div className={`absolute -left-[28.5px] w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${pointStyle} ${
                      isActive ? 'animate-ripple' : ''
                    }`}>
                      {isCompleted && '✓'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm sm:text-base font-bold transition-colors leading-none ${
                          isActive 
                            ? 'text-md-primary font-extrabold' 
                            : isCompleted 
                              ? 'text-md-on-surface' 
                              : 'text-md-outline'
                        }`}>
                          {step.label}
                        </span>
                        {timestamp && (
                          <span className="text-xs text-md-outline font-extrabold">
                            {timestamp}
                          </span>
                        )}
                      </div>
                      {/* {isActive && step.key !== 'COMPLETED' && (
                        <span className="text-[10px] md:text-xs text-md-primary font-bold inline-flex items-center gap-1.5 mt-2 bg-md-primary-container/20 px-2.5 py-1 rounded animate-pulse">
                          Đang xử lý...
                        </span>
                      )} */}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stepper Success CTA */}
            {displayOrder.status === 'COMPLETED' && (
              <Button 
                variant="secondary"
                onClick={() => navigate(`/reviews/${displayOrder.id}`)}
                size="lg"
                className="w-full text-sm uppercase tracking-wider bg-md-tertiary hover:bg-opacity-95 cursor-pointer shadow-sm"
              >
                Đánh giá đơn hàng ngay
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* BẢN ĐỒ DẪN ĐƯỜNG THỰC TẾ */}
      {!isCancelled && restaurantCoords.lat && displayOrder.deliveryLat && (
        <Card variant="flat" className="p-0 overflow-hidden bg-white border border-slate-200 shadow-sm rounded-radius-xl">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center bg-slate-50/50">
            <div className="flex items-center gap-2 text-md-primary">
              <Map size={18} className="stroke-[2.5px]" />
              <span className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                Bản đồ theo dõi thực tế
              </span>
            </div>
          </div>
          <div className="relative">
            <div ref={mapContainerRef} className="w-full h-[280px] z-10" />
          </div>
        </Card>
      )}
        </div>
        {/* ── CỘT PHẢI: tài xế + hóa đơn ── */}
        <div className="space-y-6 w-full">

      {/* Shipper Info Box */}
      {displayOrder.shipper && (
        <Card variant="flat" className="p-6.5 flex gap-5 items-center bg-white border border-md-outline-variant/20 shadow-sm animate-slide-up">
          <img 
            src={displayOrder.shipper.avatar} 
            alt="Shipper" 
            className="w-16 h-16 rounded-radius-full object-cover border-2 border-md-outline-variant shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] md:text-xs text-[#2E7D32] bg-[#E8F5E9] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Tài Xế Đang Giao
            </span>
            <h3 className="font-extrabold text-base md:text-lg text-md-on-surface mt-2.5 leading-none">
              {displayOrder.shipper.name}
            </h3>
            <p className="text-xs md:text-sm text-md-on-surface-variant mt-2 font-medium">
              {displayOrder.shipper.bike} • <span className="font-extrabold text-md-on-surface">{displayOrder.shipper.plate}</span>
            </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleChatWithShipper}
              className="p-3.5 rounded-radius-full bg-slate-100 hover:bg-md-primary/10 hover:text-md-primary text-md-on-surface-variant transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Nhắn tin cho tài xế"
            >
              <MessageSquare size={18} />
            </button>
            <a 
              href={`tel:${displayOrder.shipper.phone}`}
              className="p-3.5 rounded-radius-full bg-slate-100 hover:bg-md-secondary/10 hover:text-md-secondary text-md-on-surface-variant transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
              title="Gọi điện cho tài xế"
            >
              <Phone size={18} />
            </a>
          </div>
        </Card>
      )}

      {/* Collapsible Order Bill Detail */}
      <Card variant="flat" className="overflow-hidden bg-white border border-md-outline-variant/20 shadow-sm">
        <button
          onClick={() => setOrderCollapsed(!orderCollapsed)}
          className="w-full flex items-center justify-between p-5 font-extrabold text-xs md:text-sm uppercase tracking-wider text-md-on-surface hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span>Chi tiết hóa đơn đơn hàng</span>
          {orderCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        {!orderCollapsed && (
          <div className="p-6 border-t border-slate-100 space-y-5 animate-fade-in">
            {/* Foods */}
            <div className="space-y-4">
              {displayOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm font-semibold">
                  <div className="min-w-0 pr-4">
                    <span className="font-bold text-md-on-surface-variant">{item.name}</span>
                    <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                      {formatCurrency(item.price)} x{item.quantity}
                    </span>
                    {item.note && (
                      <span className="block text-xs text-md-outline italic mt-1 font-medium">
                        Ghi chú: "{item.note}"
                      </span>
                    )}
                  </div>
                  <span className="font-extrabold text-md-on-surface">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Address */}
            <div className="pt-4 border-t border-slate-100">
              <span className="text-[10px] md:text-xs font-extrabold text-md-outline uppercase tracking-wider">
                Địa chỉ nhận hàng
              </span>
              <p className="text-sm text-md-on-surface-variant mt-1.5 font-medium leading-relaxed">
                {displayOrder.address}
              </p>
            </div>

            {/* Payment Summary */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-sm font-medium">
              <div className="flex justify-between text-md-on-surface-variant">
                <span>Tạm tính:</span>
                <span className="font-bold">{formatCurrency(displayOrder.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-md-on-surface-variant">
                <span>Phí giao hàng:</span>
                <span className="font-bold">{formatCurrency(displayOrder.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-md-on-surface-variant">
                <span>Phương thức:</span>
                <span className="font-bold">{displayOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold pt-3.5 border-t border-slate-100 flex-wrap">
                <span>Tổng thanh toán:</span>
                <span className="text-md-primary">{formatCurrency(displayOrder.total)}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
        </div>
      </div>

      {/* Cancel Order Action Button */}
      {(displayOrder.status === 'PENDING' || displayOrder.status === 'CONFIRMED') && (
        <Button
          variant="danger"
          onClick={() => cancelModal.open()}
          icon={Ban}
          size="lg"
          className="w-full text-sm uppercase tracking-wider cursor-pointer shadow-md bg-[#EA4335] text-white hover:bg-red-600"
        >
          Hủy đơn hàng này
        </Button>
      )}

      {/* Report Order Action Button */}
      <button
        type="button"
        onClick={() => reportModal.open()}
        className="w-full border border-red-250 hover:border-red-300 bg-red-50/30 hover:bg-red-50 text-red-500 font-bold flex items-center justify-center gap-2 py-3.5 rounded-radius-lg text-sm transition-all active:scale-[0.98] cursor-pointer shadow-sm"
      >
        <AlertTriangle size={16} />
        Báo cáo vi phạm đơn hàng
      </button>

      {/* ─── MODAL BÁO CÁO VI PHẠM ĐƠN HÀNG ────────────────────────────────────── */}
      <Modal
        isOpen={reportModal.isOpen}
        onClose={() => reportModal.close()}
        title="Báo Cáo Vi Phạm Đơn Hàng"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-3 bg-red-50 text-red-700 rounded-radius-md text-xs font-bold border border-red-100 flex items-start gap-2">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span>
              Báo cáo vi phạm đối với đơn hàng này sẽ được gửi trực tiếp tới Quản trị viên hệ thống để kiểm tra và xử lý.
            </span>
          </div>

          {/* Chọn đối tượng báo cáo */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Đối tượng cần báo cáo:
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setReportTarget('RESTAURANT');
                  setReportReason('');
                }}
                className={`flex-1 py-3 px-4 rounded-radius-lg border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  reportTarget === 'RESTAURANT'
                    ? 'border-md-primary bg-md-primary/10 text-md-primary'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Store size={15} /> Báo cáo Quán ăn
              </button>
              
              <button
                type="button"
                disabled={!displayOrder.shipper}
                onClick={() => {
                  setReportTarget('SHIPPER');
                  setReportReason('');
                }}
                className={`flex-1 py-3 px-4 rounded-radius-lg border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !displayOrder.shipper
                    ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                    : reportTarget === 'SHIPPER'
                      ? 'border-md-primary bg-md-primary/10 text-md-primary'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
                title={!displayOrder.shipper ? 'Chưa có tài xế nhận đơn để báo cáo' : 'Báo cáo shipper'}
              >
                <Bike size={15} /> Báo cáo Shipper
              </button>
            </div>
          </div>

          {/* Lý do mẫu */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Chọn lý do vi phạm nhanh:
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {(reportTarget === 'RESTAURANT'
                ? [
                    'Quán chuẩn bị thiếu món ăn so với hóa đơn',
                    'Món ăn không hợp vệ sinh / có dị vật',
                    'Quán chuẩn bị quá lâu / thái độ phục vụ kém',
                  ]
                : [
                    'Shipper giao thiếu hàng / làm đổ vỡ món ăn',
                    'Shipper thái độ cọc cằn, xúc phạm khách hàng',
                    'Shipper đi xe lạng lách đánh võng / không an toàn',
                  ]
              ).map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className="text-left px-3.5 py-2.5 rounded-radius-md border border-slate-200 hover:border-md-primary/40 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Nhập tự do */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Mô tả chi tiết nội dung vi phạm:
            </label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Vui lòng cung cấp thêm thông tin chi tiết (tối thiểu 10 ký tự)..."
              rows={4}
              className="w-full p-3.5 border border-slate-200 rounded-radius-md focus:outline-none focus:border-md-primary focus:ring-4 focus:ring-md-primary/10 text-sm font-semibold text-slate-850"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => reportModal.close()} disabled={submittingReport}>
              Đóng
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason.trim()}
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* ─── MODAL HỦY ĐƠN HÀNG ────────────────────────────────────── */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => {
          cancelModal.close();
          setCancelReasonInput('');
        }}
        title="Xác Nhận Hủy Đơn Hàng"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-3 bg-red-50 text-red-700 rounded-radius-md text-xs font-bold border border-red-100 flex items-start gap-2">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span>
              Lưu ý: Bạn chỉ được tự hủy đơn hàng khi đơn ở trạng thái Mới đặt hoặc Đã xác nhận (quán chưa làm món).
            </span>
          </div>

          {/* Lý do mẫu */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Chọn lý do hủy nhanh:
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                'Đổi ý không đặt nữa',
                'Đặt nhầm món / nhầm số lượng',
                'Thời gian giao hàng quá lâu',
                'Muốn thay đổi địa chỉ giao hàng',
                'Tìm thấy quán khác giá rẻ hơn'
              ].map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCancelReasonInput(reason)}
                  className="text-left px-3.5 py-2.5 rounded-radius-md border border-slate-200 hover:border-md-primary/40 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Nhập tự do */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Nhập lý do hủy chi tiết:
            </label>
            <textarea
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Vui lòng cung cấp lý do hủy chi tiết (tối đa 300 ký tự)..."
              rows={3}
              maxLength={300}
              className="w-full p-3.5 border border-slate-200 rounded-radius-md focus:outline-none focus:border-md-primary focus:ring-4 focus:ring-md-primary/10 text-sm font-semibold text-slate-850"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                cancelModal.close();
                setCancelReasonInput('');
              }}
            >
              Đóng
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={submitCancel}
              disabled={!cancelReasonInput.trim()}
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
