import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Lock, Phone, ChevronRight, User, Store, Bike, Shield, KeyRound, Mail, MessageSquare, AlertTriangle, CheckCircle2, Check, Eye, EyeOff, ChefHat, Star, ShieldCheck, Pizza, Soup, IceCream, Croissant, Sandwich, CupSoda, Sparkles, Users, UserPlus, Loader2, LogIn, QrCode } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { validatePassword, validatePhone } from '../../utils/validation';
import QrLoginPanel from './QrLoginPanel';

// Món ăn trang trí bay lơ lửng ở panel hero (phong cách quán ăn) — vị trí, độ trễ & kiểu trôi lệch nhau
const FOOD_DECOR = [
  { Icon: Pizza, wrap: 'top-[12%] right-[11%]', size: 30, delay: '0ms', anim: 'animate-drift' },
  { Icon: IceCream, wrap: 'top-[40%] right-[20%]', size: 22, delay: '600ms', anim: 'animate-float' },
  { Icon: Croissant, wrap: 'bottom-[22%] right-[12%]', size: 26, delay: '1200ms', anim: 'animate-float-slow' },
  { Icon: Soup, wrap: 'top-[20%] left-[13%]', size: 24, delay: '400ms', anim: 'animate-float-slow' },
  { Icon: Sandwich, wrap: 'bottom-[33%] left-[8%]', size: 22, delay: '900ms', anim: 'animate-drift' },
  { Icon: CupSoda, wrap: 'bottom-[12%] left-[24%]', size: 20, delay: '1500ms', anim: 'animate-float' },
];

// Đốm lấp lánh (twinkle) rải trên nền hero cho sinh động
const SPARKLES = [
  { wrap: 'top-[18%] right-[30%]', size: 14, delay: '0ms' },
  { wrap: 'top-[54%] right-[14%]', size: 11, delay: '700ms' },
  { wrap: 'bottom-[20%] left-[31%]', size: 13, delay: '1100ms' },
  { wrap: 'top-[30%] left-[27%]', size: 10, delay: '1600ms' },
];

// Điểm nổi bật ở đáy hero — MÔ TẢ TÍNH NĂNG (không dùng số liệu bịa để tránh bị hội đồng chất vấn).
// Mỗi icon 1 kiểu chuyển động ĐÚNG TÍNH CÁCH, khác hẳn nhau (không phải chỉ rung lên xuống):
//   xe → lắc nghiêng như đang chạy · sao → lấp lánh · khiên → đập nhịp bảo vệ.
const FEATURES = [
  { Icon: Bike, label: 'Giao hàng tận nơi tiện lợi', idle: 'animate-wiggle' },
  { Icon: Star, label: 'Đa dạng quán ăn & món ngon', idle: 'animate-twinkle' },
  { Icon: ShieldCheck, label: 'Thanh toán an toàn, minh bạch', idle: 'animate-heart-beat' },
];

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  // Login State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // toggle xem mật khẩu ở ô đăng nhập
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [remember, setRemember] = useState(false);   // ghi nhớ SĐT cho lần đăng nhập sau (hỗ trợ user cũ)
  const [capsOn, setCapsOn] = useState(false);        // cảnh báo Caps Lock khi gõ mật khẩu

  // Nạp sẵn SĐT đã ghi nhớ → user cũ khỏi gõ lại. Chỉ lưu SĐT (định danh), KHÔNG lưu mật khẩu/token.
  useEffect(() => {
    const saved = localStorage.getItem('md_remember_phone');
    if (saved) { setPhone(saved); setRemember(true); }
  }, []);

  // Parallax vật lý cho lớp trang trí hero: món ăn "trôi" nhẹ theo con trỏ (ghi thẳng CSS var, không re-render).
  const heroRef = useRef(null);
  const handleHeroMove = (e) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const handleHeroLeave = () => {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  };

  // Forgot Password State
  const [mode, setMode] = useState('login'); // 'login' or 'forgot-password'
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS'); // 'SMS' or 'EMAIL'
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Countdown timer for resending OTP (Spam protection)
  useEffect(() => {
    let timer = null;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) return;

    setErrorMsg('');
    setLoading(true);
    const res = await login(phone, password);
    setLoading(false);
    
    if (res.success) {
      // Ghi nhớ / xoá SĐT theo lựa chọn (chỉ SĐT, không đụng token — tuân thủ bảo mật in-memory)
      if (remember) localStorage.setItem('md_remember_phone', phone);
      else localStorage.removeItem('md_remember_phone');
      toast.success('Đăng nhập thành công! Đang chuyển hướng...', { autoClose: 1000 });
      setTimeout(() => {
        const currentRole = useAuthStore.getState().role;
        if (currentRole === 'MERCHANT' || currentRole === 'OWNER') navigate('/merchant');
        else if (currentRole === 'SHIPPER') navigate('/shipper');
        else if (currentRole === 'ADMIN') navigate('/admin');
        else navigate('/');
      }, 800);
    } else if (res.needVerify) {
      // Tài khoản chưa xác thực OTP -> chuyển sang trang nhập OTP (kèm email từ backend),
      // đánh dấu fromLogin để trang OTP tự gửi lại mã mới.
      toast.info('Tài khoản chưa xác thực OTP. Đang chuyển tới trang xác thực...', { autoClose: 1500 });
      navigate('/register/otp', { state: { email: res.email, phone, fromLogin: true } });
    } else {
      setErrorMsg(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
      toast.error(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
    }
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    if (!phoneOrEmail) {
      toast.warn('Vui lòng nhập số điện thoại hoặc email!');
      return;
    }

    setForgotLoading(true);
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/forgot-password/send-otp', {
        phoneOrEmail,
        method: otpMethod
      });
      setOtpSent(true);
      setCountdown(60); // Khóa 60s chống spam
      toast.success(response.data?.message || 'Mã OTP khôi phục mật khẩu đã được gửi!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại!';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpCode || !newPassword) {
      toast.warn('Vui lòng nhập đầy đủ mã OTP và mật khẩu mới!');
      return;
    }
    // Kiểm tra độ mạnh mật khẩu cho nhất quán với luồng Đăng ký (tối thiểu 8 ký tự).
    if (!validatePassword(newPassword)) {
      toast.warn('Mật khẩu mới phải chứa ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setForgotLoading(true);
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/forgot-password/reset', {
        phoneOrEmail,
        otpCode,
        newPassword
      });
      toast.success(response.data?.message || 'Đặt lại mật khẩu thành công!');
      
      // Chuyển về chế độ Login và nạp sẵn thông tin vừa đổi
      setMode('login');
      setPhone(phoneOrEmail);
      setPassword('');
      setOtpSent(false);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra lại!';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMode('login');
    setErrorMsg('');
    setOtpSent(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-google-sans relative overflow-hidden">

      {/* Soft ambient orbs nền */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B35]/20 to-[#FF6B35]/5 rounded-full blur-3xl opacity-60 animate-pulse-slow"></div>
      <div className="absolute -bottom-48 -right-48 w-[28rem] h-[28rem] bg-gradient-to-tr from-[#1A73E8]/15 to-[#1A73E8]/5 rounded-full blur-3xl opacity-50"></div>

      {/* ═══ CARD 2 CỘT (hero trái + form phải) ═══ */}
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-shadow-4 border border-slate-200/60 overflow-hidden grid lg:grid-cols-2 relative z-10 animate-slide-up">

        {/* ───── PANEL HERO PHONG CÁCH QUÁN ĂN (chỉ desktop) ───── */}
        <div
          ref={heroRef}
          onMouseMove={handleHeroMove}
          onMouseLeave={handleHeroLeave}
          className="hidden lg:flex flex-col justify-between relative overflow-hidden p-10 text-white bg-gradient-to-br from-[#EF6C33] via-[#D9491C] to-[#A62D14] bg-[length:180%_180%] animate-gradient-pan"
        >

          {/* Lớp làm dịu (vignette tối ở rìa) chống chói + tăng độ tương phản chữ */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,transparent_38%,rgba(0,0,0,0.30)_100%)]"></div>
          {/* Hoạ tiết chấm bi mờ tạo chất liệu */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.13] bg-[radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[length:18px_18px]"></div>
          {/* Quầng sáng dịu */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-200/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-black/15 rounded-full blur-3xl pointer-events-none"></div>
          {/* Vệt sáng quét ngang định kỳ */}
          <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none"></div>

          {/* Lớp trang trí trôi theo con trỏ (parallax) — món ăn & đốm lấp lánh */}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: 'translate3d(calc(var(--px,0) * 20px), calc(var(--py,0) * 20px), 0)' }}
          >
            {FOOD_DECOR.map(({ Icon, wrap, size, delay, anim }, i) => (
              <Icon key={i} size={size} style={{ animationDelay: delay }} className={`absolute ${wrap} text-white/20 ${anim}`} />
            ))}
            {SPARKLES.map(({ wrap, size, delay }, i) => (
              <Sparkles key={`s${i}`} size={size} style={{ animationDelay: delay }} className={`absolute ${wrap} text-white/70 animate-twinkle`} />
            ))}
          </div>

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg animate-float">
              <ChefHat size={22} />
            </div>
            <span className="text-xl font-extrabold tracking-tight">MealDash</span>
          </div>

          {/* Tagline + thẻ kính đánh giá nổi */}
          <div className="relative z-10 my-8">
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight animate-rise-in drop-shadow-sm">
              Ngon từ bếp,<br />nhanh tới cửa <Soup size={30} className="inline-block align-middle -mt-1.5 text-amber-200" />
            </h1>
            <p className="text-sm text-white/85 font-semibold mt-3 max-w-xs leading-relaxed animate-rise-in" style={{ animationDelay: '90ms' }}>
              Đặt món từ quán yêu thích, giao tận nơi nhanh chóng — tất cả trên một nền tảng.
            </p>

            {/* Thẻ kính điểm nhấn CÓ THẬT: mô hình 3-in-1 đúng kiến trúc hệ thống (Khách/Quán/Tài xế) */}
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 px-4 py-2.5 shadow-lg mt-5 animate-rise-in" style={{ animationDelay: '200ms' }}>
              <Users size={16} className="text-amber-200 shrink-0" />
              <span className="text-[13px] font-bold text-white/95 leading-none">
                Nền tảng 3 trong 1: Khách · Quán · Tài xế
              </span>
            </div>
          </div>

          {/* Điểm nổi bật — chip trắng + icon MÀU riêng, mỗi dòng animation idle KHÁC nhau, hover trượt phải */}
          <div className="relative z-10 space-y-2">
            {FEATURES.map(({ Icon, label, idle }, i) => (
              <div
                key={i}
                className="group flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 transition-all duration-300 hover:bg-white/10 hover:translate-x-1 animate-rise-in"
                style={{ animationDelay: `${340 + i * 90}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 group-hover:bg-white/25 group-hover:scale-110">
                  <Icon size={18} className={`text-white ${idle}`} style={{ transformOrigin: 'center' }} />
                </div>
                <span className="text-sm font-bold text-white/95 group-hover:text-white transition-colors">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ───── PANEL FORM (phải) ───── */}
        <div className="p-8 sm:p-10 flex flex-col relative">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>

          {/* Header form */}
          <div className="flex flex-col items-center lg:items-start mb-8 relative z-10">
            {/* Logo chỉ hiện ở mobile (desktop đã có ở panel hero) */}
            <div className="lg:hidden w-14 h-14 bg-gradient-to-tr from-[#FF6B35] to-[#1A73E8] rounded-2xl flex items-center justify-center text-white shadow-shadow-3 mb-4 animate-float">
              <ChefHat size={26} />
            </div>

            <span className="text-[10px] bg-orange-50 text-[#FF6B35] font-extrabold px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-orange-100">
              {mode === 'login' ? 'Đăng nhập' : mode === 'qr' ? 'Đăng nhập QR' : 'Khôi phục mật khẩu'}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-3.5 tracking-tight text-center lg:text-left">
              {mode === 'login' ? 'Chào mừng trở lại!' : mode === 'qr' ? 'Quét mã để đăng nhập' : 'Khôi phục mật khẩu'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 text-center lg:text-left font-semibold max-w-xs leading-relaxed">
              {mode === 'login' ? (
                <>Đặt đồ ăn online siêu tốc với triết lý <span className="text-[#FF6B35] font-extrabold">Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span></>
              ) : mode === 'qr' ? (
                'Dùng điện thoại đã đăng nhập MealDash để quét mã, không cần gõ mật khẩu'
              ) : (
                'Nhập số điện thoại hoặc email đã đăng ký để nhận mã OTP xác thực (hiệu lực trong 5 phút)'
              )}
            </p>
          </div>

          {/* Error message banner */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-radius-md text-[11px] font-bold mb-4 flex items-start gap-2 leading-relaxed shrink-0">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-extrabold block mb-0.5 text-red-700">Lỗi xử lý:</span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* ─── VIEW MODE: LOGIN ─────────────────────────────────────────────────── */}
          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5.5 relative z-10">
              
              {/* SĐT */}
              <div className="space-y-2 animate-rise-in" style={{ animationDelay: '40ms' }}>
                <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                  <Phone size={11} className="text-[#FF6B35]" /> Số điện thoại
                </label>
                <div className="relative text-slate-400 focus-within:text-[#FF6B35] transition-colors">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2" size={16} />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="0901234567..."
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400"
                  />
                  {/* Tick xanh khi SĐT đủ 10 số hợp lệ → trấn an user nhập đúng */}
                  {validatePhone(phone) && (
                    <CheckCircle2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-scale-up" />
                  )}
                </div>
              </div>
 
              {/* Mật khẩu */}
              <div className="space-y-2 animate-rise-in" style={{ animationDelay: '120ms' }}>
                <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                  <Lock size={11} className="text-[#FF6B35]" /> Mật khẩu
                </label>
                <div className="relative text-slate-400 focus-within:text-[#FF6B35] transition-colors">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                    onKeyDown={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                    onBlur={() => setCapsOn(false)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400"
                  />
                  {/* Nút xem/ẩn mật khẩu — Eye ⇄ EyeOff xoay + fade chéo nhau, nhún khi bấm */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 hover:text-[#FF6B35] active:scale-90 transition-all cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                  >
                    <Eye
                      size={16}
                      className={`absolute inset-0 m-auto transition-all duration-300 ${
                        showPassword ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
                      }`}
                    />
                    <EyeOff
                      size={16}
                      className={`absolute inset-0 m-auto transition-all duration-300 ${
                        showPassword ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                      }`}
                    />
                  </button>
                </div>
                {/* Cảnh báo Caps Lock — lỗi đăng nhập kinh điển, báo sớm cho user cũ */}
                {capsOn && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 pl-1 animate-rise-in">
                    <AlertTriangle size={12} className="shrink-0" /> Phím Caps Lock đang bật — mật khẩu phân biệt HOA/thường.
                  </p>
                )}
              </div>
 
              {/* Option Bar — checkbox tuỳ biến (tick pop) + link quên mật khẩu có gạch chân chạy */}
              <div className="flex items-center justify-between pt-1 animate-rise-in" style={{ animationDelay: '200ms' }}>
                <label className="group flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="relative flex">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 active:scale-90 peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF6B35]/30 ${
                      remember
                        ? 'bg-gradient-to-tr from-[#FF6B35] to-amber-400 border-[#FF6B35] shadow-sm shadow-orange-500/30'
                        : 'border-slate-300 bg-white group-hover:border-[#FF6B35]/60'
                    }`}>
                      <Check size={13} className={`text-white stroke-[3.5px] transition-all duration-200 ${remember ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
                    </span>
                  </span>
                  <span className={`text-xs font-bold transition-colors ${remember ? 'text-[#FF6B35]' : 'text-slate-500 group-hover:text-slate-700'}`}>
                    Ghi nhớ tài khoản
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); setErrorMsg(''); }}
                  className="group inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B35] bg-transparent border-none cursor-pointer"
                >
                  <KeyRound size={13} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                  <span className="relative">
                    Quên mật khẩu?
                    <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-[#FF6B35] transition-all duration-300 group-hover:w-full" />
                  </span>
                </button>
              </div>
 
              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                style={{ animationDelay: '280ms' }}
                className="relative overflow-hidden w-full bg-gradient-to-r from-[#FF6B35] to-[#FF6B35]/95 hover:from-[#ff7947] hover:to-[#FF6B35] text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group animate-rise-in disabled:opacity-70"
              >
                {/* Vệt sáng quét ngang khi hover (physics sweep) */}
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-160%] group-hover:translate-x-[460%] transition-transform duration-700 ease-out" />

                <span className="relative flex items-center gap-2 uppercase tracking-wider text-xs">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} className="transition-transform group-hover:-translate-x-0.5" />}
                  {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
                </span>
                <div className="relative w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 group-hover:bg-white/30 transition-all shrink-0">
                  <ChevronRight size={18} className="stroke-[2.5px]" />
                </div>
              </button>

              {/* Chia & chuyển sang đăng nhập bằng QR */}
              <div className="flex items-center gap-3 animate-rise-in" style={{ animationDelay: '320ms' }}>
                <span className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">hoặc</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={() => { setMode('qr'); setErrorMsg(''); }}
                style={{ animationDelay: '360ms' }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all cursor-pointer animate-rise-in"
              >
                <QrCode size={16} /> Đăng nhập bằng mã QR
              </button>

            </form>
          ) : mode === 'qr' ? (

            // ─── VIEW MODE: QR LOGIN ─────────────────────────────────────────────────
            <QrLoginPanel onBack={() => { setMode('login'); setErrorMsg(''); }} />

          ) : (
            
            // ─── VIEW MODE: FORGOT PASSWORD ──────────────────────────────────────────
            <div className="space-y-6 relative z-10">
              
              {/* Form 1: Nhập email/phone và gửi OTP */}
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                    Số điện thoại hoặc Email
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      disabled={otpSent}
                      value={phoneOrEmail}
                      onChange={(e) => setPhoneOrEmail(e.target.value)}
                      placeholder="Nhập SĐT (09...) hoặc Email..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {/* Chọn phương thức gửi OTP */}
                {!otpSent && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Phương thức nhận mã OTP
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'SMS', label: 'Gửi qua SMS', icon: MessageSquare },
                        { id: 'EMAIL', label: 'Gửi qua Email', icon: Mail }
                      ].map((m) => {
                        const Icon = m.icon;
                        const isSelected = otpMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setOtpMethod(m.id)}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-radius-lg border font-bold text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <Icon size={14} />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Nút gửi OTP */}
                {!otpSent && (
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-gradient-to-r from-[#1A73E8] to-[#1A73E8]/95 hover:from-blue-600 hover:to-[#1A73E8] text-white font-extrabold py-3 px-4 rounded-full text-xs uppercase tracking-wider shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {forgotLoading ? 'Đang gửi...' : 'Gửi mã OTP xác thực'}
                  </button>
                )}
              </form>

              {/* Form 2: Nhập OTP và Reset mật khẩu */}
              {otpSent && (
                <form onSubmit={handleResetPassword} className="space-y-4 pt-4 border-t border-slate-100 animate-fade-in">
                  
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-radius-lg text-[11px] font-bold leading-normal flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <div>
                      Mã OTP đã được gửi đến {phoneOrEmail} qua {otpMethod === 'SMS' ? 'tin nhắn SMS' : 'Email'}. 
                      Vui lòng kiểm tra mã xác thực.
                    </div>
                  </div>

                  {/* Mã OTP */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pl-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Nhập mã OTP (6 số)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {countdown > 0 ? (
                          `Gửi lại sau ${countdown}s`
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendForgotOtp}
                            className="text-[#1A73E8] hover:underline font-bold bg-transparent border-none cursor-pointer"
                          >
                            Gửi lại mã OTP
                          </button>
                        )}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Nhập 6 chữ số..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400 text-center tracking-[0.5em] font-mono text-base"
                    />
                  </div>

                  {/* Mật khẩu mới */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Nhập lại mật khẩu mới */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF6B35]/95 hover:from-[#ff7947] hover:to-[#FF6B35] text-white font-extrabold py-3.5 px-4 rounded-full text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {forgotLoading ? 'Đang thực hiện...' : 'Xác nhận & Đặt lại mật khẩu'}
                  </button>
                </form>
              )}

              {/* Nút quay lại login */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline bg-transparent border-none cursor-pointer"
                >
                  ← Quay lại Đăng nhập
                </button>
              </div>

            </div>
          )}

          {/* Footer — thẻ CTA dẫn dắt USER MỚI đăng ký (thay dòng chữ nhỏ) */}
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="group mt-8 w-full flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3.5 hover:bg-orange-50 hover:border-[#FF6B35]/40 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer relative z-10 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6B35] to-amber-400 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <UserPlus size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-700">Bạn chưa có tài khoản?</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Đăng ký miễn phí chỉ trong vài phút</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-extrabold text-[#FF6B35]">
                Đăng ký <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          )}

        </div>
      </div>
      <ToastContainer />
    </div>
  );
}