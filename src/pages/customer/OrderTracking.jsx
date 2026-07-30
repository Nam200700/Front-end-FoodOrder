import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { useChatStore } from '../../stores/chatStore';
import { ArrowLeft, Phone, MessageSquare, ChevronDown, ChevronUp, CheckCircle, Clock, Ban, AlertCircle, Map, AlertTriangle, Store, Bike, MapPin, ChefHat, Package, PartyPopper, ReceiptText, Check, Navigation, Star, Utensils, Wallet, Truck, Banknote, Tag } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import { useAuthStore } from '../../stores/authStore';
import { addVietnamBaseMap } from '../../utils/mapSovereignty';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';
import { STATUS_META, parseOrderEvent, notifyStatusChange } from '../../utils/orderStatusHelper';
import { mapOrder } from '../../utils/mappers';
import { DEFAULT_AVATAR } from '../../utils/avatarHelper';
import { useModalState } from '../../hooks/useModalState';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Giao diện theo TỪNG GIAI ĐOẠN đơn hàng (banner sống động): icon động, lời nhắn, gradient màu
const STAGE_UI = {
  PENDING:          { icon: ReceiptText, title: 'Đã đặt hàng thành công', desc: 'Đang chờ quán xác nhận đơn của bạn...', grad: 'from-amber-400 to-orange-500' },
  CONFIRMED:        { icon: Store,       title: 'Quán đã xác nhận đơn',    desc: 'Quán chuẩn bị bắt tay vào làm món cho bạn.', grad: 'from-orange-400 to-orange-600' },
  PREPARING:        { icon: ChefHat,     title: 'Đang chuẩn bị món',       desc: 'Đầu bếp đang trổ tài — món ngon sắp xong!', grad: 'from-orange-500 to-rose-500' },
  READY_FOR_PICKUP: { icon: Package,     title: 'Món đã sẵn sàng',         desc: 'Đang chờ tài xế tới lấy hàng của bạn.', grad: 'from-amber-500 to-orange-600' },
  DELIVERING:       { icon: Bike,        title: 'Tài xế đang giao tới bạn', desc: 'Món đang trên đường — sắp tới nơi rồi!', grad: 'from-orange-500 to-red-500' },
  COMPLETED:        { icon: PartyPopper, title: 'Giao hàng thành công!',   desc: 'Chúc bạn ngon miệng. Đừng quên đánh giá nhé!', grad: 'from-emerald-500 to-green-600' },
  CANCELLED:        { icon: Ban,         title: 'Đơn hàng đã bị hủy',      desc: 'Đơn hàng của bạn đã được hủy.', grad: 'from-slate-500 to-slate-700' },
};
const getStageUI = (status) => (status === 'PICKED_UP' ? STAGE_UI.DELIVERING : (STAGE_UI[status] || STAGE_UI.PENDING));

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

  // TỌA ĐỘ ĐƯỜNG ĐI (POLYLINE)
  const [routePoints, setRoutePoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ restaurant: null, customer: null });
  const polylineRef = useRef(null); // Ref để chứa đường đi

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
        console.error('Lỗi khi tải chi tiết đơn hàng:', error);
        setErrorMsg('Không thể tải thông tin đơn hàng. Vui lòng kiểm tra lại!');
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
            lng: Number(realRes.longitude),
            address: realRes.address
          });
        }
      } catch (err) {
        console.warn('Lỗi lấy toạ độ quán ăn:', err);
      }
    };
    fetchRestaurantCoords();
  }, [order?.restaurantId]);

  // 3. TẢI ĐƯỜNG ĐI (ROUTE)
  useEffect(() => {
    if (restaurantCoords.lat && order?.deliveryLat) {
      const fetchRoute = async () => {
        try {
          const response = await apiClient.get("/shipping/route", {
            params: {
              // Tọa độ quán
              startLat: restaurantCoords.lat,
              startLng: restaurantCoords.lng,

              // Tọa độ khách
              endLat: order.deliveryLat,
              endLng: order.deliveryLng,
            },
          });

          const route = response.data?.data;

          if (route) {
            setRoutePoints(route.coordinates || []);
            setDistanceKm(route.distanceKm || 0);
            setDurationMinutes(route.durationMinutes || 0);
          }
        } catch (error) {
          console.error("Lỗi tải đường đi:", error);
        }
      };

      fetchRoute();
    }
  }, [restaurantCoords.lat, restaurantCoords.lng, order?.deliveryLat, order?.deliveryLng,]);

  // 4. Khởi tạo bản đồ Leaflet & vẽ Route
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
        scrollWheelZoom: false 
      }).setView([(rLat + cLat) / 2, (rLng + cLng) / 2], 14);
      mapRef.current = map;
      // Nền bản đồ chuẩn chủ quyền VN (Goong nếu có key, không thì CARTO + nhãn đỏ)
      addVietnamBaseMap(map);

      // Icon Quán Ăn
      const resIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.restaurant = L.marker([rLat, rLng], { icon: resIcon }).addTo(map)
        .bindPopup(`<b>Quán ${order.restaurantName}</b><br/>${restaurantCoords.address}`);
      // Icon Khách hàng
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
    // NẾU CÓ DỮ LIỆU ĐƯỜNG ĐI THÌ VẼ ĐƯỜNG POLYLINE LÊN BẢN ĐỒ
    if (mapRef.current && routePoints.length > 0) {
      if (polylineRef.current) {
        mapRef.current.removeLayer(polylineRef.current);
      }
      // Vẽ polyline màu cam gradient
      polylineRef.current = L.polyline(routePoints, {
        color: '#ff6b35',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapRef.current);
      // Tự động zoom bản đồ sao cho bao trọn cả đường đi
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [restaurantCoords, order?.deliveryLat, routePoints]);

  // 5. Cleanup bản đồ khi huỷ component
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = { restaurant: null, customer: null };
        polylineRef.current = null;
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
    { key: 'PENDING', label: STATUS_META.PENDING?.label || 'Đặt hàng thành công', icon: ReceiptText },
    { key: 'CONFIRMED', label: STATUS_META.CONFIRMED?.label || 'Quán đã xác nhận', icon: Store },
    { key: 'PREPARING', label: STATUS_META.PREPARING?.label || 'Đang chuẩn bị món', icon: ChefHat },
    { key: 'READY_FOR_PICKUP', label: STATUS_META.READY_FOR_PICKUP?.label || 'Chờ shipper lấy hàng', icon: Package },
    { key: 'DELIVERING', label: STATUS_META.DELIVERING?.label || 'Đang giao tới bạn', icon: Bike },
    { key: 'COMPLETED', label: STATUS_META.COMPLETED?.label || 'Giao hàng thành công', icon: PartyPopper },
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
          onClick={() => navigate('/orders')}
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

      {/* ─── BANNER TRẠNG THÁI SỐNG ĐỘNG (theo giai đoạn hiện tại) ─── */}
      {(() => {
        const stage = getStageUI(displayOrder.status);
        const StageIcon = stage.icon;
        const pct = isCancelled ? 0 : displayOrder.status === 'COMPLETED' ? 100 : Math.round(((activeIndex + 1) / steps.length) * 100);
        const isDelivering = displayOrder.status === 'DELIVERING' || displayOrder.status === 'PICKED_UP';
        const isDone = displayOrder.status === 'COMPLETED';
        const RiderIcon = isDone ? PartyPopper : StageIcon;
        const etaChip = displayOrder.status === 'COMPLETED' && displayOrder.timestamps?.COMPLETED
          ? `Đã giao lúc ${displayOrder.timestamps.COMPLETED}`
          : isDelivering && durationMinutes > 0
            ? `Dự kiến ~${Math.ceil(durationMinutes)} phút nữa`
            : `Bước ${Math.min(activeIndex + 1, steps.length)}/${steps.length}`;
        return (
          <div className={`relative overflow-hidden rounded-3xl p-6 md:p-7 text-white shadow-md bg-gradient-to-br ${stage.grad}`}>
            <div className="pointer-events-none absolute -top-12 -right-8 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 left-8 w-48 h-48 rounded-full bg-black/5 blur-2xl" />
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 animate-float">
                <StageIcon size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/80 flex-wrap">
                  <span>Đơn #{displayOrder.id}</span>
                  <span className="inline-flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
                    {displayOrder.status === 'COMPLETED' ? <CheckCircle size={11} /> : <Clock size={11} />} {etaChip}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black leading-tight mt-1.5">{stage.title}</h2>
                <p className="text-xs md:text-sm text-white/90 font-semibold mt-1 leading-relaxed">{stage.desc}</p>
                {!isCancelled && (
                  <div className="mt-4 md:mt-5">
                    <div className="flex justify-between items-center text-[10px] font-extrabold text-white/90 mb-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Navigation size={11} className="animate-wiggle" /> Tiến độ đơn hàng
                      </span>
                      <span className="tabular-nums text-xs font-black">{pct}%</span>
                    </div>

                    {/* Đường ray tiến độ: nền tối, fill trắng có vệt sáng chảy, cột mốc, và ICON chặng chạy dọc theo */}
                    <div className="relative h-2.5 rounded-full bg-black/20 shadow-inner">
                      {/* Fill + vệt sáng chảy (shimmer) */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.65)] overflow-hidden transition-all duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      >
                        <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-flow" />
                      </div>

                      {/* Cột mốc từng chặng — sáng lên khi tiến độ vượt qua */}
                      <div className="absolute inset-0 flex items-center justify-between px-1">
                        {steps.map((_, i) => {
                          const reached = pct >= Math.round((i / (steps.length - 1)) * 100) - 1;
                          return (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                                reached ? 'bg-orange-500 scale-110 shadow-[0_0_6px_rgba(255,107,53,0.9)]' : 'bg-white/45'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* ICON chặng "chạy" theo mép tiến độ, nhấp nhô như đang di chuyển */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out"
                        style={{ left: `${pct}%` }}
                      >
                        <span className="absolute inset-0 -m-1 rounded-full bg-white/40 animate-ping" />
                        <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white text-orange-600 shadow-lg ring-2 ring-white/70 animate-bob">
                          <RiderIcon size={14} strokeWidth={2.6} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                const StepIcon = step.icon;

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

                    {/* Step Circle Pin — icon riêng theo từng chặng */}
                    <div className={`absolute -left-[28.5px] w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${pointStyle} ${
                      isActive ? 'animate-ripple' : ''
                    }`}>
                      {isCompleted ? <Check size={13} strokeWidth={3} /> : <StepIcon size={12} strokeWidth={2.4} />}
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
                      {isActive && (
                        <span className="text-[10px] md:text-xs text-md-primary font-extrabold inline-flex items-center gap-1.5 mt-2 bg-md-primary-container/25 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-md-primary animate-ping inline-block" />
                          Đang diễn ra
                        </span>
                      )}
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
                icon={Star}
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
        <Card
          variant="flat"
          className="p-0 overflow-hidden bg-white border border-slate-200 shadow-sm rounded-radius-xl"
        >
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-md-primary">
                <Map size={18} className="stroke-[2.5px]" />
                <span className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                  Bản đồ theo dõi
                </span>
              </div>

              {distanceKm > 0 && (
                <div className="flex items-center gap-3">
                  {/* Khoảng cách */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
                    <MapPin size={15} className="stroke-[2.5px]" />
                    <span className="text-sm font-semibold">
                      {distanceKm.toFixed(1)} km
                    </span>
                  </div>

                  {/* Thời gian */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700">
                    <Clock size={15} className="stroke-[2.5px]" />
                    <span className="text-sm font-semibold">
                      {Math.ceil(durationMinutes)} phút
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
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
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
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
              {/* <div className="flex justify-between text-md-on-surface-variant">
                <span>khoảng cách và thời gian dự kiến:</span>
                <span className="font-bold">{distanceKm.toFixed(1)} km - {Math.ceil(durationMinutes)} phút</span>
              </div> */}
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
        title={`Báo Cáo Vi Phạm Đơn Hàng #${displayOrder.id}`}
        size="sm"
        className="[&_h2]:!text-slate-900 [&_h2]:!text-base [&_h2]:md:!text-lg [&_h2]:!font-bold [&_button]:disabled:opacity-50"
      >
        <div className="space-y-4 text-slate-700 !-mt-3">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={15} />
            <span>Báo cáo vi phạm sẽ được gửi tới Quản trị viên hệ thống để kiểm tra và xử lý.</span>
          </div>

          {/* Chọn đối tượng báo cáo */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Đối tượng cần báo cáo:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setReportTarget('RESTAURANT'); setReportReason(''); }}
                className={`flex-1 py-2 border rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  reportTarget === 'RESTAURANT'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Store size={14} /> Quán {displayOrder.restaurantName}
              </button>
              <button
                type="button"
                disabled={!displayOrder.shipper}
                onClick={() => { setReportTarget('SHIPPER'); setReportReason(''); }}
                className={`flex-1 py-2 border rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  !displayOrder.shipper ? 'opacity-50 cursor-not-allowed border-slate-200' : 
                  reportTarget === 'SHIPPER' ? 'border-orange-500 bg-orange-50/50 text-orange-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bike size={14} /> Shipper
              </button>
            </div>
          </div>

          {/* Lý do mẫu */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chọn lý do nhanh:</span>
            <div className="grid grid-cols-1 gap-1.5">
              {(reportTarget === 'RESTAURANT'
                ? ['Quán chuẩn bị thiếu món', 'Món ăn không hợp vệ sinh', 'Thái độ phục vụ kém']
                : ['Shipper giao thiếu hàng', 'Shipper thái độ cọc cằn', 'Lái xe không an toàn']
              ).map((reason, idx) => (
                <button
                  key={idx} type="button" onClick={() => setReportReason(reason)}
                  className={`text-left px-3.5 py-2 border rounded-lg text-xs font-semibold transition-all ${
                    reportReason === reason ? 'border-orange-500 bg-orange-50/50 text-orange-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Nhập tự do */}
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hoặc nhập lý do cụ thể:</span>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Nhập nội dung chi tiết..."
            rows={3}
            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-slate-50/50 text-slate-800 resize-none"
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button 
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason.trim()}
              className="!px-5 !py-2 !text-xs !font-bold !bg-orange-500 !text-white !rounded-lg hover:!bg-orange-600 disabled:!bg-slate-300"
            >
              {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* ─── MODAL HỦY ĐƠN HÀNG ────────────────────────────────────── */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => { cancelModal.close(); setCancelReasonInput(''); }}
        title={`Xác Nhận Hủy Đơn Hàng #${displayOrder.id}`}
        size="sm"
        className="[&_h2]:!text-slate-900 [&_h2]:!text-base [&_h2]:md:!text-lg [&_h2]:!font-bold [&_button]:disabled:opacity-50"
      >
        <div className="space-y-4 text-slate-700 !-mt-3">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={15} />
            <span>Lưu ý: Chỉ được hủy khi đơn ở trạng thái Mới đặt hoặc Chưa chuẩn bị món.</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chọn lý do hủy nhanh:</span>
            <div className="grid grid-cols-1 gap-1.5">
              {['Đổi ý không đặt nữa', 'Đặt nhầm món / nhầm số lượng', 'Thời gian giao quá lâu', 'Muốn đổi địa chỉ'].map((reason, idx) => (
                <button 
                  key={idx} type="button" onClick={() => setCancelReasonInput(reason)}
                  className={`text-left px-3.5 py-2 border rounded-lg text-xs font-semibold transition-all ${
                    cancelReasonInput === reason ? 'border-orange-500 bg-orange-50/50 text-orange-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hoặc nhập lý do cụ thể:</span>
          <textarea 
            value={cancelReasonInput} 
            onChange={(e) => setCancelReasonInput(e.target.value)} 
            placeholder="Nhập lý do hủy đơn hàng..." 
            rows={3}
            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-slate-50/50 text-slate-800 resize-none" 
            maxLength={300} 
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button 
              onClick={submitCancel}
              disabled={!cancelReasonInput.trim()}
              className="!px-5 !py-2 !text-xs !font-bold !bg-orange-500 !text-white !rounded-lg hover:!bg-orange-600 disabled:!bg-slate-300"
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
