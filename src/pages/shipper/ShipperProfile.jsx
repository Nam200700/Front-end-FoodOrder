import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Bike, Phone, LogOut, Camera, Mail, ShieldCheck, Clipboard, Trophy, Star, Package, CheckCircle2 } from 'lucide-react';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { validatePhone } from '../../utils/validation';
import { toast } from 'react-toastify';

export default function ShipperProfile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // States cho form chỉnh sửa
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('MOTORBIKE');
  const [licensePlate, setLicensePlate] = useState('');
  const [idCard, setIdCard] = useState('');
  const [activeDelivery, setActiveDelivery] = useState(0);
  const [totalDelivery, setTotalDelivery] = useState(0);
  const [avgRating, setAvgRating] = useState(5.0);
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

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users/me');
      const realUser = response.data?.data;
      if (realUser) {
        setName(realUser.fullName || '');
        setPhone(realUser.phone || '');
        setVehicleType(realUser.vehicleType || 'MOTORBIKE');
        setLicensePlate(realUser.licensePlate || '');
        setIdCard(realUser.idCard || 'Chưa cung cấp');
        setActiveDelivery(realUser.activeDelivery || 0);
        setTotalDelivery(realUser.totalDelivery || 0);
        setAvgRating(realUser.avgRating || 5.0);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thông tin hồ sơ tài xế:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Vui lòng nhập Họ và tên!');
      return;
    }
    // Dùng validatePhone (0 + 10 số) thay vì chỉ đếm độ dài -> chặn cả chữ và số 11 ký tự.
    if (!validatePhone(phone)) {
      toast.warning('Số điện thoại không hợp lệ (bắt đầu bằng số 0 và gồm 10 chữ số)!');
      return;
    }
    if (!licensePlate.trim()) {
      toast.warning('Vui lòng nhập biển số xe!');
      return;
    }

    setUpdating(true);
    try {
      const response = await apiClient.put('/users/profile', {
        fullName: name.trim(),
        phone: phone.trim(),
        vehicleType: vehicleType,
        licensePlate: licensePlate.trim()
      });
      
      // Đồng bộ vào local store
      updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        vehicleType: vehicleType,
        licensePlate: licensePlate.trim()
      });
      
      toast.success('Đã cập nhật hồ sơ cá nhân và thông tin phương tiện thành công!');
    } catch (err) {
      console.error('Lỗi khi cập nhật hồ sơ shipper:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật hồ sơ.');
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
      <h1 className="text-xl font-bold text-slate-800">Hồ sơ cá nhân</h1>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Shipper Avatar card — cover gradient + avatar đè lên + 3 thẻ thống kê */}
          <div className="bg-white rounded-radius-xl border border-slate-200/60 shadow-sm overflow-hidden relative animate-fade-in">
            {/* Cover gradient xanh shipper */}
            <div className="h-24 bg-gradient-to-br from-[#2E7D32] to-md-tertiary relative">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
              <Bike className="absolute right-4 bottom-3 text-white/20" size={40} />
            </div>

            <div className="px-6 pb-6 flex flex-col items-center text-center -mt-12">
              <div className="relative">
                <img
                  src={getAvatarUrl(user.avatar)}
                  alt="Shipper Avatar"
                  className="w-24 h-24 rounded-radius-full border-4 border-white object-cover shadow-md"
                />
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 bg-md-tertiary text-white rounded-radius-full shadow-sm hover:scale-105 transition-all cursor-pointer border-2 border-white flex items-center justify-center"
                >
                  {uploadingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Camera size={14} />
                  )}
                </button>
              </div>
              <h2 className="font-bold text-base text-slate-800 mt-3">{name}</h2>
              <span className="text-[10px] text-md-tertiary bg-[#E8F5E9] font-bold px-3 py-1 rounded-full uppercase mt-1.5 tracking-wider border border-[#C8E6C9] inline-flex items-center gap-1">
                {/* icon Trophy thay emoji 🏆 */}
                <Trophy size={11} /> TÀI XẾ {Number(avgRating).toFixed(1)} SAO
              </span>

              {/* Stats block: đang giao · hoàn thành · đánh giá */}
              <div className="grid grid-cols-3 gap-3 w-full mt-5 pt-5 border-t border-slate-100">
                <div className="bg-amber-50/60 rounded-2xl p-3 flex flex-col items-center border border-amber-100/50">
                  <Package size={16} className="text-amber-500" />
                  <span className="text-base font-black text-amber-500 mt-1.5 leading-none">{activeDelivery}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Đang giao</span>
                </div>
                <div className="bg-emerald-50/60 rounded-2xl p-3 flex flex-col items-center border border-emerald-100/50">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-base font-black text-emerald-500 mt-1.5 leading-none">{totalDelivery}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Hoàn thành</span>
                </div>
                <div className="bg-[#E8F5E9]/60 rounded-2xl p-3 flex flex-col items-center border border-[#C8E6C9]/50">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="text-base font-black text-md-tertiary mt-1.5 leading-none">{Number(avgRating).toFixed(1)}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Đánh giá</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form cập nhật hồ sơ */}
          <form onSubmit={handleSave} className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm space-y-5 animate-slide-up">
            
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-md-tertiary" />
              Thông tin tài khoản & Liên hệ
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Địa chỉ Email (Không thể thay đổi)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-350" size={16} />
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200/50 rounded-radius-lg text-xs text-slate-400 cursor-not-allowed font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Căn cước công dân (Đã xác minh hệ thống)
              </label>
              <div className="relative">
                <Clipboard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-355" size={16} />
                <input
                  type="text"
                  disabled
                  value={idCard}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200/50 rounded-radius-lg text-xs text-slate-400 cursor-not-allowed font-semibold"
                />
              </div>
            </div>

            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pt-4 pb-2 flex items-center gap-1.5">
              <Bike size={16} className="text-md-tertiary" />
              Thông tin phương tiện di chuyển
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Loại phương tiện
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
              >
                <option value="MOTORBIKE">Xe máy (Motorbike)</option>
                <option value="BICYCLE">Xe đạp (Bicycle)</option>
                <option value="CAR">Ô tô (Car)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Biển số xe / Biển kiểm soát
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 29E2-678.90..."
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full mt-4 bg-md-tertiary hover:bg-opacity-95 text-white font-bold py-3.5 px-4 rounded-radius-full shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
            >
              {updating ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Lưu thay đổi hồ sơ'
              )}
            </button>
          </form>
        </>
      )}

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 py-3.5 rounded-radius-full border border-red-200/50 transition-all active:scale-[0.99] cursor-pointer shadow-sm"
      >
        <LogOut size={15} />
        Đăng xuất khỏi hệ thống
      </button>
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