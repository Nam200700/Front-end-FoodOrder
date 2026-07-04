import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, MapPin, Map, Phone, Store, XCircle, X, AlertTriangle, Clock, ShoppingBag, CheckSquare, Square, User, Truck } from 'lucide-react'; 
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
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
  const [phone, setPhone] = useState(user?.phone || '');
  const [fullname, setFullname] = useState(user?.name || '');
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [deliveryLat, setDeliveryLat] = useState(user?.lat || null);
  const [deliveryLng, setDeliveryLng] = useState(user?.lng || null);

  const [confirmClearCartState, setConfirmClearCartState] = useState({ open: false, restaurantId: null, restaurantName: '' });
  const [orderNotes, setOrderNotes] = useState({});
  const [submittingCartId, setSubmittingCartId] = useState(null);

  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);
  const [bulkOrderPayload, setBulkOrderPayload] = useState(null);

  useEffect(() => { 
    fetchCart(); 
  }, []);

  const handleConfirmLocation = (lat, lng, addressName) => {
    setDeliveryLat(lat); 
    setDeliveryLng(lng); 
    setAddress(addressName);
  };

  const handleBulkPlaceOrder = () => {
    if (!address.trim() || !deliveryLat || !deliveryLng) { 
      toast.warning('Vui lòng chọn địa chỉ giao hàng trên bản đồ!'); 
      return; 
    }
    if (!phone.trim()) { 
      toast.warning('Vui lòng nhập số điện thoại nhận hàng!'); 
      return; 
    }

    const currentSelectedCarts = carts.filter(c => selectedRestaurantIds.includes(c.restaurantId));
    if (currentSelectedCarts.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một giỏ hàng để đặt!');
      return;
    }

    const firstCartNote = orderNotes[currentSelectedCarts[0].restaurantId] || '';

    const payload = {
      deliveryAddress: address,
      restaurantId: selectedRestaurantIds.map(id => parseInt(id)),
      deliveryLat: Number(deliveryLat),
      deliveryLng: Number(deliveryLng),
      paymentMethod: 'COD',
      note: firstCartNote,
    };

    setBulkOrderPayload(payload);
    setShowConfirmOrderModal(true);
  };

  const executeBulkPlaceOrder = async () => {
    if (!bulkOrderPayload) return;
  
    setSubmittingCartId('BULK_ORDER'); 
    setShowConfirmOrderModal(false);

    try {
      try {
        await apiClient.put('/users/profile', {
          fullname: fullname.trim() || user?.name,
          phone: phone.trim(),
          address,
          latitude: Number(deliveryLat), 
          longitude: Number(deliveryLng)
        });
        updateProfile({ phone: phone.trim(), address, lat: deliveryLat, lng: deliveryLng });
      } catch(err) {
        console.warn('Lỗi đồng bộ profile:', err);
      }

      await apiClient.post("/orders", bulkOrderPayload);

      toast.success('Đặt hàng thành công!');
      setOrderNotes({});
      setSelectedRestaurantIds([]);
      await fetchCart();
      navigate('/orders');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Đã xảy ra lỗi khi đặt hàng loạt. Vui lòng thử lại!');
    } finally {
      setSubmittingCartId(null);
      setBulkOrderPayload(null);
    }
  };

  const handleToggleSelectRestaurant = (restaurantId) => {
    setSelectedRestaurantIds(prev => 
      prev.includes(restaurantId) ? prev.filter(id => id !== restaurantId) : [...prev, restaurantId]
    );
  };

  const handleOpenDeleteCartMoDal = (restaurantId, restaurantName) =>
    setConfirmClearCartState({ open: true, restaurantId, restaurantName });

  const handleDeleteCart = () => {
    clearCartOfRestaurant(confirmClearCartState.restaurantId);
    setSelectedRestaurantIds(prev => prev.filter(id => id !== confirmClearCartState.restaurantId));
    setConfirmClearCartState({ open: false, restaurantId: null, restaurantName: '' });
    toast.success('Đã xóa giỏ hàng thành công!');
  };

  const selectedCarts = carts.filter(c => selectedRestaurantIds.includes(c.restaurantId));
  const totalItems = selectedCarts.reduce((s, c) => s + c.items.reduce((a, i) => a + i.quantity, 0), 0);
  
  const totalSubtotal = selectedCarts.reduce((s, c) => {
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
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-5 border border-orange-100 shadow-inner animate-bounce">
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Giỏ Hàng Của Tôi</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 space-y-4 w-full">
          {carts.map(cart => {
            let dist = null;
            if (cart.latitude && cart.longitude && deliveryLat && deliveryLng)
              dist = calculateHaversineDistance(cart.latitude, cart.longitude, deliveryLat, deliveryLng);
            const shippingFee = dist !== null ? Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000) : 15000;
            
            const cartItemCount = cart.items.reduce((a, i) => a + i.quantity, 0);
            const cartTotal = cart.subtotal + shippingFee;
            const isChecked = selectedRestaurantIds.includes(cart.restaurantId);

            return (
              <div key={cart.restaurantId} className="bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-200 border-slate-200">                
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => handleToggleSelectRestaurant(cart.restaurantId)}
                      className="text-md-primary hover:scale-105 transition-transform cursor-pointer"
                    >
                      {isChecked ? (
                        <CheckSquare size={20} className="text-[#ff6b35]" fill="#ff6b35" stroke="white" />
                      ) : (
                        <Square size={20} className="text-slate-300" />
                      )}
                    </button>

                    <div className="p-1.5 bg-md-primary/10 text-md-primary rounded-lg shrink-0">
                      <Store size={16} className="text-[#ff6b35]" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-sm text-slate-800 truncate" title={cart.restaurantName}>
                        Quán {cart.restaurantName}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleOpenDeleteCartMoDal(cart.restaurantId, cart.restaurantName)} 
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50/70 px-2.5 py-1.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] cursor-pointer shrink-0"
                  >
                    <XCircle size={14} />
                    <span>Xóa giỏ hàng</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {cart.items.map(item => {
                    const lineTotal = item.price * item.quantity;
                    return (
                      <div key={item.cartItemId}>
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
                                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 p-0.5">
                                    <button 
                                      onClick={() => updateQty(item.foodId, item.quantity, item.quantity - 1)} 
                                      className="w-6 h-6 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-xs cursor-pointer active:scale-95"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center font-extrabold text-xs text-slate-800 select-none">{item.quantity}</span>
                                    <button 
                                      onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)} 
                                      className="w-6 h-6 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-xs cursor-pointer active:scale-95"
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

                            <div className="w-full flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider w-[72px]">Ghi chú:</span>
                              <input type="text" placeholder="Thêm ghi chú cho món ăn này" value={item.note || ''}
                                onChange={(e) => updateNote(item.foodId, e.target.value)}
                                className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/50 focus:outline-none focus:border-md-primary text-slate-600 placeholder:text-[10px] placeholder:text-slate-400/80 transition-all focus:bg-white"/>
                            </div>
                          </div>
                        </div>

                        <div className="flex md:hidden p-4 flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-start gap-3 w-full">
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between h-20 py-0.5">
                              <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                                {item.name}
                              </p>
                              
                              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 p-0.5 w-fit">
                                <button 
                                  onClick={() => updateQty(item.foodId, item.quantity, item.quantity - 1)} 
                                  className="w-7 h-7 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-sm cursor-pointer active:scale-95"
                                >
                                  -
                                </button>
                                <span className="w-9 text-center font-extrabold text-sm text-slate-800 select-none">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)} 
                                  className="w-7 h-7 flex items-center justify-center rounded-md font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-sm cursor-pointer active:scale-95"
                                >
                                  +
                                </button>
                              </div>
                            </div>

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

                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="space-y-0.5">
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Số lượng món:</span>
                        <span className="font-extrabold text-sm text-slate-700">{cartItemCount}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Tạm tính:</span>
                        <span className="font-bold text-xs text-slate-700">{formatCurrency(cart.subtotal)}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Phí ship:</span>
                        <span className="font-bold text-xs text-slate-700">{formatCurrency(shippingFee)}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-slate-500">Tổng cộng:</span>
                        <span className="font-extrabold text-sm text-amber-600 md:text-[#ff6b35]">{formatCurrency(cartTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              {/* SỬA TẠI ĐÂY: Thay MapPin thành Truck */}
              <Truck size={18} className="text-[#ff6b35]" />
              <h2 className="text-sm font-black text-slate-800 tracking-tight">THÔNG TIN GIAO HÀNG</h2>
            </div>
            
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" /> Người nhận
                </label>
                <input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Nhập tên người nhận"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" /> Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  readOnly
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" /> Địa chỉ nhận hàng
                </label>
                <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/30 min-h-[56px] flex flex-col justify-center">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {address || 'Chưa chọn địa chỉ giao hàng'}
                  </p>
                </div>
                
                <button
                  onClick={() => setIsMapOpen(true)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#ff6b35] bg-orange-50 hover:bg-orange-100/80 border border-orange-100/70 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <Map size={14} /> Thay đổi vị trí trên bản đồ
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <ShoppingBag size={15} className="text-[#ff6b35]" /> Tổng quan đơn hàng
            </h3>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
              <span>Số quán đã chọn:</span>
              <span className="font-extrabold text-slate-800">{selectedRestaurantIds.length} / {carts.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
              <span>Tổng số món:</span>
              <span className="font-extrabold text-slate-800">{totalItems} món</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600 pt-2 border-t border-slate-100 mb-4">
              <span className="font-bold text-slate-700">Tổng thanh toán:</span>
              <span className="font-black text-[#ff6b35] text-lg">{formatCurrency(totalSubtotal)}</span>
            </div>

            <Button
              onClick={handleBulkPlaceOrder}
              disabled={selectedRestaurantIds.length === 0 || submittingCartId === 'BULK_ORDER'}

              className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {submittingCartId === 'BULK_ORDER' ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <ShoppingBag className="h-5 w-5" />
              )}
              Đặt Hàng
            </Button>
          </div>
        </aside>
      </div>

      {showConfirmOrderModal && bulkOrderPayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100 space-y-4">
            <div className="relative w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Clock size={26} className="animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-black text-base text-slate-800">Xác nhận đặt đơn hàng</h3>
              <p className="text-xs text-slate-500 px-2">
                Hệ thống chuẩn bị gửi đơn đặt hàng tới <span className="font-bold text-slate-700">{selectedRestaurantIds.length} quán</span> đã chọn. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>

            <div className="flex gap-3 pt-2 justify-center">
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
                onClick={() => {
                  setShowConfirmOrderModal(false);
                  setBulkOrderPayload(null);
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2 cursor-pointer"
                onClick={executeBulkPlaceOrder}
              >
                Xác nhận đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClearCartState.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
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
                onClick={handleDeleteCart}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-sm transition-all cursor-pointer active:scale-95"
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