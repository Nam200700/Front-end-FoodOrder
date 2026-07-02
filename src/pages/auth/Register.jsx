import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, Lock, User, Phone, ChevronRight, Store, Bike, FileText, MapPin, Lightbulb } from 'lucide-react';
import { validatePhone, validatePassword } from '../../utils/validation';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import MapModal from '../../components/common/MapModal';
import { toast } from 'react-toastify';

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState('CUSTOMER'); // CUSTOMER, OWNER, SHIPPER
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Owner additional info
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantLat, setRestaurantLat] = useState(10.762622);
  const [restaurantLng, setRestaurantLng] = useState(106.660172);
  const [openMap, setOpenMap] = useState(false);
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantDescription, setRestaurantDescription] = useState('');

  // Shipper additional info
  const [idCard, setIdCard] = useState('');
  const [vehicleType, setVehicleType] = useState('MOTORBIKE');
  const [licensePlate, setLicensePlate] = useState('');

  const [loading, setLoading] = useState(false);

  const handleConfirmLocation = (lat, lng, address) => {
    setRestaurantAddress(address);
    setRestaurantLat(lat);
    setRestaurantLng(lng);
  };
  const [errors, setErrors] = useState({});

  const handlePhoneBlur = () => {
    if (!validatePhone(phone)) {
      setErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).' }));
    } else {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.phone;
        return copy;
      });
    }
  };

  const handlePasswordBlur = () => {
    if (!validatePassword(password)) {
      setErrors(prev => ({ ...prev, password: 'Mật khẩu phải chứa ít nhất 8 ký tự.' }));
    } else {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.password;
        return copy;
      });
    }
  };

  const register = useAuthStore((state) => state.register);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const localErrors = {};
    if (!validatePhone(phone)) {
      localErrors.phone = 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).';
    }
    if (!validatePassword(password)) {
      localErrors.password = 'Mật khẩu phải chứa ít nhất 8 ký tự.';
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setLoading(false);
      return;
    }

    let additionalData = {};
    if (role === 'OWNER') {
      additionalData = {
        restaurantName,
        restaurantAddress,
        restaurantLatitude: restaurantLat,
        restaurantLongitude: restaurantLng,
        restaurantPhone,
        restaurantDescription,
      };
    } else if (role === 'SHIPPER') {
      additionalData = {
        idCard,
        vehicleType,
        licensePlate,
      };
    }

    const res = await register(name, phone, email, password, role, additionalData);
    setLoading(false);

    if (res.success) {
      toast.success('Đăng ký tài khoản thành công! Vui lòng xác thực mã OTP đã được gửi tới email của bạn.');
      navigate('/register/otp', { state: { email, role, name, phone } });
    } else {
      if (res.validationErrors) {
        setErrors(res.validationErrors);
      } else {
        const msg = res.error || '';
        const code = res.errorCode;
        if (code === 'PHONE_EXISTS' || msg.includes('Số điện thoại') || msg.toLowerCase().includes('phone')) {
          setErrors({ phone: 'Số điện thoại này đã được đăng ký trên hệ thống!' });
        } else if (code === 'EMAIL_EXISTS' || msg.includes('Email') || msg.toLowerCase().includes('email')) {
          setErrors({ email: 'Email này đã được sử dụng bởi một tài khoản khác!' });
        } else {
          toast.error(msg);
        }
      }
    }
  };

  const roles = [
    { id: 'CUSTOMER', label: 'Khách Hàng', desc: 'Đặt đồ ăn giao tận nơi', icon: User, color: 'border-md-primary text-md-primary bg-md-primary-container/10' },
    { id: 'OWNER', label: 'Quán Ăn', desc: 'Bán đồ ăn trên hệ thống', icon: Store, color: 'border-md-secondary text-md-secondary bg-md-secondary-container/10' },
    { id: 'SHIPPER', label: 'Tài Xế', desc: 'Giao đồ ăn kiếm thu nhập', icon: Bike, color: 'border-md-tertiary text-md-tertiary bg-md-tertiary-container/10' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4 sm:p-6 font-google-sans relative overflow-hidden">
      
      {/* ─── PREMIUM MESH ORBS DECOR (Aesthetic Glow) ─────────────────────────── */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#FF6B35]/25 to-[#FF6B35]/5 rounded-full blur-3xl opacity-60 animate-pulse-slow"></div>
      <div className="absolute -bottom-48 -right-48 w-[32rem] h-[32rem] bg-gradient-to-tr from-[#1A73E8]/15 to-[#1A73E8]/5 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-slate-100/30 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* ─── DOUBLE-BEZEL CARD CONTAINER (Doppelrand Architecture) ───────────────── */}
      <div className="w-full max-w-2xl p-2.5 bg-slate-100/70 border border-slate-200/50 rounded-[2.25rem] shadow-shadow-2 relative overflow-hidden animate-slide-up z-10">
        
        {/* Core Inner Container */}
        <div className="bg-white rounded-[calc(2.25rem-0.625rem)] p-8 sm:p-10 relative overflow-hidden shadow-sm border border-slate-100/50 flex flex-col">
          
          {/* Decorative highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"></div>

          {/* ─── BRAND LOGO & HEADER ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#FF6B35] to-[#1A73E8] rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-shadow-3 mb-4.5 hover:scale-105 active:scale-95 transition-all cursor-pointer">
              MD
            </div>
            
            {/* Eyebrow Tag */}
            <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-sm border border-slate-200/40">
              Hệ thống MealDash
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-4.5 tracking-tight text-center">
              Tạo tài khoản mới
            </h2>
            <p className="text-xs sm:text-sm text-slate-450 mt-2 text-center font-semibold max-w-sm leading-relaxed">
              Tham gia cộng đồng ứng dụng đặt đồ ăn <span className="text-[#FF6B35] font-extrabold">Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span>
            </p>
          </div>

          {/* ─── ROLE SELECTION ───────────────────────────────────────────────────── */}
          <div className="mb-8 relative z-10">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 mb-4 text-center">
              Bạn muốn tham gia với vai trò nào?
            </label>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {roles.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                
                // Customize border, background and text colors based on active role
                let activeColorClasses = "";
                if (r.id === 'CUSTOMER') {
                  activeColorClasses = isActive 
                    ? "border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35] shadow-[0_4px_16px_rgba(255,107,53,0.06)]"
                    : "border-slate-200/50 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700";
                } else if (r.id === 'OWNER') {
                  activeColorClasses = isActive
                    ? "border-[#1A73E8] bg-[#1A73E8]/5 text-[#1A73E8] shadow-[0_4px_16px_rgba(26,115,232,0.06)]"
                    : "border-slate-200/50 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700";
                } else if (r.id === 'SHIPPER') {
                  activeColorClasses = isActive
                    ? "border-[#34A853] bg-[#34A853]/5 text-[#34A853] shadow-[0_4px_16px_rgba(52,168,83,0.06)]"
                    : "border-slate-200/50 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700";
                }

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center p-3.5 sm:p-4.5 rounded-radius-xl border text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${activeColorClasses}`}
                  >
                    <Icon size={24} className="mb-2 shrink-0 stroke-[2px]" />
                    <span className="text-xs sm:text-sm font-extrabold block leading-tight">{r.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-1.5 hidden sm:block font-semibold">{r.desc}</span>
                  </button>
                );
              })}
            </div>
            
            {role !== 'CUSTOMER' && (
              <p className="text-[10px] sm:text-xs text-amber-600 font-bold mt-4 text-center bg-amber-50/70 border border-amber-100/60 p-3 rounded-radius-lg leading-relaxed shadow-sm inline-flex items-start gap-1.5">
                <Lightbulb size={13} className="shrink-0 mt-0.5" /> <span><span className="font-extrabold">Lưu ý:</span> Hồ sơ đăng ký làm đối tác sẽ được gửi trực tiếp đến Admin phê duyệt. Vui lòng cung cấp chính xác thông tin để được duyệt sớm nhất!</span>
              </p>
            )}
          </div>

          {/* ─── REGISTER FORM ────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <Input
              label="Họ và tên"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A..."
              icon={User}
              error={errors.fullName}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Địa chỉ Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@example.com..."
                icon={Mail}
                error={errors.email}
              />

              <Input
                label="Số điện thoại"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="0901234567..."
                icon={Phone}
                error={errors.phone}
              />
            </div>

            <Input
              label="Mật khẩu"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              placeholder="Tối thiểu 8 ký tự"
              icon={Lock}
              error={errors.password}
            />

            {/* ─── ADDITIONAL FIELDS FOR OWNER ─────────────────────────────────────── */}
            {role === 'OWNER' && (
              <div className="space-y-5 border-t border-slate-100 pt-5 mt-5 animate-fade-in">
                <h3 className="text-[10px] font-extrabold text-[#1A73E8] uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={12} /> THÔNG TIN HỒ SƠ QUÁN ĂN (ĐỐI TÁC)
                </h3>
                
                <Input
                  label="Tên Quán Ăn"
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ví dụ: Cơm Tấm Sài Gòn..."
                  icon={Store}
                  error={errors.restaurantName}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Số Điện Thoại Quán Ăn"
                    type="tel"
                    required
                    value={restaurantPhone}
                    onChange={(e) => setRestaurantPhone(e.target.value)}
                    placeholder="Để khách liên hệ..."
                    icon={Phone}
                    error={errors.restaurantPhone}
                  />
                  
                  <div className="cursor-pointer" onClick={() => setOpenMap(true)}>
                    <Input
                      label="Địa Chi Quán Ăn (Nhấn để chọn bản đồ)"
                      type="text"
                      required
                      readOnly
                      value={restaurantAddress}
                      placeholder="Chọn vị trí quán ăn trên bản đồ..."
                      icon={MapPin}
                      error={errors.restaurantAddress}
                      className="cursor-pointer bg-slate-50"
                    />
                  </div>
                </div>

                <Input
                  label="Mô Tả Ngắn Về Quán"
                  type="text"
                  value={restaurantDescription}
                  onChange={(e) => setRestaurantDescription(e.target.value)}
                  placeholder="Món ăn đặc sắc, phong cách..."
                  icon={FileText}
                  error={errors.restaurantDescription}
                />
              </div>
            )}

            {/* ─── ADDITIONAL FIELDS FOR SHIPPER ────────────────────────────────────── */}
            {role === 'SHIPPER' && (
              <div className="space-y-5 border-t border-slate-100 pt-5 mt-5 animate-fade-in">
                <h3 className="text-[10px] font-extrabold text-[#34A853] uppercase tracking-widest flex items-center gap-1.5">
                  <Bike size={12} /> THÔNG TIN HỒ SƠ TÀI XẾ (SHIPPER)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Số CCCD / CMND"
                    type="text"
                    required
                    value={idCard}
                    onChange={(e) => setIdCard(e.target.value)}
                    placeholder="Số CCCD 12 số..."
                    icon={FileText}
                    error={errors.idCard}
                  />

                  <Input
                    label="Biển Số Xe"
                    type="text"
                    required
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="Ví dụ: 29A1-12345..."
                    icon={Bike}
                    error={errors.licensePlate}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                    Loại Phương Tiện
                  </label>
                  <div className="relative">
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-radius-lg p-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700"
                    >
                      <option value="MOTORBIKE">Xe Máy (Motorbike)</option>
                      <option value="BICYCLE">Xe Đạp (Bicycle)</option>
                      <option value="CAR">Ô Tô (Car)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-450 leading-relaxed font-bold pt-1">
              Bằng việc nhấn Đăng ký, bạn đồng ý với các{' '}
              <a href="#terms" className="text-[#FF6B35] font-extrabold hover:underline">Điều khoản Dịch vụ</a> và{' '}
              <a href="#privacy" className="text-[#FF6B35] font-extrabold hover:underline">Chính sách Bảo mật</a> của chúng tôi.
            </div>

            {/* Tactical Button-in-Button CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF6B35]/95 hover:from-[#ff7947] hover:to-[#FF6B35] text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group mt-6"
            >
              <span className="uppercase tracking-wider text-xs">
                {loading ? 'Đang đăng ký...' : 'Đăng Ký Tài Khoản'}
              </span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
                <ChevronRight size={18} className="stroke-[2.5px]" />
              </div>
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 text-center text-xs sm:text-sm text-slate-500 relative z-10 font-semibold">
            Đã có tài khoản?{' '}
            <button 
              onClick={() => navigate('/login')} 
              className="text-[#FF6B35] font-extrabold hover:underline cursor-pointer"
            >
              Đăng nhập
            </button>
          </div>

        </div>
      </div>
      
      <MapModal
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        onConfirm={handleConfirmLocation}
      />
    </div>
  );
}
