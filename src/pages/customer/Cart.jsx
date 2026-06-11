import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Trash2, MapPin, MessageSquareText, CreditCard, DollarSign, ShoppingCart, Navigation, Map, Phone } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
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

  // VỊ TRÍ GIAO HÀNG THỰC TẾ CỦA KHÁCH HÀNG (Lat, Lng)
  const [deliveryLat, setDeliveryLat] = useState(user?.lat || null);
  const [deliveryLng, setDeliveryLng] = useState(user?.lng || null);

  // States cho Refactoring
  const [confirmClearCartState, setConfirmClearCartState] = useState({ open: false, restaurantId: null, restaurantName: '' });

  // Quản lý ghi chú đơn hàng của từng nhà hàng: { [restaurantId]: noteString }
  const [orderNotes, setOrderNotes] = useState({});
  const [submittingCartId, setSubmittingCartId] = useState(null);

  // Màn hình trung gian đếm ngược 10 giây cho giỏ hàng cụ thể đang đặt
  const [activeOrderCart, setActiveOrderCart] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [showCountdownModal, setShowCountdownModal] = useState(false);

  useEffect(() => {
    fetchCart();
  }, []);

  useEffect(() => {
    let interval = null;
    if (showCountdownModal && countdown > 0 && activeOrderCart) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            executePlaceOrder(activeOrderCart);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showCountdownModal, countdown, activeOrderCart]);

  // Callback xác nhận vị trí từ Leaflet MapModal
  const handleConfirmLocation = (lat, lng, addressName) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    setAddress(addressName);
  };

  const executePlaceOrder = async (cart) => {
    setShowCountdownModal(false);
    setActiveOrderCart(null);
    setSubmittingCartId(cart.restaurantId);

    try {
      // 1. Tự động đồng bộ số điện thoại, địa chỉ nhận hàng lên tài khoản khách hàng trên DB
      try {
        await apiClient.put('/users/profile', {
          fullName: user?.name || 'Khách hàng',
          phone: recipientPhone.trim(),
          address: address,
          latitude: Number(deliveryLat),
          longitude: Number(deliveryLng)
        });
        updateProfile({ phone: recipientPhone.trim(), address: address, lat: deliveryLat, lng: deliveryLng });
      } catch (err) {
        console.warn('Lỗi đồng bộ thông tin khách hàng trước khi đặt:', err);
      }

      // Tính phí ship thật
      let rLat = cart.latitude;
      let rLng = cart.longitude;
      let dist = null;
      if (rLat && rLng && deliveryLat && deliveryLng) {
        dist = calculateHaversineDistance(rLat, rLng, deliveryLat, deliveryLng);
      }
      const shippingFee = dist !== null
        ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000)
        : 15000;

      // 2. Gửi request tạo đơn hàng lên Backend
      const orderReq = {
        deliveryAddress: address,
        deliveryLat: deliveryLat,
        deliveryLng: deliveryLng,
        paymentMethod: 'COD', 
        shippingFee: shippingFee,
        restaurantId: parseInt(cart.restaurantId),
        note: orderNotes[cart.restaurantId] || ''
      };

      const orderResponse = await apiClient.post('/orders', orderReq);
      const newOrder = orderResponse.data.data;

      // Reset note của quán vừa đặt
      setOrderNotes(prev => {
        const copy = { ...prev };
        delete copy[cart.restaurantId];
        return copy;
      });

      // Tải lại giỏ hàng (giỏ hàng vừa đặt đã được xóa trên server nên sẽ tự biến mất)
      await fetchCart();
      setSubmittingCartId(null);
      
      // Chuyển hướng sang trang theo dõi đơn hàng
      navigate(`/orders/${newOrder.orderId || newOrder.id}`);
    } catch (error) {
      console.error('Lỗi khi đặt đơn hàng:', error);
      toast.error(error.response?.data?.message || 'Đã xảy ra lỗi trong quá trình đặt hàng. Vui lòng thử lại!');
      setSubmittingCartId(null);
    }
  };

  const handlePlaceOrder = (cart) => {
    if (!address.trim() || !deliveryLat || !deliveryLng) {
      toast.warning('Vui lòng chọn địa chỉ giao hàng thực tế trên bản đồ trước khi đặt hàng!');
      return;
    }
    if (!recipientPhone.trim()) {
      toast.warning('Vui lòng cung cấp Số điện thoại nhận hàng để shipper liên hệ!');
      return;
    }
    if (recipientPhone.trim().length < 10 || recipientPhone.trim().length > 11) {
      toast.warning('Số điện thoại nhận hàng không hợp lệ (yêu cầu từ 10 - 11 chữ số)!');
      return;
    }
    setCountdown(10);
    setActiveOrderCart(cart);
    setShowCountdownModal(true);
  };

  const handleCancelCountdown = () => {
    setShowCountdownModal(false);
    setActiveOrderCart(null);
    setCountdown(10);
  };

  const handleConfirmImmediately = () => {
    if (activeOrderCart) {
      executePlaceOrder(activeOrderCart);
    }
  };

  const handleClearCartClick = (restaurantId, restaurantName) => {
    setConfirmClearCartState({ open: true, restaurantId, restaurantName });
  };

  const handleClearCartConfirm = () => {
    const { restaurantId } = confirmClearCartState;
    clearCartOfRestaurant(restaurantId);
    setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' });
    toast.success('Đã xóa giỏ hàng của quán thành công!');
  };

  if (loading && carts.length === 0) {
    return <Spinner fullScreen />;
  }

  if (carts.length === 0) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh]">
        <div className="w-20 h-20 bg-md-primary-container/20 text-md-primary rounded-radius-full flex items-center justify-center mb-4">
          <ShoppingCart size={36} />
        </div>
        <h2 className="text-xl font-bold text-md-on-surface">Giỏ hàng của bạn đang trống</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">
          Bạn chưa có món ăn nào trong giỏ hàng. Hãy khám phá ngay các món ăn ngon của MealDash!
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 bg-md-primary text-white font-bold px-6 py-3 rounded-radius-full shadow-shadow-2 hover:scale-105 transition-all text-xs uppercase cursor-pointer"
        >
          Khám phá món ngon
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full font-google-sans pb-24">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl md:text-2xl font-extrabold text-md-on-surface">Giỏ hàng của tôi ({carts.length} quán)</h1>
        </div>
      </div>

      {/* THÔNG TIN GIAO HÀNG CHUNG (ELEVATION 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Card variant="flat" className="p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-md-on-surface-variant uppercase tracking-wider mb-3.5 flex items-center gap-2">
              <MapPin size={16} className="text-md-primary" />
              Địa chỉ nhận hàng thực tế
            </h3>
            <div className="flex items-center gap-3">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Click nút Bản đồ để chọn địa chỉ..."
                className="flex-1 text-xs"
                readOnly
              />
              <Button 
                variant="outline" 
                icon={Map}
                onClick={() => setIsMapOpen(true)}
                className="bg-md-primary/10 text-md-primary border-md-primary/10 hover:bg-md-primary/20 hover:scale-[1.02] cursor-pointer text-xs py-3 px-4 shrink-0"
              >
                Bản đồ
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="flat" className="p-5 border border-slate-200/60 shadow-sm">
          <h3 className="text-xs font-bold text-md-on-surface-variant uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Phone size={16} className="text-md-primary" />
            Số điện thoại nhận hàng *
          </h3>
          <Input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="Số điện thoại shipper liên hệ nhận đồ..."
            className="w-full text-xs"
          />
        </Card>
      </div>

      {/* DANH SÁCH GIỎ HÀNG NHÓM THEO QUÁN */}
      <div className="space-y-10">
        {carts.map((cart) => {
          // Tính khoảng cách Haversine cho từng nhà hàng
          let dist = null;
          let rLat = cart.latitude;
          let rLng = cart.longitude;
          if (rLat && rLng && deliveryLat && deliveryLng) {
            dist = calculateHaversineDistance(rLat, rLng, deliveryLat, deliveryLng);
          }

          const shippingFee = dist !== null
            ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000)
            : 15000;

          const finalTotal = cart.subtotal + shippingFee;
          const isSubmitting = submittingCartId === cart.restaurantId;

          return (
            <Card 
              key={cart.restaurantId}
              variant="flat" 
              className="p-6 border border-slate-200 bg-white shadow-md rounded-radius-xl flex flex-col gap-6 relative"
            >
              {/* Header của nhà hàng */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] bg-md-primary text-white font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                    QUÁN AN
                  </span>
                  <span className="font-extrabold text-base text-slate-800 truncate">{cart.restaurantName}</span>
                </div>
                <button 
                  onClick={() => handleClearCartClick(cart.restaurantId, cart.restaurantName)}
                  className="text-xs font-bold text-red-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  Xóa giỏ hàng này
                </button>
              </div>

              {/* Items của quán này */}
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-3 bg-slate-50 rounded-radius-lg border border-slate-100 relative group transition-all">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-radius-md overflow-hidden shrink-0 border border-slate-200">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0 pr-16">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4>
                          <button 
                            onClick={() => removeItem(item.cartItemId)}
                            className="text-slate-400 hover:text-red-500 transition-colors shrink-0 p-1 hover:scale-105 active:scale-95 cursor-pointer absolute right-3 top-3"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-md-primary block mt-0.5">
                          {formatCurrency(item.price)}
                        </span>
                      </div>

                      {/* Ghi chú món */}
                      <input
                        type="text"
                        placeholder="Ghi chú thêm..."
                        value={item.note || ''}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                        className="w-full text-[10px] bg-transparent border-b border-slate-200 py-0.5 mt-1 focus:outline-none focus:border-md-primary font-medium"
                      />
                    </div>

                    {/* Counter */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 gap-2 h-max self-center shrink-0 shadow-sm">
                      <button 
                        onClick={() => updateQty(item.id, item.quantity, item.quantity - 1)}
                        className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold cursor-pointer text-sm"
                      >
                        -
                      </button>
                      <span className="text-sm font-extrabold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQty(item.id, item.quantity, item.quantity + 1)}
                        className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold cursor-pointer text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Phí ship, ghi chú và thanh toán của quán này */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-5 text-xs font-medium text-slate-600">
                {/* Ghi chú đơn cho quán */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                    <MessageSquareText size={14} className="text-md-primary" />
                    Ghi chú cho tài xế/quán
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Lời nhắn cho quán (ít hành, nhiều ớt...)"
                    value={orderNotes[cart.restaurantId] || ''}
                    onChange={(e) => setOrderNotes(prev => ({ ...prev, [cart.restaurantId]: e.target.value }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-radius-md text-xs focus:outline-none focus:border-md-primary resize-none font-semibold text-slate-700"
                  />
                </div>

                {/* Tóm tắt thanh toán */}
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-slate-800 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-150 pb-1">
                    <span>Tóm tắt thanh toán</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      dist !== null ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {dist !== null ? `${dist.toFixed(1)}km` : 'Chưa định vị'}
                    </span>
                  </span>
                  <div className="flex justify-between">
                    <span>Tiền món ({cart.items.reduce((s, i) => s + i.quantity, 0)} phần):</span>
                    <span className="font-bold text-slate-800">{formatCurrency(cart.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phí ship (Haversine):</span>
                    <span className={`font-bold ${dist === null ? 'text-amber-600' : 'text-slate-800'}`}>
                      {formatCurrency(shippingFee)} {dist === null && '(Tạm tính)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-extrabold text-slate-800">
                    <span>Tổng cộng:</span>
                    <span className="text-md-primary font-black">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                {/* Nút đặt đơn */}
                <div className="flex flex-col justify-end">
                  <Button
                    onClick={() => handlePlaceOrder(cart)}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    size="md"
                    className="w-full text-xs font-black uppercase tracking-wider py-4 shadow-sm hover:scale-[1.01] cursor-pointer"
                  >
                    Đặt đơn quán này • {formatCurrency(finalTotal)}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* MODAL TRUNG GIAN ĐẾM NGƯỢC 10 GIÂY */}
      {showCountdownModal && activeOrderCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-radius-xl p-6 max-w-sm w-full shadow-shadow-5 text-center space-y-5 font-google-sans text-slate-800 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-md-primary/10 text-md-primary flex items-center justify-center mx-auto text-xl font-extrabold animate-pulse">
              ⏱️ {countdown}s
            </div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-slate-800">
                Đang gửi đơn hàng tới "{activeOrderCart.restaurantName}"!
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Bạn có <span className="text-md-primary font-bold">{countdown} giây</span> để thay đổi ý định hoặc hủy đặt đơn hàng này.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancelCountdown}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 rounded-radius-full border border-red-200 text-[10px] uppercase transition-all active:scale-[0.98] cursor-pointer"
              >
                Hủy đặt hàng
              </button>
              <button
                onClick={handleConfirmImmediately}
                className="flex-1 bg-md-primary hover:bg-opacity-95 text-white font-extrabold py-3 rounded-radius-full shadow-md text-[10px] uppercase transition-all active:scale-[0.98] cursor-pointer"
              >
                Đặt ngay 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet MapModal */}
      <MapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={deliveryLat}
        initialLng={deliveryLng}
      />

      <ConfirmDialog
        isOpen={confirmClearCartState.open}
        onClose={() => setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' })}
        onConfirm={handleClearCartConfirm}
        title="Xóa giỏ hàng"
        message={`Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng của "${confirmClearCartState.restaurantName}" không?`}
        confirmLabel="Xóa"
        danger
        loading={loading}
      />

    </div>
  );
}
