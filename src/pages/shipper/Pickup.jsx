import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, MapPin, Navigation, Bike, DollarSign, Check, Phone, MessageSquare, Eye, X, Utensils, Home, AlertTriangle, FileText, Route, PowerOff } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { useChatStore } from '../../stores/chatStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import { toast } from 'react-toastify';
import { mapOrder } from '../../utils/mappers';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { useModalState } from '../../hooks/useModalState';
import { useCartStore } from '../../stores/cartStore';


delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function ShipperPickup() {
  const navigate = useNavigate();
  const { subscribe } = useWebSocketContext();
  const [online, setOnline] = useState(true);
  const [activeJob, setActiveJob] = useState(null); // Đơn hàng đang nhận giao
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

  const startNewConversation = useChatStore((state) => state.startNewConversation);

  // TOẠ ĐỘ QUÁN ĂN
  const [restaurantCoords, setRestaurantCoords] = useState({ lat: null, lng: null });
  // TOẠ ĐỘ TÀI XẾ MÔ PHỎNG DI CHUYỂN
  const [shipperCoords, setShipperCoords] = useState({ lat: null, lng: null });

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ restaurant: null, customer: null, shipper: null });
  const polylineRef = useRef(null);

  const orderModal = useModalState(null);

  const { fetchShippingForRestaurant, restaurantShippingCache, fetchDistanceToCustomer, orderDistanceCache } = useCartStore();

  // toạ độ tuyến đường thật quán -> khách
  const [routeCoords, setRouteCoords] = useState([]);

  const handleChatWithCustomer = async () => {
    if (!activeJob || !activeJob.customerId) {
      toast.error('Không tìm thấy thông tin định danh của khách hàng để nhắn tin.');
      return;
    }
    try {
      setLoading(true);
      const convId = await startNewConversation(
        activeJob.customerId,
        activeJob.customer || 'Khách hàng',
        null
      );
      if (convId) {
        navigate(`/shipper/chat/${convId}?orderId=${activeJob.id}&status=${activeJob.status}`);
      }
    } catch (err) {
      console.error('Lỗi khi mở cuộc trò chuyện với khách hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Lấy thông tin đơn hàng đang nhận giao 
  const fetchActiveJob = useCallback(async () => {
    try {
      const response = await apiClient.get('/shipper/orders');
      const myOrders = response.data?.data?.content || [];
      
      // Tìm đơn hàng đang thực hiện (chưa COMPLETED hoặc CANCELLED)
      const currentActive = myOrders.find(ord => 
        ord.orderStatus !== 'COMPLETED' && ord.orderStatus !== 'CANCELLED'
      );

      if (currentActive) {
        const mappedOrder = mapOrder(currentActive);
        setActiveJob({
          id: mappedOrder.id,
          restaurantId: mappedOrder.restaurantId,
          restaurant: mappedOrder.restaurantName,
          customer: mappedOrder.customerName,
          customerId: mappedOrder.customerId,
          resAddress: mappedOrder.restaurantAddress,
          custAddress: mappedOrder.address,
          deliveryLat: mappedOrder.deliveryLat,
          deliveryLng: mappedOrder.deliveryLng,
          distance: 'Bản đồ',
          fee: mappedOrder.shippingFee,
          total: mappedOrder.total,
          phone: mappedOrder.customerPhone || '0901234567',
          status: mappedOrder.status,
          step: (mappedOrder.status === 'PICKED_UP' || mappedOrder.status === 'DELIVERING') ? 'PICKED_UP' : 'ACCEPTED'
        });
      } else {
        setActiveJob(null);
      }
    } catch (err) {
      console.warn('Lỗi lấy thông tin công việc hiện tại của shipper:', err);
    }
  }, []);

  // 2. Lấy danh sách các đơn hàng khả dụng có thể nhận giao
  const fetchAvailableOrders = useCallback(async () => {
    if (!online) return;
    try {
      setLoading(true);
      const response = await apiClient.get('/shipper/orders/available');
      const rawOrders = response.data?.data || [];
      const mapped = rawOrders.map(ord => {
        const mappedOrder = mapOrder(ord);
        return {
          id: mappedOrder.id,
          restaurantId: mappedOrder.restaurantId,
          restaurant: mappedOrder.restaurantName,
          customer: mappedOrder.customerName,
          customerPhone: mappedOrder.customerPhone,
          resAddress: mappedOrder.restaurantAddress,
          custAddress: mappedOrder.address,
          deliveryLat: mappedOrder.deliveryLat,
          deliveryLng: mappedOrder.deliveryLng,
          distance: 'Thành phố',
          fee: mappedOrder.shippingFee,
          total: mappedOrder.total,
          itemsCount: mappedOrder.itemsCount,
          items: ord.items || [],
          note: mappedOrder.note,
          paymentMethod: mappedOrder.paymentMethod,
          subtotalAmount: mappedOrder.subtotalAmount,
        };
      });
      setAvailableOrders(mapped);

      // Tính khoảng cách quán -> khách hàng cho từng đơn 
      mapped.forEach(order => {
        if (order.restaurantId && order.deliveryLat && order.deliveryLng) {
          fetchDistanceToCustomer(order.id, order.restaurantId, order.deliveryLat, order.deliveryLng);
        }
      });
    } catch (err) {
      console.error('Lỗi khi tải đơn hàng khả dụng:', err);
    } finally {
      setLoading(false);
    }
  }, [online, fetchDistanceToCustomer]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchActiveJob();
      await fetchAvailableOrders();
      setLoading(false);
    };
    init();
  }, [online, fetchActiveJob, fetchAvailableOrders]);

  useEffect(() => {
    if (!online) return;

    // Subscribe topic đơn hàng khả dụng cho shipper toàn sàn
    const availableDest = '/topic/available-orders';
    const subAvailable = subscribe(availableDest, () => {
      fetchAvailableOrders();
    });

    // Subscribe topic notification cá nhân để biết đơn được gán hoặc hủy
    const notifyDest = '/user/queue/notify';
    const subNotify = subscribe(notifyDest, () => {
      fetchActiveJob();
      fetchAvailableOrders();
    });

    return () => {
      if (subAvailable) subAvailable.unsubscribe();
      if (subNotify) subNotify.unsubscribe();
    };
  }, [online, subscribe, fetchActiveJob, fetchAvailableOrders]);

  // Đảm bảo có sẵn khoảng cách của đơn đang giao (phòng trường hợp fetchActiveJob chạy trước khi list available có cache)
  useEffect(() => {
    if (!activeJob?.id || !activeJob.restaurantId || !activeJob.deliveryLat || !activeJob.deliveryLng) return;
    if (orderDistanceCache[activeJob.id]) return;
    fetchDistanceToCustomer(activeJob.id, activeJob.restaurantId, activeJob.deliveryLat, activeJob.deliveryLng);
  }, [activeJob?.id, activeJob?.restaurantId, activeJob?.deliveryLat, activeJob?.deliveryLng, orderDistanceCache, fetchDistanceToCustomer]);

  // Nạp toạ độ Quán ăn khi có đơn activeJob
  useEffect(() => {
    if (!activeJob?.restaurantId) return;
    const fetchRestaurantCoords = async () => {
      try {
        const response = await apiClient.get(`/restaurants/${activeJob.restaurantId}`);
        const realRes = response.data?.data;
        if (realRes && realRes.latitude && realRes.longitude) {
          setRestaurantCoords({
            lat: Number(realRes.latitude),
            lng: Number(realRes.longitude)
          });
        }
      } catch (err) {
        console.warn('Lỗi lấy toạ độ quán ăn của shipper:', err);
      }
    };
    fetchRestaurantCoords();
  }, [activeJob?.restaurantId]);

  // Mô phỏng vị trí tài xế di chuyển tịnh tiến thực tế
  /*
  useEffect(() => {
    if (!activeJob || !restaurantCoords.lat || !activeJob.deliveryLat) return;

    const rLat = restaurantCoords.lat;
    const rLng = restaurantCoords.lng;
    const cLat = activeJob.deliveryLat;
    const cLng = activeJob.deliveryLng;

    let intervalId;

    if (activeJob.step === 'ACCEPTED') {
      const startLat = rLat + 0.009;
      const startLng = rLng - 0.009;
      setShipperCoords({ lat: startLat, lng: startLng });

      let step = 0;
      intervalId = setInterval(() => {
        step += 1;
        if (step > 100) {
          clearInterval(intervalId);
          setShipperCoords({ lat: rLat, lng: rLng });
          return;
        }
        const pct = step / 100;
        setShipperCoords({
          lat: startLat + (rLat - startLat) * pct,
          lng: startLng + (rLng - startLng) * pct
        });
      }, 1000);
    } else {
      setShipperCoords({ lat: rLat, lng: rLng });

      let step = 0;
      intervalId = setInterval(() => {
        step += 1;
        if (step > 150) {
          clearInterval(intervalId);
          setShipperCoords({ lat: cLat, lng: cLng });
          return;
        }
        const pct = step / 150;
        setShipperCoords({
          lat: rLat + (cLat - rLat) * pct,
          lng: rLng + (cLng - rLng) * pct
        });
      }, 800);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeJob?.step, restaurantCoords, activeJob?.deliveryLat]);*/

  // Lấy tuyến đường thật quán -> khách khi mở màn hình "Đang giao"
  useEffect(() => {
    if (!activeJob || !restaurantCoords.lat || !activeJob.deliveryLat) return;

    const fetchRoute = async () => {
      try {
        const res = await apiClient.get('/shipping/route', {
          params: {
            startLat: restaurantCoords.lat,
            startLng: restaurantCoords.lng,
            endLat: activeJob.deliveryLat,
            endLng: activeJob.deliveryLng
          }
        });

        const routeData = res.data?.data;
        const rawCoords = routeData?.coordinates || routeData?.points || [];
        const normalized = rawCoords.map(pt =>
          Array.isArray(pt) ? [pt[0], pt[1]] : [pt.lat ?? pt.latitude, pt.lng ?? pt.longitude]
        );

        setRouteCoords(
          normalized.length > 0
            ? normalized
            : [[restaurantCoords.lat, restaurantCoords.lng], [activeJob.deliveryLat, activeJob.deliveryLng]]
        );
      } catch (err) {
        console.warn('Lỗi lấy tuyến đường quán -> khách:', err);
        setRouteCoords([[restaurantCoords.lat, restaurantCoords.lng], [activeJob.deliveryLat, activeJob.deliveryLng]]);
      }
    };

    fetchRoute();
  }, [activeJob?.id, activeJob?.step, restaurantCoords.lat, activeJob?.deliveryLat]);

  // Vẽ / cập nhật đường polyline tuyến đường thật lên bản đồ Leaflet
  useEffect(() => {
    if (!mapRef.current || routeCoords.length === 0) return;

    if (polylineRef.current) {
      mapRef.current.removeLayer(polylineRef.current);
    }

    polylineRef.current = L.polyline(routeCoords, {
      color: '#00B14F',
      weight: 4,
      opacity: 0.85
    }).addTo(mapRef.current);

    mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
  }, [routeCoords]);

  // Vẽ bản đồ Leaflet thật cho Shipper
  useEffect(() => {
    if (!activeJob || !restaurantCoords.lat || !activeJob.deliveryLat || !mapContainerRef.current) return;

    const rLat = restaurantCoords.lat;
    const rLng = restaurantCoords.lng;
    const cLat = activeJob.deliveryLat;
    const cLng = activeJob.deliveryLng;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([(rLat + cLat) / 2, (rLng + cLng) / 2], 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const resIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.restaurant = L.marker([rLat, rLng], { icon: resIcon }).addTo(map)
        .bindPopup(`<b>Quán ${activeJob.restaurant}</b><br/> ${activeJob.resAddress}`);

      const custIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.customer = L.marker([cLat, cLng], { icon: custIcon }).addTo(map)
        .bindPopup(`<b>Khách hàng: ${activeJob.customer}</b><br/>${activeJob.custAddress}`);

      map.fitBounds([[rLat, rLng], [cLat, cLng]], { padding: [40, 40] });
    }
  }, [restaurantCoords, activeJob?.deliveryLat]);

  // Cleanup bản đồ khi component huỷ
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = { restaurant: null, customer: null, shipper: null };
        polylineRef.current = null;
      }
    };
  }, []);

  const handleAcceptJob = async (order) => {
    try {
      setLoading(true);
      await apiClient.post(`/shipper/orders/${order.id}/accept`);
      toast.success(`Đã nhận thành công đơn hàng #${order.id}! Hãy đến quán lấy đồ ăn.`);
      await fetchActiveJob();
      await fetchAvailableOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể nhận đơn hàng này, có thể tài xế khác đã nhanh tay hơn!');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async () => {
    if (!activeJob) return;
    try {
      setLoading(true);
      // READY_FOR_PICKUP -> PICKED_UP -> DELIVERING -> COMPLETED.
      const status = activeJob.status;
      const id = activeJob.id;

      if (status === 'READY_FOR_PICKUP') {
        await apiClient.patch(`/shipper/orders/${id}/picked-up`);
        await apiClient.patch(`/shipper/orders/${id}/delivering`);
        toast.success('Đã xác nhận lấy hàng thành công!');
        await fetchActiveJob();
      } 
      // else if (status === 'PICKED_UP') {
      //   await apiClient.patch(`/shipper/orders/${id}/delivering`);
      //   await apiClient.patch(`/shipper/orders/${id}/complete`);
      //   toast.success('Đơn hàng đã giao thành công!');
      //   setActiveJob(null);
      //   setRouteCoords([]);
      //   await fetchAvailableOrders();
      // } 
      else if (status === 'DELIVERING') {
        await apiClient.patch(`/shipper/orders/${id}/complete`);
        toast.success('Đơn hàng đã giao thành công!');
        setActiveJob(null);
        setRouteCoords([]);
        await fetchAvailableOrders();
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi cập nhật tiến trình đơn hàng. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (order) => {
    if (order.restaurantId && order.deliveryLat && order.deliveryLng) {
      fetchShippingForRestaurant(order.restaurantId, order.deliveryLat, order.deliveryLng);
    }
    orderModal.open(order);
  };

  const activeDistance = activeJob ? orderDistanceCache[activeJob.id] : null;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans pb-24 space-y-6">

      {/* Header with online toggle */}
      <Card variant="elevated" className={`!rounded-radius-xl p-5 flex items-center justify-between transition-all duration-300 border ${
        online 
          ? 'bg-gradient-to-r from-emerald-50/50 via-white to-white border-emerald-200/60' 
          : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-radius-lg flex items-center justify-center transition-colors ${
            online ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
          }`}>
            <Bike size={24} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
              Shipper Hub
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full inline-block ${
                online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`} />
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                {online ? 'Sẵn sàng nhận đơn giao hàng' : 'Đang tạm dừng nhận đơn'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setOnline(!online)}
          className={`px-4 py-2.5 text-xs font-extrabold rounded-radius-full transition-all shadow-sm flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
            online
              ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'
              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200/70'
          }`}
        >
          <span className={`w-2 h-2 rounded-full inline-block ${
            online ? 'bg-white animate-ping' : 'bg-slate-400'
          }`} />
          {online ? 'ĐANG BẬT ONLINE' : 'ĐANG TẮT OFFLINE'}
        </button>
      </Card>

      {/* ACTIVE JOB SCREEN */}
      {activeJob ? (
        <Card variant="elevated" className="!rounded-radius-xl shadow-shadow-2 overflow-hidden flex flex-col md:flex-row h-max transition-all duration-300 animate-slide-up">

          <div className="flex-1 min-h-[280px] relative border-b md:border-b-0 md:border-r border-slate-200/60">
            {restaurantCoords.lat && activeJob.deliveryLat ? (
              <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
            ) : (
              <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-xs">
                Đang tải dữ liệu bản đồ...
              </div>
            )}
          </div>

          {/* Stepper active panel */}
          <div className="w-full md:w-96 p-6 flex flex-col justify-between space-y-6 shrink-0 bg-white">
            <div>
              <div className="flex items-center justify-between pb-2">
                <div>
                  <span className="text-[10px] text-md-tertiary font-bold bg-[#E8F5E9] px-2.5 py-1 rounded-full uppercase inline-block">
                    ĐƠN ĐANG GIAO #{activeJob.id}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Phí giao hàng</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0 pb-4">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                  <Route size={13} className="text-md-tertiary shrink-0" />
                  <span>
                    {activeDistance?.distanceKm != null
                      ? `${activeDistance.distanceKm.toFixed(1)} km`
                      : 'Đang tính...'}
                  </span>
                  {activeDistance?.durationMinutes && (
                    <span> ~{Math.round(activeDistance.durationMinutes)} phút</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-md-tertiary block">{formatCurrency(activeJob.fee)}</span>
                </div>
              </div>

              {/* Status stepper progress bar */}
              <div className="mt-2 space-y-5">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    activeJob.step === 'ACCEPTED' || activeJob.step === 'PICKED_UP'
                      ? 'bg-md-tertiary text-white border-md-tertiary shadow-sm font-extrabold'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    1
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-700 block">Lấy hàng tại quán: {activeJob.restaurant}</span>
                    <span className="text-[10px] md:text-[11px] text-slate-400 block mt-0.5 font-bold">Địa chỉ: {activeJob.resAddress}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    activeJob.step === 'PICKED_UP'
                      ? 'bg-md-tertiary text-white border-md-tertiary shadow-sm animate-pulse font-extrabold'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    2
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-700 block">Giao đến khách hàng</span>
                    <span className="text-[10px] md:text-[11px] text-slate-400 block mt-0.5 font-bold">Địa chỉ: {activeJob.custAddress}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Contact with customer */}
            <div className="bg-slate-50 p-4 rounded-radius-lg border border-slate-100 flex items-center justify-between text-xs font-semibold">
              <div className="min-w-0 pr-3">
                <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">Thông tin người nhận</span>
                <span className="font-extrabold text-slate-800 block truncate mt-1.5 leading-none">{activeJob.customer} - {activeJob.phone}</span>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={handleChatWithCustomer}
                  className="p-2 bg-white rounded-full border border-slate-200 hover:text-md-tertiary hover:border-md-tertiary hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <MessageSquare size={14} />
                </button>
                <a href={`tel:${activeJob.phone}`} className="p-2 bg-white rounded-full border border-slate-200 hover:text-md-secondary hover:border-md-secondary hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer">
                  <Phone size={14} />
                </a>
              </div>
            </div>

            {/* Action button */}
            <Button
              onClick={handleNextStep}
              variant="primary"
              size="md"
              icon={Check}
              className="w-full !bg-md-tertiary hover:!bg-opacity-95 !rounded-radius-full !py-3.5 text-xs uppercase tracking-wider"
            >
              {activeJob.step === 'ACCEPTED' ? 'Xác nhận đã lấy hàng' : 'Xác nhận giao thành công'}
            </Button>
          </div>

        </Card>
      ) : (
        /* AVAILABLE JOBS LIST */
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Navigation className="text-md-tertiary" size={18} />
            Đơn hàng khả dụng ({availableOrders.length})
          </h2>

          {!online ? (
            <Card variant="elevated" className="!rounded-radius-xl p-10 text-center text-xs text-slate-400 font-semibold leading-relaxed flex flex-col items-center gap-3">
              <PowerOff size={36} className="text-slate-300" strokeWidth={1.5} />
              <span>Vui lòng chuyển trạng thái sang <span className="text-slate-600 font-extrabold">ONLINE</span> để bắt đầu quét các đơn hàng.</span>
            </Card>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : availableOrders.length === 0 ? (
            <EmptyState
              title=""
              message="Không có các đơn hàng xung quanh vị trí của bạn."
              icon={Bike}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableOrders.map((order) => (
                <Card
                  key={order.id}
                  variant="elevated"
                  hoverEffect
                  className="!rounded-radius-xl p-5 flex flex-col justify-between animate-fade-in"
                >
                  <div className="mt-0 pt-0 mb-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">MÃ ĐƠN #{order.id}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#2E7D32] bg-[#E8F5E9] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider leading-none shadow-sm inline-block">
                          {orderDistanceCache[order.id]?.distanceKm != null
                            ? `${orderDistanceCache[order.id].distanceKm.toFixed(1)} km`
                            : 'Đang tính...'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 my-3 text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Utensils size={14} className="text-md-tertiary shrink-0" />
                        <span className=""><b>Quán:</b> Địa chỉ: {order.resAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-md-primary shrink-0" />
                        <span className=""><b>Khách hàng:</b> Địa chỉ: {order.custAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 flex-nowrap gap-2">
                    <div className="shrink-0">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase leading-none tracking-wider">Phí giao hàng</span>
                      <span className="font-extrabold text-xs sm:text-sm text-md-tertiary mt-1 block leading-none">{formatCurrency(order.fee)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Yêu cầu 2: Đồng bộ kiểu chữ của nút "Chi tiết" giống nút "Nhận đơn" */}
                      <Button
                        onClick={() => handleOpenDetail(order)}
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        className="!rounded-radius-full !px-2.5 sm:!px-3 !py-2 text-[10px] sm:text-xs uppercase tracking-wider"
                      >
                        Chi tiết
                      </Button>
                      <Button
                        onClick={() => handleAcceptJob(order)}
                        variant="primary"
                        size="sm"
                        icon={Check}
                        className="!bg-md-tertiary hover:!bg-opacity-95 !rounded-radius-full !px-3 sm:!px-4 !py-2 text-[10px] sm:text-xs uppercase tracking-wider"
                      >
                        Nhận đơn
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={orderModal.isOpen}
        onClose={orderModal.close}
        title={`Chi Tiết Đơn #${orderModal.data?.id}`}
        size="md"
      >
        {orderModal.data && (
          <div className="space-y-3 text-xs font-semibold text-slate-700 -mt-2">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-2">
              <div className="flex gap-2 items-start">
                <Utensils size={14} className="text-md-tertiary shrink-0 mt-0.5" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-850 truncate"><b>Quán:</b> {orderModal.data.restaurant}</p>
                  <p className="text-slate-450 text-[10px]">{orderModal.data.resAddress}</p>
                </div>
              </div>
              <div className="border-t border-slate-200/50" />
              <div className="flex gap-2 items-start">
                <Home size={14} className="text-md-primary shrink-0 mt-0.5" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-850"><b>Khách hàng:</b></p>
                  <p className="text-slate-450 text-[10px]">{orderModal.data.custAddress}</p>
                </div>
              </div>
            </div>

            {/* Khoảng cách */}
            {orderDistanceCache[orderModal.data.id] && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-emerald-800">
                <div className="flex items-center gap-2">
                  <Route size={15} className="text-md-tertiary" />
                  <span className="font-extrabold text-xs">Khoảng cách:</span>
                </div>
                <span className="font-extrabold text-xs text-md-tertiary">
                  {orderDistanceCache[orderModal.data.id].distanceKm?.toFixed(1)} km
                  {orderDistanceCache[orderModal.data.id].durationMinutes
                    ? ` (~${Math.round(orderDistanceCache[orderModal.data.id].durationMinutes)} phút)`
                    : ''}
                </span>
              </div>
            )}

            {/* Danh sách món ăn */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase ml-1 tracking-wider">
                Danh Sách Món Ăn ({orderModal.data.itemsCount})
              </span>
              <div className="max-h-[120px] overflow-y-auto scrollbar-thin px-1 bg-white border border-slate-100 rounded-lg">
                {orderModal.data.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 text-sm">
                    <p className="text-slate-800 font-medium">
                      {item.foodName} <span className="text-slate-400 text-xs font-semibold">x{item.quantity}</span>
                    </p>
                    <span className="text-slate-800 font-bold">{formatCurrency(Number(item.priceAtOrder || 0) * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thanh toán */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500"><span>Tạm tính</span><span>{formatCurrency(orderModal.data.subtotalAmount)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Phí giao hàng</span><span className="text-md-tertiary font-bold">{formatCurrency(orderModal.data.fee)}</span></div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                <span className="font-extrabold text-slate-800">Tổng thanh toán</span>
                <span className="font-extrabold text-slate-800">{formatCurrency(orderModal.data.total)}</span>
              </div>
            </div>

            {/* Nút nhận đơn */}
            <Button
              variant="primary"
              className="w-full !bg-emerald-600 !border-emerald-600 h-10 uppercase tracking-wider text-xs font-bold"
              icon={Check}
              onClick={() => {
                handleAcceptJob(orderModal.data);
                orderModal.close();
              }}
            >
              Nhận đơn
            </Button>
          </div>
        )}
      </Modal>

    </div>
  );
}