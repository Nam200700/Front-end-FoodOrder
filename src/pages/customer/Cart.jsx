import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  ArrowLeft, MapPin, Map, Phone, Store, XCircle, X, 
  AlertTriangle, Clock, ShoppingBag, CheckSquare, Square, 
  User, Truck, CreditCard, Coins, Trash2, FileText
} from 'lucide-react'; 
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import apiClient from '../../services/api';
import MapModal from '../../components/common/MapModal';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card'; 

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

  //state xóa giỏ hàng
  const [confirmDeleteCart, setConfirmDeleteCart] = useState({ open: false, restaurantId: null, restaurantName: '' });
  
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingCartId, setSubmittingCartId] = useState(null);

  //lưu các quán đã chọn
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);
  const [bulkOrderPayload, setBulkOrderPayload] = useState(null);

  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('');

  // STATE lưu khoảng cách, thời gian và phí ship 
  const [shippingInfos, setShippingInfos] = useState({});
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  useEffect(() => { 
    fetchCart(); 
  }, []);

  useEffect(() => {
    if (deliveryLat && deliveryLng && carts.length > 0) {
      const fetchShippingData = async () => {
        setIsCalculatingShipping(true);
        try {
          const restaurantIds = carts.map(cart => cart.restaurantId);
          const res = await apiClient.get("/shipping/calculate", {
            params: {
              restaurantIds,
              deliveryLat: Number(deliveryLat),
              deliveryLng: Number(deliveryLng)
            }
          });
          const infos = {};
          res.data.data.forEach(item => {
            infos[item.restaurantId] = item;
          });
          setShippingInfos(infos);  
        } catch(err) {
          console.error(`Lỗi khi tính phí ship:`, err.response?.data?.message);
        } finally {
          setIsCalculatingShipping(false);
        }
      };
      fetchShippingData();
    }
  }, [deliveryLat, deliveryLng, carts]);

  const handleConfirmLocation = async (lat, lng, addressName) => {
    setDeliveryLat(lat); 
    setDeliveryLng(lng); 
    setAddress(addressName);
    
    setIsUpdatingLocation(true);
    try {
      await apiClient.put('/users/profile', {
        fullName: fullname.trim() || user?.name,
        address: addressName,
        latitude: Number(lat), 
        longitude: Number(lng)
      });

      updateProfile({ name: fullname.trim(), address, lat: deliveryLat, lng: deliveryLng });
      toast.success('Đã cập nhật vị trí giao hàng!');
    } catch (err) {
      console.error('Lỗi cập nhật vị trí vị trí lên:', err);
      toast.error('Cập nhật vị trí thất bại, vui lòng thử lại!');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleBulkPlaceOrder = () => {
    if (!fullname.trim()) { 
      toast.warning('Vui lòng nhập họ và tên người nhận!'); 
      return; 
    }

    if (!address.trim() || !deliveryLat || !deliveryLng) { 
      toast.warning('Vui lòng chọn địa chỉ giao hàng trên bản đồ!'); 
      return; 
    }

    const currentSelectedCarts = carts.filter(c => selectedRestaurantIds.includes(c.restaurantId));
    if (currentSelectedCarts.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một giỏ hàng để đặt!');
      return;
    }

    if (!paymentMethod.trim()) { 
      toast.warning('Vui lòng chọn phương thức thanh toán!'); 
      return; 
    }

    const payload = {
      deliveryAddress: address,
      restaurantId: selectedRestaurantIds.map(id => parseInt(id)),
      deliveryLat: Number(deliveryLat),
      deliveryLng: Number(deliveryLng),
      paymentMethod: paymentMethod,
      note: orderNotes,
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
          fullName: fullname.trim() || user?.name,
        });
        updateProfile({ name: fullname.trim(), address, lat: deliveryLat, lng: deliveryLng });
      } catch(err) {
        console.warn('Lỗi đồng bộ profile trước khi đặt hàng:', err);
      }

      await apiClient.post("/orders", bulkOrderPayload);

      toast.success('Đặt hàng thành công!');
      setOrderNotes('');
      setSelectedRestaurantIds([]);
      await fetchCart();
      navigate('/orders');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Đã xảy ra lỗi khi đặt hàng. Vui lòng thử lại!');
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

  const isAllSelected = carts.length > 0 && selectedRestaurantIds.length === carts.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRestaurantIds([]);
    } else {
      setSelectedRestaurantIds(carts.map(cart => cart.restaurantId));
    }
  };

  const handleOpenDeleteCartMoDal = (restaurantId, restaurantName) =>
    setConfirmDeleteCart({ open: true, restaurantId, restaurantName });

  const handleDeleteCart = () => {
    clearCartOfRestaurant(confirmDeleteCart.restaurantId);
    setSelectedRestaurantIds(prev => prev.filter(id => id !== confirmDeleteCart.restaurantId));
    setConfirmDeleteCart({ open: false, restaurantId: null, restaurantName: '' });
    toast.success('Đã xóa giỏ hàng thành công!');
  };

  const selectedCarts = carts.filter(c => selectedRestaurantIds.includes(c.restaurantId));
  const totalItems = selectedCarts.reduce((s, c) => s + c.items.reduce((a, i) => a + i.quantity, 0), 0);
  
  const totalSubtotal = selectedCarts.reduce((s, c) => {
    const fee = shippingInfos[c.restaurantId]?.shippingFee || 0;
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
          
          <Button 
            onClick={() => navigate('/')} 
            className="mt-6 w-full sm:w-auto bg-[#ff6b35] hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl border border-[#ff6b35] text-xs uppercase tracking-wider shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Khám phá món ngon ngay
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-5 w-full font-google-sans pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Giỏ Hàng Của Tôi</h1>
        </div>

        <button
          onClick={handleSelectAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all duration-200 shadow-sm cursor-pointer active:scale-95 select-none"
        >
          {isAllSelected ? (
            <CheckSquare size={16} className="text-[#ff6b35]" fill="#ff6b35" stroke="white" />
          ) : (
            <Square size={16} className="text-slate-400" />
          )}
          <span>{isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 space-y-4 w-full">
          {carts.map(cart => {
            const shipInfo = shippingInfos[cart.restaurantId] || { shippingFee: 0, distanceKm: 0, durationMinutes: 0 };
            const shippingFee = shipInfo.shippingFee;
            const distance = shipInfo.distanceKm;
            const duration = shipInfo.durationMinutes;
            
            const cartItemCount = cart.items.reduce((a, i) => a + i.quantity, 0);
            const cartTotal = cart.subtotal + shippingFee;
            const isChecked = selectedRestaurantIds.includes(cart.restaurantId);

            return (
              <Card key={cart.restaurantId} variant="flat" className="!border-slate-200 !rounded-xl">        
                {/* Header quán */}
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
                  
                  <Button 
                    onClick={() => handleOpenDeleteCartMoDal(cart.restaurantId, cart.restaurantName)} 
                    variant="text"
                    size="sm"
                    icon={XCircle}
                    className="!inline-flex items-center gap-1.5 text-xs font-semibold !text-slate-400 hover:!text-red-500 hover:!bg-red-50/70 !px-2.5 !py-1.5 !rounded-lg transition-all duration-200 transform hover:scale-[1.02] cursor-pointer shrink-0 !shadow-none"
                  >
                    Xóa giỏ hàng
                  </Button>
                </div>

                {/* Danh sách món ăn */}
                <div className="divide-y divide-slate-100">
                  {cart.items.map(item => {
                    const lineTotal = item.price * item.quantity;
                    return (
                      <div key={item.cartItemId}>
                        {/* Desktop View Item */}
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
                              <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">Ghi chú:</span>
                              <input type="text" placeholder="Thêm ghi chú cho món ăn này" value={item.note || ''}
                                onChange={(e) => updateNote(item.foodId, e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Mobile View Item */}
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

                          <div className="w-full flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">Ghi chú:</span>
                            <input type="text" placeholder="Thêm ghi chú cho món ăn này" value={item.note || ''}
                              onChange={(e) => updateNote(item.foodId, e.target.value)}
                              className="w-full max-w-md px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer đơn hàng quán */}
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 space-y-3">             
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="space-y-0.5 w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Số lượng món:</span>
                        <span className="font-bold text-xs text-slate-700">{cartItemCount} món</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Tạm tính:</span>
                        <span className="font-bold text-xs text-slate-700">{formatCurrency(cart.subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          Khoảng cách & Thời gian dự kiến:
                        </span>
                        <span className="font-bold text-xs text-slate-700">
                          {isCalculatingShipping ? 'Đang tính...' : `${distance.toFixed(1)} km (~${Math.round(duration)} phút)`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Phí giao hàng:</span>
                        <span className="font-bold text-xs text-slate-700">
                          {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(shippingFee)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 mt-1">
                        <span className="text-xs font-bold text-slate-700">Tổng cộng:</span>
                        <span className="font-extrabold text-sm text-amber-600 md:text-[#ff6b35]">
                          {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(cartTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* CỘT PHẢI: THÔNG TIN GIAO HÀNG & TỔNG QUAN ĐƠN HÀNG */}
        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-5 space-y-4">
          
          {/* THÔNG TIN GIAO HÀNG */}
          <Card variant="flat" className="p-5 !border-slate-200/80 !rounded-2xl space-y-4">
            <div className="flex items-center gap-2 pb-0 border-b border-slate-100">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Truck size={18} className="text-[#ff6b35]" /> Thông tin giao hàng
              </h3>
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
                <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/30 min-h-[56px] flex flex-col justify-center relative">
                  {isUpdatingLocation && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                      <Spinner size="sm" />
                    </div>
                  )}
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {address || 'Chưa chọn địa chỉ giao hàng'}
                  </p>
                </div>
                
                <Button
                  onClick={() => setIsMapOpen(true)}
                  disabled={isUpdatingLocation}
                  variant="outline"
                  icon={Map}
                  className="w-full !text-xs !font-bold !text-[#ff6b35] !bg-orange-50 hover:!bg-orange-100/80 !border-orange-100/70 !py-2.5 !rounded-xl transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-60"
                >
                  Thay đổi vị trí trên bản đồ
                </Button>
              </div>
            </div>
          </Card>

          {/* TỔNG QUAN ĐƠN HÀNG */}
          <Card variant="flat" className="p-4 !border-slate-200 !rounded-xl flex flex-col space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={15} className="text-[#ff6b35]" /> Tổng quan đơn hàng
            </h3>
            
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Số quán đã chọn:</span>
              <span className="font-extrabold text-slate-800">{selectedRestaurantIds.length} / {carts.length}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Tổng số món:</span>
              <span className="font-extrabold text-slate-800">{totalItems} món</span>
            </div>

            {/* --- PHƯƠNG THỨC THANH TOÁN --- */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">
                Phương thức thanh toán
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'COD'
                      ? 'border-[#ff6b35] bg-orange-50 text-[#ff6b35]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Coins size={14} />
                  Tiền mặt
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <FileText size={13} className="text-slate-400" /> Ghi chú đơn hàng
              </label>
              <textarea
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Thêm ghi chú cho đơn hàng"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200 resize-none"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600 pt-1 border-t border-slate-100">
              <span className="font-bold text-slate-700">Tổng thanh toán:</span>
              <span className="font-black text-[#ff6b35] text-lg">
                {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(totalSubtotal)}
              </span>
            </div>

            <Button
              onClick={handleBulkPlaceOrder}
              disabled={selectedRestaurantIds.length === 0 || submittingCartId === 'BULK_ORDER' || isUpdatingLocation || isCalculatingShipping}
              loading={submittingCartId === 'BULK_ORDER'}
              icon={ShoppingBag}
              className="w-full !mt-0 !bg-orange-600 hover:!bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              Đặt Hàng
            </Button>
          </Card>
        </aside>
      </div>

      {/* Modal Confirm Order */}
      <Modal 
        isOpen={showConfirmOrderModal && !!bulkOrderPayload} 
        onClose={() => setShowConfirmOrderModal(false)}
        title="Xác Nhận Đặt Hàng"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
            <Clock size={26} className="animate-pulse" />
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            Hệ thống chuẩn bị gửi đơn đặt hàng tới <span className="font-extrabold text-slate-700">{selectedRestaurantIds.length} quán</span>. Bạn có chắc chắn muốn đặt không?
          </p>

          <div className="flex gap-3 pt-2 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmOrderModal(false)}
              className="w-full !rounded-xl !text-xs !font-bold !py-2.5 cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={executeBulkPlaceOrder}
              className="w-full !rounded-xl !text-xs !font-bold !py-2.5 !bg-orange-600 text-white hover:!bg-orange-700 cursor-pointer"
            >
              Xác nhận đặt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Clear Cart */}
      <Modal 
        isOpen={confirmDeleteCart.open} 
        onClose={() => setConfirmDeleteCart({ open: false, restaurantId: null, restaurantName: '' })}
        title="Xác Nhận Xóa Giỏ Hàng"
        size="sm"
      >
        <div className="text-center space-y-4">          
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            Bạn chắc chắn muốn xóa toàn bộ sản phẩm thuộc giỏ hàng của <span className="font-extrabold text-slate-700">Quán {confirmDeleteCart.restaurantName}</span>? Hành động này không thể hoàn tác.
          </p>

          <div className="flex gap-3 pt-2 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteCart({ open: false, restaurantId: null, restaurantName: '' })}
              className="w-full !rounded-xl !text-xs !font-bold !py-2.5 cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleDeleteCart}
              className="w-full !rounded-xl !text-xs !font-bold !py-2.5 !bg-red-600 text-white hover:!bg-red-700 cursor-pointer"
            >
              Xác nhận xóa
            </Button>
          </div>
        </div>
      </Modal>

      <MapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} onConfirm={handleConfirmLocation} initialLat={deliveryLat} initialLng={deliveryLng} />
    </div>
  );
}