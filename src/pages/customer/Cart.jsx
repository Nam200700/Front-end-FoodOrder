import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Trash2, MapPin, ShoppingCart, Map, Phone } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import MapModal from '../../components/common/MapModal';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function Cart() {
  const navigate = useNavigate();
  const { carts, loading, fetchCart, updateQty, removeItem, updateNote, clearCartOfRestaurant } = useCartStore();
  const { user, updateProfile } = useAuthStore();

  const [address, setAddress] = useState(user?.address || '');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [deliveryLat, setDeliveryLat] = useState(user?.lat || null);
  const [deliveryLng, setDeliveryLng] = useState(user?.lng || null);

  const [confirmClearCartState, setConfirmClearCartState] = useState({ open: false, restaurantId: null, restaurantName: '' });
  const [orderNotes, setOrderNotes] = useState({});
  const [submittingCartId, setSubmittingCartId] = useState(null);

  const [activeOrderCart, setActiveOrderCart] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [showCountdownModal, setShowCountdownModal] = useState(false);

  useEffect(() => { fetchCart(); }, []);

  useEffect(() => {
    let interval = null;
    if (showCountdownModal && countdown > 0 && activeOrderCart) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(interval); executePlaceOrder(activeOrderCart); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showCountdownModal, countdown, activeOrderCart]);

  const handleConfirmLocation = (lat, lng, addressName) => {
    setDeliveryLat(lat); setDeliveryLng(lng); setAddress(addressName);
  };

  const executePlaceOrder = async (cart) => {
    setShowCountdownModal(false); setActiveOrderCart(null); setSubmittingCartId(cart.restaurantId);
    try {
      try {
        await apiClient.put('/users/profile', { fullName: user?.name || 'Khách hàng', phone: recipientPhone.trim(), address, latitude: Number(deliveryLat), longitude: Number(deliveryLng) });
        updateProfile({ phone: recipientPhone.trim(), address, lat: deliveryLat, lng: deliveryLng });
      } catch (err) { console.warn('Lỗi đồng bộ:', err); }

      let dist = null;
      if (cart.latitude && cart.longitude && deliveryLat && deliveryLng)
        dist = calculateHaversineDistance(cart.latitude, cart.longitude, deliveryLat, deliveryLng);
      const shippingFee = dist !== null ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000) : 15000;

      const orderResponse = await apiClient.post('/orders', {
        deliveryAddress: address, deliveryLat, deliveryLng, paymentMethod: 'COD',
        shippingFee, restaurantId: parseInt(cart.restaurantId), note: orderNotes[cart.restaurantId] || ''
      });
      const newOrder = orderResponse.data.data;
      setOrderNotes(prev => { const copy = { ...prev }; delete copy[cart.restaurantId]; return copy; });
      await fetchCart();
      setSubmittingCartId(null);
      navigate(`/orders/${newOrder.orderId || newOrder.id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại!');
      setSubmittingCartId(null);
    }
  };

  const handlePlaceOrder = (cart) => {
    if (!address.trim() || !deliveryLat || !deliveryLng) { toast.warning('Vui lòng chọn địa chỉ giao hàng trên bản đồ!'); return; }
    if (!recipientPhone.trim()) { toast.warning('Vui lòng nhập số điện thoại nhận hàng!'); return; }
    if (recipientPhone.trim().length < 10 || recipientPhone.trim().length > 11) { toast.warning('Số điện thoại không hợp lệ (10–11 chữ số)!'); return; }
    setCountdown(10); setActiveOrderCart(cart); setShowCountdownModal(true);
  };

  const handleClearCartClick = (restaurantId, restaurantName) =>
    setConfirmClearCartState({ open: true, restaurantId, restaurantName });

  const handleClearCartConfirm = () => {
    clearCartOfRestaurant(confirmClearCartState.restaurantId);
    setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' });
    toast.success('Đã xóa giỏ hàng thành công!');
  };

  const totalItems = carts.reduce((s, c) => s + c.items.reduce((a, i) => a + i.quantity, 0), 0);
  const totalSubtotal = carts.reduce((s, c) => {
    let dist = null;
    if (c.latitude && c.longitude && deliveryLat && deliveryLng)
      dist = calculateHaversineDistance(c.latitude, c.longitude, deliveryLat, deliveryLng);
    const fee = dist !== null ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000) : 15000;
    return s + c.subtotal + fee;
  }, 0);

  if (loading && carts.length === 0) return <Spinner fullScreen />;

  if (carts.length === 0) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh]">
        <div className="w-20 h-20 bg-md-primary-container/20 text-md-primary rounded-full flex items-center justify-center mb-4">
          <ShoppingCart size={36} />
        </div>
        <h2 className="text-xl font-bold text-md-on-surface">Giỏ hàng của bạn đang trống</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">
          Bạn chưa có món ăn nào trong giỏ hàng. Hãy khám phá các món ăn ngon của MealDash!
        </p>
        <button onClick={() => navigate('/')} className="mt-6 bg-md-primary text-white font-bold px-6 py-3 rounded-full border border-md-primary text-xs uppercase cursor-pointer">
          Khám phá món ngon
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 w-full font-google-sans pb-24 bg-slate-50 min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-extrabold text-slate-800">Giỏ hàng của tôi</h1>
      </div>

      {/* ── Thông tin giao hàng ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin size={13} className="text-md-primary" /> Địa chỉ nhận hàng
          </p>
          <div className="flex gap-2">
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Chọn địa chỉ trên bản đồ…" className="flex-1 text-sm" readOnly />
            <button onClick={() => setIsMapOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-md-primary border border-md-primary/30 bg-md-primary/5 rounded-lg hover:bg-md-primary/10 transition cursor-pointer shrink-0">
              <Map size={14} /> Bản đồ
            </button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Phone size={13} className="text-md-primary" /> Số điện thoại nhận hàng
          </p>
          <Input type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="Số điện thoại shipper liên hệ…" className="w-full text-sm" />
        </div>
      </div>

      {/* ── Layout danh sách giỏ hàng ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6 w-full">
          {carts.map(cart => {
            let dist = null;
            if (cart.latitude && cart.longitude && deliveryLat && deliveryLng)
              dist = calculateHaversineDistance(cart.latitude, cart.longitude, deliveryLat, deliveryLng);
            const shippingFee = dist !== null ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000) : 15000;
            const isSubmitting = submittingCartId === cart.restaurantId;

            return (
              <div key={cart.restaurantId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Header quán */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-md-primary text-white font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">QUÁN ĂN</span>
                    <span className="font-extrabold text-base text-slate-800">{cart.restaurantName}</span>
                  </div>
                  <button onClick={() => handleClearCartClick(cart.restaurantId, cart.restaurantName)} className="text-xs font-semibold text-red-500 hover:underline cursor-pointer">
                    Xóa giỏ hàng này
                  </button>
                </div>

                {/* Danh sách món ăn được thiết kế bám sát hình mẫu 925021.png */}
                <div className="divide-y divide-slate-100">
                  {cart.items.map(item => {
                    const lineTotal = item.price * item.quantity;
                    return (
                      <div key={item.cartItemId} className="p-5 hover:bg-slate-50/40 transition-colors flex flex-col md:flex-row gap-4 items-start">
                        
                        {/* 1. Hình ảnh món ăn phóng to nằm riêng biệt bên trái */}
                        <div className="w-28 h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 mx-auto md:mx-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>

                        {/* 2. Khối nội dung bên phải nằm ngang hàng với hình ảnh */}
                        <div className="flex-1 w-full flex flex-col justify-between min-h-[112px] gap-3">
                          
                          {/* HÀNG 1: Tên món, Đơn giá, Số lượng, Tổng cộng, Nút xóa */}
                          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-4 items-center w-full">
                            
                            {/* Tên món ăn */}
                            <div className="min-w-0 text-center md:text-left">
                              <p className="font-bold text-slate-800 text-base leading-snug line-clamp-2" title={item.name}>
                                {item.name}
                              </p>
                            </div>

                            {/* Đơn giá */}
                            <div className="text-center">
                              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Đơn giá</span>
                              <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.price)}</span>
                            </div>

                            {/* Bộ tăng giảm số lượng */}
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-[11px] font-medium text-slate-400 block mb-1">Số lượng</span>
                              <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden">
                                <button onClick={() => updateQty(item.cartItemId, item.quantity, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition">-</button>
                                <span className="w-8 text-center font-bold text-xs text-slate-800">{item.quantity}</span>
                                <button onClick={() => updateQty(item.cartItemId, item.quantity, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition">+</button>
                              </div>
                            </div>

                            {/* Tổng cộng */}
                            <div className="text-center md:text-right">
                              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Tổng cộng</span>
                              <span className="text-sm font-bold text-orange-600">{formatCurrency(lineTotal)}</span>
                            </div>

                            {/* Nút xóa */}
                            <div className="flex justify-center md:pl-2">
                              <button onClick={() => removeItem(item.cartItemId)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* HÀNG 2: Ghi chú nhỏ gọn nằm ngay bên dưới phần thông tin */}
                          <div className="w-full flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-slate-500">Ghi chú</span>
                            <input
                              type="text"
                              placeholder=""
                              value={item.note || ''}
                              onChange={e => updateNote(item.cartItemId, e.target.value)}
                              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-md-primary text-slate-600 placeholder:text-slate-400 transition-all focus:bg-white"
                            />
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer quán */}
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span>Số lượng sản phẩm:</span>
                        <span className={`font-bold ${dist === null ? 'text-amber-600' : 'text-slate-700'}`}>{totalItems}</span>
                      </div>
                      <div className="flex gap-2">
                        <span>Tổng cộng:</span>
                        <span className={`font-bold ${dist === null ? 'text-amber-600' : 'text-slate-700'}`}>{formatCurrency(totalSubtotal)}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePlaceOrder(cart)}
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      size="sm"
                      className="text-xs font-black uppercase tracking-wider px-5 py-3 cursor-pointer"
                    >
                      THANH TOÁN NGAY
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal đếm ngược ── */}
      {showCountdownModal && activeOrderCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-5 font-google-sans">
            <div className="w-16 h-16 rounded-full bg-md-primary/10 text-md-primary flex items-center justify-center mx-auto text-xl font-extrabold">
              ⏱️ {countdown}s
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">Đang gửi đơn đến "{activeOrderCart.restaurantName}"</h3>
              <p className="text-xs text-slate-500 mt-1">Bạn có <span className="text-md-primary font-bold">{countdown} giây</span> để hủy đặt hàng.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCountdownModal(false); setActiveOrderCart(null); setCountdown(10); }} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 rounded-full border border-red-200 text-[10px] uppercase transition cursor-pointer">
                Hủy đặt hàng
              </button>
              <button onClick={() => activeOrderCart && executePlaceOrder(activeOrderCart)} className="flex-1 bg-md-primary text-white font-extrabold py-3 rounded-full text-[10px] uppercase transition cursor-pointer hover:opacity-95">
                Đặt ngay 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      <MapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} onConfirm={handleConfirmLocation} initialLat={deliveryLat} initialLng={deliveryLng} />

      <ConfirmDialog
        isOpen={confirmClearCartState.open}
        onClose={() => setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' })}
        onConfirm={handleClearCartConfirm}
        title="Xóa giỏ hàng"
        message={`Bạn có chắc muốn xóa toàn bộ giỏ hàng của "${confirmClearCartState.restaurantName}"?`}
        confirmLabel="Xóa"
        danger
        loading={loading}
      />
    </div>
  );
}