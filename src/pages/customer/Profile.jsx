import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Phone, Mail, MapPin, LogOut, Camera, Map, Utensils, Sparkles } from 'lucide-react';
import MapModal from '../../components/common/MapModal';
import apiClient from '../../services/api';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { toast } from 'react-toastify';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();

  const [name, setName] = useState(user?.name || 'Nguyễn Văn A');
  const [phone, setPhone] = useState(user?.phone || '0901234567');
  const [address, setAddress] = useState(user?.address || '123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM');
  
  // TOẠ ĐỘ MẶC ĐỊNH LƯU TRONG PROFILE
  const [lat, setLat] = useState(user?.lat || 10.762622);
  const [lng, setLng] = useState(user?.lng || 106.660172);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const fileInputRef = useRef(null);
  const { uploading: uploadingAvatar, handleAvatarChange: uploadAvatar } = useAvatarUpload();

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
    setUpdating(true);
    try {
      // Cập nhật thông tin profile thật gồm cả toạ độ mặc định lên cơ sở dữ liệu backend
      await apiClient.put('/users/profile', {
        fullName: name,
        phone: phone,
        address: address,
        latitude: Number(lat),
        longitude: Number(lng)
      });
      updateProfile({ name, phone, address, lat, lng });
      toast.success('Đã cập nhật thông tin cá nhân và vị trí mặc định thành công!');
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
    <div className="flex-1 p-4 md:p-8 max-w-xl mx-auto w-full font-google-sans pb-24 space-y-6">
      {/* ─── THẺ THÀNH VIÊN ẨM THỰC (membership card, accent cam) ─────────────────── */}
      <div className="relative overflow-hidden rounded-radius-xl p-6 shadow-shadow-2 bg-gradient-to-br from-md-primary to-[#FF8C42] text-white animate-fade-in">
        {/* Hoạ tiết line-art mờ ở góc tạo cảm giác "sổ tay ẩm thực" */}
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
      </div>

      {/* Info Form */}
      <form onSubmit={handleSave} className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm space-y-5.5 animate-slide-up">
        {/* Mục "Hồ sơ" của sổ tay */}
        <div className="flex items-center gap-2 pb-1 border-b border-md-outline-variant/20">
          <User size={16} className="text-md-primary" />
          <h3 className="text-sm font-extrabold text-md-on-surface">Hồ sơ của bạn</h3>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider mb-2">
            Họ và tên
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-outline" size={16} />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all font-semibold"
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
              type="email"
              disabled
              value={user.email}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-md-outline-variant/50 rounded-radius-lg text-xs text-md-outline cursor-not-allowed font-semibold"
            />
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
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all font-semibold"
            />
          </div>
        </div>

        {/* Địa chỉ mặc định thật có chọn bản đồ */}
        <div>
          <label className="block text-[10px] font-bold text-md-on-surface-variant uppercase tracking-wider mb-2">
            Địa chỉ mặc định thật
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-outline" size={16} />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all font-semibold"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="px-4.5 py-2.5 bg-md-primary/10 text-md-primary border border-md-primary/15 hover:bg-md-primary/20 rounded-radius-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Map size={14} />
              Chọn bản đồ
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={updating}
          className="w-full bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1.5px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
        >
          {updating ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            'Lưu thay đổi'
          )}
        </button>
      </form>

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
    </div>
  );
}