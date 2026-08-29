import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import {
  ShoppingBag, RefreshCw, Ban, AlertCircle, MessageSquare, Star, FileText, MapPin, CreditCard, Eye,
  User, Phone, Bike, Wallet, StickyNote, CalendarClock, UtensilsCrossed, Package, BadgeCheck, Clock, Check,
  Store, CheckCircle2, ChevronRight, Receipt, Ticket, ChevronLeft, Search, X, Heart, Home, Sparkles, Users 
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
import { useModalState } from '../../hooks/useModalState';
import { useAuthStore } from '../../stores/authStore';

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

// ─── Thanh tiến trình đơn đang xử lý (kiểu Grab/ShopeeFood) ───
const PROGRESS_STEPS = [
  { key: 'PENDING', label: 'Chờ xác nhận', icon: Clock },
  { key: 'CONFIRMED', label: 'Đã xác nhận', icon: Check },
  { key: 'PREPARING', label: 'Chuẩn bị', icon: UtensilsCrossed },
  { key: 'DELIVERING', label: 'Đang giao', icon: Bike },
  { key: 'COMPLETED', label: 'Hoàn tất', icon: BadgeCheck },
];
// Map trạng thái → chỉ số bước (READY_FOR_PICKUP/PICKED_UP nằm giữa chuẩn bị & giao)
const STEP_INDEX = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY_FOR_PICKUP: 2, PICKED_UP: 3, DELIVERING: 3, COMPLETED: 4 };
const isActiveStatus = (s) => s !== 'COMPLETED' && s !== 'CANCELLED';

// Câu thông báo khi trạng thái đơn đổi (realtime) — hiện toast cho khách
const STATUS_TOAST = {
  CONFIRMED: 'đã được quán xác nhận',
  PREPARING: 'quán đang chuẩn bị món',
  READY_FOR_PICKUP: 'đang chờ tài xế đến lấy',
  PICKED_UP: 'tài xế đã lấy hàng',
  DELIVERING: 'đang trên đường giao đến bạn',
  COMPLETED: 'đã giao thành công',
  CANCELLED: 'đã bị hủy',
};

function OrderProgress({ status }) {
  const current = STEP_INDEX[status] ?? 0;
  const pct = (current / (PROGRESS_STEPS.length - 1)) * 100;
  return (
    <div className="relative pt-1 pb-0.5">
      {/* Đường nền + đường tiến trình cam */}
      <div className="absolute left-3 right-3 top-[15px] h-[3px] bg-slate-100 rounded-full" />
      <div className="absolute left-3 top-[15px] h-[3px] bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-700" style={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }} />
      <div className="relative flex justify-between">
        {PROGRESS_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 min-w-0">
              <span className={`relative w-[26px] h-[26px] rounded-full flex items-center justify-center border-2 transition-all ${
                active ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-200 scale-110'
                  : done ? 'bg-orange-100 border-orange-300 text-orange-600'
                  : 'bg-white border-slate-200 text-slate-300'
              }`}>
                {active && <span className="absolute w-[26px] h-[26px] rounded-full border-2 border-orange-400 animate-halo" />}
                <StepIcon size={12} strokeWidth={2.6} />
              </span>
              <span className={`text-[8.5px] font-bold leading-none text-center ${active ? 'text-orange-600' : done ? 'text-slate-500' : 'text-slate-300'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Empty state GIÀU cho khách chưa có đơn nào (tab "Tất cả") — hướng dẫn 3 bước + lối tắt hữu ích,
// thay cho ô trống đơn điệu. Chỉ dùng khi KHÔNG lọc/không tìm kiếm.
function RichFirstOrderEmpty({ navigate }) {
  const steps = [
    { icon: Search, title: 'Tìm quán & món', desc: 'Duyệt quán gần bạn hoặc tìm đúng món thèm', color: 'bg-orange-100 text-orange-600' },
    { icon: ShoppingBag, title: 'Thêm vào giỏ', desc: 'Chọn món, ghi chú rồi thêm vào giỏ hàng', color: 'bg-blue-100 text-blue-600' },
    { icon: Bike, title: 'Đặt & theo dõi', desc: 'Đặt đơn và theo dõi shipper theo thời gian thực', color: 'bg-emerald-100 text-emerald-600' },
  ];
  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4 text-center animate-rise-in">
      <div className="relative w-20 h-20 mx-auto mb-5">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 opacity-20 blur-md" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF8C42] flex items-center justify-center shadow-lg shadow-orange-500/25">
          <ShoppingBag size={34} className="text-white" />
        </div>
        <Sparkles size={16} className="absolute -right-0.5 -top-0.5 text-amber-400" />
      </div>

      <h3 className="text-lg md:text-xl font-black text-slate-800">Bắt đầu đơn hàng đầu tiên của bạn!</h3>
      <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
        Bạn chưa có đơn nào. Chỉ 3 bước đơn giản là món ngon đến tận cửa.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7 text-left">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <div key={i} className="relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <span className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-black flex items-center justify-center shadow">{i + 1}</span>
              <span className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-2.5`}>
                <StepIcon size={18} />
              </span>
              <p className="text-sm font-extrabold text-slate-800">{s.title}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
        <button
          onClick={() => navigate('/explore')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#FF6B35] hover:bg-orange-600 text-white font-extrabold text-sm px-6 py-3 rounded-full shadow-md shadow-orange-500/25 hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <UtensilsCrossed size={16} /> Khám phá món ngon
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-orange-300 text-slate-700 font-bold text-sm px-6 py-3 rounded-full hover:bg-orange-50 transition-all cursor-pointer"
        >
          <Home size={16} /> Về trang chủ
        </button>
        <button
          onClick={() => navigate('/favorites')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-slate-500 hover:text-rose-500 font-bold text-sm px-4 py-3 transition-colors cursor-pointer"
        >
          <Heart size={16} /> Quán yêu thích
        </button>
      </div>
    </div>
  );
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const {user} = useAuthStore();
  const replaceCart = useCartStore((state) => state.replaceCart);
  const { subscribe, connected } = useWebSocketContext();
  const [activeTab, setActiveTab] = useState('ALL');
  const prevStatusRef = useRef(null); 

  // Các States xử lý dữ liệu và lỗi
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Đếm số đơn theo trạng thái để hiện badge số trên tab (dễ theo dõi)
  const [statusCounts, setStatusCounts] = useState({});
  // Dải tổng quan: tổng đơn, đã giao thành công, tổng chi tiêu (đơn hoàn tất)
  const [summary, setSummary] = useState({ total: 0, completed: 0, spent: 0 });

  // Các States xử lý nghiệp vụ hủy đơn hàng
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Các States xử lý Modal Chi tiết đơn hàng
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 10;

  const detailModal = useModalState(null);
  const cancelModal = useModalState(null);

  const [keywordInput, setKeywordInput] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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
        phone: order.customerPhone,
        voucherCode: order.voucherCode,
        discountAmount: order.discountAmount,
        cancelReason: order.cancelReason,
        // [MỚI] Thông tin đơn đặt nhóm
        groupOrderId: order.groupOrderId || null,
        groupHostId: order.groupHostId || null,
        groupHostName: order.groupHostName || null,
        isGroupOrder: !!order.groupOrderId,
        isGroupHost: !!order.groupOrderId && user?.id != null && String(order.groupHostId) === String(user.id),
      };
    });
  };

  const fetchOrderHistory = useCallback(async (background = false) => {
    if (!background) { setLoading(true); setError(null); }
    try {
      const params = {
        page: page,
        size: pageSize,
        ...(activeTab !== 'ALL' && { status: activeTab }),
        ...(debouncedKeyword.trim() && { keyword: debouncedKeyword.trim() }),
        fromDate: fromDate,
        toDate: toDate
      };
      const response = await apiClient.get('/orders', { params });
      const responseData = response.data?.data || response.data;
      
      setOrders(mapOrders(responseData));
      setTotalPages(responseData?.totalPages || 0);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách đơn hàng:', err);
      if (!background) setError(err);
    } finally {
      if (!background) setLoading(false);
    }
  }, [activeTab, page, debouncedKeyword, fromDate, toDate]);

  useEffect(() => {
    setPage(0);
  }, [activeTab]);

  useEffect(() => {
    setPage(0);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keywordInput);
      setPage(0); 
    }, 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const syncOrders = useCallback(async (alert) => {
    try {
      const res = await apiClient.get('/orders', { params: { size: 1000 } });
      const all = res.data?.data?.content || res.data?.data || [];
      const counts = { ALL: all.length };
      let spent = 0, completed = 0;
      const statusMap = {};
      all.forEach((o) => {
        counts[o.orderStatus] = (counts[o.orderStatus] || 0) + 1;
        statusMap[o.orderId] = o.orderStatus;
        if (o.orderStatus === 'COMPLETED') { completed++; spent += Number(o.totalAmount || 0); }
      });
      setStatusCounts(counts);
      setSummary({ total: all.length, completed, spent });

      const prev = prevStatusRef.current;
      if (alert && prev) {
        all.forEach((o) => {
          const before = prev[o.orderId];
          if (before && before !== o.orderStatus && STATUS_TOAST[o.orderStatus]) {
            const msg = `Đơn #${o.orderId} ${STATUS_TOAST[o.orderStatus]}`;
            if (o.orderStatus === 'COMPLETED') toast.success(msg);
            else if (o.orderStatus === 'CANCELLED') toast.warn(msg);
            else toast.info(msg);
          }
        });
      }
      prevStatusRef.current = statusMap;
    } catch (err) {
      console.error('Lỗi đồng bộ đơn hàng:', err);
    }
  }, []);

  // Đồng bộ số liệu + baseline mỗi khi danh sách đổi (không toast cho thao tác cục bộ)
  useEffect(() => { syncOrders(false); }, [orders, syncOrders]);

  // REALTIME tức thì qua WebSocket: quán/shipper đổi trạng thái là đơn tự cập nhật, khỏi reload
  useEffect(() => {
    const sub = subscribe('/user/queue/notify', () => { syncOrders(true); fetchOrderHistory(true); });
    return () => { if (sub) sub.unsubscribe(); };
  }, [subscribe, syncOrders, fetchOrderHistory]);

  // Poll dự phòng 15s (khi tab mở) + kiểm tra ngay khi quay lại tab — WS rớt vẫn cập nhật
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) { syncOrders(true); fetchOrderHistory(true); } }, 15000);
    const onVisible = () => { if (!document.hidden) { syncOrders(true); fetchOrderHistory(true); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [syncOrders, fetchOrderHistory]);

  // Hủy đơn hàng
  const handleCancelOrder = async () => {
    const orderIdToCancel = cancelModal.data; 
    if (!cancelReasonInput.trim()) {
      toast.error('Vui lòng nhập hoặc chọn lý do hủy!');
      return;
    }

    setSubmittingCancel(true);
    try {
      await apiClient.patch(`/orders/${orderIdToCancel}/cancel`, {
        reason: cancelReasonInput.trim()
      });
      toast.success(`Đã hủy thành công đơn hàng #${orderIdToCancel}!`);
      cancelModal.close(); 
      setCancelReasonInput('');
      fetchOrderHistory(); 
    } catch (err) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng này.');
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
    navigate('/cart', { state: { targetRestaurantId: order.restaurantId } });
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500"><ShoppingBag size={20} /></span>
            Đơn Hàng Của Tôi
          </h1>
          {/* <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${
              connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title={connected ? 'Đơn hàng tự cập nhật theo thời gian thực' : 'Mất kết nối realtime — vẫn tự làm mới mỗi 15 giây'}
          >
            <span className="relative flex h-2 w-2">
              {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
            {connected ? 'Cập nhật trực tiếp' : 'Tự làm mới'}
          </span> */}
        </div>

        {/* Dải tổng quan: tổng đơn · đã giao · tổng chi tiêu.
            Mobile: 2 ô nhỏ cùng hàng, ô "Đã chi tiêu" tràn cả hàng để số tiền không bị cắt. */}
        {/* <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3 mb-5">
          {[
            { icon: Receipt, label: 'Tổng đơn', value: summary.total, cls: 'text-slate-700', bg: 'bg-slate-100 text-slate-500' },
            { icon: CheckCircle2, label: 'Đã giao', value: summary.completed, cls: 'text-emerald-600', bg: 'bg-emerald-100 text-emerald-600' },
            { icon: Wallet, label: 'Đã chi tiêu', value: formatCurrency(summary.spent), cls: 'text-orange-500', bg: 'bg-orange-100 text-orange-500', wide: true },
          ].map((st, i) => {
            const SIcon = st.icon;
            return (
              <div
                key={i}
                className={`group bg-white rounded-2xl border border-slate-100 shadow-sm p-3 md:p-4 flex items-center gap-2.5 md:gap-3 animate-rise-in transition-all hover:-translate-y-0.5 hover:shadow-md ${st.wide ? 'col-span-2 md:col-span-1' : ''}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${st.bg}`}><SIcon size={18} /></span>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">{st.label}</p>
                  <p className={`font-black leading-tight truncate ${st.wide ? 'text-lg md:text-lg' : 'text-lg md:text-xl'} ${st.cls}`}>{st.value}</p>
                </div>
              </div>
            );
          })}
        </div> */}

        <div className="mb-3 overflow-x-auto scrollbar-none touch-pan-x">
          <FilterTabs
            tabs={ORDER_STATUS_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={statusCounts}
            className="min-w-max gap-2.5 !flex-nowrap [&_button]:text-center [&_button]:!py-2 [&_button]:!px-4 [&_button]:text-xs [&_button]:md:text-sm [&_button]:font-bold [&_button]:!rounded-lg [&_button]:whitespace-nowrap [&_button]:!border-transparent [&_button]:cursor-pointer"
            activeClassName="!bg-orange-500 !text-white !border-orange-500 shadow-sm"
          />
        </div>

        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative w-full sm:w-80 sm:shrink-0">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Tìm mã đơn, tên quán, món ăn"
              className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 shadow-sm transition-all"
            />
            {keywordInput && (
              <button
                type="button"
                onClick={() => setKeywordInput('')}
                title="Xoá tìm kiếm"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-orange-500 text-slate-600 shadow-sm transition-all"
              title="Từ ngày"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-orange-500 text-slate-600 shadow-sm transition-all"
              title="Đến ngày"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                title="Xóa bộ lọc ngày"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[600px] w-full flex flex-col justify-between">
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
            debouncedKeyword.trim() ? (
              <div className="flex justify-center items-center py-12">
                <EmptyState
                  title="Không tìm thấy đơn khớp"
                  message={`Không có đơn nào khớp với "${debouncedKeyword.trim()}". Thử từ khoá khác nhé.`}
                  icon={Search}
                  actionText="Xóa tìm kiếm"
                  onAction={() => setKeywordInput('')}
                />
              </div>
            ) : activeTab === 'ALL' ? (
              <RichFirstOrderEmpty navigate={navigate} />
            ) : (
              <div className="flex justify-center items-center py-12">
                <EmptyState
                  title="Chưa có đơn ở mục này"
                  message={`Bạn chưa có đơn hàng nào ở trạng thái "${ORDER_STATUS_TABS.find(t => t.id === activeTab)?.label}".`}
                  icon={ShoppingBag}
                  actionText="Xem tất cả đơn"
                  onAction={() => setActiveTab('ALL')}
                />
              </div>
            )
          ) : (
            <div className="space-y-6">
              {/* Lưới danh sách đơn hàng */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {list.map((order, idx) => (
                  <Card
                    key={order.id}
                    variant="flat"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={`animate-rise-in !border-slate-100 border-l-4 ${STATUS_ACCENT[order.status] || 'border-l-slate-200'} shadow-sm p-4 md:p-5 flex flex-col gap-4 group hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200 !rounded-2xl cursor-pointer`}
                  >
                    {/* Card Header: tên quán + mã đơn + ngày · pill trạng thái có icon */}
                    <div className="flex flex-row justify-between items-start gap-3 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-800 text-sm md:text-[15px] flex items-center gap-1.5 truncate">
                          <Store size={15} className="text-orange-500 shrink-0" />
                          <span className="truncate">{order.restaurantName || 'Nhà hàng'}</span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                          <span className="font-bold text-slate-500">MÃ ĐƠN #{order.id}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                          <span className="inline-flex items-center gap-1 whitespace-nowrap"><CalendarClock size={11} /> {order.createdAt}</span>
                          {order.isGroupOrder && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                              <Users size={10} /> {order.isGroupHost ? 'Đơn nhóm' : `Đơn nhóm · Chủ nhóm: ${order.groupHostName || 'N/A'}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const SIcon = STATUS_ICON[order.status] || Clock;
                        const moving = order.status === 'DELIVERING';
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] sm:text-[11px] shrink-0 ${getStatusStyles(order.status)}`}>
                            <SIcon size={12} className={moving ? 'animate-bob' : ''} style={moving ? { transformBox: 'fill-box', transformOrigin: 'center' } : undefined} /> {getStatusLabel(order.status)}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Đơn đã huỷ: nêu rõ lý do để khách hiểu (đỡ phải hỏi hỗ trợ) */}
                    {order.status === 'CANCELLED' && order.cancelReason && (
                      <div className="flex items-start gap-2 text-[11px] text-rose-600 bg-rose-50/60 border border-rose-100 rounded-lg px-3 py-2 -mt-1">
                        <Ban size={13} className="shrink-0 mt-0.5" />
                        <span><span className="font-bold">Lý do huỷ:</span> {order.cancelReason}</span>
                      </div>
                    )}

                    {/* Thanh tiến trình cho đơn đang xử lý */}
                    {isActiveStatus(order.status) && (
                      <div onClick={(e) => e.stopPropagation()} className="bg-orange-50/40 border border-orange-100 rounded-xl px-3 pt-2 pb-2.5">
                        <OrderProgress status={order.status} />
                        <button
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                        >
                          Theo dõi đơn hàng <ChevronRight size={13} />
                        </button>
                      </div>
                    )}

                    {/* Nhắc đánh giá: đơn đã giao thành công nhưng khách chưa đánh giá */}
                    {order.status === 'COMPLETED' && !order.reviewed && (!order.isGroupOrder || order.isGroupHost) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${order.id}`); }}
                        className="group/rate w-full flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-100 rounded-xl px-3 py-2.5 text-left hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <span className="relative w-8 h-8 rounded-lg bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
                          <span className="absolute inset-0 rounded-lg bg-amber-300/60 animate-halo" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                          <Star size={16} className="relative fill-amber-400 text-amber-400 animate-bob" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] sm:text-xs font-extrabold text-slate-700">Món ăn thế nào? Đánh giá ngay!</p>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <Star key={i} size={13} className="text-amber-300 group-hover/rate:fill-amber-400 group-hover/rate:text-amber-400 transition-colors" style={{ transitionDelay: `${i * 45}ms` }} />
                            ))}
                            <span className="text-[10px] text-slate-400 font-semibold ml-1.5 hidden sm:inline">Chia sẻ trải nghiệm giúp quán tốt hơn</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="text-amber-400 shrink-0 group-hover/rate:translate-x-0.5 transition-transform" />
                      </button>
                    )}

                    {/* Danh sách món ăn */}
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
                          (!order.isGroupOrder || order.isGroupHost) ? (
                            <Button
                              type="button"
                              onClick={(e) => cancelModal.open(order.id)}
                              icon={Ban}
                              className="!px-2.5 !py-1.5 !bg-red-500 hover:!bg-red-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm flex-1 sm:flex-none sm:w-auto"
                            >
                              Hủy đơn
                            </Button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 italic px-2">
                              Chỉ chủ nhóm mới hủy được đơn này
                            </span>
                          )
                        ) : (
                          <>
                            {order.status === 'COMPLETED' && (
                            <>
                              {/* Mua lại: ai cũng được (chỉ thêm vào giỏ của chính họ) */}
                              <Button
                                type="button"
                                onClick={(e) => handleReorder(e, order)}
                                icon={RefreshCw}
                                className="!px-2.5 !py-1.5 !bg-orange-500 hover:!bg-orange-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm whitespace-nowrap flex-1 sm:flex-none sm:w-auto"
                              >
                                Mua lại
                              </Button>

                              {/* Đánh giá: đơn nhóm thì chỉ chủ nhóm mới thấy nút này */}
                              {(!order.isGroupOrder || order.isGroupHost) && (
                                order.reviewed ? (
                                  <Button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/reviews/${order.id}`);
                                    }}
                                    icon={Star}
                                    className="!px-2.5 !py-1.5 !bg-slate-100 !text-slate-500 !border-none !rounded-lg text-[11px] !font-bold !shadow-none whitespace-nowrap flex-1 sm:flex-none sm:w-auto cursor-not-allowed flex items-center justify-center gap-1"
                                  >
                                    Đã đánh giá
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
                                )
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
                            className="!px-2.5 !py-1.5 !bg-orange-500 hover:!bg-orange-600 text-white !rounded-lg text-[11px] !font-bold !shadow-sm whitespace-nowrap flex-1 sm:flex-none sm:w-auto"
                          >
                            Mua lại
                          </Button>
                        )}

                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            detailModal.open(order);
                          }}
                          icon={Eye}
                          className="!px-2.5 !py-1.5 !bg-blue-500 hover:!bg-blue-600 !text-white !border-none !rounded-lg text-[11px] !font-bold !shadow-none whitespace-nowrap flex-1 sm:flex-none sm:w-auto"
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

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

      {/* MODAL CHI TIẾT ĐƠN HÀNG  */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        title={`Chi Tiết Đơn Hàng #${detailModal.data?.id}`}
        size="lg"
      >
        {detailModal.data && (() => {
          const o = detailModal.data;
          const StatusIcon = STATUS_ICON[o.status] || Clock;
          const payLabel = o.paymentMethod === 'VNPAY' ? 'Chuyển khoản VNPAY' : 'Thanh toán khi nhận hàng (COD)';
          const hasDiscount = o.discountAmount && Number(o.discountAmount) > 0;

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

                  {o.voucherCode && (
                    <div className="flex justify-between items-center text-sm font-medium pt-1">
                      <span className="inline-flex items-center gap-1.5 text-orange-600">
                        Giảm giá từ voucher
                      </span>
                      <span className="text-rose-600 font-bold">-{formatCurrency(o.discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-orange-200">
                    <span className="text-sm font-extrabold text-slate-800">Tổng thanh toán</span>
                    <span className="text-orange-500 text-xl font-extrabold">{formatCurrency(o.total)} </span>
                  </div>
                </div>
              </div>

              {/* Hành động: Mua lại (đơn xong/huỷ) + Đóng */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={detailModal.close}
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
        isOpen={cancelModal.isOpen}
        onClose={cancelModal.close}
        title={`Xác Nhận Hủy Đơn Hàng #${cancelModal.data}`}
        size="sm"
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