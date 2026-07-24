import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Bike, Phone, LogOut, Camera, Mail, ShieldCheck, Clipboard, Trophy, Star, Package, CheckCircle2 } from 'lucide-react';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { getAvatarUrl } from '../../utils/avatarHelper';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { validateEmail } from '../../utils/validation';
import { toast } from 'react-toastify';

export default function ShipperProfile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // States cho form chỉnh sửa
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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
        setEmail(realUser.email || '');
        setVehicleType(realUser.vehicleType || '');
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Vui lòng nhập Họ và tên!');
      return;
    }
    if (!email.trim()) {
      toast.warning('Vui lòng nhập email!');
      return;
    }
    if (!validateEmail(email)) {
      toast.warning('Email Không hợp lệ!');
      return;
    }

    if (!licensePlate.trim()) {
      toast.warning('Vui lòng nhập biển số xe!');
      return;
    }

    setUpdating(true);
    try {
      await apiClient.put('/users/profile', {
        fullName: name.trim(),
        email: email.trim(),
        vehicleType: vehicleType,
        licensePlate: licensePlate.trim()
      });
      
      updateProfile({
        name: name.trim(),
        email: email.trim(),
        vehicleType: vehicleType,
        licensePlate: licensePlate.trim()
      });
      
      toast.success('Đã cập nhật hồ sơ cá nhân thành công!');
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
      <h1 className="text-xl font-bold text-slate-800">Hồ Sơ Cá Nhân</h1>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card variant="flat" className="border-slate-200/60 shadow-sm relative animate-fade-in">
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
                <Button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  variant="secondary"
                  className="absolute bottom-0 right-0 !p-2 !w-auto !h-auto bg-md-tertiary text-white rounded-radius-full shadow-sm hover:scale-105 border-2 border-white"
                >
                  {uploadingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Camera size={14} />
                  )}
                </Button>
              </div>
              <h2 className="font-bold text-base text-slate-800 mt-3">{name}</h2>
              <span className="text-[10px] text-md-tertiary bg-[#E8F5E9] font-bold px-3 py-1 rounded-full uppercase mt-1.5 tracking-wider border border-[#C8E6C9] inline-flex items-center gap-1">
                <Trophy size={11} /> TÀI XẾ {Number(avgRating).toFixed(1)} SAO
              </span>

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
          </Card>

          <Card variant="flat" className="p-5 border-slate-200/60 shadow-sm space-y-5 animate-slide-up">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-md-tertiary" />
              Thông Tin Cá Nhân
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Địa chỉ Email 
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-350" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Số điện thoại 
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="tel"
                  readOnly
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Căn cước công dân 
              </label>
              <div className="relative">
                <Clipboard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-355" size={16} />
                <input
                  type="text"
                  readOnly
                  value={idCard}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>
            </div>

            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pt-4 pb-2 flex items-center gap-1.5">
              <Bike size={16} className="text-md-tertiary" />
              Thông Tin Phương Tiện Di Chuyển
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
                <option value="ALL">Tất cả</option>
                <option value="MOTORBIKE">Xe máy</option>
                <option value="CAR">Ô tô</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Biển số xe
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 29E2-678.90"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-tertiary focus:bg-white transition-all font-semibold text-slate-700"
              />
            </div>

            <Button
              type="button"
              onClick={handleSave}
              loading={updating}
              className="w-full mt-4 !bg-md-tertiary text-white font-bold !py-3.5 !px-4 rounded-radius-full shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all text-xs uppercase tracking-wider"
            >
              Cập Nhật Hồ Sơ
            </Button>
          </Card>
        </>
      )}

      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 !py-3.5 rounded-radius-full border-red-200/50 shadow-sm"
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
    </div>
  );
}