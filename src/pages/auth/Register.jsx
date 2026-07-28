import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, Lock, User, Phone, ChevronRight, ChevronLeft, Store, Bike, FileText, MapPin, Lightbulb, Users, Check, ShieldCheck, ChefHat, Soup, UtensilsCrossed, TrendingUp, Wallet, Route, Hand, Pizza, IceCream, Sparkles } from 'lucide-react';
import { validatePhone, validatePassword, validateName, validateEmail, validateIdCard } from '../../utils/validation';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import MapModal from '../../components/common/MapModal';
import { toast } from 'react-toastify';

// Panel hero ĐỔI THEO VAI TRÒ (màu + tiêu đề + icon + lợi ích) → hero "sống", ăn khớp bước chọn role.
// Gradient để tông sâu, bớt chói (bài học chống chói ở Login); lợi ích là MÔ TẢ TÍNH NĂNG thật, không số bịa.
const ROLE_HERO = {
  CUSTOMER: {
    tag: 'Khách hàng', Icon: User, ride: Bike, hi: Soup,
    grad: 'linear-gradient(135deg,#EF6C33 0%,#D9491C 45%,#A62D14 100%)',
    head: ['Đặt món ngon,', 'giao tận cửa'],
    sub: 'Khám phá món yêu thích từ nhiều quán và đặt hàng chỉ trong vài chạm.',
    benefits: [
      { Icon: UtensilsCrossed, label: 'Kho món đa dạng từ nhiều quán' },
      { Icon: MapPin, label: 'Theo dõi đơn hàng trực quan' },
      { Icon: ShieldCheck, label: 'Thanh toán an toàn, minh bạch' },
    ],
  },
  OWNER: {
    tag: 'Quán ăn', Icon: Store, ride: Bike, hi: TrendingUp,
    grad: 'linear-gradient(135deg,#3B82F6 0%,#1D66D6 45%,#124A9E 100%)',
    head: ['Bán hàng &', 'tăng doanh thu'],
    sub: 'Đưa quán của bạn lên nền tảng, tiếp cận thêm nhiều thực khách mới.',
    benefits: [
      { Icon: Store, label: 'Quản lý thực đơn & đơn hàng' },
      { Icon: TrendingUp, label: 'Theo dõi doanh thu & thống kê' },
      { Icon: Users, label: 'Tiếp cận nhiều khách hàng hơn' },
    ],
  },
  SHIPPER: {
    tag: 'Tài xế', Icon: Bike, ride: Bike, hi: Bike,
    grad: 'linear-gradient(135deg,#3DBE6A 0%,#2A9D54 45%,#1C7A3F 100%)',
    head: ['Chạy đơn,', 'kiếm thu nhập'],
    sub: 'Nhận đơn linh hoạt theo thời gian của bạn, chủ động nguồn thu nhập.',
    benefits: [
      { Icon: Bike, label: 'Nhận đơn linh hoạt' },
      { Icon: Route, label: 'Lộ trình giao hàng rõ ràng' },
      { Icon: Wallet, label: 'Chủ động thu nhập mỗi ngày' },
    ],
  },
};

// Món ăn + đốm lấp lánh trang trí nền hero
const REG_DECOR = [
  { Icon: Pizza, wrap: 'top-[14%] right-[10%]', size: 26, delay: '0ms', anim: 'animate-drift' },
  { Icon: IceCream, wrap: 'top-[46%] left-[9%]', size: 22, delay: '500ms', anim: 'animate-float-slow' },
];
const REG_SPARKLES = [
  { wrap: 'top-[22%] left-[16%]', size: 13, delay: '0ms' },
  { wrap: 'top-[58%] right-[16%]', size: 11, delay: '800ms' },
  { wrap: 'bottom-[34%] right-[30%]', size: 12, delay: '1300ms' },
];

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
  const [step, setStep] = useState(1); // Chia form thành 3 bước để tránh cảm giác "ngộp" khi nhập một lượt

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

  const handleNameBlur = () => {
    if (!validateName(name)) {
      setErrors(prev => ({ ...prev, fullName: 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).' }));
    } else {
      setErrors(prev => { const copy = { ...prev }; delete copy.fullName; return copy; });
    }
  };

  const handleEmailBlur = () => {
    if (!validateEmail(email)) {
      setErrors(prev => ({ ...prev, email: 'Email không hợp lệ (ví dụ: ten@example.com).' }));
    } else {
      setErrors(prev => { const copy = { ...prev }; delete copy.email; return copy; });
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

  // Gỡ 1 lỗi field khỏi state khi giá trị đã hợp lệ (dùng chung cho các field đối tác)
  const clearError = (key) => setErrors(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));

  // ── onBlur cho field đối tác: báo lỗi ngay khi rời ô cho nhất quán với Họ tên/Email/SĐT ──
  const handleRestaurantNameBlur = () =>
    restaurantName.trim() ? clearError('restaurantName') : setError('restaurantName', 'Vui lòng nhập tên quán ăn.');
  const handleRestaurantPhoneBlur = () =>
    validatePhone(restaurantPhone) ? clearError('restaurantPhone') : setError('restaurantPhone', 'Số điện thoại quán không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số).');
  const handleIdCardBlur = () =>
    validateIdCard(idCard) ? clearError('idCard') : setError('idCard', 'CCCD/CMND phải gồm 9 hoặc 12 chữ số.');
  const handleLicensePlateBlur = () =>
    licensePlate.trim() ? clearError('licensePlate') : setError('licensePlate', 'Vui lòng nhập biển số xe.');

  const register = useAuthStore((state) => state.register);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enter/submit khi chưa ở bước cuối thì chỉ đi tiếp, không gửi đăng ký sớm
    if (step !== 3) { goNext(); return; }
    setLoading(true);
    setErrors({});

    const localErrors = {};
    if (!validateName(name)) {
      localErrors.fullName = 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).';
    }
    if (!validateEmail(email)) {
      localErrors.email = 'Email không hợp lệ (ví dụ: ten@example.com).';
    }
    if (!validatePhone(phone)) {
      localErrors.phone = 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).';
    }
    if (!validatePassword(password)) {
      localErrors.password = 'Mật khẩu phải chứa ít nhất 8 ký tự.';
    }
    // Field bắt buộc riêng cho đối tác (Owner/Shipper) để không gửi hồ sơ thiếu thông tin lên Admin
    if (role === 'OWNER') {
      if (!restaurantName.trim()) localErrors.restaurantName = 'Vui lòng nhập tên quán ăn.';
      if (!validatePhone(restaurantPhone)) localErrors.restaurantPhone = 'Số điện thoại quán không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số).';
      if (!restaurantAddress.trim()) localErrors.restaurantAddress = 'Vui lòng chọn địa chỉ quán trên bản đồ.';
    } else if (role === 'SHIPPER') {
      if (!validateIdCard(idCard)) localErrors.idCard = 'CCCD/CMND phải gồm 9 hoặc 12 chữ số.';
      if (!licensePlate.trim()) localErrors.licensePlate = 'Vui lòng nhập biển số xe.';
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
        // Nếu lỗi rơi vào field cơ bản (bước 2) thì đưa người dùng về đúng bước để sửa
        if (['fullName', 'email', 'phone', 'password'].some((k) => res.validationErrors[k])) setStep(2);
      } else {
        const msg = res.error || '';
        const code = res.errorCode;
        if (code === 'PHONE_EXISTS' || msg.includes('Số điện thoại') || msg.toLowerCase().includes('phone')) {
          setErrors({ phone: 'Số điện thoại này đã được đăng ký trên hệ thống!' });
          setStep(2);
        } else if (code === 'EMAIL_EXISTS' || msg.includes('Email') || msg.toLowerCase().includes('email')) {
          setErrors({ email: 'Email này đã được sử dụng bởi một tài khoản khác!' });
          setStep(2);
        } else if (code === 'ID_CARD_EXISTS' || msg.includes('CCCD')) {
          setErrors({ idCard: 'Số CCCD/CMND này đã được sử dụng để đăng ký tài khoản khác!' });
        } else if (code === 'LICENSE_PLATE_EXISTS' || msg.includes('Biển số xe')) {
          setErrors({ licensePlate: 'Biển số xe này đã được đăng ký bởi tài xế khác!' });
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

  // Màu nhấn của wizard đổi theo vai trò đang chọn (đồng bộ nhận diện role)
  const ROLE_THEME = { CUSTOMER: '#FF6B35', OWNER: '#1A73E8', SHIPPER: '#34A853' };
  const accent = ROLE_THEME[role];
  const hero = ROLE_HERO[role]; // dữ liệu panel hero theo vai trò đang chọn
  const roleLabel = roles.find((r) => r.id === role)?.label || '';
  const STEPS = [
    { id: 1, label: 'Vai trò', icon: Users },
    { id: 2, label: 'Tài khoản', icon: User },
    { id: 3, label: 'Hoàn tất', icon: ShieldCheck },
  ];

  // Kiểm tra 4 field cơ bản trước khi cho qua bước tiếp theo (chặn đi tiếp khi còn lỗi)
  const validateStep2 = () => {
    const le = {};
    if (!validateName(name)) le.fullName = 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).';
    if (!validateEmail(email)) le.email = 'Email không hợp lệ (ví dụ: ten@example.com).';
    if (!validatePhone(phone)) le.phone = 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).';
    if (!validatePassword(password)) le.password = 'Mật khẩu phải chứa ít nhất 8 ký tự.';
    setErrors(le);
    return Object.keys(le).length === 0;
  };

  const goNext = () => {
    if (step === 2 && !validateStep2()) return; // ở bước Tài khoản phải hợp lệ mới qua bước cuối
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-google-sans relative overflow-hidden">

      {/* Soft ambient orbs nền */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#FF6B35]/20 to-[#FF6B35]/5 rounded-full blur-3xl opacity-60 animate-pulse-slow"></div>
      <div className="absolute -bottom-48 -right-48 w-[32rem] h-[32rem] bg-gradient-to-tr from-[#1A73E8]/15 to-[#1A73E8]/5 rounded-full blur-3xl opacity-50"></div>

      {/* ═══ CARD 2 CỘT (hero trái đổi theo role + form phải) ═══ */}
      <div className="w-full max-w-5xl bg-white rounded-[2rem] shadow-shadow-4 border border-slate-200/60 overflow-hidden grid lg:grid-cols-2 relative z-10 animate-slide-up">

        {/* ───── PANEL HERO SỐNG ĐỘNG (đổi màu/nội dung theo vai trò, chỉ desktop) ───── */}
        <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-10 text-white transition-all duration-500" style={{ backgroundImage: hero.grad }}>

          {/* Lớp dịu chống chói + hoạ tiết + vệt sáng */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,transparent_38%,rgba(0,0,0,0.30)_100%)]"></div>
          <div className="absolute inset-0 pointer-events-none opacity-[0.13] bg-[radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
          <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none"></div>
          {REG_DECOR.map(({ Icon, wrap, size, delay, anim }, i) => (
            <Icon key={i} size={size} style={{ animationDelay: delay }} className={`absolute ${wrap} text-white/20 ${anim} pointer-events-none`} />
          ))}
          {REG_SPARKLES.map(({ wrap, size, delay }, i) => (
            <Sparkles key={`s${i}`} size={size} style={{ animationDelay: delay }} className={`absolute ${wrap} text-white/70 animate-twinkle pointer-events-none`} />
          ))}

          {/* Tô đồ ăn bốc khói (chuyển động hơi nóng như thật) */}
          <div className="absolute top-[24%] right-[16%] z-0 pointer-events-none">
            <div className="relative">
              <span className="absolute -top-3 left-1.5 w-[3px] h-3 rounded-full bg-white/60 animate-steam" style={{ animationDelay: '0ms' }}></span>
              <span className="absolute -top-3.5 left-3 w-[3px] h-3.5 rounded-full bg-white/50 animate-steam" style={{ animationDelay: '700ms' }}></span>
              <span className="absolute -top-3 left-[18px] w-[3px] h-3 rounded-full bg-white/60 animate-steam" style={{ animationDelay: '1300ms' }}></span>
              <Soup size={30} className="text-white/35" />
            </div>
          </div>

          {/* Brand + tay vẫy */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg animate-float">
              <ChefHat size={22} />
            </div>
            <span className="text-xl font-extrabold tracking-tight">MealDash</span>
            <Hand size={18} className="text-amber-200 animate-wiggle origin-bottom ml-0.5" />
          </div>

          {/* Tiêu đề + icon vai trò (đổi theo role, re-animate nhờ key) */}
          <div className="relative z-10 my-8" key={role}>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] bg-white/15 border border-white/25 px-3 py-1 rounded-full animate-rise-in">
              <hero.Icon size={12} /> Đăng ký · {hero.tag}
            </span>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight mt-4 drop-shadow-sm animate-rise-in" style={{ animationDelay: '70ms' }}>
              {hero.head[0]}<br />{hero.head[1]} <hero.hi size={30} className="inline-block align-middle -mt-1.5 text-white/80" />
            </h1>
            <p className="text-sm text-white/85 font-semibold mt-3 max-w-xs leading-relaxed animate-rise-in" style={{ animationDelay: '140ms' }}>
              {hero.sub}
            </p>
          </div>

          {/* Lợi ích theo vai trò */}
          <div className="relative z-10 space-y-3" key={`b-${role}`}>
            {hero.benefits.map(({ Icon, label }, i) => (
              <div key={i} className="group flex items-center gap-3 animate-rise-in" style={{ animationDelay: `${210 + i * 80}ms` }}>
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/15 flex items-center justify-center shrink-0 transition-all group-hover:bg-white/25 group-hover:scale-110">
                  <Icon size={17} />
                </div>
                <span className="text-sm font-bold text-white/95">{label}</span>
              </div>
            ))}

            {/* Lộ trình giao hàng: shipper đạp xe CHÂN THẬT (bánh quay + thân rung + gia tốc + vạch tốc độ) */}
            <div className="relative h-16 mt-4">
              {/* Mặt đường + đích đến */}
              <div className="absolute bottom-4 left-1 right-6 border-t-2 border-dashed border-white/30"></div>
              <MapPin size={20} className="absolute bottom-2.5 right-0 text-white/85" />

              {/* Shipper di chuyển theo gia tốc */}
              <div className="absolute bottom-3 left-0 animate-courier">
                <div className="relative animate-vroom">
                  {/* Vạch tốc độ loé sau đuôi */}
                  <span className="absolute top-2 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '0ms' }}></span>
                  <span className="absolute top-4 -left-4 h-[2px] w-5 rounded-full bg-white/40 animate-speed" style={{ animationDelay: '200ms' }}></span>
                  <span className="absolute top-6 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '420ms' }}></span>

                  {/* SVG shipper đạp xe (tự vẽ để tách được bánh xe cho quay) */}
                  <svg width="46" height="29" viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-md">
                    {/* Hộp giao hàng trên giá sau */}
                    <rect x="13.5" y="9" width="11" height="10" rx="2" fill="rgba(255,255,255,0.18)" />
                    <path d="M13.5 13 H24.5 M18 9 V7 H21 V9" strokeWidth="1.6" />

                    {/* Khung xe đạp */}
                    <path d="M13 30 L30 30 L24 17 Z M30 30 L44 15 L51 30 M24 17 L44 15 M42 15 H47.5 M21 17 H26.5" />

                    {/* Người giao (nghiêng về trước) */}
                    <path d="M24 17 L30 30 M24 17 L36 8 L44 15" />
                    <circle cx="39" cy="5.4" r="3.2" />

                    {/* Bánh sau: vành cố định + nan hoa quay */}
                    <circle cx="13" cy="30" r="6" />
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                      <path d="M13 25.4 V34.6 M8.4 30 H17.6 M9.7 26.7 L16.3 33.3 M16.3 26.7 L9.7 33.3" strokeWidth="1.3" />
                    </g>

                    {/* Bánh trước */}
                    <circle cx="51" cy="30" r="6" />
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                      <path d="M51 25.4 V34.6 M46.4 30 H55.6 M47.7 26.7 L54.3 33.3 M54.3 26.7 L47.7 33.3" strokeWidth="1.3" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───── PANEL FORM (phải) ───── */}
        <div className="p-8 sm:p-10 relative overflow-hidden flex flex-col">
          {/* Decorative highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>

          {/* ─── BRAND LOGO & HEADER ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center lg:items-start mb-6 relative z-10">
            {/* Logo chỉ hiện ở mobile (desktop đã có ở hero) */}
            <div className="lg:hidden w-14 h-14 bg-gradient-to-tr from-[#FF6B35] to-[#1A73E8] rounded-2xl flex items-center justify-center text-white shadow-shadow-3 mb-4 animate-float">
              <ChefHat size={26} />
            </div>

            {/* Eyebrow Tag */}
            <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-sm border border-slate-200/40">
              Hệ thống MealDash
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-4 tracking-tight text-center lg:text-left">
              Tạo tài khoản mới
            </h2>
            {/* Phụ đề đổi theo từng bước để dẫn dắt, tránh dồn thông tin */}
            <p className="text-xs sm:text-sm text-slate-400 mt-2 text-center lg:text-left font-semibold max-w-sm leading-relaxed">
              {step === 1 && <>Chọn vai trò để tham gia <span className="text-[#FF6B35] font-extrabold">Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span></>}
              {step === 2 && 'Điền thông tin đăng nhập cơ bản của bạn'}
              {step === 3 && (role === 'CUSTOMER' ? 'Kiểm tra lại thông tin và hoàn tất đăng ký' : 'Bổ sung hồ sơ đối tác để gửi Admin duyệt')}
            </p>
          </div>

          {/* ─── STEPPER NÂNG CẤP (thanh nối chạy fill, halo nhấp nháy, tích bật ra) ─── */}
          <div className="mb-8 relative z-10">
            {/* Nhãn tiến trình + bộ đếm bước */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Tiến trình đăng ký</span>
              <span className="text-[10px] font-extrabold tabular-nums" style={{ color: accent }}>Bước {step}/{STEPS.length}</span>
            </div>

            <div className="flex items-center px-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = step > s.id;
                const active = step === s.id;
                const on = done || active;
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      {/* Vòng tròn bước + halo lan toả khi active */}
                      <div className="relative w-9 h-9">
                        {active && (
                          <span className="absolute inset-0 rounded-full border-2 animate-halo pointer-events-none" style={{ borderColor: accent }}></span>
                        )}
                        <div
                          className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all duration-300"
                          style={{
                            backgroundColor: on ? accent : '#e2e8f0',
                            color: on ? '#fff' : '#94a3b8',
                            transform: active ? 'scale(1.14)' : 'scale(1)',
                            boxShadow: active ? `0 6px 16px ${accent}55` : undefined,
                          }}
                        >
                          {/* Đổi icon↔tích có key để bật ra (pop) khi trạng thái đổi */}
                          <span key={done ? 'check' : 'icon'} className="flex animate-scale-up">
                            {done ? <Check size={16} className="stroke-[3px]" /> : <Icon size={16} />}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide transition-colors duration-300" style={{ color: on ? accent : '#94a3b8' }}>
                        {s.label}
                      </span>
                    </div>

                    {/* Thanh nối: track xám + fill chạy 0→100%; khi hoàn thành có VỆT SÁNG CHẢY như dòng nước */}
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-1.5 mx-2 -mt-5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="relative h-full rounded-full overflow-hidden transition-all duration-500 ease-out"
                          style={{ width: step > s.id ? '100%' : '0%', backgroundColor: accent }}
                        >
                          {step > s.id && (
                            <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-flow" />
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ─── REGISTER FORM (theo bước) ────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="relative z-10">

            {/* ═══ BƯỚC 1: CHỌN VAI TRÒ ═══ */}
            {step === 1 && (
              <div key="step-1" className="animate-rise-in">
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
                        className={`relative flex flex-col items-center p-3.5 sm:p-4.5 rounded-radius-xl border text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${activeColorClasses}`}
                      >
                        {/* Dấu tích khi vai trò được chọn */}
                        {isActive && (
                          <span className="absolute top-2 right-2 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
                            <Check size={11} className="stroke-[3px]" />
                          </span>
                        )}
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
            )}

            {/* ═══ BƯỚC 2: THÔNG TIN TÀI KHOẢN ═══ */}
            {step === 2 && (
              <div key="step-2" className="animate-rise-in space-y-5">
                <Input
                  label="Họ và tên"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
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
                    onBlur={handleEmailBlur}
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
              </div>
            )}

            {/* ═══ BƯỚC 3: HOÀN TẤT (tóm tắt + hồ sơ đối tác + điều khoản) ═══ */}
            {step === 3 && (
              <div key="step-3" className="animate-rise-in space-y-5">

                {/* Tóm tắt thông tin đã nhập để người dùng rà lại trước khi gửi */}
                <div className="rounded-radius-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Xác nhận thông tin</h3>
                    <button type="button" onClick={() => setStep(2)} className="text-[10px] font-extrabold hover:underline cursor-pointer" style={{ color: accent }}>
                      Chỉnh sửa
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5 truncate"><User size={13} className="text-slate-400 shrink-0" /> {name || '—'}</span>
                    <span className="flex items-center gap-1.5 truncate"><Phone size={13} className="text-slate-400 shrink-0" /> {phone || '—'}</span>
                    <span className="flex items-center gap-1.5 truncate sm:col-span-2"><Mail size={13} className="text-slate-400 shrink-0" /> {email || '—'}</span>
                    <span className="flex items-center gap-1.5 truncate">
                      <ShieldCheck size={13} className="shrink-0" style={{ color: accent }} /> Vai trò: <span style={{ color: accent }}>{roleLabel}</span>
                    </span>
                  </div>
                </div>

                {/* ─── ADDITIONAL FIELDS FOR OWNER ─────────────────────────────────────── */}
                {role === 'OWNER' && (
                  <div className="space-y-5 border-t border-slate-100 pt-5">
                    <h3 className="text-[10px] font-extrabold text-[#1A73E8] uppercase tracking-widest flex items-center gap-1.5">
                      <Store size={12} /> THÔNG TIN HỒ SƠ QUÁN ĂN (ĐỐI TÁC)
                    </h3>

                    <Input
                      label="Tên Quán Ăn"
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      onBlur={handleRestaurantNameBlur}
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
                        onBlur={handleRestaurantPhoneBlur}
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
                  <div className="space-y-5 border-t border-slate-100 pt-5">
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
                        onBlur={handleIdCardBlur}
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
                        onBlur={handleLicensePlateBlur}
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
                          <option value="CAR">Ô Tô (Car)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 leading-relaxed font-bold pt-1">
                  Bằng việc nhấn Đăng ký, bạn đồng ý với các{' '}
                  <a href="#terms" className="text-[#FF6B35] font-extrabold hover:underline">Điều khoản Dịch vụ</a> và{' '}
                  <a href="#privacy" className="text-[#FF6B35] font-extrabold hover:underline">Chính sách Bảo mật</a> của chúng tôi.
                </div>
              </div>
            )}

            {/* ─── ĐIỀU HƯỚNG BƯỚC (Quay lại / Tiếp tục / Đăng ký) ──────────────────── */}
            <div className="flex items-center gap-3 mt-7">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1.5 px-5 py-3.5 rounded-full border border-slate-200 bg-white text-slate-500 font-extrabold text-xs uppercase tracking-wider hover:bg-slate-50 hover:text-slate-700 active:scale-[0.98] transition-all cursor-pointer shrink-0"
                >
                  <ChevronLeft size={16} className="stroke-[2.5px]" /> Quay lại
                </button>
              )}

              {step < 3 ? (
                <button
                  key="btn-next"
                  type="button"
                  onClick={goNext}
                  className="flex-1 text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer group"
                  style={{ backgroundColor: accent }}
                >
                  <span className="uppercase tracking-wider text-xs">Tiếp tục</span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
                    <ChevronRight size={18} className="stroke-[2.5px]" />
                  </div>
                </button>
              ) : (
                <button
                  key="btn-submit"
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer group disabled:opacity-70"
                  style={{ backgroundColor: accent }}
                >
                  <span className="uppercase tracking-wider text-xs">
                    {loading ? 'Đang đăng ký...' : 'Đăng Ký Tài Khoản'}
                  </span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
                    <ChevronRight size={18} className="stroke-[2.5px]" />
                  </div>
                </button>
              )}
            </div>
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
