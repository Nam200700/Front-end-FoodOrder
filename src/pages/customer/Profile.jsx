import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Phone, Mail, MapPin, LogOut, Camera, Map, Utensils, Sparkles, ShoppingBag, Heart, Bell, MessageCircle, ChevronRight, ShieldCheck, AlertTriangle, Edit2 } from 'lucide-react';
import MapModal from '../../components/common/MapModal';
import apiClient from '../../services/api';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { toast } from 'react-toastify';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { validateEmail } from '../../utils/validation';
import { useModalState } from '../../hooks/useModalState';
import axios from 'axios';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card'; 
import Modal from '../../components/common/Modal';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '')
  const [address, setAddress] = useState(user?.address || '');
  
  // TOẠ ĐỘ MẶC ĐỊNH LƯU TRONG PROFILE
  const [lat, setLat] = useState(user?.lat || 10.762622);
  const [lng, setLng] = useState(user?.lng || 106.660172);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const fileInputRef = useRef(null);
  const { uploading: uploadingAvatar, handleAvatarChange: uploadAvatar } = useAvatarUpload();

  // Các Modal quản lý địa chỉ
  const addressListModal = useModalState(); 
  const addAddressModal = useModalState();  
  const mapModal = useModalState();         

  // Danh sách địa chỉ 
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // State thông tin địa chỉ tạm thời
  const [newAddressText, setNewAddressText] = useState('');
  const [newAddressLat, setNewAddressLat] = useState(null);
  const [newAddressLng, setNewAddressLng] = useState(null);
  const [addressLabel, setAddressLabel] = useState('Nhà riêng');
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Lấy danh sách địa chỉ khi load trang
  useEffect(() => { 
    fetchUserAddresses();
  }, []);

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
          setLat(defaultAddr.latitude);
          setLng(defaultAddr.longitude);
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách địa chỉ:', err);
    }
  };

  // Chọn địa chỉ từ danh sách
  const handleSelectAddressItem = async (item) => {
    setSelectedAddressId(item.addressId);
    setAddress(item.address);
    setLat(item.latitude);
    setLng(item.longitude);
    
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
        name: name.trim(), 
        address: item.address, 
        lat: item.latitude, 
        lng: item.longitude 
      });
      toast.success('Đã chọn địa chỉ giao hàng thành công!');
      addressListModal.close();
      await fetchUserAddresses();
    } catch (err) {
      console.error('Lỗi cập nhật vị trí:', err);
      toast.error('Không thể cập nhật vị trí giao hàng!');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Chuyển sang MapModal từ modal nhập text
  const handleProceedToMap = async (e) => {
    e.preventDefault();
    if (!newAddressText.trim()) {
      toast.warning('Vui lòng nhập địa chỉ cụ thể!');
      return;
    }

    setIsUpdatingLocation(true);
    try {
      let cleanQuery = newAddressText
        .replace(/trường\s+thcs\s+/gi, '')
        .replace(/trường\s+tiểu học\s+/gi, '')
        .replace(/xã\s+/gi, '')
        .replace(/\d+\/\d+\s+ấp\s+\d+/gi, '')
        .replace(/ấp\s+\d+/gi, '')
        .replace(/^\d+[\/\-]?\d*\s*,?/g, '')
        .trim();

      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { format: 'json', q: cleanQuery, limit: 1, 'accept-language': 'vi' },
        headers: { 'User-Agent': 'FoodDeliveryApp/1.0' }
      });

      let lat = 10.7769; 
      let lng = 106.7009;

      if (response.data && response.data.length > 0) {
        lat = parseFloat(response.data[0].lat);
        lng = parseFloat(response.data[0].lon);
      }

      setNewAddressLat(lat);
      setNewAddressLng(lng);

      addAddressModal.close();
      mapModal.open();
    } catch (err) {
      console.warn('Lỗi lấy tọa độ, chuyển sang ghim thủ công:', err);
      setNewAddressLat(10.7769);
      setNewAddressLng(106.7009);

      toast.info('Vui lòng chọn hoặc di chuyển ghim trực tiếp trên bản đồ.');
      addAddressModal.close();
      mapModal.open();
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Lưu lại sau khi ghim trên bản đồ
  const handleMapConfirmAndSave = async (lat, lng, addressName) => {
    try {
      const payload = {
        label: addressLabel || 'Nhà riêng',
        address: newAddressText,
        latitude: Number(lat),
        longitude: Number(lng),
        isDefault: userAddresses.length === 0
      };

      if (editingAddressId) {
        await apiClient.put(`/addresses/${editingAddressId}`, payload);
        toast.success('Cập nhật địa chỉ thành công!');
      } else {
        await apiClient.post('/addresses', payload);
        toast.success('Thêm địa chỉ mới thành công!');
      }

      if (!selectedAddressId || editingAddressId === selectedAddressId || payload.isDefault) {
        setAddress(newAddressText);
        setLat(Number(lat));
        setLng(Number(lng));
        updateProfile({ 
          name: name.trim(), 
          address: newAddressText, 
          lat: Number(lat), 
          lng: Number(lng) 
        });
      }
      
      mapModal.close();
      setEditingAddressId(null);
      await fetchUserAddresses();
      addAddressModal.close();
      addressListModal.open();
    } catch (err) {
      console.error('Lỗi lưu địa chỉ:', err);
      toast.error(err.response?.data?.message || 'Lưu địa chỉ thất bại!');
    }
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmLocation = (selectedLat, selectedLng, addressName) => {
    setLat(selectedLat);
    setLng(selectedLng);
    setAddress(addressName);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Vui lòng nhập họ và tên!');
      return;
    } else {
      setNameError('');
    }

    if(!email.trim()) {
      setEmailError('Vui lòng nhập Email!');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Email không hợp lệ!');
      return;
    }

    setUpdating(true);
    try {
      await apiClient.put('/users/profile', {
        fullName: name,
        email: email,
        address: address,
        latitude: Number(lat),
        longitude: Number(lng)
      });
      updateProfile({ name, phone, address, lat, lng });
      toast.success('Cập nhật thông tin cá nhân thành công!');
    } catch (err) {
      console.error('Lỗi khi lưu profile thật lên DB:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thông tin cá nhân.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans pb-24 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      {/* ─── CỘT TRÁI: thẻ thành viên + thẻ truy cập nhanh ───────────────────────── */}
      <div className="space-y-6">

      {/* ─── THẺ THÀNH VIÊN ẨM THỰC (membership card, accent cam) ─────────────────── */}
      <div className="relative overflow-hidden rounded-radius-xl p-6 shadow-shadow-2 bg-gradient-to-br from-md-primary to-[#FF8C42] text-white animate-fade-in">
        <Utensils className="absolute -right-4 -bottom-4 text-white/10" size={120} strokeWidth={1.2} />

        <div className="relative flex items-center gap-5">
          <div className="relative shrink-0">
            <img
              src={getAvatarUrl(user.avatar)}
              alt="Avatar"
              className="w-20 h-20 rounded-radius-full border-4 border-white/30 object-cover shadow-sm"
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 p-1.5 bg-white text-md-primary rounded-radius-full shadow-shadow-2 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              title="Đổi ảnh đại diện"
            >
              {uploadingAvatar ? (
                <span className="w-3 h-3 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Camera size={13} />
              )}
            </button>
          </div>

          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <Sparkles size={11} /> Thành viên Foodie
            </span>
            <h2 className="font-extrabold text-xl mt-2 truncate">{user.name}</h2>
            <p className="text-xs text-white/85 font-semibold mt-0.5 truncate">{user.email}</p>
          </div>
        </div>

        <div className="relative mt-6 pt-4 border-t border-white/25 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-white/70 uppercase tracking-[0.15em]">Mã thành viên</p>
            <p className="text-base font-extrabold tracking-widest mt-1 font-mono">
              FD-{String(user.userId || user.id || '').padStart(6, '0').slice(-6)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/15 px-2.5 py-1 rounded-full shrink-0">
            <ShieldCheck size={12} /> Đã xác thực
          </span>
        </div>
      </div>

      <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm">
        <h3 className="text-sm font-extrabold text-md-on-surface flex items-center gap-2 pb-3 mb-2 border-b border-md-outline-variant/20">
          <Sparkles size={16} className="text-md-primary" /> Truy cập nhanh
        </h3>
        <div className="space-y-1">
          {[
            { icon: ShoppingBag, label: 'Đơn hàng của tôi', desc: 'Theo dõi & lịch sử đơn', to: '/orders' },
            { icon: Heart, label: 'Quán yêu thích', desc: 'Bộ sưu tập ẩm thực', to: '/favorites' },
            { icon: Bell, label: 'Thông báo', desc: 'Cập nhật & ưu đãi', to: '/notifications' },
            { icon: MessageCircle, label: 'Tin nhắn', desc: 'Trò chuyện với quán', to: '/chat' },
          ].map(({ icon: ItemIcon, label, desc, to }) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 p-2.5 rounded-radius-lg hover:bg-md-primary/5 transition-colors text-left cursor-pointer group"
            >
              <span className="p-2 bg-md-primary/10 text-md-primary rounded-radius-md shrink-0">
                <ItemIcon size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-extrabold text-md-on-surface truncate">{label}</span>
                <span className="block text-[11px] text-md-on-surface-variant font-medium truncate">{desc}</span>
              </span>
              <ChevronRight size={16} className="text-md-outline group-hover:text-md-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>

      </div>

      {/* ─── CỘT PHẢI: form hồ sơ (mini-map tách xuống dưới full-width) ────────────
          h-full + flex-col để form cao bằng cột trái; nút Lưu đẩy xuống đáy (mt-auto). */}
      <form onSubmit={handleSave} className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm space-y-5.5 animate-slide-up h-full flex flex-col">
        {/* Mục "Hồ sơ" của sổ tay */}
        <div className="flex items-center gap-2 pb-1 border-b border-md-outline-variant/20">
          <User size={16} className="text-md-primary" />
          <h3 className="text-sm font-extrabold text-md-on-surface">Hồ Sơ Của Bạn</h3>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider mb-2">
            Họ và tên
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-outline" size={16} />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(''); 
              }}
              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold ${
                nameError ? 'border-red-500 focus:border-red-500' : 'border-md-outline-variant focus:border-md-primary'
              }`}
            />
          </div>
          {nameError && (
            <span className="text-[11px] text-red-500 font-bold mt-1 ml-1 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{nameError}</span>
            </span>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider mb-2">
            Địa chỉ Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-outline" size={16} />
            <input
              type="text"              
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold ${
                emailError ? 'border-red-500 focus:border-red-500' : 'border-md-outline-variant focus:border-md-primary'
              }`}            />
          </div>
          {emailError && (
            <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{emailError}</span>
            </span>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider mb-2">
            Số điện thoại
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-outline" size={16} />
            <input
              type="tel"
              readOnly
              value={phone}
              onChange={(e) => { setPhone(e.target.value);}}
              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold`}
            />
          </div>
        </div>

        {/* Địa chỉ mặc định thật có chọn bản đồ */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={12} className="text-slate-400" /> Địa chỉ 
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
                setNewAddressText('');
                setNewAddressLat(null);
                setNewAddressLng(null);
                setAddressLabel('Nhà riêng');
                addAddressModal.open();
              } else {
                addressListModal.open();
              }
            }}
            className="w-full !mt-0 !bg-orange-600 hover:!bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            {address ? 'Thay Đổi Địa Chỉ' : 'Thêm Mới Địa Chỉ'}
          </Button>
        </div>

        <button
          type="submit"
          disabled={updating}
          className="w-full mt-auto bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1.5px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
        >
          {updating ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            'Cập nhật thông tin'
          )}
        </button>
      </form>

      </div>
      <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-md-on-surface flex items-center gap-2">
            <MapPin size={16} className="text-md-primary" /> Vị trí giao hàng
          </h3>
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="text-xs font-bold text-md-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Map size={13} /> Chọn lại
          </button>
        </div>
        <div className="rounded-radius-lg overflow-hidden border border-md-outline-variant/30">
          <iframe
            title="Bản đồ vị trí giao hàng"
            className="w-full h-56 md:h-72 block"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.008}%2C${Number(lat) - 0.006}%2C${Number(lng) + 0.008}%2C${Number(lat) + 0.006}&layer=mapnik&marker=${lat}%2C${lng}`}
          />
        </div>
        <p className="text-xs text-md-on-surface-variant font-semibold mt-3 flex items-start gap-1.5 leading-relaxed">
          <MapPin size={14} className="mt-0.5 shrink-0 text-md-primary" />
          {address}
        </p>
      </div>

      {/* Dangerous Operations */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 py-3.5 rounded-radius-full border border-red-200/50 transition-all active:scale-[0.99] cursor-pointer"
      >
        <LogOut size={15} />
        Đăng xuất khỏi hệ thống
      </button>

      {/* MapModal chọn địa chỉ mặc định */}
      <MapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={lat}
        initialLng={lng}
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleAvatarChange} 
      />

      {/* ================= MODAL ĐỊA CHỈ CỦA TÔI ================= */}
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
                        {name || user?.name} 
                        <span className="text-slate-500 font-medium text-xs">
                          | {phone || user?.phone}
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
                      setEditingAddressId(item.addressId);
                      setNewAddressText(item.address);
                      setNewAddressLat(item.latitude);
                      setNewAddressLng(item.longitude);
                      setAddressLabel(item.label || 'Nhà riêng');
                      addressListModal.close();
                      addAddressModal.open(); 
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
              onClick={() => {
                addressListModal.close();
                setEditingAddressId(null);
                setNewAddressText('');
                setNewAddressLat(null);
                setNewAddressLng(null);
                setAddressLabel('Nhà riêng');
                addAddressModal.open(); 
              }}
              className="w-full !bg-[#ff6b35] hover:!bg-orange-600 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="text-base font-black">+</span> Thêm Địa Chỉ Mới
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL THÊM / CẬP NHẬT ĐỊA CHỈ ================= */}
      <Modal 
        isOpen={addAddressModal.isOpen} 
        onClose={() => {
          addAddressModal.close();
          setEditingAddressId(null);
        }}
        title={editingAddressId ? "Cập Nhật Địa Chỉ" : "Thêm Địa Chỉ Mới"}
        size="md"
        className="!rounded-2xl"
      >
        <div className="space-y-4 -mx-6 -my-6 px-6 py-4">
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Địa chỉ cụ thể <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <MapPin size={15} />
              </span>
              <input 
                type="text"
                value={newAddressText}
                onChange={(e) => setNewAddressText(e.target.value)}
                placeholder="Ví dụ: Đường Tô Ký, Phường Trung Mỹ Tây, TP.HCM..."
                className="w-full pl-9 pr-3 py-3 text-xs border border-slate-200 rounded-2xl bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">Loại địa chỉ:</label>
            <div className="flex gap-3">
              {['Nhà riêng', 'Văn phòng'].map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setAddressLabel(lbl)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    addressLabel === lbl ? 'border-[#ff6b35] bg-orange-50/40 text-[#ff6b35] shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 -mx-6 px-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-6 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                addAddressModal.close();
                setEditingAddressId(null);
                addressListModal.open(); 
              }}
              className="!rounded-2xl !text-xs !font-bold !py-2.5 !px-5 cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Quay Lại
            </Button>
            <Button
              type="button"
              onClick={handleProceedToMap}
              disabled={isUpdatingLocation}
              className="!rounded-2xl !text-xs !font-bold !py-2.5 !px-6 !bg-[#ff6b35] text-white hover:!bg-orange-600 cursor-pointer shadow-md shadow-orange-500/20"
            >
              {isUpdatingLocation ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MAP MODAL ================= */}
      {mapModal.isOpen && (
        <MapModal 
          key={`${newAddressLat}_${newAddressLng}_${mapModal.isOpen}`}
          isOpen={mapModal.isOpen} 
          onClose={() => {
            mapModal.close();
            addAddressModal.open(); 
          }} 
          onConfirm={handleMapConfirmAndSave} 
          initialLat={newAddressLat || 10.7769} 
          initialLng={newAddressLng || 106.7009} 
        />
      )}
    </div>  
  );
}
