import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { User, Bike, Phone, LogOut, Camera, Mail, ShieldCheck, Clipboard, Trophy, Star, Package, CheckCircle2, Circle, MapPin, Lightbulb } from 'lucide-react';
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

    const plateRegex = /^[0-9]{2}[A-Z0-9]{1,4}[-.]?[0-9]{3,4}(\.[0-9]{2})?$/;
    if (!plateRegex.test(licensePlate.trim())) {
      toast.warning('Biển số xe không hợp lệ (Ví dụ: 29E2-678.90)!');
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

  // Mức độ hoàn thiện hồ sơ — suy từ các field THẬT đang có (avatar, tên, email, SĐT, CCCD, biển số)
  const idCardDone = !!idCard && idCard.trim() !== '' && idCard !== 'Chưa cung cấp';
  const profileChecks = [
    { label: 'Ảnh đại diện', done: !!user.avatar },
    { label: 'Họ và tên', done: !!name.trim() },
    { label: 'Email hợp lệ', done: !!email.trim() && validateEmail(email) },
    { label: 'Số điện thoại', done: !!phone.trim() },
    { label: 'CCCD/CMND', done: idCardDone },
    { label: 'Biển số xe', done: !!licensePlate.trim() },
  ];
  const doneCount = profileChecks.filter((c) => c.done).length;
  const profilePct = Math.round((doneCount / profileChecks.length) * 100);

  // Mẹo chạy đơn cho tài xế (thuần trình bày)
  const shipperTips = [
    { icon: Bike, text: 'Cập nhật đúng loại xe & biển số để nhận đơn phù hợp tuyến đường.' },
    { icon: Star, text: 'Giao đúng giờ, thái độ thân thiện để giữ điểm đánh giá cao.' },
    { icon: MapPin, text: 'Bật định vị khi nhận đơn giúp tối ưu lộ trình, giao nhanh hơn.' },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans pb-24">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-9 h-9 rounded-radius-lg bg-md-tertiary/10 text-md-tertiary flex items-center justify-center">
          <User size={18} />
        </span>
        <h1 className="text-xl font-bold text-slate-800">Hồ Sơ Cá Nhân</h1>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
        <div className="grid lg:grid-cols-5 gap-6 items-stretch">

          {/* ═══ CỘT TRÁI: thẻ hồ sơ + hoàn thiện (giãn khớp chiều cao cột phải) ═══ */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Thẻ hồ sơ với banner tài xế đạp xe chạy ngang (phong cách shipper) */}
            <Card variant="flat" className="border-slate-200/60 shadow-sm relative overflow-hidden animate-fade-in">
              <div className="h-28 bg-gradient-to-br from-[#2E7D32] to-md-tertiary relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
                {/* Con đường nét đứt + tài xế đạp xe chạy qua (bánh quay, thân rung, vạch tốc độ) */}
                <div className="absolute bottom-4 left-3 right-3 border-t-2 border-dashed border-white/25" />
                <div className="absolute bottom-3 left-0 right-0 h-10 pointer-events-none">
                  <div className="absolute left-0 bottom-0 w-full animate-ride">
                    <div className="relative inline-block animate-vroom text-white">
                      {/* Vạch tốc độ loé sau đuôi */}
                      <span className="absolute top-2 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '0ms' }} />
                      <span className="absolute top-4 -left-4 h-[2px] w-5 rounded-full bg-white/40 animate-speed" style={{ animationDelay: '200ms' }} />
                      <span className="absolute top-6 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '420ms' }} />
                      {/* SVG tài xế đạp xe (tách bánh xe để quay) */}
                      <svg width="52" height="33" viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                        <rect x="13.5" y="9" width="11" height="10" rx="2" fill="rgba(255,255,255,0.2)" />
                        <path d="M13.5 13 H24.5 M18 9 V7 H21 V9" strokeWidth="1.6" />
                        <path d="M13 30 L30 30 L24 17 Z M30 30 L44 15 L51 30 M24 17 L44 15 M42 15 H47.5 M21 17 H26.5" />
                        <path d="M24 17 L30 30 M24 17 L36 8 L44 15" />
                        <circle cx="39" cy="5.4" r="3.2" />
                        <circle cx="13" cy="30" r="6" />
                        <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                          <path d="M13 25.4 V34.6 M8.4 30 H17.6 M9.7 26.7 L16.3 33.3 M16.3 26.7 L9.7 33.3" strokeWidth="1.3" />
                        </g>
                        <circle cx="51" cy="30" r="6" />
                        <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                          <path d="M51 25.4 V34.6 M46.4 30 H55.6 M47.7 26.7 L54.3 33.3 M54.3 26.7 L47.7 33.3" strokeWidth="1.3" />
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>
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
                  {[
                    { icon: Package, color: 'text-amber-500', bg: 'bg-amber-50/60 border-amber-100/50', value: activeDelivery, label: 'Đang giao' },
                    { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50/60 border-emerald-100/50', value: totalDelivery, label: 'Hoàn thành' },
                    { icon: Star, color: 'text-md-tertiary', bg: 'bg-[#E8F5E9]/60 border-[#C8E6C9]/50', value: Number(avgRating).toFixed(1), label: 'Đánh giá', starFill: true },
                  ].map((s, i) => (
                    <div key={s.label} style={{ animationDelay: `${i * 90}ms` }} className={`rounded-2xl p-3 flex flex-col items-center border animate-rise-in transition-transform hover:-translate-y-0.5 ${s.bg}`}>
                      <s.icon size={16} className={`animate-float ${s.color} ${s.starFill ? 'fill-amber-400 text-amber-400' : ''}`} style={{ animationDelay: `${i * 300}ms` }} />
                      <span className={`text-base font-black mt-1.5 leading-none ${s.color}`}>{s.value}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Hoàn thiện hồ sơ — thanh tiến độ + checklist field thật (flex-1 để giãn khớp đáy với form) */}
            <Card variant="flat" className="p-5 border-slate-200/60 shadow-sm animate-slide-up lg:flex-1 lg:flex lg:flex-col lg:justify-center">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-md-tertiary" /> Hoàn thiện hồ sơ
                </h3>
                <span className="text-sm font-black text-md-tertiary tabular-nums">{profilePct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#2E7D32] to-md-tertiary transition-all duration-700 ease-out" style={{ width: `${profilePct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4">
                {profileChecks.map((c) => (
                  <span key={c.label} className={`flex items-center gap-1.5 text-xs font-semibold ${c.done ? 'text-slate-600' : 'text-slate-400'}`}>
                    {c.done
                      ? <CheckCircle2 size={14} className="text-md-tertiary shrink-0" />
                      : <Circle size={14} className="text-slate-300 shrink-0" />}
                    {c.label}
                  </span>
                ))}
              </div>
              {profilePct < 100 && (
                <p className="text-[11px] text-slate-400 font-semibold mt-3 leading-relaxed">
                  Hồ sơ đầy đủ giúp quán và khách tin tưởng, dễ được giao đơn hơn.
                </p>
              )}
            </Card>
          </div>

          {/* ═══ CỘT PHẢI: form chỉnh sửa — top thẳng hàng với thẻ hồ sơ bên trái (bỏ nhãn eyebrow gây lệch) ═══ */}
          <div className="lg:col-span-3 flex flex-col">
            <Card variant="flat" className="p-5 md:p-6 border-slate-200/60 shadow-sm space-y-5 animate-slide-up lg:flex-1">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Địa chỉ Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Căn cước công dân
                </label>
                <div className="relative">
                  <Clipboard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          </div>
        </div>

        {/* Mẹo chạy đơn hiệu quả — dải đầy đủ chiều ngang dưới 2 cột */}
        <Card variant="flat" className="p-5 border-slate-200/60 shadow-sm mt-6 animate-slide-up">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5 mb-3">
            <Lightbulb size={16} className="text-amber-500" /> Mẹo chạy đơn hiệu quả
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {shipperTips.map((t, i) => (
              <div
                key={i}
                style={{ animationDelay: `${i * 120}ms` }}
                className="flex sm:flex-col items-start gap-2.5 sm:gap-2 p-3.5 rounded-radius-lg bg-slate-50/70 border border-slate-100 animate-rise-in transition-all hover:-translate-y-0.5 hover:border-md-tertiary/30 hover:bg-white"
              >
                <span className="shrink-0 p-1.5 rounded-radius-md bg-md-tertiary/10 text-md-tertiary animate-float" style={{ animationDelay: `${i * 250}ms` }}>
                  <t.icon size={14} />
                </span>
                <p className="text-xs text-slate-600 font-semibold leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Đăng xuất — dải ngang dưới cùng, cùng chiều rộng với Mẹo */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 !py-3.5 rounded-radius-full border-red-200/50 shadow-sm mt-6"
          icon={LogOut}
        >
          Đăng xuất khỏi hệ thống
        </Button>
        </>
      )}

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
