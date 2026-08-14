import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, Lock, User, Phone, ChevronRight, ChevronLeft, Store, Bike, FileText, MapPin, Lightbulb, Users, Check, ShieldCheck, ChefHat, Soup, UtensilsCrossed, TrendingUp, Wallet, Route, Hand, Pizza, IceCream, Sparkles, Clock, Gift, AtSign, Loader2, LogIn, Pencil, ClipboardCheck } from 'lucide-react';
import { validatePhone, validatePassword, validateName, validateEmail, validateIdCard, validateLicensePlate, formatLicensePlate } from '../../utils/validation';
import { ROLE_SCENE } from '../../components/auth/RoleScenes';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import MapModal from '../../components/common/MapModal';
import { toast } from 'react-toastify';
import MapModal2 from '../../components/common/Map';

// Panel hero ĐỔI THEO VAI TRÒ (màu + tiêu đề + icon + lợi ích) → hero "sống", ăn khớp bước chọn role.
// Gradient để tông sâu, bớt chói (bài học chống chói ở Login); lợi ích là MÔ TẢ TÍNH NĂNG thật, không số bịa.
const ROLE_HERO = {
  CUSTOMER: {
    tag: 'Khách hàng', Icon: User, ride: Bike, hi: Soup,
    grad: 'linear-gradient(135deg,#EF6C33 0%,#D9491C 45%,#A62D14 100%)',
    head: ['Đặt món ngon,', 'giao tận cửa'],
    sub: 'Khám phá món yêu thích từ nhiều quán và đặt hàng chỉ trong vài chạm.',
    benefits: [
      { Icon: UtensilsCrossed, label: 'Món đa dạng từ nhiều quán' },
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

// Hành trình "Cách hoạt động" theo vai trò — hiện ở bước chọn vai trò để lấp trống & giúp user mới hình dung
const HOW_IT_WORKS = {
  CUSTOMER: [
    { Icon: Store, t: 'Chọn quán & món' },
    { Icon: UtensilsCrossed, t: 'Đặt & thanh toán' },
    { Icon: Bike, t: 'Nhận hàng tận nơi' },
  ],
  OWNER: [
    { Icon: Store, t: 'Đăng ký quán' },
    { Icon: UtensilsCrossed, t: 'Thêm món vào menu' },
    { Icon: TrendingUp, t: 'Nhận đơn & bán' },
  ],
  SHIPPER: [
    { Icon: FileText, t: 'Đăng ký hồ sơ' },
    { Icon: ShieldCheck, t: 'Được Admin duyệt' },
    { Icon: Wallet, t: 'Nhận đơn kiếm tiền' },
  ],
};

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
    clearError('restaurantAddress');
  };
  const [errors, setErrors] = useState({});

  const [restaurantAddressLabel, setRestaurantAddressLabel] = useState('Khác');

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
  // Gõ tới đâu, dấu "-" hiện tới đó (vị trí cố định theo loại xe → không nhảy). Khách chỉ gõ chữ & số.
  const handleLicensePlateChange = (raw) => {
    setLicensePlate(formatLicensePlate(raw, vehicleType));
    if (errors.licensePlate) clearError('licensePlate');
  };
  const handleLicensePlateBlur = () =>
    validateLicensePlate(licensePlate)
      ? clearError('licensePlate')
      : setError('licensePlate', licensePlate.trim()
          ? 'Biển số chưa đúng định dạng (VD: 59H1-234.56 hoặc 51F-123.45).'
          : 'Vui lòng nhập biển số xe.');
  // Đổi loại xe → chèn lại dấu cho đúng cấu trúc xe máy/ô tô (không bắt gõ lại).
  const handleVehicleTypeChange = (next) => {
    setVehicleType(next);
    setLicensePlate((prev) => formatLicensePlate(prev, next));
  };

  const register = useAuthStore((state) => state.register);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enter/submit khi chưa ở bước cuối thì chỉ đi tiếp, không gửi đăng ký sớm
    if (step !== 3) { goNext(); return; }
    setLoading(true);
    setErrors({});

    const localErrors = {};
    if (!name.trim()) localErrors.fullName = 'Vui lòng nhập họ tên.';
    else if (!validateName(name)) localErrors.fullName = 'Họ tên phải có tối thiểu 2 ký tự.';

    if (!email.trim()) localErrors.email = 'Vui lòng nhập email.';
    else if (!validateEmail(email)) localErrors.email = 'Email không hợp lệ (ví dụ: ten@example.com).';

    if (!phone.trim()) localErrors.phone = 'Vui lòng nhập số điện thoại.';
    else if (!validatePhone(phone)) localErrors.phone = 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).';

    if (!password.trim()) localErrors.password = 'Vui lòng nhập mật khẩu.';
    else if (!validatePassword(password)) localErrors.password = 'Mật khẩu phải chứa ít nhất 8 ký tự.';

    if (role === 'OWNER') {
      if (!restaurantName.trim()) localErrors.restaurantName = 'Vui lòng nhập tên quán ăn.';
      if (!restaurantPhone.trim()) localErrors.restaurantPhone = 'Vui lòng nhập số điện thoại quán.';
      else if (!validatePhone(restaurantPhone)) localErrors.restaurantPhone = 'Số điện thoại quán không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số).';
      if (!restaurantAddress.trim()) localErrors.restaurantAddress = 'Vui lòng chọn địa chỉ quán trên bản đồ.';
    } else if (role === 'SHIPPER') {
      if (!idCard.trim()) localErrors.idCard = 'Vui lòng nhập số CCCD/CMND.';
      else if (!validateIdCard(idCard)) localErrors.idCard = 'CCCD/CMND phải gồm 9 hoặc 12 chữ số.';

      if (!licensePlate.trim()) localErrors.licensePlate = 'Vui lòng nhập biển số xe.';
      else if (!validateLicensePlate(licensePlate)) localErrors.licensePlate = 'Biển số chưa đúng định dạng (VD: 59H1-234.56 hoặc 51F-123.45).';
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
        if (code === 'PHONE_EXISTS') {
          setErrors(prev => ({ ...prev, phone: 'Số điện thoại này đã được đăng ký trên hệ thống!' }));
          setStep(2);
        } else if (code === 'EMAIL_EXISTS' || msg.includes('Email') || msg.toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: 'Email này đã được sử dụng bởi một tài khoản khác!' }));
          setStep(2);
        } else if (code === 'RESTAURANT_PHONE_EXISTS') {
          setErrors(prev => ({ ...prev, restaurantPhone: 'Số điện thoại quán đã được đăng ký!' }));
          setStep(3); // Giữ hoặc đưa về bước 3 để thấy lỗi của quán ăn
        } else if (code === 'ID_CARD_EXISTS' || msg.includes('CCCD')) {
          setErrors(prev => ({ ...prev, idCard: 'Số CCCD/CMND này đã được sử dụng để đăng ký tài khoản khác!' }));
          setStep(3);
        } else if (code === 'LICENSE_PLATE_EXISTS' || msg.includes('Biển số xe')) {
          setErrors(prev => ({ ...prev, licensePlate: 'Biển số xe này đã được đăng ký bởi tài xế khác!' }));
          setStep(3);
        } else {
          toast.error(msg || 'Đã có lỗi xảy ra, vui lòng thử lại.');
        }
      }
    }
  };

  // Mỗi vai trò có minh hoạ SVG động riêng (xem RoleScenes) — tra theo id.
  const roles = [
    { id: 'CUSTOMER', label: 'Khách Hàng', desc: 'Đặt đồ ăn giao tận nơi', icon: User, hex: '#FF6B35' },
    { id: 'OWNER', label: 'Quán Ăn', desc: 'Bán đồ ăn trên hệ thống', icon: Store, hex: '#1A73E8' },
    { id: 'SHIPPER', label: 'Tài Xế', desc: 'Giao đồ ăn kiếm thu nhập', icon: Bike, hex: '#34A853' },
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

  // ── Gợi ý ĐỘ MẠNH mật khẩu (hỗ trợ trực quan; điều kiện bắt buộc duy nhất là ≥8 ký tự) ──
  const pwLen = password.length;
  const pwHasMin = pwLen >= 8;
  const pwVariety = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const pwLevel = pwLen === 0 ? 0 : (!pwHasMin ? 1 : (pwVariety || pwLen >= 12 ? 3 : 2));
  const PW_META = { 1: { label: 'Yếu', color: '#ef4444' }, 2: { label: 'Trung bình', color: '#f59e0b' }, 3: { label: 'Mạnh', color: '#22c55e' } };

  // ── Gợi ý tên miền email phổ biến → khách khỏi gõ "@gmail.com…" ──
  const EMAIL_DOMAINS = ['@gmail.com'];
  const emailLocal = email.split('@')[0];
  const emailTypedDomain = email.includes('@') ? '@' + email.split('@').slice(1).join('@') : '';
  const emailSuggestions = (emailLocal.length > 0 && !validateEmail(email))
    ? EMAIL_DOMAINS.filter((d) => emailTypedDomain === '' || (d.startsWith(emailTypedDomain.toLowerCase()) && d !== emailTypedDomain.toLowerCase()))
    : [];
  const applyEmailDomain = (d) => { setEmail(emailLocal + d); clearError('email'); };

  // Kiểm tra 4 field cơ bản trước khi cho qua bước tiếp theo (chặn đi tiếp khi còn lỗi)
  const validateStep2 = () => {
    const le = {};

    if (!name.trim()) le.fullName = 'Vui lòng nhập họ và tên.';
    else if (!validateName(name)) le.fullName = 'Họ tên phải có ít nhất 2 ký tự.';

    if (!email.trim()) le.email = 'Vui lòng nhập địa chỉ email.';
    else if (!validateEmail(email)) le.email = 'Email không hợp lệ (ví dụ: ten@example.com).';

    if (!phone.trim()) le.phone = 'Vui lòng nhập số điện thoại.';
    else if (!validatePhone(phone)) le.phone = 'Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và gồm 10 chữ số).';

    if (!password) le.password = 'Vui lòng nhập mật khẩu.';
    else if (!validatePassword(password)) le.password = 'Mật khẩu phải chứa ít nhất 8 ký tự.';

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
        {/* Bỏ justify-between: brand ghim trên, phần còn lại (title+lợi ích) gom 1 khối canh giữa
            để không bị hở lỗ hổng lớn giữa hero khi form cao (bước 3 owner/shipper). */}
        <div className="hidden lg:flex flex-col relative overflow-hidden p-10 text-white transition-all duration-500" style={{ backgroundImage: hero.grad }}>

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

          {/* Khối giữa: phân bố ĐỀU top–giữa–đáy để lấp hết chiều cao (không cụm giữa gây trống 2 đầu) */}
          <div className="relative z-10 flex-1 flex flex-col justify-between gap-6 py-6">

          {/* Tiêu đề + icon vai trò (đổi theo role, re-animate nhờ key) */}
          <div key={role}>
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

          {/* Thẻ QUY TRÌNH DUYỆT — chỉ hiện ở bước cuối cho ĐỐI TÁC: lấp khoảng trống + trấn an "sau khi gửi thì sao" */}
          {step === 3 && (role === 'OWNER' || role === 'SHIPPER') && (
            <div className="relative z-10 rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-4 shadow-lg animate-rise-in" key={`nx-${role}`}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/85 flex items-center gap-1.5 mb-3">
                <Clock size={13} className="text-amber-200" /> Sau khi đăng ký
              </p>
              <div className="relative pl-1 space-y-3">
                {[
                  { Icon: FileText, t: 'Hồ sơ được gửi tới Admin' },
                  { Icon: ShieldCheck, t: 'Admin xét duyệt nhanh chóng' },
                  { Icon: role === 'OWNER' ? Store : Bike, t: role === 'OWNER' ? 'Mở bán & nhận đơn ngay' : 'Nhận đơn & kiếm thu nhập' },
                ].map((it, i) => {
                  const ItIcon = it.Icon;
                  return (
                    <div key={i} className="flex items-center gap-3 animate-rise-in" style={{ animationDelay: `${i * 90}ms` }}>
                      <span className="relative w-7 h-7 rounded-lg bg-white/20 border border-white/20 flex items-center justify-center shrink-0">
                        <ItIcon size={14} />
                        <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white text-[9px] font-black flex items-center justify-center" style={{ color: accent }}>{i + 1}</span>
                      </span>
                      <span className="text-[13px] font-bold text-white/95">{it.t}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thẻ giữa mặc định: NỀN TẢNG 3 TRONG 1 → SƠ ĐỒ HỆ SINH THÁI chảy (khác hẳn lưới "chọn vai trò"):
              3 nút nối bằng 1 tuyến, có đơn hàng chạy Khách → Quán → Tài xế; mỗi nút 1 chuyển động riêng. */}
          {!(step === 3 && (role === 'OWNER' || role === 'SHIPPER')) && (
            <div className="relative z-10 rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-4 shadow-lg animate-rise-in overflow-hidden">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/85 flex items-center gap-1.5 mb-4">
                <Users size={13} className="text-amber-200" /> Nền tảng 3 trong 1
              </p>

              <div className="relative flex items-start justify-between px-1">
                {/* Tuyến nối ngang + vệt sáng chảy */}
                <span className="absolute left-8 right-8 top-6 h-0.5 rounded-full bg-white/20 overflow-hidden pointer-events-none">
                  <span className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-flow" />
                </span>
                {/* Đơn hàng chạy dọc tuyến: Khách đặt → Quán nấu → Tài xế giao */}
                <span
                  className="absolute top-6 w-2.5 h-2.5 rounded-full bg-amber-300 animate-parcel-travel pointer-events-none"
                  style={{ left: '4%', boxShadow: '0 0 10px 2px rgba(252,211,77,0.85)' }}
                />

                {[
                  { t: 'Khách hàng', hex: '#FF6B35', me: 'CUSTOMER' },
                  { t: 'Quán ăn', hex: '#1A73E8', me: 'OWNER' },
                  { t: 'Tài xế', hex: '#34A853', me: 'SHIPPER' },
                ].map((it, i) => {
                  const Scene = ROLE_SCENE[it.me];
                  const isMe = role === it.me;
                  return (
                    <div
                      key={i}
                      className="relative z-[1] flex flex-1 flex-col items-center gap-2 animate-rise-in"
                      style={{ animationDelay: `${i * 110}ms` }}
                    >
                      <span
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isMe ? 'scale-110' : ''}`}
                        style={{
                          backgroundColor: isMe ? '#fff' : 'rgba(255,255,255,0.12)',
                          borderColor: isMe ? it.hex : 'rgba(255,255,255,0.3)',
                          boxShadow: isMe ? `0 8px 20px ${it.hex}66` : undefined,
                        }}
                      >
                        {/* Quầng thở quanh nút đang chọn */}
                        {isMe && <span className="absolute inset-0 rounded-full animate-node-glow pointer-events-none" />}
                        {/* Mini-cảnh động theo role — luôn "diễn" nhẹ để sơ đồ sống động */}
                        <Scene size={26} play style={{ color: isMe ? it.hex : '#fff' }} />
                        <span className="sr-only">{it.t}</span>
                      </span>
                      <span className={`text-[10px] font-bold ${isMe ? 'text-white' : 'text-white/75'}`}>{it.t}</span>
                    </div>
                  );
                })}
              </div>

              {/* Câu chốt: "3 trong 1" là MỘT dòng chảy khép kín, không phải 3 ô rời */}
              <p className="mt-3.5 text-center text-[10.5px] leading-snug text-white/70 font-medium">
                Một tài khoản — đặt món, mở quán hay giao hàng, đổi vai bất cứ lúc nào.
              </p>
            </div>
          )}

          {/* Lợi ích theo vai trò — mỗi dòng 1 animation idle KHÁC nhau + dấu tích cho phong phú */}
          <div className="relative z-10 space-y-2 pl-5" key={`b-${role}`}>
            {/* Đường nối dọc + luồng sáng chạy xuống → 3 mục thành 1 chuỗi liền mạch */}
            <span className="absolute left-[7px] top-4 bottom-4 w-0.5 rounded-full bg-white/15 overflow-hidden pointer-events-none">
              <span className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-white/80 to-transparent animate-line-flow" />
            </span>
            {hero.benefits.map(({ Icon, label }, i) => {
              const d = i * 0.6; // lệch pha → chuyển động chảy nối tiếp qua từng mục
              return (
                <div
                  key={i}
                  className="group relative flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 transition-all duration-300 hover:bg-white/10 hover:translate-x-1 animate-rise-in"
                  style={{ animationDelay: `${210 + i * 90}ms` }}
                >
                  <div className="relative w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:bg-white/25 group-hover:scale-110">
                    {/* Lớp 1 — quầng sáng thở */}
                    <span className="absolute inset-0 rounded-xl bg-white/40 blur-md animate-soft-halo pointer-events-none" style={{ animationDelay: `${d}s` }} />
                    {/* Lớp 2 — vòng sóng bung ra */}
                    <span className="absolute inset-0 rounded-xl border border-white/60 animate-ring-wave pointer-events-none" style={{ animationDelay: `${d}s` }} />
                    {/* Lớp 3 — icon nhảy nhiều chặng nối liền */}
                    <Icon size={18} className="relative z-[1] text-white animate-icon-dance" style={{ transformOrigin: 'center', animationDelay: `${d}s` }} />
                    {/* Dấu tích nhỏ — tính năng có sẵn */}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow z-10" style={{ color: accent }}>
                      <Check size={10} className="stroke-[3px]" />
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white/95 group-hover:text-white transition-colors">{label}</span>
                </div>
              );
            })}

            {/* Lộ trình giao hàng: shipper đạp xe CHÂN THẬT (bánh quay + thân rung + gia tốc + vạch tốc độ) */}
            <div className="relative h-16 mt-4">
              {/* Mặt đường */}
              <div className="absolute bottom-4 left-1 right-6 border-t-2 border-dashed border-white/30"></div>

              {/* ĐÍCH ĐẾN — khi shipper tới nơi: pin nảy, vòng thành công lan ra, tích "Đã giao" bật lên.
                  Tách outer (căn giữa) và inner (animation) để transform không đè nhau. */}
              <div className="absolute bottom-2 right-0 w-7 h-9 pointer-events-none">
                {/* vòng thành công lan toả */}
                <span className="absolute left-1/2 bottom-1.5 -translate-x-1/2">
                  <span className="block w-6 h-6 rounded-full border-2 border-emerald-300 animate-deliver-ring" style={{ transformOrigin: 'center' }} />
                </span>
                {/* tích "đã giao" bật lên trên pin */}
                <span className="absolute left-1/2 -top-0.5 -translate-x-1/2">
                  <span className="flex w-4 h-4 rounded-full bg-emerald-400 items-center justify-center shadow animate-deliver-pop" style={{ transformOrigin: 'center bottom' }}>
                    <Check size={10} className="text-white stroke-[3px]" />
                  </span>
                </span>
                {/* pin đích */}
                <span className="absolute left-1/2 bottom-0 -translate-x-1/2">
                  <MapPin size={20} className="block text-white/85 animate-pin-react" style={{ transformOrigin: 'center bottom' }} />
                </span>
              </div>

              {/* Shipper chạy hết đường tới đích (animate left) */}
              <div className="absolute bottom-3 left-0 animate-courier-run">
                <div className="relative animate-vroom">
                  {/* Vạch tốc độ loé sau đuôi */}
                  <span className="absolute top-2 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '0ms' }}></span>
                  <span className="absolute top-4 -left-4 h-[2px] w-5 rounded-full bg-white/40 animate-speed" style={{ animationDelay: '200ms' }}></span>
                  <span className="absolute top-6 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '420ms' }}></span>

                  {/* SVG shipper đạp xe NHƯ NGƯỜI THẬT — tách nhiều bộ phận cử động cùng nhịp bánh */}
                  <svg width="48" height="30" viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-md">
                    {/* Bóng đổ dưới xe — co giãn theo nhịp nhún (cảm giác trọng lượng) */}
                    <ellipse cx="32" cy="38.5" rx="21" ry="1.7" fill="white" stroke="none" className="animate-shadow-pulse" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />

                    {/* Hộp giao hàng + giá đỡ sau */}
                    <rect x="6.5" y="9" width="11" height="10" rx="2" fill="rgba(255,255,255,0.18)" />
                    <path d="M6.5 13 H17.5 M11 9 V7 H14 V9" strokeWidth="1.6" />
                    <path d="M13 30 L11.5 19 M17.5 19 L20.5 25" strokeWidth="1.3" />

                    {/* Khung xe (tĩnh) */}
                    <path d="M13 30 L30 30 L24 17 Z M30 30 L44 15 L51 30 M24 17 L44 15 M42 15 H47.5 M21 17 H26.5" />

                    {/* Crank + bàn đạp + bàn chân QUAY (đạp thật) */}
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-crank">
                      <path d="M30 26.6 L30 33.4" strokeWidth="1.6" />
                      <path d="M28.6 26.6 H31.4 M28.6 33.4 H31.4" strokeWidth="1.6" />
                      <circle cx="30" cy="26.6" r="1.1" fill="currentColor" stroke="none" />
                      <circle cx="30" cy="33.4" r="1.1" fill="currentColor" stroke="none" />
                    </g>

                    {/* Người đạp: thân gồng nhún + tay + đùi; đầu gật lệch nhịp (lồng nhau) */}
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-rider-pump">
                      <path d="M24 17 L29 27 M24 17 L31 27" strokeWidth="1.8" />
                      <path d="M24 17 L36 8" />
                      <path d="M36 8 L45 15" strokeWidth="1.8" />
                      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-head-bob">
                        <circle cx="39" cy="5.4" r="3.2" />
                      </g>
                    </g>

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
        </div>

        {/* ───── PANEL FORM (phải) ───── */}
        {/* lg:justify-center: canh giữa dọc để lấp khoảng trống khi form thấp hơn hero (bước 2/3) → cân đối 2 cột */}
        <div className="p-8 sm:p-10 relative overflow-hidden flex flex-col lg:justify-center">
          {/* Decorative highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>

          {/* ─── BRAND LOGO & HEADER ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center lg:items-start mb-6 relative z-10">
            {/* Logo chỉ hiện ở mobile (desktop đã có ở hero) */}
            <div className="lg:hidden w-14 h-14 bg-gradient-to-tr from-[#FF6B35] to-[#1A73E8] rounded-2xl flex items-center justify-center text-white shadow-shadow-3 mb-4 animate-float">
              <ChefHat size={26} />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight text-center lg:text-left">
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
                        {/* Halo kép lan toả (radar) khi active */}
                        {active && (
                          <>
                            <span className="absolute inset-0 rounded-full border-2 animate-halo pointer-events-none" style={{ borderColor: accent }}></span>
                            <span className="absolute inset-0 rounded-full border-2 animate-halo pointer-events-none opacity-60" style={{ borderColor: accent, animationDelay: '0.7s' }}></span>
                          </>
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
                          {/* active: icon "nhún" liên tục (bob); đổi icon↔tích thì bật ra (pop) */}
                          <span className={active ? 'flex animate-bob' : 'flex'}>
                            <span key={done ? 'check' : 'icon'} className="flex animate-scale-up">
                              {done ? <Check size={16} className="stroke-[3px]" /> : <Icon size={16} />}
                            </span>
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide transition-colors duration-300" style={{ color: on ? accent : '#94a3b8' }}>
                        {s.label}
                      </span>
                    </div>

                    {/* Thanh nối: track xám + fill chạy 0→100%; đã qua có VỆT SÁNG CHẢY; sắp tới có shimmer gợi ý */}
                    {i < STEPS.length - 1 && (
                      <div className="relative flex-1 h-1.5 mx-2 -mt-5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="relative h-full rounded-full overflow-hidden transition-all duration-500 ease-out"
                          style={{ width: step > s.id ? '100%' : '0%', backgroundColor: accent }}
                        >
                          {step > s.id && (
                            <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-flow" />
                          )}
                        </div>
                        {/* Shimmer gợi ý bước kế tiếp — chạy trên đoạn nối ngay sau bước đang đứng */}
                        {s.id === step && (
                          <span
                            className="absolute inset-y-0 left-0 w-1/3 rounded-full animate-flow pointer-events-none"
                            style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
                          />
                        )}
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
                    const hex = r.hex;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className="group relative overflow-hidden flex flex-col items-center p-3.5 sm:p-4.5 rounded-radius-xl border text-center transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer"
                        style={{
                          borderColor: isActive ? hex : '#e2e8f0',
                          backgroundColor: isActive ? `${hex}0D` : '#fff',
                          boxShadow: isActive ? `0 10px 26px ${hex}26` : undefined,
                        }}
                      >
                        {/* Dải sáng đỉnh khi chọn */}
                        {isActive && (
                          <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }} />
                        )}

                        {/* Tick góc phải — pop khi chọn */}
                        {isActive && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white animate-scale-up shadow-sm" style={{ backgroundColor: hex }}>
                            <Check size={12} className="stroke-[3px]" />
                          </span>
                        )}

                        {/* Chip icon — tô màu role khi chọn, phóng nhẹ khi hover.
                            Icon mang CHUYỂN ĐỘNG RIÊNG của vai trò (khách nhún chào · quán mở cửa · tài xế lái xe),
                            chỉ chạy khi thẻ đang chọn để bước-1 không rối; kèm 2 vòng sóng màu-role bung ra. */}
                        <span
                          className="relative w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 shrink-0 transition-all duration-300 group-hover:scale-110"
                          style={isActive
                            ? { backgroundColor: hex, color: '#fff', boxShadow: `0 6px 16px ${hex}55` }
                            : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                        >
                          {isActive && (
                            <>
                              <span className="absolute inset-0 rounded-2xl border-2 animate-ring-wave pointer-events-none" style={{ borderColor: hex }} />
                              <span className="absolute inset-0 rounded-2xl border-2 animate-ring-wave pointer-events-none" style={{ borderColor: hex, animationDelay: '1.1s' }} />
                            </>
                          )}
                          {/* Minh hoạ nhiều bộ phận, chuyển động từng khung hình — chỉ "diễn" khi đang chọn */}
                          {(() => { const Scene = ROLE_SCENE[r.id]; return <Scene size={28} play={isActive} className="relative" />; })()}
                        </span>

                        <span className="text-xs sm:text-sm font-extrabold block leading-tight" style={{ color: isActive ? hex : '#334155' }}>{r.label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight mt-1.5 hidden sm:block font-semibold">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Chip trấn an — giảm ngần ngại, khuyến khích user mới hoàn tất đăng ký */}
                <div className="flex items-center justify-center gap-2 flex-wrap mt-4">
                  {[
                    { Icon: Gift, label: 'Miễn phí đăng ký' },
                    { Icon: Clock, label: 'Chỉ vài phút' },
                    { Icon: ShieldCheck, label: 'Bảo mật thông tin' },
                  ].map(({ Icon, label }, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 rounded-full">
                      <Icon size={12} style={{ color: accent }} /> {label}
                    </span>
                  ))}
                </div>

                {role !== 'CUSTOMER' && (
                  <p className="text-[10px] sm:text-[11px] text-amber-700 font-semibold mt-3 flex items-center gap-1.5 bg-amber-50/70 border border-amber-100/70 px-3 py-2 rounded-radius-lg leading-snug">
                    <Lightbulb size={12} className="shrink-0 text-amber-500" />
                    <span>Hồ sơ đối tác cần <b className="font-extrabold">Admin duyệt</b> — điền chính xác để được duyệt nhanh.</span>
                  </p>
                )}

                {/* Cách hoạt động theo vai trò — lấp khoảng trống & giúp user mới hình dung hành trình */}
                <div className="mt-4 rounded-radius-lg border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles size={12} style={{ color: accent }} /> Cách hoạt động
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    {HOW_IT_WORKS[role].map((st, i) => {
                      const StIcon = st.Icon;
                      return (
                        <React.Fragment key={i}>
                          <div className="flex flex-col items-center text-center gap-1.5 flex-1 min-w-0 animate-rise-in" style={{ animationDelay: `${i * 80}ms` }}>
                            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}14`, color: accent }}>
                              <StIcon size={16} />
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 leading-tight">{st.t}</span>
                          </div>
                          {i < 2 && <ChevronRight size={14} className="text-slate-300 shrink-0 self-center -mt-4" />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
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
                  onChange={(e) => { setName(e.target.value); clearError('fullName'); }}
                  // onBlur={handleNameBlur}
                  placeholder="Nguyễn Văn A..."
                  icon={User}
                  error={errors.fullName}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
                  <div>
                    <Input
                      label="Địa chỉ Email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError('email');}}
                      // onBlur={handleEmailBlur}
                      placeholder="ten@example.com..."
                      icon={Mail}
                      error={errors.email}
                    />
                    {/* Chip gợi ý tên miền — bấm để tự thêm @gmail.com… khỏi gõ */}
                    {emailSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 animate-rise-in">
                        {emailSuggestions.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => applyEmailDomain(d)}
                            className="group inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 hover:border-md-primary hover:text-md-primary hover:bg-md-primary/5 px-2.5 py-1 rounded-full transition-all active:scale-95 cursor-pointer"
                          >
                            <AtSign size={10} className="text-md-primary group-hover:rotate-12 transition-transform" />
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Input
                    label="Số điện thoại"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearError('phone');}}
                    // onBlur={handlePhoneBlur}
                    placeholder="0901234567"
                    icon={Phone}
                    error={errors.phone}
                    inputMode="numeric"
                    maxLength={10}
                    // helperText="10 chữ số, bắt đầu bằng 0"
                  />
                </div>

                <Input
                  label="Mật khẩu"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {setPassword(e.target.value); clearError('password');}}
                  // onBlur={handlePasswordBlur}
                  placeholder="Tối thiểu 8 ký tự"
                  icon={Lock}
                  error={errors.password}
                />

                {/* Gợi ý độ mạnh mật khẩu — chỉ hiện khi bắt đầu gõ, giúp người dùng đặt pass an toàn */}
                {pwLen > 0 && (
                  <div className="-mt-2.5 space-y-2 animate-rise-in">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden flex gap-1">
                        {[1, 2, 3].map((seg) => (
                          <span
                            key={seg}
                            className="flex-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: seg <= pwLevel ? PW_META[pwLevel].color : '#e2e8f0' }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-extrabold tabular-nums shrink-0" style={{ color: PW_META[pwLevel].color }}>
                        {PW_META[pwLevel].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${pwHasMin ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <Check size={12} className={pwHasMin ? 'opacity-100' : 'opacity-40'} /> Ít nhất 8 ký tự
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${pwVariety ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <Check size={12} className={pwVariety ? 'opacity-100' : 'opacity-40'} /> Có cả chữ & số <span className="text-slate-300 font-normal">(khuyến nghị)</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ BƯỚC 3: HOÀN TẤT (tóm tắt + hồ sơ đối tác + điều khoản) ═══ */}
            {step === 3 && (
              <div key="step-3" className="animate-rise-in space-y-5">

                {/* Tóm tắt thông tin đã nhập — mỗi mục 1 chip icon màu riêng để rà nhanh trước khi gửi */}
                <div className="rounded-radius-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <ClipboardCheck size={13} style={{ color: accent }} /> Xác nhận thông tin
                    </h3>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="group inline-flex items-center gap-1 text-[10px] font-extrabold cursor-pointer px-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
                      style={{ color: accent }}
                    >
                      <Pencil size={11} className="group-hover:rotate-12 transition-transform" /> Chỉnh sửa
                    </button>
                  </div>
                  {/* Lưới 2×2: Họ tên | SĐT  /  Email | Vai trò — mỗi mục chip icon màu khác nhau */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: User, label: 'Họ tên', value: name || '—', chip: 'bg-indigo-50 text-indigo-500' },
                      { icon: Phone, label: 'Số điện thoại', value: phone || '—', chip: 'bg-emerald-50 text-emerald-500' },
                      { icon: Mail, label: 'Email', value: email || '—', chip: 'bg-blue-50 text-blue-500' },
                      { icon: ShieldCheck, label: 'Vai trò', value: roleLabel, chip: '', accent: true },
                    ].map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <div key={i} className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${f.chip}`}
                            style={f.accent ? { backgroundColor: `${accent}1A`, color: accent } : undefined}
                          >
                            <FIcon size={15} />
                          </span>
                          <div className="min-w-0">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide block leading-none">{f.label}</span>
                            <span
                              className="text-xs font-extrabold truncate block leading-none mt-1"
                              style={f.accent ? { color: accent } : { color: '#334155' }}
                            >
                              {f.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
                      // required
                      value={restaurantName}
                      onChange={(e) => {setRestaurantName(e.target.value); clearError('restaurantName');}}
                      // onBlur={handleRestaurantNameBlur}
                      placeholder="Ví dụ: Cơm Tấm Sài Gòn..."
                      icon={Store}
                      error={errors.restaurantName}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        label="Số Điện Thoại Quán Ăn"
                        type="tel"
                        // required
                        value={restaurantPhone}
                        onChange={(e) => {setRestaurantPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearError('restaurantPhone');}}
                        // onBlur={handleRestaurantPhoneBlur}
                        placeholder="Để khách liên hệ..."
                        icon={Phone}
                        error={errors.restaurantPhone}
                        inputMode="numeric"
                        maxLength={10}
                        helperText="Số để khách & shipper liên hệ khi giao"
                      />

                      <div className="cursor-pointer" onClick={() => setOpenMap(true)}>
                        <Input
                          label="Địa chỉ quán ăn"
                          type="text"
                          // required
                          readOnly
                          value={restaurantAddress}
                          placeholder="Chọn vị trí quán ăn trên bản đồ..."
                          icon={MapPin}
                          error={errors.restaurantAddress}
                          helperText={!errors.restaurantAddress ? 'Nhấn để chọn trên bản đồ' : ''}
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
                        // required
                        value={idCard}
                        onChange={(e) => { setIdCard(e.target.value.replace(/\D/g, '').slice(0, 12)); clearError('idCard'); }}
                        // onBlur={handleIdCardBlur}
                        placeholder="Số CCCD 12 số..."
                        icon={FileText}
                        error={errors.idCard}
                        inputMode="numeric"
                        maxLength={12}
                        helperText="Gồm 9 hoặc 12 chữ số trên căn cước"
                      />

                      <Input
                        label="Biển Số Xe"
                        type="text"
                        // required
                        value={licensePlate}
                        onChange={(e) => {handleLicensePlateChange(e.target.value); clearError('licensePlate');}}
                        // onBlur={handleLicensePlateBlur}
                        placeholder="Ví dụ: 59H1-23456..."
                        icon={Bike}
                        error={errors.licensePlate}
                        helperText="Chỉ gõ chữ & số — dấu “-” “.” tự hiện. VD: 59H1-234.56"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                        Loại Phương Tiện
                      </label>
                      <div className="relative">
                        <select
                          value={vehicleType}
                          onChange={(e) => handleVehicleTypeChange(e.target.value)}
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
                  className="group flex items-center gap-1.5 px-5 py-3.5 rounded-full border border-slate-200 bg-white text-slate-500 font-extrabold text-xs uppercase tracking-wider hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 active:scale-[0.98] transition-all cursor-pointer shrink-0"
                >
                  <ChevronLeft size={16} className="stroke-[2.5px] transition-transform duration-300 group-hover:-translate-x-1" /> Quay lại
                </button>
              )}

              {step < 3 ? (
                <button
                  key="btn-next"
                  type="button"
                  onClick={goNext}
                  className="relative overflow-hidden flex-1 text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:brightness-105 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
                  style={{ backgroundColor: accent, boxShadow: `0 8px 22px ${accent}44` }}
                >
                  <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-160%] group-hover:translate-x-[460%] transition-transform duration-700 ease-out" />
                  <span className="relative flex items-center gap-2 uppercase tracking-wider text-xs">
                    <Sparkles size={14} className="animate-pulse" /> Tiếp tục
                  </span>
                  <div className="relative w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 group-hover:bg-white/30 transition-all shrink-0">
                    <ChevronRight size={18} className="stroke-[2.5px]" />
                  </div>
                </button>
              ) : (
                <button
                  key="btn-submit"
                  type="submit"
                  disabled={loading}
                  className="relative overflow-hidden flex-1 text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:brightness-105 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group disabled:opacity-70"
                  style={{ backgroundColor: accent, boxShadow: `0 8px 22px ${accent}44` }}
                >
                  <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-160%] group-hover:translate-x-[460%] transition-transform duration-700 ease-out" />
                  <span className="relative flex items-center gap-2 uppercase tracking-wider text-xs">
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    {loading ? 'Đang đăng ký...' : 'Đăng Ký Tài Khoản'}
                  </span>
                  <div className="relative w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 group-hover:bg-white/30 transition-all shrink-0">
                    <ChevronRight size={18} className="stroke-[2.5px]" />
                  </div>
                </button>
              )}
            </div>
          </form>

          {/* Footer Navigation — link đăng nhập có icon + gạch chân chạy (đổi màu theo role) */}
          <div className="mt-8 flex items-center justify-center gap-1.5 relative z-10">
            <span className="text-xs sm:text-sm text-slate-500 font-semibold">Đã có tài khoản?</span>
            <button
              onClick={() => navigate('/login')}
              className="group inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold cursor-pointer"
              style={{ color: accent }}
            >
              <LogIn size={14} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
              <span className="relative">
                Đăng nhập
                <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full transition-all duration-300 group-hover:w-full" style={{ backgroundColor: accent }} />
              </span>
            </button>
          </div>

        </div>
      </div>
      
      {/* <MapModal
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        onConfirm={handleConfirmLocation}
      /> */}

      <MapModal2
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        onConfirm={handleConfirmLocation}
        initialLat={restaurantLat}
        initialLng={restaurantLng}
        isEditMode={!!restaurantAddress}
        addressLabel={restaurantAddressLabel}
        setAddressLabel={setRestaurantAddressLabel}
        showLabelSelector={false}
      />
    </div>
  );
}
