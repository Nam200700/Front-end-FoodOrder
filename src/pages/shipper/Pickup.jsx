import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, MapPin, Navigation, Bike, DollarSign, Check, Phone, MessageSquare, Eye, X, Utensils, Home, AlertTriangle, FileText, Route, PowerOff, RefreshCw, Zap, Bell, User, Banknote, Wallet, Clock, PhoneCall, ShieldCheck, StickyNote } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { useChatStore } from '../../stores/chatStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addVietnamBaseMap } from '../../utils/mapSovereignty';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
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
  const [mapReady, setMapReady] = useState(0); // tăng mỗi lần map (tái) tạo → effect vẽ marker/route chạy lại

  // CALLBACK REF gắn vào <div> bản đồ: tạo map NGAY khi node mount, GỠ map khi node unmount.
  // Cách này khớp map với đúng DOM node hiện tại → đổi đơn / khung ẩn-hiện lại đều không bị map trống
  // (bug cũ: map chỉ tạo 1 lần & chỉ gỡ lúc rời trang → nhận đơn 2 map trống, phải reload).
  const setMapNode = useCallback((node) => {
    if (!node) {
      // Node bị gỡ (đổi đơn / đang tải lại toạ độ) → huỷ map để lần sau tạo mới trên node mới
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current = { restaurant: null, customer: null, shipper: null };
      polylineRef.current = null;
      mapContainerRef.current = null;
      return;
    }
    mapContainerRef.current = node;
    if (mapRef.current) return; // đã có map cho node này
    const map = L.map(node).setView([10.7769, 106.7009], 13); // tâm mặc định (HCM), sẽ fitBounds sau
    mapRef.current = map;
    addVietnamBaseMap(map); // nền chủ quyền VN (Goong/CARTO + Hoàng Sa/Trường Sa)
    setMapReady((v) => v + 1);
  }, []);

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
          phone: mappedOrder.customerPhone || '',
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
          createdAt: mappedOrder.createdAt,
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
    // Reset toạ độ quán cũ trước khi nạp đơn mới → map không vẽ nhầm ở quán của đơn trước
    // (đồng thời chờ có toạ độ mới mới khởi tạo map, tránh vẽ sai vị trí trong lúc fetch).
    setRestaurantCoords({ lat: null, lng: null });
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

  // Vẽ / cập nhật MARKER quán + khách lên map (map đã do callback ref tạo sẵn).
  // Chạy lại khi: map vừa (tái) tạo (mapReady) · đổi đơn · toạ độ quán/khách đổi.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeJob || !restaurantCoords.lat || !activeJob.deliveryLat) return;

    const rLat = restaurantCoords.lat, rLng = restaurantCoords.lng;
    const cLat = activeJob.deliveryLat, cLng = activeJob.deliveryLng;

    // Xoá marker cũ trước khi vẽ lại (đổi đơn)
    if (markersRef.current.restaurant) map.removeLayer(markersRef.current.restaurant);
    if (markersRef.current.customer) map.removeLayer(markersRef.current.customer);

    const resIcon = L.divIcon({
      html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
      className: 'custom-div-icon', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    markersRef.current.restaurant = L.marker([rLat, rLng], { icon: resIcon }).addTo(map)
      .bindPopup(`<b>Quán ${activeJob.restaurant}</b><br/> ${activeJob.resAddress}`);

    const custIcon = L.divIcon({
      html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg></div>`,
      className: 'custom-div-icon', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    markersRef.current.customer = L.marker([cLat, cLng], { icon: custIcon }).addTo(map)
      .bindPopup(`<b>Khách hàng: ${activeJob.customer}</b><br/>${activeJob.custAddress}`);

    // Leaflet đôi khi cần tính lại kích thước sau khi container vừa mount → tránh map xám
    map.invalidateSize();
    map.fitBounds([[rLat, rLng], [cLat, cLng]], { padding: [40, 40] });
  }, [mapReady, restaurantCoords.lat, restaurantCoords.lng, activeJob?.id, activeJob?.deliveryLat, activeJob?.deliveryLng]);

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
  }, [routeCoords, mapReady]);

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

  //bật tắt trạng thái online offline
  const handleToggleOnline = async () => {
    const nextStatus = !online;
    try {
      await apiClient.put('/users/profile', { isOnline: nextStatus });
      setOnline(nextStatus);
      toast.success(nextStatus ? 'Đã bật trạng thái online!' : 'Đã tắt trạng thái online!');
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái online:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái. Vui lòng thử lại!');
    }
  };

  const activeDistance = activeJob ? orderDistanceCache[activeJob.id] : null;

  // Quét lại đơn khả dụng thủ công (nút "Làm mới") — icon xoay trong lúc quét.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshAvailable = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await fetchAvailableOrders(); }
    finally { setTimeout(() => setRefreshing(false), 500); }
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full font-google-sans pb-24 space-y-6">

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

        <Button
          onClick={handleToggleOnline}
          className="px-4 py-2.5 text-xs font-extrabold rounded-radius-full transition-all shadow-sm flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] cursor-pointer !bg-md-tertiary text-white shadow-emerald-200"
        >
          <span className={`w-2 h-2 rounded-full inline-block ${
            online ? 'bg-white animate-ping' : 'bg-slate-400'
          }`} />
          {online ? 'ĐANG BẬT ONLINE' : 'ĐANG TẮT OFFLINE'}
        </Button>
      </Card>

      {/* ACTIVE JOB SCREEN */}
      {activeJob ? (
        <Card variant="elevated" className="!rounded-radius-xl shadow-shadow-2 overflow-hidden flex flex-col md:flex-row h-max transition-all duration-300 animate-slide-up">

          <div className="flex-1 min-h-[280px] relative border-b md:border-b-0 md:border-r border-slate-200/60">
            {restaurantCoords.lat && activeJob.deliveryLat ? (
              <div ref={setMapNode} className="w-full h-full min-h-[300px] z-10" />
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
          <div className="flex items-center justify-between mb-2 gap-3">
            <h2 className="text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="text-md-tertiary" size={18} />
              Đơn hàng khả dụng
              <span className="text-white bg-md-tertiary px-2 py-0.5 rounded-full text-[11px] normal-case">{availableOrders.length}</span>
            </h2>
            {online && (
              <button
                onClick={handleRefreshAvailable}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-md-tertiary bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Đang quét…' : 'Làm mới'}
              </button>
            )}
          </div>

          {!online ? (
            <Card variant="elevated" className="!rounded-radius-xl p-10 text-center text-xs text-slate-400 font-semibold leading-relaxed flex flex-col items-center gap-3">
              <PowerOff size={36} className="text-slate-300" strokeWidth={1.5} />
              <span>Vui lòng chuyển trạng thái sang <span className="text-slate-600 font-extrabold">ONLINE</span> để bắt đầu quét các đơn hàng.</span>
            </Card>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : availableOrders.length === 0 ? (
            <Card variant="elevated" className="!rounded-radius-xl p-8 md:p-10 flex flex-col items-center text-center gap-5 animate-fade-in">
              {/* Radar quét đơn — vòng sóng lan toả quanh icon xe */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                <span className="absolute inset-3 rounded-full bg-emerald-400/25 animate-ping" style={{ animationDelay: '0.5s' }} />
                <span className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white flex items-center justify-center shadow-lg animate-float">
                  <Bike size={28} />
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-800">Đang quét đơn quanh bạn…</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1.5 max-w-xs leading-relaxed">
                  Chưa có đơn phù hợp gần đây. Đơn mới sẽ <span className="text-md-tertiary font-extrabold">tự hiện ngay</span> khi có khách đặt gần vị trí của bạn.
                </p>
              </div>

              <button
                onClick={handleRefreshAvailable}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-radius-full text-xs font-extrabold uppercase tracking-wider bg-md-tertiary text-white shadow-sm hover:scale-[1.03] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Đang quét…' : 'Quét lại ngay'}
              </button>

              {/* Mẹo giúp shipper nhận nhiều đơn hơn */}
              <div className="w-full max-w-md pt-5 border-t border-slate-100 text-left space-y-2.5">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={12} className="text-amber-500" /> Mẹo nhận nhiều đơn hơn
                </p>
                {[
                  { icon: MapPin, color: 'bg-emerald-50 text-emerald-600', text: 'Di chuyển tới khu tập trung nhiều quán ăn để bắt được nhiều đơn hơn.' },
                  { icon: Zap, color: 'bg-amber-50 text-amber-600', text: 'Giữ trạng thái Online liên tục để không bỏ lỡ đơn vừa lên.' },
                  { icon: Bell, color: 'bg-blue-50 text-blue-600', text: 'Bật thông báo trên máy để nhận đơn kịp thời, phản hồi nhanh.' },
                ].map((tip, i) => {
                  const TipIcon = tip.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-slate-50/70 rounded-radius-lg p-2.5 animate-rise-in" style={{ animationDelay: `${i * 70}ms` }}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tip.color}`}><TipIcon size={15} /></span>
                      <span className="text-[11px] font-semibold text-slate-600 leading-snug">{tip.text}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

                  <div className="border-t border-slate-100 pt-3 mt-1">
                    <div className="mb-3">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase leading-none tracking-wider">Phí giao hàng</span>
                      <span className="font-extrabold text-base text-md-tertiary mt-1 block leading-none">{formatCurrency(order.fee)}</span>
                    </div>

                    {/* 2 nút chia đôi full-width — không bị ép/cắt chữ khi card hẹp (4 cột) */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleOpenDetail(order)}
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        className="w-full justify-center !rounded-radius-full !px-2 !py-2 text-[10px] sm:text-xs uppercase tracking-wider"
                      >
                        Chi tiết
                      </Button>
                      <Button
                        onClick={() => handleAcceptJob(order)}
                        variant="primary"
                        size="sm"
                        icon={Check}
                        className="w-full justify-center !bg-md-tertiary hover:!bg-opacity-95 !rounded-radius-full !px-2 !py-2 text-[10px] sm:text-xs uppercase tracking-wider"
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
        {orderModal.data && (() => {
          const d = orderModal.data;
          const isCOD = String(d.paymentMethod || 'COD').toUpperCase() === 'COD';
          const payLabel = { COD: 'Tiền mặt (COD)', VNPAY: 'VNPAY', MOMO: 'Ví MoMo', ZALOPAY: 'ZaloPay', ONLINE: 'Online' }[String(d.paymentMethod || 'COD').toUpperCase()] || 'Online';
          return (
          <div className="space-y-3 text-xs font-semibold text-slate-700 -mt-2">
            {/* ─── ĐIỂM LẤY & GIAO: quán + khách kèm SĐT gọi nhanh ─── */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2.5">
              <div className="flex gap-2.5 items-start">
                <span className="w-7 h-7 rounded-md bg-[#E8F5E9] text-md-tertiary flex items-center justify-center shrink-0"><Utensils size={14} /></span>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Điểm lấy hàng</p>
                  <p className="text-slate-800 font-bold truncate">{d.restaurant}</p>
                  <p className="text-slate-500 text-[11px] leading-snug">{d.resAddress}</p>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-200" />
              <div className="flex gap-2.5 items-start">
                <span className="w-7 h-7 rounded-md bg-orange-50 text-orange-500 flex items-center justify-center shrink-0"><MapPin size={14} /></span>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Điểm giao — khách hàng</p>
                  <p className="text-slate-800 font-bold flex items-center gap-1.5"><User size={12} className="text-slate-400 shrink-0" /> {d.customer || 'Khách hàng'}</p>
                  <p className="text-slate-500 text-[11px] leading-snug">{d.custAddress}</p>
                </div>
              </div>
              {/* SĐT khách — gọi nhanh (giảm rủi ro không liên lạc được) */}
              {d.customerPhone ? (
                <a
                  href={`tel:${d.customerPhone}`}
                  className="flex items-center justify-between gap-2 bg-white border border-md-tertiary/30 rounded-lg px-3 py-2 hover:bg-[#E8F5E9] transition-colors"
                >
                  <span className="flex items-center gap-2 text-slate-700"><Phone size={13} className="text-md-tertiary" /> SĐT khách: <b className="tabular-nums">{d.customerPhone}</b></span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-md-tertiary px-2.5 py-1 rounded-full"><PhoneCall size={11} /> Gọi</span>
                </a>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-[11px]">
                  <AlertTriangle size={13} /> Đơn chưa có số điện thoại khách — hãy cẩn thận khi giao.
                </div>
              )}
            </div>

            {/* ─── CẢNH BÁO THANH TOÁN / THU HỘ (thông tin quan trọng nhất với tài xế) ─── */}
            {isCOD ? (
              <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-300 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <Banknote size={16} /> <span className="text-xs font-extrabold uppercase tracking-wide">Thu tiền mặt khi giao (COD)</span>
                </div>
                <div className="flex items-end justify-between mt-1.5">
                  <span className="text-[11px] text-amber-700/80 font-semibold">Thu đúng số này của khách</span>
                  <span className="text-xl font-black text-amber-600">{formatCurrency(d.total)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700">
                <ShieldCheck size={16} className="shrink-0" />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide">Đã thanh toán {payLabel}</p>
                  <p className="text-[11px] font-semibold text-emerald-700/80">Không thu tiền của khách khi giao.</p>
                </div>
              </div>
            )}

            {/* ─── GHI CHÚ ĐƠN (dị ứng, số tầng, cổng...) — quan trọng để giao đúng ─── */}
            {d.note && (
              <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-yellow-800">
                <StickyNote size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide">Ghi chú của khách</p>
                  <p className="text-[11px] font-medium leading-snug mt-0.5">{d.note}</p>
                </div>
              </div>
            )}

            {/* Khoảng cách + thời gian đặt */}
            <div className="grid grid-cols-2 gap-2">
              {orderDistanceCache[d.id] && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-emerald-800">
                  <Route size={15} className="text-md-tertiary shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[9px] font-bold uppercase text-emerald-700/70">Quãng đường</p>
                    <p className="font-extrabold text-xs text-md-tertiary">
                      {orderDistanceCache[d.id].distanceKm?.toFixed(1)} km
                      {orderDistanceCache[d.id].durationMinutes ? ` · ~${Math.round(orderDistanceCache[d.id].durationMinutes)}p` : ''}
                    </p>
                  </div>
                </div>
              )}
              {d.createdAt && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-slate-600">
                  <Clock size={15} className="text-slate-400 shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Thời gian đặt</p>
                    <p className="font-extrabold text-xs text-slate-700">{d.createdAt}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách món ăn (kèm ghi chú từng món nếu có) */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase ml-1 tracking-wider">
                Danh Sách Món Ăn ({d.itemsCount})
              </span>
              <div className="max-h-[120px] overflow-y-auto scrollbar-thin px-2 bg-white border border-slate-100 rounded-lg">
                {d.items?.map((item, idx) => (
                  <div key={idx} className="py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between items-center text-sm">
                      <p className="text-slate-800 font-medium">
                        {item.foodName || item.name} <span className="text-slate-400 text-xs font-semibold">x{item.quantity}</span>
                      </p>
                      <span className="text-slate-800 font-bold">{formatCurrency(Number(item.priceAtOrder || item.price || 0) * item.quantity)}</span>
                    </div>
                    {item.note && <p className="text-[10px] text-slate-400 italic mt-0.5">Ghi chú: {item.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Thanh toán chi tiết */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500"><span>Tạm tính món</span><span>{formatCurrency(d.subtotalAmount)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Phí giao hàng (bạn nhận)</span><span className="text-md-tertiary font-bold">{formatCurrency(d.fee)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Hình thức thanh toán</span><span className="font-bold text-slate-700 inline-flex items-center gap-1">{isCOD ? <Banknote size={12} className="text-amber-500" /> : <Wallet size={12} className="text-emerald-500" />}{payLabel}</span></div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                <span className="font-extrabold text-slate-800">Tổng đơn hàng</span>
                <span className="font-extrabold text-slate-800">{formatCurrency(d.total)}</span>
              </div>
            </div>

            {/* Nút nhận đơn */}
            <Button
              variant="primary"
              className="w-full !bg-emerald-600 !border-emerald-600 h-10 uppercase tracking-wider text-xs font-bold"
              icon={Check}
              onClick={() => {
                handleAcceptJob(d);
                orderModal.close();
              }}
            >
              Nhận đơn
            </Button>
          </div>
          );
        })()}
      </Modal>

    </div>
  );
}