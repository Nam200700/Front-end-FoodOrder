import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList, ShoppingBag, Check, X, Ban, Eye, Clock, AlertCircle,
  User, Phone, MapPin, Bike, Wallet, StickyNote, CalendarClock, UtensilsCrossed, Package, BadgeCheck,
  Bell, Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Sparkles, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/format';
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

const PENDING_AUTO_CANCEL_MS = 5 * 60 * 1000;

// Đồng hồ đếm ngược tự huỷ cho đơn chờ xác nhận — nhắc owner xác nhận trước khi hệ thống huỷ.
function AutoCancelCountdown({ createdAtMs }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, (createdAtMs || 0) + PENDING_AUTO_CANCEL_MS - Date.now())
  );
  useEffect(() => {
    if (!createdAtMs) return;
    const tick = () => setRemaining(Math.max(0, createdAtMs + PENDING_AUTO_CANCEL_MS - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAtMs]);

  if (!createdAtMs) return null;
  const totalSec = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const expired = remaining <= 0;
  const urgent = remaining <= 30000; // ≤30s → đỏ, nhấp nháy

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:py-1 rounded-full border shrink-0 ${
        expired
          ? 'bg-slate-100 text-slate-500 border-slate-200'
          : urgent
          ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
      title="Đơn tự động huỷ nếu quán không xác nhận kịp"
    >
      <Clock size={12} className="shrink-0" />
      {expired ? 'Đang tự huỷ…' : `Tự huỷ sau ${mm}:${String(ss).padStart(2, '0')}`}
    </span>
  );
}

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
  // Đã tải dữ liệu lần đầu chưa — dùng để chỉ chạy animation "bay lên" cho lần tải đầu,
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Đếm số đơn theo từng trạng thái để hiện badge trên tab 
  const [statusCounts, setStatusCounts] = useState({});

  const [actionLoadingId, setActionLoadingId] = useState(null);

  // STATE PHÂN TRANG & TÌM KIẾM
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;
  const [keywordInput, setKeywordInput] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // State lý do từ chối đơn hàng 
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // STATE CHI TIẾT ĐƠN HÀNG MODAL
  const detailModal = useModalState();
  const [loadingDetail, setLoadingDetail] = useState(false);

  // STATE HỦY ĐƠN HÀNG MODAL
  const cancelModal = useModalState();

  const { subscribe, connected } = useWebSocketContext();

  // ─── HỖ TRỢ KHÔNG BỎ SÓT ĐƠN: báo động đơn mới + auto-refresh ───
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('merchant-order-sound') !== 'off');
  const [newOrderIds, setNewOrderIds] = useState(new Set()); 
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevPendingIdsRef = useRef(null); 
  const audioCtxRef = useRef(null);

  useEffect(() => { localStorage.setItem('merchant-order-sound', soundOn ? 'on' : 'off'); }, [soundOn]);

  // Xin quyền hiện thông báo trình duyệt (để owner thấy đơn mới cả khi đang ở tab khác)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Tiếng "ting" báo đơn mới (Web Audio — không cần file âm thanh)
  const playBeep = useCallback(() => {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || (audioCtxRef.current = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [880, 1175].forEach((freq, i) => { // 2 nốt cho dễ nhận biết
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.18;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.18);
      });
    } catch { /* bỏ qua nếu trình duyệt chặn */ }
  }, [soundOn]);

  // Báo động 1 đơn mới: chuông + toast + thông báo trình duyệt (khi ở tab khác)
  const alertNewOrder = useCallback((o) => {
    playBeep();
    toast.info(`Đơn mới #${o.orderId}${o.customerName ? ` từ ${o.customerName}` : ''} · ${formatCurrency(Number(o.totalAmount || 0))}`, { autoClose: 6000 });
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try {
        const n = new Notification('🔔 Đơn hàng mới', {
          body: `Đơn #${o.orderId}${o.customerName ? ` · ${o.customerName}` : ''} · ${formatCurrency(Number(o.totalAmount || 0))}`,
          tag: `order-${o.orderId}`,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* ignore */ }
    }
  }, [playBeep]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keywordInput);
      setPage(0); 
    }, 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // Reset về trang 0 khi đổi tab
  useEffect(() => {
    setPage(0);
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

  // Lấy danh sách đơn hàng của quán.
  const fetchOrders = useCallback(async (background = false) => {
    if (!restaurantId) return;
    try {
      if (!background) setLoading(true);
      const response = await apiClient.get('/merchant/orders', 
        { 
          params: {
            restaurantId: restaurantId,
            status: activeTab === 'ALL' ? undefined : activeTab,
            keyword: debouncedKeyword.trim() || undefined,
            page: page,
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
            image: getFoodImageUrl(i.foodImageUrl)
          })),
          total: Number(ord.totalAmount),
          createdAt: formatDateTime(ord.createdAt),
          createdAtMs: ord.createdAt ? new Date(ord.createdAt).getTime() : null, 
          phone: ord.customerPhone,
          status: ord.orderStatus,
          shipper: ord.shipperName ? `${ord.shipperName} (${ord.shipperPhone || ''})` : null
        };
      });
      setOrders(mapped);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách đơn hàng:', err);
      if (!background) {
        toast.error(err.response?.data?.message || 'Lỗi tải danh sách đơn hàng');
        setOrders([]);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [restaurantId, activeTab, page, debouncedKeyword]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Đếm số đơn theo trạng thái + PHÁT HIỆN ĐƠN MỚI (so baseline id đơn chờ).
  const watchPending = useCallback(async (alert) => {
    if (!restaurantId) return;
    try {
      // Endpoint nhẹ: đếm tab bằng GROUP BY + danh sách đơn chờ rút gọn (thay vì tải cả nghìn đơn).
      const res = await apiClient.get('/merchant/orders/monitor', { params: { restaurantId } });
      const data = res.data?.data || {};
      setStatusCounts(data.counts || {});
      setLastUpdated(new Date());

      const pending = data.pending || []; // [{ orderId, customerName, totalAmount }]
      const pendingIds = pending.map((o) => o.orderId);
      const prev = prevPendingIdsRef.current;
      if (alert && prev !== null) {
        const fresh = pending.filter((o) => !prev.includes(o.orderId));
        if (fresh.length) {
          fresh.forEach(alertNewOrder);
          setNewOrderIds((s) => {
            const n = new Set(s);
            fresh.forEach((o) => n.add(o.orderId.toString()));
            return n;
          });
          // Nhãn "MỚI" tự tắt sau 2 phút nếu owner chưa thao tác
          fresh.forEach((o) => setTimeout(() => {
            setNewOrderIds((s) => { const n = new Set(s); n.delete(o.orderId.toString()); return n; });
          }, 120000));
          fetchOrders(true); // làm mới ngầm danh sách đang xem để đơn mới hiện ngay, không hiện skeleton
        }
      }
      prevPendingIdsRef.current = pendingIds;
    } catch (err) {
      console.error('Lỗi theo dõi đơn mới:', err);
    }
  }, [restaurantId, fetchOrders, alertNewOrder]);

  // Đồng bộ số đếm mỗi khi danh sách đổi (không kêu chuông cho thao tác cục bộ)
  useEffect(() => { watchPending(false); }, [orders, watchPending]);

  useEffect(() => {
    if (!restaurantId) return;
    const intervalMs = connected ? 30000 : 10000;
    const id = setInterval(() => {
      if (!document.hidden) { watchPending(true); fetchOrders(true); }
    }, intervalMs);
    return () => clearInterval(id);
  }, [restaurantId, watchPending, fetchOrders, connected]);

  // Kiểm tra ngay khi owner quay lại tab —
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) { watchPending(true); fetchOrders(true); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [watchPending, fetchOrders]);

  // Realtime tức thì qua WebSocket (khi hoạt động) 
  useEffect(() => {
    if (!restaurantId) return;
    const destination = `/user/queue/notify`;
    const sub = subscribe(destination, () => { watchPending(true); fetchOrders(true); });
    return () => { if (sub) sub.unsubscribe(); };
  }, [restaurantId, fetchOrders, subscribe, watchPending]);

  // Xác nhận đơn hàng
  const handleConfirm = async (e, orderId) => {
    e.stopPropagation();
    setActionLoadingId(orderId);
    try {
      await apiClient.patch(`/merchant/orders/${orderId}/confirm`);
      toast.success(`Đã xác nhận thành công đơn hàng #${orderId}`);
      setNewOrderIds((s) => { const n = new Set(s); n.delete(orderId.toString()); return n; });
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

  // mode: 'reject' = từ chối đơn PENDING ; 'cancel' = hủy đơn đã xác nhận (CONFIRMED/PREPARING)
  const [cancelMode, setCancelMode] = useState('reject');
  const handleOpenCancelModal = (e, orderId, mode = 'reject') => {
    e.stopPropagation();
    setCancelMode(mode);
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
      if (cancelMode === 'cancel') {
        await apiClient.patch(`/merchant/orders/${orderIdToCancel}/cancel`, {
          reason: cancelReasonInput.trim()
        });
        toast.success(`Đã hủy đơn #${orderIdToCancel}. Khách được đền voucher; điểm uy tín quán bị trừ.`);
      } else {
        await apiClient.patch(`/merchant/orders/${orderIdToCancel}/reject`, {
          rejectReason: cancelReasonInput.trim()
        });
        toast.success(`Đã từ chối thành công đơn hàng #${orderIdToCancel}`);
      }
      setNewOrderIds((s) => { const n = new Set(s); n.delete(orderIdToCancel.toString()); return n; });
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
        {/* Header: tiêu đề + trạng thái realtime + chuông + làm mới */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-5">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-600/10 text-blue-600"><ClipboardList size={20} /></span>
            Quản Lý Đơn Hàng
          </h1>
          <div className="flex items-center gap-2">
            {/* Trạng thái realtime */}
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${
                connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
              title={connected ? 'Đang nhận đơn theo thời gian thực' : 'Mất kết nối realtime — vẫn tự làm mới ngầm mỗi 10 giây'}
            >
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span className="relative flex h-2 w-2">
                {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </span>
              {connected ? 'Trực tuyến' : 'Ngoại tuyến'}
            </span>
            {/* Bật/tắt chuông báo đơn mới */}
            <button
              onClick={() => setSoundOn((v) => !v)}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all cursor-pointer ${
                soundOn ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title={soundOn ? 'Đang bật chuông báo đơn mới — bấm để tắt' : 'Đang tắt chuông — bấm để bật'}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            {/* Làm mới thủ công — thao tác chủ động của owner nên vẫn cho hiện loading để có phản hồi rõ ràng */}
            <button
              onClick={() => { fetchOrders(); watchPending(true); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới danh sách đơn"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
            </button>
          </div>
        </div>

        {(statusCounts.PENDING || 0) > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-3.5 md:p-4 shadow-sm animate-rise-in">
            <span className="relative shrink-0 w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Bell size={20} className="animate-bob" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-white text-[9px] font-black items-center justify-center flex">{statusCounts.PENDING}</span>
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-800">Bạn có {statusCounts.PENDING} đơn đang chờ xác nhận</p>
              <p className="text-[11px] text-slate-500 font-medium">Xác nhận sớm để khách không phải chờ lâu — giữ trải nghiệm tốt.</p>
            </div>
            {activeTab !== 'PENDING' && (
              <Button variant="primary" size="sm" onClick={() => setActiveTab('PENDING')} className="!bg-amber-500 hover:!bg-amber-600 shrink-0 rounded-lg text-xs !py-2">
                Xem ngay
              </Button>
            )}
          </div>
        )}

        {/* THANH TAB TRẠNG THÁI VÀ Ô TÌM KIẾM BÊN */}
        <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="overflow-x-auto scrollbar-none w-full md:w-auto">
            <FilterTabs
              tabs={ORDER_STATUS_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={statusCounts}
              className="flex flex-row !flex-nowrap whitespace-nowrap [&_div]:flex [&_div]:flex-row [&_div]:flex-nowrap [&_button]:shrink-0 [&_button.bg-md-primary]:!bg-blue-600 [&_button.bg-md-primary]:!text-white [&_button.bg-md-primary]:!shadow-blue-100"
            />
          </div>

          {/* Ô tìm kiếm góc phải */}
          <div className="relative min-w-[240px] md:w-72 shrink-0">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Tìm theo mã đơn, tên khách hàng"
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400 shadow-sm transition-all"
            />
            {keywordInput && (
              <button
                type="button"
                onClick={() => setKeywordInput('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
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
              {orders.map((order, idx) => {
                const isNew = newOrderIds.has(order.id);
                const shouldAnimate = !hasLoadedOnce || isNew;
                return (
                <div
                  key={order.id}
                  onClick={() => handleViewDetails(order.id)}
                  style={shouldAnimate ? { animationDelay: `${idx * 60}ms` } : undefined}
                  className={`${shouldAnimate ? 'animate-rise-in' : ''} bg-white rounded-xl border border-l-4 ${STATUS_ACCENT[order.status] || 'border-l-slate-200'} shadow-sm p-4 md:p-5 flex flex-col gap-4 cursor-pointer group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    isNew ? 'border-amber-300 ring-2 ring-amber-300/60 shadow-amber-100' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex flex-row justify-between items-center gap-2 border-b border-slate-100 pb-3 flex-wrap sm:flex-nowrap">
                    <div className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-wide whitespace-nowrap shrink-0 flex items-center gap-2">
                      <span>MÃ ĐƠN <span className="text-slate-900 font-extrabold">#{order.id}</span></span>
                      {isNew && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm animate-pulse">
                          <Sparkles size={10} /> Mới
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                      {order.status === 'PENDING' && <AutoCancelCountdown createdAtMs={order.createdAtMs} />}
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
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Ban}
                            disabled={actionLoadingId === order.id}
                            onClick={(e) => handleOpenCancelModal(e, order.id, 'cancel')}
                            className="w-full sm:w-auto !py-2.5 rounded-lg text-xs"
                          >
                            Hủy đơn
                          </Button>
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
                        </>
                      )}

                      {order.status === 'PREPARING' && (
                        <>
                          {order.shipper && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-3 py-2 rounded-lg shrink-0">
                              <Bike size={13} /> Shipper: {order.shipper}
                            </span>
                          )}
                          {/* <Button 
                            variant="danger" 
                            size="sm" 
                            icon={Ban}
                            disabled={actionLoadingId === order.id}
                            onClick={(e) => handleOpenCancelModal(e, order.id, 'cancel')}
                            className="w-full sm:w-auto !py-2.5 rounded-lg text-xs"
                          >
                            Hủy đơn
                          </Button> */}
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}

              {/* KHUNG PHÂN TRANG */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200/60 mt-6">
                  <button
                    onClick={() => setPage(Math.max(page - 1, 0))}
                    disabled={page === 0}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                  >
                    <ChevronLeft size={16} /> 
                  </button>
                  <span className="text-xs font-bold text-slate-500 mr-1">Trang {page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(Math.min(page + 1, totalPages - 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                  >
                    <ChevronRight size={16} />
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
        title={`${cancelMode === 'cancel' ? 'Xác Nhận Hủy Đơn Hàng' : 'Xác Nhận Từ Chối Đơn Hàng'} #${cancelModal.data}`}
        size="sm"
      >
        <div className="space-y-4 text-slate-700">
          <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium border border-rose-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={15} />
            <span>{cancelMode === 'cancel'
              ? 'Lưu ý: Hủy đơn Đã xác nhận sẽ Trừ điểm uy tín của quán và khách được đền voucher.'
              : 'Lưu ý: Hành động từ chối đơn hàng sẽ hủy giao dịch của khách hàng ngay lập tức.'}</span>
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
              {cancelMode === 'cancel' ? 'Xác nhận hủy đơn' : 'Xác nhận từ chối'}
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
                  <CalendarClock size={14} /> Đặt lúc {formatDateTime(d.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  {status === 'PENDING' && d.createdAt && (
                    <AutoCancelCountdown createdAtMs={new Date(d.createdAt).getTime()} />
                  )}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${pill.bg} ${pill.text}`}>
                    <PillIcon size={13} /> {getStatus(status)}
                  </span>
                </div>
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

              {/* Địa chỉ giao hàng*/}
              <div className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-sm text-slate-600">
                <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="break-words"><span className="font-semibold text-slate-700">Địa chỉ giao:</span> {d.deliveryAddress}</span>
              </div>

              {/* Danh sách món ăn*/}
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
                  <Button variant="secondary" size="sm" icon={Package}
                    loading={busy} disabled={busy}
                    onClick={(e) => handleReady(e, orderId)}
                    className="rounded-lg text-xs !py-2 !bg-[#34A853] hover:!bg-[#2E8B49]">
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