import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Phone, Mail, MapPin, LogOut, Camera, Map, Utensils, Sparkles, ShoppingBag, Heart, Bell, MessageCircle, ChevronRight, ShieldCheck, Edit2, Plus } from 'lucide-react';
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
import MapModal2 from '../../components/common/MapModal2';

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
  const fileInputRef = useRef(null);
  const { uploading: uploadingAvatar, handleAvatarChange: uploadAvatar } = useAvatarUpload();

  // Các Modal quản lý địa chỉ
  const addressListModal = useModalState(); 
  const mapModal2 = useModalState();        

  // Danh sách địa chỉ 
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // State phục vụ việc thêm/sửa địa chỉ qua MapModal2
  const [editingAddressId, setEditingAddressId] = useState(null); 
  const [addressLabel, setAddressLabel] = useState('Nhà riêng');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // THÊM STATE LƯU TỌA ĐỘ RIÊNG CHO MAPMODAL2 (Tránh việc bị dính tọa độ cũ/mặc định)
  const [mapInitialCoords, setMapInitialCoords] = useState({ 
    lat: user?.lat || 10.762622, 
    lng: user?.lng || 106.660172 
  });

  // Lấy danh sách địa chỉ 
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

  // Mở MapModal2 ở chế độ THÊM MỚI địa chỉ
  const handleOpenAddModal = () => {
    setEditingAddressId(null);
    setAddressLabel('Nhà riêng');
    setMapInitialCoords({ lat: 10.762622, lng: 106.660172 });
    addressListModal.close();
    mapModal2.open();
  };

  // Mở MapModal2 ở chế độ CẬP NHẬT địa chỉ có sẵn 
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

  // Xử lý lưu địa chỉ sau khi xác nhận từ MapModal2 (cả Thêm mới & Cập nhật)
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

      if (!selectedAddressId || editingAddressId === selectedAddressId || payload.isDefault) {
        setAddress(addressNameVal);
        setLat(Number(latVal));
        setLng(Number(lngVal));
        updateProfile({ 
          name: name.trim(), 
          address: addressNameVal, 
          lat: Number(latVal), 
          lng: Number(lngVal) 
        });
      }
      
      mapModal2.close();
      setEditingAddressId(null);
      await fetchUserAddresses();
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

  // Xử lý validate bằng Toast
  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập họ và tên!');
      return;
    }

    if (!email.trim()) {
      toast.error('Vui lòng nhập Email!');
      return;
    }
    
    if (!validateEmail(email)) {
      toast.error('Email không hợp lệ!');
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
      console.error('Lỗi khi lưu profile lên DB:', err);
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

      <Card className="p-5 border border-md-outline-variant/20 shadow-sm">
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
      </Card>

      </div>

      {/* ─── CỘT PHẢI: form hồ sơ ──────────────────────────── */}
      <Card className="p-5 border border-md-outline-variant/20 shadow-sm space-y-5.5 animate-slide-up h-full flex flex-col">
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
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-md-outline-variant focus:border-md-primary rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold"
            />
          </div>
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
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-md-outline-variant focus:border-md-primary rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold"         />
          </div>
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
              className="w-full pl-10 pr-4 py-2.5 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider">
              Địa chỉ giao hàng
            </label>
            <button
              type="button"
              onClick={() => {
                if (!address) {
                  handleOpenAddModal();
                } else {
                  addressListModal.open();
                }
              }}
              className="px-2.5 py-1 bg-md-primary/10 hover:bg-md-primary/20 text-md-primary rounded-md text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
            >
              {address ? (
                <>
                  <Edit2 size={12} /> Đổi địa chỉ
                </>
              ) : (
                <>
                  <Plus size={12} /> Thêm địa chỉ
                </>
              )}
            </button>
          </div>

          <div className="relative flex items-start">
            <MapPin className="absolute left-3.5 top-3 text-md-outline pointer-events-none" size={16} />
            <div className="w-full pl-10 pr-4 py-2.5 border border-md-outline-variant rounded-radius-lg text-xs font-semibold text-slate-700 min-h-[46px] flex items-center">
              {isUpdatingLocation ? (
                <span className="flex items-center gap-2 text-slate-400">
                  <Spinner size="sm" /> Đang cập nhật...
                </span>
              ) : (
                <span className="break-words whitespace-normal leading-relaxed">{address || 'Chưa chọn địa chỉ giao hàng'}</span>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={updating}
          loading={updating}
          className="w-full mt-auto bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1.5px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
        >
          Cập nhật thông tin
        </Button>
      </Card>

      </div>
      <Card className="p-5 border border-md-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-md-on-surface flex items-center gap-2">
            <MapPin size={16} className="text-md-primary" /> Vị Trí 
          </h3>
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
      </Card>

      {/* Dangerous Operations */}
      <Button
        type="button"
        variant="danger"
        onClick={handleLogout}
        className="w-full !flex items-center justify-center gap-2 text-xs font-bold !text-red-500 hover:!text-red-700 !bg-red-50 hover:!bg-red-100 py-3.5 rounded-radius-full border !border-red-200/50 transition-all active:scale-[0.99] cursor-pointer shadow-none"
        icon={LogOut}
      >
        Đăng xuất khỏi hệ thống
      </Button>

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

      <MapModal2
        key={`${editingAddressId || 'new'}-${mapInitialCoords.lat}-${mapInitialCoords.lng}`} 
        isOpen={mapModal2.isOpen}
        onClose={mapModal2.close}
        onConfirm={handleMapConfirmAndSave}
        isEditMode={Boolean(editingAddressId)} 
        initialLat={mapInitialCoords.lat}
        initialLng={mapInitialCoords.lng}
      />
    </div>  
  );
}