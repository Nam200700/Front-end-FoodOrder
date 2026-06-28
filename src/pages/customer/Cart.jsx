import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Trash2, MapPin, ShoppingCart, Map, Phone, Store, XCircle, X, AlertTriangle, Clock, ShoppingBag } from 'lucide-react'; 
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import MapModal from '../../components/common/MapModal';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';

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
      <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center font-google-sans min-h-screen bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-orange-50 text-md-primary rounded-full flex items-center justify-center mb-5 border border-orange-100 shadow-inner animate-bounce">
            <ShoppingBag size={36} className="text-[#ff6b35]" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Giỏ hàng của bạn đang trống</h2>
          <button 
            onClick={() => navigate('/')} 
            className="mt-6 w-full sm:w-auto bg-[#ff6b35] hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl border border-[#ff6b35] text-xs uppercase tracking-wider shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Khám phá món ngon ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-5 w-full font-google-sans pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold text-slate-800">Giỏ hàng của tôi</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 space-y-4 w-full">
          {carts.map(cart => {
            let dist = null;
            if (cart.latitude && cart.longitude && deliveryLat && deliveryLng)
              dist = calculateHaversineDistance(cart.latitude, cart.longitude, deliveryLat, deliveryLng);
            const shippingFee = dist !== null ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000) : 15000;
            const isSubmitting = submittingCartId === cart.restaurantId;

            return (
              <div key={cart.restaurantId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                
                {/* ── Header quán ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-md-primary/10 text-md-primary rounded-lg shrink-0">
                      <Store size={16} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-sm text-slate-800 truncate" title={cart.restaurantName}>
                        Quán {cart.restaurantName}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleClearCartClick(cart.restaurantId, cart.restaurantName)} 
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50/70 px-2.5 py-1.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] cursor-pointer shrink-0"
                  >
                    <XCircle size={14} />
                    <span>Xóa giỏ hàng</span>
                  </button>
                </div>

                {/* Danh sách món ăn */}
                <div className="divide-y divide-slate-100">
                  {cart.items.map(item => {
                    const lineTotal = item.price * item.quantity;
                    return (
                      <div key={item.cartItemId}>
                        
                        {/* ── 1. GIAO DIỆN LAPTOP ── */}
                        <div className="hidden md:flex p-4 hover:bg-slate-50/30 transition-colors flex-row gap-4 items-center">
                          <div className="w-[72px] h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>

                          <div className="flex-1 w-full flex flex-col gap-3">
                            <div className="flex flex-row justify-between items-center gap-4 w-full">
                              <div className="w-2/5 min-w-0">
                                <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2" title={item.name}>
                                  {item.name}
                                </p>
                              </div>

                              <div className="flex flex-1 items-center justify-between gap-8">
                                <div className="min-w-[70px]">
                                  <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Đơn giá</span>
                                  <span className="text-xs font-semibold text-slate-600">{formatCurrency(item.price)}</span>
                                </div>

                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] font-medium text-slate-400 block mb-1">Số lượng</span>
                                  
                                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 p-0.5 shadow-none">
                                    <button 
                                      onClick={() => updateQty(item.foodId, item.quantity, item.quantity - 1)} 
                                      className="w-6 h-6 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all duration-150 text-xs cursor-pointer active:scale-95 shadow-none"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center font-extrabold text-xs text-slate-800 select-none">{item.quantity}</span>
                                    <button 
                                      onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)} 
                                      className="w-6 h-6 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all duration-150 text-xs cursor-pointer active:scale-95 shadow-none"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                <div className="text-right min-w-[80px]">
                                  <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Tổng</span>
                                  <span className="text-sm font-extrabold text-[#ff6b35]">{formatCurrency(lineTotal)}</span>
                                </div>

                                <div className="flex items-center justify-center">
                                  <button onClick={() => removeItem(item.cartItemId)} 
                                    className="p-1.5 rounded-full bg-transparent hover:bg-red-50 text-slate-400 hover:text-red-500 border border-transparent hover:border-red-100 transition-all duration-200 cursor-pointer">
                                    <X size={15} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/*Ghi chú*/}
                            <div className="w-full flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider w-[72px]">Ghi chú:</span>
                              <input type="text" placeholder="Thêm ghi chú cho món ăn này" value={item.note || ''}
                                onChange={(e) => updateNote(item.foodId, e.target.value)}
                                className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:outline-none focus:border-md-primary text-slate-600 placeholder:text-[10px] placeholder:text-slate-400/80 transition-all focus:bg-white"/>
                            </div>
                          </div>
                        </div>

                        {/* ── 2. GIAO DIỆN RESPONSIVE MOBILE ── */}
                        <div className="flex md:hidden p-4 flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-start gap-3 w-full">
                            
                            {/* Hình ảnh*/}
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>

                            {/* tên món*/}
                            <div className="flex-1 min-w-0 flex flex-col justify-between h-20 py-0.5">
                              <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                                {item.name}
                              </p>
                              
                              {/*nút số lượng */}
                              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 p-0.5 shadow-none w-fit">
                                <button 
                                  onClick={() => updateQty(item.foodId, item.quantity, item.quantity - 1)} 
                                  className="w-7 h-7 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all duration-150 text-sm cursor-pointer active:scale-95 shadow-none"
                                >
                                  -
                                </button>
                                <span className="w-9 text-center font-extrabold text-sm text-slate-800 select-none">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)} 
                                  className="w-7 h-7 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all duration-150 text-sm cursor-pointer active:scale-95 shadow-none"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Cột phải */}
                            <div className="text-right flex flex-col justify-between h-20 min-w-[90px] relative pr-7">
                              <button onClick={() => removeItem(item.cartItemId)} className="absolute top-0 right-0 p-0.5 text-slate-400 hover:text-red-500 transition-colors">
                                <X size={16} strokeWidth={2.5} />
                              </button>

                              <div className="mt-0.5">
                                <span className="text-[11px] font-medium text-slate-500 block">Đơn giá</span>
                                <span className="text-xs font-bold text-slate-700">{formatCurrency(item.price)}</span>
                              </div>

                              <div className="mb-0.5">
                                <span className="text-[11px] font-medium text-slate-500 block">Tổng</span>
                                <span className="text-xs font-black text-orange-600">{formatCurrency(lineTotal)}</span>
                              </div>
                            </div>
                          </div>

                          {/*Ghi chú*/}
                          <div className="w-full flex items-center gap-2 pt-1 border-t border-dashed border-slate-100">
                            <span className="text-xs font-bold text-slate-500 shrink-0">Ghi chú</span>
                            <input type="text" placeholder="Thêm ghi chú..." value={item.note || ''}
                              onChange={(e) => updateNote(item.foodId, e.target.value)}
                              className="flex-1 px-2.5 py-1 text-[11px] border border-slate-300 rounded-md bg-white focus:outline-none focus:border-orange-500 text-slate-700 placeholder:text-slate-400/80 transition-all"/>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Footer quán */}
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="space-y-0.5">
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Số lượng sản phẩm:</span>
                        <span className="font-extrabold text-sm text-amber-600 md:text-[#ff6b35]">{totalItems}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Tổng cộng:</span>
                        <span className="font-extrabold text-sm text-amber-600 md:text-[#ff6b35]">{formatCurrency(totalSubtotal)}</span>
                      </div>
                    </div>
                    <Button onClick={() => handlePlaceOrder(cart)} loading={isSubmitting} disabled={isSubmitting} size="sm"
                      className="text-xs font-bold uppercase tracking-wide px-4 py-2.5 cursor-pointer rounded transition-all duration-200 hover:bg-orange-600 hover:shadow-md active:scale-95">
                      THANH TOÁN NGAY
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL ĐẾM NGƯỢC ĐƠN HÀNG ── */}
      {showCountdownModal && activeOrderCart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100 space-y-4 transform scale-100 transition-transform">
            <div className="relative w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Clock size={26} className="animate-pulse" />
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full text-[10px] px-1.5 py-0.5 font-black shadow-sm">
                {countdown}s
              </span>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-black text-base text-slate-800">Xác nhận đặt đơn hàng</h3>
              <p className="text-xs text-slate-500 px-2">
                Hệ thống chuẩn bị gửi đơn đến <span className="font-bold text-slate-700">"Quán {activeOrderCart.restaurantName}"</span>. Bạn có thể bấm hủy trong thời gian đếm ngược.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setShowCountdownModal(false); setActiveOrderCart(null); setCountdown(10); }} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
              >
                Hủy đơn
              </button>
              <button 
                onClick={() => activeOrderCart && executePlaceOrder(activeOrderCart)} 
                className="flex-1 bg-md-primary hover:bg-md-primary/95 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-md-primary/20 transition cursor-pointer active:scale-95"
              >
                Đặt ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XÓA GIỎ HÀNG ── */}
      {confirmClearCartState.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all">
            <div className="p-6 flex gap-4 items-start">
              <div className="p-3 bg-red-50 text-red-500 rounded-2xl border border-red-100 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <h3 className="font-black text-base text-slate-800">Xóa toàn bộ giỏ hàng?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bạn có chắc muốn dọn sạch tất cả các món ăn của <span className="font-bold text-slate-700">Quán {confirmClearCartState.restaurantName}</span> ra khỏi giỏ?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3.5 flex justify-end gap-2.5 border-t border-slate-100">
              <button 
                onClick={() => setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleClearCartConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20 transition-all cursor-pointer active:scale-95"
              >
                Xác nhận 
              </button>
            </div>
          </div>
        </div>
      )}

      <MapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} onConfirm={handleConfirmLocation} initialLat={deliveryLat} initialLng={deliveryLng} />
    </div>
  );
}