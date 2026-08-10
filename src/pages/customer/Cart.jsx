import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import {
  ArrowLeft, MapPin, Phone, Store, XCircle, X,
  ShoppingBag, CheckSquare, Square,
  User, Truck, Edit2, Plus, Tag,
  Minus, Wallet, BadgePercent, Bike, ShieldCheck, Receipt, Clock, ChevronRight, StickyNote, Check, Sparkles,
  Search, Heart, Package, Ticket, Gift, AlertCircle, Trash2, AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import Modal from '../../components/common/Modal';
import Card from '../../components/common/Card'; 
import { useModalState } from '../../hooks/useModalState';
import MapModal2 from '../../components/common/Map';
import { formatDateTime} from '../../utils/format';

// Nhận diện loại voucher: icon + màu riêng cho FREESHIP / PERCENT / FIXED
const VOUCHER_TYPE_META = {
  FREESHIP: { icon: Truck, label: 'Miễn phí ship', chip: 'bg-teal-100 text-teal-700', strip: 'bg-teal-400', value: 'text-teal-700', grad: 'from-teal-400 to-emerald-500', anim: 'animate-wiggle' },
  PERCENT: { icon: BadgePercent, label: 'Giảm theo %', chip: 'bg-orange-100 text-[#ff6b35]', strip: 'bg-[#ff6b35]', value: 'text-[#ff6b35]', grad: 'from-amber-400 to-[#ff6b35]', anim: 'animate-bob' },
  FIXED: { icon: Wallet, label: 'Giảm tiền mặt', chip: 'bg-blue-100 text-blue-700', strip: 'bg-blue-400', value: 'text-blue-700', grad: 'from-blue-400 to-indigo-500', anim: 'animate-float' },
};
const vmeta = (t) => VOUCHER_TYPE_META[t] || VOUCHER_TYPE_META.FIXED;

// Bán kính giao hàng tối đa hệ thống hỗ trợ (km)
const MAX_DELIVERY_DISTANCE_KM = 10;

// Trạng thái hạn dùng: sắp hết hạn (≤3 ngày) để nhắc khách dùng sớm
const expiryInfo = (dateVal) => {
  if (!dateVal) return { days: null, soon: false, expired: false };
  const days = Math.ceil((new Date(dateVal).getTime() - Date.now()) / 86400000);
  return { days, soon: days >= 0 && days <= 3, expired: days < 0 };
};

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();

  const { carts, loading, fetchCart, updateQty, removeItem, updateNote, clearCartOfRestaurant, shippingInfos, isCalculatingShipping, fetchShippingFees } = useCartStore();
  const { user, updateProfile } = useAuthStore();

  // thông tin giao hàng
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [fullname, setFullname] = useState(user?.name || '');

  const [deliveryLat, setDeliveryLat] = useState(user?.lat || null);
  const [deliveryLng, setDeliveryLng] = useState(user?.lng || null);

  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // lưu các quán đã chọn
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);
  const [bulkOrderPayload, setBulkOrderPayload] = useState(null);

  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('COD');

  const confirmOrderModal = useModalState(); // Modal đặt hàng
  const deleteCartModal = useModalState({ restaurantId: null, restaurantName: '' }); // Modal xóa giỏ hàng
  const orderSummaryModal = useModalState(); // Modal xem/sửa nhanh thông tin đơn hàng trên mobile
  const mobileDeliveryInfoModal = useModalState(); // Modal sửa "Thông tin giao hàng" (người nhận/địa chỉ) trên mobile

  // id truyền từ RestaurantDetail.jsx
  const targetRestaurantId = location.state?.targetRestaurantId;

  // Các state và modal quản lý địa chỉ 
  const addressListModal = useModalState(); 
  const mapModal2 = useModalState(); 
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [editingAddressId, setEditingAddressId] = useState(null); 
  const [addressLabel, setAddressLabel] = useState('Nhà riêng');
  const [mapInitialCoords, setMapInitialCoords] = useState({ 
    lat: user?.lat || 10.762622, 
    lng: user?.lng || 106.660172 
  });

  // --- STATE QUẢN LÝ VOUCHER THEO TỪNG QUÁN ---
  const voucherModal = useModalState();
  const [activeVoucherTab, setActiveVoucherTab] = useState('my'); 
  const [myVouchers, setMyVouchers] = useState([]);
  const [publicVouchers, setPublicVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  // Map lưu voucher đã chọn cho từng quán: { [restaurantId]: userVoucherObject }
  const [selectedVouchers, setSelectedVouchers] = useState({});
  // ID nhà hàng hiện đang chọn voucher trong Modal
  const [selectingRestaurantId, setSelectingRestaurantId] = useState(null);

  const restaurantIds = React.useMemo(() => {
    return carts.map(cart => cart.restaurantId);
  }, [carts]);

  useEffect(() => { 
    fetchCart(); 
    fetchUserAddresses();
  }, []);

  useEffect(() => {
    if (deliveryLat && deliveryLng) {
      fetchShippingFees(deliveryLat, deliveryLng);
    }
  }, [deliveryLat, deliveryLng, JSON.stringify(restaurantIds)]);

  // Dùng useRef để đánh dấu đã xử lý điều hướng, chống chạy lặp lại 2 lần do StrictMode/Re-render
  const hasHandledTargetRef = React.useRef(false);

  useEffect(() => {
    if (targetRestaurantId && carts.length > 0 && !hasHandledTargetRef.current) {
      const numericId = Number(targetRestaurantId);
      const targetCart = carts.find(cart => Number(cart.restaurantId) === numericId);
      
      if (targetCart) {
        hasHandledTargetRef.current = true; // Khóa lại ngay lập tức tránh chạy lần 2

        if (targetCart.isOpen === false) {
          toast.error(`Quán "${targetCart.restaurantName}" hiện đã đóng cửa (Giờ mở cửa ${targetCart.opensAt} - ${targetCart.closesAt}). Vui lòng quay lại sau!`);
        } else {
          setSelectedRestaurantIds(prev => {
            const numericPrev = prev.map(id => Number(id));
            if (!numericPrev.includes(numericId)) {
              return [...prev, numericId];
            }
            return prev;
          });
        }
        
        setTimeout(() => {
          const element = document.getElementById(`restaurant-card-${numericId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300); 
        
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [targetRestaurantId, carts, navigate, location.pathname]);

  const handleBulkPlaceOrder = () => {
    if (!fullname.trim()) { 
      toast.warning('Vui lòng nhập họ và tên người nhận!'); 
      return; 
    }

    if (!address.trim() || !deliveryLat || !deliveryLng) { 
      toast.warning('Vui lòng chọn địa chỉ giao hàng!'); 
      return; 
    }

    const currentSelectedCarts = carts.filter(c => selectedRestaurantIds.includes(Number(c.restaurantId)));
    if (currentSelectedCarts.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một giỏ hàng để đặt!');
      return;
    }

    // Validate khoảng cách, giờ hoạt động và điều kiện voucher cho từng quán được chọn
    for (const cart of currentSelectedCarts) {
      const shipInfo = shippingInfos[cart.restaurantId];
      const distance = shipInfo?.distanceKm || 0;

      if (distance > MAX_DELIVERY_DISTANCE_KM) {
        toast.error(`Quán "${cart.restaurantName}" cách bạn ${distance.toFixed(1)} km (vượt quá ${MAX_DELIVERY_DISTANCE_KM}km). Hệ thống chỉ hỗ trợ đặt quán trong phạm vi ${MAX_DELIVERY_DISTANCE_KM} km!`);
        return;
      }

      if (cart.isOpen === false) {
        toast.error(`Quán "${cart.restaurantName}" hiện đã đóng cửa (Giờ mở cửa ${cart.opensAt} - ${cart.closesAt}). Vui lòng quay lại sau!`);
        return;
      }

      // Kiểm tra voucher đã chọn xem tiền món ăn có < minOrderAmount không
      const selectedV = selectedVouchers[cart.restaurantId];
      if (selectedV) {
        const minOrder = selectedV.minOrderAmount != null ? Number(selectedV.minOrderAmount) : 0;
        if (minOrder > 0 && cart.subtotal < minOrder) {
          toast.error(`Quán "${cart.restaurantName}": Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(minOrder)} để sử dụng voucher ${selectedV.code}!`);
          return;
        }
      }
    }

    const restaurantVouchersMap = {};
    selectedRestaurantIds.forEach(resId => {
      const v = selectedVouchers[resId];
      if (v) {
        restaurantVouchersMap[resId] = v.userVoucherId;
      }
    });

    const payload = {
      deliveryAddress: address,
      restaurantId: selectedRestaurantIds.map(id => parseInt(id)),
      deliveryLat: Number(deliveryLat),
      deliveryLng: Number(deliveryLng),
      paymentMethod: paymentMethod,
      note: orderNotes,
      restaurantVouchers: restaurantVouchersMap
    };

    setBulkOrderPayload(payload);
    confirmOrderModal.open();
  };

  const executeBulkPlaceOrder = async () => {
    if (!bulkOrderPayload) return;
  
    setIsSubmittingOrder(true);
    confirmOrderModal.close();

    try {
      try {
        await apiClient.put('/users/profile', {
          fullName: fullname.trim() || user?.name,
        });
        updateProfile({ name: fullname.trim(), address, lat: deliveryLat, lng: deliveryLng });
      } catch(err) {
        console.warn('Lỗi đồng bộ profile trước khi đặt hàng:', err);
      }

      // Luôn lấy ghi chú mới nhất từ state (phòng trường hợp người dùng chỉnh sửa ghi chú ngay trong Modal xác nhận)
      await apiClient.post("/orders", { ...bulkOrderPayload, note: orderNotes });

      toast.success('Đặt hàng thành công!');
      setOrderNotes('');
      setSelectedRestaurantIds([]);
      setSelectedVouchers({});
      await fetchCart();
      navigate('/orders');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Đã xảy ra lỗi khi đặt hàng. Vui lòng thử lại!');
    } finally {
      setIsSubmittingOrder(false);
      setBulkOrderPayload(null);
    }
  };

  const handleToggleSelectRestaurant = (cart, distance) => {
    const restaurantId = Number(cart.restaurantId);

    if (selectedRestaurantIds.includes(restaurantId)) {
      setSelectedRestaurantIds(prev => prev.filter(id => id !== restaurantId));
      return;
    }

    const currentDistance = Number(distance) || 0;
    if (currentDistance > MAX_DELIVERY_DISTANCE_KM) {
      toast.error(`Quán "${cart.restaurantName}" cách bạn ${currentDistance.toFixed(1)} km. Hệ thống chỉ hỗ trợ đặt quán trong phạm vi ${MAX_DELIVERY_DISTANCE_KM} km!`);
      return;
    }

    if (cart && cart.isOpen === false) {
      toast.error(`Quán "${cart.restaurantName}" hiện đã đóng cửa (Giờ mở cửa ${cart.opensAt} - ${cart.closesAt}). Vui lòng quay lại sau!`);
      return; 
    }

    setSelectedRestaurantIds(prev => [...prev, restaurantId]);
  };

  const isAllSelected = carts.length > 0 && selectedRestaurantIds.length === carts.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRestaurantIds([]);
      return;
    }

    // Chỉ chọn được các quán đang mở cửa và trong bán kính giao hàng cho phép.
    // Các quán không hợp lệ sẽ bị loại và thông báo cho khách biết lý do.
    const eligibleIds = [];
    const closedNames = [];
    const tooFarNames = [];

    carts.forEach(cart => {
      const distance = shippingInfos[cart.restaurantId]?.distanceKm || 0;

      if (cart.isOpen === false) {
        closedNames.push(cart.restaurantName);
        return;
      }
      if (distance > MAX_DELIVERY_DISTANCE_KM) {
        tooFarNames.push(cart.restaurantName);
        return;
      }
      eligibleIds.push(Number(cart.restaurantId));
    });

    setSelectedRestaurantIds(eligibleIds);

    if (closedNames.length > 0) {
      toast.error(`Không thể chọn quán "${closedNames.join(', ')}" vì hiện đã đóng cửa!`);
    }
    if (tooFarNames.length > 0) {
      toast.error(`Không thể chọn quán "${tooFarNames.join(', ')}" vì vượt quá bán kính giao hàng ${MAX_DELIVERY_DISTANCE_KM} km!`);
    }
  };

  const handleOpenDeleteCartModal = (restaurantId, restaurantName) => {
    deleteCartModal.open({ restaurantId, restaurantName });
  };

  const handleDeleteCart = () => {
    const { restaurantId } = deleteCartModal.data;
    clearCartOfRestaurant(restaurantId);
    setSelectedRestaurantIds(prev => 
      prev.filter(id => Number(id) !== Number(restaurantId))
    );
    setSelectedVouchers(prev => {
      const updated = { ...prev };
      delete updated[restaurantId];
      return updated;
    });
    deleteCartModal.close();
    toast.success('Đã xóa giỏ hàng thành công!');
  };

  const fetchUserAddresses = async () => {
    try {
      const res = await apiClient.get('/addresses');
      const list = res.data.data || [];
      setUserAddresses(list);
      const defaultAddr = list.find(a => a.default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.addressId);
        if (!address) {
          setAddress(defaultAddr.address);
          setDeliveryLat(defaultAddr.latitude);
          setDeliveryLng(defaultAddr.longitude);
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách địa chỉ:', err);
    }
  };

  const handleSelectAddressItem = async (item) => {
    setSelectedAddressId(item.addressId);
    setAddress(item.address);
    setDeliveryLat(item.latitude);
    setDeliveryLng(item.longitude);
    
    setIsUpdatingLocation(true);
    try {
      await apiClient.put(`/addresses/${item.addressId}`, {
        label: item.label || 'Nhà riêng',
        address: item.address,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        isDefault: true
      });

      updateProfile({ 
        name: fullname.trim(), 
        address: item.address, 
        lat: item.latitude, 
        lng: item.longitude 
      });
      toast.success('Đã chọn địa chỉ giao hàng thành công!');
      await fetchUserAddresses();
    } catch (err) {
      console.error('Lỗi cập nhật vị trí:', err);
      toast.error('Không thể cập nhật vị trí giao hàng!');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAddressId(null);
    setAddressLabel('Nhà riêng');
    setMapInitialCoords({ 
      lat: deliveryLat || user?.lat || 10.762622, 
      lng: deliveryLng || user?.lng || 106.660172 
    });
    addressListModal.close();
    mapModal2.open();
  };

  const handleOpenEditModal = (item) => {
    setEditingAddressId(item.addressId);
    setAddressLabel(item.label || 'Nhà riêng');
    setMapInitialCoords({
      lat: Number(item.latitude) || 10.762622,
      lng: Number(item.longitude) || 106.660172
    });
    addressListModal.close();
    mapModal2.open();
  };

  const handleMapConfirmAndSave = async (latVal, lngVal, addressNameVal) => {
    try {
      const payload = {
        label: addressLabel || 'Nhà riêng',
        address: addressNameVal,
        latitude: Number(latVal),
        longitude: Number(lngVal),
        isDefault: userAddresses.length === 0 || editingAddressId === selectedAddressId
      };

      if (editingAddressId) {
        await apiClient.put(`/addresses/${editingAddressId}`, payload);
        toast.success('Cập nhật địa chỉ thành công!');
      } else {
        await apiClient.post('/addresses', payload);
        toast.success('Thêm địa chỉ mới thành công!');
      }

      setAddress(addressNameVal);
      setDeliveryLat(Number(latVal));
      setDeliveryLng(Number(lngVal));
      
      mapModal2.close();
      setEditingAddressId(null);
      await fetchUserAddresses();
      addressListModal.open(); 
    } catch (err) {
      console.error('Lỗi lưu địa chỉ:', err);
      toast.error(err.response?.data?.message || 'Lưu địa chỉ thất bại!');
    }
  };

  // --- HÀM XỬ LÝ VOUCHER CHO TỪNG QUÁN ---
  const fetchVouchersData = async () => {
    setLoadingVouchers(true);
    try {
      const [resMy, resPublic] = await Promise.all([
        apiClient.get('/vouchers/my-vouchers'), 
        apiClient.get('/vouchers/public')    
      ]);
      setMyVouchers(resMy.data.data || []);
      setPublicVouchers(resPublic.data.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách voucher:', err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleOpenVoucherModalForRestaurant = (restaurantId) => {
    setSelectingRestaurantId(restaurantId);
    fetchVouchersData();
    voucherModal.open();
  };

  // =========================================================================
  // XỬ LÝ CLICK CHỌN VOUCHER (BẮN TOAST CẢNH BÁO NẾU ĐƠN < minOrderAmount)
  // =========================================================================
  const handleSelectVoucherForRestaurant = (voucherItem) => {
    if (!selectingRestaurantId) return;

    const currentCart = carts.find(c => Number(c.restaurantId) === Number(selectingRestaurantId));
    const currentSubtotal = currentCart ? currentCart.subtotal : 0;
    const minOrder = voucherItem.minOrderAmount != null ? Number(voucherItem.minOrderAmount) : 0;

    // 1. KIỂM TRA ĐƠN HÀNG TỐI THIỂU (minOrderAmount)
    if (minOrder > 0 && currentSubtotal < minOrder) {
      toast.warning(`Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(minOrder)} để sử dụng voucher ${voucherItem.code}!`);
      return;
    }

    // 2. KIỂM TRA XEM VOUCHER NÀY ĐÃ ĐƯỢC ÁP DỤNG CHO QUÁN KHÁC CHƯA
    const isAlreadyUsedInOtherRes = Object.entries(selectedVouchers).some(
      ([resId, v]) => Number(resId) !== Number(selectingRestaurantId) && v?.userVoucherId === voucherItem.userVoucherId
    );

    if (isAlreadyUsedInOtherRes) {
      toast.warning('Voucher này đã được chọn áp dụng cho quán khác trong đơn!');
      return;
    }

    setSelectedVouchers(prev => ({
      ...prev,
      [selectingRestaurantId]: voucherItem
    }));
    toast.success(`Đã chọn mã ${voucherItem.code} cho quán ${currentCart?.restaurantName || ''}!`);
    voucherModal.close();
  };

  const handleRemoveVoucherForRestaurant = (restaurantId) => {
    setSelectedVouchers(prev => {
      const copy = { ...prev };
      delete copy[restaurantId];
      return copy;
    });
    toast.info('Đã bỏ chọn voucher của quán!');
  };

  const handleClaimPublicVoucher = async (voucherId) => {
    try {
      await apiClient.post(`/vouchers/${voucherId}/add`);
      toast.success('Nhận voucher thành công!');
      fetchVouchersData(); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể nhận voucher này!');
    }
  };

  const selectedCarts = useMemo(() => {
    return carts.filter(c => selectedRestaurantIds.includes(Number(c.restaurantId)));
  }, [carts, selectedRestaurantIds]);

  const totalItems = useMemo(() => {
    return selectedCarts.reduce((s, c) => s + c.items.reduce((a, i) => a + i.quantity, 0), 0);
  }, [selectedCarts]);

  const selectedItemsSubtotal = useMemo(() => {
    return selectedCarts.reduce((sum, cart) => sum + cart.subtotal, 0);
  }, [selectedCarts]);

  const totalShippingFee = useMemo(() => {
    return selectedCarts.reduce((sum, cart) => {
      const feeInfo = shippingInfos[cart.restaurantId];
      return sum + (feeInfo?.shippingFee || 0);
    }, 0);
  }, [selectedCarts, shippingInfos]);

  const calculateCartDiscount = (cart) => {
    const voucher = selectedVouchers[cart.restaurantId];
    if (!voucher) return 0;

    const subtotal = cart.subtotal;
    const minOrder = voucher.minOrderAmount != null ? Number(voucher.minOrderAmount) : 0;

    // Nếu tiền món < minOrder -> không tính giảm giá
    if (minOrder > 0 && subtotal < minOrder) {
      return 0;
    }

    const shipFee = shippingInfos[cart.restaurantId]?.shippingFee || 0;
    const totalBefore = subtotal + shipFee;

    let discount = 0;
    if (voucher.discountType === 'FIXED') {
      discount = Number(voucher.discountValue) || 0;
    } else if (voucher.discountType === 'PERCENT') {
      discount = (subtotal * Number(voucher.discountValue)) / 100;
      if (voucher.maxDiscountAmount && discount > Number(voucher.maxDiscountAmount)) {
        discount = Number(voucher.maxDiscountAmount);
      }
    } else if (voucher.discountType === 'FREESHIP') {
      discount = shipFee;
    }

    return discount > totalBefore ? totalBefore : discount;
  };

  const totalDiscountAmount = useMemo(() => {
    return selectedCarts.reduce((sum, cart) => sum + calculateCartDiscount(cart), 0);
  }, [selectedCarts, selectedVouchers, shippingInfos]);

  const estimateVoucherSaving = (voucher) => {
    const cart = carts.find(c => Number(c.restaurantId) === Number(selectingRestaurantId));
    if (!cart || !voucher) return 0;

    const minOrder = voucher.minOrderAmount != null ? Number(voucher.minOrderAmount) : 0;
    if (minOrder > 0 && cart.subtotal < minOrder) return 0;

    const subtotal = cart.subtotal;
    const shipFee = shippingInfos[selectingRestaurantId]?.shippingFee || 0;
    const totalBefore = subtotal + shipFee;
    let d = 0;
    if (voucher.discountType === 'FIXED') d = Number(voucher.discountValue) || 0;
    else if (voucher.discountType === 'PERCENT') {
      d = (subtotal * Number(voucher.discountValue)) / 100;
      if (voucher.maxDiscountAmount && d > Number(voucher.maxDiscountAmount)) {
        d = Number(voucher.maxDiscountAmount);
      }
    }
    else if (voucher.discountType === 'FREESHIP') d = shipFee;
    return Math.round(d > totalBefore ? totalBefore : d);
  };

  const bestUserVoucherId = useMemo(() => {
    if (!selectingRestaurantId || myVouchers.length === 0) return null;
    let best = null, bestVal = 0;
    myVouchers.forEach(v => { const s = estimateVoucherSaving(v); if (s > bestVal) { bestVal = s; best = v.userVoucherId; } });
    return bestVal > 0 ? best : null;
  }, [myVouchers, selectingRestaurantId, carts, shippingInfos]);

  const finalTotalAmount = useMemo(() => {
    const total = selectedItemsSubtotal + totalShippingFee - totalDiscountAmount;
    return total > 0 ? total : 0;
  }, [selectedItemsSubtotal, totalShippingFee, totalDiscountAmount]);

  if (loading && carts.length === 0) return <Spinner fullScreen />;

  if (carts.length === 0) {
    return (
      <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center font-google-sans min-h-screen bg-gradient-to-b from-orange-50/40 via-slate-50 to-slate-50">
        <div className="max-w-md w-full bg-white border border-orange-100/80 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center animate-rise-in relative overflow-hidden">
          <span className="pointer-events-none absolute -top-14 -right-14 w-40 h-40 bg-orange-100/40 rounded-full blur-2xl" />

          <div className="relative mb-5">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center border border-orange-100 shadow-inner animate-float">
              <ShoppingBag size={40} className="text-[#ff6b35]" />
            </div>
            <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-400 animate-pulse" />
            <Sparkles size={12} className="absolute bottom-1 -left-2 text-orange-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>

          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Giỏ hàng của bạn đang trống</h2>
          <p className="text-sm text-slate-500 font-medium mt-2 max-w-xs leading-relaxed">
            Chưa có món nào ở đây cả. Cùng khám phá <b className="text-[#ff6b35]">hàng ngàn món ngon</b> quanh bạn và thêm vào giỏ nhé!
          </p>

          <Button
            onClick={() => navigate('/explore')}
            className="mt-5 w-full sm:w-auto bg-[#ff6b35] hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-radius-full border border-[#ff6b35] text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-95 transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
          >
            <Search size={15} /> Khám phá món ngon ngay
          </Button>

          <div className="w-full mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-2.5">
            {[
              { label: 'Trang chủ', icon: Sparkles, to: '/', color: 'bg-orange-50 text-[#ff6b35]' },
              { label: 'Yêu thích', icon: Heart, to: '/favorites', color: 'bg-rose-50 text-rose-500' },
              { label: 'Đơn hàng', icon: Package, to: '/orders', color: 'bg-blue-50 text-blue-500' },
            ].map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.to}
                  onClick={() => navigate(s.to)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-radius-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <span className={`w-10 h-10 rounded-radius-lg flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
                    <SIcon size={18} />
                  </span>
                  <span className="text-[11px] font-bold text-slate-600">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-5 w-full font-google-sans pb-32 lg:pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Giỏ Hàng Của Tôi</h1>
          </div>
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

      {/* ================= THANH THÔNG TIN GIAO HÀNG RÚT GỌN (CHỈ HIỂN THỊ TRÊN MOBILE) ================= */}
      <button
        type="button"
        onClick={mobileDeliveryInfoModal.open}
        className="lg:hidden w-full flex items-center gap-3 p-3.5 mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm active:scale-[0.99] transition-transform cursor-pointer text-left"
      >
        <span className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff6b35] flex items-center justify-center shrink-0">
          <Truck size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">THÔNG TIN GIAO HÀNG</p>
          <p className="text-xs font-semibold text-slate-700 truncate">
            {fullname ? `${fullname} - ` : ''} {phone ? `${phone}` : ''}
          </p>
          <p className="text-xs font-semibold text-slate-700 truncate">
            {address || 'Chưa chọn địa chỉ giao hàng'}
          </p>
        </div>
        <Edit2 size={15} className="text-slate-400 shrink-0" />
      </button>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* CỘT TRÁI: DANH SÁCH GIỎ HÀNG THEO TỪNG QUÁN */}
        <div className="flex-1 space-y-4 w-full">
          {carts.map(cart => {
            const shipInfo = shippingInfos[cart.restaurantId] || { shippingFee: 0, distanceKm: 0, durationMinutes: 0 };
            const shippingFee = shipInfo.shippingFee;
            const distance = shipInfo.distanceKm || 0;
            const duration = shipInfo.durationMinutes;
            
            const cartItemCount = cart.items.reduce((a, i) => a + i.quantity, 0);
            const isChecked = selectedRestaurantIds.includes(Number(cart.restaurantId));

            const restaurantVoucher = selectedVouchers[cart.restaurantId];
            const cartDiscount = calculateCartDiscount(cart);
            const cartTotal = (cart.subtotal + shippingFee) - cartDiscount;

            const isOpen = cart.isOpen;
            const isTooFar = distance > MAX_DELIVERY_DISTANCE_KM;

            const minOrderRequired = restaurantVoucher && restaurantVoucher.minOrderAmount != null ? Number(restaurantVoucher.minOrderAmount) : 0;
            const isVoucherNotMet = restaurantVoucher && minOrderRequired > 0 && cart.subtotal < minOrderRequired;

            return (
              <Card 
                key={cart.restaurantId} 
                id={`restaurant-card-${cart.restaurantId}`}
                variant="flat" 
                className="!border-slate-200 !rounded-xl"
              >        
                {/* Header quán */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => handleToggleSelectRestaurant(cart, distance)}
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
                    <div 
                      className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-75 transition-opacity"
                      onClick={() => navigate(`/restaurants/${cart.restaurantId}`)}
                    >
                      <span className="font-extrabold text-sm text-slate-800 truncate" title={cart.restaurantName}>
                        Quán {cart.restaurantName}
                      </span>
                      {isOpen ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full shrink-0">
                          Đang mở cửa
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full shrink-0">
                          Đã đóng cửa
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleOpenDeleteCartModal(cart.restaurantId, cart.restaurantName)}
                    variant="text"
                    size="sm"
                    icon={XCircle}
                    className="!inline-flex items-center gap-1.5 text-xs font-semibold !text-slate-400 hover:!text-red-500 hover:!bg-red-50/70 !px-2.5 !py-1.5 !rounded-lg transition-all duration-200 transform hover:scale-[1.02] cursor-pointer shrink-0 !shadow-none"
                  >
                    Xóa giỏ hàng
                  </Button>
                </div>

                {isTooFar && (
                  <div className="mx-4 my-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5 font-medium shadow-sm">
                    <XCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
                    <div className="space-y-1">
                        <p className="leading-snug">
                          <span className="font-extrabold text-red-800">Không thể đặt hàng:</span> Quán cách bạn <span className="font-bold text-red-900">{distance.toFixed(1)} km</span> (vượt quá bán kính tối đa <span className="font-bold">{MAX_DELIVERY_DISTANCE_KM} km</span>).
                        </p>
                    </div>
                  </div>
                )}

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
                                      disabled={item.quantity <= 1}
                                      className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#ff6b35] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all cursor-pointer active:scale-90"
                                    >
                                      <Minus size={13} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-8 text-center font-extrabold text-xs text-slate-800 select-none">{item.quantity}</span>
                                    <button
                                      onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)}
                                      className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#ff6b35] transition-all cursor-pointer active:scale-90"
                                    >
                                      <Plus size={13} strokeWidth={2.5} />
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
                              <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider inline-flex items-center gap-1"><StickyNote size={11} className="text-[#ff6b35]" /> Ghi chú:</span>
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
                                  disabled={item.quantity <= 1}
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#ff6b35] disabled:opacity-40 transition-all cursor-pointer active:scale-90"
                                >
                                  <Minus size={15} strokeWidth={2.5} />
                                </button>
                                <span className="w-9 text-center font-extrabold text-sm text-slate-800 select-none">{item.quantity}</span>
                                <button
                                  onClick={() => updateQty(item.foodId, item.quantity, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#ff6b35] transition-all cursor-pointer active:scale-90"
                                >
                                  <Plus size={15} strokeWidth={2.5} />
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
                            <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider inline-flex items-center gap-1"><StickyNote size={11} className="text-[#ff6b35]" /> Ghi chú:</span>
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

                {/* --- KHU VỰC VOUCHER RIÊNG CHO QUÁN NÀY --- */}
                <div className="px-4 py-2.5 bg-orange-50/40 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <BadgePercent size={15} className="text-[#ff6b35]" />
                      <span className="font-bold text-slate-700">Giảm giá voucher:</span>
                    </div>

                    {restaurantVoucher ? (
                      <div className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg pl-2.5 pr-1.5 py-1 text-xs min-w-0 shadow-sm">
                        <span className="inline-flex items-center gap-1 font-extrabold text-[#ff6b35] shrink-0"><Tag size={12} /> {restaurantVoucher.code}</span>
                        <span className="text-[11px] font-semibold text-emerald-600 truncate">
                          {restaurantVoucher.discountType === 'FIXED' && `-${formatCurrency(restaurantVoucher.discountValue)}`}
                          {restaurantVoucher.discountType === 'PERCENT' && `-${restaurantVoucher.discountValue}%`}
                          {restaurantVoucher.discountType === 'FREESHIP' && 'Freeship'}
                        </span>
                        <button
                          onClick={() => handleRemoveVoucherForRestaurant(cart.restaurantId)}
                          className="p-0.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                          title="Bỏ chọn voucher"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenVoucherModalForRestaurant(cart.restaurantId)}
                        className="text-xs font-bold text-[#ff6b35] hover:bg-orange-100/60 px-2.5 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1 transition-colors"
                      >
                        Chọn voucher <ChevronRight size={13} />
                      </button>
                    )}
                  </div>

                  {/* BÁO CẢNH BÁO NẾU GIẢM SỐ LƯỢNG MÓN LÀM ĐƠN CHƯA ĐẠT MIN_ORDER */}
                  {isVoucherNotMet && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-800 flex items-center justify-between gap-2 animate-rise-in">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                        Đơn hàng chưa đạt mức tối thiểu {formatCurrency(minOrderRequired)} để sử dụng voucher {restaurantVoucher.code}
                      </span>
                      <button 
                        onClick={() => handleRemoveVoucherForRestaurant(cart.restaurantId)}
                        className="text-amber-900 underline text-[10px] shrink-0 hover:text-red-600"
                      >
                        Bỏ mã
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer đơn hàng quán */}
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 space-y-3">             
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Receipt size={13} className="text-slate-400" /> Tạm tính ({cartItemCount} món):</span>
                        <span className="font-bold text-xs text-slate-700">{formatCurrency(cart.subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" /> Khoảng cách & thời gian:
                        </span>
                        <span className="font-bold text-xs text-slate-700">
                          {isCalculatingShipping ? 'Đang tính...' : `${distance.toFixed(1)} km (~${Math.round(duration)} phút)`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Bike size={13} className="text-slate-400" /> Phí giao hàng:</span>
                        <span className="font-bold text-xs text-slate-700">
                          {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(shippingFee)}
                        </span>
                      </div>
                      {cartDiscount > 0 && (
                        <div className="flex justify-between items-center text-emerald-600">
                          <span className="text-xs font-bold flex items-center gap-1.5"><BadgePercent size={13} /> Giảm giá từ voucher:</span>
                          <span className="font-bold text-xs">- {formatCurrency(cartDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 mt-1">
                        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5"><Store size={13} className="text-[#ff6b35]" /> Tổng thanh toán:</span>
                        <span className="font-extrabold text-sm text-[#ff6b35]">
                          {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(cartTotal > 0 ? cartTotal : 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* CỘT PHẢI: THÔNG TIN GIAO HÀNG & TỔNG QUAN ĐƠN HÀNG — hiển thị trên desktop. */}
        <aside className="hidden lg:block w-full lg:w-80 shrink-0 lg:sticky lg:top-5 space-y-4">
          
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
                  <User size={12} className="text-indigo-500" /> Người nhận
                </label>
                <input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Nhập tên người nhận"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200"
                />
              </div>

              <div className="space-y-1 mb-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={12} className="text-emerald-500" /> Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-semibold focus:outline-none cursor-not-allowed transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={12} className="text-rose-500" /> Địa chỉ nhận hàng
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
                  type="button"
                  icon={address ? Edit2 : Plus}
                  onClick={() => {
                    if (!address) {
                      setEditingAddressId(null);
                      setAddressLabel('Nhà riêng');
                      mapModal2.open();
                    } else {
                      addressListModal.open();
                    }
                  }}
                  className="w-full !mt-0 !bg-orange-600 hover:!bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  {address ? 'Thay Đổi Địa Chỉ' : 'Thêm Mới Địa Chỉ'}
                </Button>
              </div>
            </div>
          </Card>

          {/* TỔNG QUAN ĐƠN HÀNG — chỉ hiển thị trên desktop (lg trở lên). */}
          <Card variant="flat" className="hidden lg:flex p-4 !border-slate-200 !rounded-2xl flex-col space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt size={15} className="text-[#ff6b35]" /> Tổng quan đơn hàng
            </h3>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Store size={13} className="text-slate-400" /> Số quán đã chọn:</span>
              <span className="font-extrabold text-slate-800">{selectedRestaurantIds.length} / {carts.length}</span>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600 pt-2 border-t border-slate-100 mt-1">
              <span className="font-bold text-slate-700">Tổng thanh toán:</span>
              <span className="font-black text-[#ff6b35] text-lg">
                {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(finalTotalAmount)}
              </span>
            </div>

            <Button
              onClick={handleBulkPlaceOrder}
              disabled={selectedRestaurantIds.length === 0 || isSubmittingOrder || isUpdatingLocation || isCalculatingShipping}
              loading={isSubmittingOrder}
              icon={ShoppingBag}
              className="w-full !mt-0 !bg-orange-600 hover:!bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {selectedRestaurantIds.length === 0 ? 'Chọn quán để đặt' : `Đặt Hàng${selectedRestaurantIds.length > 1 ? ` · ${selectedRestaurantIds.length} quán` : ''}`}
            </Button>
          </Card>
        </aside>
      </div>

      {/* ================= THANH ĐẶT HÀNG CỐ ĐỊNH (CHỈ HIỂN THỊ TRÊN MOBILE) ================= */}
      <div
        className="lg:hidden fixed inset-x-0 z-40 px-3"
        style={{ bottom: 'calc(var(--bottom-nav-height, 72px) + 10px)' }}
      >
        <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl shadow-[0_6px_24px_rgba(15,23,42,0.15)] px-4 py-3">
          <button
            type="button"
            onClick={() => orderSummaryModal.open()}
            className="min-w-0 flex-1 text-left cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Store size={12} className="text-[#ff6b35] shrink-0" />
              <span className="truncate">{selectedRestaurantIds.length} / {carts.length} quán đã chọn</span>
              <Edit2 size={11} className="text-slate-400 shrink-0" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-[#ff6b35] leading-tight">
                {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(finalTotalAmount)}
              </span>
            </div>
          </button>

          <Button
            onClick={handleBulkPlaceOrder}
            disabled={selectedRestaurantIds.length === 0 || isSubmittingOrder || isUpdatingLocation || isCalculatingShipping}
            loading={isSubmittingOrder}
            icon={ShoppingBag}
            className="!mt-0 !w-auto shrink-0 !bg-orange-600 hover:!bg-orange-700 text-white font-bold py-3 px-5 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {selectedRestaurantIds.length === 0 ? 'Chọn quán' : `Đặt Hàng${selectedRestaurantIds.length > 1 ? ` · ${selectedRestaurantIds.length}` : ''}`}
          </Button>
        </div>
      </div>

      {/* Modal Xem/Sửa nhanh thông tin đơn hàng — chỉ dùng trên mobile, mở từ thanh đặt hàng cố định */}
      <Modal
        isOpen={orderSummaryModal.isOpen}
        onClose={orderSummaryModal.close}
        title="Thông Tin Đơn Hàng"
        size="sm"
      >
        <div className="space-y-4">
          <div className="border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Store size={13} className="text-slate-400" /> Số quán đã chọn:</span>
              <span className="font-bold text-slate-800">{selectedRestaurantIds.length} / {carts.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><ShoppingBag size={13} className="text-slate-400" /> Tổng số món:</span>
              <span className="font-bold text-slate-800">{totalItems} món</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Receipt size={13} className="text-slate-400" /> Tiền hàng:</span>
              <span className="font-bold text-slate-800">{formatCurrency(selectedItemsSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Bike size={13} className="text-slate-400" /> Phí vận chuyển:</span>
              <span className="font-bold text-slate-800">
                {isCalculatingShipping ? 'Đang tính...' : formatCurrency(totalShippingFee)}
              </span>
            </div>
            {totalDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                <span className="flex items-center gap-1.5"><BadgePercent size={13} /> Giảm giá voucher:</span>
                <span>- {formatCurrency(totalDiscountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">Tổng thanh toán:</span>
              <span className="font-black text-[#ff6b35] text-base">
                {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(finalTotalAmount)}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <StickyNote size={13} /> Ghi chú đơn hàng
            </label>
            <textarea
              rows={3}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Thêm ghi chú cho đơn hàng"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200 resize-none"
            />
          </div>

          <Button
            type="button"
            onClick={orderSummaryModal.close}
            className="w-full !rounded-xl !text-xs !font-bold !py-2.5 !bg-slate-800 hover:!bg-slate-900 text-white cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </Modal>

      {/* Modal Confirm Order */}
      <Modal 
        isOpen={confirmOrderModal.isOpen} 
        onClose={confirmOrderModal.close}
        title="Xác Nhận Đặt Hàng"
        size="sm"
      >
        <div className="space-y-4">          
          <p className="text-xs text-slate-500 leading-relaxed px-2 text-center">
            Hệ thống chuẩn bị gửi đơn đặt hàng tới <span className="font-extrabold text-slate-700">{selectedRestaurantIds.length} quán</span>. Vui lòng kiểm tra lại thông tin trước khi xác nhận.
          </p>

          {/* Thông báo cho khách biết khi chọn nhiều quán sẽ tách thành nhiều đơn riêng biệt, tránh hoang mang khi thấy nhiều mã đơn sau khi đặt */}
          {selectedRestaurantIds.length > 1 && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] font-semibold text-blue-700 flex items-start gap-2 leading-relaxed">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <span>
                Vì các món thuộc <span className="font-extrabold">{selectedRestaurantIds.length} quán khác nhau</span>, hệ thống sẽ tự động tách thành <span className="font-extrabold">{selectedRestaurantIds.length} đơn hàng riêng biệt</span> (mỗi quán 1 đơn) để chuẩn bị và giao độc lập. Bạn có thể theo dõi từng đơn tại mục "Đơn hàng".
              </span>
            </div>
          )}

          {/* Tóm tắt đơn hàng  */}
          <div className="border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><ShoppingBag size={13} className="text-slate-400" /> Tổng số món:</span>
              <span className="font-bold text-slate-800">{totalItems} món</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Receipt size={13} className="text-slate-400" /> Tiền hàng:</span>
              <span className="font-bold text-slate-800">{formatCurrency(selectedItemsSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Bike size={13} className="text-slate-400" /> Phí vận chuyển:</span>
              <span className="font-bold text-slate-800">
                {isCalculatingShipping ? 'Đang tính...' : formatCurrency(totalShippingFee)}
              </span>
            </div>
            {totalDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                <span className="flex items-center gap-1.5"><BadgePercent size={13} /> Giảm giá voucher:</span>
                <span>- {formatCurrency(totalDiscountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">Tổng thanh toán:</span>
              <span className="font-black text-[#ff6b35] text-base">
                {isCalculatingShipping || isUpdatingLocation ? 'Đang tính...' : formatCurrency(finalTotalAmount)}
              </span>
            </div>
          </div>

          {/* Ghi chú đơn hàng — cho phép chỉnh sửa ngay tại bước xác nhận cuối cùng */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <StickyNote size={13} /> Ghi chú đơn hàng
            </label>
            <textarea
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Thêm ghi chú cho đơn hàng"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-orange-100 transition-all duration-200 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={confirmOrderModal.close}
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

      {/* modal xác nhận xóa giỏ hàng */}
      <Modal 
        isOpen={deleteCartModal.isOpen} 
        onClose={deleteCartModal.close}
        title="Xác Nhận Xóa Giỏ Hàng"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center pt-1">
            <div className="relative w-16 h-16">
              <span className="absolute inset-0 rounded-full bg-red-200/60 animate-halo" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-rose-100 border border-red-100 flex items-center justify-center text-red-500 shadow-sm">
                <Trash2 size={28} className="animate-wiggle" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed px-2">
            Bạn chắc chắn muốn xóa toàn bộ sản phẩm thuộc giỏ hàng của <span className="font-extrabold text-slate-700">Quán {deleteCartModal.data?.restaurantName}</span>?
          </p>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            <AlertTriangle size={13} className="shrink-0" /> Hành động này không thể hoàn tác
          </div>

          <div className="flex gap-3 pt-2 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={deleteCartModal.close}
              className="group/cancel w-full !rounded-xl !text-xs !font-bold !py-2.5 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <X size={15} className="transition-transform group-hover/cancel:rotate-90" /> Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleDeleteCart}
              className="group/del w-full !rounded-xl !text-xs !font-bold !py-2.5 !bg-red-600 text-white hover:!bg-red-700 cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm shadow-red-600/30"
            >
              <Trash2 size={15} className="transition-transform group-hover/del:-rotate-12 group-hover/del:scale-110" /> Xác nhận xóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL DANH SÁCH ĐỊA CHỈ ================= */}
      <Modal 
        isOpen={addressListModal.isOpen} 
        onClose={addressListModal.close}
        title="Địa Chỉ Của Tôi"
        size="md"
        className="!rounded-2xl"
      >
        <div className="space-y-4 -mx-6 -my-6 flex flex-col h-full">
          <div className="max-h-[55vh] overflow-y-auto space-y-3 px-6 pt-2 pb-1">
            {userAddresses.map((item) => {
              const isSelected = selectedAddressId === item.addressId;
              return (
                <div
                  key={item.addressId}
                  onClick={() => handleSelectAddressItem(item)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 relative ${
                    isSelected ? 'border-[#ff6b35] bg-orange-50/20 shadow-sm' : 'border-slate-200/80 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'border-[#ff6b35] bg-[#ff6b35]' : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  <div className="flex-1 text-xs space-y-1">
                    <div className="flex flex-wrap justify-between items-center gap-y-1 pr-20">
                      <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        {fullname || 'Người nhận'} 
                        <span className="text-slate-500 font-medium text-xs">
                          | {phone}
                        </span>
                        {item.default && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-[#ff6b35] bg-orange-50 border border-orange-200 rounded-md">
                            Mặc định
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-normal pr-4">{item.address}</p>
                  </div>

                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    icon={Edit2}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(item);
                    }}
                    className="absolute right-3.5 top-3 !inline-flex items-center gap-1 text-[11px] font-bold !text-[#ff6b35] hover:!bg-orange-50/75 !py-1 !px-2 !rounded-lg !shadow-none cursor-pointer"
                  >
                    Cập nhật
                  </Button>
                </div>
              );
            })}
            {userAddresses.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">Chưa có địa chỉ nào được lưu.</p>
            )}
          </div>

          <div className="px-6 pt-3 pb-4 border-t border-slate-100 bg-white mt-auto">
            <Button
              onClick={handleOpenAddModal}
              className="w-full !bg-[#ff6b35] hover:!bg-orange-600 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="text-base font-black">+</span> Thêm Địa Chỉ Mới
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL CHỌN & NHẬN VOUCHER CHO QUÁN ================= */}
      <Modal 
        isOpen={voucherModal.isOpen} 
        onClose={voucherModal.close}
        title={`Voucher Cho Quán: ${carts.find(c => Number(c.restaurantId) === Number(selectingRestaurantId))?.restaurantName || ''}`}
        size="md"
        className="!rounded-3xl !shadow-2xl overflow-hidden !max-w-lg !w-[92vw]"
      >
        <div className="space-y-3 flex flex-col h-[55vh] sm:h-[65vh]">
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveVoucherTab('my')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 sm:py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
                activeVoucherTab === 'my'
                  ? 'bg-white text-[#ff6b35] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Ticket size={14} className={activeVoucherTab === 'my' ? 'animate-wiggle' : ''} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              Voucher Của Tôi
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${activeVoucherTab === 'my' ? 'bg-[#ff6b35] text-white' : 'bg-slate-200 text-slate-500'}`}>{myVouchers.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVoucherTab('public')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 sm:py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
                activeVoucherTab === 'public'
                  ? 'bg-white text-[#ff6b35] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Gift size={14} className={activeVoucherTab === 'public' ? 'animate-bob' : ''} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              Nhận Thêm Voucher
            </button>
          </div>

          {/* Nội dung danh sách */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loadingVouchers ? (
              <div className="flex justify-center items-center py-16"><Spinner /></div>
            ) : (
              <>
                {/* TAB 1: VOUCHER CỦA TÔI */}
                {activeVoucherTab === 'my' && (
                  <>
                    {myVouchers.map((item, idx) => {
                      const isSelectedForThisRes = selectedVouchers[selectingRestaurantId]?.userVoucherId === item.userVoucherId;
                      const meta = vmeta(item.discountType);
                      const MetaIcon = meta.icon;
                      
                      const currentCart = carts.find(c => Number(c.restaurantId) === Number(selectingRestaurantId));
                      const currentSubtotal = currentCart ? currentCart.subtotal : 0;
                      const minOrder = item.minOrderAmount != null ? Number(item.minOrderAmount) : 0;
                      const isEligible = minOrder === 0 || currentSubtotal >= minOrder;
                      const missingAmount = minOrder - currentSubtotal;

                      const saving = estimateVoucherSaving(item);
                      const isBest = bestUserVoucherId === item.userVoucherId && !isSelectedForThisRes && isEligible;
                      const exp = expiryInfo(item.expiredAt);

                      return (
                        <div
                          key={item.userVoucherId}
                          onClick={() => handleSelectVoucherForRestaurant(item)}
                          style={{ animationDelay: `${idx * 55}ms` }}
                          className={`group relative p-3 sm:p-4 pl-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 overflow-hidden animate-rise-in hover:-translate-y-0.5 ${
                            isSelectedForThisRes
                              ? 'border-[#ff6b35] bg-gradient-to-r from-orange-50/60 to-white shadow-md ring-1 ring-[#ff6b35]/30'
                              : !isEligible
                              ? 'border-slate-200 bg-slate-50/80 opacity-75'
                              : 'border-slate-200/80 hover:border-orange-300 hover:shadow-md bg-white'
                          }`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSelectedForThisRes ? 'bg-[#ff6b35]' : meta.strip} transition-colors`} />
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
                          <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
                          
                          <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${meta.grad} text-white shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-3`}>
                            <MetaIcon size={18} className={meta.anim} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                          </span>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] sm:text-[11px] tracking-wide shrink-0 ${meta.chip}`}>
                                {item.code}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">{item.name}</span>
                              {isBest && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                                  <Sparkles size={9} className="animate-twinkle" /> Tiết kiệm nhất
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ${meta.chip}`}>
                                {item.discountType === 'FIXED' && `Giảm ${formatCurrency(item.discountValue)}`}
                                {item.discountType === 'PERCENT' && `Giảm ${item.discountValue}%`}
                                {item.discountType === 'FREESHIP' && 'Miễn phí vận chuyển'}
                              </span>

                              {minOrder > 0 && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Đơn tối thiểu: {formatCurrency(minOrder)}
                                </span>
                              )}

                              {!isEligible ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                  <AlertCircle size={10} /> Thiếu {formatCurrency(missingAmount)}
                                </span>
                              ) : saving > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                  <BadgePercent size={11} /> Tiết kiệm ~{formatCurrency(saving)} cho quán này
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">Có thể áp cho quán này</span>
                              )}
                            </div>

                            <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs ${exp.soon ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                              <Clock size={13} className="shrink-0" />
                              <span className="truncate">Hạn: {formatDateTime(item.expiredAt)}</span>
                              {exp.soon && <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 shrink-0"><AlertCircle size={9} className="animate-pulse-slow" /> Sắp hết hạn</span>}
                            </div>
                          </div>

                          <div className="flex items-center pr-1 shrink-0">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelectedForThisRes ? 'border-[#ff6b35] bg-[#ff6b35] shadow-sm shadow-[#ff6b35]/40' : 'border-slate-300 bg-white group-hover:border-slate-400 group-hover:scale-110'
                            }`}>
                              {isSelectedForThisRes && <Check size={12} className="text-white animate-scale-up" strokeWidth={3.5} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {myVouchers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <div className="relative w-16 h-16 mb-3">
                          <span className="absolute inset-0 rounded-2xl bg-orange-200/50 animate-halo" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                          <div className="relative w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl flex items-center justify-center text-[#ff6b35] animate-float">
                            <Ticket size={28} />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-600">Bạn chưa có voucher nào trong ví.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Hãy sang tab "Nhận Thêm Voucher" để săn mã giảm giá nhé!</p>
                        <button type="button" onClick={() => setActiveVoucherTab('public')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff6b35] bg-orange-50 hover:bg-orange-100 px-3.5 py-2 rounded-full transition-colors cursor-pointer">
                          <Gift size={14} /> Săn voucher ngay
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* TAB 2: VOUCHER PUBLIC */}
                {activeVoucherTab === 'public' && (
                  <>
                    {publicVouchers.map((pub, idx) => {
                      const meta = vmeta(pub.discountType);
                      const MetaIcon = meta.icon;
                      const exp = expiryInfo(pub.endDate);
                      const minOrder = pub.minOrderAmount != null ? Number(pub.minOrderAmount) : 0;

                      return (
                        <div
                          key={pub.voucherId}
                          style={{ animationDelay: `${idx * 55}ms` }}
                          className="group relative p-3 sm:p-4 pl-4 rounded-2xl border border-slate-200/80 bg-white flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-orange-300 hover:-translate-y-0.5 transition-all overflow-hidden animate-rise-in"
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.strip} transition-colors`} />
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
                          <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />

                          <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${meta.grad} text-white shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-3`}>
                            <MetaIcon size={18} className={meta.anim} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                          </span>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] sm:text-[11px] tracking-wide shrink-0 ${meta.chip}`}>
                                {pub.code}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">{pub.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ${meta.chip}`}>
                                {pub.discountType === 'FIXED' && `Giảm ${formatCurrency(pub.discountValue)}`}
                                {pub.discountType === 'PERCENT' && `Giảm ${pub.discountValue}%`}
                                {pub.discountType === 'FREESHIP' && 'Miễn phí vận chuyển'}
                              </span>
                              {minOrder > 0 && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Đơn tối thiểu: {formatCurrency(minOrder)}
                                </span>
                              )}
                            </div>
                            <div className="pt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] ${exp.soon ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                <Clock size={12} className="shrink-0" /> Hạn {formatDateTime(pub.endDate)}
                                {exp.soon && <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 shrink-0"><AlertCircle size={9} className="animate-pulse-slow" /> Sắp hết</span>}
                              </span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            onClick={() => handleClaimPublicVoucher(pub.voucherId || pub.id)}
                            className="group/btn !bg-[#ff6b35] hover:!bg-orange-600 text-white !text-[11px] sm:!text-xs !font-bold !py-1.5 sm:!py-2 !px-3 sm:!px-4 !rounded-xl shadow-sm hover:shadow transition-all cursor-pointer shrink-0 inline-flex items-center gap-1"
                          >
                            <Plus size={13} className="stroke-[3px] transition-transform group-hover/btn:rotate-90" /> Nhận mã
                          </Button>
                        </div>
                      );
                    })}
                    {publicVouchers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3 animate-float">
                          <Tag size={26} />
                        </div>
                        <p className="text-xs font-bold text-slate-600">Hiện không có voucher nào khả dụng.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Quay lại sau để không bỏ lỡ ưu đãi mới nhé!</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer chân modal */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
            {selectedVouchers[selectingRestaurantId] ? (
              <button 
                type="button" 
                onClick={() => {
                  handleRemoveVoucherForRestaurant(selectingRestaurantId);
                  voucherModal.close();
                }}
                className="text-[11px] sm:text-xs text-rose-500 hover:text-rose-600 font-semibold transition-colors cursor-pointer py-1 truncate"
              >
                Bỏ chọn voucher của quán này
              </button>
            ) : <div />}
            
            <div className="flex gap-2 shrink-0">
              <Button 
                type="button" 
                onClick={voucherModal.close}
                className="!bg-slate-800 hover:!bg-slate-900 text-white !text-xs !py-1.5 sm:!py-2 !px-4 sm:!px-5 !rounded-xl"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL BẢN ĐỒ ================= */}
      <MapModal2
        key={`${editingAddressId || 'new'}-${mapInitialCoords.lat}-${mapInitialCoords.lng}`} 
        isOpen={mapModal2.isOpen}
        onClose={mapModal2.close}
        onConfirm={handleMapConfirmAndSave}
        isEditMode={Boolean(editingAddressId)}
        initialLat={mapInitialCoords.lat}
        initialLng={mapInitialCoords.lng}
        addressLabel={addressLabel}
        setAddressLabel={setAddressLabel}
        showLabelSelector={true} 
      />
    </div>
  );
}