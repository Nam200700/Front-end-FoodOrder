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
import { useModalState } from '../../hooks/useModalState';
import { useCartStore } from '../../stores/cartStore';


// Fix lỗi default marker của Leaflet trong React
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

  // TOẠ ĐỘ QUÁN ĂN NẠP TỪ BACKEND
  const [restaurantCoords, setRestaurantCoords] = useState({ lat: null, lng: null });
  // TOẠ ĐỘ TÀI XẾ MÔ PHỎNG DI CHUYỂN
  const [shipperCoords, setShipperCoords] = useState({ lat: null, lng: null });

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ restaurant: null, customer: null, shipper: null });
  const polylineRef = useRef(null);

  const orderModal = useModalState(null);

  const { fetchShippingForRestaurant, restaurantShippingCache } = useCartStore();

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

  // 1. Lấy thông tin đơn hàng đang nhận giao (nếu có) từ danh sách đơn của shipper
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
          resAddress: `Tại Quán: ${mappedOrder.restaurantName}`,
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
    } catch (err) {
      console.error('Lỗi khi tải đơn hàng khả dụng:', err);
    } finally {
      setLoading(false);
    }
  }, [online]);

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
    console.log('[Shipper WebSocket]: Subscribing to ' + availableDest);
    const subAvailable = subscribe(availableDest, (event) => {
      console.log('[Shipper WebSocket]: Available orders update', event);
      fetchAvailableOrders();
    });

    // Subscribe topic notification cá nhân để biết đơn được gán hoặc hủy
    const notifyDest = '/user/queue/notify';
    console.log('[Shipper WebSocket]: Subscribing to ' + notifyDest);
    const subNotify = subscribe(notifyDest, (event) => {
      console.log('[Shipper WebSocket]: Personal notification received', event);
      fetchActiveJob();
      fetchAvailableOrders();
    });

    return () => {
      if (subAvailable) {
        console.log('[Shipper WebSocket]: Unsubscribing from ' + availableDest);
        subAvailable.unsubscribe();
      }
      if (subNotify) {
        console.log('[Shipper WebSocket]: Unsubscribing from ' + notifyDest);
        subNotify.unsubscribe();
      }
    };
  }, [online, subscribe, fetchActiveJob, fetchAvailableOrders]);

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
  useEffect(() => {
    if (!activeJob || !restaurantCoords.lat || !activeJob.deliveryLat) return;

    const rLat = restaurantCoords.lat;
    const rLng = restaurantCoords.lng;
    const cLat = activeJob.deliveryLat;
    const cLng = activeJob.deliveryLng;

    let intervalId;

    if (activeJob.step === 'ACCEPTED') {
      // Shipper đi từ điểm ngoài vào quán ăn lấy hàng
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
      // Shipper đi từ quán ăn sang giao cho khách
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
  }, [activeJob?.step, restaurantCoords, activeJob?.deliveryLat]);

  // Vẽ bản đồ Leaflet thật cho Shipper (Chỉ hiển thị Owner và Customer)
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

      // Marker Quán ăn — icon dao/nĩa (SVG) thay emoji 🍜
      const resIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.restaurant = L.marker([rLat, rLng], { icon: resIcon }).addTo(map)
        .bindPopup(`<b>Quán ăn: ${activeJob.restaurant}</b><br/>Địa điểm lấy hàng.`);

      // Marker Khách hàng — icon nhà (SVG) thay emoji 🏠
      const custIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shadow-md border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg></div>`,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      markersRef.current.customer = L.marker([cLat, cLng], { icon: custIcon }).addTo(map)
        .bindPopup(`<b>Khách hàng: ${activeJob.customer}</b><br/>Giao tại: ${activeJob.custAddress}`);

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
      if (selectedDetailOrder && selectedDetailOrder.id === order.id) {
        setSelectedDetailOrder(null); // Đóng modal chi tiết
      }
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
      // Máy trạng thái backend tuần tự nghiêm ngặt:
      // READY_FOR_PICKUP -> PICKED_UP -> DELIVERING -> COMPLETED.
      // Rẽ nhánh theo trạng thái THẬT của đơn để gọi đúng chuỗi lệnh, tránh gọi thẳng
      // /complete khi đơn còn ở PICKED_UP (gây 422 "không thể chuyển trạng thái" -> kẹt).
      const status = activeJob.status;
      const id = activeJob.id;

      if (status === 'READY_FOR_PICKUP') {
        // Bước 1: lấy hàng ở quán rồi chuyển sang đang giao
        await apiClient.patch(`/shipper/orders/${id}/picked-up`);
        await apiClient.patch(`/shipper/orders/${id}/delivering`);
        toast.success('Đã xác nhận lấy hàng thành công! Đang giao hàng đến khách hàng.');
        await fetchActiveJob();
      } else if (status === 'PICKED_UP') {
        // Đơn kẹt ở PICKED_UP (chưa qua DELIVERING) -> đẩy tiếp rồi hoàn tất (tự cứu)
        await apiClient.patch(`/shipper/orders/${id}/delivering`);
        await apiClient.patch(`/shipper/orders/${id}/complete`);
        toast.success('Chúc mừng! Đơn hàng đã giao thành công và tiền ship đã được ghi nhận.');
        setActiveJob(null);
        await fetchAvailableOrders();
      } else if (status === 'DELIVERING') {
        // Bước 2: hoàn tất giao hàng
        await apiClient.patch(`/shipper/orders/${id}/complete`);
        toast.success('Chúc mừng! Đơn hàng đã giao thành công và tiền ship đã được ghi nhận.');
        setActiveJob(null);
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
    // Gọi API tính khoảng cách nếu chưa có trong cache
    // Truyền vào ID quán và tọa độ giao hàng của đơn
    if (order.restaurantId && order.deliveryLat && order.deliveryLng) {
      fetchShippingForRestaurant(order.restaurantId, order.deliveryLat, order.deliveryLng);
    }
    orderModal.open(order);
  };



  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans pb-24 space-y-6">
      
      {/* Header with online toggle */}
      <div className="flex items-center justify-between bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm transition-all duration-300">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
            {/* icon Bike xanh thay emoji 🚴 */}
            <Bike className="text-md-tertiary" size={22} /> Shipper Hub
          </h1>
          <p className="text-[10px] md:text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">
            Trạng thái hoạt động nhận đơn
          </p>
        </div>

        <button
          onClick={() => setOnline(!online)}
          className={`px-4 py-2 text-xs font-bold rounded-radius-full transition-all shadow-sm flex items-center gap-1.5 hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
            online
              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full inline-block ${
            online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
          }`} />
          {online ? 'ĐANG BẬT ONLINE' : 'ĐANG TẮT OFFLINE'}
        </button>
      </div>

      {/* ACTIVE JOB SCREEN (Nếu đang nhận 1 đơn giao) */}
      {activeJob ? (
        <div className="bg-white rounded-radius-xl border border-slate-200/60 shadow-shadow-2 overflow-hidden flex flex-col md:flex-row h-max transition-all duration-300 animate-slide-up">
          
          {/* Bản đồ Leaflet chỉ đường thật 100% cho tài xế */}
          <div className="flex-1 min-h-[280px] relative border-b md:border-b-0 md:border-r border-slate-200/60">
            {restaurantCoords.lat && activeJob.deliveryLat ? (
              <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
            ) : (
              <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-xs">
                Đang tải dữ liệu bản đồ chỉ đường...
              </div>
            )}
          </div>

          {/* Stepper active panel */}
          <div className="w-full md:w-96 p-6 flex flex-col justify-between space-y-6 shrink-0 bg-white">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] text-md-tertiary font-bold bg-[#E8F5E9] px-2.5 py-0.5 rounded-full uppercase">
                    ĐƠN ĐANG GIAO #{activeJob.id}
                  </span>
                  <h3 className="font-extrabold text-sm md:text-base text-slate-800 mt-2">{activeJob.restaurant}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">TIỀN SHIP</span>
                  <span className="text-base md:text-lg font-extrabold text-md-tertiary mt-0.5 block">{formatCurrency(activeJob.fee)}</span>
                </div>
              </div>

              {/* Status stepper progress bar */}
              <div className="mt-5 space-y-5">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    activeJob.step === 'ACCEPTED' || activeJob.step === 'PICKED_UP'
                      ? 'bg-md-tertiary text-white border-md-tertiary shadow-sm font-extrabold'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    1
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-700 block">Đến quán nhận đồ ăn</span>
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
                    <span className="text-xs font-extrabold text-slate-700 block">Vận chuyển tới khách hàng</span>
                    <span className="text-[10px] md:text-[11px] text-slate-400 block mt-0.5 font-bold">Địa chỉ: {activeJob.custAddress}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Contact with customer */}
            <div className="bg-slate-50 p-4 rounded-radius-lg border border-slate-100 flex items-center justify-between text-xs font-semibold">
              <div className="min-w-0 pr-3">
                <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">KHÁCH HÀNG</span>
                <span className="font-extrabold text-slate-800 block truncate mt-1.5 leading-none">{activeJob.customer}</span>
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
            <button
              onClick={handleNextStep}
              className="w-full bg-md-tertiary hover:bg-opacity-95 text-white font-extrabold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs uppercase cursor-pointer tracking-wider"
            >
              <Check size={14} className="stroke-[3.5px]" />
              {activeJob.step === 'ACCEPTED' ? 'Xác nhận đã lấy hàng' : 'Xác nhận giao thành công'}
            </button>
          </div>

        </div>
      ) : (
        /* AVAILABLE JOBS LIST (Nếu chưa nhận đơn nào) */
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-xs md:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Navigation className="text-md-tertiary" size={18} />
            Đơn hàng khả dụng ({availableOrders.length})
          </h2>

          {!online ? (
            <div className="bg-white rounded-radius-xl p-10 border border-slate-200/60 shadow-sm text-center text-xs text-slate-400 font-semibold leading-relaxed flex flex-col items-center gap-3">
              {/* icon PowerOff thay emoji 📴 */}
              <PowerOff size={36} className="text-slate-300" strokeWidth={1.5} />
              <span>Vui lòng chuyển trạng thái sang <span className="text-slate-600 font-extrabold">ONLINE</span> để bắt đầu quét các đơn hàng xung quanh.</span>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SkeletonOrderCard />
              <SkeletonOrderCard />
            </div>
          ) : availableOrders.length === 0 ? (
            <EmptyState
              title="Đang quét đơn hàng..."
              message="Đang tìm kiếm các đơn đặt món mới xung quanh vị trí của bạn."
              icon={Bike}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableOrders.map((order) => (
                <div 
                  key={order.id}
                  className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-350 hover:scale-[1.01] transition-all duration-300 animate-fade-in"
                >
                  <div>
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none">MÃ ĐƠN #{order.id}</span>
                        <h3 className="font-extrabold text-sm md:text-base text-slate-800 mt-2 truncate max-w-[200px] leading-none">{order.restaurant}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#2E7D32] bg-[#E8F5E9] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider leading-none block shadow-sm">
                          Thành Phố
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 my-4 text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        {/* icon Utensils thay emoji 🍜 */}
                        <Utensils size={14} className="text-md-tertiary shrink-0" />
                        <span className="truncate"><b>Quán:</b> {order.resAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* icon MapPin thay emoji 📍 */}
                        <MapPin size={14} className="text-md-primary shrink-0" />
                        <span className="truncate"><b>Khách:</b> {order.custAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-1 flex-wrap gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase leading-none tracking-wider">THU NHẬP SHIP</span>
                      <span className="font-extrabold text-sm md:text-base text-md-tertiary mt-1.5 block leading-none">{formatCurrency(order.fee)}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => orderModal.open(order)}
                        className="px-3 py-2.5 border border-slate-200 text-slate-500 hover:text-md-secondary hover:border-md-secondary rounded-radius-full hover:bg-slate-50 transition-all flex items-center gap-1 font-extrabold text-xs cursor-pointer shadow-sm"
                        title="Chi tiết đơn"
                      >
                        <Eye size={13} />
                        Chi tiết
                      </button>
                      <button
                        onClick={() => handleAcceptJob(order)}
                        className="px-4 py-2.5 bg-md-tertiary hover:bg-opacity-95 text-white font-extrabold text-xs rounded-radius-full shadow-sm hover:scale-[1.05] active:scale-[0.95] hover:shadow-md transition-all flex items-center gap-1 cursor-pointer tracking-wider uppercase"
                      >
                        <Check size={12} className="stroke-[3.5px]" />
                        Nhận đơn
                      </button>
                    </div>
                  </div>
                </div>
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
          <div className="space-y-4 text-xs font-semibold text-slate-700">
            {/* Thông tin Quán & Khách */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-2">
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
                  <p className="text-slate-850"><b>Khách hàng:</b> {orderModal.data.customer} - {orderModal.data.customerPhone}</p>
                  <p className="text-slate-450 text-[10px]">{orderModal.data.custAddress}</p>
                </div>
              </div>
            </div>

            {/* Danh sách món ăn */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase ml-1">
                Danh Sách Món ({orderModal.data.itemsCount})
              </span>
              <div className="max-h-[180px] overflow-y-auto scrollbar-thin">
                {orderModal.data.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <p className="text-slate-700 font-medium">
                      {item.foodName} <span className="text-slate-400">x{item.quantity}</span>
                    </p>
                    <span className="text-slate-700 font-bold">{formatCurrency(Number(item.priceAtOrder || 0) * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thanh toán */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500"><span>Tạm tính</span><span>{formatCurrency(orderModal.data.subtotalAmount)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Phí ship</span><span className="text-md-tertiary font-bold">{formatCurrency(orderModal.data.fee)}</span></div>
              <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                <span className="font-extrabold text-slate-800">Tổng thanh toán</span>
                <span className="font-extrabold text-slate-800">{formatCurrency(orderModal.data.total)}</span>
              </div>
            </div>

            {/* nút nhận đơn */}
            <Button 
              variant="primary" 
              className="w-full !bg-emerald-600 !border-emerald-600 h-10" 
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
